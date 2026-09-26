# 07 — Phase 4: Collection

## FR ที่ครอบคลุม
- สร้าง Collection เพื่อรวบรวม Asset ตามโครงการ หัวข้อ หรือทีม
- Collection ใช้ร่วมกันในองค์กรหรือทีมได้
- ดู Asset ทั้งหมดใน Collection ได้เมื่อเป็นสมาชิก
- เพิ่มหรือเอา Asset ออกได้เฉพาะเมื่อมีสิทธิ์
- คนที่ไม่ใช่สมาชิกจะไม่เห็น Collection แต่ยังค้นหาและเปิด Asset ได้จาก Library กลาง
- Asset หนึ่งไฟล์อยู่ได้หลาย Collection โดยไม่ต้องสร้างไฟล์ซ้ำ
- ผู้สร้างแก้ชื่อและรายละเอียดได้

## สิทธิ์

| การกระทำ | OWNER | EDITOR | VIEWER |
|---|:-:|:-:|:-:|
| ดู Collection / ดาวน์โหลด Asset | ✓ | ✓ | ✓ |
| เพิ่ม / เอา Asset ออก | ✓ | ✓ | |
| แก้ชื่อ / รายละเอียด | ✓ | ✓ | |
| เพิ่ม / ลบสมาชิก | ✓ | | |
| เปลี่ยน permission สมาชิก | ✓ | | |
| ลบ Collection | ✓ | | |

- ตอนสร้าง collection ให้ INSERT ผู้สร้างเป็นสมาชิก `OWNER` ใน transaction เดียวกันด้วย
- helper: `requireCollectionRole(user, collectionId, minRole)`
  - ถ้าไม่ใช่สมาชิก ตอบ 404 (ไม่เผยว่ามี collection นี้อยู่)
  - ถ้าเป็นสมาชิกแต่สิทธิ์ไม่พอ ตอบ 403

## กฎการเพิ่ม Asset
- **ห้ามเพิ่ม asset ที่เป็น PRIVATE**
- asset ที่จะเพิ่มต้องเป็นอันที่ผู้เพิ่มมองเห็นได้ (`canView`)
- asset แบบ TEAM ที่อยู่ใน collection: สมาชิกที่ไม่อยู่ในทีมจะเห็นหรือไม่ → **รอตัดสินใจ** ดู [12](12-open-questions.md)
- ต้องมี OWNER อย่างน้อย 1 คนเสมอ ห้ามลบหรือลดสิทธิ์ OWNER คนสุดท้าย

## API
```
GET    /api/collections                         → collection ที่ฉันเป็นสมาชิก
POST   /api/collections                         { name, description }
GET    /api/collections/:id                     (VIEWER+)
PATCH  /api/collections/:id                     (EDITOR+)
DELETE /api/collections/:id                     (OWNER, soft delete)

GET    /api/collections/:id/assets              (VIEWER+, filter/sort เหมือน Library)
POST   /api/collections/:id/assets              { assetIds: [] }  (EDITOR+)
DELETE /api/collections/:id/assets/:assetId     (EDITOR+)

GET    /api/collections/:id/members             (VIEWER+)
POST   /api/collections/:id/members             { email, permission }  (OWNER)
PATCH  /api/collections/:id/members/:userId     { permission }  (OWNER)
DELETE /api/collections/:id/members/:userId     (OWNER; สมาชิกออกเองได้)
```

## Schema ที่ต้องแก้ (ขอคนที่ 2)
- `collections`: PK เป็น `collection_id` ตัวเดียว (ในเอกสารเขียน `(collection_id, user_id)` ผิด)
- `collection_members`: PK `(collection_id, user_id)`
- `asset_collection`: PK `(asset_id, collection_id)` (มีอยู่แล้ว)

## Checklist
- [ ] `requireCollectionRole()`
- [ ] CRUD collection (สร้างพร้อมเพิ่มผู้สร้างเป็น OWNER)
- [ ] เพิ่ม/เอา asset ออก + ห้าม PRIVATE
- [ ] จัดการสมาชิก + กันไม่ให้ OWNER คนสุดท้ายหายไป
- [ ] UI: หน้ารายการ collection, หน้า collection, หน้าจัดการสมาชิก, ปุ่ม "เพิ่มเข้า Collection" ในหน้า asset/upload
- [ ] ทดสอบสิทธิ์ครบทุกแถวในตารางด้านบน
