import { sql } from "@/lib/db";
import { embedImage, embedText, IMAGE_MODEL, TEXT_MODEL, toVector } from "@/lib/embeddings";
import type { DbFileType } from "@/lib/schema";
import { makeEmbeddingImage } from "./thumbnail";
import { completeWorkflow, failWorkflow, startWorkflow } from "./workflows";

// Embedding สำหรับ Semantic Search — ทำหลัง Asset READY และไม่ throw
// ล้มเหลว = workflow FAILED แต่ไฟล์ยังใช้งานได้ (แค่ค้นแบบ semantic ไม่เจอ) → รันซ้ำด้วย backfill
// รันซ้ำได้: ทำเฉพาะส่วนที่ยังไม่มี embedding ของโมเดลปัจจุบัน และ insert แบบ ON CONFLICT DO NOTHING

/** เรียก Bedrock พร้อมกันสูงสุดเท่านี้ (กัน throttle) */
const CONCURRENCY = 5;
/** embed + บันทึกทีละชุด — ล้มกลางทางแล้วรอบหน้าทำต่อจากชุดที่ค้าง */
const BATCH_SIZE = 50;

export type EmbedResult = "SUCCESS" | "FAILED" | "SKIPPED";

const FAILED_REASON = "สร้างข้อมูลสำหรับค้นหาด้วยความหมายไม่สำเร็จ";
const CHANGED_REASON = "ไฟล์ถูกลบหรือประมวลผลใหม่ระหว่างสร้างข้อมูลค้นหา";

/** Asset ยังอยู่, READY และเป็นชนิดที่ถูกต้อง (กฎข้อ 12–13 ใน db/README.md) */
async function isEmbeddable(assetId: string, fileType: DbFileType) {
  const [row] = await sql`
    SELECT 1 FROM assets
    WHERE asset_id = ${assetId} AND file_type = ${fileType}
      AND processing_status = 'READY' AND deleted_at IS NULL
  `;
  return Boolean(row);
}

/** Titan Text V2 ทุก chunk ของเอกสารที่ยังไม่มี embedding */
export function embedDocument(assetId: string) {
  return neverThrow(assetId, "TEXT_EMBEDDING", () => embedDocumentSteps(assetId));
}

/** Titan Multimodal ของรูป — data คือไฟล์ต้นฉบับที่ worker ดาวน์โหลดไว้แล้ว */
export function embedAssetImage(assetId: string, data: Uint8Array) {
  return neverThrow(assetId, "IMAGE_EMBEDDING", () => embedImageSteps(assetId, data));
}

// error นอกส่วนที่จัดการเอง (เช่น DB ล่มตอนเริ่ม/บันทึก workflow) ก็ไม่ให้หลุดไปถึง worker
async function neverThrow(assetId: string, step: string, fn: () => Promise<EmbedResult>): Promise<EmbedResult> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[processing] ${assetId} ${step} failed:`, error);
    return "FAILED";
  }
}

async function embedDocumentSteps(assetId: string): Promise<EmbedResult> {
  if (!(await isEmbeddable(assetId, "DOCUMENT"))) return "SKIPPED";
  const processId = await startWorkflow(assetId, "TEXT_EMBEDDING");
  const start = performance.now();
  let embedded = 0;

  try {
    const chunks = await sql<{ chunk_id: string; content: string }[]>`
      SELECT dc.chunk_id, dc.content
      FROM document_chunks dc
      WHERE dc.asset_id = ${assetId}
        AND NOT EXISTS (
          SELECT 1 FROM document_embeddings de
          WHERE de.chunk_id = dc.chunk_id AND de.embedding_model = ${TEXT_MODEL}
        )
      ORDER BY dc.chunk_index
    `;

    // PDF ภาพสแกนไม่มี chunk = สำเร็จโดยไม่เรียก Bedrock
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await mapLimit(batch, CONCURRENCY, (chunk) => embedText(chunk.content));
      // ไฟล์ถูกลบระหว่างทำ — หยุดเขียน
      if (!(await isEmbeddable(assetId, "DOCUMENT"))) {
        await failWorkflow(processId, CHANGED_REASON);
        return "SKIPPED";
      }
      const rows = batch.map((chunk, j) => ({
        chunk_id: chunk.chunk_id,
        embedding_model: TEXT_MODEL,
        embedding: toVector(vectors[j]),
      }));
      await sql`
        INSERT INTO document_embeddings ${sql(rows, "chunk_id", "embedding_model", "embedding")}
        ON CONFLICT (chunk_id, embedding_model) DO NOTHING
      `;
      embedded += batch.length;
    }

    await completeWorkflow(processId);
    console.info(`[processing] ${assetId} TEXT_EMBEDDING ${embedded} chunks ${Math.round(performance.now() - start)}ms`);
    return "SUCCESS";
  } catch (error) {
    // chunk ถูกแทนที่ (ประมวลผลใหม่) ระหว่างทำ → insert ชน FK
    if (isForeignKeyViolation(error)) {
      await failWorkflow(processId, CHANGED_REASON);
      return "SKIPPED";
    }
    console.error(`[processing] ${assetId} TEXT_EMBEDDING failed after ${embedded} chunks:`, error);
    await failWorkflow(processId, FAILED_REASON);
    return "FAILED";
  }
}

async function embedImageSteps(assetId: string, data: Uint8Array): Promise<EmbedResult> {
  if (!(await isEmbeddable(assetId, "IMAGE"))) return "SKIPPED";
  const processId = await startWorkflow(assetId, "IMAGE_EMBEDDING");
  const start = performance.now();

  try {
    const vector = await embedImage(await makeEmbeddingImage(data));
    // เขียนเฉพาะเมื่อไฟล์ยังไม่ถูกลบ
    const [row] = await sql`
      INSERT INTO image_embeddings (asset_id, embedding_model, embedding)
      SELECT ${assetId}::uuid, ${IMAGE_MODEL}::text, ${toVector(vector)}::vector
      WHERE EXISTS (SELECT 1 FROM assets WHERE asset_id = ${assetId} AND deleted_at IS NULL)
      ON CONFLICT (asset_id, embedding_model) DO NOTHING
      RETURNING 1
    `;
    if (!row && !(await isEmbeddable(assetId, "IMAGE"))) {
      await failWorkflow(processId, CHANGED_REASON);
      return "SKIPPED";
    }

    await completeWorkflow(processId);
    console.info(`[processing] ${assetId} IMAGE_EMBEDDING ${Math.round(performance.now() - start)}ms`);
    return "SUCCESS";
  } catch (error) {
    console.error(`[processing] ${assetId} IMAGE_EMBEDDING failed:`, error);
    await failWorkflow(processId, FAILED_REASON);
    return "FAILED";
  }
}

/**
 * Asset ที่ READY แต่ embedding ของโมเดลปัจจุบันยังไม่ครบ — ใช้ทั้งสคริปต์ backfill และ cron
 * idleMinutes: ข้ามไฟล์ที่เพิ่ง READY (worker อาจกำลังทำ embedding อยู่)
 * maxAttempts: ข้ามไฟล์ที่ลองมาแล้วหลายรอบ (เช่น ไฟล์ใน S3 หาย) ไม่ให้ cron ลองซ้ำไม่จบ
 * เรียงจากไฟล์ที่ลองล่าสุดนานที่สุด ไม่ให้ไฟล์ที่ล้มซ้ำๆ บังไฟล์อื่น
 */
export async function findAssetsMissingEmbeddings(
  options: { ids?: string[]; limit?: number; idleMinutes?: number; maxAttempts?: number } = {},
) {
  const embeddingTypes = sql`('TEXT_EMBEDDING', 'IMAGE_EMBEDDING')`;
  return sql<{ asset_id: string; display_name: string }[]>`
    SELECT a.asset_id, a.display_name
    FROM assets a
    WHERE a.deleted_at IS NULL
      AND a.processing_status = 'READY'
      AND (
        (a.file_type = 'DOCUMENT' AND EXISTS (
          SELECT 1 FROM document_chunks dc
          WHERE dc.asset_id = a.asset_id
            AND NOT EXISTS (
              SELECT 1 FROM document_embeddings de
              WHERE de.chunk_id = dc.chunk_id AND de.embedding_model = ${TEXT_MODEL}
            )
        ))
        OR (a.file_type = 'IMAGE' AND NOT EXISTS (
          SELECT 1 FROM image_embeddings ie
          WHERE ie.asset_id = a.asset_id AND ie.embedding_model = ${IMAGE_MODEL}
        ))
      )
      ${options.ids?.length ? sql`AND a.asset_id::text IN ${sql(options.ids)}` : sql``}
      ${options.idleMinutes ? sql`AND a.updated_at < NOW() - make_interval(mins => ${options.idleMinutes})` : sql``}
      ${
        options.maxAttempts
          ? sql`AND (
              SELECT count(*) FROM processing_workflows pw
              WHERE pw.asset_id = a.asset_id AND pw.process_type IN ${embeddingTypes}
            ) < ${options.maxAttempts}`
          : sql``
      }
    ORDER BY (
      SELECT max(pw.created_at) FROM processing_workflows pw
      WHERE pw.asset_id = a.asset_id AND pw.process_type IN ${embeddingTypes}
    ) NULLS FIRST, a.created_at
    ${options.limit ? sql`LIMIT ${options.limit}` : sql``}
  `;
}

function isForeignKeyViolation(error: unknown) {
  return (error as { code?: string }).code === "23503";
}

/** map แบบจำกัดจำนวนงานพร้อมกัน; ผลลัพธ์เรียงตาม input; งานหนึ่งล้ม = หยุดหยิบงานใหม่ (ไม่เรียก Bedrock ทิ้ง) */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
