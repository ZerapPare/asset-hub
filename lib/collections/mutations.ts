import type { TransactionSql } from "postgres";
import { requireCollectionRole, visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { COLLECTION_PERMISSIONS, type CollectionPermission, type Visibility } from "@/lib/schema";
import { isUuid } from "@/lib/validate";

const MAX_IDS = 100;

function parseName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 100) throw new HttpError(400, "INVALID_NAME", "ชื่อต้องมี 1–100 ตัวอักษร");
  return name;
}

function parseDescription(value: unknown) {
  const desc = String(value ?? "").trim();
  if (desc.length > 1000) throw new HttpError(400, "INVALID_DESCRIPTION", "คำอธิบายยาวเกิน 1000 ตัวอักษร");
  return desc || null;
}

function parseRole(value: unknown): CollectionPermission {
  if (!COLLECTION_PERMISSIONS.includes(value as CollectionPermission)) {
    throw new HttpError(400, "INVALID_PERMISSION", "สิทธิ์ไม่ถูกต้อง");
  }
  return value as CollectionPermission;
}

function parseIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IDS || !value.every(isUuid)) {
    throw new HttpError(400, "INVALID_ASSETS", `เลือกไฟล์ได้ 1–${MAX_IDS} ไฟล์`);
  }
  return [...new Set(value as string[])];
}

async function audit(
  tx: TransactionSql,
  row: { userId: string; collectionId: string; action: string; assetId?: string; targetUserId?: string; details?: Record<string, string> },
) {
  await tx`
    INSERT INTO audit_logs (user_id, collection_id, asset_id, target_user_id, action, details)
    VALUES (${row.userId}, ${row.collectionId}, ${row.assetId ?? null}, ${row.targetUserId ?? null},
            ${row.action}, ${row.details ? tx.json(row.details) : null})
  `;
}

// ผู้สร้างเป็น OWNER ใน transaction เดียวกัน
export async function createCollection(userId: string, input: { name?: unknown; description?: unknown }) {
  const name = parseName(input.name);
  const description = parseDescription(input.description);
  return sql.begin(async (tx) => {
    const [{ collection_id }] = await tx<{ collection_id: string }[]>`
      INSERT INTO collections (created_by, name, description) VALUES (${userId}, ${name}, ${description})
      RETURNING collection_id
    `;
    await tx`
      INSERT INTO collection_members (collection_id, user_id, permission, added_by)
      VALUES (${collection_id}, ${userId}, 'OWNER', ${userId})
    `;
    await audit(tx, { userId, collectionId: collection_id, action: "CREATE_COLLECTION", details: { name } });
    return collection_id;
  });
}

export async function updateCollection(userId: string, id: string, input: { name?: unknown; description?: unknown }) {
  await requireCollectionRole(userId, id, "EDITOR");
  const name = input.name === undefined ? undefined : parseName(input.name);
  const description = input.description === undefined ? undefined : parseDescription(input.description);
  await sql.begin(async (tx) => {
    const [cur] = await tx<{ name: string; description: string | null }[]>`
      SELECT name, description FROM collections WHERE collection_id = ${id} FOR UPDATE
    `;
    await tx`
      UPDATE collections SET
        name = ${name ?? cur.name},
        description = ${description === undefined ? cur.description : description},
        updated_at = NOW()
      WHERE collection_id = ${id}
    `;
    await audit(tx, { userId, collectionId: id, action: "UPDATE_COLLECTION" });
  });
}

// soft delete
export async function deleteCollection(userId: string, id: string) {
  await requireCollectionRole(userId, id, "OWNER");
  await sql.begin(async (tx) => {
    const [row] = await tx<{ name: string }[]>`
      UPDATE collections SET deleted_at = NOW() WHERE collection_id = ${id} AND deleted_at IS NULL RETURNING name
    `;
    if (!row) throw new HttpError(404, "COLLECTION_NOT_FOUND", "ไม่พบ Collection");
    await audit(tx, { userId, collectionId: id, action: "DELETE_COLLECTION", details: { name: row.name } });
  });
}

// กฎ: มองเห็นได้, ไม่ PRIVATE, TEAM เฉพาะเจ้าของไฟล์
export async function addAssets(userId: string, id: string, assetIds: unknown) {
  await requireCollectionRole(userId, id, "EDITOR");
  const ids = parseIds(assetIds);
  return sql.begin(async (tx) => {
    // ล็อกแถวกันการเปลี่ยนเป็น PRIVATE พร้อมกัน
    const assets = await tx<{ asset_id: string; owner_id: string; visibility: Visibility }[]>`
      SELECT a.asset_id, a.owner_id, a.visibility FROM assets a
      WHERE a.asset_id = ANY(${ids}::uuid[]) AND a.processing_status <> 'UPLOADING' AND ${visibleAssetsWhere(userId)}
      FOR SHARE OF a
    `;
    if (assets.length !== ids.length) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์บางไฟล์");
    if (assets.some((a) => a.visibility === "PRIVATE")) {
      throw new HttpError(409, "PRIVATE_ASSET", "ไฟล์ส่วนตัวใส่ Collection ไม่ได้");
    }
    if (assets.some((a) => a.visibility === "TEAM" && a.owner_id !== userId)) {
      throw new HttpError(403, "TEAM_ASSET", "ไฟล์ระดับทีมเพิ่มได้เฉพาะเจ้าของไฟล์");
    }

    const added = await tx<{ asset_id: string }[]>`
      INSERT INTO asset_collection (asset_id, collection_id, added_by)
      SELECT unnest(${ids}::uuid[]), ${id}, ${userId}
      ON CONFLICT DO NOTHING
      RETURNING asset_id
    `;
    for (const a of added) await audit(tx, { userId, collectionId: id, assetId: a.asset_id, action: "ADD_TO_COLLECTION" });
    await tx`UPDATE collections SET updated_at = NOW() WHERE collection_id = ${id}`;
    return added.length;
  });
}

export async function removeAssets(userId: string, id: string, assetIds: unknown) {
  await requireCollectionRole(userId, id, "EDITOR");
  const ids = parseIds(assetIds);
  return sql.begin(async (tx) => {
    const removed = await tx<{ asset_id: string }[]>`
      DELETE FROM asset_collection WHERE collection_id = ${id} AND asset_id = ANY(${ids}::uuid[])
      RETURNING asset_id
    `;
    for (const a of removed) {
      await audit(tx, { userId, collectionId: id, assetId: a.asset_id, action: "REMOVE_FROM_COLLECTION" });
    }
    await tx`UPDATE collections SET updated_at = NOW() WHERE collection_id = ${id}`;
    return removed.length;
  });
}

// เพิ่มได้เฉพาะคนที่เคย login
export async function addMember(userId: string, id: string, input: { email?: unknown; permission?: unknown }) {
  await requireCollectionRole(userId, id, "OWNER");
  const role = parseRole(input.permission);
  const email = String(input.email ?? "").trim();
  if (!email) throw new HttpError(400, "INVALID_EMAIL", "กรุณากรอกอีเมล");

  await sql.begin(async (tx) => {
    const [target] = await tx<{ user_id: string }[]>`
      SELECT user_id FROM users WHERE LOWER(BTRIM(email)) = LOWER(BTRIM(${email})) AND status = 'ACTIVE'
    `;
    if (!target) throw new HttpError(404, "USER_NOT_FOUND", "ผู้ใช้นี้ยังไม่เคยเข้าสู่ระบบ");
    const [inserted] = await tx`
      INSERT INTO collection_members (collection_id, user_id, permission, added_by)
      VALUES (${id}, ${target.user_id}, ${role}, ${userId})
      ON CONFLICT DO NOTHING RETURNING user_id
    `;
    if (!inserted) throw new HttpError(409, "ALREADY_MEMBER", "เป็นสมาชิกอยู่แล้ว");
    await audit(tx, { userId, collectionId: id, targetUserId: target.user_id, action: "ADD_MEMBER", details: { permission: role } });
  });
}

// ล็อกสมาชิกทั้งหมด แล้วเช็กว่ายังเหลือ OWNER
async function lockMembers(tx: TransactionSql, id: string, targetId: string) {
  const members = await tx<{ user_id: string; permission: CollectionPermission }[]>`
    SELECT user_id, permission FROM collection_members WHERE collection_id = ${id} FOR UPDATE
  `;
  const target = members.find((m) => m.user_id === targetId);
  if (!target) throw new HttpError(404, "MEMBER_NOT_FOUND", "ไม่พบสมาชิก");
  const owners = members.filter((m) => m.permission === "OWNER").length;
  return { target, isLastOwner: target.permission === "OWNER" && owners === 1 };
}

export async function changeMemberPermission(userId: string, id: string, targetId: string, permission: unknown) {
  await requireCollectionRole(userId, id, "OWNER");
  const role = parseRole(permission);
  await sql.begin(async (tx) => {
    const { target, isLastOwner } = await lockMembers(tx, id, targetId);
    if (target.permission === role) return;
    if (isLastOwner) throw new HttpError(409, "LAST_OWNER", "ต้องมี OWNER อย่างน้อย 1 คน");
    await tx`UPDATE collection_members SET permission = ${role} WHERE collection_id = ${id} AND user_id = ${targetId}`;
    await audit(tx, {
      userId, collectionId: id, targetUserId: targetId, action: "CHANGE_MEMBER_PERMISSION",
      details: { from: target.permission, to: role },
    });
  });
}

// OWNER ลบใครก็ได้ / สมาชิกออกเองได้
export async function removeMember(userId: string, id: string, targetId: string) {
  await requireCollectionRole(userId, id, targetId === userId ? "VIEWER" : "OWNER");
  await sql.begin(async (tx) => {
    const { isLastOwner } = await lockMembers(tx, id, targetId);
    if (isLastOwner) throw new HttpError(409, "LAST_OWNER", "ต้องมี OWNER อย่างน้อย 1 คน");
    await tx`DELETE FROM collection_members WHERE collection_id = ${id} AND user_id = ${targetId}`;
    await audit(tx, { userId, collectionId: id, targetUserId: targetId, action: "REMOVE_MEMBER" });
  });
}
