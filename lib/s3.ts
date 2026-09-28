import { S3Client } from "@aws-sdk/client-s3";

// ใช้ได้เฉพาะฝั่ง server
// dev: S3_ENDPOINT ชี้ MinIO / AWS: ไม่ต้องตั้ง ใช้ IAM role ของ Lambda
function createClient() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.AWS_REGION ?? "ap-southeast-1",
    ...(endpoint && {
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    }),
  });
}

const globalForS3 = globalThis as unknown as { s3?: S3Client };

export const s3 = globalForS3.s3 ?? createClient();

if (process.env.NODE_ENV !== "production") globalForS3.s3 = s3;

export function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not set");
  return name;
}

export function originalKey(assetId: string, extension: string) {
  return `assets/${assetId}/original.${extension}`;
}
