import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

// TODO: mock — รหัส "password" ผ่าน, รอ DB + bcrypt
export async function POST(request: NextRequest) {
  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const normalized = String(email ?? "").trim().toLowerCase();

  if (!normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`) || password !== "password") {
    return NextResponse.json({ error: { code: "INVALID_CREDENTIALS" } }, { status: 401 });
  }

  const name = normalized.split("@")[0];
  const token = await signSession({ sub: normalized, email: normalized, name, amr: "password" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
