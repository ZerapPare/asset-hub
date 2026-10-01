-- Processing: เพิ่มขั้น THUMBNAIL (สร้างรูปย่อของรูปภาพ) แยกจาก IMAGE_EMBEDDING
-- เพื่อให้ workflow ของแต่ละขั้นมีสถานะและ error ของตัวเอง

BEGIN;

SET LOCAL search_path TO public;

ALTER TABLE processing_workflows DROP CONSTRAINT processing_workflows_process_type_check;
ALTER TABLE processing_workflows ADD CONSTRAINT processing_workflows_process_type_check
    CHECK (process_type IN ('TEXT_EXTRACTION', 'THUMBNAIL', 'TEXT_EMBEDDING', 'IMAGE_EMBEDDING'));

COMMIT;
