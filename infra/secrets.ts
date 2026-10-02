// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

// ค่าลับตอน deploy — ไม่อยู่ใน repo; SST เก็บแบบเข้ารหัสในบัญชี AWS (แยกตาม stage)
// ตั้งค่า: npx sst secret set <ชื่อ> <ค่า> --stage dev   ดู: npx sst secret list --stage dev
// ตอน dev ในเครื่อง (next dev) ยังอ่านจาก .env.local เหมือนเดิม

export const secrets = {
  googleClientId: new sst.Secret("GoogleClientId"),
  googleClientSecret: new sst.Secret("GoogleClientSecret"),
  jwtSecret: new sst.Secret("JwtSecret"),
};
