# 08 — Phase 5: Filter / Sort

## FR ที่ครอบคลุม
- เรียงลำดับและกรอง Asset ตามประเภทไฟล์หรือวันที่อัปโหลด
- กรองตาม Tag

## Query parameters (ใช้ทั้ง `/api/assets` และ `/api/collections/:id/assets`)

| param | ตัวอย่าง | ความหมาย |
|---|---|---|
| `type` | `image`, `document` | `file_type` |
| `from`, `to` | `2026-09-01` | ช่วงวันที่ของ `created_at` |
| `tag` | `logo` (ใส่ซ้ำได้) | ต้องมีทุก tag ที่ระบุ |
| `owner` | `me` | เฉพาะของฉัน |
| `status` | `ready` | `processing_status` |
| `sort` | `created_at:desc`, `display_name:asc`, `file_size:desc` | ค่าเริ่มต้น `created_at:desc` |
| `limit` | `24` | สูงสุด 100 |
| `cursor` | (opaque) | หน้าถัดไป |
| `q` | `invoice` | **Keyword search ของคนที่ 2** (รอตกลง) |

## Implementation
- เขียน query builder ตัวเดียวที่รับ filter object แล้วคืนเงื่อนไข WHERE และ ORDER BY คนที่ 2 จะได้เอาไปต่อ `q` ได้
- **Sort ต้องมาจาก allowlist เท่านั้น** ห้ามเอาค่าจาก user ไปต่อเป็น SQL ตรงๆ
- **Cursor pagination:** encode `(sortValue, asset_id)` เป็น base64 แล้วใช้ `WHERE (col, asset_id) < ($1, $2)` ตัวอย่างนี้สำหรับ desc ถ้า asc ให้กลับเครื่องหมาย
- **Index ที่ควรมี (ขอคนที่ 2):**
  - `assets (visibility, deleted_at, created_at DESC)`
  - `assets (owner_id, created_at DESC)`
  - `asset_tags (tag_id, asset_id)`

## Checklist
- [ ] ตกลงกับคนที่ 2 ว่า `q` จะอยู่ใน endpoint เดียวกันหรือแยก
- [ ] `parseAssetFilters(searchParams)` + validate (เช่นใช้ zod)
- [ ] query builder + cursor
- [ ] UI: แถบ filter (ประเภท, วันที่, tag) + dropdown เลือก sort + infinite scroll หรือปุ่ม "โหลดเพิ่ม"
- [ ] เก็บ filter ไว้ใน URL เพื่อให้แชร์ลิงก์หรือกด back ได้
