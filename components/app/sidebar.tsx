import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { StorageBar } from "@/components/charts/storage-bar";
import {
  DriveIcon,
  FileIcon,
  FolderIcon,
  GridIcon,
  ImageIcon,
  LayersIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
  VideoIcon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import type { Session } from "@/lib/auth/session";
import { formatBytes } from "@/lib/format";
import type { Summary } from "@/lib/types";
import { NavLink } from "./nav-link";

export function Sidebar({ session, summary }: { session: Session; summary: Summary }) {
  const { storage, collections } = summary;
  const nav = [
    // หน้า Dashboard เป็นงานคนที่ 2
    { href: "/dashboard", label: "แดชบอร์ด", icon: <GridIcon /> },
    { href: "/assets", label: "Asset ทั้งหมด", icon: <LayersIcon />, count: summary.totalAssets },
    { href: "/assets?type=image", label: "รูปภาพ", icon: <ImageIcon />, count: summary.images },
    { href: "/assets?type=document", label: "เอกสาร", icon: <FileIcon />, count: summary.documents },
    { href: "/assets?type=video", label: "วิดีโอ", icon: <VideoIcon />, count: summary.videos },
    { href: "/collections", label: "Collection", icon: <FolderIcon />, count: collections.length },
    { href: "/tags", label: "Tag", icon: <TagIcon />, count: summary.tags },
    { href: "/search", label: "ค้นหา", icon: <SearchIcon /> },
  ];
  const usedPct = Math.round((storage.used / storage.quota) * 100);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link href="/assets" className="px-2">
        <Logo />
      </Link>

      <nav aria-label="เมนูหลัก" className="mt-8 space-y-1">
        <Suspense>
          {nav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </Suspense>
      </nav>

      <section aria-labelledby="sidebar-collections" className="mt-8">
        <div className="flex items-center justify-between px-3">
          <h2 id="sidebar-collections" className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Collections
          </h2>
          <Link href="/collections/new" aria-label="สร้าง Collection" className="rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink">
            <PlusIcon className="size-4" />
          </Link>
        </div>
        {collections.length === 0 && <p className="px-3 py-2 text-sm text-ink-subtle">ยังไม่มี Collection</p>}
        <ul className="mt-2 space-y-0.5">
          {collections.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-ink-muted hover:bg-canvas hover:text-ink">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} aria-hidden="true" />
                <span className="truncate">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto space-y-4 pt-8">
        <div className="rounded-2xl bg-canvas p-4">
          <div className="flex items-center gap-2">
            <DriveIcon className="size-5" />
            <span className="flex-1 font-semibold">พื้นที่จัดเก็บ</span>
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{usedPct}%</span>
          </div>
          <StorageBar {...storage} className="mt-3 h-1.5" />
          <p className="mt-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{formatBytes(storage.used)}</span> จาก {formatBytes(storage.quota)}
          </p>
        </div>

        <div className="flex items-center gap-3 border-b border-line-soft px-2 pb-4">
          <Avatar name={session.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{session.name}</p>
            <p className="truncate text-sm text-ink-muted">{session.email}</p>
          </div>
        </div>

        <div className="space-y-1">
          <NavLinkPlain href="/settings" icon={<SettingsIcon className="size-5" />} label="ตั้งค่าบัญชี" />
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-ink-muted hover:bg-canvas hover:text-ink">
              <LogoutIcon className="size-5" />
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function NavLinkPlain({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-ink-muted hover:bg-canvas hover:text-ink">
      {icon}
      {label}
    </Link>
  );
}
