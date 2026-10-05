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
| `q` | `invoice` | คำค้น (คนที่ 2) — `mode=semantic` = ค้นด้วยความหมาย, ไม่ใส่ = keyword |

**ตกลงแล้ว (คนที่ 2):** ค้นหาอยู่ในหน้า `/assets` เดียวกับ Library (Server Component, ไม่มี endpoint แยก) — ไม่มี `q` = รายการไฟล์, มี `q` = ผลค้นหา; ทั้งสามแบบใช้ตัวกรองชุดเดียวกันจาก `assetFilters()` ใน `lib/assets/search.ts` และ `/search?q=` redirect มาที่ `/assets`

## Implementation
- เขียน query builder ตัวเดียวที่รับ filter object แล้วคืนเงื่อนไข WHERE และ ORDER BY คนที่ 2 จะได้เอาไปต่อ `q` ได้
- **Sort ต้องมาจาก allowlist เท่านั้น** ห้ามเอาค่าจาก user ไปต่อเป็น SQL ตรงๆ
- **Cursor pagination:** encode `(sortValue, asset_id)` เป็น base64 แล้วใช้ `WHERE (col, asset_id) < ($1, $2)` ตัวอย่างนี้สำหรับ desc ถ้า asc ให้กลับเครื่องหมาย
- **Index ที่ควรมี (ขอคนที่ 2) — มีแล้วใน `db/migrations/0002_indexes.sql`:**
  - `assets (visibility, deleted_at, created_at DESC)` → `idx_assets_active_created (created_at DESC) WHERE deleted_at IS NULL` (partial index; visibility มีแค่ 3 ค่าจึงไม่ใส่ในคีย์)
  - `assets (owner_id, created_at DESC)` → `idx_assets_owner (owner_id)` — ตอนนี้ข้อมูลน้อยพอ ถ้า "ของฉัน" ช้าค่อยขยายเป็น `(owner_id, created_at DESC)`
  - `asset_tags (tag_id, asset_id)` → `idx_asset_tags_tag_asset`

## Checklist
- [x] ตกลงกับคนที่ 2 ว่า `q` จะอยู่ใน endpoint เดียวกันหรือแยก → หน้า `/assets` เดียวกัน (ดูด้านบน)
- [ ] `parseAssetFilters(searchParams)` + validate (เช่นใช้ zod)
- [ ] query builder + cursor
- [ ] UI: แถบ filter (ประเภท, วันที่, tag) + dropdown เลือก sort + infinite scroll หรือปุ่ม "โหลดเพิ่ม"
- [ ] เก็บ filter ไว้ใน URL เพื่อให้แชร์ลิงก์หรือกด back ได้
