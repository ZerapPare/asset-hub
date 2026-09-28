import { STORAGE_QUOTA } from "@/lib/config";
import { getAssetTotals } from "@/lib/assets/stats";
import type { Asset, FileType, Summary } from "@/lib/types";

// TODO: Collection และ Tag ยังไม่ได้ดึงจาก DB
export async function getSummary(userId: string): Promise<Summary> {
  const { totalAssets, storageUsed, byType } = await getAssetTotals(userId);
  return {
    totalAssets,
    documents: byType.DOCUMENT.count,
    images: byType.IMAGE.count,
    collections: [],
    tags: 0,
    storage: {
      used: storageUsed,
      documents: byType.DOCUMENT.bytes,
      images: byType.IMAGE.bytes,
      quota: STORAGE_QUOTA,
    },
  };
}

// TODO: GET /api/assets
export async function listAssets(filters: { type?: FileType }): Promise<Asset[]> {
  void filters;
  return [];
}
