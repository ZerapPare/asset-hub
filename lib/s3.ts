import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

const GET_EXPIRES_SECONDS = 300;

// header ชื่อไฟล์ รองรับภาษาไทย (filename* = UTF-8) + ชื่อสำรองแบบ ASCII
function contentDisposition(type: "attachment" | "inline", filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// URL ชั่วคราวให้ browser ดึงไฟล์ตรงจาก S3
export function presignGet(key: string, opts: { filename: string; inline?: boolean; contentType?: string }) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: contentDisposition(opts.inline ? "inline" : "attachment", opts.filename),
      ...(opts.contentType && { ResponseContentType: opts.contentType }),
    }),
    { expiresIn: GET_EXPIRES_SECONDS },
  );
}
