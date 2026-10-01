import type { FilterOption } from "./types";

// ใช้ทั้ง server (chip) และ client (panel) — ห้ามย้ายไปไว้ในไฟล์ "use client"
// เพราะ server import ค่าจากไฟล์นั้นจะได้ client reference แทนค่าจริง

export const UPLOADED_OPTIONS: FilterOption[] = [
  { value: "", label: "ทุกช่วงเวลา" },
  { value: "7d", label: "7 วันล่าสุด" },
  { value: "30d", label: "30 วันล่าสุด" },
  { value: "year", label: "ปีนี้" },
  { value: "custom", label: "กำหนดเอง" },
];

export const OWNER_OPTIONS: FilterOption[] = [
  { value: "", label: "ทุกคน" },
  { value: "me", label: "ของฉัน" },
];
