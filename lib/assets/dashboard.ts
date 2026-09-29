import { getAssetTotals, type AssetTotals } from "@/lib/assets/stats";
import { sql } from "@/lib/db";
import type { Asset, FileType, ProcessingStatus } from "@/lib/types";

export type Dashboard = AssetTotals & {
  recent: Asset[];
};

const RECENT_LIMIT = 6;

type RecentAssetRow = {
  asset_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  file_size: number;
  processing_status: ProcessingStatus;
  created_at: Date;
  owner_name: string;
};

export async function getDashboard(userId: string): Promise<Dashboard> {
  const [totals, recent] = await Promise.all([
    getAssetTotals(userId),
    sql<RecentAssetRow[]>`
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
