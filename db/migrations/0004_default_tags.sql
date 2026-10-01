-- Tag กลางของระบบ ผู้ใช้เลือกได้เฉพาะจากรายการนี้ (สร้างเองไม่ได้)
-- เพิ่ม Tag ภายหลัง = สร้าง migration ใหม่ อย่าแก้ไฟล์นี้
-- ชื่อเป็นตัวพิมพ์เล็กเสมอ (แอปเทียบแบบ LOWER(BTRIM(name)))

BEGIN;

SET LOCAL search_path TO public;

INSERT INTO tags (name) VALUES
    ('report'),
    ('presentation'),
    ('research'),
    ('thesis'),
    ('project'),
    ('assignment'),
    ('lecture'),
    ('meeting'),
    ('event'),
    ('activity'),
    ('club'),
    ('internship'),
    ('poster'),
    ('photo'),
    ('logo'),
    ('brand'),
    ('design'),
    ('template'),
    ('marketing'),
    ('finance'),
    ('budget'),
    ('contract'),
    ('form'),
    ('policy'),
    ('schedule')
ON CONFLICT DO NOTHING;

COMMIT;
