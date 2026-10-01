"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import type { FilterOption } from "./types";

type Props = {
  name: string;
  label: string;
  icon: ReactNode;
  value: string;
  options: FilterOption[];
};

// Custom listbox: native <select> ปรับสี/รัศมี/เงาของเมนูให้ตรงกับดีไซน์เว็บไม่ได้
export function FilterSelect({ name, label, icon, value, options }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === selected)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (next: string) => {
    setOpen(false);
    if (next === selected) {
      buttonRef.current?.focus();
      return;
    }
    setSelected(next);
    if (inputRef.current) inputRef.current.value = next;
    const form = buttonRef.current?.form;
    requestAnimationFrame(() => form?.requestSubmit());
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      className="relative shrink-0"
    >
      <input ref={inputRef} type="hidden" name={name} defaultValue={value} />
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label}: ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${name}-options`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="group flex h-12 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface pl-3 pr-2 text-sm transition hover:border-brand/30 focus-visible:border-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted transition group-hover:text-brand-ink [&>svg]:size-4">
          {icon}
        </span>
        <span className="hidden text-ink-muted lg:inline">{label}</span>
        <span className="max-w-36 truncate font-semibold text-ink">{selectedLabel}</span>
        <ChevronRightIcon className={`size-4 text-ink-subtle transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={`${name}-options`}
          role="listbox"
          aria-label={label}
          onKeyDown={moveFocus}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-48 rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
        >
          {options.map((option) => {
            const active = option.value === selected;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                  active ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink hover:bg-canvas"
                }`}
              >
                {option.label}
                <CheckIcon className={`size-4 shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
