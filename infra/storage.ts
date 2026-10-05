import { assertFilled } from "./assert-filled";

// S3 bucket สร้างเองใน AWS Console (คนที่ 1 — ดูขั้นตอนใน infra/README.md ขั้น 4b)
// ต้องอยู่ region ap-southeast-1 เดียวกับ Lambda: worker เข้า S3 ผ่าน gateway endpoint ของ VPC ซึ่งใช้ได้แค่ใน region เดียวกัน
// ชื่อ bucket ไม่ใช่ความลับ commit ได้

const name = "assethub-files-cskmitl"; // S3 → Buckets → ชื่อ bucket

export const bucket = {
  name,
  arn: `arn:aws:s3:::${name}`,
};

assertFilled("infra/storage.ts", bucket);
