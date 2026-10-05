# 01 — การตัดสินใจด้านสถาปัตยกรรม

ปัญหาที่เจอจาก proposal และแนวทางแก้ที่เลือก

---

## ADR-1: Lambda ใน Private Subnet ออกอินเทอร์เน็ตไม่ได้ → ใช้ NAT instance

**ปัญหา**
- ใน proposal Lambda อยู่ใน private subnet ที่ไม่มี NAT และเรียกบริการได้ผ่าน VPC Endpoint เท่านั้น
- Google OAuth ต้องเรียก `oauth2.googleapis.com` และดึง JWKS ของ Google ซึ่งอยู่นอก AWS จึงไม่มี VPC Endpoint ให้ใช้

**ทางเลือก**

| ทางเลือก | ค่าใช้จ่าย/เดือน | ข้อเสีย |
|---|---:|---|
| NAT Gateway | ~$32 | เกินงบ |
| แยก auth Lambda ไว้นอก VPC | ~$0 | auth ต้องเขียน DB จึงต้องมี Lambda ใน VPC อีกตัวรับต่อ ซับซ้อนขึ้น |
| **NAT instance (EC2 `t4g.nano`, เช่น fck-nat)** | **~$3–4** | ไม่มี high availability ถ้าเครื่องล่ม Lambda จะออกเน็ตไม่ได้ชั่วคราว |

**เลือก:** NAT instance

**ที่ทำจริง (ต.ค. 2026)** — สร้างเองใน AWS Console ตามขั้นตอนใน [infra/README.md](../../../infra/README.md) และเก็บ ID ไว้ใน `infra/vpc.ts`
- fck-nat **`t4g.micro` เครื่องเดียว** (บัญชี free plan ใช้ `t4g.nano` ไม่ได้) อยู่ใน public subnet และเป็น bastion ผ่าน SSM ด้วย
- VPC 2 AZ (RDS บังคับ) — route `0.0.0.0/0` ของ private subnet ทั้งสองชี้ไป NAT ตัวเดียวกัน
- Security group: `assethub-lambda` (ไม่มี inbound), `assethub-rds` (5432 จาก lambda + nat), `assethub-nat` (จากใน VPC)
- ไม่ใช้ `sst.aws.Vpc`: จะสร้าง NAT 1 เครื่องต่อ AZ (2 เครื่อง) และ `Vpc.get()` ใช้กับ VPC ที่ไม่ได้สร้างด้วย SST ไม่ได้

**ผลที่ตามมา**
- ใช้เครื่องเดียวเป็นทั้ง NAT และ Bastion
- **ตัด Bedrock Interface Endpoint แล้ว** (ประหยัด ~$7–8): Titan ไม่มีใน ap-southeast-1 ต้องเรียกข้าม region (Mumbai) ซึ่ง endpoint ในสิงคโปร์ใช้ไม่ได้อยู่แล้ว → Lambda เรียก Bedrock ผ่าน NAT — ต้องแก้ข้อความใน proposal เรื่อง "ข้อมูลไม่ออกสู่อินเทอร์เน็ตสาธารณะ"
- S3 Gateway Endpoint ยังเก็บไว้เหมือนเดิม (ฟรี)
- **เจ้าของเรื่องนี้:** คนที่ 2 (VPC) แต่คนที่ 1 เป็นฝ่ายที่ต้องการ

---

## ADR-2: Embedding ข้อความกับรูปอยู่คนละ vector space → แยกตาราง

**ปัญหา**
- Titan Text V2 กับ Titan Multimodal ให้เวกเตอร์ที่เอามาเทียบกันตรงๆ ไม่ได้
- ใช้ Multimodal ตัวเดียวกับทุกอย่างก็ไม่ได้ เพราะรับข้อความได้แค่ 128 tokens สั้นเกินไปสำหรับ chunk ของเอกสาร

**เลือก:** แยกเป็น `document_chunk_embeddings` กับ `image_embeddings` ใช้ `VECTOR(1024)` ทั้งคู่ แต่ละตารางมี HNSW index ของตัวเอง

**ตอนค้นหา**
1. embed คำค้นสองครั้ง: ครั้งแรกด้วย Text V2 เพื่อค้นเอกสาร อีกครั้งด้วย Multimodal เพื่อค้นรูป
2. แสดงผลแยกเป็นส่วนเอกสารกับส่วนรูป ถ้าจะรวมเป็นรายการเดียวให้ใช้ Reciprocal Rank Fusion
3. JOIN `assets` แล้วกรองสิทธิ์, `READY` และ `deleted_at IS NULL` ทุกครั้ง พร้อมเปิด `hnsw.iterative_scan = relaxed_order` (pgvector 0.8+)

**ที่ทำจริง (ต.ค. 2026)** — รายละเอียดใน [13-semantic-search.md](13-semantic-search.md)
- Titan ทั้งสองตัว**ไม่มีใน ap-southeast-1** → เรียก Bedrock ที่ `BEDROCK_REGION` (ค่าเริ่มต้น `ap-south-1` Mumbai) ส่วนระบบอื่นอยู่สิงคโปร์
- Titan Multimodal รับข้อความ**ภาษาอังกฤษเท่านั้น** → คำค้นไทยฝั่งรูปแปลเป็นอังกฤษด้วย **Amazon Nova Micro** (`apac.amazon.nova-micro-v1:0`) ก่อน — แปลไม่ได้ = ข้ามฝั่งรูป (ฝั่งเอกสารค้นได้ปกติ)
  - เดิมจะใช้ Amazon Translate แต่บัญชี free plan ติด `SubscriptionRequiredException`
- **ไม่ใช้ Cohere** (Embed v4 / Multilingual v3) แม้รองรับไทยและรูปในโมเดลเดียว: คิดเงินผ่าน AWS Marketplace ซึ่ง free plan ไม่รวม และ credit ไม่ครอบคลุม
- รวมผลสองฝั่งเป็นรายการเดียวด้วย RRF + ตัดผลด้วยเพดานระยะ/margin จากผลที่ใกล้สุด, cache embedding คำค้นในตาราง `query_embeddings`, ล้ม/ช้า → แสดงผล Keyword แทน
- embedding ทำหลังไฟล์ READY (ผู้ใช้เปิดไฟล์ได้ทันที) ล้มเหลว → cron ทำใหม่ทุก 30 นาที

**เจ้าของ:** คนที่ 2

---

## ADR-3: Lambda เปิด connection ไป RDS จนเต็ม → คุมในโค้ด ไม่ใช้ RDS Proxy

**ปัญหา**
- `db.t4g.micro` รับได้ราว 80 connections
- RDS Proxy คิดขั้นต่ำเท่ากับ 2 vCPU คือราว $22/เดือน แพงเท่าตัว DB

**เลือก**
1. หนึ่ง Lambda instance ใช้หนึ่ง connection (`max: 1`) สร้างไว้นอก handler และตั้ง `idle_timeout`
2. จำกัด `reservedConcurrency` ของ Lambda ที่ต่อ DB เช่น web ~40, worker ~10
3. งาน processing ผ่าน SQS โดยตั้ง `maximumConcurrency` เช่น 5

```ts
import postgres from "postgres";
export const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});
```

---

## ADR-4: API Gateway แยก หรือ Next.js Route Handlers → (รอตัดสินใจ)

- ใบแบ่งงานระบุ API Gateway + Lambda
- proposal (SST + Next.js) deploy ผ่าน CloudFront → Lambda Function URL ซึ่งไม่ได้ใช้ API Gateway

**แนะนำ:** เขียน API เป็น Route Handlers ใน Next.js (`app/api/...`) ได้ repo เดียว ใช้ type ร่วมกันได้ และ deploy ครั้งเดียว

**ถ้าต้องมี API Gateway:** แยก backend ไปใช้ `sst.aws.ApiGatewayV2` โดยเขียน business logic ใน `lib/` ที่ไม่ผูกกับ framework ไว้ตั้งแต่แรก จะย้ายได้ง่าย

> สถานะ: รอตัดสินใจ ดู [12-open-questions.md](12-open-questions.md)

---

## ผลต่อค่าใช้จ่ายรายเดือน

| รายการ | เดิม | ใหม่ |
|---|---:|---:|
| RDS + storage | ~$14 | ~$16–22 (ราคา Singapore) |
| Bedrock Interface Endpoint | ~$7–8 | $0 (ตัดแล้ว) |
| NAT instance | – | ~$7.7 (`t4g.micro`) + public IPv4 ~$3.6 |
| Bastion | เปิดเมื่อใช้ | รวมอยู่ใน NAT |
| Bedrock (embedding + แปลคำค้น) | – | < $1 |
| **รวม** | **~$22** | **~$28–34** (หัก credit ของ free plan; Stop NAT / สร้าง RDS ตอนใกล้ใช้ช่วยประหยัด) |
