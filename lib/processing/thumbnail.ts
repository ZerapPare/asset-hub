import sharp from "sharp";

// ขนาดสำหรับการ์ดและภาพแนวตั้ง
export const THUMBNAIL_WIDTH = 640;
export const THUMBNAIL_MAX_HEIGHT = 960;
const WEBP_QUALITY = 80;
// กัน decompression bomb กินหน่วยความจำจน worker ล่ม
const MAX_INPUT_PIXELS = 100_000_000;

export type Thumbnail = {
  data: Buffer;
  width: number;
  height: number;
  /** ขนาดต้นฉบับหลังหมุนตาม EXIF */
  original: { width: number; height: number };
};

// Titan Multimodal รับ ≤ 2048×2048 และไม่รับ WebP — 1024px พอสำหรับ embedding และส่งข้าม region เร็วกว่า
const EMBEDDING_IMAGE_SIZE = 1024;
const JPEG_QUALITY = 85;

/** ย่อเฟรมแรกเป็น JPEG สำหรับ embedding (พื้นโปร่งใสเป็นสีขาว ไม่ใช่ดำ) */
export async function makeEmbeddingImage(input: Uint8Array): Promise<Buffer> {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 })
    .autoOrient()
    .resize({ width: EMBEDDING_IMAGE_SIZE, height: EMBEDDING_IMAGE_SIZE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/** ย่อเฟรมแรกเป็น WebP */
export async function makeThumbnail(input: Uint8Array): Promise<Thumbnail> {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 });
  const meta = await image.metadata();

  const { data, info } = await image
    .autoOrient()
    .resize({ width: THUMBNAIL_WIDTH, height: THUMBNAIL_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    original: { width: meta.autoOrient.width, height: meta.autoOrient.height },
  };
}
