import Link from "next/link";
import { AssetThumb } from "@/components/assets/asset-thumb";
import { FolderIcon } from "@/components/icons";
import { formatShortDate } from "@/lib/format";
import type { Collection } from "@/lib/types";

export function CollectionCard({ collection }: { collection: Collection }) {
  const [first, second, third] = collection.previews;

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group rounded-3xl border border-line bg-surface p-2.5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
    >
      <div className="grid aspect-[16/9] grid-cols-[3fr_2fr] gap-2">
        {first ? <AssetThumb asset={first} className="rounded-2xl" /> : <div className="rounded-2xl bg-canvas" />}
        <div className="grid grid-rows-2 gap-2">
          {[second, third].map((asset, i) =>
            asset ? (
              <AssetThumb key={asset.id} asset={asset} className="rounded-2xl" />
            ) : (
              <div key={i} className="rounded-2xl bg-canvas" />
            ),
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 px-2 pb-2 pt-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: collection.color }}
        >
          <FolderIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold group-hover:text-brand-ink">{collection.name}</p>
          <p className="text-sm text-ink-muted">
            {collection.assetCount} ไฟล์ · อัปเดต {formatShortDate(collection.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}
