import type { FileType } from "@/lib/types";

// ข้อความตาม docs/plan/pare/11-contract-with-person2.md (A4)
export type ProcessingMessage = {
  version: 1;
  assetId: string;
  s3Key: string;
  bucket: string;
  mimeType: string;
  fileType: FileType;
  fileSize: number;
};

// TODO: ส่งเข้า SQS เมื่อมี AWS (ตอนนี้ log ไว้ก่อน)
export async function enqueueProcessing(message: ProcessingMessage) {
  console.info("[processing] enqueue", message);
}
