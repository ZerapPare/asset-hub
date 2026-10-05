// ทดสอบ worker Lambda (lib/processing/handler.ts) ในเครื่อง: ส่ง SQS event จำลองเข้า handler กับ DB + MinIO ใน docker
//   npm run test:worker              เรียก handler จากซอร์สตรงๆ
//   npm run test:worker -- --bundle  bundle ด้วย esbuild แบบ SST ก่อน (จับปัญหา bundle: path alias, unpdf, native module)
// สร้างไฟล์ทดสอบเอง ([worker-test] …) แล้วลบทิ้งทั้ง DB และ S3 ตอนจบ
// embedding เรียก Bedrock จริง (ต้องมี AWS credentials) — ล้มเหลวไม่ทำให้เทสต์ตก เพราะ worker ไม่ throw ส่วนนี้ (แค่แสดงผล)
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { sql } from "@/lib/db";
import type { ProcessingMessage } from "@/lib/processing/queue";
import { bucket, originalKey, s3 } from "@/lib/s3";

type SqsEvent = { Records: { messageId: string; body: string; attributes: { ApproximateReceiveCount: string } }[] };
type Handler = (event: SqsEvent) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }>;

// ต้องตรงกับ infra/processing.ts (worker ได้ค่านี้จาก environment)
process.env.PROCESSING_MAX_RECEIVE = "3";
delete process.env.PROCESSING_QUEUE_URL;

const created: string[] = [];
const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function loadHandler(): Promise<Handler> {
  if (!process.argv.includes("--bundle")) return (await import("@/lib/processing/handler")).handler;

  // ตั้งค่าให้ใกล้กับ SST: ESM, node22, bundle ทุกอย่างยกเว้น nodejs.install (sharp, @napi-rs/canvas)
  const { build } = await import("esbuild");
  const outdir = join(process.cwd(), ".sst", "test-worker");
  mkdirSync(outdir, { recursive: true });
  const outfile = join(outdir, "handler.mjs");
  await build({
    entryPoints: ["lib/processing/handler.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["sharp", "@napi-rs/canvas"],
    mainFields: ["module", "main"],
    banner: {
      js: [
        `import { createRequire as topLevelCreateRequire } from "module";`,
        `const require = topLevelCreateRequire(import.meta.url);`,
        `import { fileURLToPath as topLevelFileUrlToPath } from "url";`,
        `const __filename = topLevelFileUrlToPath(import.meta.url);`,
        `const __dirname = topLevelFileUrlToPath(new URL(".", import.meta.url));`,
      ].join("\n"),
    },
    logLevel: "warning",
  });
  console.log(`bundle: ${outfile}`);
  // lib/db.ts, lib/s3.ts เก็บ client ใน globalThis ตอน dev → ลบออกให้ bundle สร้าง client ของตัวเองเหมือนบน Lambda
  const shared = globalThis as { sql?: unknown; s3?: unknown };
  delete shared.sql;
  delete shared.s3;
  return (await import(pathToFileURL(outfile).href)).handler;
}

/** PDF 1 หน้าที่มีข้อความ (สร้างเอง ไม่ต้องมีไฟล์ตัวอย่าง) */
function makePdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

type Fixture = { name: string; data?: Buffer; mime: string; ext: string; fileType: "DOCUMENT" | "IMAGE" };

/** สร้าง Asset สถานะ PROCESSING (เหมือนหลัง POST /complete) + อัปโหลดไฟล์ — data ไม่ใส่ = ไม่มีไฟล์ใน S3 */
async function createAsset(ownerId: string, f: Fixture): Promise<ProcessingMessage> {
  const assetId = randomUUID();
  const s3Key = originalKey(assetId, f.ext);
  const size = f.data?.length ?? 1;
  if (f.data) {
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: f.data, ContentType: f.mime }));
  }
  await sql`
    INSERT INTO assets (asset_id, owner_id, visibility, original_name, display_name, file_type, file_extension,
                        file_size, mime_type, s3_key, processing_status)
    VALUES (${assetId}, ${ownerId}, 'PRIVATE', ${`${f.name}.${f.ext}`}, ${`[worker-test] ${f.name}`}, ${f.fileType},
            ${f.ext}, ${size}, ${f.mime}, ${s3Key}, 'PROCESSING')
  `;
  created.push(assetId);
  return { version: 1, assetId, s3Key, bucket: bucket(), mimeType: f.mime, fileType: f.fileType, fileSize: size };
}

function event(...records: { message: ProcessingMessage | string; attempt?: number }[]): SqsEvent {
  return {
    Records: records.map(({ message, attempt = 1 }) => ({
      messageId: randomUUID(),
      body: typeof message === "string" ? message : JSON.stringify(message),
      attributes: { ApproximateReceiveCount: String(attempt) },
    })),
  };
}

async function asset(assetId: string) {
  const [row] = await sql<{ processing_status: string; thumbnail_key: string | null; image_width: number | null }[]>`
    SELECT processing_status, thumbnail_key, image_width FROM assets WHERE asset_id = ${assetId}
  `;
  return row;
}

async function workflows(assetId: string) {
  return sql<{ process_type: string; status: string; error_message: string | null }[]>`
    SELECT process_type, status, error_message FROM processing_workflows WHERE asset_id = ${assetId} ORDER BY created_at, attempt_no
  `;
}

async function s3Exists(key: string) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [owner] = await sql<{ user_id: string }[]>`SELECT user_id FROM users ORDER BY created_at LIMIT 1`;
  if (!owner) throw new Error("ไม่มี user ใน DB — รัน db/seed.sql ก่อน");
  const handler = await loadHandler();

  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3b82f6" } }).png().toBuffer();
  const pdf = makePdf("AssetHub worker test: quarterly budget report for the marketing team");
  const junk = Buffer.from("this is not an image at all");

  const image = await createAsset(owner.user_id, { name: "image", data: png, mime: "image/png", ext: "png", fileType: "IMAGE" });
  const doc = await createAsset(owner.user_id, { name: "document", data: pdf, mime: "application/pdf", ext: "pdf", fileType: "DOCUMENT" });
  const broken = await createAsset(owner.user_id, { name: "broken", data: junk, mime: "image/png", ext: "png", fileType: "IMAGE" });
  const missing = await createAsset(owner.user_id, { name: "missing", mime: "application/pdf", ext: "pdf", fileType: "DOCUMENT" });
  const deleted = await createAsset(owner.user_id, { name: "deleted", data: png, mime: "image/png", ext: "png", fileType: "IMAGE" });
  await sql`UPDATE assets SET deleted_at = NOW() WHERE asset_id = ${deleted.assetId}`;
  const batchOk = await createAsset(owner.user_id, { name: "batch-ok", data: png, mime: "image/png", ext: "png", fileType: "IMAGE" });
  const batchBad = await createAsset(owner.user_id, { name: "batch-bad", data: junk, mime: "image/png", ext: "png", fileType: "IMAGE" });

  console.log("\n1) รูปปกติ");
  let res = await handler(event({ message: image }));
  let row = await asset(image.assetId);
  check("ไม่มี batchItemFailures", res.batchItemFailures.length === 0);
  check("READY + มี thumbnail + ขนาดรูป", row.processing_status === "READY" && !!row.thumbnail_key && row.image_width === 800,
    `${row.processing_status}, ${row.thumbnail_key}, ${row.image_width}px`);
  check("thumbnail อยู่ใน S3", await s3Exists(row.thumbnail_key ?? ""));

  console.log("\n2) ข้อความซ้ำ (SQS ส่งซ้ำได้) → ต้องไม่มีผลเสีย");
  const before = (await workflows(image.assetId)).length;
  res = await handler(event({ message: image }));
  check("ไม่มี batchItemFailures", res.batchItemFailures.length === 0);
  check("ยัง READY และไม่สร้าง workflow ใหม่", (await asset(image.assetId)).processing_status === "READY" && (await workflows(image.assetId)).length === before);

  console.log("\n3) PDF ปกติ");
  res = await handler(event({ message: doc }));
  row = await asset(doc.assetId);
  const [{ chunks }] = await sql<{ chunks: number }[]>`SELECT COUNT(*)::int AS chunks FROM document_chunks WHERE asset_id = ${doc.assetId}`;
  check("ไม่มี batchItemFailures", res.batchItemFailures.length === 0);
  check("READY + มี chunk + thumbnail หน้าแรก", row.processing_status === "READY" && chunks > 0 && !!row.thumbnail_key,
    `${row.processing_status}, ${chunks} chunk, ${row.thumbnail_key}`);

  console.log("\n4) ไฟล์เสีย รอบที่ 1 → คืนให้ SQS retry แต่ยังไม่ FAILED");
  let ev = event({ message: broken, attempt: 1 });
  res = await handler(ev);
  check("อยู่ใน batchItemFailures", res.batchItemFailures.some((f) => f.itemIdentifier === ev.Records[0].messageId));
  check("ยัง PROCESSING", (await asset(broken.assetId)).processing_status === "PROCESSING");

  console.log("\n5) ไฟล์เสีย รอบที่ 3 (สุดท้าย) → FAILED พร้อมสาเหตุ");
  ev = event({ message: broken, attempt: 3 });
  res = await handler(ev);
  const brokenFlows = await workflows(broken.assetId);
  check("อยู่ใน batchItemFailures (SQS ย้ายไป DLQ)", res.batchItemFailures.length === 1);
  check("FAILED", (await asset(broken.assetId)).processing_status === "FAILED");
  check("workflow มีสาเหตุที่อ่านได้", brokenFlows.every((w) => w.status === "FAILED" && !!w.error_message),
    brokenFlows.at(-1)?.error_message ?? "");

  console.log("\n6) ไม่มีไฟล์ใน S3 รอบสุดท้าย");
  res = await handler(event({ message: missing, attempt: 3 }));
  check("FAILED + บอกว่าไม่พบไฟล์", (await asset(missing.assetId)).processing_status === "FAILED" &&
    (await workflows(missing.assetId)).at(-1)?.error_message?.includes("ไม่พบไฟล์") === true,
    (await workflows(missing.assetId)).at(-1)?.error_message ?? "");

  console.log("\n7) ข้อความรูปแบบผิด → ทิ้ง ไม่ retry");
  res = await handler(event({ message: "{not json" }, { message: JSON.stringify({ version: 2, assetId: "x" }) }));
  check("ไม่มี batchItemFailures", res.batchItemFailures.length === 0);

  console.log("\n8) Asset ถูกลบก่อนประมวลผล → SKIPPED");
  res = await handler(event({ message: deleted }));
  check("ไม่มี batchItemFailures และไม่มี workflow", res.batchItemFailures.length === 0 && (await workflows(deleted.assetId)).length === 0);

  console.log("\n9) batch ปนกัน → คืนเฉพาะข้อความที่ล้ม (partial batch response)");
  ev = event({ message: batchOk }, { message: batchBad });
  res = await handler(ev);
  check("batchItemFailures มีแค่ตัวเสีย", res.batchItemFailures.length === 1 && res.batchItemFailures[0].itemIdentifier === ev.Records[1].messageId);
  check("ตัวปกติ READY", (await asset(batchOk.assetId)).processing_status === "READY");

  console.log("\nembedding (Bedrock จริง — แสดงผลเท่านั้น):");
  for (const a of [image, doc, batchOk]) {
    const flows = (await workflows(a.assetId)).filter((w) => w.process_type.endsWith("EMBEDDING"));
    console.log(`  ${a.assetId.slice(0, 8)} ${flows.map((w) => `${w.process_type}=${w.status}${w.error_message ? ` (${w.error_message})` : ""}`).join(", ") || "ไม่มี"}`);
  }
}

async function cleanup() {
  if (!created.length) return;
  const keys = created.flatMap((id) => [
    { Key: originalKey(id, "png") },
    { Key: originalKey(id, "pdf") },
    { Key: `assets/${id}/thumbnail.webp` },
  ]);
  await s3.send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys, Quiet: true } })).catch(() => {});
  // ลบถาวร — chunks / embeddings / workflows ตามไปด้วย ON DELETE CASCADE
  await sql`DELETE FROM assets WHERE asset_id IN ${sql(created)}`;
}

main()
  .catch((error) => {
    console.error(error);
    results.push({ name: "สคริปต์ล้ม", ok: false, detail: String(error) });
  })
  .finally(async () => {
    await cleanup();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} ผ่าน`);
    // bundle มี connection ของตัวเอง → ออกด้วย exit แทนรอปิดทุก connection
    process.exit(failed ? 1 : 0);
  });
