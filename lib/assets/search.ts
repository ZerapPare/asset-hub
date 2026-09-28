import { visibleAssetsWhere } from "@/lib/access";
import { sql } from "@/lib/db";
import type { Asset, FileType, ProcessingStatus } from "@/lib/types";
import { isUuid } from "@/lib/validate";

export const SEARCH_LIMIT = 50;
export const MIN_TRIGRAM_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;
// กันคำค้นที่ตรงข้อมูลมากจน query ค้าง (Lambda มี connection เดียว)
const STATEMENT_TIMEOUT = "3s";
const SNIPPET_RADIUS = 80;
const TAG_OPTION_LIMIT = 200;

export type MatchSource = "name" | "tag" | "collection" | "description" | "content";

export type SearchResult = {
  asset: Asset;
  tags: string[];
  /** ส่วนที่คำค้นไปตรง */
  matchedIn: MatchSource[];
  /** ข้อความช่วงที่เจอในเนื้อหาเอกสาร */
  snippet?: string;
};

export const SEARCH_SORTS = ["relevance", "newest", "oldest", "name"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const UPLOADED_RANGES = ["7d", "30d", "year"] as const;
export type UploadedRange = (typeof UPLOADED_RANGES)[number];

export type KeywordSearchOptions = {
  type?: FileType;
  uploaded?: UploadedRange;
  /** เฉพาะ Asset ของผู้ใช้เอง */
  mine?: boolean;
  collectionId?: string;
  tag?: string;
  sort?: SearchSort;
};

export class SearchTimeoutError extends Error {
  constructor() {
    super("Search query timed out");
  }
}

type SearchRow = {
  asset_id: string;
  owner_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  file_size: number;
  processing_status: ProcessingStatus;
  created_at: Date;
  owner_name: string;
  sources: MatchSource[];
  tags: string[];
  snippet: string | null;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function normalizeSearchQuery(value: string) {
  return Array.from(value.trim()).slice(0, MAX_QUERY_LENGTH).join("");
}

/**
 * Keyword Search: ชื่อไฟล์, คำอธิบาย, Tag, ชื่อ Collection (เฉพาะที่เป็นสมาชิก), เนื้อหาเอกสาร
 * กรองสิทธิ์ด้วย visibleAssetsWhere และไม่แสดงไฟล์ที่ยังอัปโหลดไม่เสร็จ
 */
export async function searchAssets(
  userId: string,
  value: string,
  options: KeywordSearchOptions = {},
): Promise<SearchResult[]> {
  const query = normalizeSearchQuery(value);
  if (!query) return [];
  // collection id ผิดรูปแบบ = ไม่มี collection นี้ จึงไม่มีผลลัพธ์
  if (options.collectionId && !isUuid(options.collectionId)) return [];

  const isShort = Array.from(query).length < MIN_TRIGRAM_QUERY_LENGTH;
  const hits = isShort ? shortQueryHits(userId, query) : trigramHits(userId, query);
  const pattern = `%${escapeLike(query)}%`;

  let rows: SearchRow[];
  try {
    rows = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'`);
      // found: เลือก 50 รายการก่อน แล้วค่อยดึง tag และ snippet เฉพาะรายการเหล่านั้น
      return tx<SearchRow[]>`
        WITH hits AS (${hits}),
        best AS (
          SELECT asset_id, MIN(rank) AS rank, array_agg(DISTINCT source) AS sources
          FROM hits
          GROUP BY asset_id
        ),
        found AS (
          SELECT
            a.asset_id,
            a.owner_id,
            a.display_name,
            a.file_type,
            a.file_extension,
            a.file_size::float8 AS file_size,
            a.processing_status,
            a.created_at,
            u.display_name AS owner_name,
            b.sources,
            ROW_NUMBER() OVER (ORDER BY ${orderBy(options.sort, query)}) AS position
          FROM best b
          JOIN assets a
            ON a.asset_id = b.asset_id
          JOIN users u
            ON u.user_id = a.owner_id
          WHERE ${visibleAssetsWhere(userId)}
            AND a.processing_status <> 'UPLOADING'
            ${filters(userId, options)}
          ORDER BY ${orderBy(options.sort, query)}
          LIMIT ${SEARCH_LIMIT}
        )
        SELECT
          f.*,
          ARRAY(
            SELECT t.name
            FROM asset_tags at
            JOIN tags t
              ON t.tag_id = at.tag_id
            WHERE at.asset_id = f.asset_id
            ORDER BY t.name
          ) AS tags,
          CASE WHEN 'content' = ANY(f.sources) THEN (
            SELECT dc.content
            FROM document_chunks dc
            WHERE dc.asset_id = f.asset_id
              AND dc.content ILIKE ${pattern} ESCAPE '\\'
            ORDER BY dc.chunk_index
            LIMIT 1
          ) END AS snippet
        FROM found f
        ORDER BY f.position
      `;
    });
  } catch (error) {
    // 57014 = query_canceled (statement_timeout)
    if ((error as { code?: string }).code === "57014") throw new SearchTimeoutError();
    throw error;
  }

  return rows.map((row) => ({
    asset: {
      id: row.asset_id,
      name: row.display_name,
      fileType: row.file_type,
      extension: row.file_extension.toUpperCase(),
      size: row.file_size,
      status: row.processing_status,
      owner: { name: row.owner_name, isMe: row.owner_id === userId },
      createdAt: row.created_at.toISOString(),
    },
    tags: row.tags,
    matchedIn: sortSources(row.sources),
    snippet: row.snippet ? excerpt(row.snippet, query) : undefined,
  }));
}

// แต่ละแหล่งหา asset_id แยกกันด้วย UNION ALL เพื่อให้แต่ละส่วนใช้ index ของตัวเองได้
// (ถ้ารวมเป็น OR ใน WHERE เดียว Postgres ต้อง Seq Scan ทั้งตาราง assets)
// rank: 0 = ชื่อตรงทั้งคำ (คิดตอนเรียง), 1 = ชื่อ, 2 = คำอธิบาย, 3 = Tag / Collection / เนื้อหา

// คำค้นสั้นกว่า 3 ตัว trigram ใช้ไม่ได้: ชื่อขึ้นต้นด้วยคำค้น หรือ Tag ตรงทั้งคำ
function shortQueryHits(userId: string, query: string) {
  const prefixPattern = `${escapeLike(query)}%`;

  // deleted_at IS NULL ต้องอยู่ในเงื่อนไขนี้ด้วย ถึงจะใช้ partial index
  // idx_assets_display_name_lower_prefix ได้
  return sql`
    SELECT a.asset_id, 1 AS rank, 'name'::text AS source
    FROM assets a
    WHERE a.deleted_at IS NULL
      AND LOWER(a.display_name) LIKE LOWER(${prefixPattern}) ESCAPE '\\'

    UNION ALL

    SELECT at.asset_id, 1, 'tag'
    FROM tags t
    JOIN asset_tags at
      ON at.tag_id = t.tag_id
    WHERE LOWER(BTRIM(t.name)) = LOWER(BTRIM(${query}))

    UNION ALL

    ${memberCollectionHits(userId, 1, sql`LOWER(c.name) LIKE LOWER(${prefixPattern}) ESCAPE '\\'`)}
  `;
}

function trigramHits(userId: string, query: string) {
  const pattern = `%${escapeLike(query)}%`;

  return sql`
    SELECT a.asset_id, 1 AS rank, 'name'::text AS source
    FROM assets a
    WHERE a.display_name ILIKE ${pattern} ESCAPE '\\'

    UNION ALL

    SELECT a.asset_id, 2, 'description'
    FROM assets a
    WHERE a.description ILIKE ${pattern} ESCAPE '\\'

    UNION ALL

    SELECT at.asset_id, 3, 'tag'
    FROM tags t
    JOIN asset_tags at
      ON at.tag_id = t.tag_id
    WHERE t.name ILIKE ${pattern} ESCAPE '\\'

    UNION ALL

    ${memberCollectionHits(userId, 3, sql`c.name ILIKE ${pattern} ESCAPE '\\'`)}

    UNION ALL

    SELECT dc.asset_id, 3, 'content'
    FROM document_chunks dc
    WHERE dc.content ILIKE ${pattern} ESCAPE '\\'
  `;
}

// ชื่อ Collection ค้นได้เฉพาะ Collection ที่ผู้ใช้เป็นสมาชิก (คนนอกต้องไม่รู้ว่ามี Collection นี้)
function memberCollectionHits(userId: string, rank: number, nameMatch: ReturnType<typeof sql>) {
  return sql`
    SELECT ac.asset_id, ${rank}::int, 'collection'
    FROM collections c
    JOIN collection_members cm
      ON cm.collection_id = c.collection_id AND cm.user_id = ${userId}
    JOIN asset_collection ac
      ON ac.collection_id = c.collection_id
    WHERE c.deleted_at IS NULL
      AND ${nameMatch}
  `;
}

function uploadedSince(range: UploadedRange) {
  switch (range) {
    case "7d":
      return sql`NOW() - INTERVAL '7 days'`;
    case "30d":
      return sql`NOW() - INTERVAL '30 days'`;
    case "year":
      // ต้นปีตามเวลาไทย
      return sql`date_trunc('year', NOW() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'`;
  }
}

function filters(userId: string, o: KeywordSearchOptions) {
  return sql`
    ${o.type ? sql`AND a.file_type = ${o.type}` : sql``}
    ${o.uploaded ? sql`AND a.created_at >= ${uploadedSince(o.uploaded)}` : sql``}
    ${o.mine ? sql`AND a.owner_id = ${userId}` : sql``}
    ${
      o.collectionId
        ? sql`AND EXISTS (
            SELECT 1
            FROM asset_collection ac
            JOIN collections c
              ON c.collection_id = ac.collection_id AND c.deleted_at IS NULL
            JOIN collection_members cm
              ON cm.collection_id = ac.collection_id AND cm.user_id = ${userId}
            WHERE ac.asset_id = a.asset_id
              AND ac.collection_id = ${o.collectionId}
          )`
        : sql``
    }
    ${
      o.tag
        ? sql`AND EXISTS (
            SELECT 1
            FROM asset_tags at
            JOIN tags t
              ON t.tag_id = at.tag_id
            WHERE at.asset_id = a.asset_id
              AND LOWER(BTRIM(t.name)) = LOWER(BTRIM(${o.tag}))
          )`
        : sql``
    }
  `;
}

// การเรียงมาจาก allowlist เท่านั้น — ไม่เอาค่าจากผู้ใช้ไปต่อเป็น SQL
function orderBy(sort: SearchSort = "relevance", query: string) {
  switch (sort) {
    case "newest":
      return sql`a.created_at DESC, a.asset_id`;
    case "oldest":
      return sql`a.created_at ASC, a.asset_id`;
    case "name":
      return sql`LOWER(a.display_name) ASC, a.created_at DESC, a.asset_id`;
    default:
      // 1) แหล่งที่ตรงดีที่สุด (rank)  2) ตรงหลายแหล่งมาก่อน
      // 3) ชื่อใกล้เคียงคำค้นมากกว่ามาก่อน (pg_trgm similarity)  4) ใหม่กว่ามาก่อน
      return sql`
        CASE WHEN LOWER(a.display_name) = LOWER(${query}) THEN 0 ELSE b.rank END,
        cardinality(b.sources) DESC,
        similarity(a.display_name, ${query}) DESC,
        a.created_at DESC,
        a.asset_id
      `;
  }
}

const SOURCE_ORDER: MatchSource[] = ["name", "tag", "collection", "description", "content"];

function sortSources(sources: MatchSource[]) {
  return SOURCE_ORDER.filter((source) => sources.includes(source));
}

// ตัดข้อความรอบคำที่เจอ ให้สั้นพอแสดง 2 บรรทัด
function excerpt(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + query.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export type SearchFilterOption = { value: string; label: string };

/** ตัวเลือกในแผงตัวกรอง: Collection ที่เป็นสมาชิก และ Tag ของ Asset ที่มองเห็นได้ */
export async function getSearchFilterOptions(userId: string) {
  const [collections, tags] = await Promise.all([
    sql<SearchFilterOption[]>`
      SELECT c.collection_id AS value, c.name AS label
      FROM collections c
      JOIN collection_members cm
        ON cm.collection_id = c.collection_id AND cm.user_id = ${userId}
      WHERE c.deleted_at IS NULL
      ORDER BY LOWER(c.name)
    `,
    // Tag ของ Asset ที่มองไม่เห็นต้องไม่โผล่ (ชื่อ Tag อาจเผยข้อมูลของไฟล์ PRIVATE)
    sql<SearchFilterOption[]>`
      SELECT DISTINCT t.name AS value, t.name AS label
      FROM tags t
      JOIN asset_tags at
        ON at.tag_id = t.tag_id
      JOIN assets a
        ON a.asset_id = at.asset_id
      WHERE ${visibleAssetsWhere(userId)}
      ORDER BY t.name
      LIMIT ${TAG_OPTION_LIMIT}
    `,
  ]);
  return { collections: [...collections], tags: [...tags] };
}
