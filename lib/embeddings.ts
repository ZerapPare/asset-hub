import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

// ตัวกลางฝั่ง server: ส่งข้อความ/รูปไป AWS แล้วรับ vector กลับมา
// เปลี่ยนโมเดลให้แก้ที่นี่จุดเดียว; vector เก่าต้องสร้างใหม่ด้วยโมเดลเดียวกัน
// Dev ใช้ AWS CLI profile ในเครื่อง ส่วน Lambda ใช้ IAM role ของตัวเอง

/** แปลงเนื้อหาเอกสารและคำค้นเอกสารเป็น vector */
export const TEXT_MODEL = "amazon.titan-embed-text-v2:0";
/** แปลงรูปและคำค้นรูปเป็น vector ชุดเดียวกัน (คำค้นต้องเป็นอังกฤษ) */
export const IMAGE_MODEL = "amazon.titan-embed-image-v1";

/** จำนวนตัวเลขใน vector ต้องตรงกับ VECTOR(1024) ในฐานข้อมูล */
export const EMBEDDING_DIMENSIONS = 1024;

// Titan ไม่มีที่ Singapore จึงเลือก Mumbai/Sydney ผ่าน .env; Translate ยังใช้ Singapore
const BEDROCK_REGION = process.env.BEDROCK_REGION ?? "ap-south-1";
const TRANSLATE_REGION = process.env.AWS_REGION ?? "ap-southeast-1";

/** Error กลางของงาน AI เพื่อให้ worker/search แยกจาก error ประเภทอื่นได้ */
export class EmbeddingError extends Error {}

/** ใช้ AbortSignal จำกัดเวลารวม: แนะนำ Search 8 วินาที, worker 30 วินาที */
export type CallOptions = { signal?: AbortSignal };

// Client จัดการ endpoint, credentials, ลายเซ็น AWS, connection และ retry ให้เรา
function createClients() {
  // ให้เวลาเชื่อม 5 วินาทีและรอคำตอบ 30 วินาที; ผู้เรียกยกเลิกเร็วกว่านี้ได้
  const requestHandler = { connectionTimeout: 5_000, requestTimeout: 30_000 };
  return {
    // บัญชีใหม่มีโควตา Bedrock ต่อนาทีต่ำ → ThrottlingException เมื่อ worker ยิงหลาย chunk
    // adaptive: SDK ชะลออัตราส่งเองเมื่อโดน throttle + retry หลายรอบ (ฝั่งค้นหาจำกัดเวลารวมด้วย AbortSignal)
    bedrock: new BedrockRuntimeClient({ region: BEDROCK_REGION, requestHandler, retryMode: "adaptive", maxAttempts: 8 }),
    translate: new TranslateClient({ region: TRANSLATE_REGION, requestHandler }),
  };
}

// เก็บ client ไว้ใช้ซ้ำ เพื่อไม่เปิด HTTPS connection ใหม่ทุกครั้งที่ Next.js hot reload
const globalForEmbeddings = globalThis as unknown as { embeddingClients?: ReturnType<typeof createClients> };

const clients = globalForEmbeddings.embeddingClients ?? createClients();

if (process.env.NODE_ENV !== "production") globalForEmbeddings.embeddingClients = clients;

/** ส่งข้อมูลไป Bedrock แล้วตรวจว่าคำตอบเป็น vector 1024 ค่า */
async function invoke(modelId: string, body: unknown, { signal }: CallOptions): Promise<number[]> {
  let embedding: unknown;
  try {
    const response = await clients.bedrock.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
      }),
      { abortSignal: signal },
    );
    // AWS ตอบเป็น bytes: ถอดเป็นข้อความ JSON แล้วอ่านค่า embedding
    ({ embedding } = JSON.parse(new TextDecoder().decode(response.body)) as { embedding?: unknown });
  } catch (error) {
    throw new EmbeddingError(`Bedrock ${modelId} failed`, { cause: error });
  }
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError(`Bedrock ${modelId} returned an unexpected embedding`);
  }
  return embedding as number[];
}

/** เอกสารและคำค้นต้องใช้โมเดลเดียวกัน จึงนำ vector มาเทียบกันได้ */
export function embedText(text: string, options: CallOptions = {}) {
  return invoke(TEXT_MODEL, { inputText: text, dimensions: EMBEDDING_DIMENSIONS, normalize: true }, options);
}

/** แปลงรูป JPEG/PNG เป็น Base64 แล้วขอ image vector (worker ต้องย่อรูปก่อน) */
export function embedImage(image: Uint8Array, options: CallOptions = {}) {
  return invoke(
    IMAGE_MODEL,
    { inputImage: Buffer.from(image).toString("base64"), embeddingConfig: { outputEmbeddingLength: EMBEDDING_DIMENSIONS } },
    options,
  );
}

/** สร้าง query vector สำหรับค้นรูป โดยใช้ IMAGE_MODEL ตัวเดียวกับรูป */
export function embedTextForImages(text: string, options: CallOptions = {}) {
  return invoke(IMAGE_MODEL, { inputText: text, embeddingConfig: { outputEmbeddingLength: EMBEDDING_DIMENSIONS } }, options);
}

const THAI = /[฀-๿]/;

export function hasThai(text: string) {
  return THAI.test(text);
}

/**
 * แปลคำค้นรูปจากไทยเป็นอังกฤษ เพราะ Titan Multimodal รองรับคำค้นอังกฤษ
 * ระบุ "th" ตรงๆ เพื่อไม่ต้องเรียกบริการตรวจภาษาเพิ่ม
 */
export async function translateToEnglish(text: string, { signal }: CallOptions = {}) {
  try {
    const { TranslatedText } = await clients.translate.send(
      new TranslateTextCommand({ Text: text, SourceLanguageCode: "th", TargetLanguageCode: "en" }),
      { abortSignal: signal },
    );
    if (!TranslatedText) throw new Error("empty translation");
    return TranslatedText;
  } catch (error) {
    throw new EmbeddingError("Translate th→en failed", { cause: error });
  }
}

/** แปลง [0.1, 0.2] เป็น "[0.1,0.2]" เพื่อส่งให้คอลัมน์ pgvector */
export function toVector(values: number[]) {
  return `[${values.join(",")}]`;
}
