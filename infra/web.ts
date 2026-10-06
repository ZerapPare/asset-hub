// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { databaseUrl } from "./database";
import { bedrockPermissions, bedrockRegion } from "./processing";
import { secrets } from "./secrets";
import { vpc } from "./vpc";

// Next.js บน Lambda + CloudFront (หน้าเว็บและ API)
export function createWeb({ bucket, queue }: {
  bucket: { name: $util.Input<string>; arn: $util.Input<string> };
  queue: sst.aws.Queue;
}) {
  return new sst.aws.Nextjs("Web", {
    vpc: { privateSubnets: vpc.privateSubnets, securityGroups: [vpc.lambdaSecurityGroup] },
    permissions: [
      // สิทธิ์น้อยสุด: แค่ไฟล์ใน assets/*
      { actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], resources: [$interpolate`${bucket.arn}/assets/*`] },
      // ส่งงานให้ worker
      { actions: ["sqs:SendMessage"], resources: [queue.arn] },
      // semantic search + แปลคำค้นไทย
      bedrockPermissions({ translation: true }),
    ],
    environment: {
      S3_BUCKET: bucket.name,
      PROCESSING_QUEUE_URL: queue.url,
      BEDROCK_REGION: bedrockRegion,
      DATABASE_URL: databaseUrl,
      DATABASE_POOL_MAX: "1",
      JWT_SECRET: secrets.jwtSecret.value,
      GOOGLE_CLIENT_ID: secrets.googleClientId.value,
      GOOGLE_CLIENT_SECRET: secrets.googleClientSecret.value,
      NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN: "kmitl.ac.th",
      GOOGLE_REDIRECT_URI: "https://d3a1ivk0zkc6oy.cloudfront.net/api/auth/google/callback",
    },
  });
}
