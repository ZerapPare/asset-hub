import type { Asset } from "@/lib/types";
import { fileTypeMeta } from "./file-type";

// TODO: placeholder รอ thumbnail จริงจาก S3
export function AssetThumb({ asset, className = "" }: { asset: Asset; className?: string }) {
  const { Icon, tint } = fileTypeMeta[asset.fileType];

  return (
    <div className={`flex items-center justify-center ${tint} ${className}`}>
      <Icon className="size-8 opacity-70" />
    </div>
  );
}
