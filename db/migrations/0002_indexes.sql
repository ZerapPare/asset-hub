-- AssetHub performance indexes. Requires 0001_schema.sql.
-- Unique indexes that enforce data rules stay next to their tables in 0001.

BEGIN;

SET LOCAL search_path TO public;

-- ============================================================
-- Relationships (FK lookups and reverse lookups of composite PKs)
-- ============================================================
CREATE INDEX idx_assets_owner ON assets (owner_id);
CREATE INDEX idx_processing_asset_status ON processing_workflows (asset_id, status);
CREATE INDEX idx_asset_tags_tag_asset ON asset_tags (tag_id, asset_id);
CREATE INDEX idx_asset_collection_collection_asset ON asset_collection (collection_id, asset_id);
CREATE INDEX idx_collection_members_user_collection ON collection_members (user_id, collection_id);
CREATE INDEX idx_audit_logs_asset_created ON audit_logs (asset_id, created_at);
CREATE INDEX idx_audit_logs_collection_created ON audit_logs (collection_id, created_at);

-- ============================================================
-- File list / dashboard (active assets only)
-- ============================================================
CREATE INDEX idx_assets_active_created
    ON assets (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_active_status
    ON assets (processing_status) WHERE deleted_at IS NULL;

-- ============================================================
-- Purge job: find soft-deleted rows older than 7 days
-- ============================================================
CREATE INDEX idx_assets_deleted
    ON assets (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_collections_deleted
    ON collections (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================
-- Keyword search (ILIKE '%term%', works for Thai substrings)
-- ============================================================
CREATE INDEX idx_assets_display_name_trgm
    ON assets USING gin (display_name gin_trgm_ops);
CREATE INDEX idx_assets_description_trgm
    ON assets USING gin (description gin_trgm_ops);
CREATE INDEX idx_document_chunks_content_trgm
    ON document_chunks USING gin (content gin_trgm_ops);

-- ============================================================
-- Semantic search (cosine distance, operator <=>)
-- ============================================================
CREATE INDEX idx_document_embeddings_hnsw
    ON document_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_image_embeddings_hnsw
    ON image_embeddings USING hnsw (embedding vector_cosine_ops);

COMMIT;
