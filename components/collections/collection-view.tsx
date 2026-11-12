"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AssetCard } from "@/components/assets/asset-card";
import {
  FolderIcon,
  FolderPlusIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  TrashIcon,
  UserPlusIcon,
} from "@/components/icons";
import { SearchResultCard } from "@/components/search/search-result-card";
import type { FilterOption, SearchMode, SearchResult } from "@/components/search/types";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import type { CollectionDetail } from "@/lib/collections/queries";
import { formatBytes } from "@/lib/format";
import { AddAssetsDialog } from "./add-assets-dialog";
import { ROLE_LABELS, collectionRequest } from "./api";
import { CollectionForm } from "./collection-form";
import { MembersDialog } from "./members-dialog";

/** browse = ไม่มีคำค้น แสดงไฟล์ทั้งหมดใน Collection */
export type CollectionKind = "browse" | SearchMode;

type Props = {
  collection: CollectionDetail;
  results: SearchResult[];
  timedOut: boolean;
  fellBack: boolean;
  myUserId: string;
  meName: string;
  q: string;
  mode: SearchMode;
  kind: CollectionKind;
  /** ค่าว่าง = การเรียงเริ่มต้นของ kind นั้น */
  sort: string;
  sortOptions: FilterOption[];
};

const MAX_AVATARS = 4;
const fullDate = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const MODES = [
  { value: "keyword", label: "Keyword", Icon: SearchIcon },
  { value: "semantic", label: "Semantic", Icon: SparkleIcon },
] as const;

export function CollectionView({
  collection: c,
  results,
  timedOut,
  fellBack,
  myUserId,
  meName,
  q,
  mode,
  kind,
  sort,
  sortOptions,
}: Props) {
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
    if (query.trim() === q) return;
    const t = setTimeout(() => setParams({ q: query.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function setParams(values: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }
  // แต่ละโหมดเรียงได้ไม่เหมือนกัน → เปลี่ยนโหมดแล้วกลับไปใช้การเรียงเริ่มต้น
  const switchMode = (next: SearchMode) => setParams({ mode: next === "semantic" ? next : "", sort: "" });

  const assets = results.map((r) => r.asset);
  // เลือกได้เฉพาะไฟล์ที่แสดงอยู่ — เปลี่ยนคำค้นแล้วไฟล์ที่ไม่แสดงจะไม่ถูกเอาออกโดยไม่ตั้งใจ
  const shownSelected = selected.filter((id) => assets.some((a) => a.id === id));
  const allSelected = assets.length > 0 && shownSelected.length === assets.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // ไฮไลต์เฉพาะผล Keyword (Semantic ไม่ได้ค้นจากคำที่ตรงกัน)
  const highlight = kind === "keyword" || fellBack ? q : "";

  async function removeSelected() {
    setBusy(true);
    setError(undefined);
    try {
      await collectionRequest(`/${c.id}/assets`, "DELETE", { assetIds: shownSelected });
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

        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <button type="button" onClick={() => setDialog("members")} className="flex h-12 items-center gap-2 rounded-xl border border-brand/40 bg-brand-soft px-5 font-semibold text-brand-ink hover:bg-brand-soft/70 hover:border-brand">
              <UserPlusIcon className="size-5" />
              เพิ่มสมาชิก
            </button>
          )}
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
            <div role="group" aria-label="โหมดการค้นหา" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-line">
              {MODES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchMode(value)}
                  aria-pressed={mode === value}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    mode === value ? "bg-brand-soft text-brand-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
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
            <select value={sort} onChange={(e) => setParams({ sort: e.target.value })} className="cursor-pointer bg-transparent py-2 font-semibold outline-none">
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {fellBack && (
        <p role="status" className="text-sm text-ink-muted">ค้นแบบ Semantic ไม่ได้ในตอนนี้ แสดงผลแบบ Keyword แทน</p>
      )}

      {shownSelected.length > 0 && (
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-md">
          <span className="font-semibold">เลือก {shownSelected.length} ไฟล์</span>
          <button type="button" onClick={removeSelected} disabled={busy} className="rounded-lg bg-danger px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {busy ? "กำลังเอาออก…" : "เอาออกจาก Collection"}
          </button>
          <button type="button" onClick={() => setSelected([])} className="font-semibold text-ink-muted hover:text-ink">ยกเลิก</button>
          {error && <span role="alert" className="text-sm text-danger">{error}</span>}
        </div>
      )}

      {results.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {results.map((r) => (
            <div key={r.asset.id} className="relative">
              {kind === "browse" ? (
                <AssetCard asset={r.asset} meName={meName} failedHint />
              ) : (
                <SearchResultCard result={r} query={highlight} layout="grid" />
              )}
              {canEdit && (
                <label className="absolute left-3 top-3 z-10 flex size-7 cursor-pointer items-center justify-center rounded-md bg-surface/90 shadow-sm">
                  <span className="sr-only">เลือก {r.asset.name}</span>
                  <input type="checkbox" checked={selected.includes(r.asset.id)} onChange={() => toggle(r.asset.id)} className="size-4 accent-[var(--brand)]" />
                </label>
              )}
            </div>
          ))}
        </div>
      ) : timedOut ? (
        <p className="rounded-3xl border border-dashed border-line py-16 text-center text-ink-muted">
          ค้นหาใช้เวลานานเกินไป ลองใช้คำที่เจาะจงขึ้น
        </p>
      ) : q ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line py-16 text-center text-ink-muted">
          <p>ไม่พบไฟล์ที่ตรงกับ “{q}”</p>
          {kind === "keyword" && (
            <button
              type="button"
              onClick={() => switchMode("semantic")}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand/40 hover:text-brand-ink"
            >
              <SparkleIcon className="size-4" />
              ลองค้นแบบ Semantic
            </button>
          )}
        </div>
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
