import { cache } from "react";
import { visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import type { FileType } from "@/lib/types";

export type FileTypeUsage = {
  count: number;
  bytes: number;
};

export type AssetTotals = {
  totalAssets: number;
  storageUsed: number;
  byType: Record<FileType, FileTypeUsage>;
  processing: number;
  failed: number;
};

type AssetTotalsRow = {
  total: number;
  bytes: number;
  documents: number;
  document_bytes: number;
  images: number;
  image_bytes: number;
  processing: number;
  failed: number;
};

// นับเฉพาะ Asset ที่ยังไม่ถูกลบและอัปโหลดเสร็จแล้ว
// cache() ป้องกันการ query ซ้ำเมื่อ Dashboard และ Sidebar ขอข้อมูลเดียวกันใน request เดียว
export const getAssetTotals = cache(async (userId: string): Promise<AssetTotals> => {
  const [row] = await sql<AssetTotalsRow[]>`
    SELECT
      COUNT(*)::int                                                             AS total,
      COALESCE(SUM(file_size), 0)::float8                                       AS bytes,
      COUNT(*) FILTER (WHERE file_type = 'DOCUMENT')::int                       AS documents,
      COALESCE(SUM(file_size) FILTER (WHERE file_type = 'DOCUMENT'), 0)::float8 AS document_bytes,
      COUNT(*) FILTER (WHERE file_type = 'IMAGE')::int                          AS images,
      COALESCE(SUM(file_size) FILTER (WHERE file_type = 'IMAGE'), 0)::float8    AS image_bytes,
      COUNT(*) FILTER (WHERE processing_status = 'PROCESSING')::int             AS processing,
      COUNT(*) FILTER (WHERE processing_status = 'FAILED')::int                 AS failed
    FROM assets
    WHERE owner_id = ${userId}
      AND deleted_at IS NULL
      AND processing_status <> 'UPLOADING'
  `;

  return {
    totalAssets: row.total,
    storageUsed: row.bytes,
    byType: {
      DOCUMENT: { count: row.documents, bytes: row.document_bytes },
      IMAGE: { count: row.images, bytes: row.image_bytes },
    },
    processing: row.processing,
    failed: row.failed,
  };
});

export type VisibleAssetCounts = { total: number; documents: number; images: number };

// จำนวน Asset ที่ user มองเห็น (เงื่อนไขเดียวกับหน้า Library) ใช้กับตัวเลขใน sidebar
export async function countVisibleAssets(userId: string): Promise<VisibleAssetCounts> {
  const [row] = await sql<VisibleAssetCounts[]>`
    SELECT
      COUNT(*)::int                                         AS total,
      COUNT(*) FILTER (WHERE a.file_type = 'DOCUMENT')::int AS documents,
      COUNT(*) FILTER (WHERE a.file_type = 'IMAGE')::int    AS images
    FROM assets a
    WHERE ${visibleAssetsWhere(userId)}
      AND a.processing_status <> 'UPLOADING'
  `;
  return row;
}
