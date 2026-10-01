"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fileTypeMeta } from "@/components/assets/file-type";
import { LiveStatusBadge } from "@/components/assets/live-status";
import { DownloadIcon, ExpandIcon, PencilIcon, TrashIcon, UserIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import type { AssetDetail } from "@/lib/assets/detail";
import { formatBytes } from "@/lib/format";
import { VISIBILITY_OPTIONS, type UploadVisibility } from "@/lib/upload/rules";
import { assetRequest, downloadUrl, previewUrl } from "./api";

const typeLabel = { DOCUMENT: "เอกสาร", IMAGE: "รูปภาพ" } as const;

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15";
const iconButton = "flex size-12 shrink-0 items-center justify-center rounded-xl border transition";

export function SummaryCard({ asset }: { asset: AssetDetail }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = fileTypeMeta[asset.fileType];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-ink-muted">
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${asset.fileType === "DOCUMENT" ? "bg-danger" : "bg-ink"}`}>
            {asset.extension.toUpperCase()}
          </span>
          {typeLabel[asset.fileType]} · {formatBytes(asset.size)}
        </span>
        <LiveStatusBadge assetId={asset.id} status={asset.status} />
      </div>

      <h1 className="break-words text-2xl font-bold tracking-tight">{asset.name}</h1>

      {asset.description ? (
        <p className="whitespace-pre-line text-ink-muted">{asset.description}</p>
      ) : (
        <p className="text-ink-muted">
          ยังไม่มีคำอธิบาย
          {asset.isOwner && (
            <>
              {" "}
              <button type="button" onClick={() => setEditing(true)} className="font-semibold text-brand hover:text-brand-hover">
                เพิ่มเลย
              </button>
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={downloadUrl(asset.id)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white transition hover:bg-brand-hover">
          <DownloadIcon className="size-5" />
          ดาวน์โหลด
        </a>
        <a
          href={previewUrl(asset.id)}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line px-5 font-semibold transition hover:border-ink-subtle"
        >
          <ExpandIcon className="size-5" />
          เปิดดู
        </a>
        {asset.isOwner && (
          <>
            <button type="button" onClick={() => setEditing(true)} aria-label="แก้ไข" className={`${iconButton} border-line hover:border-ink-subtle`}>
              <PencilIcon className="size-5" />
            </button>
            <button type="button" onClick={() => setDeleting(true)} aria-label="ลบ" className={`${iconButton} border-danger/30 text-danger hover:bg-danger-soft`}>
              <TrashIcon className="size-5" />
            </button>
          </>
        )}
      </div>

      {asset.isOwner && (
        <p className="flex items-center gap-2 text-sm font-medium text-brand-ink">
          <UserIcon className="size-4" />
          คุณเป็นผู้อัปโหลดไฟล์นี้ จึงแก้ไขหรือลบได้
        </p>
      )}

      {asset.isOwner && (
        <>
          <EditDialog asset={asset} open={editing} onClose={() => setEditing(false)} />
          <DeleteDialog asset={asset} open={deleting} onClose={() => setDeleting(false)} icon={<meta.Icon className="size-6" />} />
        </>
      )}
    </div>
  );
}

function EditDialog({ asset, open, onClose }: { asset: AssetDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? "");
  const [visibility, setVisibility] = useState<UploadVisibility>(asset.visibility);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function save() {
    const body: Record<string, unknown> = {};
    if (name.trim() !== asset.name) body.displayName = name;
    if (description.trim() !== (asset.description ?? "")) body.description = description;
    if (visibility !== asset.visibility) body.visibility = visibility;
    if (!name.trim()) return setError("กรุณาตั้งชื่อ");
    if (Object.keys(body).length === 0) return onClose();

    setPending(true);
    setError(undefined);
    try {
      await assetRequest(asset.id, "PATCH", body);
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setPending(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="แก้ไขรายละเอียด"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line px-4 font-semibold hover:border-ink-subtle">
            ยกเลิก
          </button>
          <button type="button" onClick={save} disabled={pending} className="h-11 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="edit-name" className="mb-2 block font-medium">ชื่อ Asset</label>
          <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={`${inputClass} h-12`} />
        </div>
        <div>
          <label htmlFor="edit-desc" className="mb-2 block font-medium">คำอธิบาย</label>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="ไฟล์นี้เกี่ยวกับอะไร ช่วยให้ Semantic Search หาเจอง่ายขึ้น"
            className={`${inputClass} py-3`}
          />
        </div>
        <fieldset>
          <legend className="mb-2 font-medium">สิทธิ์การมองเห็น</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {VISIBILITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-xl border p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/15 ${
                  visibility === opt.value ? "border-brand bg-brand-soft/60" : "border-line hover:border-ink-subtle"
                }`}
              >
                <input type="radio" name="edit-visibility" checked={visibility === opt.value} onChange={() => setVisibility(opt.value)} className="sr-only" />
                <span className="block font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{opt.hint}</span>
              </label>
            ))}
          </div>
          {visibility === "PRIVATE" && asset.collections.length > 0 && (
            <p className="mt-2 text-sm text-danger">ไฟล์นี้อยู่ใน Collection — เอาออกจาก Collection ก่อนตั้งเป็นส่วนตัว</p>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}

function DeleteDialog({ asset, open, onClose, icon }: { asset: AssetDetail; open: boolean; onClose: () => void; icon: React.ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    setError(undefined);
    try {
      await assetRequest(asset.id, "DELETE");
      router.push("/assets");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ลบไฟล์นี้?"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line px-4 font-semibold hover:border-ink-subtle">
            ยกเลิก
          </button>
          <button type="button" onClick={remove} disabled={pending} className="h-11 rounded-xl bg-danger px-5 font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {pending ? "กำลังลบ…" : "ลบไฟล์"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
          <span className="text-ink-muted">{icon}</span>
          <span className="truncate font-semibold">{asset.name}</span>
        </div>
        <p className="text-ink-muted">
          ไฟล์จะหายจาก Library, Collection และผลค้นหาทันที และถูกลบถาวรหลัง 7 วัน
        </p>
        {error && (
          <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
