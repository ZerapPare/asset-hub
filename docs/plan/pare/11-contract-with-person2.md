# 11 — ข้อตกลงระหว่างคนที่ 1 และคนที่ 2

จุดที่งานของสองคนเชื่อมกัน ควรตกลงให้ครบก่อนเริ่มเขียนโค้ดส่วนที่เกี่ยวข้อง

---

## A. ต้องตกลงก่อนเริ่ม

### A1. Schema ที่คนที่ 1 ขอเพิ่มหรือแก้
> Schema อยู่ที่ `db/migrations/` ดูคำอธิบายใน [db/README.md](../../../db/README.md)

- [x] `users.status` — `ACTIVE` / `DISABLED` (DEFAULT `ACTIVE`)
- [x] `users.token_version INT NOT NULL DEFAULT 0`
- [x] `users.password_hash` ให้เป็น NULL ได้ (NULL = ยังไม่ตั้งรหัส ใช้ได้แค่ Google login)
- [x] `users.email`, `users.google_sub` เป็น UNIQUE
- [x] `users.created_at`, `users.updated_at`
- [x] แก้ชื่อ `avartar_url` → `avatar_url`
- [x] แก้ FK ที่อ้าง `user.id` → `users.user_id`
- [x] `collections` PK = `collection_id`
- [x] `collection_members` PK = `(collection_id, user_id)`
- [x] PK ทุกตารางเป็น UUID (`gen_random_uuid()`)
- [x] ~~ตาราง Team~~ ไม่ต้องมี: "ทีม" = สมาชิก collection (`collection_members`) ดูกฎใน [04](04-library-download.md)
- [x] ค่า `file_type`: `DOCUMENT` / `IMAGE`
- [ ] Index ตาม [08-filter-sort.md](08-filter-sort.md)

**ระหว่างรอ:** คนที่ 1 พัฒนาบน Postgres ใน docker-compose ไปก่อน

### A2. VPC ต้องออกอินเทอร์เน็ตได้
- Lambda ของคนที่ 1 ต้องอยู่ใน VPC เพื่อต่อ RDS และต้องเรียก Google OAuth ได้ด้วย
- จึงต้องมี NAT ในที่นี้คือ NAT instance ตาม [ADR-1](01-architecture-decisions.md)
- Security Group ของ RDS ต้องรับ connection จาก SG ของ web Lambda
- ✅ **ทำแล้ว:** NAT `t4g.micro` + SG `assethub-lambda` / `assethub-rds` — ID อยู่ใน `infra/vpc.ts` (web Lambda ใช้ `vpc.privateSubnets` + `vpc.lambdaSecurityGroup`)

### A3. ใครเปลี่ยน `processing_status` ช่วงไหน
```
คนที่ 1:  (สร้าง) UPLOADING → PROCESSING    ใน POST /api/assets/:id/complete
คนที่ 2:  PROCESSING → READY | FAILED
```

### A4. ข้อความใน SQS ที่คนที่ 1 ส่งให้คนที่ 2
```json
{
  "version": 1,
  "assetId": "0b6f3c2e-8d1a-4f5e-9c7b-2a4d6e8f1a3c",
  "s3Key": "assets/0b6f3c2e-8d1a-4f5e-9c7b-2a4d6e8f1a3c/original.pdf",
  "bucket": "assethub-prod-...",
  "mimeType": "application/pdf",
  "fileType": "DOCUMENT",
  "fileSize": 1048576
}
```
- คนที่ 2 ต้องทำให้การประมวลผลซ้ำไม่มีผลเสีย (idempotent) เพราะ SQS อาจส่งข้อความเดียวกันมาซ้ำ
- ข้อความที่ล้มเหลวเกิน N ครั้งให้ไปลง DLQ แล้วตั้งสถานะ `FAILED`
- ✅ **ทำแล้ว** (`infra/processing.ts`, ยังไม่ได้ deploy):
  - ส่ง: `enqueueProcessing()` ใน `lib/processing/queue.ts` — ตั้ง env `PROCESSING_QUEUE_URL` = ส่งเข้า SQS, ไม่ตั้ง (dev) = ประมวลผลใน server; ส่งไม่สำเร็จไม่ทำให้อัปโหลดล้ม (cron ส่งใหม่)
  - รับ: worker `lib/processing/handler.ts` ทีละข้อความ, N = 3 แล้วไป DLQ, รอบสุดท้ายตั้ง `FAILED`, มี CloudWatch alarm เมื่อมีข้อความใน DLQ
  - cron `lib/processing/maintenance.ts` (ทุก 30 นาที): ส่งไฟล์ที่ค้าง `PROCESSING` > 20 นาทีเข้าคิวใหม่ + ทำ embedding ที่ขาด
  - **คนที่ 1 ใน `infra/web.ts`:** env `PROCESSING_QUEUE_URL = queue.url` + `sqs:SendMessage` บน `queue.arn`

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
- job ลบถาวร ([05](05-edit-delete.md)): หลัง `deleted_at` เกิน **7 วัน** คนที่ 1 ลบ S3 object ก่อน แล้ว `DELETE FROM assets`
  - chunks, embeddings, tags, collection links และ workflows ถูกลบตามอัตโนมัติด้วย `ON DELETE CASCADE` คนที่ 2 ไม่ต้องเขียนเพิ่ม
  - `audit_logs.asset_id` กลายเป็น NULL แต่ log ยังอยู่

### B4. Thumbnail
- ใครสร้าง: **คนที่ 2** ใน Processing ✅ (รูปและ PDF หน้าแรก)
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
| SQS queue (`infra/processing.ts`) | คนที่ 2 | คนที่ 1 ส่ง env `PROCESSING_QUEUE_URL` + สิทธิ์ `sqs:SendMessage` ให้ web |
| Bedrock (`lib/embeddings.ts`, `bedrockPermissions()` ใน `infra/processing.ts`) | คนที่ 2 | คนที่ 1 ใส่ `bedrockPermissions({ translation: true })` ให้ web (embed + แปลคำค้นตอนค้นหา) |
| VPC / RDS (`infra/vpc.ts`, `infra/database.ts`) | คนที่ 2 | คนที่ 1 ให้ web Lambda อยู่ใน VPC |
| Types ของ enum (`visibility`, `processing_status`, `file_type`) | คนที่ 2 (มาจาก schema) | ใช้ร่วมกัน |
| วิธี query DB | คนที่ 2 | ใช้ `postgres.js` เขียน SQL ตรง (ไม่ใช้ ORM) — enum/row type เขียนมือใน `lib/schema.ts` |
