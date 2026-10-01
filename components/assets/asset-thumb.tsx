"use client";

import { useState } from "react";
import type { Asset } from "@/lib/types";
import { fileTypeMeta } from "./file-type";

export function AssetThumb({ asset, className = "" }: { asset: Asset; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { Icon, tint } = fileTypeMeta[asset.fileType];

  return (
    <div className={`flex items-center justify-center overflow-hidden ${tint} ${className}`}>
      {failed ? (
        <Icon className="size-8 opacity-70" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/assets/${asset.id}/thumbnail`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
