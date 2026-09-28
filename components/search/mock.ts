import type { FilterOption, SearchFilters, SearchMode, SearchResult } from "./types";

// TODO: ข้อมูลตัวอย่างสำหรับทำ UI — แทนด้วย searchAssets() / semantic search เมื่อเชื่อม logic

const me = { name: "Alice Marketing", isMe: true };
const bob = { name: "Bob Designer" };
const carol = { name: "Carol IT" };

export const MOCK_KEYWORD_RESULTS: SearchResult[] = [
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
    matchedIn: ["name", "tag"],
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
    tags: ["marketing", "report"],
    matchedIn: ["tag", "collection"],
  },
  {
    asset: {
      id: "22222222-2222-2222-2222-000000000012",
      name: "คู่มือพนักงานใหม่",
      fileType: "DOCUMENT",
      extension: "PDF",
      size: 1572864,
      status: "READY",
      owner: bob,
      createdAt: "2026-06-29T09:00:00Z",
    },
    tags: ["hr"],
    matchedIn: ["content"],
    snippet: "…คู่มือพนักงานใหม่ อธิบายสวัสดิการ วันลาพักร้อน 10 วันต่อปี และการเบิกค่ารักษาพยาบาล…",
  },
  {
    asset: {
      id: "22222222-2222-2222-2222-000000000008",
      name: "Team Outing",
      fileType: "IMAGE",
      extension: "JPG",
      size: 4194304,
      status: "PROCESSING",
      owner: me,
      createdAt: "2026-09-27T09:00:00Z",
    },
    tags: [],
    matchedIn: ["name"],
  },
];

export const MOCK_SEMANTIC_RESULTS: SearchResult[] = [
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

// Collection ที่ผู้ใช้เป็นสมาชิก และ Tag ทั้งหมด
export const MOCK_COLLECTION_OPTIONS: FilterOption[] = [
  { value: "33333333-3333-3333-3333-000000000001", label: "Project Phoenix" },
  { value: "33333333-3333-3333-3333-000000000002", label: "Design Team" },
];

export const MOCK_TAG_OPTIONS: FilterOption[] = ["design", "hr", "marketing", "meeting", "report", "security"].map(
  (name) => ({ value: name, label: name }),
);

// กรองข้อมูลตัวอย่างแบบง่ายๆ ให้ดูหน้าตาแต่ละสถานะได้
// (ไม่ได้ค้นตามคำค้นจริง — ใส่คำค้น "zzz" เพื่อดูหน้า "ไม่พบผลลัพธ์")
export function mockSearch(q: string, mode: SearchMode, type: string, filters: SearchFilters): SearchResult[] {
  if (!q || q.toLowerCase().includes("zzz")) return [];
  return (mode === "semantic" ? MOCK_SEMANTIC_RESULTS : MOCK_KEYWORD_RESULTS).filter(
    ({ asset, tags }) =>
      (!type || asset.fileType === (type === "image" ? "IMAGE" : "DOCUMENT")) &&
      (filters.owner !== "me" || asset.owner.isMe) &&
      (!filters.tag || tags.includes(filters.tag)),
  );
}
