# 05 — Phase 4: แก้ไข / ลบ Asset ของตัวเอง

## FR ที่ครอบคลุม
- แก้ไขชื่อและรายละเอียดของ Asset ที่ตนอัปโหลด
- แก้ไข visibility ได้
- แก้ไขและลบได้เฉพาะ Asset ที่ตนอัปโหลด

## แก้ไข
```
PATCH /api/assets/:id
body: { displayName?, description?, visibility? }
→ requireUser() และ owner_id == user.id (ถ้าไม่ใช่ ตอบ 404 ไม่ใช่ 403 เพื่อไม่เผยว่ามี asset นี้อยู่)
→ validate: displayName ไม่ว่าง และจำกัดความยาว
→ UPDATE ... , updated_at = now()
→ INSERT audit_logs (UPDATE)
```

**กรณีเปลี่ยน visibility เป็น PRIVATE**
- FR กำหนดว่า PRIVATE เข้า Collection ไม่ได้
- เสนอให้ถอด asset ออกจากทุก collection อัตโนมัติ โดยถามยืนยันจากผู้ใช้ก่อน
- อีกทางคือปฏิเสธการเปลี่ยนจนกว่าผู้ใช้จะเอาออกจาก collection เอง (รอตัดสินใจ ดู [12](12-open-questions.md))

## ลบ (Soft delete)
```
DELETE /api/assets/:id
→ owner เท่านั้น
→ UPDATE deleted_at = now()
→ INSERT audit_logs (DELETE)
```
- asset จะหายจาก Library, Collection และ Search ทันที เพราะทุก query กรอง `deleted_at IS NULL`
- **ลบไฟล์ใน S3 จริง:** ใช้ job ตามเวลา (EventBridge Scheduler → Lambda) ลบ asset ที่ `deleted_at` เกิน 7 วัน
  - ลบ S3 object ทั้งต้นฉบับและ thumbnail **ก่อน**
  - แล้ว `DELETE FROM assets` — chunks, embeddings, tags, collection links ถูกลบตามด้วย `ON DELETE CASCADE`
  - `audit_logs` ยังอยู่ (`asset_id` เป็น NULL) จึงต้องเก็บชื่อไฟล์ไว้ใน `details` ตอนเขียน log
- เรื่องนี้ตอบข้อสังเกตใน FR ว่า "ลบเลยหรือเก็บไว้ก่อนแล้วตั้งเวลาลบ" → **เก็บไว้ก่อน แล้วตั้งเวลาลบ**

## Checklist
- [x] `PATCH /api/assets/:id`
- [x] `DELETE /api/assets/:id` (soft)
- [x] จัดการกรณีเปลี่ยนเป็น PRIVATE ขณะอยู่ใน collection (409)
- [x] audit log `UPDATE` / `DELETE`
- [x] UI: ฟอร์มแก้ไข และกล่องยืนยันการลบ (หน้ารายละเอียด)
- [ ] (ภายหลัง) job ลบถาวรหลัง 7 วัน
- [x] ทดสอบ: คนที่ไม่ใช่ owner แก้ไขหรือลบไม่ได้ (404)
