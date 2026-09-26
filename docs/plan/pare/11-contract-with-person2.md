# 11 — ข้อตกลงระหว่างคนที่ 1 และคนที่ 2

จุดที่งานของสองคนเชื่อมกัน ควรตกลงให้ครบก่อนเริ่มเขียนโค้ดส่วนที่เกี่ยวข้อง

---

## A. ต้องตกลงก่อนเริ่ม

### A1. Schema ที่คนที่ 1 ขอเพิ่มหรือแก้
- [ ] `users.status` — `ACTIVE` / `DISABLED` (DEFAULT `ACTIVE`)
- [ ] `users.token_version INT NOT NULL DEFAULT 0`
- [ ] `users.password_hash` ให้เป็น NULL ได้ (NULL = ยังไม่ตั้งรหัส ใช้ได้แค่ Google login)
- [ ] `users.email`, `users.google_sub` เป็น UNIQUE
- [ ] `users.created_at`, `users.updated_at`
- [ ] แก้ชื่อ `avartar_url` → `avatar_url`
- [ ] แก้ FK ที่อ้าง `user.id` → `users.user_id`
- [ ] `collections` PK = `collection_id`
- [ ] `collection_members` PK = `(collection_id, user_id)`
- [ ] ตาราง Team และสมาชิกทีม (ถ้าจะใช้ visibility แบบ TEAM)
- [ ] ค่า `file_type`: `DOCUMENT` / `IMAGE`
- [ ] Index ตาม [08-filter-sort.md](08-filter-sort.md)

**ระหว่างรอ:** คนที่ 1 พัฒนาบน Postgres ใน docker-compose ไปก่อน

### A2. VPC ต้องออกอินเทอร์เน็ตได้
- Lambda ของคนที่ 1 ต้องอยู่ใน VPC เพื่อต่อ RDS และต้องเรียก Google OAuth ได้ด้วย
- จึงต้องมี NAT ในที่นี้คือ NAT instance ตาม [ADR-1](01-architecture-decisions.md)
- Security Group ของ RDS ต้องรับ connection จาก SG ของ web Lambda

### A3. ใครเปลี่ยน `processing_status` ช่วงไหน
```
คนที่ 1:  (สร้าง) UPLOADING → PROCESSING    ใน POST /api/assets/:id/complete
คนที่ 2:  PROCESSING → READY | FAILED
```

### A4. ข้อความใน SQS ที่คนที่ 1 ส่งให้คนที่ 2
```json
{
  "version": 1,
  "assetId": 123,
  "s3Key": "assets/123/original.pdf",
  "bucket": "assethub-prod-...",
  "mimeType": "application/pdf",
  "fileType": "DOCUMENT",
  "fileSize": 1048576
}
```
- คนที่ 2 ต้องทำให้การประมวลผลซ้ำไม่มีผลเสีย (idempotent) เพราะ SQS อาจส่งข้อความเดียวกันมาซ้ำ
- ข้อความที่ล้มเหลวเกิน N ครั้งให้ไปลง DLQ แล้วตั้งสถานะ `FAILED`

### A5. ชนิดไฟล์ที่รองรับ
- ต้องตรงกันทั้งสองฝั่ง: ฝั่งอัปโหลดรับได้แค่ไหน ฝั่งประมวลผลต้องรองรับได้ทั้งหมด ดูร่างใน [03-upload.md](03-upload.md)

---

## B. ตกลงระหว่างทำได้

### B1. Filter/Sort กับ Keyword Search
- **ทางเลือก 1:** ใช้ `GET /api/assets` ร่วมกัน คนที่ 1 ทำ filter/sort แล้วคนที่ 2 เพิ่ม `q=`
- **ทางเลือก 2:** คนที่ 2 แยกเป็น `/api/search` แต่ต้องใช้ `parseAssetFilters()` และ query builder ตัวเดียวกัน

### B2. สิทธิ์การมองเห็น
- `lib/access.ts` (`canView`, `visibleAssetsWhere`) เป็นโมดูลกลาง
- ทั้ง Library, Keyword Search และ Semantic Search ต้องใช้โมดูลนี้
- Semantic Search ต้องกรอง `processing_status = 'READY'` เพิ่มอีกชั้น

### B3. Soft delete
- คนที่ 1 ตั้ง `deleted_at`
- คนที่ 2 ต้องกรอง `deleted_at IS NULL` ในทุกการค้นหา
- ตอน job ลบถาวร ([05](05-edit-delete.md)) ต้องลบ chunks และ embeddings ด้วย ใครเป็นคนเขียนส่วนนี้: ___

### B4. Thumbnail
- ใครสร้าง: ___ (เสนอให้คนที่ 2 ทำใน Processing)
- key: `assets/{assetId}/thumbnail.webp` แล้วอัปเดต `assets.thumbnail_key`

### B5. Metadata สำหรับ Dashboard
- คนที่ 1 บันทึก `file_size`, `mime_type`, `file_type`, `file_extension` โดยใช้ค่าจาก HeadObject ใน `/complete`
- Dashboard ของคนที่ 2 อ่านจากคอลัมน์เหล่านี้

---

## C. โค้ดและ Infra ที่ใช้ร่วมกัน

| สิ่งที่ใช้ร่วม | เจ้าของ | อีกฝ่ายทำอะไร |
|---|---|---|
| `lib/db.ts` (`max: 1`) + migrations | คนที่ 2 | คนที่ 1 import ไปใช้ |
| `lib/access.ts` | คนที่ 1 | คนที่ 2 ใช้ใน search |
| `lib/s3.ts` | คนที่ 1 | คนที่ 2 ใช้ใน processing |
| S3 bucket (`infra/storage.ts`) | คนที่ 1 | link เข้ากับ processing Lambda |
| SQS queue (`infra/processing.ts`) | คนที่ 2 | คนที่ 1 link เข้ากับ web เพื่อส่งข้อความ |
| VPC / RDS (`infra/vpc.ts`, `infra/database.ts`) | คนที่ 2 | คนที่ 1 ให้ web Lambda อยู่ใน VPC |
| Types ของ enum (`visibility`, `processing_status`, `file_type`) | คนที่ 2 (มาจาก schema) | ใช้ร่วมกัน |
