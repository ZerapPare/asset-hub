-- Indexes for keyword searches not covered by 0002_indexes.sql.

BEGIN;

SET LOCAL search_path TO public;

-- Substring matching for tag names with queries of at least 3 characters.
CREATE INDEX idx_tags_name_trgm
    ON tags USING gin (name gin_trgm_ops);

-- Prefix matching for short asset-name queries such as "AI" and "CV".
CREATE INDEX idx_assets_display_name_lower_prefix
    ON assets (LOWER(display_name) text_pattern_ops)
    WHERE deleted_at IS NULL;

COMMIT;
