import { cache } from "react";
import { readSession, type AuthMethod } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { UserRow } from "@/lib/schema";

// เปลี่ยนรหัสได้โดยไม่ใส่รหัสเดิม ถ้าเพิ่ง login ด้วย Google
export const RECENT_AUTH_SECONDS = 10 * 60;

export type CurrentUser = Pick<UserRow, "user_id" | "email" | "display_name" | "avatar_url"> & {
  has_password: boolean;
  amr: AuthMethod;
  recentGoogleAuth: boolean;
};

// หา user จาก session (cache = query ครั้งเดียวต่อ request)
// null = ไม่มี session, user ถูก DISABLED หรือ token_version เปลี่ยน
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const [user] = await sql<Omit<CurrentUser, "amr" | "recentGoogleAuth">[]>`
    SELECT user_id, email, display_name, avatar_url, password_hash IS NOT NULL AS has_password
    FROM users
    WHERE user_id = ${session.userId}
      AND status = 'ACTIVE'
      AND token_version = ${session.ver}
  `;
  if (!user) return null;

  const age = Date.now() / 1000 - session.authTime;
  return {
    ...user,
    amr: session.amr,
    recentGoogleAuth: session.amr === "google" && age <= RECENT_AUTH_SECONDS,
  };
});

// ไม่ได้ login → 401
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
  return user;
}
