import { visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import type { DbProcessingStatus } from "@/lib/schema";
import { isUuid } from "@/lib/validate";

/** ถามได้สูงสุดกี่ไฟล์ต่อครั้ง (หน้า Library แสดงสูงสุด 100) */
export const MAX_STATUS_IDS = 100;

export type ProcessingStatusResult = {
  status: DbProcessingStatus;
  updatedAt: string;
  /** สาเหตุที่ประมวลผลไม่สำเร็จ — แสดงเฉพาะเจ้าของไฟล์ */
  error?: string;
};

/**
 * สถานะการประมวลผลของหลาย Asset ในครั้งเดียว
 * ไฟล์ที่ไม่พบ ไม่มีสิทธิ์ หรือ id ผิดรูปแบบ จะไม่มีใน object (ไม่เผยว่ามีไฟล์นั้นอยู่)
 */
export async function getProcessingStatuses(
  userId: string,
  assetIds: string[],
): Promise<Record<string, ProcessingStatusResult>> {
  const ids = [...new Set(assetIds.filter(isUuid).map((id) => id.toLowerCase()))].slice(0, MAX_STATUS_IDS);
  if (ids.length === 0) return {};

  const rows = await sql<{
    asset_id: string;
    processing_status: DbProcessingStatus;
    updated_at: Date;
    error_message: string | null;
  }[]>`
    SELECT
      a.asset_id,
      a.processing_status,
      a.updated_at,
      CASE WHEN a.processing_status = 'FAILED' AND a.owner_id = ${userId} THEN (
        SELECT pw.error_message
        FROM processing_workflows pw
        WHERE pw.asset_id = a.asset_id
          AND pw.status = 'FAILED'
        ORDER BY pw.created_at DESC
        LIMIT 1
      ) END AS error_message
    FROM assets a
    WHERE a.asset_id IN ${sql(ids)}
      AND ${visibleAssetsWhere(userId)}
  `;

  return Object.fromEntries(
    rows.map((row) => [
      row.asset_id,
      {
        status: row.processing_status,
        updatedAt: row.updated_at.toISOString(),
        ...(row.error_message ? { error: row.error_message } : {}),
      },
    ]),
  );
}

/** สถานะของ Asset เดียว — null = ไม่พบหรือไม่มีสิทธิ์ */
export async function getProcessingStatus(userId: string, assetId: string): Promise<ProcessingStatusResult | null> {
  const statuses = await getProcessingStatuses(userId, [assetId]);
  return statuses[assetId.toLowerCase()] ?? null;
}
