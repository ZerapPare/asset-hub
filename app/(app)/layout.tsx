import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PasswordBanner } from "@/components/app/password-banner";
import { Sidebar } from "@/components/app/sidebar";
import { SidebarProvider } from "@/components/app/sidebar-state";
import { Topbar } from "@/components/app/topbar";
import { getSummary } from "@/lib/api/assets";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SIDEBAR_COOKIE } from "@/lib/config";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [summary, cookieStore] = await Promise.all([getSummary(), cookies()]);
  // อ่านจาก cookie ฝั่ง server เพื่อไม่ให้ sidebar กระพริบเปิดแล้วปิดตอนโหลดหน้า
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE)?.value !== "closed";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <div className="flex min-h-screen flex-1">
        <Sidebar user={user} summary={summary} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar userName={user.display_name} avatarUrl={user.avatar_url} />
          <main className="flex-1 px-4 py-8 sm:px-8">
            {!user.has_password && <PasswordBanner />}
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}