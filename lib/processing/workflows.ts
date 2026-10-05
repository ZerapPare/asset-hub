import type { Sql, TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import type { ProcessType } from "@/lib/schema";

// บันทึกแต่ละขั้นของการประมวลผลลง processing_workflows (หนึ่งแถวต่อหนึ่งครั้งที่ลอง)

export async function startWorkflow(assetId: string, processType: ProcessType) {
  const [{ process_id }] = await sql<{ process_id: string }[]>`
    INSERT INTO processing_workflows (asset_id, process_type, status, attempt_no, started_at)
    SELECT ${assetId}, ${processType}, 'PROCESSING', COALESCE(MAX(attempt_no), 0) + 1, NOW()
    FROM processing_workflows
    WHERE asset_id = ${assetId} AND process_type = ${processType}
    RETURNING process_id
  `;
  return process_id;
}

/** ส่ง tx เพื่อให้สำเร็จพร้อมการเขียนข้อมูลใน transaction เดียวกัน */
export async function completeWorkflow(processId: string, db: Sql | TransactionSql = sql) {
  await db`
    UPDATE processing_workflows SET status = 'SUCCESS', error_message = NULL, completed_at = NOW()
    WHERE process_id = ${processId}
  `;
}

export async function failWorkflow(processId: string, reason: string) {
  await sql`
    UPDATE processing_workflows SET status = 'FAILED', error_message = ${reason}, completed_at = NOW()
    WHERE process_id = ${processId}
  `;
}
