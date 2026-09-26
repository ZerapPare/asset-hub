import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { OAUTH_COOKIE, googleAuthUrl } from "@/lib/auth/google";

export async function GET() {
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");

  const res = NextResponse.redirect(googleAuthUrl(state, nonce));
  res.cookies.set(OAUTH_COOKIE, `${state}.${nonce}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
