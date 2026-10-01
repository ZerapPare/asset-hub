import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import { bucket, s3 } from "@/lib/s3";
import type { DbFileType, ProcessType } from "@/lib/schema";
import { chunkText, closePdf, extractText, openPdf, renderFirstPage, type PdfDocument } from "./pdf";
import type { ProcessingMessage } from "./queue";
import { makeThumbnail, type Thumbnail } from "./thumbnail";

// แบ่ง insert ไม่ให้เกินขีดจำกัด parameter ของ Postgres
const CHUNK_INSERT_BATCH = 1000;

export function thumbnailKey(assetId: string) {
  return `assets/${assetId}/thumbnail.webp`;
}

/** Error ที่แสดงให้เจ้าของไฟล์ได้ */
export class ProcessingError extends Error {}

export type ProcessResult = "READY" | "SKIPPED";

type AssetRow = { file_type: DbFileType; s3_key: string };

/** thumbnail ที่สร้างสำเร็จ พร้อม workflow ของมัน */
type ThumbnailStep = { processId: string; thumbnail: Thumbnail };

/** ประมวลผล PDF/รูปแบบรันซ้ำได้; ตั้ง Asset เป็น FAILED เฉพาะ finalAttempt */
export async function processAsset(
  message: ProcessingMessage,
  { finalAttempt = true }: { finalAttempt?: boolean } = {},
): Promise<ProcessResult> {
  const { assetId } = message;
  // เชื่อข้อมูลล่าสุดจาก DB เท่านั้น
  const [asset] = await sql<AssetRow[]>`
    SELECT file_type, s3_key FROM assets
    WHERE asset_id = ${assetId} AND deleted_at IS NULL AND processing_status = 'PROCESSING'
  `;
  if (!asset) return "SKIPPED";

  const processType: ProcessType = asset.file_type === "DOCUMENT" ? "TEXT_EXTRACTION" : "THUMBNAIL";
  const processId = await startWorkflow(assetId, processType);

  try {
    const data = await download(asset.s3_key);
    const ready =
      asset.file_type === "DOCUMENT"
        ? await processDocument(assetId, processId, data)
        : await finishImage(assetId, processId, await toThumbnail(data));

    if (!ready) {
      // Asset ถูกลบหรือเปลี่ยนสถานะระหว่างทำงาน
      await failWorkflow(processId, "ไฟล์ถูกลบระหว่างประมวลผล");
      return "SKIPPED";
    }
    return "READY";
  } catch (error) {
    const reason = error instanceof ProcessingError ? error.message : "ประมวลผลไม่สำเร็จ กรุณาลองอัปโหลดใหม่";
    console.error(`[processing] ${assetId} ${processType} failed:`, error);
    await failWorkflow(processId, reason);
    if (finalAttempt) {
      await sql`
        UPDATE assets SET processing_status = 'FAILED'
        WHERE asset_id = ${assetId} AND deleted_at IS NULL AND processing_status = 'PROCESSING'
      `;
    }
    throw error;
  }
}

/**
 * สร้าง thumbnail หน้าแรกให้ PDF ที่ READY แล้ว (ไฟล์ที่ประมวลผลก่อนมีฟีเจอร์นี้)
 * ไม่เปลี่ยน processing_status
 */
export async function backfillPdfThumbnail(assetId: string): Promise<"READY" | "SKIPPED" | "FAILED"> {
  const [asset] = await sql<AssetRow[]>`
    SELECT file_type, s3_key FROM assets
    WHERE asset_id = ${assetId} AND deleted_at IS NULL AND processing_status = 'READY' AND file_type = 'DOCUMENT'
  `;
  if (!asset) return "SKIPPED";

  const pdf = await toPdf(await download(asset.s3_key));
  const step = await tryPdfThumbnail(assetId, pdf).finally(() => closePdf(pdf));
  if (!step) return "FAILED";

  const key = await putThumbnail(assetId, step.thumbnail);
  const saved = await sql.begin(async (tx) => {
    const [row] = await tx`
      UPDATE assets SET thumbnail_key = ${key}
      WHERE asset_id = ${assetId} AND deleted_at IS NULL
      RETURNING 1
    `;
    if (!row) return false;
    await completeWorkflow(tx, step.processId);
    return true;
  });
  if (!saved) await discardThumbnail(assetId, step.processId);
  return saved ? "READY" : "SKIPPED";
}

async function download(key: string) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return await object.Body!.transformToByteArray();
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") {
      throw new ProcessingError("ไม่พบไฟล์ในที่เก็บ กรุณาอัปโหลดใหม่", { cause: error });
    }
    throw error;
  }
}

const PDF_UNREADABLE = "อ่านไฟล์ PDF ไม่ได้ ไฟล์อาจเสียหรือมีรหัสผ่าน";

async function toPdf(data: Uint8Array) {
  try {
    return await openPdf(data);
  } catch (error) {
    throw new ProcessingError(PDF_UNREADABLE, { cause: error });
  }
}

async function toChunks(pdf: PdfDocument) {
  try {
    // PDF ภาพสแกนได้ [] แต่ยังถือว่า READY
    return chunkText(await extractText(pdf));
  } catch (error) {
    throw new ProcessingError(PDF_UNREADABLE, { cause: error });
  }
}

async function toThumbnail(data: Uint8Array) {
  try {
    return await makeThumbnail(data);
  } catch (error) {
    throw new ProcessingError("เปิดไฟล์รูปไม่ได้ ไฟล์อาจเสียหรือไม่ใช่รูปที่รองรับ", { cause: error });
  }
}

// thumbnail ของ PDF เป็นของเสริม — ล้มเหลวแค่บันทึก workflow ไฟล์ยัง READY (การ์ดแสดงไอคอนแทน)
async function tryPdfThumbnail(assetId: string, pdf: PdfDocument): Promise<ThumbnailStep | null> {
  const processId = await startWorkflow(assetId, "THUMBNAIL");
  try {
    return { processId, thumbnail: await makeThumbnail(await renderFirstPage(pdf)) };
  } catch (error) {
    console.error(`[processing] ${assetId} PDF THUMBNAIL failed:`, error);
    await failWorkflow(processId, "สร้างภาพตัวอย่างหน้าแรกไม่สำเร็จ");
    return null;
  }
}

async function processDocument(assetId: string, processId: string, data: Uint8Array) {
  const pdf = await toPdf(data);
  let chunks: string[];
  let thumb: ThumbnailStep | null;
  try {
    chunks = await toChunks(pdf);
    thumb = await tryPdfThumbnail(assetId, pdf);
  } finally {
    // คืนหน่วยความจำของ pdf.js ทันที
    await closePdf(pdf);
  }

  if (thumb) await putThumbnail(assetId, thumb.thumbnail);
  const ready = await finishDocument(assetId, processId, chunks, thumb);
  if (!ready && thumb) await discardThumbnail(assetId, thumb.processId);
  return ready;
}

// บันทึก chunk, thumbnail และ READY ใน transaction เดียว
async function finishDocument(assetId: string, processId: string, chunks: string[], thumb: ThumbnailStep | null) {
  return sql.begin(async (tx) => {
    const [asset] = await tx`
      SELECT 1 FROM assets
      WHERE asset_id = ${assetId} AND deleted_at IS NULL AND processing_status = 'PROCESSING'
      FOR UPDATE
    `;
    if (!asset) return false;

    // แทนที่ chunk เก่า; embedding ถูกลบด้วย CASCADE
    await tx`DELETE FROM document_chunks WHERE asset_id = ${assetId}`;
    const rows = chunks.map((content, chunk_index) => ({ asset_id: assetId, chunk_index, content }));
    for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH) {
      await tx`INSERT INTO document_chunks ${tx(rows.slice(i, i + CHUNK_INSERT_BATCH), "asset_id", "chunk_index", "content")}`;
    }

    // thumbnail ล้มเหลว = คง thumbnail_key เดิมไว้ (ถ้ามีจากรอบก่อน)
    if (thumb) {
      await tx`UPDATE assets SET processing_status = 'READY', thumbnail_key = ${thumbnailKey(assetId)} WHERE asset_id = ${assetId}`;
      await completeWorkflow(tx, thumb.processId);
    } else {
      await tx`UPDATE assets SET processing_status = 'READY' WHERE asset_id = ${assetId}`;
    }
    await completeWorkflow(tx, processId);
    return true;
  });
}

async function finishImage(assetId: string, processId: string, thumbnail: Thumbnail) {
  const key = await putThumbnail(assetId, thumbnail);

  const ready = await sql.begin(async (tx) => {
    const [asset] = await tx`
      UPDATE assets SET
        processing_status = 'READY',
        thumbnail_key = ${key},
        image_width = ${thumbnail.original.width},
        image_height = ${thumbnail.original.height}
      WHERE asset_id = ${assetId} AND deleted_at IS NULL AND processing_status = 'PROCESSING'
      RETURNING 1
    `;
    if (!asset) return false;
    await completeWorkflow(tx, processId);
    return true;
  });

  // ลบ thumbnail กำพร้าถ้า Asset หายไประหว่างทำงาน
  if (!ready) await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch(() => {});
  return ready;
}

async function putThumbnail(assetId: string, thumbnail: Thumbnail) {
  const key = thumbnailKey(assetId);
  // Key เดิมทุกรอบ เพื่อให้ retry เขียนทับได้
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: thumbnail.data,
      ContentType: "image/webp",
      CacheControl: "private, max-age=86400",
    }),
  );
  return key;
}

// Asset หายไประหว่างทำงาน — ลบ thumbnail กำพร้าและปิด workflow
async function discardThumbnail(assetId: string, processId: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: thumbnailKey(assetId) })).catch(() => {});
  await failWorkflow(processId, "ไฟล์ถูกลบระหว่างประมวลผล");
}

async function startWorkflow(assetId: string, processType: ProcessType) {
  const [{ process_id }] = await sql<{ process_id: string }[]>`
    INSERT INTO processing_workflows (asset_id, process_type, status, attempt_no, started_at)
    SELECT ${assetId}, ${processType}, 'PROCESSING', COALESCE(MAX(attempt_no), 0) + 1, NOW()
    FROM processing_workflows
    WHERE asset_id = ${assetId} AND process_type = ${processType}
    RETURNING process_id
  `;
  return process_id;
}

async function completeWorkflow(tx: TransactionSql, processId: string) {
  await tx`
    UPDATE processing_workflows SET status = 'SUCCESS', error_message = NULL, completed_at = NOW()
    WHERE process_id = ${processId}
  `;
}

async function failWorkflow(processId: string, reason: string) {
  await sql`
    UPDATE processing_workflows SET status = 'FAILED', error_message = ${reason}, completed_at = NOW()
    WHERE process_id = ${processId}
  `;
}
