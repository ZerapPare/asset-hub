import { visibleAssetsWhere } from "@/lib/access";
import { listAssets } from "@/lib/api/assets";
import { collectionColor } from "@/lib/collections/editable";
import { sql } from "@/lib/db";
import type { Visibility } from "@/lib/schema";
import type { FileType, ProcessingStatus } from "@/lib/types";
import { isUuid } from "@/lib/validate";

export type AssetDetail = {
  id: string;
  name: string;
  originalName: string;
  description: string | null;
  fileType: FileType;
  extension: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  status: ProcessingStatus;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  owner: { name: string; avatarUrl: string | null };
  isOwner: boolean;
  tags: string[];
  // เฉพาะ Collection ที่ผู้ใช้เป็นสมาชิก
  collections: { id: string; name: string; color: string }[];
  // สาเหตุที่ประมวลผลไม่สำเร็จ (เจ้าของเท่านั้น)
  error: string | null;
};

type Row = {
  asset_id: string;
  display_name: string;
  original_name: string;
  description: string | null;
  file_type: FileType;
  file_extension: string;
  mime_type: string;
  file_size: number;
  image_width: number | null;
  image_height: number | null;
  processing_status: ProcessingStatus;
  visibility: Visibility;
  created_at: Date;
  updated_at: Date;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  tags: string[];
  error_message: string | null;
};

// null = ไม่พบ / ไม่มีสิทธิ์ / ยังอัปโหลดไม่เสร็จ
export async function getAssetDetail(userId: string, assetId: string): Promise<AssetDetail | null> {
  if (!isUuid(assetId)) return null;

  const [row] = await sql<Row[]>`
    SELECT
      a.asset_id, a.display_name, a.original_name, a.description, a.file_type, a.file_extension,
      a.mime_type, a.file_size::float8 AS file_size, a.image_width, a.image_height,
      a.processing_status, a.visibility, a.created_at, a.updated_at, a.owner_id,
      u.display_name AS owner_name, u.avatar_url AS owner_avatar,
      COALESCE((
        SELECT array_agg(t.name ORDER BY t.name)
        FROM asset_tags at JOIN tags t ON t.tag_id = at.tag_id
        WHERE at.asset_id = a.asset_id
      ), '{}') AS tags,
      CASE WHEN a.processing_status = 'FAILED' AND a.owner_id = ${userId} THEN (
        SELECT pw.error_message FROM processing_workflows pw
        WHERE pw.asset_id = a.asset_id AND pw.status = 'FAILED'
        ORDER BY pw.created_at DESC LIMIT 1
      ) END AS error_message
    FROM assets a
    JOIN users u ON u.user_id = a.owner_id
    WHERE a.asset_id = ${assetId}
      AND a.processing_status <> 'UPLOADING'
      AND ${visibleAssetsWhere(userId)}
  `;
  if (!row) return null;

  const collections = await sql<{ collection_id: string; name: string }[]>`
    SELECT c.collection_id, c.name
    FROM asset_collection ac
    JOIN collections c ON c.collection_id = ac.collection_id AND c.deleted_at IS NULL
    JOIN collection_members cm ON cm.collection_id = c.collection_id AND cm.user_id = ${userId}
    WHERE ac.asset_id = ${assetId}
    ORDER BY c.name
  `;

  return {
    id: row.asset_id,
    name: row.display_name,
    originalName: row.original_name,
    description: row.description,
    fileType: row.file_type,
    extension: row.file_extension,
    mimeType: row.mime_type,
    size: row.file_size,
    width: row.image_width,
    height: row.image_height,
    status: row.processing_status,
    visibility: row.visibility,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    owner: { name: row.owner_name, avatarUrl: row.owner_avatar },
    isOwner: row.owner_id === userId,
    tags: row.tags,
    collections: collections.map((c) => ({ id: c.collection_id, name: c.name, color: collectionColor(c.collection_id) })),
    error: row.error_message,
  };
}

// ตำแหน่งในหน้า Library (เรียงล่าสุดก่อน) สำหรับปุ่มก่อนหน้า/ถัดไป
export async function getAssetNeighbors(userId: string, assetId: string) {
  const ids = (await listAssets(userId)).map((a) => a.id);
  const index = ids.indexOf(assetId);
  if (index < 0) return null;
  return { index, total: ids.length, prev: ids[index - 1] ?? null, next: ids[index + 1] ?? null };
}
