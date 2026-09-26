import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatBytes, formatShortDate } from "@/lib/format";
import type { Asset } from "@/lib/types";
import { AssetThumb } from "./asset-thumb";
import { fileTypeMeta } from "./file-type";
import { StatusBadge } from "./status-badge";

export function AssetCard({ asset, meName }: { asset: Asset; meName: string }) {
  const ownerName = asset.owner.isMe ? meName : asset.owner.name;
  const typeColor = fileTypeMeta[asset.fileType].swatch;

  return (
    <Link
      href={`/assets/${asset.id}`}
      className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
    >
      <div className="relative">
        <AssetThumb asset={asset} className="aspect-[16/7]" />
        <span className="absolute right-3 top-3">
          <StatusBadge status={asset.status} solid />
        </span>
        <span className={`absolute bottom-3 left-3 rounded-md px-2 py-0.5 text-xs font-bold text-white ${asset.fileType === "DOCUMENT" ? "bg-danger" : "bg-ink"}`}>
          {asset.extension}
        </span>
      </div>
      <div className="space-y-1.5 px-4 py-3.5">
        <p className="truncate font-semibold group-hover:text-brand-ink">{asset.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <span className={`size-2 rounded-sm ${typeColor}`} aria-hidden="true" />
          {asset.extension} · {formatBytes(asset.size)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Avatar name={ownerName} />
          <span className="truncate font-medium text-ink">{asset.owner.isMe ? "คุณ" : ownerName}</span>
          · {formatShortDate(asset.createdAt)}
        </p>
      </div>
    </Link>
  );
}
