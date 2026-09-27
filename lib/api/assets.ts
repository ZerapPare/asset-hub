import { STORAGE_QUOTA } from "@/lib/config";
import { getAssetTotals } from "@/lib/dashboard";
import type { Asset, FileType, Summary } from "@/lib/types";

// TODO: ตัวเลขอื่นยังไม่ได้ดึงจาก DB (storage ดึงแล้ว)
export async function getSummary(userId: string): Promise<Summary> {
  const { storageUsed, byType } = await getAssetTotals(userId);
  return {
    totalAssets: 0,
    documents: 0,
    images: 0,
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
