import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";
const SESSION_TTL = 60 * 60 * 8;

export type Session = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  amr: "google" | "password";
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

export function signSession({ sub, email, name, picture, amr }: Omit<Session, "authTime">) {
  return new SignJWT({ email, name, picture, amr })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret());
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: payload.sub!,
      email: payload.email as string,
      name: payload.name as string,
      picture: payload.picture as string | undefined,
      amr: payload.amr as Session["amr"],
      authTime: payload.iat!,
    };
  } catch {
    return null;
  }
}
