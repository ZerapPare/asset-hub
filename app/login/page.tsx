import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { LoginHero } from "@/components/auth/login-hero";
import { Logo } from "@/components/brand/logo";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — CAMP",
};

// ?error= จาก Google callback
const oauthErrors: Record<string, string> = {
  domain: `ใช้ได้เฉพาะบัญชี Google ที่เป็นอีเมล @${ALLOWED_EMAIL_DOMAIN}`,
  disabled: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
  oauth: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const initialError = typeof error === "string" ? oauthErrors[error] : undefined;

  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <LoginHero />
      <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="mb-10 w-full max-w-md lg:hidden">
          <Logo />
        </div>
        <LoginForm initialError={initialError} />
      </main>
    </div>
  );
}
