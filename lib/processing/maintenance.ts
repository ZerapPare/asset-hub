import { sql } from "@/lib/db";
import type { DbFileType } from "@/lib/schema";
import { bucket } from "@/lib/s3";
import { findAssetsMissingEmbeddings } from "./embed";
import { enqueueProcessing } from "./queue";
import { backfillEmbedding } from "./worker";

// Cron Lambda (infra/processing.ts, ทุก 30 นาที): ซ่อมงานที่ค้างโดยไม่ต้องมีคนรันสคริปต์
// 1) Asset ค้าง PROCESSING (ส่งเข้าคิวไม่สำเร็จ / Lambda timeout จนข้อความไป DLQ) → ส่งเข้าคิวใหม่ ลองครบแล้ว = FAILED
// 2) Asset READY ที่ embedding ยังไม่ครบ (Bedrock throttle/ล่ม) → ทำ embedding ใหม่ทีละไม่กี่ไฟล์

/** ค้าง PROCESSING นานกว่านี้ถือว่าหลุด — ต้องนานกว่า timeout ของ worker Lambda */
const STUCK_AFTER_MINUTES = 20;
/** ลองประมวลผลครบเท่านี้แล้วยังค้าง = FAILED (ไม่ส่งเข้าคิวซ้ำไม่จบ) */
const MAX_PROCESS_ATTEMPTS = 6;
const REQUEUE_LIMIT = 50;
/** ข้ามไฟล์ที่เพิ่ง READY — worker อาจกำลังทำ embedding อยู่ */
const EMBED_IDLE_MINUTES = 15;
const MAX_EMBED_ATTEMPTS = 5;
const EMBED_LIMIT = 20;
/** หยุดหยิบงานใหม่ก่อน timeout ของ cron Lambda (10 นาที) */
const TIME_BUDGET_MS = 8 * 60_000;

const STUCK_REASON = "ประมวลผลไม่สำเร็จหลายครั้ง กรุณาลองอัปโหลดใหม่";

type StuckRow = {
  asset_id: string;
  s3_key: string;
  mime_type: string;
  file_type: DbFileType;
  file_size: number;
  attempts: number;
};

export async function handler() {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const requeue = await requeueStuckAssets();
  const embeddings = await retryMissingEmbeddings(deadline);
  console.info(`[maintenance] requeued ${requeue.requeued}, failed ${requeue.failed}; embeddings`, embeddings);
}

async function requeueStuckAssets() {
  // ขั้นหลักของ worker: เอกสาร = TEXT_EXTRACTION, รูป = THUMBNAIL
  const rows = await sql<StuckRow[]>`
    SELECT
      a.asset_id, a.s3_key, a.mime_type, a.file_type, a.file_size::float8 AS file_size,
      (
        SELECT count(*)::int FROM processing_workflows pw
        WHERE pw.asset_id = a.asset_id
          AND pw.process_type = CASE WHEN a.file_type = 'DOCUMENT' THEN 'TEXT_EXTRACTION' ELSE 'THUMBNAIL' END
      ) AS attempts
    FROM assets a
    WHERE a.deleted_at IS NULL
      AND a.processing_status = 'PROCESSING'
      AND a.updated_at < NOW() - make_interval(mins => ${STUCK_AFTER_MINUTES})
    ORDER BY a.updated_at
    LIMIT ${REQUEUE_LIMIT}
  `;

  let requeued = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.attempts >= MAX_PROCESS_ATTEMPTS) {
      await sql.begin(async (tx) => {
        // workflow ที่ค้าง PROCESSING (Lambda timeout) → FAILED พร้อมเหตุผลให้เจ้าของไฟล์เห็น
        await tx`
          UPDATE processing_workflows SET status = 'FAILED', error_message = ${STUCK_REASON}, completed_at = NOW()
          WHERE asset_id = ${row.asset_id} AND status = 'PROCESSING'
        `;
        await tx`
          UPDATE assets SET processing_status = 'FAILED'
          WHERE asset_id = ${row.asset_id} AND processing_status = 'PROCESSING'
        `;
      });
      failed++;
      continue;
    }

    // ยืด updated_at ไม่ให้รอบหน้าส่งซ้ำระหว่างที่ข้อความยังอยู่ในคิว
    const [touched] = await sql`
      UPDATE assets SET updated_at = NOW()
      WHERE asset_id = ${row.asset_id} AND processing_status = 'PROCESSING' AND deleted_at IS NULL
      RETURNING 1
    `;
    if (!touched) continue;
    await enqueueProcessing({
      version: 1,
      assetId: row.asset_id,
      s3Key: row.s3_key,
      bucket: bucket(),
      mimeType: row.mime_type,
      fileType: row.file_type,
      fileSize: row.file_size,
    });
    requeued++;
  }
  return { requeued, failed };
}

async function retryMissingEmbeddings(deadline: number) {
  const rows = await findAssetsMissingEmbeddings({
    limit: EMBED_LIMIT,
    idleMinutes: EMBED_IDLE_MINUTES,
    maxAttempts: MAX_EMBED_ATTEMPTS,
  });

  const summary = { READY: 0, SKIPPED: 0, FAILED: 0, deferred: 0 };
  for (const row of rows) {
    if (Date.now() > deadline) {
      summary.deferred++;
      continue;
    }
    try {
      summary[await backfillEmbedding(row.asset_id)]++;
    } catch (error) {
      // error ที่ไม่คาดคิด (เช่น DB) — กรณีไฟล์หาย backfillEmbedding บันทึก workflow FAILED เองแล้ว
      console.error(`[maintenance] embedding ${row.asset_id} failed:`, error);
      summary.FAILED++;
    }
  }
  return summary;
}
