"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { BellIcon, SearchIcon, SparkleIcon, UploadIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";

type Mode = "keyword" | "semantic";

const modes: { value: Mode; label: string; Icon: typeof SearchIcon }[] = [
  { value: "keyword", label: "Keyword", Icon: SearchIcon },
  { value: "semantic", label: "Semantic", Icon: SparkleIcon },
];

export function Topbar({ userName }: { userName: string }) {
  const [mode, setMode] = useState<Mode>("keyword");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <Link href="/assets" className="lg:hidden">
          <span className="sr-only">AssetHub</span>
          <Logo compact />
        </Link>

        <form action="/search" role="search" className="flex min-w-0 flex-1 items-center gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">ค้นหา</span>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-subtle" />
            <input
              name="q"
              type="search"
              placeholder={mode === "semantic" ? "อธิบายสิ่งที่ต้องการ เช่น รูปทีมงานกำลังประชุม" : "ค้นหาชื่อไฟล์ หรือ Tag"}
              className="h-12 w-full rounded-xl border border-line bg-canvas pl-12 pr-4 text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15"
            />
          </label>
          <input type="hidden" name="mode" value={mode} />

          <div role="group" aria-label="โหมดการค้นหา" className="hidden shrink-0 rounded-xl bg-canvas p-1 md:flex">
            {modes.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === value ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </form>

        <Link
          href="/upload"
          className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white transition hover:bg-brand-hover"
        >
          <UploadIcon className="size-5" />
          <span className="hidden sm:inline">อัปโหลด</span>
        </Link>

        <button
          type="button"
          aria-label="การแจ้งเตือน"
          className="hidden size-12 shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted hover:text-ink sm:flex"
        >
          <BellIcon className="size-5" />
        </button>

        <Link href="/settings" aria-label="ตั้งค่าบัญชี" className="hidden shrink-0 sm:block">
          <Avatar name={userName} size="lg" />
        </Link>
      </div>
    </header>
  );
}
