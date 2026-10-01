# 04 — Phase 3: Asset Library, รายละเอียด, Download

## FR ที่ครอบคลุม
- ดูรายการ Digital Assets ทั้งหมดในองค์กร
- ดูรายละเอียดของแต่ละ Asset
- แสดง Preview / Thumbnail เมื่อรองรับ
- ดาวน์โหลด Asset ในองค์กร

## กฎการมองเห็น (ใช้ร่วมกับคนที่ 2)

เขียนเป็นโมดูลกลาง `lib/access.ts` ทั้งสองคนใช้ร่วมกัน

```ts
canView(user, asset):
  if asset.deleted_at != null            → false
  if asset.owner_id == user.id           → true
  switch asset.visibility:
    ORGANIZATION → true
    TEAM         → user เป็นสมาชิกของ collection (ที่ยังไม่ถูกลบ) ที่มี asset นี้อยู่
    PRIVATE      → false
```

**"ทีม" = สมาชิกของ Collection** (`collection_members`) ไม่มีตาราง Team แยก
- TEAM ที่ยังไม่ได้อยู่ใน collection ไหน → เห็นแค่เจ้าของ
- เอา asset ออกจาก collection, ลบสมาชิก หรือลบ collection → สมาชิกคนนั้นเห็นไม่ได้อีก (ถ้าไม่ได้อยู่ collection อื่นที่มี asset นี้)

เวอร์ชัน SQL (`visibleAssetsWhere(userId)`) ใช้ใน list, keyword search และ semantic search:

```sql
a.deleted_at IS NULL AND (
  a.owner_id = $userId
  OR a.visibility = 'ORGANIZATION'
  OR (a.visibility = 'TEAM' AND EXISTS (
    SELECT 1
    FROM asset_collection ac
    JOIN collections c
      ON c.collection_id = ac.collection_id AND c.deleted_at IS NULL
    JOIN collection_members cm
      ON cm.collection_id = ac.collection_id AND cm.user_id = $userId
    WHERE ac.asset_id = a.asset_id
  ))
)
```

## Library
- `GET /api/assets` แสดงเฉพาะ:
  - asset ที่ผ่าน `visibleAssetsWhere(userId)` (ORGANIZATION ทั้งหมด + TEAM ที่อยู่ใน collection ของฉัน + ของตัวเอง)
  - `processing_status IN ('PROCESSING','READY','FAILED')` ไม่แสดง UPLOADING
- มีแท็บ "ของฉัน" (`?owner=me`) ที่แสดง asset ของตัวเองทุก visibility
- แสดงป้ายสถานะ Processing / Ready / Failed (คนที่ 2 เป็นคนอัปเดตค่า)
- Filter / Sort / Pagination ดู [08-filter-sort.md](08-filter-sort.md)

## รายละเอียด
- `GET /api/assets/:id` → เช็ก `canView` แล้วคืน:
  - ข้อมูลทั่วไปของ asset และ metadata
  - ข้อมูล owner (display_name, avatar)
  - tags
  - collections ที่ user เห็น
  - `previewUrl`

## Preview / Thumbnail
- ถ้ามี `thumbnail_key` → presigned GET ของ thumbnail
- ถ้ายังไม่มีและเป็นรูป → presigned GET ของไฟล์ต้นฉบับ (อายุสั้น)
- ถ้าเป็น PDF และยังไม่มี thumbnail → แสดง icon ตามประเภทไฟล์
- ใครสร้าง thumbnail: รอตกลงกับคนที่ 2

## Download
```
GET /api/assets/:id/download
→ เช็ก canView
→ presigned GET (หมดอายุ 5 นาที) พร้อม
   ResponseContentDisposition: attachment; filename*=UTF-8''<encodeURIComponent(original_name)>
→ INSERT audit_logs (DOWNLOAD)
← 302 redirect ไป URL นั้น (หรือคืน { url } เป็น JSON)
```
- ใช้ `filename*=UTF-8''` เพื่อให้ชื่อไฟล์ภาษาไทยไม่เพี้ยน

## Checklist
- [x] `lib/access.ts` (`canView` + เงื่อนไข SQL) — คนที่ 2 เขียน
- [x] รายการ Asset (`listAssets`) — หน้า Library เป็น Server Component ไม่ต้องมี API แยก
- [x] รายละเอียด Asset (`lib/assets/detail.ts`)
- [x] `GET /api/assets/:id/download` + audit log (ชื่อไฟล์ภาษาไทยผ่าน `filename*`)
- [x] `GET /api/assets/:id/preview` (inline, ใช้ thumbnail ถ้ามี)
- [x] หน้า Library (grid + ป้ายสถานะ) — thumbnail จริงรอ Processing
- [x] หน้ารายละเอียด Asset (`/assets/[id]`)
- [x] ทดสอบ: asset PRIVATE ของคนอื่นได้ 404 ทั้งหน้า, download และ preview
