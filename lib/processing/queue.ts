import type { FileType } from "@/lib/types";

export type ProcessingMessage = {
  version: 1;
  assetId: string;
  s3Key: string;
  bucket: string;
  mimeType: string;
  fileType: FileType;
  fileSize: number;
};

// TODO: Production ส่ง SQS; ตอนนี้รันใน server แบบไม่รอผล
export async function enqueueProcessing(message: ProcessingMessage) {
  // Lazy import ไม่ให้ route โหลด sharp/pdf.js ล่วงหน้า
  const { processAsset } = await import("./worker");
  void processAsset(message).catch(() => {
    // Worker บันทึก failure แล้ว
  });
}
