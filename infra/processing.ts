// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { databaseUrl } from "./database";
import { vpc } from "./vpc";

// คนที่ 2: Processing — SQS + DLQ → worker Lambda (lib/processing/handler.ts) และ cron ซ่อมงานค้าง (lib/processing/maintenance.ts)
// bucket มาจาก infra/storage.ts ของคนที่ 1 จึงรับเป็นพารามิเตอร์ (sst.config.ts ส่งให้)

/** Titan ไม่มีใน ap-southeast-1 — ต้องตรงกับ BEDROCK_REGION ของแอป (lib/embeddings.ts) */
export const bedrockRegion = process.env.BEDROCK_REGION ?? "ap-south-1";

// ต้องตรงกับค่าคงที่ใน lib/embeddings.ts
const TEXT_MODEL = "amazon.titan-embed-text-v2:0";
const IMAGE_MODEL = "amazon.titan-embed-image-v1";
const TRANSLATION_PROFILE = "apac.amazon.nova-micro-v1:0";
const TRANSLATION_MODEL = "amazon.nova-micro-v1:0";

/** ส่งซ้ำได้กี่รอบก่อนไป DLQ — handler ใช้ค่านี้ตัดสินว่ารอบสุดท้าย (ตั้ง Asset เป็น FAILED) */
const MAX_RECEIVE = 3;

/**
 * สิทธิ์ bedrock:InvokeModel
 * - worker: Titan สองตัว (embed เอกสาร/รูป)
 * - web (คนที่ 1 ใช้ใน infra/web.ts): Titan สองตัว + Nova Micro (แปลคำค้นไทย) — inference profile ส่งต่อไป region อื่นใน APAC
 */
export function bedrockPermissions({ translation = false } = {}) {
  const resources: $util.Input<string>[] = [
    `arn:aws:bedrock:${bedrockRegion}::foundation-model/${TEXT_MODEL}`,
    `arn:aws:bedrock:${bedrockRegion}::foundation-model/${IMAGE_MODEL}`,
  ];
  if (translation) {
    const account = aws.getCallerIdentityOutput().accountId;
    resources.push(
      $interpolate`arn:aws:bedrock:${bedrockRegion}:${account}:inference-profile/${TRANSLATION_PROFILE}`,
      `arn:aws:bedrock:*::foundation-model/${TRANSLATION_MODEL}`,
    );
  }
  return { actions: ["bedrock:InvokeModel"], resources };
}

export function createProcessing(bucket: { name: $util.Input<string>; arn: $util.Input<string> }) {
  const dlq = new sst.aws.Queue("ProcessingDlq", {
    // เก็บไว้ดูสาเหตุ (ค่าเริ่มต้น 4 วัน)
    transform: { queue: { messageRetentionSeconds: 14 * 24 * 60 * 60 } },
  });

  const queue = new sst.aws.Queue("ProcessingQueue", {
    // ต้อง ≥ timeout ของ worker ไม่อย่างนั้นข้อความโผล่ให้ worker อีกตัวระหว่างที่ยังทำไม่เสร็จ
    visibilityTimeout: "15 minutes",
    dlq: { queue: dlq.arn, retry: MAX_RECEIVE },
  });

  // ค่าร่วมของ worker และ cron: ต่อ RDS ผ่าน private subnet, ออกเน็ต (Bedrock) ผ่าน NAT, S3 ผ่าน gateway endpoint
  const common = {
    runtime: "nodejs22.x" as const,
    timeout: "10 minutes" as const,
    // pdf.js render หน้าแรก + sharp ใช้หน่วยความจำ; memory สูง = CPU แรงขึ้นด้วย
    memory: "2048 MB" as const,
    vpc: { privateSubnets: vpc.privateSubnets, securityGroups: [vpc.lambdaSecurityGroup] },
    environment: {
      DATABASE_URL: databaseUrl,
      S3_BUCKET: bucket.name,
      BEDROCK_REGION: bedrockRegion,
      PROCESSING_MAX_RECEIVE: String(MAX_RECEIVE),
    },
    permissions: [
      // GetObject: ต้นฉบับ, PutObject: thumbnail, DeleteObject: thumbnail กำพร้าเมื่อไฟล์ถูกลบระหว่างทำงาน
      {
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [$interpolate`${bucket.arn}/assets/*`],
      },
      bedrockPermissions(),
    ],
    // native module: ให้ SST ติดตั้งตอน build แทนการ bundle — ⚠️ ต้อง build บน Linux (GitHub Actions / WSL)
    nodejs: { install: ["sharp", "@napi-rs/canvas"] },
  };

  queue.subscribe(
    { ...common, handler: "lib/processing/handler.handler" },
    {
      // ไฟล์ละข้อความ: ไฟล์หนึ่งล้มไม่ทำให้ไฟล์อื่นในชุดต้องทำใหม่
      batch: { size: 1, partialResponses: true },
      transform: {
        // จำกัด worker พร้อมกัน (ขั้นต่ำของ AWS = 2): กัน Bedrock throttle (โควตาบัญชีใหม่ต่ำ) + connection RDS (ADR-3)
        eventSourceMapping: (args) => {
          args.scalingConfig = { maximumConcurrency: 2 };
        },
      },
    },
  );

  new sst.aws.Cron("ProcessingMaintenance", {
    schedule: "rate(30 minutes)",
    function: {
      ...common,
      handler: "lib/processing/maintenance.handler",
      environment: { ...common.environment, PROCESSING_QUEUE_URL: queue.url },
      permissions: [...common.permissions, { actions: ["sqs:SendMessage"], resources: [queue.arn] }],
    },
  });

  createDlqAlarm(dlq);

  // web.ts (คนที่ 1): ส่ง PROCESSING_QUEUE_URL = queue.url + สิทธิ์ sqs:SendMessage บน queue.arn
  return { queue, dlq };
}

/**
 * แจ้งเตือนเมื่อมีข้อความตกไป DLQ (ไฟล์ประมวลผลล้มครบทุกรอบ) — ไม่มี alarm จะไม่มีใครรู้
 * ALARM_EMAIL (ตอน deploy) → ส่งอีเมลผ่าน SNS (ผู้รับต้องกดยืนยันในอีเมลจาก AWS ก่อน)
 * ไม่ตั้ง → ยังมี alarm ให้ดูใน CloudWatch console แต่ไม่ส่งแจ้งเตือน
 */
function createDlqAlarm(dlq: sst.aws.Queue) {
  const email = process.env.ALARM_EMAIL;
  const topic = email ? new aws.sns.Topic("ProcessingAlerts") : undefined;
  if (topic && email) {
    new aws.sns.TopicSubscription("ProcessingAlertsEmail", { topic: topic.arn, protocol: "email", endpoint: email });
  }

  new aws.cloudwatch.MetricAlarm("ProcessingDlqAlarm", {
    alarmDescription: "มีไฟล์ประมวลผลล้มเหลวครบทุกรอบ (ข้อความอยู่ใน ProcessingDlq) — ดูสาเหตุใน log ของ worker และ processing_workflows",
    namespace: "AWS/SQS",
    metricName: "ApproximateNumberOfMessagesVisible",
    dimensions: { QueueName: dlq.nodes.queue.name },
    statistic: "Maximum",
    period: 300,
    evaluationPeriods: 1,
    threshold: 0,
    comparisonOperator: "GreaterThanThreshold",
    // DLQ ว่าง/ไม่มีความเคลื่อนไหว CloudWatch จะไม่ส่ง metric → ถือว่าปกติ
    treatMissingData: "notBreaching",
    alarmActions: topic ? [topic.arn] : [],
    okActions: topic ? [topic.arn] : [],
  });
}
