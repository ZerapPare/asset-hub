import postgres from "postgres";

// ใช้ได้เฉพาะฝั่ง server (Route Handler, Server Component, Lambda worker)
// BIGINT / NUMERIC (เช่น file_size, SUM, COUNT) กลับมาเป็น string → cast ใน SQL (::int, ::float8) หรือ Number()

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // ADR-3: Lambda 1 instance = 1 connection เพื่อไม่ให้ RDS connection เต็ม
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 1),
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// dev: เก็บไว้ใน globalThis ไม่ให้ hot reload เปิด connection ใหม่ทุกครั้ง
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql = globalForDb.sql ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
