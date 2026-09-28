import { visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import type {
  Asset,
  FileType,
  ProcessingStatus,
} from "@/lib/types";

const SEARCH_LIMIT = 50;
export const MIN_TRIGRAM_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;

type SearchAssetRow = {
  asset_id: string;
  owner_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  file_size: number;
  processing_status: ProcessingStatus;
  created_at: Date;
  owner_name: string;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function normalizeSearchQuery(value: string) {
  return Array.from(value.trim()).slice(0, MAX_QUERY_LENGTH).join("");
}

function toAsset(
  row: SearchAssetRow,
  currentUserId: string
): Asset {
  return {
    id: row.asset_id,
    name: row.display_name,
    fileType: row.file_type,
    extension: row.file_extension.toUpperCase(),
    size: row.file_size,
    status: row.processing_status,
    owner: {
      name: row.owner_name,
      isMe: row.owner_id === currentUserId,
    },
    createdAt: row.created_at.toISOString(),
  };
}

export async function searchAssets(
  userId: string,
  value: string
): Promise<Asset[]> {
  const query = normalizeSearchQuery(value);

  if (!query) {
    return [];
  }

  const rows = Array.from(query).length < MIN_TRIGRAM_QUERY_LENGTH
    ? await searchShortQuery(userId, query)
    : await searchTrigramQuery(userId, query);

  return rows.map((row) =>
    toAsset(row, userId)
  );
}
// rank
// 0 = ชื่อไฟล์ตรงทั้งคำ
// 1 = คำค้นอยู่ในชื่อ
// 2 = คำค้นอยู่ใน description
// 3 = พบจาก Tag หรือเนื้อหา
async function searchByHits(
  userId: string,
  query: string,
  hits: ReturnType<typeof sql>
) {
  return sql<SearchAssetRow[]>`
    WITH hits AS (${hits}),
    best AS (
      SELECT asset_id, MIN(rank) AS rank
      FROM hits
      GROUP BY asset_id
    )
    SELECT
      a.asset_id,
      a.owner_id,
      a.display_name,
      a.file_type,
      a.file_extension,
      a.file_size::float8 AS file_size,
      a.processing_status,
      a.created_at,
      u.display_name AS owner_name
    FROM best b
    JOIN assets a
      ON a.asset_id = b.asset_id
    JOIN users u
      ON u.user_id = a.owner_id
    WHERE ${visibleAssetsWhere(userId)}
      AND a.processing_status <> 'UPLOADING'
    ORDER BY
      CASE
        WHEN LOWER(a.display_name) = LOWER(${query})
          THEN 0
        ELSE b.rank
      END,
      a.created_at DESC
    LIMIT ${SEARCH_LIMIT}
  `;
}

async function searchShortQuery(userId: string, query: string) {
  const prefixPattern = `${escapeLike(query)}%`;

  // deleted_at IS NULL ต้องอยู่ในเงื่อนไขนี้ด้วย ถึงจะใช้ partial index
  // idx_assets_display_name_lower_prefix ได้
  return searchByHits(userId, query, sql`
    SELECT a.asset_id, 1 AS rank
    FROM assets a
    WHERE a.deleted_at IS NULL
      AND LOWER(a.display_name) LIKE LOWER(${prefixPattern}) ESCAPE '\\'

    UNION ALL

    SELECT at.asset_id, 1
    FROM tags t
    JOIN asset_tags at
      ON at.tag_id = t.tag_id
    WHERE LOWER(BTRIM(t.name)) = LOWER(BTRIM(${query}))
  `);
}

async function searchTrigramQuery(userId: string, query: string) {
  const pattern = `%${escapeLike(query)}%`;

  return searchByHits(userId, query, sql`
    SELECT a.asset_id, 1 AS rank
    FROM assets a
    WHERE a.display_name ILIKE ${pattern} ESCAPE '\\'

    UNION ALL

    SELECT a.asset_id, 2
    FROM assets a
    WHERE a.description ILIKE ${pattern} ESCAPE '\\'

    UNION ALL

    SELECT at.asset_id, 3
    FROM tags t
    JOIN asset_tags at
      ON at.tag_id = t.tag_id
    WHERE t.name ILIKE ${pattern} ESCAPE '\\'

    UNION ALL

    SELECT dc.asset_id, 3
    FROM document_chunks dc
    WHERE dc.content ILIKE ${pattern} ESCAPE '\\'
  `);
}
