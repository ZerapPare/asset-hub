# Database

PostgreSQL + pgvector (>= 0.5.0) + pg_trgm

## Migrations

| ไฟล์ | เนื้อหา |
|---|---|
| `migrations/0001_schema.sql` | extensions, ตาราง, unique index ที่บังคับกฎข้อมูล, trigger `updated_at` |
| `migrations/0002_indexes.sql` | index เพื่อความเร็ว (FK, dashboard, purge, keyword search, semantic search) |

- รันตามลำดับเลขไฟล์ แต่ละไฟล์อยู่ใน transaction เดียว ถ้า error ให้ `ROLLBACK` แล้วแก้ก่อนรันใหม่
- แก้ schema หลังจากแชร์ไปแล้ว → สร้างไฟล์ใหม่ต่อท้าย (`0003_...sql`) อย่าแก้ไฟล์เดิม

### วิธีรัน
- **docker:** `docker compose up -d` รันทุกไฟล์ให้เองตอนสร้าง volume ครั้งแรก
  - มี migration ใหม่ → รันไฟล์นั้นเองใน DBeaver หรือ `docker compose down -v && docker compose up -d` (ข้อมูลหาย)
- **DBeaver:** เปิดไฟล์ → เลือก database → Execute SQL Script ทีละไฟล์ตามลำดับ

### ตรวจหลังรัน
```sql
-- ต้องได้ 12 ตาราง
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ต้องได้ vector (>= 0.5.0) และ pg_trgm
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');
```

## Embeddings
- เอกสาร: Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`) → `document_embeddings`
- รูป: Titan Multimodal Embeddings (`amazon.titan-embed-image-v1`) → `image_embeddings`
- ทั้งคู่ 1024 มิติ แต่อยู่คนละ vector space เทียบกันตรงๆ ไม่ได้ คำค้นต้อง embed ด้วย model เดียวกับตารางที่จะค้น

## การลบ
- ผู้ใช้กดลบ = soft delete (`UPDATE ... SET deleted_at = NOW()`) กู้คืน = `SET deleted_at = NULL`
- job รายวันลบถาวร asset/collection ที่ `deleted_at < NOW() - INTERVAL '7 days'`
  1. ลบ S3 object (`s3_key`, `thumbnail_key`) **ก่อน**
  2. `DELETE FROM assets` → chunks, embeddings, tags, collection links, workflows ถูกลบตาม (`ON DELETE CASCADE`)
- `audit_logs` ยังอยู่ (`asset_id` / `collection_id` เป็น NULL) จึงต้องเก็บชื่อไว้ใน `details`
- ไม่ลบ user จริง (FK ที่อ้าง `users` เป็น NO ACTION)

## กฎที่ schema ไม่ได้บังคับ (แอปต้องทำเอง)

**Auth**
1. รับ Google sign-in เฉพาะโดเมนบริษัท: verify ID token, เช็ก `hd` และ `email_verified = true`
2. ระบุตัว user ด้วย `google_sub` และอัปเดต email / display_name / avatar_url ทุกครั้งที่ login ด้วย Google
3. `password_hash IS NULL` → พาไปหน้าตั้งรหัสผ่าน ตั้ง `password_hash` กับ `password_set_at` พร้อมกัน (bcrypt)
4. Login ด้วยรหัสผ่าน ค้นด้วย `LOWER(BTRIM(email))` และตอบ error แบบเดียวกันทั้งกรณีรหัสผิดและยังไม่ได้ตั้งรหัส
5. ทุก request เช็ก `status = 'ACTIVE'` และ `token_version` ตรงกับ `ver` ใน JWT

**สิทธิ์การมองเห็น** (`lib/access.ts`)
6. `ORGANIZATION` ทุกคนเห็น, `PRIVATE` เจ้าของเท่านั้น, `TEAM` เจ้าของ + สมาชิกของ collection (ที่ยังไม่ถูกลบ) ที่มี asset นั้น
7. ทุก query / download / preview ต้องเช็กสิทธิ์ และกรอง `deleted_at IS NULL` ทั้งใน list, keyword search, semantic search, collection และ dashboard
8. Semantic search กรอง `processing_status = 'READY'` เพิ่ม

**Collection**
9. ห้ามเพิ่ม asset `PRIVATE` เข้า collection และห้ามเปลี่ยนเป็น `PRIVATE` ขณะยังอยู่ใน collection (ล็อกแถว asset ตอนทำทั้งสองอย่าง)
10. asset `TEAM` เพิ่มเข้า collection ได้เฉพาะเจ้าของไฟล์
11. สร้าง collection กับสมาชิก `OWNER` ใน transaction เดียวกัน และห้ามลบหรือลดสิทธิ์ `OWNER` คนสุดท้าย

**Processing**
12. เช็กว่า asset เป็น `DOCUMENT` / `IMAGE` ตรงกับข้อมูลที่จะเขียน (chunks เฉพาะเอกสาร, image embedding เฉพาะรูป)
13. ถ้า asset ถูก soft delete ระหว่างประมวลผล ให้ข้ามการเขียน chunks / embeddings

**Audit**
14. เขียน audit log ใน transaction เดียวกับการเปลี่ยนข้อมูล
