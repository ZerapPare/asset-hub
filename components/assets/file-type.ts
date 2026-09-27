import { FileIcon, ImageIcon } from "@/components/icons";
import type { FileType } from "@/lib/types";

export const fileTypeMeta = {
  DOCUMENT: { Icon: FileIcon, tint: "bg-tint-doc text-series-doc", swatch: "bg-series-doc" },
  IMAGE: { Icon: ImageIcon, tint: "bg-tint-img text-series-img", swatch: "bg-series-img" },} satisfies Record<FileType, unknown>;
