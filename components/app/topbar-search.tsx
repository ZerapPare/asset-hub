"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon, SparkleIcon } from "@/components/icons";

type Mode = "keyword" | "semantic";

const modes: { value: Mode; label: string; Icon: typeof SearchIcon }[] = [
  { value: "keyword", label: "Keyword", Icon: SearchIcon },
  { value: "semantic", label: "Semantic", Icon: SparkleIcon },
];

// ตัวกรองของหน้า Asset ที่คงไว้ตอนค้นใหม่ (การเรียงไม่คง เพราะค่าเริ่มต้นต่างกันระหว่างดูไฟล์กับค้นหา)
const KEEP_PARAMS = ["type", "uploaded", "from", "to", "owner", "collection", "tag", "view"] as const;

let focusAfterClear = false;

// ช่องค้นหาหลักของทั้งเว็บ — ผลค้นหาแสดงในหน้า /assets ซึ่งจะแสดงคำค้นและโหมดปัจจุบันจาก URL
export function TopbarSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onAssetsPage = pathname === "/assets";
  const q = onAssetsPage ? (searchParams.get("q") ?? "") : "";
  const mode: Mode = onAssetsPage && searchParams.get("mode") === "semantic" ? "semantic" : "keyword";

  // key: ค้นใหม่ / เปลี่ยนหน้า แล้วรีเซ็ตค่าในช่องให้ตรง URL
  return <SearchForm key={`${pathname}|${q}|${mode}`} initialQ={q} initialMode={mode} onAssetsPage={onAssetsPage} />;
}

function SearchForm({ initialQ, initialMode, onAssetsPage }: { initialQ: string; initialMode: Mode; onAssetsPage: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [value, setValue] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  // ช่องถูกสร้างใหม่หลังล้างคำค้น (key เปลี่ยน) — โฟกัสให้พิมพ์ต่อได้ทันที
  useEffect(() => {
    if (!focusAfterClear) return;
    focusAfterClear = false;
    inputRef.current?.focus();
  }, []);

  // ล้างคำค้น — ถ้ากำลังดูผลค้นหา กลับไปรายการไฟล์โดยคงตัวกรองและโหมดไว้
  const clear = () => {
    setValue("");
    inputRef.current?.focus();
    if (onAssetsPage && initialQ) {
      const next = new URLSearchParams(searchParams);
      next.delete("q");
      next.delete("sort");
      focusAfterClear = true;
      router.push(next.size ? `/assets?${next}` : "/assets");
    }
  };

  const selectMode = (value: Mode) => {
    setMode(value);
    // กำลังดูผลค้นหา: สลับโหมดแล้วค้นใหม่ทันที (คงตัวกรองไว้ ล้างการเรียงที่อาจใช้กับอีกโหมดไม่ได้)
    if (onAssetsPage && initialQ) {
      const next = new URLSearchParams(searchParams);
      next.delete("sort");
      if (value === "semantic") next.set("mode", "semantic");
      else next.delete("mode");
      router.push(`/assets?${next}`);
    }
  };

  return (
    <form action="/assets" role="search" className="flex min-w-0 flex-1 items-center gap-3">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">ค้นหา</span>
        {mode === "semantic" ? (
          <SparkleIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-brand" />
        ) : (
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-subtle" />
        )}
        <input
          ref={inputRef}
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              clear();
            }
          }}
          placeholder={mode === "semantic" ? "อธิบายสิ่งที่ต้องการ เช่น รูปทีมงานกำลังประชุม" : "ค้นหาชื่อไฟล์ Tag หรือ Collection"}
          // ซ่อนปุ่ม × ของ browser (ล้างแค่ข้อความ และ Firefox ไม่มี) ใช้ปุ่มของเราแทน
          className="h-12 w-full rounded-xl border border-line bg-canvas pl-12 pr-12 text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="ล้างคำค้นหา"
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-subtle hover:bg-line-soft hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </label>
      {mode === "semantic" && <input type="hidden" name="mode" value="semantic" />}
      {/* ค้นจากหน้า Asset: คงตัวกรองที่เลือกอยู่ */}
      {onAssetsPage &&
        KEEP_PARAMS.map((key) => {
          const kept = searchParams.get(key);
          return kept && <input key={key} type="hidden" name={key} value={kept} />;
        })}

      <div role="group" aria-label="โหมดการค้นหา" className="hidden shrink-0 rounded-xl bg-canvas p-1 md:flex">
        {modes.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => selectMode(value)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === value ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}

// ระหว่างรอ searchParams (Suspense) แสดงช่องเปล่าหน้าตาเดียวกัน
export function TopbarSearchFallback() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-canvas" />
      <div className="hidden h-12 w-52 shrink-0 rounded-xl bg-canvas md:block" />
    </div>
  );
}
