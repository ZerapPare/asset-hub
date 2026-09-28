import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { enqueueProcessing } from "@/lib/processing/queue";
import { bucket, originalKey, s3 } from "@/lib/s3";
import type { AssetRow, Visibility } from "@/lib/schema";
import { MAX_FILE_SIZE, VISIBILITY_OPTIONS, checkFile, nameWithoutExtension } from "@/lib/upload/rules";

const PRESIGN_SECONDS = 600;

export type UploadInput = { name: string; mimeType: string; size: number; visibility?: string };

// สร้าง asset (UPLOADING) + presigned POST ให้ browser อัปโหลดตรงเข้า S3
export async function createUpload(userId: string, input: UploadInput) {
  const name = String(input.name ?? "").trim().slice(0, 255);
  const checked = checkFile(name, String(input.mimeType ?? ""), Number(input.size));
  if (!checked.ok) throw new HttpError(400, "INVALID_FILE", checked.message);

  const visibility = (input.visibility ?? "ORGANIZATION") as Visibility;
  if (!VISIBILITY_OPTIONS.some((v) => v.value === visibility)) {
    throw new HttpError(400, "INVALID_VISIBILITY", "สิทธิ์การมองเห็นไม่ถูกต้อง");
  }

  const assetId = randomUUID();
  const key = originalKey(assetId, checked.extension);
  await sql`
    INSERT INTO assets (
      asset_id, owner_id, visibility, original_name, display_name,
      file_type, file_extension, file_size, mime_type, s3_key, processing_status
    ) VALUES (
      ${assetId}, ${userId}, ${visibility}, ${name}, ${nameWithoutExtension(name)},
      ${checked.fileType}, ${checked.extension}, ${Number(input.size)}, ${input.mimeType}, ${key}, 'UPLOADING'
    )
  `;

  const post = await createPresignedPost(s3, {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_FILE_SIZE],
      ["eq", "$Content-Type", input.mimeType!],
    ],
    Fields: { "Content-Type": input.mimeType! },
    Expires: PRESIGN_SECONDS,
  });

  return { assetId, url: post.url, fields: post.fields };
}

// เช็กไฟล์ใน S3 แล้วส่งต่อให้ Processing
export async function completeUpload(userId: string, assetId: string) {
  const [asset] = await sql<AssetRow[]>`
    SELECT * FROM assets
    WHERE asset_id = ${assetId} AND owner_id = ${userId} AND deleted_at IS NULL
  `;
  if (!asset) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
  if (asset.processing_status !== "UPLOADING") {
    throw new HttpError(409, "ALREADY_COMPLETED", "ไฟล์นี้อัปโหลดเสร็จแล้ว");
  }

  // ใช้ขนาด/ชนิดจาก S3 ไม่เชื่อค่าจาก browser
  const head = await s3
    .send(new HeadObjectCommand({ Bucket: bucket(), Key: asset.s3_key }))
    .catch(() => {
      throw new HttpError(400, "UPLOAD_MISSING", "ไม่พบไฟล์ในที่เก็บ กรุณาอัปโหลดใหม่");
    });
  const size = head.ContentLength ?? 0;
  if (size <= 0 || size > MAX_FILE_SIZE || head.ContentType !== asset.mime_type) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: asset.s3_key })).catch(() => {});
    throw new HttpError(400, "UPLOAD_INVALID", "ไฟล์ที่อัปโหลดไม่ตรงกับที่แจ้งไว้");
  }

  const updated = await sql.begin(async (tx) => {
    const [row] = await tx<AssetRow[]>`
      UPDATE assets SET file_size = ${size}, processing_status = 'PROCESSING'
      WHERE asset_id = ${assetId} AND processing_status = 'UPLOADING'
      RETURNING *
    `;
    if (!row) throw new HttpError(409, "ALREADY_COMPLETED", "ไฟล์นี้อัปโหลดเสร็จแล้ว");
    await tx`
      INSERT INTO audit_logs (user_id, asset_id, action, details)
      VALUES (${userId}, ${assetId}, 'UPLOAD', ${tx.json({ name: row.original_name, size })})
    `;
    return row;
  });

  await enqueueProcessing({
    version: 1,
    assetId,
    s3Key: updated.s3_key,
    bucket: bucket(),
    mimeType: updated.mime_type,
    fileType: updated.file_type,
    fileSize: size,
  });

  return { assetId, status: updated.processing_status };
}
