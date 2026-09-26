# 00 — ภาพรวม

## โปรเจกต์
**AssetHub** — ระบบจัดเก็บและค้นหา Digital Assets (PDF, รูปภาพ) ขององค์กรบน AWS พร้อม Semantic Search

- **Frontend:** React + Next.js + TypeScript
- **Backend:** Node.js + TypeScript บน AWS Lambda
- **Database:** Amazon RDS PostgreSQL + pgvector
- **File Storage:** Amazon S3
- **AI:** Amazon Bedrock (Titan Text Embeddings V2, Titan Multimodal Embeddings)
- **Deploy:** SST + GitHub Actions

## การแบ่งงาน

### คนที่ 1 — Asset & Application Cloud (ส่วนของเรา)
- Login / Logout
- ตรวจสอบสถานะผู้ใช้พื้นฐาน
- Asset Upload
- Asset Library
- ดูรายละเอียด Asset
- Download
- แก้ไข / ลบ Asset ของตัวเอง
- Tag
- Collection
- Filter / Sort เบื้องต้น

**AWS:** S3, Lambda, API Gateway, CloudFront, IAM, S3 Presigned URL

### คนที่ 2 — Search & Data Cloud
- Database schema, เชื่อม RDS
- Keyword Search
- pgvector, Document / Image Semantic Search
- Asset Processing, Processing Status
- Dashboard

**AWS:** RDS PostgreSQL, pgvector, Lambda, Bedrock, VPC, Security Group, VPC Endpoint, CloudWatch

> จุดที่งานสองคนเชื่อมกันดูได้ที่ [11-contract-with-person2.md](11-contract-with-person2.md)

## ลำดับ Phase ของคนที่ 1

| Phase | งาน | ไฟล์ | ต้องรอ |
|---|---|---|---|
| 0 | ตกลงเรื่องต่างๆ กับคนที่ 2, ตั้ง DB client + S3 client สำหรับ dev ในเครื่อง | [11](11-contract-with-person2.md), [09](09-aws-infra.md) | — |
| 1 | Auth | [02](02-auth.md) | ตาราง `users` |
| 2 | Upload | [03](03-upload.md) | ตาราง `assets`, S3 bucket |
| 3 | Library / Detail / Download | [04](04-library-download.md) | Phase 2 |
| 4 | Edit / Delete, Tag, Collection | [05](05-edit-delete.md), [06](06-tags.md), [07](07-collections.md) | Phase 3 |
| 5 | Filter / Sort | [08](08-filter-sort.md) | Phase 3, ตกลงเรื่อง Keyword Search |

## สภาพ repo ตอนเริ่ม
- Next.js 16 + React 19 + Tailwind 4 (โปรเจกต์เปล่า)
- `docker-compose.yml`: Postgres 16 + pgvector (`localhost:5432`, DB `assethub`) และ MinIO จำลอง S3 (`localhost:9000`, console `9001`)
