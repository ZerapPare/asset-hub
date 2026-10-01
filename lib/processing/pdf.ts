import { extractText as extractPdfPages } from "unpdf";

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 150;

const BREAKS = ["\n\n", "\n", ". ", "? ", "! ", " "];

/** ดึงข้อความทุกหน้า; PDF ภาพสแกนจะได้ค่าว่าง */
export async function extractText(data: Uint8Array): Promise<string> {
  // pdf.js อาจ detach buffer จึงส่งสำเนา
  const { text } = await extractPdfPages(new Uint8Array(data), { mergePages: false });
  return text.map(normalize).filter(Boolean).join("\n\n");
}

// แปลงสระ/วรรณยุกต์ไทย PUA จาก PDF เก่าเป็น Unicode มาตรฐาน
const THAI_PUA = "ฐิีึื่้๊๋์่้๊๋์ญัํ็่้๊๋์ฺุู";

function normalize(page: string) {
  return (
    page
      .replace(/[-]/g, (c) => THAI_PUA[c.charCodeAt(0) - 0xf700])
      // Postgres TEXT ไม่รองรับ NUL
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** แบ่งข้อความตาม size พร้อมซ้อนกันตาม overlap */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + size >= text.length ? text.length : breakPoint(text, start, start + size, size);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    // บังคับให้ขยับอย่างน้อยหนึ่งตัวเพื่อกัน loop
    start = Math.max(overlapStart(text, end, overlap), start + 1);
  }
  return chunks;
}

function breakPoint(text: string, start: number, end: number, size: number) {
  const min = start + Math.floor(size / 2);
  for (const sep of BREAKS) {
    const i = text.lastIndexOf(sep, end - sep.length);
    if (i >= min) return i + sep.length;
  }
  let cut = end;
  while (cut > min && isMark(text, cut)) cut--;
  return cut;
}

function overlapStart(text: string, end: number, overlap: number) {
  const from = Math.max(end - overlap, 0);
  const space = text.slice(from, end).search(/\s/);
  let start = space >= 0 ? from + space + 1 : from;
  while (start < end && isMark(text, start)) start++;
  return start;
}

function isMark(text: string, index: number) {
  return index < text.length && /\p{M}/u.test(text[index]);
}
