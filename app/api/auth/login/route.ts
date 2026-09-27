import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";

function error(status: number, code: string) {
  return NextResponse.json({ error: { code } }, { status });
}

export async function POST(request: NextRequest) {
  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
  };
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return error(400, "INVALID_INPUT");
  }

  const user = await findUserByEmail(email);
  // ไม่มี user / ยังไม่ตั้งรหัส / รหัสผิด = ตอบเหมือนกัน
  if (!(await verifyPassword(password, user?.password_hash))) {
    return error(401, "INVALID_CREDENTIALS");
  }
  if (user!.status !== "ACTIVE") return error(403, "ACCOUNT_DISABLED");

  const token = await signSession({ userId: user!.user_id, ver: user!.token_version, amr: "password" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
