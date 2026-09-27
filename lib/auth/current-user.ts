import { cache } from "react";
import { readSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import type { UserRow } from "@/lib/schema";

export type CurrentUser = Pick<UserRow, "user_id" | "email" | "display_name">;

// หา user ใน DB จาก session (cache = query ครั้งเดียวต่อ request แม้เรียกหลายที่)
// TODO(คนที่ 1): เมื่อ login จริงเก็บ user_id ใน session แล้ว ให้ค้นด้วย user_id + เช็ก token_version แทน email
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const [user] = await sql<CurrentUser[]>`
    SELECT user_id, email, display_name
    FROM users
    WHERE LOWER(BTRIM(email)) = LOWER(BTRIM(${session.email}))
      AND status = 'ACTIVE'
  `;
  return user ?? null;
});
