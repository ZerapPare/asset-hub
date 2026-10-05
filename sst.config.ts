// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

// ไฟล์กลางของ SST — ใช้ร่วมกันสองคน แต่ละคนเขียน resource ของตัวเองใน infra/ แล้ว import ที่นี่
// VPC / RDS / S3 สร้างใน AWS Console (infra/vpc.ts, database.ts, storage.ts เก็บแค่ ID/endpoint/ชื่อ) — SST ไม่สร้าง/ลบให้
export default $config({
  app(input) {
    return {
      name: "asset-hub",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: { region: "ap-southeast-1" },
      },
    };
  },
  async run() {
    const { vpc } = await import("./infra/vpc"); // คนที่ 2 (console)
    await import("./infra/secrets");
    // ยังมี REPLACE_ME (ยังไม่ได้สร้าง RDS / S3) → deploy หยุดพร้อมบอกช่องที่ขาด
    const { database } = await import("./infra/database"); // คนที่ 2 (console)
    const { bucket } = await import("./infra/storage"); // คนที่ 1 (console)
    const { queue } = (await import("./infra/processing")).createProcessing(bucket);
    // TODO: web.ts (คนที่ 1) — createWeb({ bucket, queue }): env PROCESSING_QUEUE_URL = queue.url + sqs:SendMessage, bedrockPermissions({ translation: true })

    return {
      vpc: vpc.id,
      databaseHost: database.host,
      bucket: bucket.name,
      processingQueue: queue.url,
    };
  },
});
