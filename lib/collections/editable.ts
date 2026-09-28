import { sql } from "@/lib/db";

export type EditableCollection = { id: string; name: string; color: string; assetCount: number };

const COLORS = ["#e35205", "#0e7c86", "#3f7d4f", "#7a5c99", "#b8435a", "#a65a14", "#2457c5"];

// ตาราง collections ไม่มีสี ใช้ id สุ่มสีให้คงที่
export function collectionColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

// Collection ที่ user เพิ่ม/เอา Asset ออกได้ (OWNER, EDITOR)
export async function listEditableCollections(userId: string): Promise<EditableCollection[]> {
  const rows = await sql<{ collection_id: string; name: string; asset_count: number }[]>`
    SELECT c.collection_id, c.name, COUNT(a.asset_id)::int AS asset_count
    FROM collections c
    JOIN collection_members cm ON cm.collection_id = c.collection_id
    LEFT JOIN asset_collection ac ON ac.collection_id = c.collection_id
    LEFT JOIN assets a ON a.asset_id = ac.asset_id AND a.deleted_at IS NULL
    WHERE cm.user_id = ${userId}
      AND cm.permission IN ('OWNER', 'EDITOR')
      AND c.deleted_at IS NULL
    GROUP BY c.collection_id, c.name
    ORDER BY c.name
  `;
  return rows.map((r) => ({
    id: r.collection_id,
    name: r.name,
    color: collectionColor(r.collection_id),
    assetCount: r.asset_count,
  }));
}
