"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Props = { href: string; icon: ReactNode; label: string; count?: number };

export function NavLink({ href, icon, label, count }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = new URL(href, "http://x");
  const active =
    pathname === url.pathname && searchParams.get("type") === url.searchParams.get("type");

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
        active ? "bg-brand-soft text-brand-ink" : "text-ink-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      <span className="size-5 shrink-0 [&>svg]:size-5">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-sm tabular-nums">{count}</span>}
    </Link>
  );
}
