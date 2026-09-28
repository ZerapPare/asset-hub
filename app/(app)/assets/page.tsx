import type { Metadata } from "next";
import { AssetCard } from "@/components/assets/asset-card";
import { UploadIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadLink } from "@/components/upload/upload-link";
import { listAssets } from "@/lib/api/assets";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { FileType } from "@/lib/types";

export const metadata: Metadata = { title: "Asset ทั้งหมด — AssetHub" };

const types: Record<string, { value: FileType; title: string }> = {
  image: { value: "IMAGE", title: "รูปภาพ" },
  document: { value: "DOCUMENT", title: "เอกสาร" },
};

export default async function AssetsPage({ searchParams }: PageProps<"/assets">) {
  const { type } = await searchParams;
  const filter = typeof type === "string" ? types[type] : undefined;
  const user = (await getCurrentUser())!;
  const assets = await listAssets(user.user_id, { type: filter?.value });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{filter?.title ?? "Asset ทั้งหมด"}</h1>
          <p className="mt-1 text-ink-muted">{assets.length} ไฟล์</p>
        </div>
        <UploadLink className="flex h-12 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-hover">
          <UploadIcon className="size-5" />
          อัปโหลด Asset
        </UploadLink>
      </div>

      {assets.length === 0 ? (
        <EmptyState>
          ยังไม่มี Asset —{" "}
          <UploadLink className="font-semibold text-brand hover:text-brand-hover">
            อัปโหลดไฟล์แรก
          </UploadLink>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} meName={user.display_name} />
          ))}
        </div>
      )}
    </div>
  );
}
