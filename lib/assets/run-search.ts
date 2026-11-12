import { SearchTimeoutError, searchAssets, type AssetFilterOptions, type SearchResult, type SearchSort } from "@/lib/assets/search";
import { semanticSearch, type SemanticSort } from "@/lib/assets/semantic";

export type SearchOutcome = {
  results: SearchResult[];
  /** Keyword ค้นเกินเวลา */
  timedOut: boolean;
  /** Semantic ใช้ไม่ได้ เลยแสดงผล Keyword แทน */
  fellBack: boolean;
};

/**
 * ค้นแบบ Keyword หรือ Semantic ตามโหมด ใช้ร่วมกันทั้งหน้า Asset และหน้า Collection
 * - Keyword เกินเวลา → timedOut (ไม่ throw)
 * - Semantic ล้ม (Bedrock ล้ม/ช้า, SQL เกินเวลา) → ใช้ผล Keyword แทน ไม่ให้ทั้งหน้า error
 * sort ต้องผ่านการตรวจกับรายการที่โหมดนั้นรองรับมาแล้ว ("newest" ใช้ได้ทั้งสองโหมด)
 */
export async function runSearch(
  userId: string,
  q: string,
  mode: "keyword" | "semantic",
  options: AssetFilterOptions,
  sort?: SearchSort | SemanticSort,
): Promise<SearchOutcome> {
  const keyword = async (fellBack: boolean): Promise<SearchOutcome> => {
    try {
      return { results: await searchAssets(userId, q, { ...options, sort }), timedOut: false, fellBack };
    } catch (error) {
      if (!(error instanceof SearchTimeoutError)) throw error;
      return { results: [], timedOut: true, fellBack };
    }
  };

  if (mode === "keyword") return keyword(false);
  try {
    return { results: await semanticSearch(userId, q, { ...options, sort: sort as SemanticSort | undefined }), timedOut: false, fellBack: false };
  } catch (error) {
    console.error("[semantic] falling back to keyword search:", error);
    return keyword(true);
  }
}
