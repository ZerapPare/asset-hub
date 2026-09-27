"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import type { Collection } from "@/lib/types";
import { CollectionCard } from "./collection-card";

export function CollectionGrid({ collections }: { collections: Collection[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? collections.filter((c) => c.name.toLowerCase().includes(q)) : collections;

  return (
    <div className="space-y-6">
      <SearchInput label="ค้นหา Collection" value={query} onChange={setQuery} className="max-w-sm" />

      {collections.length === 0 ? (
        <EmptyState>
          ยังไม่มี Collection —{" "}
          <Link href="/collections/new" className="font-semibold text-brand hover:text-brand-hover">
            สร้าง Collection แรก
          </Link>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>ไม่พบ Collection ที่ตรงกับ “{query.trim()}”</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      )}
    </div>
  );
}
