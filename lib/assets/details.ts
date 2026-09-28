import type { TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { AssetRow, Visibility } from "@/lib/schema";
import { VISIBILITY_OPTIONS } from "@/lib/upload/rules";
import { isUuid } from "@/lib/validate";

export type DetailsInput = {
  displayName?: string;
  description?: string | null;
  visibility?: string;
  tags?: string[];
  collectionIds?: string[];
};

const MAX_TAGS = 20;

export function normalizeTag(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function parse(input: DetailsInput) {
  const out: {
    displayName?: string;
    description?: string | null;
    visibility?: Visibility;
    tags?: string[];
    collectionIds?: string[];
  } = {};

  if (input.displayName !== undefined) {
    const name = String(input.displayName).trim();
    if (!name || name.length > 200) throw new HttpError(400, "INVALID_NAME", "ชื่อต้องมี 1–200 ตัวอักษร");
    out.displayName = name;
  }
  if (input.description !== undefined) {
    const desc = input.description === null ? "" : String(input.description).trim();
    if (desc.length > 2000) throw new HttpError(400, "INVALID_DESCRIPTION", "คำอธิบายยาวเกิน 2000 ตัวอักษร");
    out.description = desc || null;
  }
  if (input.visibility !== undefined) {
    if (!VISIBILITY_OPTIONS.some((v) => v.value === input.visibility)) {
      throw new HttpError(400, "INVALID_VISIBILITY", "สิทธิ์การมองเห็นไม่ถูกต้อง");
    }
    out.visibility = input.visibility as Visibility;
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) throw new HttpError(400, "INVALID_TAGS");
    const tags = [...new Set(input.tags.map((t) => normalizeTag(String(t))).filter(Boolean))];
    if (tags.length > MAX_TAGS) throw new HttpError(400, "INVALID_TAGS", `ใส่ Tag ได้ไม่เกิน ${MAX_TAGS} อัน`);
    if (tags.some((t) => t.length > 50)) throw new HttpError(400, "INVALID_TAGS", "ชื่อ Tag ยาวเกิน 50 ตัวอักษร");
    out.tags = tags;
  }
  if (input.collectionIds !== undefined) {
    if (!Array.isArray(input.collectionIds) || !input.collectionIds.every(isUuid)) {
      throw new HttpError(400, "INVALID_COLLECTIONS");
    }
    out.collectionIds = [...new Set(input.collectionIds)];
  }
  return out;
}

// แก้รายละเอียด Asset ของตัวเอง (ส่งเฉพาะช่องที่เปลี่ยน)
export async function updateAssetDetails(userId: string, assetId: string, input: DetailsInput) {
  const data = parse(input);

  await sql.begin(async (tx) => {
    // ล็อกแถวกันการเปลี่ยน visibility ชนกับการเพิ่มเข้า Collection
    const [asset] = await tx<AssetRow[]>`
      SELECT * FROM assets
      WHERE asset_id = ${assetId} AND owner_id = ${userId} AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (!asset) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");

    const nameChanged = data.displayName !== undefined && data.displayName !== asset.display_name;
    const descChanged = data.description !== undefined && data.description !== asset.description;
    const visChanged = data.visibility !== undefined && data.visibility !== asset.visibility;

    if (nameChanged || descChanged || visChanged) {
      await tx`
        UPDATE assets SET
          display_name = ${data.displayName ?? asset.display_name},
          description = ${data.description !== undefined ? data.description : asset.description},
          visibility = ${data.visibility ?? asset.visibility}
        WHERE asset_id = ${assetId}
      `;
    }
    if (nameChanged || descChanged) {
      await tx`
        INSERT INTO audit_logs (user_id, asset_id, action, details)
        VALUES (${userId}, ${assetId}, 'UPDATE', ${tx.json({ displayName: nameChanged, description: descChanged })})
      `;
    }
    if (visChanged) {
      await tx`
        INSERT INTO audit_logs (user_id, asset_id, action, details)
        VALUES (${userId}, ${assetId}, 'CHANGE_VISIBILITY', ${tx.json({ from: asset.visibility, to: data.visibility! })})
      `;
    }

    if (data.tags) {
      if (data.tags.length > 0) {
        await tx`INSERT INTO tags (name) SELECT unnest(${data.tags}::text[]) ON CONFLICT DO NOTHING`;
      }
      const tagIds = data.tags.length
        ? (await tx<{ tag_id: string }[]>`
            SELECT tag_id FROM tags WHERE LOWER(BTRIM(name)) = ANY(${data.tags}::text[])
          `).map((r) => r.tag_id)
        : [];
      await tx`DELETE FROM asset_tags WHERE asset_id = ${assetId} AND NOT (tag_id = ANY(${tagIds}::uuid[]))`;
      if (tagIds.length) {
        await tx`
          INSERT INTO asset_tags (asset_id, tag_id)
          SELECT ${assetId}, unnest(${tagIds}::uuid[]) ON CONFLICT DO NOTHING
        `;
      }
    }

    if (data.collectionIds) {
      await syncCollections(tx, userId, assetId, data.collectionIds);
    }

    // ไฟล์ PRIVATE อยู่ใน Collection ไม่ได้
    const finalVisibility = data.visibility ?? asset.visibility;
    if (finalVisibility === "PRIVATE") {
      const [{ count }] = await tx<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM asset_collection WHERE asset_id = ${assetId}
      `;
      if (count > 0) {
        throw new HttpError(409, "PRIVATE_IN_COLLECTION", "ไฟล์ส่วนตัวใส่ Collection ไม่ได้ เอาออกจาก Collection ก่อน");
      }
    }
  });
}

type Tx = TransactionSql;

// ให้ Collection ที่ user แก้ได้ ตรงกับ wanted (ไม่แตะ Collection ของคนอื่น)
async function syncCollections(tx: Tx, userId: string, assetId: string, wanted: string[]) {
  const editable = new Set(
    (
      await tx<{ collection_id: string }[]>`
        SELECT c.collection_id
        FROM collections c
        JOIN collection_members cm ON cm.collection_id = c.collection_id
        WHERE cm.user_id = ${userId} AND cm.permission IN ('OWNER', 'EDITOR') AND c.deleted_at IS NULL
      `
    ).map((r) => r.collection_id),
  );
  if (wanted.some((id) => !editable.has(id))) {
    throw new HttpError(403, "COLLECTION_FORBIDDEN", "ไม่มีสิทธิ์เพิ่มไฟล์เข้า Collection นี้");
  }

  const current = (
    await tx<{ collection_id: string }[]>`
      SELECT collection_id FROM asset_collection WHERE asset_id = ${assetId}
    `
  ).map((r) => r.collection_id);

  const toAdd = wanted.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => editable.has(id) && !wanted.includes(id));

  for (const id of toAdd) {
    await tx`
      INSERT INTO asset_collection (asset_id, collection_id, added_by) VALUES (${assetId}, ${id}, ${userId})
    `;
    await tx`
      INSERT INTO audit_logs (user_id, asset_id, collection_id, action)
      VALUES (${userId}, ${assetId}, ${id}, 'ADD_TO_COLLECTION')
    `;
  }
  for (const id of toRemove) {
    await tx`DELETE FROM asset_collection WHERE asset_id = ${assetId} AND collection_id = ${id}`;
    await tx`
      INSERT INTO audit_logs (user_id, asset_id, collection_id, action)
      VALUES (${userId}, ${assetId}, ${id}, 'REMOVE_FROM_COLLECTION')
    `;
  }
}
