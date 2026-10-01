import { extractText as extractPdfPages, getDocumentProxy, renderPageAsImage } from "unpdf";
import { THUMBNAIL_MAX_HEIGHT, THUMBNAIL_WIDTH } from "./thumbnail";

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 150;

const BREAKS = ["\n\n", "\n", ". ", "? ", "! ", " "];

export type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/** เปิด PDF ครั้งเดียว ใช้ร่วมกันทั้งดึงข้อความและ render หน้าแรก */
export function openPdf(data: Uint8Array): Promise<PdfDocument> {
  // pdf.js อาจ detach buffer จึงส่งสำเนา
  return getDocumentProxy(new Uint8Array(data));
}

/** คืนหน่วยความจำของ pdf.js ทันทีหลังใช้เสร็จ (สำคัญบน Lambda) */
export function closePdf(pdf: PdfDocument) {
  return pdf.loadingTask.destroy();
}

/** ดึงข้อความทุกหน้า; PDF ภาพสแกนจะได้ค่าว่าง */
export async function extractText(pdf: PdfDocument): Promise<string> {
  const { text } = await extractPdfPages(pdf, { mergePages: false });
  return text.map(normalize).filter(Boolean).join("\n\n");
}

/** หน้าแรกเป็น PNG ขนาดพอดี thumbnail — render เล็กตั้งแต่ต้น ไม่ render ใหญ่แล้วย่อ */
export async function renderFirstPage(pdf: PdfDocument): Promise<Uint8Array> {
  const page = await pdf.getPage(1);
  const { width, height } = page.getViewport({ scale: 1 });
  // พอดีกรอบ thumbnail ทั้งกว้างและสูง (หน้าแนวนอน / แบบแปลนกว้างมากก็ไม่เกิน)
  const scale = Math.min(THUMBNAIL_WIDTH / width, THUMBNAIL_MAX_HEIGHT / height);
  const png = await renderPageAsImage(pdf, 1, { scale, canvasImport: () => import("@napi-rs/canvas") });
  return new Uint8Array(png);
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
