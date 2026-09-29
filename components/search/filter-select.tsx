"use client";

import type { ReactNode } from "react";
import type { FilterOption } from "./types";

type Props = {
  name: string;
  label: string;
  icon: ReactNode;
  value: string;
  options: FilterOption[];
};

// เปลี่ยนค่าแล้วส่งฟอร์มทันที (ตัวกรองเก็บใน URL)
export function FilterSelect({ name, label, icon, value, options }: Props) {
  const active = value !== "";

  return (
    <label
      className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm transition focus-within:ring-4 focus-within:ring-brand/15 ${
        active ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-muted hover:text-ink"
      }`}
    >
      <span className="size-4 shrink-0 [&>svg]:size-4">{icon}</span>
      {/* จอเล็กเหลือแค่ไอคอน + ค่า ประหยัดที่ */}
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-40 cursor-pointer bg-transparent font-semibold text-ink outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
