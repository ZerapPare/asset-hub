export type LoginResult = { ok: true } | { ok: false; message: string };

export const GOOGLE_LOGIN_URL = "/api/auth/google";

const INVALID_CREDENTIALS = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

// TODO: mock — รหัส "password" ผ่าน, รอ POST /api/auth/login
export async function login(email: string, password: string): Promise<LoginResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (email && password === "password") return { ok: true };
  return { ok: false, message: INVALID_CREDENTIALS };
}
