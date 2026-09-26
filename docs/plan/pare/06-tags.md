# 06 — Phase 4: Tag

## FR ที่ครอบคลุม
- เพิ่ม Tag ให้ Asset
- ลบ Tag ออกจาก Asset
- Asset หนึ่งไฟล์มีได้หลาย Tag
- ค้นหาหรือกรอง Asset ตาม Tag (กรองอยู่ใน [08](08-filter-sort.md), ค้นหาเป็นของคนที่ 2)

## กฎ
- **ใครแก้ tag ได้:** owner ของ asset เท่านั้น (ตรงกับกฎแก้ไข asset)
- **Normalize ชื่อ tag ก่อนบันทึก:** ตัดช่องว่างหัวท้าย และแปลงเป็นตัวพิมพ์เล็ก จะได้ไม่เกิด `Design` กับ `design` ซ้ำกัน
- จำกัดความยาวชื่อ tag เช่น 1–50 ตัวอักษร และจำกัดจำนวนต่อ asset เช่นไม่เกิน 20
- **Tag เป็น global:** ตาราง `tags` ใช้ร่วมกันทั้งองค์กร ชื่อเป็น UNIQUE

## API
```
GET    /api/tags?q=des             → autocomplete (เรียงตามจำนวน asset ที่ใช้)
POST   /api/assets/:id/tags        { names: string[] }
       → upsert tags (INSERT ... ON CONFLICT (name) DO NOTHING RETURNING / SELECT)
       → INSERT asset_tags ON CONFLICT DO NOTHING
DELETE /api/assets/:id/tags/:tagId
```

- tag ที่ไม่มี asset ใช้แล้วปล่อยไว้ได้ ไม่ต้องลบทันที

## Checklist
- [ ] `normalizeTag()`
- [ ] `GET /api/tags` (autocomplete)
- [ ] `POST /api/assets/:id/tags`
- [ ] `DELETE /api/assets/:id/tags/:tagId`
- [ ] UI: ช่องใส่ tag + autocomplete ในหน้า Upload และหน้ารายละเอียด
