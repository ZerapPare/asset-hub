import { getCollectionPermission, visibleAssetsWhere } from "@/lib/access";
import { collectionColor } from "@/lib/collections/editable";
import { sql } from "@/lib/db";
import type { CollectionPermission } from "@/lib/schema";
import type { Asset, Collection, FileType, ProcessingStatus } from "@/lib/types";

export type MyCollection = Collection & { role: CollectionPermission };

export type CollectionMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: CollectionPermission;
};

export type CollectionDetail = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  updatedAt: string;
  role: CollectionPermission;
  assetCount: number;
  totalSize: number;
  members: CollectionMember[];
};

export const COLLECTION_SORTS = ["newest", "oldest", "name"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

type AssetRow = {
  asset_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  file_size: number;
  processing_status: ProcessingStatus;
  created_at: Date;
  owner_id: string;
  owner_name: string;
};

const ASSET_COLUMNS = sql`
  a.asset_id, a.display_name, a.file_type, a.file_extension, a.file_size::float8 AS file_size,
  a.processing_status, a.created_at, a.owner_id, u.display_name AS owner_name
`;

function toAsset(row: AssetRow, userId: string): Asset {
  return {
    id: row.asset_id,
    name: row.display_name,
    fileType: row.file_type,
    extension: row.file_extension.toUpperCase(),
    size: row.file_size,
    status: row.processing_status,
    owner: { name: row.owner_name, isMe: row.owner_id === userId },
    createdAt: row.created_at.toISOString(),
  };
}

// Collection ที่ user เป็นสมาชิก
export async function listMyCollections(userId: string): Promise<MyCollection[]> {
  const rows = await sql<{ collection_id: string; name: string; updated_at: Date; permission: CollectionPermission; asset_count: number }[]>`
    SELECT c.collection_id, c.name, c.updated_at, cm.permission,
      (SELECT COUNT(*)::int FROM asset_collection ac JOIN assets a ON a.asset_id = ac.asset_id
       WHERE ac.collection_id = c.collection_id AND a.processing_status <> 'UPLOADING'
         AND ${visibleAssetsWhere(userId)}) AS asset_count
    FROM collections c
    JOIN collection_members cm ON cm.collection_id = c.collection_id AND cm.user_id = ${userId}
    WHERE c.deleted_at IS NULL
    ORDER BY c.updated_at DESC
  `;
  if (rows.length === 0) return [];

  // ไฟล์ตัวอย่าง 3 ไฟล์ล่าสุดต่อ Collection
  const ids = rows.map((r) => r.collection_id);
  const previews = await sql<(AssetRow & { collection_id: string })[]>`
    SELECT * FROM (
      SELECT ac.collection_id, ${ASSET_COLUMNS},
        ROW_NUMBER() OVER (PARTITION BY ac.collection_id ORDER BY ac.added_at DESC) AS rn
      FROM asset_collection ac
      JOIN assets a ON a.asset_id = ac.asset_id
      JOIN users u ON u.user_id = a.owner_id
      WHERE ac.collection_id = ANY(${ids}::uuid[])
        AND a.processing_status <> 'UPLOADING'
        AND ${visibleAssetsWhere(userId)}
    ) x WHERE rn <= 3
  `;

  return rows.map((r) => ({
    id: r.collection_id,
    name: r.name,
    color: collectionColor(r.collection_id),
    assetCount: r.asset_count,
    updatedAt: r.updated_at.toISOString(),
    previews: previews.filter((p) => p.collection_id === r.collection_id).map((p) => toAsset(p, userId)),
    role: r.permission,
  }));
}

// null = ไม่พบ / ไม่ใช่สมาชิก
export async function getCollectionDetail(userId: string, collectionId: string): Promise<CollectionDetail | null> {
  const role = await getCollectionPermission(userId, collectionId);
  if (!role) return null;

  const [[c], members] = await Promise.all([
    sql<{ name: string; description: string | null; updated_at: Date; asset_count: number; total_size: number }[]>`
      SELECT c.name, c.description, c.updated_at,
        COUNT(a.asset_id)::int AS asset_count,
        COALESCE(SUM(a.file_size), 0)::float8 AS total_size
      FROM collections c
      LEFT JOIN asset_collection ac ON ac.collection_id = c.collection_id
      LEFT JOIN assets a ON a.asset_id = ac.asset_id
        AND a.processing_status <> 'UPLOADING'
        AND ${visibleAssetsWhere(userId)}
      WHERE c.collection_id = ${collectionId}
      GROUP BY c.collection_id
    `,
    sql<{ user_id: string; display_name: string; email: string; avatar_url: string | null; permission: CollectionPermission }[]>`
      SELECT u.user_id, u.display_name, u.email, u.avatar_url, cm.permission
      FROM collection_members cm
      JOIN users u ON u.user_id = cm.user_id
      WHERE cm.collection_id = ${collectionId}
      ORDER BY CASE cm.permission WHEN 'OWNER' THEN 0 WHEN 'EDITOR' THEN 1 ELSE 2 END, u.display_name
    `,
  ]);

  return {
    id: collectionId,
    name: c.name,
    description: c.description,
    color: collectionColor(collectionId),
    updatedAt: c.updated_at.toISOString(),
    role,
    assetCount: c.asset_count,
    totalSize: c.total_size,
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.display_name,
      email: m.email,
      avatarUrl: m.avatar_url,
      role: m.permission,
    })),
  };
}

function orderBy(sort: CollectionSort) {
  if (sort === "oldest") return sql`a.created_at ASC, a.asset_id`;
  if (sort === "name") return sql`LOWER(a.display_name) ASC, a.asset_id`;
  return sql`a.created_at DESC, a.asset_id`;
}

// ค้นชื่อหรือ Tag
function matchQuery(q: string) {
  if (!q) return sql``;
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return sql`AND (a.display_name ILIKE ${like} OR EXISTS (
    SELECT 1 FROM asset_tags at JOIN tags t ON t.tag_id = at.tag_id
    WHERE at.asset_id = a.asset_id AND t.name ILIKE ${like}
  ))`;
}

// ไฟล์ใน Collection (ต้องเป็นสมาชิก — เช็กก่อนเรียก)
export async function listCollectionAssets(
  userId: string,
  collectionId: string,
  { q = "", sort = "newest" }: { q?: string; sort?: CollectionSort } = {},
): Promise<Asset[]> {
  const rows = await sql<AssetRow[]>`
    SELECT ${ASSET_COLUMNS}
    FROM asset_collection ac
    JOIN assets a ON a.asset_id = ac.asset_id
    JOIN users u ON u.user_id = a.owner_id
    WHERE ac.collection_id = ${collectionId}
      AND a.processing_status <> 'UPLOADING'
      AND ${visibleAssetsWhere(userId)}
      ${matchQuery(q.trim())}
    ORDER BY ${orderBy(sort)}
  `;
  return rows.map((r) => toAsset(r, userId));
}

// ไฟล์ที่เพิ่มเข้า Collection นี้ได้
export async function listAddCandidates(userId: string, collectionId: string, q = ""): Promise<Asset[]> {
  const rows = await sql<AssetRow[]>`
    SELECT ${ASSET_COLUMNS}
    FROM assets a
    JOIN users u ON u.user_id = a.owner_id
    WHERE a.processing_status <> 'UPLOADING'
      AND ${visibleAssetsWhere(userId)}
      AND a.visibility <> 'PRIVATE'
      AND (a.visibility <> 'TEAM' OR a.owner_id = ${userId})
      AND NOT EXISTS (SELECT 1 FROM asset_collection ac WHERE ac.asset_id = a.asset_id AND ac.collection_id = ${collectionId})
      ${matchQuery(q.trim())}
    ORDER BY a.created_at DESC
    LIMIT 50
  `;
  return rows.map((r) => toAsset(r, userId));
}
