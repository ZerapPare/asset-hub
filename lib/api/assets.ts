import { visibleAssetsWhere } from "@/lib/access";
import { countVisibleAssets, getAssetTotals } from "@/lib/assets/stats";
import { STORAGE_QUOTA } from "@/lib/config";
import { sql } from "@/lib/db";
import type { Asset, FileType, ProcessingStatus, Summary } from "@/lib/types";

// TODO: Collection และ Tag ยังไม่ได้ดึงจาก DB
export async function getSummary(userId: string): Promise<Summary> {
  // จำนวนไฟล์ = ที่มองเห็นได้ (ตรงกับหน้า Library) / พื้นที่จัดเก็บ = เฉพาะไฟล์ของตัวเอง
  const [visible, { storageUsed, byType }] = await Promise.all([countVisibleAssets(userId), getAssetTotals(userId)]);
  return {
    totalAssets: visible.total,
    documents: visible.documents,
    images: visible.images,
    collections: [],
    tags: 0,
    storage: {
      used: storageUsed,
      documents: byType.DOCUMENT.bytes,
      images: byType.IMAGE.bytes,
      quota: STORAGE_QUOTA,
    },
  };
}

const LIST_LIMIT = 100;

type AssetListRow = {
  asset_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  file_size: number;
  processing_status: ProcessingStatus;
  created_at: Date;
  owner_id: string;
  owner_name: string;
};

// Asset ที่ user มีสิทธิ์เห็น ไม่รวมที่ยังอัปโหลดไม่เสร็จ
// TODO: filter/sort + cursor (Phase 5)
export async function listAssets(userId: string, filters: { type?: FileType }): Promise<Asset[]> {
  const rows = await sql<AssetListRow[]>`
    SELECT
      a.asset_id, a.display_name, a.file_type, a.file_extension,
      a.file_size::float8 AS file_size, a.processing_status, a.created_at,
      a.owner_id, u.display_name AS owner_name
    FROM assets a
    JOIN users u ON u.user_id = a.owner_id
    WHERE ${visibleAssetsWhere(userId)}
      AND a.processing_status <> 'UPLOADING'
      ${filters.type ? sql`AND a.file_type = ${filters.type}` : sql``}
    ORDER BY a.created_at DESC
    LIMIT ${LIST_LIMIT}
  `;
  return rows.map((row) => ({
    id: row.asset_id,
    name: row.display_name,
    fileType: row.file_type,
    extension: row.file_extension.toUpperCase(),
    size: row.file_size,
    status: row.processing_status,
    owner: { name: row.owner_name, isMe: row.owner_id === userId },
    createdAt: row.created_at.toISOString(),
  }));
}
