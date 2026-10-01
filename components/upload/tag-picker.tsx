"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { CloseIcon } from "@/components/icons";

const MAX_TAGS = 20;
const MAX_SUGGESTIONS = 8;

type Props = { id: string; value: string[]; options: string[]; onChange: (tags: string[]) => void };

// เลือกจาก Tag กลางเท่านั้น (สร้างใหม่ไม่ได้)
export function TagPicker({ id, value, options, onChange }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const suggestions = options
    .filter((t) => !value.includes(t) && t.includes(q))
    .slice(0, MAX_SUGGESTIONS);
  const full = value.length >= MAX_TAGS;

  function pick(tag: string) {
    if (!full) onChange([...value, tag]);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[active]) pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const showList = open && !full && suggestions.length > 0;

  return (
    <div className="relative">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-canvas py-1 pl-3 pr-1.5 text-sm">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`ลบ Tag ${tag}`}
              className="rounded-full p-0.5 text-ink-muted hover:bg-line-soft hover:text-ink"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={full ? "" : value.length ? "" : "เลือก Tag…"}
          disabled={full}
          className="min-w-24 flex-1 bg-transparent py-1 text-ink outline-none placeholder:text-ink-subtle"
        />
      </div>

      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {suggestions.map((tag, i) => (
            <li
              key={tag}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(tag)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 ${i === active ? "bg-brand-soft text-brand-ink" : ""}`}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      {open && q && suggestions.length === 0 && !full && (
        <p className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-surface px-4 py-2 text-sm text-ink-muted shadow-lg">
          ไม่มี Tag “{query.trim()}” ในระบบ
        </p>
      )}
    </div>
  );
}
