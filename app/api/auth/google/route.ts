import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, encodeOAuthState, googleAuthUrl, safeReturnTo } from "@/lib/auth/google";

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  const res = NextResponse.redirect(googleAuthUrl(state, nonce));
  res.cookies.set(OAUTH_COOKIE, encodeOAuthState({ state, nonce, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
