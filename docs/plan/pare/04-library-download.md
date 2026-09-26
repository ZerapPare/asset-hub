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
    TEAM         → user อยู่ในทีมเดียวกับ owner  (รอตกลงเรื่องตาราง Team)
    PRIVATE      → false
  // เพิ่มเติม: ถ้า user เป็นสมาชิก collection ที่มี asset นี้ → true (รอตกลง ดู 12)
```

และมีเวอร์ชัน SQL (`visibleAssetsWhere(userId)`) ไว้ใช้ใน list, search และ semantic search

## Library
- `GET /api/assets` แสดงเฉพาะ:
  - `visibility = 'ORGANIZATION'`
  - `deleted_at IS NULL`
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
- [ ] `lib/access.ts` (`canView` + เงื่อนไข SQL) และแชร์ให้คนที่ 2
- [ ] `GET /api/assets` (list + "ของฉัน")
- [ ] `GET /api/assets/:id`
- [ ] `GET /api/assets/:id/download` + audit log
- [ ] หน้า Library (grid + thumbnail + ป้ายสถานะ)
- [ ] หน้ารายละเอียด Asset
- [ ] ทดสอบ: asset PRIVATE ของคนอื่นต้องได้ 404 และไม่โผล่ใน list
