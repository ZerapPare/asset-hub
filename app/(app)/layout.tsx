import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { getSummary } from "@/lib/api/assets";
import { readSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await readSession();
  if (!session) redirect("/login");
  const summary = await getSummary();

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar session={session} summary={summary} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={session.name} />
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
