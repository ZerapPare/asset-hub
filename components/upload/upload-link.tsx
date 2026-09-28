"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

// เปิดหน้าต่าง Upload บนหน้าปัจจุบัน (?upload=1)
export function UploadLink({ className, children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams());
  params.set("upload", "1");

  return (
    <Link href={`${pathname}?${params}`} scroll={false} className={className}>
      {children}
    </Link>
  );
}
