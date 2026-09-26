import { NextResponse, type NextRequest } from "next/server";
import {
  GoogleAuthError,
  OAUTH_COOKIE,
  exchangeCode,
  verifyIdToken,
} from "@/lib/auth/google";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";

function redirectTo(request: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, request.url));
  res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const [state, nonce] = request.cookies.get(OAUTH_COOKIE)?.value.split(".") ?? [];

  if (!code || !state || !nonce || params.get("state") !== state) {
    return redirectTo(request, "/login?error=oauth");
  }

  try {
    const profile = await verifyIdToken(await exchangeCode(code), nonce);

    // TODO: upsert users + เช็ก status เมื่อมี DB
    const token = await signSession({ ...profile, amr: "google" });

    const res = redirectTo(request, "/");
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error) {
    const reason = error instanceof GoogleAuthError ? error.code : "oauth";
    return redirectTo(request, `/login?error=${reason}`);
  }
}
