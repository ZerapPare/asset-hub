"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AssetCard } from "@/components/assets/asset-card";
import { FolderIcon, FolderPlusIcon, LayersIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import type { CollectionDetail, CollectionSort } from "@/lib/collections/queries";
import { formatBytes } from "@/lib/format";
import type { Asset } from "@/lib/types";
import { AddAssetsDialog } from "./add-assets-dialog";
import { ROLE_LABELS, collectionRequest } from "./api";
import { CollectionForm } from "./collection-form";
import { MembersDialog } from "./members-dialog";

type Props = {
  collection: CollectionDetail;
  assets: Asset[];
  myUserId: string;
  meName: string;
  q: string;
  sort: CollectionSort;
};

const SORTS: Record<CollectionSort, string> = { newest: "ล่าสุด", oldest: "เก่าสุด", name: "ชื่อ A–Z" };
const MAX_AVATARS = 4;
const fullDate = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });

export function CollectionView({ collection: c, assets, myUserId, meName, q, sort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = c.role !== "VIEWER";
  const isOwner = c.role === "OWNER";

  const [dialog, setDialog] = useState<"add" | "members" | "edit" | "delete" | null>(null);
  const [query, setQuery] = useState(q);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // ค้นหา → ?q= (หน่วงเวลา)
  useEffect(() => {
    if (query === q) return;
    const t = setTimeout(() => setParam("q", query.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  const allSelected = assets.length > 0 && selected.length === assets.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function removeSelected() {
    setBusy(true);
    setError(undefined);
    try {
      await collectionRequest(`/${c.id}/assets`, "DELETE", { assetIds: selected });
      setSelected([]);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const shownMembers = c.members.slice(0, MAX_AVATARS);
  const iconBtn = "flex size-12 shrink-0 items-center justify-center rounded-xl border transition";

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <nav aria-label="breadcrumb" className="text-ink-muted">
        <Link href="/collections" className="hover:text-ink">Collection</Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-ink">{c.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: c.color }}>
            <FolderIcon className="size-8" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold tracking-tight">{c.name}</h1>
            {c.description && <p className="mt-1 max-w-2xl text-ink-muted">{c.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <LayersIcon className="size-4" />
                {c.assetCount} ไฟล์
              </span>
              · <span>{formatBytes(c.totalSize)}</span>
              · <span>อัปเดต {fullDate.format(new Date(c.updatedAt))}</span>
              ·
              <button
                type="button"
                onClick={() => setDialog("members")}
                aria-label={`สมาชิก ${c.members.length} คน`}
                className="flex items-center rounded-full p-0.5 hover:bg-line-soft"
              >
                <span className="flex -space-x-2">
                  {shownMembers.map((m) => (
                    <span key={m.userId} className="rounded-full ring-2 ring-canvas">
                      <Avatar name={m.name} src={m.avatarUrl} />
                    </span>
                  ))}
                </span>
                {c.members.length > MAX_AVATARS && <span className="ml-1.5 text-sm">+{c.members.length - MAX_AVATARS}</span>}
              </button>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">{ROLE_LABELS[c.role]}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <button type="button" onClick={() => setDialog("add")} className="flex h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover">
              <PlusIcon className="size-5" />
              เพิ่มไฟล์
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setDialog("edit")} aria-label="แก้ไข Collection" className={`${iconBtn} border-line bg-surface hover:border-ink-subtle`}>
              <PencilIcon className="size-5" />
            </button>
          )}
          {isOwner && (
            <button type="button" onClick={() => setDialog("delete")} aria-label="ลบ Collection" className={`${iconBtn} border-danger/30 bg-surface text-danger hover:bg-danger-soft`}>
              <TrashIcon className="size-5" />
            </button>
          )}
        </div>
      </div>

      {(c.assetCount > 0 || q) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <SearchInput label={`ค้นหาใน ${c.name}`} value={query} onChange={setQuery} className="w-full max-w-sm" />
            {canEdit && assets.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-ink-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : assets.map((a) => a.id))}
                  className="size-4 accent-[var(--brand)]"
                />
                เลือกทั้งหมด
              </label>
            )}
          </div>
          <label className="flex h-12 items-center gap-1 rounded-xl border border-brand/30 bg-brand-soft/50 pl-4 pr-2 font-semibold text-brand-ink">
            เรียงตาม:
            <select value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)} className="cursor-pointer bg-transparent py-2 font-semibold outline-none">
              {(Object.keys(SORTS) as CollectionSort[]).map((s) => (
                <option key={s} value={s}>{SORTS[s]}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {selected.length > 0 && (
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-md">
          <span className="font-semibold">เลือก {selected.length} ไฟล์</span>
          <button type="button" onClick={removeSelected} disabled={busy} className="rounded-lg bg-danger px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {busy ? "กำลังเอาออก…" : "เอาออกจาก Collection"}
          </button>
          <button type="button" onClick={() => setSelected([])} className="font-semibold text-ink-muted hover:text-ink">ยกเลิก</button>
          {error && <span role="alert" className="text-sm text-danger">{error}</span>}
        </div>
      )}

      {assets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="relative">
              <AssetCard asset={a} meName={meName} failedHint />
              {canEdit && (
                <label className="absolute left-3 top-3 z-10 flex size-7 cursor-pointer items-center justify-center rounded-md bg-surface/90 shadow-sm">
                  <span className="sr-only">เลือก {a.name}</span>
                  <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="size-4 accent-[var(--brand)]" />
                </label>
              )}
            </div>
          ))}
        </div>
      ) : q ? (
        <p className="rounded-3xl border border-dashed border-line py-16 text-center text-ink-muted">ไม่พบไฟล์ที่ตรงกับ “{q}”</p>
      ) : (
        <div className="flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FolderPlusIcon className="size-8" />
          </span>
          <p className="mt-5 text-xl font-bold">Collection นี้ยังว่าง</p>
          <p className="mt-2 max-w-md text-ink-muted">เพิ่มไฟล์จาก Library ไฟล์ยังอยู่ที่เดิม Collection แค่จัดกลุ่มไว้ด้วยกัน</p>
          {canEdit && (
            <button type="button" onClick={() => setDialog("add")} className="mt-6 flex h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover">
              <PlusIcon className="size-5" />
              เพิ่มไฟล์
            </button>
          )}
        </div>
      )}

      <p className="text-sm text-ink-muted">การเอาออกจาก Collection ไม่ได้ลบไฟล์ ไฟล์ยังอยู่ใน Library</p>

      <AddAssetsDialog collectionId={c.id} collectionName={c.name} open={dialog === "add"} onClose={() => setDialog(null)} />
      <MembersDialog collectionId={c.id} members={c.members} myUserId={myUserId} isOwner={isOwner} open={dialog === "members"} onClose={() => setDialog(null)} />
      <EditDialog collection={c} open={dialog === "edit"} onClose={() => setDialog(null)} />
      <DeleteDialog collection={c} open={dialog === "delete"} onClose={() => setDialog(null)} />
    </div>
  );
}

function EditDialog({ collection: c, open, onClose }: { collection: CollectionDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function save() {
    if (!name.trim()) return setError("กรุณาตั้งชื่อ Collection");
    setPending(true);
    try {
      await collectionRequest(`/${c.id}`, "PATCH", { name, description });
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
      title="แก้ไข Collection"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line bg-surface px-5 font-semibold hover:border-ink-subtle">ยกเลิก</button>
          <button type="button" onClick={save} disabled={pending} className="h-11 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </>
      }
    >
      <CollectionForm name={name} description={description} onName={setName} onDescription={setDescription} error={error} />
    </Modal>
  );
}

function DeleteDialog({ collection: c, open, onClose }: { collection: CollectionDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await collectionRequest(`/${c.id}`, "DELETE");
      router.push("/collections");
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
      title="ลบ Collection นี้?"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-line bg-surface px-5 font-semibold hover:border-ink-subtle">ยกเลิก</button>
          <button type="button" onClick={remove} disabled={pending} className="h-11 rounded-xl bg-danger px-5 font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {pending ? "กำลังลบ…" : "ลบ Collection"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="font-semibold">{c.name}</p>
        <p className="text-ink-muted">สมาชิกทุกคนจะไม่เห็น Collection นี้อีก ไฟล์ข้างในไม่ถูกลบ ยังอยู่ใน Library</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
