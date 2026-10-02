// VPC สร้างเองใน AWS Console (ดูขั้นตอนใน infra/README.md)
// SST ใช้ sst.aws.Vpc.get() กับ VPC ที่ไม่ได้สร้างด้วย SST ไม่ได้ จึงเก็บ ID ไว้ตรงนี้แล้วส่งให้ component อื่นเอง
// ID พวกนี้ไม่ใช่ความลับ commit ได้ — ห้ามใส่ password / token ในไฟล์นี้ (ใช้ infra/secrets.ts)

export const vpc = {
  id: "vpc-0e70d197d6984989b",
  // private subnet 2 AZ (RDS subnet group ต้องมีอย่างน้อย 2 AZ) — Lambda กับ RDS อยู่ที่นี่
  privateSubnets: ["subnet-034c722204810e518", "subnet-0506f37040a404b4a"],
  // ใส่ให้ Lambda ที่อยู่ใน VPC (web, worker) — ไม่มี inbound, outbound ทั้งหมด
  lambdaSecurityGroup: "sg-03caf4e143f775a0b",
  // ใส่ให้ RDS — inbound 5432 จาก lambdaSecurityGroup และ NAT/bastion
  rdsSecurityGroup: "sg-00fd520e484f773d8",
  // NAT instance (fck-nat) ใช้เป็น bastion ผ่าน SSM ด้วย
  natInstance: "i-0ed4c5b38840e2c26",
};

const missing = Object.entries(vpc)
  .filter(([, v]) => JSON.stringify(v).includes("REPLACE_ME"))
  .map(([k]) => k);
if (missing.length) {
  throw new Error(
    `infra/vpc.ts: ยังไม่ได้ใส่ ID จาก AWS Console → ${missing.join(", ")}`,
  );
}
