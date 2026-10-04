"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AssetThumb } from "@/components/assets/asset-thumb";
import { StatusBadge } from "@/components/assets/status-badge";
import { SpinnerIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { formatShortDate } from "@/lib/format";
import type { Asset } from "@/lib/types";
import { collectionRequest } from "./api";

type Props = { collectionId: string; collectionName: string; open: boolean; onClose: () => void };

const DEBOUNCE_MS = 300;

export function AddAssetsDialog({ collectionId, collectionName, open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  // ค้นหาแบบหน่วงเวลา
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      collectionRequest<{ assets: Asset[] }>(`/${collectionId}/candidates?q=${encodeURIComponent(query)}`, "GET")
        .then((r) => !cancelled && setAssets(r.assets))
        .catch((e: Error) => !cancelled && setError(e.message));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, collectionId]);

  function close() {
    setQuery("");
    setSelected([]);
    setAssets(null);
    setError(undefined);
    onClose();
  }

  async function add() {
    setPending(true);
    try {
      await collectionRequest(`/${collectionId}/assets`, "POST", { assetIds: selected });
      close();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setPending(false);
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal
      open={open}
      onClose={close}
      title="เพิ่มไฟล์"
      subtitle={`ไปยัง ${collectionName}`}
      wide
      footerStart={`เลือก ${selected.length} ไฟล์`}
      footer={
        <>
          <button type="button" onClick={close} className="h-11 rounded-xl border border-line bg-surface px-5 font-semibold hover:border-ink-subtle">
            ยกเลิก
          </button>
          <button type="button" onClick={add} disabled={pending || selected.length === 0} className="h-11 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
            {pending ? "กำลังเพิ่ม…" : "เพิ่มไฟล์"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SearchInput label="ค้นหาชื่อไฟล์หรือ Tag" value={query} onChange={setQuery} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {assets === null ? (
          <div className="flex justify-center py-10"><SpinnerIcon className="size-6 animate-spin text-ink-muted" /></div>
        ) : assets.length === 0 ? (
          <p className="py-10 text-center text-ink-muted">{query.trim() ? "ไม่พบไฟล์ที่ตรงกับคำค้น" : "ไม่มีไฟล์ที่เพิ่มได้"}</p>
        ) : (
          <ul className="space-y-1">
            {assets.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
                  <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="size-4 shrink-0 accent-[var(--brand)]" />
                  <AssetThumb asset={a} className="size-11 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {a.extension} · {a.owner.isMe ? "คุณ" : a.owner.name} · {formatShortDate(a.createdAt)}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-subtle">ไม่แสดงไฟล์ส่วนตัว และไฟล์ระดับทีมของคนอื่น</p>
      </div>
    </Modal>
  );
}
