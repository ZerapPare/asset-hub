import { createRemoteJWKSet, jwtVerify } from "jose";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const OAUTH_COOKIE = "oauth_state";

export type GoogleProfile = { sub: string; email: string; name: string; picture?: string };

// code ตรงกับ ?error= ของหน้า login
export class GoogleAuthError extends Error {
  constructor(public code: "domain" | "oauth") {
    super(code);
  }
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function googleAuthUrl(state: string, nonce: string) {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    hd: ALLOWED_EMAIL_DOMAIN,
    prompt: "select_account",
  }).toString();
  return url;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new GoogleAuthError("oauth");
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new GoogleAuthError("oauth");
  return id_token;
}

export async function verifyIdToken(idToken: string, nonce: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env("GOOGLE_CLIENT_ID"),
  }).catch(() => {
    throw new GoogleAuthError("oauth");
  });

  if (payload.nonce !== nonce || payload.email_verified !== true) {
    throw new GoogleAuthError("oauth");
  }

  // เช็กทั้ง hd และท้ายอีเมล
  const email = String(payload.email ?? "").toLowerCase();
  if (payload.hd !== ALLOWED_EMAIL_DOMAIN || !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    throw new GoogleAuthError("domain");
  }

  return {
    sub: payload.sub!,
    email,
    name: String(payload.name ?? email),
    picture: payload.picture as string | undefined,
  };
}
