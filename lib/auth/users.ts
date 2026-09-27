import { sql } from "@/lib/db";
import type { UserRow } from "@/lib/schema";
import type { GoogleProfile } from "./google";

export async function upsertGoogleUser(profile: GoogleProfile): Promise<UserRow> {
  const [user] = await sql<UserRow[]>`
    INSERT INTO users (google_sub, email, display_name, avatar_url, verified_at)
    VALUES (${profile.sub}, ${profile.email}, ${profile.name}, ${profile.picture ?? null}, NOW())
    ON CONFLICT (google_sub) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      verified_at = COALESCE(users.verified_at, NOW())
    RETURNING *
  `;
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [user] = await sql<UserRow[]>`
    SELECT * FROM users WHERE LOWER(BTRIM(email)) = LOWER(BTRIM(${email}))
  `;
  return user ?? null;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const [user] = await sql<UserRow[]>`SELECT * FROM users WHERE user_id = ${userId}`;
  return user ?? null;
}

// เพิ่ม token_version = session เก่าทุกเครื่องหลุด
export async function setPassword(userId: string, passwordHash: string): Promise<number> {
  const [row] = await sql<{ token_version: number }[]>`
    UPDATE users
    SET password_hash = ${passwordHash}, password_set_at = NOW(), token_version = token_version + 1
    WHERE user_id = ${userId}
    RETURNING token_version
  `;
  return row.token_version;
}
