# 02 — Phase 1: Auth

## FR ที่ครอบคลุม
- ยืนยันตัวตนด้วยบัญชี Google ของบริษัท
- ระบบตรวจว่าอีเมลจาก Google OAuth เป็นอีเมลบริษัท
- ผู้ใช้ตั้งรหัสผ่าน AssetHub ได้ หลังยืนยันตัวตนผ่าน Google สำเร็จ
- เข้าสู่ระบบด้วยอีเมลบริษัทและรหัสผ่าน
- ตรวจอีเมล รหัสผ่าน และสถานะบัญชีก่อนอนุญาตให้เข้าสู่ระบบ
- สร้าง Session/Token เมื่อเข้าสู่ระบบสำเร็จ
- ออกจากระบบ

## ภาพรวม: เข้าสู่ระบบได้ 2 วิธี

| วิธี | ใช้ได้เมื่อ |
|---|---|
| 1. Google OAuth | ใช้ได้ทุกครั้ง |
| 2. อีเมล + รหัสผ่าน | ต้องเคย login ด้วย Google อย่างน้อย 1 ครั้ง (เพื่อให้มีอีเมลใน DB) **และ** ตั้งรหัสผ่านไว้แล้ว |

```
ครั้งแรก:    Login ด้วย Google → ระบบบันทึกอีเมลลง DB → เข้าใช้งานได้ทันที
                                     │
                                     └→ (ไม่บังคับ) กดปุ่ม "ตั้งรหัสผ่าน"
                                        → บันทึก password_hash
ครั้งต่อไป:  Login ด้วย Google เหมือนเดิม
             หรือ Login ด้วยอีเมล + รหัสผ่านที่ตั้งไว้
ลืมรหัส:     Login ด้วย Google → เปลี่ยนรหัสผ่านได้โดยไม่ต้องใส่รหัสเดิม
```

- **การตั้งรหัสผ่านไม่บังคับ:** ผู้ใช้ที่ไม่ตั้งใช้ Google login ได้ตลอด
- **สมัครด้วยอีเมลและรหัสผ่านโดยตรงไม่ได้:** ทุกบัญชีต้องเริ่มจาก Google เพราะเป็นทางเดียวที่ยืนยันได้ว่าเป็นอีเมลบริษัทจริง
- **ไม่มีระบบส่งอีเมลรีเซ็ตรหัส:** Google login ทำหน้าที่ยืนยันตัวตนแทน

## Flow

### วิธีที่ 1: Google OAuth
```
1. GET /api/auth/google
   → redirect ไป Google พร้อม state (เก็บใน cookie กัน CSRF) และ hd=<โดเมนบริษัท>
2. GET /api/auth/google/callback?code=...&state=...
   → เช็กว่า state ตรงกับที่เก็บไว้
   → แลก code เป็น id_token แล้ว verify signature ด้วย JWKS ของ Google
   → เช็ก email_verified === true
   → เช็กโดเมน: claim `hd` และท้ายอีเมลต้องเป็นโดเมนบริษัท (ต้องผ่านทั้งสองข้อ)
   → upsert users ด้วย google_sub
        - ครั้งแรก: INSERT (email, google_sub, display_name, avatar_url, status = ACTIVE)
        - ครั้งถัดไป: UPDATE display_name, avatar_url
   → เช็ก status === ACTIVE (ถ้าเป็น DISABLED ให้ปฏิเสธ)
   → ออก session (amr = "google") → redirect เข้าแอป
```

### วิธีที่ 2: อีเมล + รหัสผ่าน
```
POST /api/auth/login { email, password }
→ หา user ด้วย email (แปลงเป็นตัวพิมพ์เล็กก่อน)
→ ถ้าไม่พบ user หรือ password_hash IS NULL → ตอบ 401 แบบเดียวกับรหัสผิด
→ bcrypt.compare
→ เช็ก status === ACTIVE
→ ออก session (amr = "password")
```
- ถ้าผิด ให้ตอบข้อความเดียวกันทุกกรณี ("อีเมลหรือรหัสผ่านไม่ถูกต้อง") ไม่บอกว่าผิดที่อีเมล รหัสผ่าน หรือยังไม่ได้ตั้งรหัส
- หน้า login แสดงข้อความถาวรไว้ใต้ฟอร์ม: *"ยังไม่เคยตั้งรหัสผ่าน หรือลืมรหัสผ่าน? เข้าสู่ระบบด้วย Google แล้วตั้งรหัสผ่านที่หน้าโปรไฟล์"*
- ควรมี rate limit เบื้องต้นกัน brute force

### ตั้ง / เปลี่ยนรหัสผ่าน
```
PUT /api/me/password
body: { newPassword, currentPassword? }
→ requireUser()
→ ตรวจว่ามีสิทธิ์ตั้งรหัส (ต้องผ่านข้อใดข้อหนึ่ง):
    a) ยังไม่เคยตั้งรหัส (password_hash IS NULL)
    b) ส่ง currentPassword มาและถูกต้อง
    c) session นี้มาจาก Google login ภายใน 10 นาที (amr = "google" และ now - auth_time <= 10 นาที)
       ← ใช้กรณีลืมรหัส
  ไม่ผ่าน → 403 { code: "REAUTH_REQUIRED" }
    → frontend ให้ใส่รหัสเดิม หรือกด "ยืนยันด้วย Google" ซึ่งพาไป Google login แล้วกลับมาหน้าเดิม
→ เช็กความยาวขั้นต่ำ 8 ตัว แล้ว hash ด้วย bcrypt (cost 10–12)
→ UPDATE password_hash, token_version += 1   (เตะ session บนเครื่องอื่นออก)
→ ออก session ใหม่ให้เครื่องปัจจุบัน
```

**ทำไมต้องมีข้อ c:** กันกรณีคนอื่นมาใช้เครื่องที่ login ค้างไว้แล้วเปลี่ยนรหัสได้ทันที การเปลี่ยนรหัสต้องพิสูจน์ตัวตนสดๆ ด้วยรหัสเดิมหรือ Google

### UI
- **หน้าโปรไฟล์ / ตั้งค่าบัญชี:** มีปุ่มตลอด
  - `hasPassword: false` → ปุ่ม **"ตั้งรหัสผ่าน"** ใส่แค่รหัสใหม่และยืนยันรหัส
  - `hasPassword: true` → ปุ่ม **"เปลี่ยนรหัสผ่าน"** มีช่องรหัสเดิม และลิงก์ "ลืมรหัสผ่าน? ยืนยันด้วย Google แทน"
    - ถ้าเพิ่ง login ด้วย Google มา (ภายใน 10 นาที) ให้ซ่อนช่องรหัสเดิมไปเลย
- **แถบแนะนำบนหน้าหลัก:** แสดงเมื่อ `hasPassword: false`
  - ข้อความ *"ตั้งรหัสผ่านเพื่อเข้าสู่ระบบด้วยอีเมลได้"* + ปุ่ม [ตั้งเลย] + ปุ่ม [×]
  - กด × แล้วจำไว้ใน localStorage และไม่แสดงอีก (ปุ่มในหน้าโปรไฟล์ยังอยู่)

### Logout
```
POST /api/auth/logout → ลบ cookie
```
- JWT เป็น stateless จึงยกเลิก token ที่ออกไปแล้วไม่ได้ `users.token_version` ใช้เตะทุก session ของ user ได้ เช่นตอนเปลี่ยนรหัส

## Session
- ทั้งสองวิธีออก session แบบเดียวกัน
- JWT อายุสั้น (เช่น 8 ชม.) payload:
  ```
  { sub: user_id, ver: token_version, amr: "google" | "password", auth_time: <unix> }
  ```
- เก็บใน cookie แบบ `httpOnly; Secure; SameSite=Lax; Path=/`
- secret เก็บใน SST Secret / SSM (ห้าม commit)

## ตรวจสอบสถานะผู้ใช้
- Middleware / helper `requireUser()` ทำงานทุก request ที่ต้อง login:
  1. อ่านและ verify JWT
  2. โหลด user จาก DB แล้วเช็ก `status === 'ACTIVE'` และ `token_version` ตรงกัน
  3. แนบ `user` เข้า context
- `GET /api/me` คืน `{ userId, email, displayName, avatarUrl, hasPassword, recentGoogleAuth }` ห้ามส่ง `password_hash` ออกไป

## Schema ที่ต้องการ (ขอคนที่ 2)
```sql
users.status         -- 'ACTIVE' | 'DISABLED'  (DEFAULT 'ACTIVE')
users.token_version  INT NOT NULL DEFAULT 0
users.password_hash  NULL ได้ (NULL = ยังไม่ตั้งรหัส ใช้ได้แค่ Google login)
users.google_sub     UNIQUE NOT NULL
users.email          UNIQUE NOT NULL (เก็บเป็นตัวพิมพ์เล็ก)
users.created_at, users.updated_at
-- แก้ชื่อ avartar_url → avatar_url
```

## Environment / Secrets
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ALLOWED_EMAIL_DOMAIN`
- `JWT_SECRET`

## Checklist
- [ ] สร้าง OAuth Client ใน Google Cloud Console (redirect URI สำหรับ localhost และ CloudFront)
- [ ] `GET /api/auth/google` + state cookie + รองรับ `returnTo` (กลับมาหน้าเดิมหลังยืนยัน)
- [ ] `GET /api/auth/google/callback` + verify id_token + เช็กโดเมน + upsert user
- [ ] `POST /api/auth/login` (อีเมล + รหัสผ่าน)
- [ ] `PUT /api/me/password` (ตั้ง / เปลี่ยน / ลืมรหัสผ่านผ่าน Google)
- [ ] `POST /api/auth/logout`
- [ ] `requireUser()` middleware + เช็ก status และ token_version
- [ ] `GET /api/me` (+ `hasPassword`, `recentGoogleAuth`)
- [ ] หน้า Login: ปุ่ม "เข้าสู่ระบบด้วย Google" + ฟอร์มอีเมล/รหัสผ่าน + ข้อความแนะนำ
- [ ] หน้าโปรไฟล์: ปุ่ม "ตั้งรหัสผ่าน" / "เปลี่ยนรหัสผ่าน"
- [ ] แถบแนะนำตั้งรหัสผ่านบนหน้าหลัก (ปิดได้)
- [ ] Rate limit ของ login
- [ ] ทดสอบ:
  - อีเมลนอกโดเมนต้องถูกปฏิเสธ
  - user ที่ยังไม่ตั้งรหัสต้อง login ด้วยรหัสผ่านไม่ได้ (ได้ข้อความ generic)
  - user ที่ DISABLED ต้อง login ไม่ได้ทั้งสองวิธี
  - เปลี่ยนรหัสโดยไม่ใส่รหัสเดิม และไม่ได้เพิ่ง Google login → ต้องได้ 403
  - ลืมรหัส: Google login แล้วเปลี่ยนรหัสได้โดยไม่ต้องใส่รหัสเดิม
  - เปลี่ยนรหัสแล้วต้องใช้รหัสเดิมไม่ได้ และ session บนเครื่องอื่นต้องหลุด
