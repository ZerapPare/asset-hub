import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CollectionPermission } from "@/lib/schema";

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

// สิทธิ์ Collection: VIEWER < EDITOR < OWNER
const ROLE_RANK: Record<CollectionPermission, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export function hasCollectionRole(role: CollectionPermission | null, min: CollectionPermission) {
  return role !== null && ROLE_RANK[role] >= ROLE_RANK[min];
}

// null = ไม่ใช่สมาชิก
export async function getCollectionPermission(userId: string, collectionId: string): Promise<CollectionPermission | null> {
  if (!UUID_RE.test(collectionId)) return null;
  const [row] = await sql<{ permission: CollectionPermission }[]>`
    SELECT cm.permission
    FROM collection_members cm
    JOIN collections c ON c.collection_id = cm.collection_id AND c.deleted_at IS NULL
    WHERE cm.collection_id = ${collectionId} AND cm.user_id = ${userId}
  `;
  return row?.permission ?? null;
}

// ไม่ใช่สมาชิก 404 / สิทธิ์ไม่พอ 403
export async function requireCollectionRole(userId: string, collectionId: string, min: CollectionPermission) {
  const role = await getCollectionPermission(userId, collectionId);
  if (!role) throw new HttpError(404, "COLLECTION_NOT_FOUND", "ไม่พบ Collection");
  if (!hasCollectionRole(role, min)) throw new HttpError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้ใน Collection");
  return role;
}
