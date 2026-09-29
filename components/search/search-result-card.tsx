import Link from "next/link";
import { AssetThumb } from "@/components/assets/asset-thumb";
import { fileTypeMeta } from "@/components/assets/file-type";
import { LiveStatusBadge } from "@/components/assets/live-status";
import { Avatar } from "@/components/ui/avatar";
import { formatBytes, formatShortDate } from "@/lib/format";
import { Highlight } from "./highlight";
import type { MatchSource, SearchResult, SearchView } from "./types";

const matchLabel: Record<MatchSource, string> = {
  name: "ชื่อไฟล์",
  tag: "Tag",
  collection: "Collection",
  description: "คำอธิบาย",
  content: "เนื้อหาในเอกสาร",
};

const GRID_TAG_LIMIT = 3;

// List และ Grid ใช้ข้อมูลชุดเดียวกัน ต่างกันแค่การจัดวาง
export function SearchResultCard({
  result,
  query,
  layout: view = "list",
}: {
  result: SearchResult;
  query: string;
  layout?: SearchView;
}) {
  const { asset, tags, matchedIn, snippet } = result;
  const grid = view === "grid";
  const shownTags = grid ? tags.slice(0, GRID_TAG_LIMIT) : tags;
  // แสดงเฉพาะสถานะที่ผิดปกติ (Processing / Failed) — Ready ไม่ต้องบอก
  const status = asset.status !== "READY" && (
    <LiveStatusBadge assetId={asset.id} status={asset.status} solid={grid} hideWhenReady />
  );

  const title = (
    <h3 className={`min-w-0 font-semibold ${grid ? "truncate" : "break-words"}`}>
      {/* ลิงก์ครอบทั้งการ์ด */}
      <Link href={`/assets/${asset.id}`} className="after:absolute after:inset-0 group-hover:text-brand-ink focus-visible:outline-none">
        <Highlight text={asset.name} query={query} />
      </Link>
    </h3>
  );

  // metadata จัดแบบเดียวกับ AssetCard (หน้า Asset ทั้งหมด)
  const details = (
    <>
      <div className="space-y-1.5 text-sm text-ink-muted">
        <p className="flex items-center gap-1.5">
          <span className={`size-2 rounded-sm ${fileTypeMeta[asset.fileType].swatch}`} aria-hidden="true" />
          {asset.extension} · {formatBytes(asset.size)}
        </p>
        <p className="flex items-center gap-1.5">
          <Avatar name={asset.owner.name} />
          <span className="truncate font-medium text-ink">{asset.owner.isMe ? "คุณ" : asset.owner.name}</span>·{" "}
          {formatShortDate(asset.createdAt)}
        </p>
      </div>

      {snippet && (
        // line-clamp อยู่ใน span ไม่ใช่กล่องที่มี padding — ไม่งั้นบรรทัดที่ 3 จะโผล่ในส่วน padding
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm leading-relaxed text-ink-muted">
          <span className="line-clamp-2">
            <Highlight text={snippet} query={query} />
          </span>
        </p>
      )}

      {(shownTags.length > 0 || matchedIn.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {shownTags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tag">
              {shownTags.map((tag) => (
                <li key={tag} className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted">
                  {tag}
                </li>
              ))}
              {tags.length > shownTags.length && (
                <li className="px-1 py-0.5 text-xs text-ink-subtle">+{tags.length - shownTags.length}</li>
              )}
            </ul>
          )}
          {matchedIn.length > 0 && (
            <p className="text-xs text-ink-subtle">พบใน: {matchedIn.map((m) => matchLabel[m]).join(" · ")}</p>
          )}
        </div>
      )}
    </>
  );

  if (grid) {
    return (
      <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-4 focus-within:ring-brand/20">
        <div className="relative">
          <AssetThumb asset={asset} className="aspect-[16/7]" />
          {status && <span className="absolute right-3 top-3">{status}</span>}
          <span
            className={`absolute bottom-3 left-3 rounded-md px-2 py-0.5 text-xs font-bold text-white ${
              asset.fileType === "DOCUMENT" ? "bg-danger" : "bg-ink"
            }`}
          >
            {asset.extension}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
          {title}
          {details}
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md focus-within:ring-4 focus-within:ring-brand/20">
      <AssetThumb asset={asset} className="size-16 shrink-0 rounded-xl sm:size-20" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          {title}
          {status}
        </div>
        {details}
      </div>
    </article>
  );
}
