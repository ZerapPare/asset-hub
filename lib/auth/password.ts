import bcrypt from "bcryptjs";

const COST = 12;
// hash ของรหัสสุ่ม ใช้ compare ตอนไม่มี user ให้เวลาตอบเท่ากัน
const DUMMY_HASH = "$2b$12$KguM70L8cggpTXAKcvj3k.pPbeAXrRlqGi7MQTh.YNpNbWkqQqZ/W";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && !!hash;
}

// คืนข้อความ error หรือ null ถ้าผ่าน
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) {
    return "รหัสผ่านยาวเกินไป";
  }
  return null;
}
