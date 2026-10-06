"use client";

import { fileTypeMeta } from "@/components/assets/file-type";
import { AlertIcon, CheckIcon, CloseIcon, SpinnerIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import type { FileType } from "@/lib/types";
import type { Details } from "./upload-client";

// ready = เลือกไฟล์แล้ว รอผู้ใช้กดอัปโหลด (ยังไม่ส่งอะไรขึ้น server) / done = ประมวลผลเสร็จ
export type Phase = "rejected" | "ready" | "queued" | "uploading" | "processing" | "done" | "failed";

export type UploadItem = {
  key: string;
  file: File;
  fileType?: FileType;
  extension: string;
  previewUrl?: string;
  phase: Phase;
  progress: number;
  error?: string;
  assetId?: string;
  details: Details;
};

type Props = { item: UploadItem; selected: boolean; onSelect: () => void; onRemove: () => void };

const steps = ["Uploading", "Processing", "Ready"] as const;

export function UploadItemCard({ item, selected, onSelect, onRemove }: Props) {
  if (item.phase === "rejected" || item.phase === "failed") {
    return (
      <li className="flex gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4">
        <AlertIcon className="mt-0.5 size-6 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.file.name}</p>
          <p className="mt-1 text-sm text-danger">{item.error}</p>
        </div>
        <button type="button" onClick={onRemove} aria-label={`เอา ${item.file.name} ออก`} className="self-start rounded-md p-1 text-ink-muted hover:text-ink">
          <CloseIcon className="size-4" />
        </button>
      </li>
    );
  }

  const meta = fileTypeMeta[item.fileType!];
  const current = item.phase === "done" ? 3 : item.phase === "processing" ? 1 : 0;
  const percent = current > 0 ? 100 : Math.round(item.progress * 100);

  // เอาออกได้เฉพาะไฟล์ที่ยังไม่ได้กดอัปโหลด
  const removable = item.phase === "ready";

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full gap-3 rounded-2xl border bg-surface p-4 text-left transition ${removable ? "pr-10" : ""} ${
          selected ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-ink-subtle"
        }`}
      >
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-lg ${meta.tint}`}>
            <meta.Icon className="size-5" />
            <span className="text-[0.6rem] font-bold">{item.extension.toUpperCase()}</span>
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{item.details.name || item.file.name}</span>
          <span className="block text-sm text-ink-muted">
            {item.extension.toUpperCase()} · {formatBytes(item.file.size)}
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line-soft">
            <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
            {steps.map((label, i) => {
              const done = i < current;
              const active = i === current && (item.phase === "uploading" || item.phase === "processing");
              return (
                <span key={label} className="flex items-center gap-1">
                  {i > 0 && <span className="h-px w-3 bg-line" aria-hidden="true" />}
                  {done ? (
                    <CheckIcon className="size-3.5 text-success" />
                  ) : active ? (
                    <SpinnerIcon className="size-3.5 animate-spin text-info" />
                  ) : (
                    <span className="size-3 rounded-full border border-line" aria-hidden="true" />
                  )}
                  <span className={done ? "text-success" : active ? "text-info" : "text-ink-subtle"}>{label}</span>
                </span>
              );
            })}
          </span>
        </span>
      </button>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`เอา ${item.file.name} ออก`}
          className="absolute right-3 top-3 rounded-md p-1 text-ink-muted hover:text-ink"
        >
          <CloseIcon className="size-4" />
        </button>
      )}
    </li>
  );
}
