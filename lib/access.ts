import { sql } from "@/lib/db";

// กฎ Asset ที่ผู้ใช้มองเห็น:
// - Asset ที่ถูกลบจะไม่แสดง
// - เจ้าของเห็น Asset ของตัวเองเสมอ
// - ORGANIZATION ทุกคนเห็น
// - TEAM เฉพาะสมาชิก Collection ที่มี Asset นั้น
// - PRIVATE เฉพาะเจ้าของ
// ใช้กับ query ที่แสดง ค้นหา หรือดาวน์โหลด Asset
// ส่วนสถานะการประมวลผลให้แต่ละ query กรองตามงานของตัวเอง

export function visibleAssetsWhere(userId: string, alias = "a") {
  const a = sql(alias);
  return sql`(
    ${a}.deleted_at IS NULL
    AND (
      ${a}.owner_id = ${userId}
      OR ${a}.visibility = 'ORGANIZATION'
      OR (
        ${a}.visibility = 'TEAM'
        AND EXISTS (
          SELECT 1
          FROM asset_collection ac
          JOIN collections c
            ON c.collection_id = ac.collection_id AND c.deleted_at IS NULL
          JOIN collection_members cm
            ON cm.collection_id = ac.collection_id AND cm.user_id = ${userId}
          WHERE ac.asset_id = ${a}.asset_id
        )
      )
    )
  )`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ตรวจสิทธิ์ดู Asset หนึ่งรายการ โดย ID ผิดรูปแบบถือว่าไม่พบ */
export async function canViewAsset(userId: string, assetId: string): Promise<boolean> {
  if (!UUID_RE.test(assetId)) return false;
  const [row] = await sql`
    SELECT 1
    FROM assets a
    WHERE a.asset_id = ${assetId}
      AND ${visibleAssetsWhere(userId)}
  `;
  return row !== undefined;
}

// TODO: canEditAsset — เจ้าของ Asset เท่านั้น
// TODO: canDeleteAsset — เจ้าของ Asset เท่านั้น
// TODO: canManageAssetTags — เจ้าของ Asset เท่านั้น

// TODO: getCollectionPermission — คืน OWNER, EDITOR, VIEWER หรือ null
// TODO: canViewCollection — สมาชิกระดับ VIEWER ขึ้นไป
// TODO: canEditCollection — สมาชิกระดับ EDITOR ขึ้นไป
// TODO: canManageCollectionMembers — OWNER เท่านั้น
// TODO: canDeleteCollection — OWNER เท่านั้น
// TODO: canAddAssetToCollection — EDITOR ขึ้นไป และต้องผ่านกฎของ Asset
// TODO: canRemoveAssetFromCollection — EDITOR ขึ้นไป
