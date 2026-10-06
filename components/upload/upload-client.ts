import { nameWithoutExtension, type UploadVisibility } from "@/lib/upload/rules";

export type Details = {
  name: string;
  description: string;
  tags: string[];
  collectionIds: string[];
  visibility: UploadVisibility;
};

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message ?? "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
  return data as T;
}

// ส่งไฟล์ตรงเข้า S3/MinIO ด้วย XHR เพื่อให้มี progress
function postToStorage(url: string, fields: Record<string, string>, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("อัปโหลดไม่สำเร็จ")));
    xhr.onerror = () => reject(new Error("เชื่อมต่อที่เก็บไฟล์ไม่ได้"));
    xhr.send(form);
  });
}

// ขอ URL → อัปโหลด → บันทึกรายละเอียด → ยืนยัน
// asset ยังเป็น UPLOADING (ไม่มีใครเห็น) จนกว่าจะ complete จึงบันทึกรายละเอียดก่อน
export async function uploadFile(file: File, details: Details, onProgress: (p: number) => void) {
  const { visibility } = details;
  const { assetId, url, fields } = await api<{ assetId: string; url: string; fields: Record<string, string> }>(
    "/api/assets/upload-url",
    "POST",
    { name: file.name, mimeType: file.type, size: file.size, visibility },
  );
  await postToStorage(url, fields, file, onProgress);
  const created: Details = { name: nameWithoutExtension(file.name), description: "", tags: [], collectionIds: [], visibility };
  await saveDetails(assetId, details, created);
  await api(`/api/assets/${assetId}/complete`, "POST");
  return assetId;
}

export type AssetStatus = { status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED"; error?: string };

// ถามสถานะหลายไฟล์ในคำขอเดียว
export async function fetchStatuses(ids: string[]) {
  const { statuses } = await api<{ statuses: Record<string, AssetStatus> }>(
    `/api/assets/status?ids=${ids.join(",")}`,
    "GET",
  );
  return statuses;
}

// ส่งเฉพาะช่องที่ต่างจากที่บันทึกไว้
async function saveDetails(assetId: string, next: Details, saved: Details) {
  const body: Record<string, unknown> = {};
  if (next.name !== saved.name) body.displayName = next.name;
  if (next.description !== saved.description) body.description = next.description;
  if (next.visibility !== saved.visibility) body.visibility = next.visibility;
  if (next.tags.join() !== saved.tags.join()) body.tags = next.tags;
  if (next.collectionIds.join() !== saved.collectionIds.join()) body.collectionIds = next.collectionIds;
  if (Object.keys(body).length === 0) return;
  await api(`/api/assets/${assetId}`, "PATCH", body);
}
