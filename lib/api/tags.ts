import { visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import type { TagSummary } from "@/lib/types";

// Tag กลางทุกอัน + จำนวนไฟล์ที่ user มีสิทธิ์เห็น
export async function listTags(userId: string): Promise<TagSummary[]> {
  const rows = await sql<{ tag_id: string; name: string; documents: number; images: number; last_used: Date | null }[]>`
    SELECT
      t.tag_id, t.name,
      COUNT(a.asset_id) FILTER (WHERE a.file_type = 'DOCUMENT')::int AS documents,
      COUNT(a.asset_id) FILTER (WHERE a.file_type = 'IMAGE')::int    AS images,
      MAX(a.created_at) AS last_used
    FROM tags t
    LEFT JOIN asset_tags at ON at.tag_id = t.tag_id
    LEFT JOIN assets a ON a.asset_id = at.asset_id
      AND a.processing_status <> 'UPLOADING'
      AND ${visibleAssetsWhere(userId)}
    GROUP BY t.tag_id, t.name
    ORDER BY t.name
  `;
  return rows.map((r) => ({
    id: r.tag_id,
    name: r.name,
    documents: r.documents,
    images: r.images,
    lastUsedAt: r.last_used?.toISOString() ?? null,
  }));
}
