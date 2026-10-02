# infra

| ไฟล์ | สร้างโดย | เก็บอะไร |
|---|---|---|
| `vpc.ts` | **AWS Console (มือ)** | ID ของ VPC / subnet / security group / NAT instance — ไม่ใช่ความลับ commit ได้ |
| `secrets.ts` | SST | ประกาศชื่อ secret เท่านั้น ค่าจริงตั้งด้วย `sst secret set` ไม่อยู่ใน repo |
| `database.ts` | SST | RDS Postgres วางใน private subnet จาก `vpc.ts` |

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

## 4. ใส่ ID ลง `vpc.ts`

| ช่องใน `vpc.ts` | หาได้ที่ |
|---|---|
| `id` | VPC → Your VPCs → `vpc-...` |
| `privateSubnets` | VPC → Subnets → ตัวที่ชื่อมี `private` ทั้ง 2 ตัว |
| `lambdaSecurityGroup` | EC2 → Security Groups → `assethub-lambda` |
| `rdsSecurityGroup` | EC2 → Security Groups → `assethub-rds` |
| `natInstance` | EC2 → Instances → `i-...` |

ถ้ายังมีค่า `REPLACE_ME` เหลือ `sst deploy` จะหยุดและบอกว่าช่องไหนยังไม่ได้ใส่

## 5. ตั้ง secret (ครั้งเดียวต่อ stage)

```bash
npx sst secret set GoogleClientId "<ค่า>" --stage dev
npx sst secret set GoogleClientSecret "<ค่า>" --stage dev
npx sst secret set JwtSecret "<สุ่มยาวๆ>" --stage dev
```

- ค่าเก็บแบบเข้ารหัสในบัญชี AWS ไม่อยู่ในไฟล์ใน repo
- dev ในเครื่องยังใช้ `.env.local` (อยู่ใน `.gitignore` แล้ว)

## 6. เข้า RDS จากเครื่อง (รัน migration)

`sst tunnel` ใช้ไม่ได้เพราะ VPC ไม่ได้สร้างด้วย SST — ใช้ SSM port forwarding ผ่าน NAT instance แทน (ต้องติดตั้ง [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html))

```bash
aws ssm start-session --target <natInstance> --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host=<RDS endpoint>,portNumber=5432,localPortNumber=5433
```

แล้วต่อ `localhost:5433` ด้วย user/password จาก `npx sst shell --stage dev` หรือ RDS console
