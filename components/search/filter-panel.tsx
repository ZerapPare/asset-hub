"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, FilterIcon } from "@/components/icons";
import { CleanForm } from "./clean-form";
import { OWNER_OPTIONS, UPLOADED_OPTIONS } from "./options";
import type { FilterOption, SearchFilters } from "./types";

type Props = {
  values: SearchFilters;
  /** ค่าที่ต้องส่งต่อไปพร้อมตัวกรอง (q, mode, type, sort, view) */
  keep: Record<string, string>;
  collectionOptions: FilterOption[];
  tagOptions: FilterOption[];
  activeCount: number;
  clearHref: string;
};

// Desktop: popover ใต้ปุ่ม, มือถือ: bottom sheet
// เลือกค่าแล้วกด "ใช้ตัวกรอง" ถึงจะค้นใหม่ (ไม่ค้นทุกครั้งที่เปลี่ยนค่า)
export function FilterPanel({ values, keep, collectionOptions, tagOptions, activeCount, clearHref }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hasDraftFilters, setHasDraftFilters] = useState(activeCount > 0);
  const [uploaded, setUploaded] = useState(values.uploaded);
  const [uploadedFrom, setUploadedFrom] = useState(values.uploadedFrom);
  const [uploadedTo, setUploadedTo] = useState(values.uploadedTo);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const clearFilters = () => {
    const form = panelRef.current;
    if (!form) return;
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      input.checked = input.value === "";
    }
    for (const select of form.querySelectorAll<HTMLSelectElement>("select")) select.value = "";
    setUploaded("");
    setUploadedFrom("");
    setUploadedTo("");
    setHasDraftFilters(false);
    if (activeCount > 0) {
      setOpen(false);
      router.push(clearHref);
    }
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("input, select")?.focus();

    const close = () => {
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="search-filter-panel"
        className={`flex h-12 items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold transition ${
          activeCount > 0 ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-muted hover:text-ink"
        }`}
      >
        <FilterIcon className="size-4" />
        ตัวกรอง
        {activeCount > 0 && <span className="tabular-nums">({activeCount})</span>}
      </button>

      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-ink/40 sm:hidden" />
          <CleanForm
            ref={panelRef}
            id="search-filter-panel"
            action="/assets"
            aria-label="ตัวกรอง"
            onChange={(event) => {
              const data = new FormData(event.currentTarget);
              setHasDraftFilters(["uploaded", "owner", "collection", "tag"].some((name) => Boolean(data.get(name))));
            }}
            className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-14 sm:w-96 sm:rounded-2xl sm:border sm:border-line sm:shadow-xl"
          >
            {Object.entries(keep).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}

            {/* ขีดจับของ bottom sheet */}
            <div aria-hidden="true" className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-bold">ตัวกรอง</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="space-y-5">
              <ChoiceGroup
                name="uploaded"
                legend="วันที่อัปโหลด"
                value={values.uploaded}
                options={UPLOADED_OPTIONS}
                onChange={setUploaded}
              />
              {uploaded === "custom" && (
                <fieldset className="grid grid-cols-1 items-end gap-2 min-[380px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <legend className="sr-only">ช่วงวันที่อัปโหลดที่กำหนดเอง</legend>
                  <DateField
                    name="from"
                    label="เริ่มต้น"
                    value={uploadedFrom}
                    max={uploadedTo || undefined}
                    onChange={setUploadedFrom}
                  />
                  <span aria-hidden="true" className="hidden h-11 items-center text-ink-subtle min-[380px]:flex">
                    →
                  </span>
                  <DateField
                    name="to"
                    label="สิ้นสุด"
                    value={uploadedTo}
                    min={uploadedFrom || undefined}
                    onChange={setUploadedTo}
                  />
                </fieldset>
              )}
              <ChoiceGroup name="owner" legend="เจ้าของ" value={values.owner} options={OWNER_OPTIONS} />
              <SelectField name="collection" label="Collection" value={values.collection} options={collectionOptions} />
              <SelectField name="tag" label="Tag" value={values.tag} options={tagOptions} />
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
              <button
                type="button"
                disabled={!hasDraftFilters}
                onClick={clearFilters}
                className="px-1 text-sm font-semibold text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:text-ink-subtle disabled:opacity-50"
              >
                ล้างทั้งหมด
              </button>
              <button type="submit" className="h-11 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover">
                ใช้ตัวกรอง
              </button>
            </div>
          </CleanForm>
        </>
      )}
    </div>
  );
}

// ตัวเลือกน้อย ใช้ปุ่มเลือกที่เห็นครบทุกตัว (กดครั้งเดียว)
function ChoiceGroup({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: string;
  options: FilterOption[];
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm text-ink-muted transition hover:text-ink has-[:checked]:border-brand/40 has-[:checked]:bg-brand-soft has-[:checked]:font-semibold has-[:checked]:text-brand-ink has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/20"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={value === o.value}
              onChange={() => onChange?.(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DateField({
  name,
  label,
  value,
  min,
  max,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-ink-muted">{label}</span>
      <input
        type="date"
        name={name}
        value={value}
        min={min}
        max={max}
        required
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
      />
    </label>
  );
}

// ตัวเลือกเยอะ (Collection, Tag) ใช้ dropdown
function SelectField({ name, label, value, options }: { name: string; label: string; value: string; options: FilterOption[] }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
      >
        <option value="">ทั้งหมด</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
