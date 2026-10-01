// ประมวลผลไฟล์ที่ค้างสถานะ PROCESSING (เช่น อัปโหลดไว้ก่อนมี worker หรือ server ดับระหว่างประมวลผล)
//   npm run process:pending                          ทุกไฟล์ที่ค้าง
//   npm run process:pending -- <assetId>…            เฉพาะไฟล์ที่ระบุ
//   npm run process:pending -- --pdf-thumbnails      ทำ thumbnail หน้าแรกให้ PDF ที่ READY แต่ยังไม่มี
// ใช้ในเครื่องเท่านั้น — บน AWS ใช้ SQS
import { sql } from "@/lib/db";
import type { DbFileType } from "@/lib/schema";
import { backfillPdfThumbnail, processAsset } from "@/lib/processing/worker";
import { bucket } from "@/lib/s3";

type PendingRow = {
  asset_id: string;
  display_name: string;
  s3_key: string;
  mime_type: string;
  file_type: DbFileType;
  file_size: number;
};

async function main() {
  const args = process.argv.slice(2);
  const pdfThumbnails = args.includes("--pdf-thumbnails");
  const ids = args.filter((a) => !a.startsWith("--"));
  const rows = await sql<PendingRow[]>`
    SELECT asset_id, display_name, s3_key, mime_type, file_type, file_size::float8 AS file_size
    FROM assets
    WHERE deleted_at IS NULL
      ${
        pdfThumbnails
          ? sql`AND processing_status = 'READY' AND file_type = 'DOCUMENT' AND thumbnail_key IS NULL`
          : sql`AND processing_status = 'PROCESSING'`
      }
      ${ids.length ? sql`AND asset_id::text IN ${sql(ids)}` : sql``}
    ORDER BY created_at
  `;
  console.log(`พบ ${rows.length} ไฟล์${pdfThumbnails ? " PDF ที่ยังไม่มี thumbnail" : "ที่รอประมวลผล"}`);

  const summary = { READY: 0, SKIPPED: 0, FAILED: 0 };
  // ทีละไฟล์ ไม่ให้ไฟล์ใหญ่หลายไฟล์กินหน่วยความจำพร้อมกัน
  for (const row of rows) {
    const started = Date.now();
    try {
      const result = pdfThumbnails
        ? await backfillPdfThumbnail(row.asset_id)
        : await processAsset({
            version: 1,
            assetId: row.asset_id,
            s3Key: row.s3_key,
            bucket: bucket(),
            mimeType: row.mime_type,
            fileType: row.file_type,
            fileSize: row.file_size,
          });
      summary[result]++;
      console.log(`${result.padEnd(7)} ${row.display_name} (${Date.now() - started} ms)`);
    } catch (error) {
      summary.FAILED++;
      console.log(`FAILED  ${row.display_name} — ${(error as Error).message}`);
    }
  }

  console.log(`\nREADY ${summary.READY} · SKIPPED ${summary.SKIPPED} · FAILED ${summary.FAILED}`);
  await sql.end();
  process.exitCode = summary.FAILED > 0 ? 1 : 0;
}

main();
