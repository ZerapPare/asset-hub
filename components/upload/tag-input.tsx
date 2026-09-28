"use client";

import { useState, type KeyboardEvent } from "react";
import { CloseIcon } from "@/components/icons";

const MAX_TAGS = 20;

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);
}

type Props = { id: string; value: string[]; onChange: (tags: string[]) => void };

export function TagInput({ id, value, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const tag = normalize(draft);
    if (tag && !value.includes(tag) && value.length < MAX_TAGS) onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
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
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={value.length ? "" : "เพิ่ม Tag…"}
        disabled={value.length >= MAX_TAGS}
        className="min-w-24 flex-1 bg-transparent py-1 text-ink outline-none placeholder:text-ink-subtle"
      />
    </div>
  );
}
