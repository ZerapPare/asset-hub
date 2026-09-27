import { NextResponse, type NextRequest } from "next/server";
import {
  GoogleAuthError,
  OAUTH_COOKIE,
  decodeOAuthState,
  exchangeCode,
  verifyIdToken,
} from "@/lib/auth/google";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/users";

function redirectTo(request: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, request.url));
  res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const saved = decodeOAuthState(request.cookies.get(OAUTH_COOKIE)?.value);

  if (!code || !saved || params.get("state") !== saved.state) {
    return redirectTo(request, "/login?error=oauth");
  }

  try {
    const profile = await verifyIdToken(await exchangeCode(code), saved.nonce);
    const user = await upsertGoogleUser(profile);
    if (user.status !== "ACTIVE") return redirectTo(request, "/login?error=disabled");

    const token = await signSession({ userId: user.user_id, ver: user.token_version, amr: "google" });
    const res = redirectTo(request, saved.returnTo);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error) {
    // email ชนกับบัญชีอื่น (unique) ก็ตกมาที่ oauth
    const reason = error instanceof GoogleAuthError ? error.code : "oauth";
    if (!(error instanceof GoogleAuthError)) console.error("google callback failed", error);
    return redirectTo(request, `/login?error=${reason}`);
  }
}
