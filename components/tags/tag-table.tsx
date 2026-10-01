"use client";

import Link from "next/link";
import { useState } from "react";
import { fileTypeMeta } from "@/components/assets/file-type";
import { ChevronRightIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { formatShortDate } from "@/lib/format";
import type { FileType, TagSummary } from "@/lib/types";
import { TypeBar, typeLabels } from "./type-bar";

type Sort = "used" | "name" | "recent";

const sorts: Record<Sort, { label: string; compare: (a: TagSummary, b: TagSummary) => number }> = {
  used: { label: "ใช้มากที่สุด", compare: (a, b) => total(b) - total(a) },
  name: { label: "ชื่อ A–Z", compare: (a, b) => a.name.localeCompare(b.name, "th") },
  recent: { label: "ใช้ล่าสุด", compare: (a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") },
};

function total(t: TagSummary) {
  return t.documents + t.images;
}

export function TagTable({ tags, meName }: { tags: TagSummary[]; meName: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("used");
  const q = query.trim().toLowerCase();
  const shown = tags.filter((t) => t.name.toLowerCase().includes(q)).sort(sorts[sort].compare);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput label="ค้นหา Tag" value={query} onChange={setQuery} className="w-full max-w-sm" />
        <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          เรียงตาม
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-12 rounded-xl border border-line bg-surface px-3 font-semibold text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
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
        <EmptyState>ยังไม่มี Tag ในระบบ</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>ไม่พบ Tag ที่ตรงกับ “{query.trim()}”</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-left">
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
                <th scope="col" className="px-4 py-4 font-semibold">สร้างโดย</th>
                <th scope="col" className="px-4 py-4 font-semibold">ใช้ล่าสุด</th>
                <th scope="col" className="px-6 py-4"><span className="sr-only">ดู Asset</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {shown.map((tag) => {
                const creator = tag.createdBy.isMe ? meName : tag.createdBy.name;
                return (
                  <tr key={tag.id} className="hover:bg-canvas/60">
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-canvas px-3.5 py-1.5 font-medium">{tag.name}</span>
                    </td>
                    <td className="px-4 py-4 font-semibold tabular-nums">{total(tag)}</td>
                    <td className="px-4 py-4">
                      <TypeBar counts={{ DOCUMENT: tag.documents, IMAGE: tag.images }} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-2 font-medium">
                        <Avatar name={creator} />
                        {tag.createdBy.isMe ? "คุณ" : creator}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink-muted">{tag.lastUsedAt ? formatShortDate(tag.lastUsedAt) : "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/assets?tag=${encodeURIComponent(tag.name)}`}
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-hover"
                      >
                        ดู Asset
                        <ChevronRightIcon className="size-4" />
                      </Link>
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
