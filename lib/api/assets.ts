import { visibleAssetsWhere } from "@/lib/access";
import { assetFilters, type AssetFilterOptions } from "@/lib/assets/search";
import { countVisibleAssets, getAssetTotals } from "@/lib/assets/stats";
import { STORAGE_QUOTA } from "@/lib/config";
import { sql } from "@/lib/db";
import type { Asset, FileType, ProcessingStatus, Summary } from "@/lib/types";
import { isUuid } from "@/lib/validate";

// TODO: Collection ยังไม่ได้ดึงจาก DB
export async function getSummary(userId: string): Promise<Summary> {
  // จำนวนไฟล์ = ที่มองเห็นได้ (ตรงกับหน้า Library) / พื้นที่จัดเก็บ = เฉพาะไฟล์ของตัวเอง
  const [visible, { storageUsed, byType }, [{ tags }]] = await Promise.all([
    countVisibleAssets(userId),
    getAssetTotals(userId),
    sql<{ tags: number }[]>`SELECT COUNT(*)::int AS tags FROM tags`,
  ]);
  return {
    totalAssets: visible.total,
    documents: visible.documents,
    images: visible.images,
    collections: [],
    tags,
    storage: {
      used: storageUsed,
      documents: byType.DOCUMENT.bytes,
      images: byType.IMAGE.bytes,
      quota: STORAGE_QUOTA,
    },
  };
}

export const LIST_LIMIT = 100;

export const LIST_SORTS = ["newest", "oldest", "name-th", "name"] as const;
export type ListSort = (typeof LIST_SORTS)[number];

export type ListAssetsOptions = AssetFilterOptions & { sort?: ListSort };

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

// การเรียงมาจาก allowlist เท่านั้น
function listOrderBy(sort: ListSort = "newest") {
  switch (sort) {
    case "oldest":
      return sql`a.created_at ASC, a.asset_id`;
    case "name-th":
      return sql`LOWER(a.display_name) COLLATE "th-x-icu" ASC, a.created_at DESC, a.asset_id`;
    case "name":
      return sql`LOWER(a.display_name) COLLATE "en-x-icu" ASC, a.created_at DESC, a.asset_id`;
    default:
      return sql`a.created_at DESC, a.asset_id`;
  }
}

// Asset ที่ user มีสิทธิ์เห็น ไม่รวมที่ยังอัปโหลดไม่เสร็จ (ตัวกรองชุดเดียวกับ Keyword Search)
// TODO: cursor (Phase 5)
export async function listAssets(userId: string, options: ListAssetsOptions = {}): Promise<Asset[]> {
  // collection id ผิดรูปแบบ = ไม่มี collection นี้
  if (options.collectionId && !isUuid(options.collectionId)) return [];

  const rows = await sql<AssetListRow[]>`
    SELECT
      a.asset_id, a.display_name, a.file_type, a.file_extension,
      a.file_size::float8 AS file_size, a.processing_status, a.created_at,
      a.owner_id, u.display_name AS owner_name
    FROM assets a
    JOIN users u ON u.user_id = a.owner_id
    WHERE ${visibleAssetsWhere(userId)}
      AND a.processing_status <> 'UPLOADING'
      ${assetFilters(userId, options)}
    ORDER BY ${listOrderBy(options.sort)}
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
