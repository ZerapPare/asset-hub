# AssetHub — แผนงาน

เอกสารวางแผนของโปรเจกต์ AssetHub เน้นส่วนของ **คนที่ 1 — Asset & Application Cloud**

## สารบัญ

| ไฟล์ | เนื้อหา |
|---|---|
| [00-overview.md](00-overview.md) | ภาพรวมโปรเจกต์ การแบ่งงานในทีม และลำดับ Phase |
| [01-architecture-decisions.md](01-architecture-decisions.md) | การตัดสินใจด้านสถาปัตยกรรม (NAT, Embedding, DB connection, API) |
| [02-auth.md](02-auth.md) | Phase 1 — Login / Logout / สถานะผู้ใช้ |
| [03-upload.md](03-upload.md) | Phase 2 — Asset Upload ด้วย Presigned URL |
| [04-library-download.md](04-library-download.md) | Phase 3 — Asset Library, รายละเอียด, Download |
| [05-edit-delete.md](05-edit-delete.md) | Phase 4 — แก้ไข / ลบ Asset ของตัวเอง |
| [06-tags.md](06-tags.md) | Phase 4 — Tag |
| [07-collections.md](07-collections.md) | Phase 4 — Collection |
| [08-filter-sort.md](08-filter-sort.md) | Phase 5 — Filter / Sort |
| [09-aws-infra.md](09-aws-infra.md) | S3, IAM, CloudFront, dev ในเครื่องด้วย MinIO |
| [10-api-reference.md](10-api-reference.md) | รายการ API ทั้งหมดของคนที่ 1 |
| [11-contract-with-person2.md](11-contract-with-person2.md) | ข้อตกลงระหว่างคนที่ 1 และคนที่ 2 |
| [12-open-questions.md](12-open-questions.md) | คำถามที่ยังต้องตัดสินใจ |

## วิธีใช้
- ติ๊ก checklist `- [x]` ในแต่ละไฟล์เมื่อทำเสร็จ
- เมื่อตัดสินใจเรื่องใน [12-open-questions.md](12-open-questions.md) ได้แล้ว ให้ย้ายคำตอบไปใส่ไฟล์ที่เกี่ยวข้อง แล้วลบข้อนั้นออก
