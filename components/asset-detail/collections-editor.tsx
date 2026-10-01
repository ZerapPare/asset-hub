"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import type { EditableCollection } from "@/lib/collections/editable";
import { assetRequest } from "./api";

type Props = {
  assetId: string;
  current: { id: string; name: string; color: string }[];
  editable: EditableCollection[];
  canEdit: boolean;
  isPrivate: boolean;
};

export function CollectionsEditor({ assetId, current, editable, canEdit, isPrivate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  function openPicker() {
    const editableIds = new Set(editable.map((c) => c.id));
    setSelected(current.map((c) => c.id).filter((id) => editableIds.has(id)));
    setError(undefined);
    setOpen(true);
  }

  async function save() {
    setPending(true);
    try {
      await assetRequest(assetId, "PATCH", { collectionIds: selected });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setPending(false);
  }

  return (
    <div className="space-y-3">
      {current.length ? (
        <ul className="space-y-1">
          {current.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} aria-hidden="true" />
                <span className="truncate">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">ยังไม่อยู่ใน Collection ไหน</p>
      )}

      {canEdit &&
        (isPrivate ? (
          <p className="text-sm text-ink-muted">ไฟล์ส่วนตัวใส่ Collection ไม่ได้</p>
        ) : (
          <button type="button" onClick={openPicker} className="flex items-center gap-1.5 font-semibold text-brand hover:text-brand-hover">
            <PlusIcon className="size-4" />
            {current.length ? "จัดการ Collection" : "เพิ่มเข้า Collection"}
          </button>
        ))}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เพิ่มเข้า Collection"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-xl border border-line px-4 font-semibold hover:border-ink-subtle">
              ยกเลิก
            </button>
            <button type="button" onClick={save} disabled={pending || editable.length === 0} className="h-11 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </>
        }
      >
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        {editable.length === 0 ? (
          <p className="text-ink-muted">ยังไม่มี Collection ที่คุณแก้ได้</p>
        ) : (
          <ul className="divide-y divide-line-soft rounded-xl border border-line">
            {editable.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() =>
                      setSelected((s) => (s.includes(c.id) ? s.filter((id) => id !== c.id) : [...s, c.id]))
                    }
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
      </Modal>
    </div>
  );
}
