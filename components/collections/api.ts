// เรียก API ของ Collection จากหน้าเว็บ
export async function collectionRequest<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/collections${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message ?? "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data as T;
}

export const ROLE_LABELS = { OWNER: "เจ้าของ", EDITOR: "แก้ไขได้", VIEWER: "ดูได้" } as const;
