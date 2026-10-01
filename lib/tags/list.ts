import { sql } from "@/lib/db";

// Tag กลางทั้งหมด (ผู้ใช้เลือกได้เฉพาะจากรายการนี้)
export async function listTagNames(): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`SELECT name FROM tags ORDER BY name`;
  return rows.map((r) => r.name);
}
