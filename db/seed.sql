-- AssetHub dev seed data. LOCAL DEVELOPMENT ONLY — never run on RDS/production.
-- Requires db/migrations/0001 and 0002.
--
-- Re-runnable: removes previous seed rows (users whose google_sub starts with 'seed-') first.
-- Not seeded:
--   * document_embeddings / image_embeddings — must come from Bedrock via the processing worker.
--   * audit_logs — written by the app.
-- s3_key values are fake, so preview/download of seed assets will not work.
-- Seed users have no password (password_hash NULL). Change the email domain if
-- ALLOWED_EMAIL_DOMAIN is not kmitl.ac.th.
--
-- Scenario
--   alice  ACTIVE    owns most assets; OWNER of "Project Phoenix" and "Archived 2024"
--   bob    ACTIVE    EDITOR of Phoenix; OWNER of "Design Team"
--   carol  ACTIVE    not in any collection -> sees ORGANIZATION assets + her own only
--   dave   DISABLED  no assets; login must be rejected
--
-- IDs are fixed so tests can refer to them:
--   users       11111111-1111-1111-1111-00000000000N
--   assets      22222222-2222-2222-2222-0000000000NN
--   collections 33333333-3333-3333-3333-00000000000N

BEGIN;

SET LOCAL search_path TO public;

-- ============================================================
-- 1) Remove previous seed data
-- ============================================================
CREATE TEMP TABLE seed_user_ids ON COMMIT DROP AS
SELECT user_id FROM users WHERE google_sub LIKE 'seed-%';

DELETE FROM audit_logs
WHERE user_id IN (SELECT user_id FROM seed_user_ids)
   OR target_user_id IN (SELECT user_id FROM seed_user_ids);
DELETE FROM asset_collection WHERE added_by IN (SELECT user_id FROM seed_user_ids);
DELETE FROM collection_members
WHERE user_id IN (SELECT user_id FROM seed_user_ids)
   OR added_by IN (SELECT user_id FROM seed_user_ids);
-- CASCADE removes remaining members and asset links of these collections.
DELETE FROM collections WHERE created_by IN (SELECT user_id FROM seed_user_ids);
-- CASCADE removes chunks, embeddings, workflows, tags and collection links.
DELETE FROM assets WHERE owner_id IN (SELECT user_id FROM seed_user_ids);
DELETE FROM users WHERE user_id IN (SELECT user_id FROM seed_user_ids);
-- Seed tags that nobody else uses.
DELETE FROM tags t
WHERE LOWER(BTRIM(t.name)) IN (
        'marketing', 'report', 'phoenix', 'design', 'hr', 'security', 'meeting',
        'รายงาน', 'ประชุม')
  AND NOT EXISTS (SELECT 1 FROM asset_tags at WHERE at.tag_id = t.tag_id);

-- ============================================================
-- 2) Users
-- ============================================================
INSERT INTO users (user_id, google_sub, email, display_name, verified_at, status)
VALUES
    ('11111111-1111-1111-1111-000000000001', 'seed-alice', 'seed.alice@kmitl.ac.th', 'Alice Marketing', NOW(), 'ACTIVE'),
    ('11111111-1111-1111-1111-000000000002', 'seed-bob',   'seed.bob@kmitl.ac.th',   'Bob Designer',    NOW(), 'ACTIVE'),
    ('11111111-1111-1111-1111-000000000003', 'seed-carol', 'seed.carol@kmitl.ac.th', 'Carol IT',        NOW(), 'ACTIVE'),
    ('11111111-1111-1111-1111-000000000004', 'seed-dave',  'seed.dave@kmitl.ac.th',  'Dave Disabled',   NOW(), 'DISABLED');

-- ============================================================
-- 3) Assets
-- ============================================================
-- n | owner | visibility | original_name | display_name | description | file_type
--   | ext | size (bytes) | mime | width | height | status | created N days ago | deleted N days ago
INSERT INTO assets (
    asset_id, owner_id, visibility, original_name, display_name, description,
    file_type, file_extension, file_size, mime_type, image_width, image_height,
    s3_key, thumbnail_key, processing_status, created_at, updated_at, deleted_at)
SELECT
    ('22222222-2222-2222-2222-' || LPAD(v.n::text, 12, '0'))::uuid,
    u.user_id, v.visibility, v.original_name, v.display_name, v.description,
    v.file_type, v.ext, v.size, v.mime, v.w, v.h,
    'assets/22222222-2222-2222-2222-' || LPAD(v.n::text, 12, '0') || '/original.' || v.ext,
    CASE WHEN v.file_type = 'IMAGE' AND v.status = 'READY'
         THEN 'assets/22222222-2222-2222-2222-' || LPAD(v.n::text, 12, '0') || '/thumbnail.webp'
    END,
    v.status,
    NOW() - make_interval(days => v.created_days),
    NOW() - make_interval(days => v.created_days),
    CASE WHEN v.deleted_days IS NOT NULL THEN NOW() - make_interval(days => v.deleted_days) END
FROM (VALUES
    -- alice
    ( 1, 'alice', 'ORGANIZATION', 'annual-report-2025.pdf', 'รายงานประจำปี 2025', 'สรุปผลการดำเนินงานและงบการเงินปี 2025',
         'DOCUMENT', 'pdf', 2457600, 'application/pdf', NULL, NULL, 'READY', 40, NULL),
    ( 2, 'alice', 'ORGANIZATION', 'Q3 Marketing Plan.pdf', 'Q3 Marketing Plan', 'Campaign plan and budget for Q3',
         'DOCUMENT', 'pdf', 1048576, 'application/pdf', NULL, NULL, 'READY', 30, NULL),
    ( 3, 'alice', 'TEAM', 'phoenix-project-plan.pdf', 'แผนงานโปรเจกต์ Phoenix', 'Timeline และขอบเขตงานของโปรเจกต์ Phoenix',
         'DOCUMENT', 'pdf', 734003, 'application/pdf', NULL, NULL, 'READY', 20, NULL),
    ( 4, 'alice', 'TEAM', 'phoenix-mockup.png', 'Phoenix Mockup', 'หน้าจอต้นแบบของแอป Phoenix',
         'IMAGE', 'png', 1887437, 'image/png', 1920, 1080, 'READY', 18, NULL),
    ( 5, 'alice', 'TEAM', 'contractor-agreement-draft.pdf', 'ร่างสัญญาผู้รับเหมา', 'ยังไม่ได้แชร์เข้า collection ไหน',
         'DOCUMENT', 'pdf', 312320, 'application/pdf', NULL, NULL, 'READY', 12, NULL),
    ( 6, 'alice', 'PRIVATE', 'team-salary-2025.pdf', 'ข้อมูลเงินเดือนทีม 2025', 'เอกสารส่วนตัว',
         'DOCUMENT', 'pdf', 204800, 'application/pdf', NULL, NULL, 'READY', 10, NULL),
    ( 7, 'alice', 'ORGANIZATION', 'office-meeting.jpg', 'ประชุมทีมในออฟฟิศ', 'รูปประชุมประจำเดือน',
         'IMAGE', 'jpg', 3355443, 'image/jpeg', 4032, 3024, 'READY', 7, NULL),
    ( 8, 'alice', 'ORGANIZATION', 'team-outing.jpg', 'Team Outing', 'กำลังประมวลผล',
         'IMAGE', 'jpg', 4194304, 'image/jpeg', 4000, 3000, 'PROCESSING', 0, NULL),
    ( 9, 'alice', 'ORGANIZATION', 'scanned-contract.pdf', 'สัญญาฉบับสแกน', 'PDF สแกน ไม่มีข้อความให้ดึง',
         'DOCUMENT', 'pdf', 5242880, 'application/pdf', NULL, NULL, 'FAILED', 3, NULL),
    (10, 'alice', 'ORGANIZATION', 'old-policy.pdf', 'นโยบายเก่า', 'ถูกลบแล้ว ต้องไม่โผล่ที่ไหนเลย',
         'DOCUMENT', 'pdf', 102400, 'application/pdf', NULL, NULL, 'READY', 60, 2),
    (11, 'alice', 'ORGANIZATION', 'uploading.pdf', 'ไฟล์ที่ยังอัปโหลดไม่เสร็จ', 'สถานะ UPLOADING ไม่แสดงใน Library',
         'DOCUMENT', 'pdf', 0, 'application/pdf', NULL, NULL, 'UPLOADING', 0, NULL),
    (18, 'alice', 'TEAM', 'plan-2024.pdf', 'แผนงานปี 2024', 'อยู่ใน collection ที่ถูกลบแล้ว',
         'DOCUMENT', 'pdf', 409600, 'application/pdf', NULL, NULL, 'READY', 200, NULL),
    -- bob
    (12, 'bob', 'ORGANIZATION', 'onboarding-handbook.pdf', 'คู่มือพนักงานใหม่', 'สวัสดิการ การลา และขั้นตอนเริ่มงาน',
         'DOCUMENT', 'pdf', 1572864, 'application/pdf', NULL, NULL, 'READY', 90, NULL),
    (13, 'bob', 'ORGANIZATION', 'company-logo.png', 'โลโก้บริษัท', 'โลโก้สีหลักพื้นโปร่งใส',
         'IMAGE', 'png', 262144, 'image/png', 1024, 1024, 'READY', 100, NULL),
    (14, 'bob', 'TEAM', 'design-review.jpg', 'Design Review', 'รูปบอร์ดรีวิวงานออกแบบ',
         'IMAGE', 'jpg', 2097152, 'image/jpeg', 3000, 2000, 'READY', 15, NULL),
    (15, 'bob', 'PRIVATE', 'personal-notes.png', 'โน้ตส่วนตัว', 'เอกสารส่วนตัว',
         'IMAGE', 'png', 524288, 'image/png', 1200, 1600, 'READY', 5, NULL),
    -- carol
    (16, 'carol', 'ORGANIZATION', 'IT Security Guidelines.pdf', 'IT Security Guidelines', 'แนวปฏิบัติด้านความปลอดภัยของบริษัท',
         'DOCUMENT', 'pdf', 921600, 'application/pdf', NULL, NULL, 'READY', 50, NULL),
    (17, 'carol', 'ORGANIZATION', 'server-room.jpg', 'ห้องเซิร์ฟเวอร์', 'รูปห้องเซิร์ฟเวอร์หลัง renovate',
         'IMAGE', 'jpg', 2621440, 'image/jpeg', 3840, 2160, 'READY', 25, NULL)
) AS v (n, owner, visibility, original_name, display_name, description,
        file_type, ext, size, mime, w, h, status, created_days, deleted_days)
JOIN users u ON u.google_sub = 'seed-' || v.owner;

-- ============================================================
-- 4) Collections, members, asset links
-- ============================================================
INSERT INTO collections (collection_id, created_by, name, description, created_at, updated_at, deleted_at)
SELECT
    ('33333333-3333-3333-3333-' || LPAD(v.n::text, 12, '0'))::uuid,
    u.user_id, v.name, v.description,
    NOW() - make_interval(days => v.created_days),
    NOW() - make_interval(days => v.created_days),
    CASE WHEN v.deleted_days IS NOT NULL THEN NOW() - make_interval(days => v.deleted_days) END
FROM (VALUES
    (1, 'alice', 'Project Phoenix', 'เอกสารและงานออกแบบของโปรเจกต์ Phoenix', 21, NULL),
    (2, 'bob',   'Design Team',     'งานออกแบบของทีม Design',                  16, NULL),
    (3, 'alice', 'Archived 2024',   'collection ที่ถูกลบแล้ว',                  201, 3)
) AS v (n, creator, name, description, created_days, deleted_days)
JOIN users u ON u.google_sub = 'seed-' || v.creator;

INSERT INTO collection_members (collection_id, user_id, permission, added_by)
SELECT
    c.collection_id, u.user_id, v.permission, c.created_by
FROM (VALUES
    (1, 'alice', 'OWNER'),
    (1, 'bob',   'EDITOR'),
    (2, 'bob',   'OWNER'),
    (2, 'alice', 'VIEWER'),
    (3, 'alice', 'OWNER'),
    (3, 'bob',   'VIEWER')
) AS v (collection_n, member, permission)
JOIN collections c
  ON c.collection_id = ('33333333-3333-3333-3333-' || LPAD(v.collection_n::text, 12, '0'))::uuid
JOIN users u ON u.google_sub = 'seed-' || v.member;

-- TEAM assets are added by their owner only (rule in docs/plan/pare/07).
INSERT INTO asset_collection (asset_id, collection_id, added_by)
SELECT
    ('22222222-2222-2222-2222-' || LPAD(v.asset_n::text, 12, '0'))::uuid,
    ('33333333-3333-3333-3333-' || LPAD(v.collection_n::text, 12, '0'))::uuid,
    u.user_id
FROM (VALUES
    ( 2, 1, 'bob'),    -- ORGANIZATION asset added by an EDITOR
    ( 3, 1, 'alice'),
    ( 4, 1, 'alice'),
    (13, 2, 'bob'),
    (14, 2, 'bob'),
    (18, 3, 'alice')
) AS v (asset_n, collection_n, added_by)
JOIN users u ON u.google_sub = 'seed-' || v.added_by;

-- ============================================================
-- 5) Tags
-- ============================================================
INSERT INTO tags (name)
VALUES ('marketing'), ('report'), ('phoenix'), ('design'), ('hr'),
       ('security'), ('meeting'), ('รายงาน'), ('ประชุม')
ON CONFLICT DO NOTHING;

INSERT INTO asset_tags (asset_id, tag_id)
SELECT
    ('22222222-2222-2222-2222-' || LPAD(v.asset_n::text, 12, '0'))::uuid,
    t.tag_id
FROM (VALUES
    ( 1, 'report'), ( 1, 'รายงาน'),
    ( 2, 'marketing'), ( 2, 'report'),
    ( 3, 'phoenix'),
    ( 4, 'phoenix'), ( 4, 'design'),
    ( 7, 'meeting'), ( 7, 'ประชุม'),
    (12, 'hr'),
    (13, 'design'),
    (14, 'design'),
    (16, 'security'),
    (17, 'security')
) AS v (asset_n, tag)
JOIN tags t ON LOWER(BTRIM(t.name)) = v.tag;

-- ============================================================
-- 6) Document chunks (text only — embeddings come from the worker)
-- ============================================================
INSERT INTO document_chunks (asset_id, chunk_index, content)
SELECT
    ('22222222-2222-2222-2222-' || LPAD(v.asset_n::text, 12, '0'))::uuid,
    v.idx, v.content
FROM (VALUES
    ( 1, 0, 'รายงานประจำปี 2025 สรุปผลการดำเนินงานของบริษัท รายได้รวมเติบโตขึ้น 12% จากปีก่อน โดยมาจากลูกค้ากลุ่มองค์กรเป็นหลัก'),
    ( 1, 1, 'ด้านค่าใช้จ่าย บริษัทลดต้นทุนโครงสร้างพื้นฐานได้ 18% หลังย้ายระบบขึ้นคลาวด์ และมีแผนลงทุนด้าน AI ในปีหน้า'),
    ( 2, 0, 'Q3 marketing plan focuses on social media campaigns and partner events. Total budget is 1.2 million baht.'),
    ( 2, 1, 'Key metrics: website traffic, qualified leads, and conversion rate from free trial to paid plan.'),
    ( 3, 0, 'โปรเจกต์ Phoenix คือการย้ายระบบจัดเก็บไฟล์ขององค์กรขึ้น AWS แบ่งเป็น 3 ระยะ เริ่มไตรมาสที่ 4'),
    ( 3, 1, 'ความเสี่ยงหลักคือการย้ายข้อมูลเก่าและการอบรมผู้ใช้ ทีมต้องทำแผนสำรองก่อนปิดระบบเดิม'),
    ( 5, 0, 'ร่างสัญญาจ้างผู้รับเหมาพัฒนาระบบ ระยะเวลา 6 เดือน กำหนดส่งมอบงานทุกสิ้นเดือน'),
    ( 6, 0, 'ข้อมูลเงินเดือนของสมาชิกทีมปี 2025 เป็นความลับ ห้ามเผยแพร่'),
    -- #9 FAILED: text extraction failed, so no chunks
    (10, 0, 'นโยบายการทำงานเดิมที่ยกเลิกแล้ว'),
    (12, 0, 'คู่มือพนักงานใหม่ อธิบายสวัสดิการ วันลาพักร้อน 10 วันต่อปี และการเบิกค่ารักษาพยาบาล'),
    (12, 1, 'สัปดาห์แรกพนักงานใหม่จะได้รับอุปกรณ์ บัญชีอีเมลบริษัท และปฐมนิเทศกับฝ่ายบุคคล'),
    (16, 0, 'Use strong passwords and enable multi-factor authentication for every company account.'),
    (16, 1, 'Report phishing emails to the IT team immediately. Never share credentials over chat.'),
    (18, 0, 'แผนงานปี 2024 ของทีม Marketing ซึ่งปิดโครงการไปแล้ว')
) AS v (asset_n, idx, content);

-- ============================================================
-- 7) Processing workflows (examples of each status)
-- ============================================================
INSERT INTO processing_workflows (
    asset_id, process_type, status, error_message, attempt_no, created_at, started_at, completed_at)
VALUES
    ('22222222-2222-2222-2222-000000000001', 'TEXT_EXTRACTION', 'SUCCESS', NULL, 1,
        NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days' + INTERVAL '8 seconds'),
    ('22222222-2222-2222-2222-000000000008', 'IMAGE_EMBEDDING', 'PROCESSING', NULL, 1,
        NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '1 minute', NULL),
    ('22222222-2222-2222-2222-000000000009', 'TEXT_EXTRACTION', 'FAILED',
        'No extractable text: PDF appears to be a scanned image', 1,
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '5 seconds'),
    ('22222222-2222-2222-2222-000000000009', 'TEXT_EXTRACTION', 'FAILED',
        'No extractable text: PDF appears to be a scanned image', 2,
        NOW() - INTERVAL '3 days' + INTERVAL '1 minute', NOW() - INTERVAL '3 days' + INTERVAL '1 minute',
        NOW() - INTERVAL '3 days' + INTERVAL '65 seconds');

COMMIT;

-- ============================================================
-- Verification
-- ============================================================
-- 1) Access rule (visibleAssetsWhere). Expected: alice 16, bob 14, carol 10.
--    bob must see #3, #4 (Phoenix) but not #5 (TEAM, no collection) or #18 (collection deleted).
--    carol must not see any TEAM or PRIVATE asset. Nobody sees #10 (deleted).
SELECT viewer.display_name AS viewer, COUNT(*) AS visible_assets
FROM users viewer
CROSS JOIN assets a
WHERE viewer.google_sub IN ('seed-alice', 'seed-bob', 'seed-carol')
  AND a.owner_id IN (SELECT user_id FROM users WHERE google_sub LIKE 'seed-%')
  AND a.deleted_at IS NULL
  AND (
        a.owner_id = viewer.user_id
     OR a.visibility = 'ORGANIZATION'
     OR (a.visibility = 'TEAM' AND EXISTS (
            SELECT 1
            FROM asset_collection ac
            JOIN collections c
              ON c.collection_id = ac.collection_id AND c.deleted_at IS NULL
            JOIN collection_members cm
              ON cm.collection_id = ac.collection_id AND cm.user_id = viewer.user_id
            WHERE ac.asset_id = a.asset_id))
  )
GROUP BY viewer.display_name
ORDER BY viewer.display_name;

-- 2) Dashboard for alice. Expected: 11 assets (8 DOCUMENT, 3 IMAGE), excludes #10.
SELECT a.file_type, COUNT(*) AS assets, SUM(a.file_size) AS bytes
FROM assets a
JOIN users u ON u.user_id = a.owner_id
WHERE u.google_sub = 'seed-alice' AND a.deleted_at IS NULL
GROUP BY ROLLUP (a.file_type)
ORDER BY a.file_type;
