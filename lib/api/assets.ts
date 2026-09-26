import { STORAGE_QUOTA } from "@/lib/config";
import type { Asset, FileType, Summary } from "@/lib/types";

// TODO: ดึงจาก DB
export async function getSummary(): Promise<Summary> {
  return {
    totalAssets: 0,
    documents: 0,
    images: 0,
    videos: 0,
    collections: [],
    tags: 0,
    storage: { used: 0, documents: 0, images: 0, quota: STORAGE_QUOTA },
  };
}

// TODO: GET /api/assets
export async function listAssets(filters: { type?: FileType }): Promise<Asset[]> {
  void filters;
  return [];
}
