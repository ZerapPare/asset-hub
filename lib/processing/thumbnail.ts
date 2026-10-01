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
