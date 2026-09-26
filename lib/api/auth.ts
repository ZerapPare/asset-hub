export type LoginResult = { ok: true } | { ok: false; message: string };

export const GOOGLE_LOGIN_URL = "/api/auth/google";

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  } catch {}
  return { ok: false, message: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง" };
}
