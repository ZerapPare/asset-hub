import type { Asset } from "@/lib/types";

export type SearchMode = "keyword" | "semantic";
export type SearchView = "list" | "grid";

// ส่วนที่คำค้นไปตรง (Keyword Search) — Semantic Search ไม่มี เพราะเทียบจากความหมาย
export type MatchSource = "name" | "tag" | "collection" | "description" | "content";

export type SearchResult = {
  asset: Asset;
  tags: string[];
  matchedIn: MatchSource[];
  /** ข้อความช่วงที่เกี่ยวข้องจากเนื้อหาเอกสาร */
  snippet?: string;
};

export type FilterOption = { value: string; label: string };

/** ค่าตัวกรองใน panel (เก็บใน URL) */
export type SearchFilters = {
  uploaded: string;
  owner: string;
  collection: string;
  tag: string;
};
