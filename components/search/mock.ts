import type { SearchFilters, SearchResult } from "./types";

// TODO: ข้อมูลตัวอย่างของ Semantic Search — แทนด้วย query pgvector เมื่อทำ Processing + Bedrock
// (Keyword Search ใช้ searchAssets() จริงแล้ว)

const me = { name: "Alice Marketing", isMe: true };
const carol = { name: "Carol IT" };

const MOCK_SEMANTIC_RESULTS: SearchResult[] = [
  {
    asset: {
      id: "22222222-2222-2222-2222-000000000001",
      name: "รายงานประจำปี 2025",
      fileType: "DOCUMENT",
      extension: "PDF",
      size: 2457600,
      status: "READY",
      owner: me,
      createdAt: "2026-08-18T09:00:00Z",
    },
    tags: ["report", "รายงาน"],
    matchedIn: [],
    snippet: "…รายได้รวมเติบโตขึ้น 12% จากปีก่อน โดยมาจากลูกค้ากลุ่มองค์กรเป็นหลัก…",
  },
  {
    asset: {
      id: "22222222-2222-2222-2222-000000000002",
      name: "Q3 Marketing Plan",
      fileType: "DOCUMENT",
      extension: "PDF",
      size: 1048576,
      status: "READY",
      owner: me,
      createdAt: "2026-08-28T09:00:00Z",
    },
    tags: ["marketing"],
    matchedIn: [],
    snippet: "…Key metrics: website traffic, qualified leads, and conversion rate from free trial to paid plan…",
  },
  {
    asset: {
      id: "22222222-2222-2222-2222-000000000007",
      name: "ประชุมทีมในออฟฟิศ",
      fileType: "IMAGE",
      extension: "JPG",
      size: 3355443,
      status: "READY",
      owner: me,
      createdAt: "2026-09-20T09:00:00Z",
    },
    tags: ["meeting", "ประชุม"],
    matchedIn: [],
  },
  {
    asset: {
      id: "22222222-2222-2222-2222-000000000017",
      name: "ห้องเซิร์ฟเวอร์",
      fileType: "IMAGE",
      extension: "JPG",
      size: 2621440,
      status: "READY",
      owner: carol,
      createdAt: "2026-09-02T09:00:00Z",
    },
    tags: ["security"],
    matchedIn: [],
  },
];

// กรองข้อมูลตัวอย่างแบบง่ายๆ ให้ดูหน้าตาได้ (ไม่ได้ค้นตามความหมายจริง)
export function mockSemanticSearch(q: string, type: string, filters: SearchFilters): SearchResult[] {
  if (!q) return [];
  return MOCK_SEMANTIC_RESULTS.filter(
    ({ asset, tags }) =>
      (!type || asset.fileType === (type === "image" ? "IMAGE" : "DOCUMENT")) &&
      (filters.owner !== "me" || asset.owner.isMe) &&
      (!filters.tag || tags.includes(filters.tag)),
  );
}
