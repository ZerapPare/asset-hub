-- AssetHub schema: extensions, tables, triggers.
-- PostgreSQL 14+ with pgvector >= 0.5.0 (HNSW) and pg_trgm.
-- Performance indexes live in 0002_indexes.sql. See db/README.md.

BEGIN;

SET LOCAL search_path TO public;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Users
-- ============================================================
-- Every account is created through Google sign-in (google_sub NOT NULL).
-- password_hash is NULL until the user sets a password after sign-up.
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_url TEXT,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    google_sub TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    password_set_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    -- DISABLED users are rejected at login and on every request.
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'DISABLED')),
    -- Bump to revoke all sessions of a user (JWT `ver` must match).
    token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- password_hash and password_set_at are set (or unset) together.
    CONSTRAINT chk_users_password_set
        CHECK ((password_hash IS NULL) = (password_set_at IS NULL))
);

-- Prevent case/outer-whitespace variants of the same email.
CREATE UNIQUE INDEX uq_users_email_normalized ON users (LOWER(BTRIM(email)));

-- ============================================================
-- Assets
-- ============================================================
CREATE TABLE assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(user_id),
    -- TEAM = visible to members of collections that contain the asset.
    visibility TEXT NOT NULL
        CHECK (visibility IN ('ORGANIZATION', 'TEAM', 'PRIVATE')),
    original_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    file_type TEXT NOT NULL CHECK (file_type IN ('DOCUMENT', 'IMAGE')),
    file_extension TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    mime_type TEXT NOT NULL,
    image_width INTEGER CHECK (image_width IS NULL OR image_width > 0),
    image_height INTEGER CHECK (image_height IS NULL OR image_height > 0),
    s3_key TEXT UNIQUE NOT NULL,
    thumbnail_key TEXT,
    processing_status TEXT NOT NULL
        CHECK (processing_status IN ('UPLOADING', 'PROCESSING', 'READY', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE processing_workflows (
    process_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    process_type TEXT NOT NULL
        CHECK (process_type IN ('TEXT_EXTRACTION', 'TEXT_EMBEDDING', 'IMAGE_EMBEDDING')),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
    error_message TEXT,
    attempt_no INTEGER NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (asset_id, process_type, attempt_no),
    CHECK (completed_at IS NULL OR
        (started_at IS NOT NULL AND completed_at >= started_at))
);

-- ============================================================
-- Tags
-- ============================================================
CREATE TABLE tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE UNIQUE INDEX uq_tags_name_normalized ON tags (LOWER(BTRIM(name)));

CREATE TABLE asset_tags (
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag_id)
);

-- ============================================================
-- Collections
-- ============================================================
CREATE TABLE collections (
    collection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(user_id),
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE asset_collection (
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(user_id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (asset_id, collection_id)
);

CREATE TABLE collection_members (
    collection_id UUID NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    permission TEXT NOT NULL CHECK (permission IN ('OWNER', 'EDITOR', 'VIEWER')),
    added_by UUID NOT NULL REFERENCES users(user_id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, user_id)
);

-- ============================================================
-- Audit logs (kept after purge; store display names in details)
-- ============================================================
CREATE TABLE audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    asset_id UUID REFERENCES assets(asset_id) ON DELETE SET NULL,
    collection_id UUID REFERENCES collections(collection_id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(user_id),
    action TEXT NOT NULL CHECK (action IN (
        'UPLOAD', 'UPDATE', 'DELETE', 'DOWNLOAD', 'CHANGE_VISIBILITY',
        'CREATE_COLLECTION', 'UPDATE_COLLECTION', 'DELETE_COLLECTION',
        'ADD_TO_COLLECTION', 'REMOVE_FROM_COLLECTION',
        'ADD_MEMBER', 'REMOVE_MEMBER', 'CHANGE_MEMBER_PERMISSION'
    )),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Document chunks and embeddings
-- ============================================================
CREATE TABLE document_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (asset_id, chunk_index)
);

-- Titan Text Embeddings V2 (amazon.titan-embed-text-v2:0), 1024 dimensions.
CREATE TABLE document_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES document_chunks(chunk_id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL,
    embedding VECTOR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chunk_id, embedding_model)
);

-- Titan Multimodal Embeddings (amazon.titan-embed-image-v1), 1024 dimensions.
-- Search queries for images must be embedded with this same model.
CREATE TABLE image_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL,
    embedding VECTOR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (asset_id, embedding_model)
);

-- ============================================================
-- Automatically refresh updated_at when a row is updated.
-- ============================================================
CREATE FUNCTION assethub_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION assethub_set_updated_at();

CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION assethub_set_updated_at();

CREATE TRIGGER trg_collections_updated_at
BEFORE UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION assethub_set_updated_at();

COMMIT;
