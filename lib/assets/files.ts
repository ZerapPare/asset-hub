import { visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { presignGet } from "@/lib/s3";
import { isUuid } from "@/lib/validate";

type FileRow = {
  asset_id: string;
  display_name: string;
  file_extension: string;
  mime_type: string;
  s3_key: string;
  thumbnail_key: string | null;
};

// ไฟล์ที่ user มีสิทธิ์ดู (ไม่พบ / ไม่มีสิทธิ์ = 404 เหมือนกัน)
async function findViewableFile(userId: string, assetId: string) {
  if (!isUuid(assetId)) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
  const [row] = await sql<FileRow[]>`
    SELECT a.asset_id, a.display_name, a.file_extension, a.mime_type, a.s3_key, a.thumbnail_key
    FROM assets a
    WHERE a.asset_id = ${assetId}
      AND a.processing_status <> 'UPLOADING'
      AND ${visibleAssetsWhere(userId)}
  `;
  if (!row) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
  return row;
}

// ชื่อไฟล์ตอนดาวน์โหลด = ชื่อที่ตั้ง + นามสกุลจริง
function downloadName(row: FileRow) {
  const ext = `.${row.file_extension}`;
  return row.display_name.toLowerCase().endsWith(ext) ? row.display_name : row.display_name + ext;
}

export async function getDownloadUrl(userId: string, assetId: string) {
  const row = await findViewableFile(userId, assetId);
  const url = await presignGet(row.s3_key, { filename: downloadName(row), contentType: row.mime_type });
  await sql`
    INSERT INTO audit_logs (user_id, asset_id, action, details)
    VALUES (${userId}, ${row.asset_id}, 'DOWNLOAD', ${sql.json({ name: downloadName(row) })})
  `;
  return url;
}

// ใช้ thumbnail ถ้ามี ไม่งั้นไฟล์ต้นฉบับ
export async function getPreviewUrl(userId: string, assetId: string) {
  const row = await findViewableFile(userId, assetId);
  if (row.thumbnail_key) {
    return presignGet(row.thumbnail_key, { filename: `${row.display_name}.webp`, inline: true });
  }
  return presignGet(row.s3_key, { filename: downloadName(row), inline: true, contentType: row.mime_type });
}
