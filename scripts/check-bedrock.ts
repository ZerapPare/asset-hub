// ทดสอบ AWS จริง: วัดเวลาและเช็กว่า vector ที่เกี่ยวข้องมีคะแนนใกล้กันกว่า
//   npx tsx --env-file=.env.local scripts/check-bedrock.ts
//   BEDROCK_REGION=ap-southeast-2 npx tsx --env-file=.env.local scripts/check-bedrock.ts
// เสียเงินไม่ถึง $0.001 ต่อรอบ (หัก credit)
import sharp from "sharp";
import {
  embedImage,
  embedText,
  embedTextForImages,
  hasThai,
  IMAGE_MODEL,
  TEXT_MODEL,
  translateToEnglish,
} from "@/lib/embeddings";

// คะแนนใกล้ 1 หมายถึง vector สองชุดมีความหมาย/ทิศทางใกล้กัน
function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
}

// รันงานหนึ่งครั้ง พร้อมพิมพ์เวลาที่ใช้เป็นมิลลิวินาที
async function timed<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  console.log(`  ${label.padEnd(28)} ${Math.round(performance.now() - start)} ms`);
  return result;
}

async function main() {
  // แสดง Region ก่อนทดสอบ ป้องกันสับสนว่ากำลังเรียก Mumbai หรือ Sydney
  console.log(`BEDROCK_REGION=${process.env.BEDROCK_REGION ?? "ap-south-1 (default)"}  AWS_REGION=${process.env.AWS_REGION}`);

  console.log(`\n${TEXT_MODEL}`);
  // ครั้งแรกต้องเปิด connection (cold); ครั้งถัดไปใช้ connection เดิม (warm)
  const query = await timed("query (cold)", () => embedText("รายได้เพิ่มขึ้นจากปีที่แล้ว"));
  const related = await timed("related doc (warm)", () => embedText("ยอดขายปีนี้เติบโต 12% เทียบกับปีก่อน"));
  const unrelated = await timed("unrelated doc (warm)", () => embedText("วิธีเปลี่ยนรหัสผ่าน Wi-Fi ในสำนักงาน"));
  // related ควรได้คะแนนสูงกว่า unrelated หาก text embedding ทำงานสมเหตุสมผล
  console.log(`  dims=${query.length}  similarity related=${cosine(query, related).toFixed(3)}  unrelated=${cosine(query, unrelated).toFixed(3)}`);

  console.log(`\nTranslate (${process.env.AWS_REGION})`);
  const thai = "แมวสีส้ม";
  let english = "orange cat";
  try {
    // Titan Multimodal รับคำค้นอังกฤษ จึงแปลเฉพาะเมื่อพบอักษรไทย
    if (hasThai(thai)) english = await timed(`"${thai}"`, () => translateToEnglish(thai));
    console.log(`  → "${english}"`);
  } catch (error) {
    // ทดสอบ Multimodal ต่อด้วยคำอังกฤษสำรอง — หน้าค้นหาจริงก็ fallback แบบนี้เมื่อ Translate ล้ม
    const cause = (error as Error).cause as Error | undefined;
    console.log(`  FAILED: ${cause?.name ?? ""} ${cause?.message ?? (error as Error).message}`);
    console.log(`  ใช้ "${english}" แทน`);
  }

  console.log(`\n${IMAGE_MODEL}`);
  // สร้างรูปทดสอบในหน่วยความจำ ไม่ต้องมีไฟล์รูปบนเครื่อง
  const orange = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#ff8800" } }).jpeg().toBuffer();
  const image = await timed("orange square image", () => embedImage(orange));
  // รูปและข้อความต้องผ่าน IMAGE_MODEL ตัวเดียวกันก่อนคำนวณ similarity
  const textOrange = await timed(`"${english}" (warm)`, () => embedTextForImages(english));
  const textBlue = await timed(`"blue ocean" (warm)`, () => embedTextForImages("blue ocean"));
  console.log(`  dims=${image.length}  similarity "${english}"=${cosine(image, textOrange).toFixed(3)}  "blue ocean"=${cosine(image, textBlue).toFixed(3)}`);

  console.log("\nOK");
}

main().catch((error) => {
  console.error("\nFAILED:", error.message);
  // EmbeddingError เก็บ AWS error จริงไว้ใน cause เพื่อช่วยหาสาเหตุ
  if (error.cause) console.error("cause:", error.cause.name ?? "", error.cause.message ?? error.cause);
  process.exit(1);
});
