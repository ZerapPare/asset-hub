// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { vpc } from "./vpc";

// ADR-3: db.t4g.micro ไม่ใช้ RDS Proxy (คุม connection ในโค้ดแทน)
export const db = new sst.aws.Postgres("Database", {
  // VPC มาจาก console → ส่ง subnet ID ตรงๆ
  vpc: { subnets: vpc.privateSubnets },
  version: "16", // ให้ตรงกับ docker-compose (pgvector/pgvector:pg16) — pgvector 0.8+ มีใน 16.5 ขึ้นไป
  instance: "t4g.micro",
  storage: "20 GB", // ขั้นต่ำ, autoscale ได้ คิดเงินตามที่ใช้จริง
  database: "assethub",
  // sst dev: ไม่สร้าง RDS แต่ link ไป Postgres ใน docker-compose แทน
  dev: {
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "dev",
    database: "assethub",
  },
  transform: {
    // ไม่กำหนด → RDS ใช้ default SG ของ VPC; ใช้ SG ที่สร้างใน console แทน (ข้อ A2 ใน 11-contract)
    instance: (args) => {
      args.vpcSecurityGroupIds = [vpc.rdsSecurityGroup];
    },
  },
});

// lib/db.ts อ่าน DATABASE_URL → ส่งค่านี้เป็น environment ให้ web.ts / processing.ts
// RDS Postgres 15+ บังคับ SSL (rds.force_ssl=1) จึงต้องมี sslmode=require
// รหัสผ่านที่ SST สุ่มไม่มีอักขระพิเศษ ใส่ใน URL ได้โดยไม่ต้อง encode
export const databaseUrl = $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}${$dev ? "" : "?sslmode=require"}`;
