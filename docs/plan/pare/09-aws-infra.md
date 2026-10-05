# 09 — AWS Infra (ส่วนของคนที่ 1)

## S3
- bucket เดียว แบ่ง prefix เป็น:
  - `assets/{assetId}/original.{ext}`
  - `assets/{assetId}/thumbnail.webp`
- **Block Public Access:** เปิดทั้งหมด ทุกการเข้าถึงต้องผ่าน presigned URL
- **Encryption:** SSE-S3 (ค่าเริ่มต้น)
- **CORS:**
  ```json
  [{
    "AllowedOrigins": ["https://<cloudfront-domain>", "http://localhost:3000"],
    "AllowedMethods": ["GET", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
  ```
- **Lifecycle:** ลบ multipart upload ที่ค้างนานเกิน 1 วัน

## IAM (least privilege)

| Lambda | สิทธิ์ |
|---|---|
| Web/API | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` บน `arn:aws:s3:::<bucket>/assets/*`, `sqs:SendMessage` บน processing queue, `bedrock:InvokeModel` (Titan ×2 + Nova Micro: `bedrockPermissions({ translation: true })` จาก `infra/processing.ts`) |
| Processing worker (คนที่ 2) | `s3:GetObject` / `s3:PutObject` / `s3:DeleteObject` (thumbnail) บน `assets/*`, `bedrock:InvokeModel` Titan ×2 |
| Maintenance cron (คนที่ 2) | เหมือน worker + `sqs:SendMessage` บน processing queue |
| Cleanup job | `s3:DeleteObject` บน `assets/*` |

- ถ้าใช้ SST `link: [bucket, queue]` ระบบจะสร้าง IAM policy ให้เอง
- processing ของคนที่ 2 เขียน `permissions` เอง (จำกัดแค่ `assets/*`) — ดู `infra/processing.ts`

## CloudFront
- serve frontend: SST `Nextjs` component จะสร้าง CloudFront + S3 (static) + Lambda (server) ให้
- ใช้ HTTPS ด้วยใบรับรองจาก ACM (ถ้ามีโดเมน)

## API Gateway
- ขึ้นกับ ADR-4 ใน [01](01-architecture-decisions.md)

## โครงไฟล์ SST (แบ่งกับคนที่ 2 ไม่ให้ชนกัน)
```
sst.config.ts          ← import ทุกไฟล์ใน infra/ (ใช้ร่วมกัน)
infra/
  storage.ts           ← คนที่ 1: ชื่อ bucket ที่สร้างใน console (CORS + lifecycle ตั้งใน console — infra/README.md ขั้น 4b) ✅ โครงพร้อม รอใส่ชื่อ
  web.ts               ← คนที่ 1: Nextjs / API + link + secrets
  vpc.ts               ← คนที่ 2: ID ของ VPC/subnet/SG/NAT ที่สร้างใน console ✅
  database.ts          ← คนที่ 2: endpoint ของ RDS ที่สร้างใน console (รอสร้าง RDS)
  secrets.ts           ← ชื่อ secret (Google, JWT, DbPassword) — ค่าจริงตั้งด้วย sst secret set ✅
  processing.ts        ← คนที่ 2: SQS + DLQ + worker Lambda + cron + alarm ✅ (createProcessing(bucket))
```
- VPC / RDS / S3 สร้างใน console (ขั้นตอนใน [infra/README.md](../../../infra/README.md)) — SST แค่อ่าน ID ไม่สร้าง/ไม่ลบ

## Dev ในเครื่อง (MinIO)
- `docker compose up -d` → Postgres `localhost:5432` และ MinIO `localhost:9000` (console `9001`, user `dev` / `devdevdev`)
- สร้าง bucket ใน MinIO console หรือเขียน script ด้วย `mc`
- `lib/s3.ts`:
  ```ts
  new S3Client({
    region: process.env.AWS_REGION ?? "ap-southeast-1",
    ...(process.env.S3_ENDPOINT && {
      endpoint: process.env.S3_ENDPOINT,   // http://localhost:9000
      forcePathStyle: true,
      credentials: { accessKeyId: "dev", secretAccessKey: "devdevdev" },
    }),
  });
  ```
- presigned URL ที่สร้างตอน dev จะชี้ไป `localhost:9000` ซึ่ง browser เปิดได้
- ต้องตั้ง CORS ของ MinIO ด้วย

### `.env.local` (ตัวอย่าง ห้าม commit)
```
DATABASE_URL=postgres://postgres:dev@localhost:5432/assethub
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=assethub-dev
AWS_REGION=ap-southeast-1
MAX_FILE_SIZE=20971520
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
ALLOWED_EMAIL_DOMAIN=
JWT_SECRET=
```

## Checklist
- [x] `lib/s3.ts` + `.env.example`
- [ ] script สร้าง bucket + CORS ใน MinIO
- [ ] สร้าง bucket ใน console + ใส่ชื่อใน `infra/storage.ts` (infra/README.md ขั้น 4b)
- [ ] `infra/web.ts` + secrets
- [ ] ตรวจ IAM policy ที่ SST สร้างให้ว่าจำกัดเฉพาะ `assets/*`
