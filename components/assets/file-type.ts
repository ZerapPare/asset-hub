import { FileIcon, ImageIcon, VideoIcon } from "@/components/icons";
import type { FileType } from "@/lib/types";

export const fileTypeMeta = {
  DOCUMENT: { Icon: FileIcon, tint: "bg-tint-doc text-series-doc", swatch: "bg-series-doc" },
  IMAGE: { Icon: ImageIcon, tint: "bg-tint-img text-series-img", swatch: "bg-series-img" },
  VIDEO: { Icon: VideoIcon, tint: "bg-line-soft text-ink-muted", swatch: "bg-ink-muted" },
} satisfies Record<FileType, unknown>;
