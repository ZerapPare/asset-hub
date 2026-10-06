import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { findUserById, setPassword } from "@/lib/auth/users";
import { readJson } from "@/lib/http";

function error(status: number, code: string, message?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PUT(request: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return error(401, "UNAUTHORIZED");

  const { newPassword, currentPassword } = await readJson<{ newPassword: unknown; currentPassword: unknown }>(request);
  const invalid = validateNewPassword(newPassword);
  if (invalid) return error(400, "INVALID_PASSWORD", invalid);

  // ผ่านได้ 3 ทาง: ยังไม่มีรหัส / รหัสเดิมถูก / เพิ่ง login Google
  const user = (await findUserById(current.user_id))!;
  const allowed =
    !user.password_hash ||
    current.recentGoogleAuth ||
    (typeof currentPassword === "string" && (await verifyPassword(currentPassword, user.password_hash)));
  if (!allowed) return error(403, "REAUTH_REQUIRED");

  const ver = await setPassword(user.user_id, await hashPassword(newPassword as string));
  // amr = password กันไม่ให้ช่วง 10 นาทีของ Google ต่ออายุไปเรื่อยๆ
  const token = await signSession({ userId: user.user_id, ver, amr: "password" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
