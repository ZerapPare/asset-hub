import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { FILE_TYPES } from "@/lib/schema";
import type { FileType } from "@/lib/types";
import { isUuid } from "@/lib/validate";

// ข้อความใน SQS ที่คนที่ 1 ส่งให้คนที่ 2 (ข้อ A4 ใน docs/plan/pare/11-contract-with-person2.md)
export type ProcessingMessage = {
  version: 1;
  assetId: string;
  s3Key: string;
  bucket: string;
  mimeType: string;
  fileType: FileType;
  fileSize: number;
};

// AWS: ตั้ง PROCESSING_QUEUE_URL (infra/processing.ts) → ส่งเข้า SQS ให้ worker Lambda
// dev ในเครื่อง: ไม่ตั้ง → ประมวลผลใน server แบบไม่รอผล (Lambda ใช้แบบนี้ไม่ได้: หยุดทันทีที่ตอบ response)
const QUEUE_URL = process.env.PROCESSING_QUEUE_URL;

let client: SQSClient | undefined;

export async function enqueueProcessing(message: ProcessingMessage) {
  if (!QUEUE_URL) {
    // Lazy import ไม่ให้ route โหลด sharp/pdf.js ล่วงหน้า
    const { processAsset } = await import("./worker");
    void processAsset(message).catch(() => {
      // Worker บันทึก failure แล้ว
    });
    return;
  }

  try {
    client ??= new SQSClient({});
    await client.send(new SendMessageCommand({ QueueUrl: QUEUE_URL, MessageBody: JSON.stringify(message) }));
  } catch (error) {
    // ไม่ทำให้การอัปโหลดล้ม — Asset ค้าง PROCESSING แล้ว cron (lib/processing/maintenance.ts) ส่งเข้าคิวใหม่ให้
    console.error(`[processing] enqueue ${message.assetId} failed, maintenance will retry:`, error);
  }
}

/** ตรวจข้อความจาก SQS — รูปแบบผิด = null (ทิ้ง ไม่ retry เพราะลองกี่รอบก็ผิดเหมือนเดิม) */
export function parseProcessingMessage(body: string): ProcessingMessage | null {
  let value: Partial<ProcessingMessage>;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (
    value?.version !== 1 ||
    typeof value.assetId !== "string" ||
    !isUuid(value.assetId) ||
    typeof value.s3Key !== "string" ||
    typeof value.bucket !== "string" ||
    typeof value.mimeType !== "string" ||
    !FILE_TYPES.includes(value.fileType as FileType) ||
    typeof value.fileSize !== "number"
  ) {
    return null;
  }
  return value as ProcessingMessage;
}
