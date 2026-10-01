# 06 — Phase 4: Tag

## FR ที่ครอบคลุม
- เพิ่ม Tag ให้ Asset
- ลบ Tag ออกจาก Asset
- Asset หนึ่งไฟล์มีได้หลาย Tag
- ค้นหาหรือกรอง Asset ตาม Tag (กรองอยู่ใน [08](08-filter-sort.md), ค้นหาเป็นของคนที่ 2)

## กฎ
- **Tag กลางเท่านั้น:** ผู้ใช้เลือกได้เฉพาะ Tag ที่มีในระบบ **สร้างเองไม่ได้**
  - รายการตั้งต้นอยู่ใน `db/migrations/0004_default_tags.sql` (25 อัน)
  - เพิ่ม Tag ภายหลัง = สร้าง migration ใหม่ (คนที่ 2 เป็นเจ้าของ schema)
  - ส่งชื่อที่ไม่มีในระบบ → 400 `UNKNOWN_TAG`
- **ใครแก้ Tag ของ Asset ได้:** เจ้าของ Asset เท่านั้น
- **ชื่อ Tag:** ตัวพิมพ์เล็ก เทียบด้วย `LOWER(BTRIM(name))`
- ไม่เกิน 20 Tag ต่อ Asset

## API
```
PATCH /api/assets/:id   { tags: string[] }   → แทนที่ Tag ทั้งชุด (ชื่อต้องมีในระบบ)
```
- รายการ Tag กลางส่งให้หน้าเว็บจาก server (`listTagNames()` ใน `lib/tags/list.ts`)

## Checklist
- [x] migration Tag กลาง (`0004_default_tags.sql`)
- [x] เลือก Tag จากรายการ (`components/upload/tag-picker.tsx`) ในหน้าต่าง Upload และหน้ารายละเอียด
- [x] API ปฏิเสธ Tag ที่ไม่มีในระบบ
- [x] หน้า Tag ดึงจาก DB จริง — จำนวนไฟล์ที่ผู้ใช้เห็นได้ แยกเอกสาร/รูปภาพ (`listTags()` ใน `lib/api/tags.ts`)
- [x] ตัวเลข Tag ใน sidebar = จำนวน Tag กลาง
