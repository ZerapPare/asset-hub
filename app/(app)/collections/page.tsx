import type { Metadata } from "next";
import Link from "next/link";
import { CollectionGrid } from "@/components/collections/collection-grid";
import { FolderPlusIcon } from "@/components/icons";
import { listCollections } from "@/lib/api/collections";

export const metadata: Metadata = { title: "Collection — AssetHub" };

export default async function CollectionsPage() {
  const collections = await listCollections();

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collection</h1>
          <p className="mt-1 text-ink-muted">
            {collections.length} Collection · Asset หนึ่งไฟล์อยู่ได้หลาย Collection
          </p>
        </div>
        <Link href="/collections/new" className="flex h-12 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-hover">
          <FolderPlusIcon className="size-5" />
          สร้าง Collection
        </Link>
      </div>

      <CollectionGrid collections={collections} />
    </div>
  );
}
