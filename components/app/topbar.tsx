"use client";

import Link from "next/link";
import { Suspense } from "react";
import { UploadIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { UploadLink } from "@/components/upload/upload-link";
import { SidebarToggle } from "./sidebar-state";
import { TopbarSearch, TopbarSearchFallback } from "./topbar-search";

export function Topbar({ userName, avatarUrl }: { userName: string; avatarUrl: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <SidebarToggle />

        <Suspense fallback={<TopbarSearchFallback />}>
          <TopbarSearch />
        </Suspense>

        <UploadLink className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white transition hover:bg-brand-hover">
          <UploadIcon className="size-5" />
          <span className="hidden sm:inline">อัปโหลด</span>
        </UploadLink>

        <Link href="/settings" aria-label="ตั้งค่าบัญชี" className="hidden shrink-0 sm:block">
          <Avatar name={userName} src={avatarUrl} size="lg" />
        </Link>
      </div>
    </header>
  );
}
