import type { Metadata } from "next";
import { PasswordForm } from "@/components/settings/password-form";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "ตั้งค่าบัญชี — AssetHub" };

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">ตั้งค่าบัญชี</h1>

      <section className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-6">
        <Avatar name={user.display_name} src={user.avatar_url} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{user.display_name}</p>
          <p className="truncate text-ink-muted">{user.email}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-6">
        <h2 className="text-lg font-bold">{user.has_password ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}</h2>
        <p className="mb-6 mt-1 text-sm text-ink-muted">
          {user.has_password
            ? "ใช้เข้าสู่ระบบด้วยอีเมลบริษัทและรหัสผ่าน"
            : "ไม่บังคับ — ตั้งไว้เพื่อเข้าสู่ระบบด้วยอีเมลและรหัสผ่านได้ นอกจาก Google"}
        </p>
        <PasswordForm hasPassword={user.has_password} recentGoogleAuth={user.recentGoogleAuth} />
      </section>
    </div>
  );
}
