-- Cache embedding ของคำค้น Semantic Search (ไม่ต้องเรียก Bedrock ซ้ำเมื่อค้นคำเดิม เช่น ตอนเปลี่ยนตัวกรอง/การเรียง)
-- ไม่ผูกกับ user — เก็บแค่ข้อความคำค้น; แถวที่ไม่ได้ใช้เกิน 30 วันถูกลบโดย cleanup job

BEGIN;

SET LOCAL search_path TO public;

CREATE TABLE query_embeddings (
    embedding_model TEXT NOT NULL,
    query TEXT NOT NULL,             -- คำค้นที่ normalize แล้ว (trim, ยุบช่องว่าง, lowercase)
    model_input TEXT NOT NULL,       -- ข้อความที่ส่งเข้าโมเดลจริง (Multimodal = คำแปลอังกฤษ)
    embedding VECTOR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (embedding_model, query)
);

-- ให้ cleanup job หาแถวเก่าได้เร็ว
CREATE INDEX idx_query_embeddings_last_used
    ON query_embeddings (last_used_at);

COMMIT;
