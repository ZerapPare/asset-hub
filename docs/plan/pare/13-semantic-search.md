# 13 — Semantic Search (แผนลงมือทำ)

> เจ้าของ: **คนที่ 2** (Search & Data Cloud ตาม [00](00-overview.md)) — สถานะ: ร่าง ยังไม่ได้แก้โค้ด
> จุดที่ต้องตกลงกับคนที่ 1: IAM ของ web Lambda (ขั้น 7), การแก้หน้า `/assets` (ขั้น 6)

## สรุปสั้น
- ใช้ **Titan ของ Amazon** สองตัวตามเดิม (หักจาก Free Tier credit ได้ — Cohere คิดผ่าน AWS Marketplace จึงไม่เข้า credit)
- Titan **ไม่มีในสิงคโปร์** → เรียก Bedrock ข้ามไป region ที่มี (ตั้งด้วย env `BEDROCK_REGION`) ส่วนอื่นอยู่สิงคโปร์เหมือนเดิม
- คำค้นภาษาไทยสำหรับ **รูป** → แปลเป็นคำค้นอังกฤษด้วย **Amazon Nova Micro** (Bedrock) ก่อน (Titan Multimodal รับแค่อังกฤษ)
  - เดิมวางแผนใช้ Amazon Translate แต่บัญชี free plan ติด `SubscriptionRequiredException` — Nova เป็นโมเดลของ Amazon หัก credit ได้, ใช้ Bedrock client/IAM ตัวเดียวกัน และแปลเป็น *คำค้น* ได้ดีกว่า
- ไม่ให้เว็บช้า: embedding ทำ **หลัง** ไฟล์ READY, ตอนค้นยิง Bedrock **พร้อมกัน** + **cache** embedding ของคำค้น + **fallback เป็น Keyword** เมื่อช้า/ล้ม
- ค่าใช้จ่ายส่วนนี้ **< $1–2/เดือน** (ก้อนใหญ่คือ RDS + NAT ไม่ใช่ Bedrock)

---

## 1. โมเดลและบริการที่ใช้

| ใช้ทำอะไร | โมเดล / บริการ | Region | ค่าที่ตั้ง |
|---|---|---|---|
| embed **chunk ของเอกสาร** และ **คำค้นฝั่งเอกสาร** | `amazon.titan-embed-text-v2:0` | `BEDROCK_REGION` | `dimensions: 1024`, `normalize: true` |
| embed **รูป** และ **คำค้นฝั่งรูป** | `amazon.titan-embed-image-v1` (Titan Multimodal G1) | `BEDROCK_REGION` | `outputEmbeddingLength: 1024` |
| แปลคำค้นไทย → อังกฤษ (เฉพาะฝั่งรูป) | Amazon Nova Micro ผ่าน Converse API (`apac.amazon.nova-micro-v1:0`) | `BEDROCK_REGION` (inference profile APAC) | `temperature: 0`, `maxTokens: 60`, ตัดเหลือบรรทัดแรก |

### ข้อจำกัดของโมเดลที่ต้องรู้
| | Titan Text V2 | Titan Multimodal G1 |
|---|---|---|
| ข้อความยาวสุด | 8,192 token | **256 token** |
| ภาษา | หลายภาษา (รวมไทย) | **อังกฤษเท่านั้น** |
| รูป | — | ≤ 25 MB, ≤ 2048×2048 px, PNG/JPEG |
| ขนาดเวกเตอร์ | 1024 | 1024 |

- เวกเตอร์ 1024 มิติตรงกับ `VECTOR(1024)` ใน `0001_schema.sql` และ HNSW index (`vector_cosine_ops`) ใน `0002_indexes.sql` แล้ว → **ไม่ต้องแก้ตาราง embedding**
- เวกเตอร์ของสองโมเดลอยู่คนละ space เทียบกันตรงๆ ไม่ได้ (ADR-2) → ค้นเอกสารกับรูปแยกกันแล้วค่อยรวมผล

### `BEDROCK_REGION`
- ตัวเลือก: **`ap-south-1` (Mumbai)** หรือ `ap-southeast-2` (Sydney) — มีครบทั้งสองโมเดล
- ค่าเริ่มต้น `ap-south-1` (น่าจะใกล้สิงคโปร์กว่า) → หลัง deploy ดูเวลาใน log แล้วเลือกตัวที่เร็วกว่า เปลี่ยนแค่ env

### การแปลด้วย Nova Micro
- Nova Micro ไม่มี on-demand แบบ in-region ใน Mumbai/Singapore → ต้องเรียกด้วย inference profile `apac.amazon.nova-micro-v1:0` (ทดสอบแล้วใช้ได้จาก `ap-south-1` และ `ap-southeast-1`) ประมวลผลภายในภูมิภาค APAC
- เป็น LLM อาจตอบเกิน → system prompt สั่งให้ตอบแค่คำค้นบรรทัดเดียว, `temperature: 0`, จำกัด token, ตัดเหลือบรรทัดแรก/ตัดเครื่องหมายคำพูด
- ผลแปลใช้เป็นแค่ข้อความสำหรับ embed (ไม่แสดงผล/ไม่รันต่อ) และถูกเก็บใน cache — prompt injection จากคำค้นไม่มีผลเสีย
- เราเช็กเองได้ว่ามีอักษรไทยไหมด้วย regex `/[฀-๿]/` → ไม่มีอักษรไทย = ไม่ต้องแปล

---

## 2. ภาพรวม flow

### 2.1 ตอนอัปโหลด (worker — เบื้องหลัง)
```
SQS → worker
  ├─ (เดิม) ดึงข้อความ + แบ่ง chunk / ทำ thumbnail → READY ✅  ← ผู้ใช้เปิด/ดาวน์โหลด/keyword search ได้ทันที
  └─ (ใหม่) embedding — ทำต่อหลัง READY ใน invocation เดียวกัน
        ├─ DOCUMENT: chunk ที่ยังไม่มี embedding → Titan Text V2 (ทีละ 5 พร้อมกัน) → document_embeddings
        └─ IMAGE:    ย่อรูปเป็น JPEG ≤ 1024px → Titan Multimodal → image_embeddings
     ล้มเหลว = workflow FAILED แต่ asset ยัง READY (แค่ยังค้นแบบ semantic ไม่เจอ)
```

### 2.2 ตอนค้นหา (web — ผู้ใช้รออยู่)
```
q = "แมวสีส้ม", type = (ทั้งหมด | document | image)
  │
  ├─ normalize q (trim, ตัดช่องว่างซ้ำ, lowercase, ≤ 200 ตัวอักษร)
  ├─ หา embedding ใน cache (query_embeddings) ── เจอ ──▶ ใช้เลย
  │                                     └─ ไม่เจอ ─▶ เรียกพร้อมกัน (Promise.all):
  │        ├─ [type ≠ image]    Titan Text V2(q)
  │        └─ [type ≠ document] มีอักษรไทย? → Nova Micro(q) → Titan Multimodal(q_en)
  │      แล้วเขียนลง cache
  ├─ SQL เดียว (statement_timeout 3s, hnsw.iterative_scan = relaxed_order)
  │     doc_hits  : document_embeddings ⨝ chunks ⨝ assets (สิทธิ์ + READY + ไม่ถูกลบ + ตัวกรอง) เรียงตามระยะ
  │     img_hits  : image_embeddings ⨝ assets (เงื่อนไขเดียวกัน)
  │     รวมผลด้วย RRF → 50 รายการ + snippet จาก chunk ที่ใกล้ที่สุด
  └─ เกินเวลา / Bedrock ล้ม → แสดงผล Keyword แทน + ข้อความแจ้ง
```

- **กรองประเภทแล้วข้าม Bedrock ได้**: ผู้ใช้เลือก "เอกสาร" → ไม่ต้อง embed ฝั่งรูปเลย (เร็วขึ้น + ไม่ต้องแปล)

---

## 3. สิ่งที่ต้องทำ (เรียงตามลำดับ)

### ขั้น 1 — Migration `db/migrations/0006_query_embeddings.sql`
ตาราง cache ของคำค้น (ไม่ผูกกับ user — เก็บแค่ข้อความคำค้น)

```sql
CREATE TABLE query_embeddings (
    embedding_model TEXT NOT NULL,
    query TEXT NOT NULL,              -- คำค้นที่ normalize แล้ว
    model_input TEXT NOT NULL,        -- ข้อความที่ส่งเข้าโมเดลจริง (multimodal = คำแปลอังกฤษ)
    embedding VECTOR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (embedding_model, query)
);
CREATE INDEX idx_query_embeddings_last_used ON query_embeddings (last_used_at);
```
- ลบแถวที่ `last_used_at` เก่ากว่า 30 วัน — ใส่ใน cleanup job ลบถาวร ([05](05-edit-delete.md)) ตัวเดียวกัน
- อัปเดต `last_used_at` เฉพาะเมื่อเก่ากว่า 1 วัน (ไม่ให้ทุกการค้นเป็นการเขียน DB)
- อัปเดตตาราง migration ใน `db/README.md`

### ขั้น 2 — `lib/embeddings.ts` (โมดูลเดียวที่คุยกับ Bedrock)
```ts
export const TEXT_MODEL = "amazon.titan-embed-text-v2:0";
export const IMAGE_MODEL = "amazon.titan-embed-image-v1";

embedText(text: string): Promise<number[]>          // Titan Text V2
embedImage(jpeg: Uint8Array): Promise<number[]>     // Titan Multimodal (inputImage base64)
embedTextForImages(text: string): Promise<number[]> // Titan Multimodal (inputText)
translateToEnglish(text: string): Promise<string>   // Nova Micro: คำค้นไทย → คำค้นอังกฤษ
hasThai(text: string): boolean
toVector(values: number[]): string                  // "[0.1,0.2,…]" สำหรับ ::vector ใน postgres.js
```
- สร้าง `BedrockRuntimeClient` **ครั้งเดียวระดับ module** (ใช้ทั้ง embedding และแปล) (ไม่สร้างใหม่ทุก request → ไม่ต้อง handshake HTTPS ข้าม region ซ้ำ)
- ตั้ง timeout ของ HTTP: connect ~1s, request ~2.5s, `maxAttempts: 2` (ฝั่งเว็บ) — worker ใช้ค่าที่หลวมกว่าได้
- log เวลาที่ใช้ต่อการเรียก (`[bedrock] text 182ms`) ไว้เทียบ region
- ถ้าวันหนึ่งเปลี่ยนโมเดล (เช่น Cohere Embed v4) แก้แค่ไฟล์นี้ + รัน backfill — ตารางมีคอลัมน์ `embedding_model` แยกรุ่นไว้แล้ว
- dependency ใหม่: `@aws-sdk/client-bedrock-runtime` (ตัวเดียว)

### ขั้น 3 — Worker: `lib/processing/embed.ts` + ต่อเข้า `processAsset`
**`embedDocument(assetId)`**
1. เริ่ม workflow `TEXT_EMBEDDING`
2. เลือก chunk ที่ **ยังไม่มี** embedding ของ `TEXT_MODEL` (LEFT JOIN) → รันซ้ำได้ ทำต่อจากที่ค้างได้
3. เรียก `embedText` ทีละ **5 พร้อมกัน** (helper `mapLimit` เล็กๆ ไม่ต้องลง library)
4. insert เป็น batch `ON CONFLICT (chunk_id, embedding_model) DO NOTHING` (SQS ส่งซ้ำได้ไม่เป็นไร)
5. ไม่มี chunk (PDF ภาพสแกน) = SUCCESS โดยไม่เรียก Bedrock
6. chunk ถูกลบกลางทาง (ประมวลผลใหม่/ลบไฟล์) → insert ชน FK (`23503`) = ข้ามเงียบๆ

**`embedImage(assetId, data)`**
1. เริ่ม workflow `IMAGE_EMBEDDING`
2. ใช้ไฟล์ที่ worker ดาวน์โหลดไว้แล้ว (ไม่ดาวน์โหลดซ้ำ) → `sharp` ย่อด้านยาว ≤ 1024px เป็น JPEG (Titan ไม่รับ WebP)
3. `embedImage` → upsert `image_embeddings`

**ต่อเข้า `processAsset`** (`lib/processing/worker.ts`)
- เรียกหลัง `finishDocument` / `finishImage` คืน `true` (READY แล้ว) ใน `try/catch` ของตัวเอง
- error ของ embedding **ไม่โยนต่อ** → asset ยัง READY, workflow บันทึก `FAILED` + เหตุผล
- เหตุผลที่ไม่ให้ SQS retry: รอบ retry ถูกกรองด้วย `processing_status = 'PROCESSING'` จะ SKIPPED อยู่ดี → ใช้ retry ของ SDK + สคริปต์ backfill แทน
- เวลาโดยประมาณ: PDF 500 chunk ÷ 5 พร้อมกัน × ~0.15s ≈ 15s → ตั้ง timeout ของ worker Lambda ≥ 2 นาที

### ขั้น 4 — สคริปต์ backfill
`npm run process:pending -- --embeddings`
- หา asset ที่ READY แต่ยังไม่มี embedding ของโมเดลปัจจุบัน → เรียก `embedDocument` / `embedImage`
- ใช้กับ: ไฟล์ที่อัปโหลดก่อนมีฟีเจอร์นี้, embedding ที่ล้มเหลว, ตอนเปลี่ยนโมเดล

### ขั้น 5 — ตัวค้น: `lib/assets/semantic.ts`
```ts
semanticSearch(userId, q, options): Promise<SearchResult[]>
```
1. `normalizeSearchQuery` (ตัวเดิมใน `lib/assets/search.ts`) + lowercase/ยุบช่องว่าง สำหรับ key ของ cache
2. หา/สร้าง embedding ตาม flow ข้อ 2.2 (ข้ามฝั่งที่ถูกกรองออก)
3. Query (ใน transaction เดียว):
   ```sql
   SET LOCAL statement_timeout = '3s';
   SET LOCAL hnsw.iterative_scan = relaxed_order;  -- pgvector >= 0.8 (RDS 16.5+, docker pg16 ล่าสุด)
   ```
   - `doc_hits`: เรียง `de.embedding <=> $q_text` จำกัด ~200 แถว → `DISTINCT ON (asset_id)` เก็บ chunk ที่ใกล้สุดไว้ทำ snippet
   - `img_hits`: เรียง `ie.embedding <=> $q_image`
   - เงื่อนไขทุกฝั่ง: `visibleAssetsWhere(userId)`, `processing_status = 'READY'`, `deleted_at IS NULL`, `embedding_model = <โมเดลปัจจุบัน>`, `assetFilters(userId, options)` (ใช้ตัวเดียวกับ Keyword Search)
   - ตัดผลที่ระยะ (cosine distance) เกิน `MAX_DISTANCE` — ค่าเริ่มต้นตั้งหลวมไว้ก่อน แล้ว **จูนด้วยข้อมูลจริง** (แยกค่าเอกสาร/รูป)
4. รวมสองฝั่งด้วย **Reciprocal Rank Fusion**: `score = 1/(60 + rank_doc) + 1/(60 + rank_img)` → ไม่ต้องเทียบระยะข้ามโมเดล
5. เรียง: ค่าเริ่มต้น "ใกล้เคียงที่สุด" (RRF) / "ใหม่สุด" (`created_at` ของรายการที่ผ่านเกณฑ์) — ตรงกับ `sortOptions.semantic` เดิม
6. คืน `SearchResult[]` รูปแบบเดิม (`matchedIn: []`, `snippet` จาก chunk) → **UI ไม่ต้องเปลี่ยนโครง**

### ขั้น 6 — หน้า `/assets`
- แทน `mockSemanticSearch` ใน `app/(app)/assets/page.tsx` ด้วย `semanticSearch`
- จับ error/timeout ของ Bedrock → เรียก `searchAssets` (Keyword) แทน + แสดงข้อความ "ค้นหาด้วยความหมายไม่สำเร็จ แสดงผลจากคำค้นแทน"
- โหมดเริ่มต้นยังเป็น Keyword (Semantic ให้ผู้ใช้กดเลือก — UI มีปุ่มอยู่แล้ว)
- หน้าใช้ `Suspense` + skeleton อยู่แล้ว → หน้าเว็บขึ้นทันที ผลค่อยตามมา
- ลบ `components/search/mock.ts`

### ขั้น 7 — Infra + เอกสาร
- `.env.example`: เพิ่ม `BEDROCK_REGION=ap-south-1`
- IAM (ใส่ตอนเขียน `infra/web.ts`, `infra/processing.ts`):
  | Lambda | สิทธิ์ |
  |---|---|
  | worker | `bedrock:InvokeModel` บน `arn:aws:bedrock:<BEDROCK_REGION>::foundation-model/amazon.titan-embed-text-v2:0` และ `.../amazon.titan-embed-image-v1` |
  | web | สิทธิ์ Bedrock ชุดเดียวกัน + Nova Micro: `bedrock:InvokeModel` บน inference profile `arn:aws:bedrock:<BEDROCK_REGION>:<account>:inference-profile/apac.amazon.nova-micro-v1:0` และ `arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0` (profile ส่งต่อไป region อื่นใน APAC) |
- Lambda เรียก Bedrock ผ่าน **NAT** ที่มีอยู่ — ไม่ต้องมี Bedrock Interface Endpoint
- อัปเดตเอกสาร: ADR-2 ใน [01](01-architecture-decisions.md) (region, Nova Micro แทน Translate, เหตุผลที่ไม่ใช้ Cohere), ปิดข้อ 10 ใน [12](12-open-questions.md) (ตัด Bedrock Interface Endpoint), แก้ข้อความใน proposal เรื่องข้อมูลไม่ออกนอก region

### Dev ในเครื่อง
- ใช้ Postgres ใน docker + **เรียก Bedrock ตัวจริง** ด้วย AWS CLI profile (SDK หา credentials จาก `~/.aws` เอง) — ไม่ต้องเปิด NAT/RDS
- ไม่มี credentials / เรียกไม่สำเร็จ → หน้าเว็บ fallback เป็น Keyword ตามขั้น 6 (dev ต่อได้แม้ไม่มี AWS)

---

## 4. การทดสอบ

| ทดสอบ | ผลที่ต้องได้ |
|---|---|
| อัปโหลด PDF ภาษาไทย / อังกฤษ | READY ก่อน แล้ว `document_embeddings` มีแถวครบทุก chunk, workflow `TEXT_EMBEDDING` = SUCCESS |
| อัปโหลดรูป JPG / PNG / WEBP | `image_embeddings` 1 แถว, workflow `IMAGE_EMBEDDING` = SUCCESS |
| PDF ภาพสแกน (ไม่มีข้อความ) | READY, `TEXT_EMBEDDING` = SUCCESS แบบ 0 chunk |
| ค้นเอกสารด้วยคำไทยที่ไม่ตรงตัวอักษร (เช่น "รายได้เพิ่มขึ้น" หาเอกสารที่เขียน "เติบโต") | เจอเอกสารที่เกี่ยวข้อง |
| ค้นรูปด้วยคำไทย ("แมวสีส้ม") | log มีคำแปล, เจอรูปที่เกี่ยวข้อง |
| ค้นคำเดิมซ้ำ | ครั้งที่สองไม่เรียก Bedrock (ดู log) และเร็วขึ้นชัดเจน |
| เลือกประเภท "เอกสาร" | ไม่เรียก Multimodal / Nova |
| ตั้ง `BEDROCK_REGION` ผิด หรือไม่มี credentials | ได้ผล Keyword + ข้อความแจ้ง ไม่ error ทั้งหน้า |
| asset PRIVATE ของคนอื่น / ถูกลบ / ยังไม่ READY | ไม่โผล่ในผล |
| รัน backfill ซ้ำสองรอบ | รอบสองไม่เรียก Bedrock (ไม่มีอะไรค้าง) |
| วัดเวลา Mumbai vs Sydney | เลือก region ที่เร็วกว่าใส่ `BEDROCK_REGION` |

---

## 5. ค่าใช้จ่ายโดยประมาณ (ต่อเดือน, หัก credit)
สมมติ PDF 500 ไฟล์ (~1 ล้านตัวอักษร), รูป 1,000 รูป, ค้นแบบ semantic 3,000 ครั้ง

| รายการ | ประมาณ |
|---|---:|
| Titan Text V2 (เอกสาร + คำค้น) | ~$0.01–0.03 |
| Titan Multimodal (รูป + คำค้น) | ~$0.06–0.10 |
| Nova Micro (แปลคำค้นไทย) | < $0.01 |
| Data transfer ข้าม region | < $0.05 |
| **รวม** | **< $1** |

---

## 6. Tradeoff ที่ยอมรับ
- เนื้อหาเอกสาร/รูปถูกส่งไปประมวลผลที่ Mumbai/Sydney (ผ่าน HTTPS) — ต้องแก้ข้อความใน proposal
- ไฟล์ใหม่ค้นแบบ semantic ได้ช้ากว่า keyword ไม่กี่วินาที–นาที
- เก็บข้อความคำค้นใน cache (ไม่ผูก user, ลบเมื่อไม่ได้ใช้ 30 วัน)
- คำแปลอาจคลาดกับศัพท์เฉพาะ — ยังดีกว่าส่งภาษาไทยเข้า Multimodal ตรงๆ
- คำค้นไทยครั้งแรก (ยังไม่อยู่ใน cache) ช้า ~1 วินาที เพราะต้องแปลก่อน embed ฝั่งรูป
- ค้นครั้งแรกหลัง Lambda cold start ช้ากว่าปกติ ~0.5–1s

## 7. ไม่ทำในรอบนี้
- Hybrid (รวมคะแนน Keyword + Semantic ในผลเดียว)
- Rerank ด้วยโมเดลอีกตัว
- embed ภาพหน้าแรกของ PDF (ช่วย PDF ภาพสแกน) — ทำได้ภายหลังด้วยภาพที่ render ไว้ทำ thumbnail อยู่แล้ว
- ย้ายไป Cohere Embed v4 (ต้องอัปเกรด paid plan + จ่ายผ่าน Marketplace)

## Checklist
- [ ] แจ้งคนที่ 1: web Lambda ต้องได้สิทธิ์ Bedrock (Titan + Nova Micro) ใน `infra/web.ts` และจะแก้ semantic ในหน้า `/assets`
- [x] ขั้น 1 migration `0006_query_embeddings.sql`
- [x] ขั้น 2 `lib/embeddings.ts`
- [x] ขั้น 3 embedding ใน worker
- [x] ขั้น 4 backfill `--embeddings`
- [x] ขั้น 5 `lib/assets/semantic.ts`
- [x] ขั้น 6 แทน mock ในหน้า `/assets` + fallback
- [ ] ขั้น 7 env, IAM, ADR-2, open question ข้อ 10 — ✅ env/IAM ของ worker (`infra/processing.ts`), ADR-2, ปิดข้อ 10 แล้ว · เหลือ IAM ของ web ใน `infra/web.ts` (คนที่ 1) และแก้ข้อความใน proposal
- [x] CloudWatch alarm เมื่อมีข้อความใน DLQ (+ อีเมลผ่าน SNS ถ้าตั้ง `ALARM_EMAIL`)
- [x] retry embedding อัตโนมัติบน AWS: cron `lib/processing/maintenance.ts` (ทุก 30 นาที, `infra/processing.ts`) — ทำ embedding ที่ขาด + ส่งไฟล์ที่ค้าง PROCESSING เข้าคิวใหม่ (ยังไม่ได้ deploy)
- [x] worker Lambda: timeout 10 นาที, SQS visibility timeout 15 นาที, DLQ หลังส่ง 3 รอบ (`infra/processing.ts`, ยังไม่ได้ deploy)
- [x] กัน throttle ตอนอัปโหลดพร้อมกัน: SQS `maximumConcurrency: 2` (`infra/processing.ts`) — ถ้ายังโดน throttle ค่อยลด `CONCURRENCY` ใน `embed.ts` หรือขอเพิ่มโควตา Bedrock
- [x] เปลี่ยนตัวแปลคำค้นจาก Amazon Translate (ติด `SubscriptionRequiredException`) เป็น Nova Micro
- [ ] (ไม่เร่ง) Dashboard แสดงจำนวนไฟล์ที่ยังค้นแบบ semantic ไม่ได้ (embedding FAILED/ยังไม่มี)
- [ ] ทดสอบตามข้อ 4 + เลือก `BEDROCK_REGION`
- [ ] จูน `MAX_DISTANCE` ด้วยข้อมูลจริง
