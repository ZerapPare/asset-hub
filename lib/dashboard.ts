import { cache } from "react";
import { sql } from "@/lib/db";
import type { Asset, FileType, ProcessingStatus } from "@/lib/types";

export type FileTypeUsage = { count: number; bytes: number };

export type Dashboard = {
  totalAssets: number;
  storageUsed: number;
  byType: Record<FileType, FileTypeUsage>;
  processing: number;
  failed: number;
  recent: Asset[];
};

const RECENT_LIMIT = 6;

type Totals = Omit<Dashboard, "recent">;

// Asset ของ user นับเฉพาะที่ยังไม่ถูกลบ และอัปโหลดเสร็จแล้ว (ไม่นับ UPLOADING)
// ใช้ทั้งหน้า Dashboard และพื้นที่จัดเก็บใน sidebar — cache() ให้ query ครั้งเดียวต่อ request
export const getAssetTotals = cache(async (userId: string): Promise<Totals> => {
  const [totals] = await sql<{
    total: number;
    bytes: number;
    documents: number;
    document_bytes: number;
    images: number;
    image_bytes: number;
    processing: number;
    failed: number;
  }[]>`
    SELECT
      COUNT(*)::int                                                          AS total,
      COALESCE(SUM(file_size), 0)::float8                                    AS bytes,
      COUNT(*) FILTER (WHERE file_type = 'DOCUMENT')::int                    AS documents,
      COALESCE(SUM(file_size) FILTER (WHERE file_type = 'DOCUMENT'), 0)::float8 AS document_bytes,
      COUNT(*) FILTER (WHERE file_type = 'IMAGE')::int                       AS images,
      COALESCE(SUM(file_size) FILTER (WHERE file_type = 'IMAGE'), 0)::float8 AS image_bytes,
      COUNT(*) FILTER (WHERE processing_status = 'PROCESSING')::int          AS processing,
      COUNT(*) FILTER (WHERE processing_status = 'FAILED')::int              AS failed
    FROM assets
    WHERE owner_id = ${userId}
      AND deleted_at IS NULL
      AND processing_status <> 'UPLOADING'
  `;

  return {
    totalAssets: totals.total,
    storageUsed: totals.bytes,
    byType: {
      DOCUMENT: { count: totals.documents, bytes: totals.document_bytes },
      IMAGE: { count: totals.images, bytes: totals.image_bytes },
    },
    processing: totals.processing,
    failed: totals.failed,
  };
});

export async function getDashboard(userId: string): Promise<Dashboard> {
  const [totals, recent] = await Promise.all([
    getAssetTotals(userId),
    sql<{
      asset_id: string;
      display_name: string;
      file_type: FileType;
      file_extension: string;
      file_size: number;
      processing_status: ProcessingStatus;
      created_at: Date;
      owner_name: string;
    }[]>`
      SELECT
        a.asset_id, a.display_name, a.file_type, a.file_extension,
        a.file_size::float8 AS file_size, a.processing_status, a.created_at,
        u.display_name AS owner_name
      FROM assets a
      JOIN users u ON u.user_id = a.owner_id
      WHERE a.owner_id = ${userId}
        AND a.deleted_at IS NULL
        AND a.processing_status <> 'UPLOADING'
      ORDER BY a.created_at DESC
      LIMIT ${RECENT_LIMIT}
    `,
  ]);

  return {
    ...totals,
    recent: recent.map((row) => ({
      id: row.asset_id,
      name: row.display_name,
      fileType: row.file_type,
      extension: row.file_extension.toUpperCase(),
      size: row.file_size,
      status: row.processing_status,
      owner: { name: row.owner_name, isMe: true },
      createdAt: row.created_at.toISOString(),
    })),
  };
}
