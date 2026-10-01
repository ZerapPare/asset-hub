"use client";

import Link from "next/link";
import { useState } from "react";
import { fileTypeMeta } from "@/components/assets/file-type";
import { ChevronRightIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { formatShortDate } from "@/lib/format";
import type { FileType, TagSummary } from "@/lib/types";
import { TypeBar, typeLabels } from "./type-bar";

type Sort = "used" | "name" | "recent";

const sorts: Record<Sort, { label: string; compare: (a: TagSummary, b: TagSummary) => number }> = {
  used: { label: "ใช้มากที่สุด", compare: (a, b) => total(b) - total(a) || a.name.localeCompare(b.name) },
  name: { label: "ชื่อ A–Z", compare: (a, b) => a.name.localeCompare(b.name) },
  recent: { label: "ไฟล์ล่าสุด", compare: (a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") },
};

function total(t: TagSummary) {
  return t.documents + t.images;
}

const tagHref = (name: string) => `/assets?tag=${encodeURIComponent(name)}`;

export function TagTable({ tags }: { tags: TagSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("used");
  const q = query.trim().toLowerCase();
  const shown = tags.filter((t) => t.name.includes(q)).sort(sorts[sort].compare);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput label="ค้นหา Tag" value={query} onChange={setQuery} className="w-full max-w-sm" />
        <label className="flex h-12 items-center gap-1 rounded-xl border border-brand/30 bg-brand-soft/50 pl-4 pr-2 font-semibold text-brand-ink focus-within:ring-4 focus-within:ring-brand/15">
          เรียงตาม:
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="cursor-pointer bg-transparent py-2 pr-1 font-semibold outline-none"
          >
            {(Object.keys(sorts) as Sort[]).map((key) => (
              <option key={key} value={key}>
                {sorts[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tags.length === 0 ? (
        <EmptyState>ยังไม่มี Tag ในระบบ — ให้ผู้ดูแลเพิ่มผ่าน migration</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>ไม่พบ Tag ที่ตรงกับ “{query.trim()}”</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-left">
            <thead className="border-b border-line text-sm text-ink-muted">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">Tag</th>
                <th scope="col" className="px-4 py-4 font-semibold">Asset</th>
                <th scope="col" className="px-4 py-4 font-semibold">
                  <span className="flex items-center gap-3">
                    {(Object.keys(typeLabels) as FileType[]).map((type) => (
                      <span key={type} className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-sm ${fileTypeMeta[type].swatch}`} aria-hidden="true" />
                        {typeLabels[type]}
                      </span>
                    ))}
                  </span>
                </th>
                <th scope="col" className="px-4 py-4 font-semibold">ไฟล์ล่าสุด</th>
                <th scope="col" className="px-6 py-4"><span className="sr-only">ดู Asset</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {shown.map((tag) => {
                const count = total(tag);
                return (
                  <tr key={tag.id} className="hover:bg-canvas/60">
                    <td className="px-6 py-4">
                      <Link href={tagHref(tag.name)} className="inline-flex rounded-full bg-canvas px-3.5 py-1.5 font-medium hover:bg-brand-soft hover:text-brand-ink">
                        {tag.name}
                      </Link>
                    </td>
                    <td className={`px-4 py-4 font-semibold tabular-nums ${count ? "" : "text-ink-subtle"}`}>{count}</td>
                    <td className="px-4 py-4">
                      <TypeBar counts={{ DOCUMENT: tag.documents, IMAGE: tag.images }} />
                    </td>
                    <td className="px-4 py-4 text-ink-muted">{tag.lastUsedAt ? formatShortDate(tag.lastUsedAt) : "—"}</td>
                    <td className="px-6 py-4 text-right">
                      {count ? (
                        <Link href={tagHref(tag.name)} className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-hover">
                          ดู Asset
                          <ChevronRightIcon className="size-4" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-ink-subtle">
                          ดู Asset
                          <ChevronRightIcon className="size-4" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
