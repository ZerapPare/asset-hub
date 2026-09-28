export type { MatchSource, SearchResult } from "@/lib/assets/search";

export type SearchMode = "keyword" | "semantic";
export type SearchView = "list" | "grid";

export type FilterOption = { value: string; label: string };

/** ค่าตัวกรองใน panel (เก็บใน URL) */
export type SearchFilters = {
  uploaded: string;
  owner: string;
  collection: string;
  tag: string;
};
