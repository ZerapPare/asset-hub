// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { assertFilled } from "./assert-filled";
import { secrets } from "./secrets";

// RDS สร้างเองใน AWS Console (ดูขั้นตอนใน infra/README.md)
// db.t4g.micro, Single-AZ, private subnet, SG assethub-rds — ไม่ใช้ RDS Proxy (ADR-3)
// ค่าพวกนี้ไม่ใช่ความลับ commit ได้ — password อยู่ใน sst secret DbPassword
export const database = {
  host: "REPLACE_ME.ap-southeast-1.rds.amazonaws.com", // RDS → Databases → assethub-db → Endpoint
  port: 5432,
  name: "assethub", // Initial database name ตอนสร้าง
  username: "postgres",
};

assertFilled("infra/database.ts", database);

// lib/db.ts อ่าน DATABASE_URL → ส่งค่านี้เป็น environment ให้ web.ts / processing.ts
// - sst dev: ใช้ Postgres ใน docker-compose
// - deploy: RDS Postgres 15+ บังคับ SSL (rds.force_ssl=1) จึงต้องมี sslmode=require
export const databaseUrl = $dev
  ? "postgres://postgres:dev@localhost:5432/assethub"
  : $interpolate`postgres://${database.username}:${secrets.dbPassword.value.apply(encodeURIComponent)}@${database.host}:${database.port}/${database.name}?sslmode=require`;
