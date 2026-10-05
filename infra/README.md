# infra

| ไฟล์ | สร้างโดย | เก็บอะไร |
|---|---|---|
| `vpc.ts` | **AWS Console (มือ)** | ID ของ VPC / subnet / security group / NAT instance — ไม่ใช่ความลับ commit ได้ |
| `secrets.ts` | SST | ประกาศชื่อ secret เท่านั้น ค่าจริงตั้งด้วย `sst secret set` ไม่อยู่ใน repo |
| `database.ts` | **AWS Console (มือ)** | endpoint ของ RDS — password อยู่ใน secret `DbPassword` |
| `processing.ts` | SST | SQS + DLQ + worker Lambda + cron ซ่อมงานค้าง + CloudWatch alarm (ขั้น 8) |
| `assert-filled.ts` | — | หยุด deploy ถ้ายังมีช่อง `REPLACE_ME` |

`../sst.config.ts` import ทุกไฟล์ในนี้ — ไฟล์ของคนที่ 1 (`storage.ts`, `web.ts`) ยังไม่มี

## 1. สร้าง VPC ใน Console (region `ap-southeast-1`)

VPC → **Create VPC** → เลือก **VPC and more**
- Name tag auto-generation: `assethub`
- IPv4 CIDR: `10.0.0.0/16`
- Number of AZs: **2**
- Public subnets: **2**, Private subnets: **2**
- NAT gateways: **None** (ใช้ NAT instance แทน ตาม ADR-1)
- VPC endpoints: **S3 Gateway** (ฟรี)
- เปิด DNS hostnames + DNS resolution

## 2. NAT instance (fck-nat) — ใช้เป็น bastion ด้วย

EC2 → **Launch instance**
- AMI: ค้นใน AMI Catalog → Community AMIs คำว่า `fck-nat-al2023` เลือกตัว **arm64** ล่าสุด (owner `568608671756`)
- Instance type: `t4g.micro` (free plan ใช้ t4g.nano ไม่ได้ — ต้องเป็นตัวที่ free-tier eligible)
- Subnet: **public subnet** ตัวใดตัวหนึ่ง, Auto-assign public IP: **Enable**
- Security group ใหม่ `assethub-nat`: inbound **All traffic** จาก `10.0.0.0/16`
- IAM instance profile: role ที่มี `AmazonSSMManagedInstanceCore` (ไว้เข้าผ่าน Session Manager)

หลัง launch:
- เลือก instance → Actions → Networking → **Change source/destination check** → ปิด (Stop)
- VPC → Route tables → route table ของ **private subnet ทั้งสอง** → Edit routes → `0.0.0.0/0` → Target: **Instance** → NAT instance นี้

> NAT เครื่องเดียวพอ (t4g.micro ~$6/เดือน + public IPv4 ~$3.6/เดือน หักจาก credit ของ free plan) — ถ้าเครื่องล่ม Lambda ออกเน็ตไม่ได้ชั่วคราว แต่ S3 ยังใช้ได้เพราะไปทาง endpoint

## 3. Security groups

| ชื่อ | Inbound | Outbound |
|---|---|---|
| `assethub-lambda` | ไม่มี | All traffic (ค่าเริ่มต้น) |
| `assethub-rds` | PostgreSQL 5432 จาก SG `assethub-lambda` และ 5432 จาก SG `assethub-nat` (bastion) | All traffic |

## 4. RDS Postgres

**4.1 DB subnet group** (สร้างก่อน — ถ้าให้หน้า Create database สร้างให้ มันจะเอา public subnet มารวมด้วย)

RDS → Subnet groups → **Create DB subnet group**
- Name: `assethub-db-private`, VPC: `assethub-vpc`
- AZs: `ap-southeast-1a`, `ap-southeast-1b` → Subnets: **private1 + private2 เท่านั้น**

**4.2 Create database** → Full configuration (Standard create)

| ช่อง | ค่า | เหตุผล |
|---|---|---|
| Engine | PostgreSQL **16** (minor ล่าสุด, ≥ 16.5) | ตรงกับ docker; pgvector 0.8 สำหรับ `iterative_scan` (ADR-2) |
| Template | **Free tier** | ล็อก Single-AZ + instance เล็ก |
| Availability | **Single-AZ DB instance** | Multi-AZ ไม่ฟรี |
| DB instance identifier | `assethub-db` | |
| Master username | `postgres` | ตรงกับ `database.ts` |
| Credentials management | **Self managed** + ตั้ง password เอง | แบบ Secrets Manager เสีย $0.40/เดือน และ rotate เองจน `DATABASE_URL` ใช้ไม่ได้ |
| Instance class | `db.t4g.micro` | free tier, ADR-3 |
| Storage | gp3 **20 GB**, **ปิด** storage autoscaling | กันค่าใช้จ่ายงอก |
| Compute resource | Don't connect to an EC2 compute resource | |
| VPC / DB subnet group | `assethub-vpc` / `assethub-db-private` | |
| Public access | **No** | อยู่ใน private subnet เท่านั้น |
| VPC security group | Choose existing → **`assethub-rds`** (เอา `default` ออก) | |
| Database authentication | Password authentication | |
| Monitoring | ปิด Enhanced monitoring | คิดเงิน CloudWatch |
| **Initial database name** (Additional configuration) | `assethub` | **ห้ามลืม** — ไม่ใส่ = ไม่มี database นี้ |
| Backup retention | 1–7 วัน | |
| Encryption | เปิด (ค่าเริ่มต้น) | ฟรี |
| Deletion protection | เปิด | กันเผลอลบ (ปิดก่อนจะลบจริง) |

**4.3 หลังสร้างเสร็จ** (~10 นาที)
- copy **Endpoint** (RDS → Databases → `assethub-db` → Connectivity) ใส่ `host` ใน `database.ts`
- `npx sst secret set DbPassword "<password ที่ตั้ง>" --stage dev`
- รัน `db/migrations/*.sql` ตามลำดับ ผ่านขั้น 7 (`0001` สร้าง extension `vector`, `pg_trgm` ให้เอง)

> ~$14/เดือน (instance + 20 GB) หักจาก credit — **Stop ได้แค่ 7 วัน** แล้ว AWS เปิดให้เองอัตโนมัติ

## 5. ใส่ ID ลง `vpc.ts`

| ช่องใน `vpc.ts` | หาได้ที่ |
|---|---|
| `id` | VPC → Your VPCs → `vpc-...` |
| `privateSubnets` | VPC → Subnets → ตัวที่ชื่อมี `private` ทั้ง 2 ตัว |
| `lambdaSecurityGroup` | EC2 → Security Groups → `assethub-lambda` |
| `rdsSecurityGroup` | EC2 → Security Groups → `assethub-rds` |
| `natInstance` | EC2 → Instances → `i-...` |

ถ้ายังมีค่า `REPLACE_ME` เหลือ `sst deploy` จะหยุดและบอกว่าช่องไหนยังไม่ได้ใส่

## 6. ตั้ง secret (ครั้งเดียวต่อ stage)

```bash
npx sst secret set GoogleClientId "<ค่า>" --stage dev
npx sst secret set GoogleClientSecret "<ค่า>" --stage dev
npx sst secret set JwtSecret "<สุ่มยาวๆ>" --stage dev
npx sst secret set DbPassword "<master password ของ RDS>" --stage dev
```

- ค่าเก็บแบบเข้ารหัสในบัญชี AWS ไม่อยู่ในไฟล์ใน repo
- dev ในเครื่องยังใช้ `.env.local` (อยู่ใน `.gitignore` แล้ว)

## 7. เข้า RDS จากเครื่อง (รัน migration)

`sst tunnel` ใช้ไม่ได้เพราะ VPC ไม่ได้สร้างด้วย SST — ใช้ SSM port forwarding ผ่าน NAT instance แทน (ต้องติดตั้ง [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html))

```bash
aws ssm start-session --target <natInstance> --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host=<RDS endpoint>,portNumber=5432,localPortNumber=5433
```

แล้วต่อ `postgres://postgres:<password>@localhost:5433/assethub?sslmode=require` เช่น

```bash
psql "postgres://postgres:<password>@localhost:5433/assethub?sslmode=require" -f db/migrations/0001_schema.sql
```

## 8. Processing (`processing.ts`, สร้างด้วย SST)

```
upload /complete ──▶ SQS ProcessingQueue ──▶ worker Lambda (lib/processing/handler.ts)
                       │  ล้มครบ 3 รอบ           └─ ดึงข้อความ/thumbnail → READY → embedding (Bedrock)
                       ▼
                  ProcessingDlq ──▶ CloudWatch alarm ──▶ อีเมล (ถ้าตั้ง ALARM_EMAIL)

cron ทุก 30 นาที (lib/processing/maintenance.ts)
  ├─ ค้าง PROCESSING > 20 นาที → ส่งเข้าคิวใหม่ (ลองครบ 6 รอบ = FAILED)
  └─ READY แต่ embedding ไม่ครบ → ทำใหม่ (ไม่เกิน 20 ไฟล์/รอบ, เลิกเมื่อครบ 5 ครั้ง)
```

| ค่า | ตั้งไว้ | เหตุผล |
|---|---|---|
| worker timeout / memory | 10 นาที / 2 GB | PDF ยาว + โควตา Bedrock บัญชีใหม่ต่ำ (~1.5 chunk/วินาที) |
| SQS visibility timeout | 15 นาที | ต้อง ≥ timeout ของ worker ไม่อย่างนั้นข้อความถูกส่งซ้ำระหว่างทำ |
| batch size | 1 | ไฟล์หนึ่งล้มไม่ทำให้ไฟล์อื่นต้องทำใหม่ |
| `maximumConcurrency` | 2 (ขั้นต่ำของ AWS) | กัน Bedrock throttle + connection RDS (ADR-3) |
| DLQ | ส่ง 3 รอบแล้วย้าย, เก็บ 14 วัน | รอบสุดท้าย worker ตั้งไฟล์เป็น FAILED |
| Lambda อยู่ใน VPC | private subnet + `assethub-lambda` | ต่อ RDS ได้, ออก Bedrock ผ่าน NAT, S3 ผ่าน gateway endpoint |

**แจ้งเตือนทางอีเมล:** ตั้ง `ALARM_EMAIL` ตอน deploy (เช่นในไฟล์ `.env` ที่ SST อ่าน) แล้ว**กดยืนยันในอีเมลจาก AWS** ที่ส่งมาหลัง deploy ครั้งแรก — ไม่ตั้ง = มี alarm ใน CloudWatch console แต่ไม่ส่งอีเมล

**ผูกกับไฟล์ของคนที่ 1** (`sst.config.ts` มีบรรทัด comment รอไว้):
- `storage.ts` export `bucket` → `createProcessing({ name: bucket.name, arn: bucket.arn })`
- `web.ts`: env `PROCESSING_QUEUE_URL = queue.url` + `sqs:SendMessage` บน `queue.arn` + `bedrockPermissions({ translation: true })` + VPC เดียวกัน

## 9. ก่อน deploy ครั้งแรก
- [x] ตั้ง AWS Budgets (Billing → Budgets) เตือนที่ 50% / 80% ของ credit
- [ ] สร้าง RDS (ขั้น 4) + รัน migration `0001`–`0006` (ขั้น 7)
- [ ] ตั้ง secret ครบ 4 ตัว (ขั้น 6)
- [ ] build บน **Linux** (GitHub Actions / WSL) — `sharp`, `@napi-rs/canvas` เป็น native module ถ้า build บน Windows จะได้ binary ผิดแพลตฟอร์ม
- [ ] `npx sst deploy --stage dev` แล้วทดสอบ: อัปโหลด → READY → ค้นแบบ Semantic → ลองไฟล์เสียแล้วดูว่าไป DLQ + alarm ทำงาน
