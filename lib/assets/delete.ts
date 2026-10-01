import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";

// soft delete (เจ้าของเท่านั้น) — ไฟล์ใน S3 ถูกลบจริงโดย job หลัง 7 วัน
export async function softDeleteAsset(userId: string, assetId: string) {
  await sql.begin(async (tx) => {
    const [row] = await tx<{ original_name: string; display_name: string }[]>`
      UPDATE assets SET deleted_at = NOW()
      WHERE asset_id = ${assetId} AND owner_id = ${userId} AND deleted_at IS NULL
      RETURNING original_name, display_name
    `;
    if (!row) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
    // เก็บชื่อไว้ เพราะ asset_id จะเป็น NULL หลังลบถาวร
    await tx`
      INSERT INTO audit_logs (user_id, asset_id, action, details)
      VALUES (${userId}, ${assetId}, 'DELETE', ${tx.json({ name: row.display_name, originalName: row.original_name })})
    `;
  });
}
