import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";
const SESSION_TTL = 60 * 60 * 8;

export type AuthMethod = "google" | "password";

// ชื่อ/อีเมลอ่านจาก DB ผ่าน getCurrentUser()
export type Session = {
  userId: string;
  ver: number;
  amr: AuthMethod;
  authTime: number;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL,
};

export function signSession({ userId, ver, amr }: Omit<Session, "authTime">) {
  return new SignJWT({ ver, amr })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret());
}

// เช็กแค่ลายเซ็น JWT ไม่แตะ DB
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.ver !== "number") return null;
    return {
      userId: payload.sub,
      ver: payload.ver,
      amr: payload.amr === "google" ? "google" : "password",
      authTime: payload.iat!,
    };
  } catch {
    return null;
  }
}
