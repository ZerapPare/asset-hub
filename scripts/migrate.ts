// รัน db/migrations/*.sql ที่ยังไม่เคยรัน ตามลำดับชื่อไฟล์ — ใช้กับ RDS ผ่าน SSM tunnel (infra/README.md ขั้น 7)
//   npm run migrate              รันไฟล์ที่ค้าง
//   npm run migrate -- --dry-run ดูอย่างเดียวว่าไฟล์ไหนจะถูกรัน
// อ่าน RDS_DATABASE_URL จาก .env.local (ไม่ใช้ DATABASE_URL กันรันผิด DB)
//   RDS_DATABASE_URL=postgres://postgres:<password>@localhost:5433/assethub?sslmode=require
// บันทึกไฟล์ที่รันแล้วในตาราง schema_migrations — รันซ้ำได้ ไฟล์เดิมไม่ถูกรันอีก
// ห้ามรัน db/seed.sql บน RDS (บัญชีทดสอบมีรหัสที่ใครเปิด repo ก็เห็น)
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const DIR = join(process.cwd(), "db", "migrations");

async function main() {
  const url = process.env.RDS_DATABASE_URL;
  if (!url) throw new Error("ไม่พบ RDS_DATABASE_URL ใน .env.local");
  const dryRun = process.argv.includes("--dry-run");

  const sql = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });
  try {
    const [{ db, version }] = await sql<{ db: string; version: string }[]>`
      SELECT current_database() AS db, current_setting('server_version') AS version
    `;
    console.log(`ต่อ ${new URL(url).host}/${db} (PostgreSQL ${version}) สำเร็จ`);

    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    const applied = new Set((await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`).map((r) => r.filename));
    const pending = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql") && !applied.has(f))
      .sort();

    if (!pending.length) {
      console.log("ไม่มี migration ค้าง");
      return;
    }
    console.log(`${dryRun ? "จะรัน" : "รัน"} ${pending.length} ไฟล์: ${pending.join(", ")}`);
    if (dryRun) return;

    for (const file of pending) {
      const started = Date.now();
      try {
        // ทุกไฟล์มี BEGIN/COMMIT ของตัวเอง → ล้มกลางไฟล์ = ไม่มีอะไรถูกบันทึก
        await sql.file(join(DIR, file));
      } catch (error) {
        await sql`ROLLBACK`.catch(() => {});
        throw new Error(`${file} ล้มเหลว (ไฟล์ก่อนหน้ารันสำเร็จแล้ว): ${(error as Error).message}`, { cause: error });
      }
      await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      console.log(`OK  ${file} (${Date.now() - started} ms)`);
    }

    const [ext] = await sql<{ version: string }[]>`SELECT extversion AS version FROM pg_extension WHERE extname = 'vector'`;
    console.log(`เสร็จ — pgvector ${ext?.version ?? "ไม่พบ"}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
