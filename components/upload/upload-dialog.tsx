"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { CheckIcon, CloseIcon, CloudUploadIcon, FileIcon, ImageIcon, PencilIcon } from "@/components/icons";
import type { EditableCollection } from "@/lib/collections/editable";
import { ACCEPT, checkFile, extensionOf, nameWithoutExtension } from "@/lib/upload/rules";
import { DetailsPanel } from "./details-panel";
import { uploadFile, type Details } from "./upload-client";
import { UploadItemCard, type UploadItem } from "./upload-item";

const CONCURRENCY = 3;

type Props = { userName: string; collections: EditableCollection[] };

function newItem(file: File): UploadItem {
  const checked = checkFile(file.name, file.type, file.size);
  const details: Details = {
    name: nameWithoutExtension(file.name),
    description: "",
    tags: [],
    collectionIds: [],
    visibility: "ORGANIZATION",
  };
  return {
    key: crypto.randomUUID(),
    file,
    extension: extensionOf(file.name),
    ...(checked.ok
      ? {
          phase: "ready",
          fileType: checked.fileType,
          previewUrl: checked.fileType === "IMAGE" ? URL.createObjectURL(file) : undefined,
        }
      : { phase: "rejected", error: checked.message }),
    progress: 0,
    details,
  };
}

export function UploadDialog({ userName, collections }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("upload") === "1";

  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(new Set<string>());
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [dragging, setDragging] = useState(false);

  const patch = (key: string, p: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  // คิวอัปโหลด ทีละ CONCURRENCY ไฟล์
  useEffect(() => {
    const active = items.filter((i) => i.phase === "uploading").length;
    const next = items.filter((i) => i.phase === "queued" && !started.current.has(i.key)).slice(0, CONCURRENCY - active);
    for (const item of next) {
      started.current.add(item.key);
      patch(item.key, { phase: "uploading" });
      uploadFile(item.file, item.details, (progress) => patch(item.key, { progress }))
        .then((assetId) => patch(item.key, { phase: "processing", assetId }))
        .catch((e: Error) => patch(item.key, { phase: "failed", error: e.message }));
    }
  }, [items]);

  function close() {
    const params = new URLSearchParams(searchParams);
    params.delete("upload");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map(newItem);
    setItems((prev) => [...prev, ...added]);
    const firstValid = added.find((i) => i.phase !== "rejected");
    if (!selectedKey && firstValid) setSelectedKey(firstValid.key);
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  const valid = items.filter((i) => i.phase !== "rejected" && i.phase !== "failed");
  const ready = valid.filter((i) => i.phase === "ready");
  const uploaded = valid.filter((i) => i.phase === "processing");
  const busy = valid.length !== uploaded.length + ready.length;
  const rejected = items.length - valid.length;
  const selectedIndex = valid.findIndex((i) => i.key === selectedKey);
  const selected = valid[selectedIndex];

  // ปิดแท็บ / รีเฟรชระหว่างส่งไฟล์ = อัปโหลดถูกยกเลิก เตือนก่อน
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // browser รุ่นเก่า
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // ผู้ใช้ยืนยันแล้ว → เข้าคิวอัปโหลด
  function startUpload() {
    setItems((prev) => prev.map((i) => (i.phase === "ready" ? { ...i, phase: "queued" } : i)));
  }

  function done() {
    items.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setSelectedKey(undefined);
    started.current.clear();
    close();
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="upload-title"
      className="m-auto h-[min(880px,calc(100%-2rem))] w-[min(1080px,calc(100%-2rem))] max-w-none overflow-hidden rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="grid h-full grid-rows-[auto_1fr_auto]">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 id="upload-title" className="text-2xl font-bold tracking-tight">อัปโหลด Asset</h2>
            <p className="mt-1 text-sm text-ink-muted">เลือกสิทธิ์การมองเห็นได้ทีละไฟล์ · แก้ไขหรือลบได้เฉพาะเจ้าของไฟล์</p>
          </div>
          <button type="button" onClick={close} aria-label="ปิด" className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink">
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 overflow-y-auto md:grid-cols-[400px_1fr] md:overflow-hidden">
          <section className="space-y-5 border-line p-6 md:overflow-y-auto md:border-r">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragging ? "border-brand bg-brand-soft" : "border-brand/40 bg-brand-soft/40"
              }`}
            >
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-surface text-brand shadow-sm">
                <CloudUploadIcon className="size-6" />
              </span>
              <p className="mt-3 font-semibold">ลากไฟล์มาวางที่นี่ (หลายไฟล์ได้)</p>
              <p className="mt-1 text-sm text-ink-muted">
                หรือ{" "}
                <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-brand underline hover:text-brand-hover">
                  เลือกไฟล์
                </button>{" "}
                จากเครื่อง
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-ink-muted">
                <span className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1">
                  <FileIcon className="size-3.5" /> PDF
                </span>
                <span className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1">
                  <ImageIcon className="size-3.5" /> JPG · PNG · WEBP
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                สูงสุด <strong>20 MB</strong> ต่อไฟล์ ไฟล์ชนิดอื่นจะถูกปฏิเสธ
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="sr-only"
                tabIndex={-1}
              />
            </div>

            {items.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold">{items.length} ไฟล์</span>
                  <span className="text-ink-muted">
                    {uploaded.length} กำลังประมวลผล{rejected > 0 && ` · ${rejected} ถูกปฏิเสธ`}
                  </span>
                </div>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <UploadItemCard
                      key={item.key}
                      item={item}
                      selected={item.key === selectedKey}
                      onSelect={() => setSelectedKey(item.key)}
                      onRemove={() => remove(item.key)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="p-6 md:overflow-y-auto">
            {selected ? (
              <DetailsPanel
                item={selected}
                index={selectedIndex}
                total={valid.length}
                userName={userName}
                collections={collections}
                onChange={(details) => patch(selected.key, { details })}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <PencilIcon className="size-7" />
                </span>
                <p className="mt-4 text-lg font-bold">เพิ่มไฟล์เพื่อแก้รายละเอียด</p>
                <p className="mt-1 max-w-sm text-ink-muted">
                  ตั้งชื่อ คำอธิบาย Tag และ Collection ก่อนกดอัปโหลด หรือแก้ทีหลังในหน้า Asset
                </p>
              </div>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas/60 px-6 py-4">
          <p className="text-sm text-ink-muted">
            {valid.length ? `อัปโหลดแล้ว ${uploaded.length} จาก ${valid.length}` : "อัปโหลดได้ทีละไฟล์หรือหลายไฟล์"}
          </p>
          {ready.length > 0 ? (
            <button
              type="button"
              onClick={startUpload}
              className="flex h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white transition hover:bg-brand-hover"
            >
              <CloudUploadIcon className="size-5" />
              อัปโหลด {ready.length} ไฟล์
            </button>
          ) : (
            <button
              type="button"
              onClick={done}
              disabled={busy}
              className="flex h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckIcon className="size-5" />
              {busy ? "กำลังอัปโหลด…" : "เสร็จสิ้น"}
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
