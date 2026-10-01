// เรียก API จากหน้ารายละเอียด Asset
export async function assetRequest(assetId: string, method: "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(`/api/assets/${assetId}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error?.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
}

export const downloadUrl = (id: string) => `/api/assets/${id}/download`;
export const previewUrl = (id: string) => `/api/assets/${id}/preview`;
