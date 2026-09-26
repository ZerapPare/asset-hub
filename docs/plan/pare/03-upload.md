# 03 — Phase 2: Asset Upload

## FR ที่ครอบคลุม
- อัปโหลดเอกสารและรูปภาพประเภทที่รองรับ
- กำหนดขนาดไฟล์สูงสุด
- อัปโหลดหลายไฟล์พร้อมกัน
- บันทึก Metadata (ชื่อ, ประเภท, ขนาด, ผู้อัปโหลด, วันที่)
- เลือก visibility (ORGANIZATION / TEAM / PRIVATE) ตอนอัปโหลด
- เลือก Collection และ Tag ระหว่างอัปโหลด (ใช้ endpoint จาก [06](06-tags.md) และ [07](07-collections.md) หลัง complete)

## Flow
```
1. POST /api/assets/upload-url
   body: { originalName, mimeType, size, visibility }
   → requireUser()
   → เช็ก mimeType อยู่ใน allowlist และ size <= MAX_FILE_SIZE
   → INSERT assets (owner_id, original_name, display_name = originalName,
                    visibility, processing_status = 'UPLOADING')
   → s3_key = assets/{assetId}/original.{ext}
   → สร้าง presigned POST (หมดอายุ 5–10 นาที)
   ← { assetId, url, fields }

2. Browser อัปโหลดไฟล์ตรงเข้า S3 ด้วย multipart/form-data (ไม่ผ่าน Lambda)

3. POST /api/assets/:id/complete
   → requireUser() และต้องเป็น owner
   → เช็กว่า status ยังเป็น UPLOADING
   → HeadObject(s3_key): เช็กว่าไฟล์อยู่จริง ขนาดไม่เกิน limit และ ContentType ตรงกับที่แจ้ง
   → UPDATE file_size, mime_type, file_type, file_extension (ใช้ค่าจาก HeadObject)
   → UPDATE processing_status = 'PROCESSING'
   → ส่งข้อความเข้า SQS ให้คนที่ 2 (ดู 11-contract)
   → INSERT audit_logs (UPLOAD)
   ← asset
```

## เหตุผลของแต่ละการตัดสินใจ
- **ใช้ presigned POST แทน PUT:** presigned PUT จำกัดขนาดไฟล์ไม่ได้ ส่วน presigned POST ใส่ policy `content-length-range` ได้
  ```ts
  createPresignedPost(s3, {
    Bucket, Key,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_SIZE],
      ["eq", "$Content-Type", mimeType],
    ],
    Fields: { "Content-Type": mimeType },
    Expires: 600,
  });
  ```
- **ห้ามใช้ชื่อไฟล์ของผู้ใช้เป็น key:** ป้องกัน path traversal, ชื่อซ้ำ และอักขระแปลกๆ ให้เก็บชื่อจริงไว้ใน `original_name` แทน
- **ใช้ค่าจาก HeadObject ไม่ใช้ค่าจาก client:** Dashboard ของคนที่ 2 นับจาก metadata นี้ จึงต้องถูกต้อง
- **ไฟล์ที่ค้างสถานะ UPLOADING:** ถ้าผู้ใช้ปิดหน้าไปกลางคัน asset จะค้างสถานะนี้ ให้ทำ job ลบแถวที่ UPLOADING นานเกิน 1 ชม. หรือไม่แสดงสถานะนี้ใน Library เลยก็พอ

## ชนิดไฟล์ที่รองรับ (ร่าง รอตกลงกับคนที่ 2 เพราะเขาต้องประมวลผลได้)

| file_type | mime_type | นามสกุล |
|---|---|---|
| DOCUMENT | `application/pdf` | pdf |
| IMAGE | `image/jpeg`, `image/png`, `image/webp` | jpg, jpeg, png, webp |

- `MAX_FILE_SIZE` เสนอเริ่มที่ 20 MB ตั้งเป็น config

## อัปโหลดหลายไฟล์
- ฝั่ง frontend ขอ upload-url ทีละไฟล์ แล้วอัปโหลดพร้อมกัน จำกัดทีละ 3–4 ไฟล์
- แสดง progress แยกรายไฟล์ ไฟล์ไหนล้มเหลวก็ไม่กระทบไฟล์อื่น
- backend ไม่ต้องทำอะไรเพิ่ม

## Checklist
- [ ] S3 client (`lib/s3.ts`) รองรับทั้ง MinIO และ AWS
- [ ] allowlist ของ mime type + `MAX_FILE_SIZE` ใน config
- [ ] `POST /api/assets/upload-url`
- [ ] `POST /api/assets/:id/complete` + HeadObject
- [ ] ส่งข้อความเข้า SQS (หรือ stub ไว้ก่อนระหว่างรอคนที่ 2)
- [ ] บันทึก audit log `UPLOAD`
- [ ] หน้า Upload: เลือกไฟล์หลายไฟล์, visibility, tag, collection, progress
- [ ] ทดสอบ: ไฟล์เกินขนาดต้องถูก S3 ปฏิเสธ, mime ผิดต้องถูกปฏิเสธ, คนอื่นเรียก complete ไม่ได้
