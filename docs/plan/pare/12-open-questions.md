# 12 — คำถามที่ยังต้องตัดสินใจ

ตัดสินใจได้แล้วให้ย้ายคำตอบไปไฟล์ที่เกี่ยวข้อง แล้วลบข้อนั้นออก

| # | คำถาม | ข้อเสนอ | ต้องถามใคร | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|---|
| 1 | ใช้ API Gateway แยก หรือใช้ Next.js Route Handlers | Route Handlers | ทีม / อาจารย์ | [01](01-architecture-decisions.md) |
| 2 | visibility แบบ TEAM นิยาม "ทีม" จากอะไร จะมีตาราง Team ไหม | ถ้าไม่มีเวลา ให้ตัด TEAM ออกก่อน เหลือ ORGANIZATION / PRIVATE | ทีม | [04](04-library-download.md), [11](11-contract-with-person2.md) |
| 3 | asset แบบ TEAM ที่อยู่ใน collection: สมาชิก collection ที่ไม่ได้อยู่ในทีมจะเห็นไหม | เห็น (การเพิ่มเข้า collection ถือว่าแชร์ให้แล้ว) | ทีม | [07](07-collections.md) |
| 4 | เปลี่ยน asset เป็น PRIVATE ขณะที่อยู่ใน collection ให้ทำอย่างไร | ถอดออกจากทุก collection อัตโนมัติ โดยถามยืนยันก่อน | ทีม | [05](05-edit-delete.md) |
| 5 | FR เขียนว่า ORGANIZATION "ทุกคนเห็น ค้นหา และ**อัปโหลด**ได้" น่าจะหมายถึงดาวน์โหลด | แก้เป็น "ดาวน์โหลด" | ทีม | FR |
| 6 | ชนิดไฟล์ที่รองรับ และขนาดสูงสุด | PDF, JPG, PNG, WEBP / 20 MB | คนที่ 2 | [03](03-upload.md) |
| 7 | ใครสร้าง thumbnail | คนที่ 2 (Processing) | คนที่ 2 | [04](04-library-download.md) |
| 8 | ลบถาวรหลังกี่วัน และใครเขียน job | 30 วัน / คนที่ 1 ลบ S3 และคนที่ 2 ลบ embeddings | คนที่ 2 | [05](05-edit-delete.md) |
| 9 | Keyword search ใช้ endpoint เดียวกับ Library ไหม | ใช้ร่วมกัน (`GET /api/assets?q=`) | คนที่ 2 | [08](08-filter-sort.md) |
| 10 | ตัด Bedrock Interface Endpoint แล้วให้ออกผ่าน NAT ไหม | ตัด ถ้างบตึง | คนที่ 2 | [01](01-architecture-decisions.md) |
| 11 | ORM / query builder ตัวไหน | Drizzle | คนที่ 2 (เจ้าของ schema) | [11](11-contract-with-person2.md) |
