"use client";

import { fileTypeMeta } from "@/components/assets/file-type";
import { StatusBadge } from "@/components/assets/status-badge";
import { Avatar } from "@/components/ui/avatar";
import type { EditableCollection } from "@/lib/collections/editable";
import { formatBytes } from "@/lib/format";
import { VISIBILITY_OPTIONS } from "@/lib/upload/rules";
import { TagInput } from "./tag-input";
import type { Details } from "./upload-client";
import type { UploadItem } from "./upload-item";

type Props = {
  item: UploadItem;
  index: number;
  total: number;
  userName: string;
  collections: EditableCollection[];
  onChange: (details: Details) => void;
};

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15";

export function DetailsPanel({ item, index, total, userName, collections, onChange }: Props) {
  const { details } = item;
  const meta = fileTypeMeta[item.fileType!];
  const isPrivate = details.visibility === "PRIVATE";
  const set = (patch: Partial<Details>) => onChange({ ...details, ...patch });

  function toggleCollection(id: string) {
    set({
      collectionIds: details.collectionIds.includes(id)
        ? details.collectionIds.filter((c) => c !== id)
        : [...details.collectionIds, id],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl ${meta.tint}`}>
          <meta.Icon className="size-7" />
          <span className="text-xs font-bold">{item.extension.toUpperCase()}</span>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            กำลังแก้รายละเอียด · {index + 1} จาก {total}
          </p>
          <p className="truncate text-lg font-bold">{item.file.name}</p>
          {item.phase === "processing" ? (
            <StatusBadge status="PROCESSING" />
          ) : (
            <span className="text-sm text-ink-muted">
              {item.phase === "ready" ? "ยังไม่ได้อัปโหลด" : item.phase === "queued" ? "รออัปโหลด" : "กำลังอัปโหลด…"}
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-line-soft overflow-hidden rounded-2xl border border-line sm:grid-cols-4 sm:divide-x">
        {[
          ["ชนิดไฟล์", item.extension.toUpperCase()],
          ["ขนาด", formatBytes(item.file.size)],
          ["อัปโหลดโดย", <span key="u" className="flex items-center gap-1.5"><Avatar name={userName} />คุณ</span>],
          ["วันที่อัปโหลด", new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date())],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-canvas/60 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {/* กดอัปโหลดแล้วแก้ไม่ได้ (รายละเอียดถูกส่งไปพร้อมไฟล์) แก้ต่อได้ในหน้า Asset */}
      <fieldset disabled={item.phase !== "ready"} className="space-y-6 disabled:opacity-60">
        <div>
          <label htmlFor="asset-name" className="mb-2 block font-medium">ชื่อ Asset</label>
          <input
            id="asset-name"
            value={details.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={200}
            className={`${inputClass} h-12`}
          />
        </div>

        <div>
          <label htmlFor="asset-desc" className="mb-2 block font-medium">คำอธิบาย (ไม่บังคับ)</label>
          <textarea
            id="asset-desc"
            value={details.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="ไฟล์นี้เกี่ยวกับอะไร ช่วยให้ Semantic Search หาเจอง่ายขึ้น"
            className={`${inputClass} py-3`}
          />
        </div>

        <div>
          <label htmlFor="asset-tags" className="mb-2 block font-medium">Tag</label>
          <TagInput id="asset-tags" value={details.tags} onChange={(tags) => set({ tags })} />
          <p className="mt-2 text-sm text-ink-muted">กด Enter เพื่อเพิ่ม ชื่อใหม่จะสร้าง Tag ที่ทุกคนใช้ได้</p>
        </div>

        <fieldset>
          <legend className="mb-2 font-medium">สิทธิ์การมองเห็น</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {VISIBILITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-xl border p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/15 ${
                  details.visibility === opt.value ? "border-brand bg-brand-soft/60" : "border-line hover:border-ink-subtle"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={details.visibility === opt.value}
                  onChange={() => set({ visibility: opt.value, ...(opt.value === "PRIVATE" && { collectionIds: [] }) })}
                  className="sr-only"
                />
                <span className="block font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={isPrivate}>
          <legend className="mb-2 font-medium">Collection</legend>
          {isPrivate ? (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">ไฟล์ส่วนตัวใส่ Collection ไม่ได้</p>
          ) : collections.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted">ยังไม่มี Collection ที่คุณแก้ได้</p>
          ) : (
            <ul className="max-h-56 divide-y divide-line-soft overflow-y-auto rounded-xl border border-line">
              {collections.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-canvas">
                    <input
                      type="checkbox"
                      checked={details.collectionIds.includes(c.id)}
                      onChange={() => toggleCollection(c.id)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} aria-hidden="true" />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-sm text-ink-muted tabular-nums">{c.assetCount}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </fieldset>
    </div>
  );
}
