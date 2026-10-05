import { visibleAssetsWhere } from "@/lib/access";
import {
  assetFilters,
  normalizeSearchQuery,
  SEARCH_LIMIT,
  SearchTimeoutError,
  type AssetFilterOptions,
  type SearchResult,
} from "@/lib/assets/search";
import { sql } from "@/lib/db";
import {
  embedText,
  embedTextForImages,
  hasThai,
  IMAGE_MODEL,
  TEXT_MODEL,
  toVector,
  translateToEnglish,
} from "@/lib/embeddings";
import type { FileType, ProcessingStatus } from "@/lib/types";
import { isUuid } from "@/lib/validate";

// Semantic Search (ADR-2): เอกสาร = Titan Text V2, รูป = Titan Multimodal — คนละ vector space
// ค้นแยกสองฝั่งแล้วรวมด้วย Reciprocal Rank Fusion (ไม่เทียบระยะข้ามโมเดล)
// Bedrock ล้ม/ช้า → EmbeddingError; SQL เกินเวลา → SearchTimeoutError — หน้าค้นหา fallback เป็น Keyword

export const SEMANTIC_SORTS = ["relevance", "newest"] as const;
export type SemanticSort = (typeof SEMANTIC_SORTS)[number];

export type SemanticSearchOptions = AssetFilterOptions & {
  sort?: SemanticSort;
  /** จำกัดเวลารวมของการเรียก Bedrock (ค่าเริ่มต้น EMBED_TIMEOUT_MS) */
  signal?: AbortSignal;
};

/** เวลารวมสูงสุดของการ embed คำค้น (รวม retry ของ SDK) ก่อน fallback */
const EMBED_TIMEOUT_MS = 4_000;
const STATEMENT_TIMEOUT = "3s";
/** จำนวน chunk / รูปที่ใกล้ที่สุดที่ดึงจาก HNSW ก่อนรวมเป็นราย Asset */
const DOC_CANDIDATES = 200;
const IMAGE_CANDIDATES = 100;
/**
 * ตัดผลที่ไม่เกี่ยว (cosine distance 0–2): ต้องไม่เกินเพดาน และไม่ห่างจากผลที่ใกล้ที่สุดเกิน margin
 * ค่าเริ่มต้นจากการทดลองกับข้อมูลในเครื่อง (ต.ค. 2026) — ตรงประเด็น ~0.49–0.82, ไม่เกี่ยว ~0.83–1.0 (เอกสาร)
 * รูป (Multimodal) ช่องว่างแคบ: ตรง ~0.68–0.70, ไม่เกี่ยว ~0.70–0.76 → margin แคบ — จูนใหม่เมื่อมีข้อมูลจริงมากขึ้น
 */
const MAX_DOC_DISTANCE = 0.85;
const DOC_MARGIN = 0.1;
const MAX_IMAGE_DISTANCE = 0.7;
const IMAGE_MARGIN = 0.02;
/** ค่าคงที่มาตรฐานของ RRF: score = Σ 1 / (k + rank) */
const RRF_K = 60;
const SNIPPET_LENGTH = 160;
/** อัปเดต last_used_at ของ cache เมื่อเก่ากว่านี้ (ไม่ให้ทุกการค้นเป็นการเขียน DB) */
const CACHE_TOUCH_INTERVAL = "1 day";

type Vectors = { text?: string; image?: string };

type SemanticRow = {
  asset_id: string;
  owner_id: string;
  display_name: string;
  file_type: FileType;
  file_extension: string;
  file_size: number;
  processing_status: ProcessingStatus;
  created_at: Date;
  owner_name: string;
  tags: string[];
  snippet: string | null;
};

/** key ของ cache: คำค้นที่ normalize แล้ว + ตัวพิมพ์เล็ก + ยุบช่องว่าง */
function cacheKey(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ");
}

export async function semanticSearch(
  userId: string,
  value: string,
  options: SemanticSearchOptions = {},
): Promise<SearchResult[]> {
  const query = normalizeSearchQuery(value);
  if (!query) return [];
  // collection id ผิดรูปแบบ = ไม่มี collection นี้
  if (options.collectionId && !isUuid(options.collectionId)) return [];

  // กรองประเภทแล้วไม่ต้อง embed ฝั่งที่ไม่ใช้ (เร็วขึ้น + ไม่ต้องแปล)
  const wantText = options.type !== "IMAGE";
  const wantImage = options.type !== "DOCUMENT";

  const started = performance.now();
  const { vectors, cached } = await queryVectors(cacheKey(query), wantText, wantImage, options.signal);
  const embedded = performance.now();

  let rows: SemanticRow[];
  try {
    rows = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'`);
      // pgvector >= 0.8: สแกน HNSW ต่อจนได้ครบแม้ตัวกรองสิทธิ์/ตัวกรองตัดผลทิ้งไปมาก
      await tx.unsafe("SET LOCAL hnsw.iterative_scan = relaxed_order");
      return tx<SemanticRow[]>`
        WITH doc_ranked AS (${docRanked(userId, options, vectors.text)}),
        image_ranked AS (${imageRanked(userId, options, vectors.image)}),
        fused AS (
          SELECT asset_id, SUM(1.0 / (${RRF_K} + rank)) AS score
          FROM (
            SELECT asset_id, rank FROM doc_ranked
            UNION ALL
            SELECT asset_id, rank FROM image_ranked
          ) r
          GROUP BY asset_id
        ),
        found AS (
          SELECT f.asset_id, f.score
          FROM fused f
          JOIN assets a ON a.asset_id = f.asset_id
          ORDER BY ${options.sort === "newest" ? sql`a.created_at DESC` : sql`f.score DESC, a.created_at DESC`}, a.asset_id
          LIMIT ${SEARCH_LIMIT}
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
          u.display_name AS owner_name,
          ARRAY(
            SELECT t.name
            FROM asset_tags at
            JOIN tags t ON t.tag_id = at.tag_id
            WHERE at.asset_id = a.asset_id
            ORDER BY t.name
          ) AS tags,
          d.content AS snippet
        FROM found f
        JOIN assets a ON a.asset_id = f.asset_id
        JOIN users u ON u.user_id = a.owner_id
        LEFT JOIN doc_ranked d ON d.asset_id = f.asset_id
        ORDER BY ${options.sort === "newest" ? sql`a.created_at DESC` : sql`f.score DESC, a.created_at DESC`}, a.asset_id
      `;
    });
  } catch (error) {
    // 57014 = query_canceled (statement_timeout)
    if ((error as { code?: string }).code === "57014") throw new SearchTimeoutError();
    throw error;
  }

  console.info(
    `[semantic] embed ${Math.round(embedded - started)}ms (${cached ? "cache" : "bedrock"}) ` +
      `sql ${Math.round(performance.now() - embedded)}ms results ${rows.length}`,
  );

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
    matchedIn: [],
    snippet: row.snippet ? snippet(row.snippet) : undefined,
  }));
}

// เงื่อนไขร่วมทั้งสองฝั่ง: สิทธิ์ + READY + ไม่ถูกลบ (ใน visibleAssetsWhere) + ตัวกรองเดียวกับ Keyword Search
function assetConditions(userId: string, options: AssetFilterOptions) {
  return sql`
    a.processing_status = 'READY'
    AND ${visibleAssetsWhere(userId)}
    ${assetFilters(userId, options)}
  `;
}

// chunk ที่ใกล้ที่สุด → หนึ่งแถวต่อ Asset (เก็บ chunk ที่ใกล้สุดไว้ทำ snippet) → อันดับ
function docRanked(userId: string, options: AssetFilterOptions, vector?: string) {
  if (!vector) return sql`SELECT NULL::uuid AS asset_id, NULL::text AS content, NULL::bigint AS rank WHERE false`;
  return sql`
    SELECT asset_id, content, ROW_NUMBER() OVER (ORDER BY distance, asset_id) AS rank
    FROM (
      SELECT asset_id, content, distance, MIN(distance) OVER () AS best
      FROM (
        SELECT DISTINCT ON (asset_id) asset_id, content, distance
        FROM (
          SELECT dc.asset_id, dc.content, de.embedding <=> ${vector}::vector AS distance
          FROM document_embeddings de
          JOIN document_chunks dc ON dc.chunk_id = de.chunk_id
          JOIN assets a ON a.asset_id = dc.asset_id
          WHERE de.embedding_model = ${TEXT_MODEL}
            AND ${assetConditions(userId, options)}
          ORDER BY de.embedding <=> ${vector}::vector
          LIMIT ${DOC_CANDIDATES}
        ) hits
        ORDER BY asset_id, distance
      ) per_asset
    ) scored
    WHERE distance <= LEAST(${MAX_DOC_DISTANCE}::float8, best + ${DOC_MARGIN}::float8)
  `;
}

function imageRanked(userId: string, options: AssetFilterOptions, vector?: string) {
  if (!vector) return sql`SELECT NULL::uuid AS asset_id, NULL::bigint AS rank WHERE false`;
  return sql`
    SELECT asset_id, ROW_NUMBER() OVER (ORDER BY distance, asset_id) AS rank
    FROM (
      SELECT asset_id, distance, MIN(distance) OVER () AS best
      FROM (
        SELECT ie.asset_id, ie.embedding <=> ${vector}::vector AS distance
        FROM image_embeddings ie
        JOIN assets a ON a.asset_id = ie.asset_id
        WHERE ie.embedding_model = ${IMAGE_MODEL}
          AND ${assetConditions(userId, options)}
        ORDER BY ie.embedding <=> ${vector}::vector
        LIMIT ${IMAGE_CANDIDATES}
      ) hits
    ) scored
    WHERE distance <= LEAST(${MAX_IMAGE_DISTANCE}::float8, best + ${IMAGE_MARGIN}::float8)
  `;
}

/**
 * embedding ของคำค้น: อ่านจาก cache ก่อน ที่ขาดค่อยเรียก Bedrock (พร้อมกันทั้งสองฝั่ง) แล้วเขียนลง cache
 * คืนเป็น literal ของ pgvector ("[…]") ใช้ต่อใน SQL ได้เลย
 */
async function queryVectors(key: string, wantText: boolean, wantImage: boolean, signal?: AbortSignal) {
  const models = [...(wantText ? [TEXT_MODEL] : []), ...(wantImage ? [IMAGE_MODEL] : [])];
  const hits = await sql<{ embedding_model: string; embedding: string; stale: boolean }[]>`
    SELECT embedding_model, embedding::text AS embedding,
      last_used_at < NOW() - ${CACHE_TOUCH_INTERVAL}::interval AS stale
    FROM query_embeddings
    WHERE query = ${key} AND embedding_model IN ${sql(models)}
  `;
  const vectors: Vectors = {};
  for (const hit of hits) {
    if (hit.embedding_model === TEXT_MODEL) vectors.text = hit.embedding;
    else vectors.image = hit.embedding;
  }

  const stale = hits.filter((hit) => hit.stale).map((hit) => hit.embedding_model);
  if (stale.length) {
    // ไม่ต้องรอ — แค่ยืดอายุ cache
    sql`
      UPDATE query_embeddings SET last_used_at = NOW()
      WHERE query = ${key} AND embedding_model IN ${sql(stale)}
    `.catch((error) => console.error("[semantic] cache touch failed:", error));
  }

  const missText = wantText && !vectors.text;
  const missImage = wantImage && !vectors.image;
  if (!missText && !missImage) return { vectors, cached: true };

  const deadline = signal ?? AbortSignal.timeout(EMBED_TIMEOUT_MS);
  const [text, image] = await Promise.all([
    missText ? embedText(key, { signal: deadline }) : undefined,
    missImage ? embedImageQuery(key, deadline) : undefined,
  ]);

  const fresh: { embedding_model: string; query: string; model_input: string; embedding: string }[] = [];
  if (text) {
    vectors.text = toVector(text);
    fresh.push({ embedding_model: TEXT_MODEL, query: key, model_input: key, embedding: vectors.text });
  }
  // แปลไม่ได้ = ไม่มี image และไม่เก็บ cache → รอบหน้าลองแปลใหม่
  if (image) {
    vectors.image = toVector(image.vector);
    fresh.push({ embedding_model: IMAGE_MODEL, query: key, model_input: image.input, embedding: vectors.image });
  }
  if (fresh.length) {
    await sql`
      INSERT INTO query_embeddings ${sql(fresh, "embedding_model", "query", "model_input", "embedding")}
      ON CONFLICT (embedding_model, query) DO NOTHING
    `;
  }
  return { vectors, cached: false };
}

// Titan Multimodal รับแค่อังกฤษ → แปลก่อนถ้ามีอักษรไทย
// แปลไม่ได้ = ไม่ค้นฝั่งรูป (ส่งภาษาไทยเข้าไปตรงๆ ได้ผลสุ่มที่ดันรูปไม่เกี่ยวขึ้นอันดับต้น) — เอกสารยังค้นได้ตามปกติ
async function embedImageQuery(key: string, signal: AbortSignal) {
  let input = key;
  if (hasThai(key)) {
    try {
      input = await translateToEnglish(key, { signal });
    } catch (error) {
      const cause = (error as Error).cause as Error | undefined;
      console.error(`[semantic] translate failed (${cause?.name ?? (error as Error).message}), skipping image search`);
      return undefined;
    }
  }
  return { input, vector: await embedTextForImages(input, { signal }) };
}

function snippet(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > SNIPPET_LENGTH ? `${clean.slice(0, SNIPPET_LENGTH)}…` : clean;
}
