import { getAssetTotals, type AssetTotals } from "@/lib/assets/stats";
import { sql } from "@/lib/db";
import { IMAGE_MODEL, TEXT_MODEL } from "@/lib/embeddings";
import type { Asset, FileType, ProcessingStatus } from "@/lib/types";

// Dashboard นับเฉพาะ Asset ของผู้ใช้เอง ที่ยังไม่ถูกลบและอัปโหลดเสร็จแล้ว

/** ไฟล์ที่กำลังประมวลผล / ล้มเหลว (reason = สาเหตุจาก workflow ล่าสุดที่ล้ม) */
export type ProcessingItem = Pick<Asset, "id" | "name" | "fileType" | "extension" | "status" | "createdAt"> & {
  reason?: string;
};

/** ไฟล์ READY ค้นแบบ Semantic ได้หรือยัง (embedding ของโมเดลปัจจุบัน) */
export type SemanticReadiness = {
  /** embedding ครบ */
  ready: number;
  /** ยังไม่มี/ไม่ครบ และยังไม่เคยล้ม — worker หรือ cron กำลังทำ */
  pending: number;
  /** ครั้งล่าสุดล้ม — cron ลองใหม่ให้อัตโนมัติ */
  failed: number;
  /** PDF ไม่มีข้อความ (ภาพสแกน) — ค้นแบบ Semantic ไม่ได้ */
  noText: number;
  total: number;
};

/** จำนวนอัปโหลดต่อสัปดาห์ (สัปดาห์เริ่มวันจันทร์ ตามเวลาไทย) */
export type WeeklyUploads = { week: string; documents: number; images: number };

export type Dashboard = AssetTotals & {
  recent: Asset[];
  processingItems: ProcessingItem[];
  failedItems: ProcessingItem[];
  semantic: SemanticReadiness;
  weekly: WeeklyUploads[];
};

const RECENT_LIMIT = 6;
const STATUS_LIST_LIMIT = 5;
const WEEKS = 12;

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

type StatusRow = {
  asset_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  processing_status: ProcessingStatus;
  created_at: Date;
  reason: string | null;
};

export async function getDashboard(userId: string): Promise<Dashboard> {
  const [totals, recent, statusRows, semantic, weekly] = await Promise.all([
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
    getStatusItems(userId),
    getSemanticReadiness(userId),
    getWeeklyUploads(userId),
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
    processingItems: statusRows.filter((r) => r.status === "PROCESSING"),
    failedItems: statusRows.filter((r) => r.status === "FAILED"),
    semantic,
    weekly: [...weekly],
  };
}

// ไฟล์ PROCESSING / FAILED ล่าสุด สถานะละไม่เกิน STATUS_LIST_LIMIT (จำนวนทั้งหมดอยู่ใน totals)
async function getStatusItems(userId: string): Promise<ProcessingItem[]> {
  const rows = await sql<StatusRow[]>`
    SELECT asset_id, display_name, file_type, file_extension, processing_status, created_at, reason
    FROM (
      SELECT
        a.asset_id, a.display_name, a.file_type, a.file_extension, a.processing_status, a.created_at,
        CASE WHEN a.processing_status = 'FAILED' THEN (
          SELECT pw.error_message FROM processing_workflows pw
          WHERE pw.asset_id = a.asset_id AND pw.status = 'FAILED'
          ORDER BY pw.created_at DESC
          LIMIT 1
        ) END AS reason,
        ROW_NUMBER() OVER (PARTITION BY a.processing_status ORDER BY a.created_at DESC) AS position
      FROM assets a
      WHERE a.owner_id = ${userId}
        AND a.deleted_at IS NULL
        AND a.processing_status IN ('PROCESSING', 'FAILED')
    ) ranked
    WHERE position <= ${STATUS_LIST_LIMIT}
    ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    id: row.asset_id,
    name: row.display_name,
    fileType: row.file_type,
    extension: row.file_extension.toUpperCase(),
    status: row.processing_status,
    createdAt: row.created_at.toISOString(),
    ...(row.reason ? { reason: row.reason } : {}),
  }));
}

async function getSemanticReadiness(userId: string): Promise<SemanticReadiness> {
  const [row] = await sql<Omit<SemanticReadiness, "total">[]>`
    SELECT
      COUNT(*) FILTER (WHERE state = 'ready')::int   AS ready,
      COUNT(*) FILTER (WHERE state = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE state = 'failed')::int  AS failed,
      COUNT(*) FILTER (WHERE state = 'no_text')::int AS "noText"
    FROM (
      SELECT
        CASE
          WHEN a.file_type = 'DOCUMENT' AND NOT EXISTS (
            SELECT 1 FROM document_chunks dc WHERE dc.asset_id = a.asset_id
          ) THEN 'no_text'
          WHEN (a.file_type = 'IMAGE' AND EXISTS (
            SELECT 1 FROM image_embeddings ie
            WHERE ie.asset_id = a.asset_id AND ie.embedding_model = ${IMAGE_MODEL}
          )) OR (a.file_type = 'DOCUMENT' AND NOT EXISTS (
            SELECT 1 FROM document_chunks dc
            WHERE dc.asset_id = a.asset_id
              AND NOT EXISTS (
                SELECT 1 FROM document_embeddings de
                WHERE de.chunk_id = dc.chunk_id AND de.embedding_model = ${TEXT_MODEL}
              )
          )) THEN 'ready'
          -- ยังไม่ครบ: ดูว่าการทำ embedding ครั้งล่าสุดล้มหรือไม่
          WHEN (
            SELECT pw.status FROM processing_workflows pw
            WHERE pw.asset_id = a.asset_id AND pw.process_type IN ('TEXT_EMBEDDING', 'IMAGE_EMBEDDING')
            ORDER BY pw.created_at DESC
            LIMIT 1
          ) = 'FAILED' THEN 'failed'
          ELSE 'pending'
        END AS state
      FROM assets a
      WHERE a.owner_id = ${userId}
        AND a.deleted_at IS NULL
        AND a.processing_status = 'READY'
    ) s
  `;
  return { ...row, total: row.ready + row.pending + row.failed + row.noText };
}

// WEEKS สัปดาห์ล่าสุด รวมสัปดาห์ที่ไม่มีอัปโหลด (generate_series) ให้แกนเวลาไม่ขาดช่วง
async function getWeeklyUploads(userId: string): Promise<WeeklyUploads[]> {
  return sql<WeeklyUploads[]>`
    WITH weeks AS (
      SELECT generate_series(
        date_trunc('week', NOW() AT TIME ZONE 'Asia/Bangkok') - make_interval(weeks => ${WEEKS - 1}),
        date_trunc('week', NOW() AT TIME ZONE 'Asia/Bangkok'),
        INTERVAL '1 week'
      ) AS week
    )
    SELECT
      to_char(w.week, 'YYYY-MM-DD') AS week,
      COUNT(a.asset_id) FILTER (WHERE a.file_type = 'DOCUMENT')::int AS documents,
      COUNT(a.asset_id) FILTER (WHERE a.file_type = 'IMAGE')::int    AS images
    FROM weeks w
    LEFT JOIN assets a
      ON a.owner_id = ${userId}
      AND a.deleted_at IS NULL
      AND a.processing_status <> 'UPLOADING'
      AND date_trunc('week', a.created_at AT TIME ZONE 'Asia/Bangkok') = w.week
    GROUP BY w.week
    ORDER BY w.week
  `;
}
