// ค่าที่ต้อง copy จาก AWS Console ใส่ placeholder "REPLACE_ME" ไว้ก่อน
// ถ้ายังเหลือ → หยุด deploy ทันทีพร้อมบอกช่องที่ขาด แทนที่จะไปพังกลางทาง
export function assertFilled(file: string, values: Record<string, unknown>) {
  const missing = Object.entries(values)
    .filter(([, v]) => JSON.stringify(v).includes("REPLACE_ME"))
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `${file}: ยังไม่ได้ใส่ค่าจาก AWS Console → ${missing.join(", ")}`,
    );
  }
}
