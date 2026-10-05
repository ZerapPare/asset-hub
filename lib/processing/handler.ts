import { parseProcessingMessage } from "./queue";
import { processAsset } from "./worker";

// Worker Lambda: รับข้อความจาก SQS processing queue (infra/processing.ts) แล้วเรียก processAsset
// error = ข้อความกลับเข้าคิวให้ SQS ส่งใหม่ (partial batch response) → ครบ PROCESSING_MAX_RECEIVE รอบไป DLQ
// รอบสุดท้าย (finalAttempt) processAsset ตั้ง Asset เป็น FAILED ให้ผู้ใช้เห็น

// ชนิดเฉพาะที่ใช้ (ไม่ต้องลง @types/aws-lambda)
type SqsRecord = { messageId: string; body: string; attributes: { ApproximateReceiveCount: string } };
type SqsEvent = { Records: SqsRecord[] };
type SqsBatchResponse = { batchItemFailures: { itemIdentifier: string }[] };

/** ต้องตรงกับ dlq.retry ใน infra/processing.ts */
const MAX_RECEIVE = Number(process.env.PROCESSING_MAX_RECEIVE ?? 3);

export async function handler(event: SqsEvent): Promise<SqsBatchResponse> {
  const batchItemFailures: SqsBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    const message = parseProcessingMessage(record.body);
    if (!message) {
      console.error(`[processing] invalid message ${record.messageId}, dropped:`, record.body.slice(0, 500));
      continue;
    }

    const attempt = Number(record.attributes.ApproximateReceiveCount) || 1;
    try {
      const result = await processAsset(message, { finalAttempt: attempt >= MAX_RECEIVE });
      console.info(`[processing] ${message.assetId} ${result} (attempt ${attempt}/${MAX_RECEIVE})`);
    } catch {
      // processAsset log + บันทึก workflow แล้ว
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
