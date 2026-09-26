import type { Metadata } from "next";
import Link from "next/link";
import { AssetCard } from "@/components/assets/asset-card";
import { UploadIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { listAssets } from "@/lib/api/assets";
import { readSession } from "@/lib/auth/session";
import type { FileType } from "@/lib/types";

export const metadata: Metadata = { title: "Asset ทั้งหมด — AssetHub" };

const types: Record<string, { value: FileType; title: string }> = {
  image: { value: "IMAGE", title: "รูปภาพ" },
  document: { value: "DOCUMENT", title: "เอกสาร" },
  video: { value: "VIDEO", title: "วิดีโอ" },
};

export default async function AssetsPage({ searchParams }: PageProps<"/assets">) {
  const { type } = await searchParams;
  const filter = typeof type === "string" ? types[type] : undefined;
  const [session, assets] = await Promise.all([readSession(), listAssets({ type: filter?.value })]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{filter?.title ?? "Asset ทั้งหมด"}</h1>
          <p className="mt-1 text-ink-muted">{assets.length} ไฟล์</p>
        </div>
        <Link href="/upload" className="flex h-12 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-hover">
          <UploadIcon className="size-5" />
          อัปโหลด Asset
        </Link>
      </div>

      {assets.length === 0 ? (
        <EmptyState>
          ยังไม่มี Asset —{" "}
          <Link href="/upload" className="font-semibold text-brand hover:text-brand-hover">
            อัปโหลดไฟล์แรก
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} meName={session!.name} />
          ))}
        </div>
      )}
    </div>
  );
}
