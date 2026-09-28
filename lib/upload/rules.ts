import type { FileType } from "@/lib/types";

// ใช้ร่วมกันทั้งหน้าเว็บและ server
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, { fileType: FileType; extensions: string[] }> = {
  "application/pdf": { fileType: "DOCUMENT", extensions: ["pdf"] },
  "image/jpeg": { fileType: "IMAGE", extensions: ["jpg", "jpeg"] },
  "image/png": { fileType: "IMAGE", extensions: ["png"] },
  "image/webp": { fileType: "IMAGE", extensions: ["webp"] },
};

export const ACCEPT = Object.entries(ALLOWED_TYPES)
  .flatMap(([mime, t]) => [mime, ...t.extensions.map((e) => `.${e}`)])
  .join(",");

export const VISIBILITY_OPTIONS = [
  { value: "ORGANIZATION", label: "ทั้งองค์กร", hint: "ทุกคนใน KMITL เห็นและค้นหาได้" },
  { value: "TEAM", label: "ทีม", hint: "เฉพาะสมาชิก Collection ที่มีไฟล์นี้" },
  { value: "PRIVATE", label: "ส่วนตัว", hint: "เห็นคนเดียว ใส่ Collection ไม่ได้" },
] as const;

export type UploadVisibility = (typeof VISIBILITY_OPTIONS)[number]["value"];

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function nameWithoutExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

type Checked = { ok: true; fileType: FileType; extension: string } | { ok: false; message: string };

export function checkFile(name: string, mimeType: string, size: number): Checked {
  const type = ALLOWED_TYPES[mimeType];
  const extension = extensionOf(name);
  if (!type || !type.extensions.includes(extension)) {
    return { ok: false, message: `ไม่รองรับไฟล์ชนิดนี้ (.${extension || "?"}) — รับเฉพาะ PDF, JPG, PNG, WEBP` };
  }
  if (size <= 0) return { ok: false, message: "ไฟล์ว่างเปล่า" };
  if (size > MAX_FILE_SIZE) return { ok: false, message: "ไฟล์ใหญ่เกิน 20 MB" };
  return { ok: true, fileType: type.fileType, extension };
}
