"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagInput } from "@/components/upload/tag-input";
import { assetRequest } from "./api";

type Props = { assetId: string; tags: string[]; editable: boolean };

// เจ้าของแก้ได้ (บันทึกทันที) คนอื่นเห็นเป็นลิงก์กรอง
export function TagsEditor({ assetId, tags, editable }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(tags);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string>();

  async function change(next: string[]) {
    const prev = value;
    setValue(next);
    setState("saving");
    try {
      await assetRequest(assetId, "PATCH", { tags: next });
      setState("idle");
      router.refresh();
    } catch (e) {
      setValue(prev);
      setError((e as Error).message);
      setState("error");
    }
  }

  if (!editable) {
    return tags.length ? (
      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag}>
            <Link href={`/assets?tag=${encodeURIComponent(tag)}`} className="inline-flex rounded-full border border-line px-3 py-1 text-sm hover:border-brand hover:text-brand-ink">
              {tag}
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-ink-muted">ยังไม่มี Tag</p>
    );
  }

  return (
    <div>
      <TagInput id="detail-tags" value={value} onChange={change} />
      <p className={`mt-2 text-sm ${state === "error" ? "text-danger" : "text-ink-muted"}`} aria-live="polite">
        {state === "saving" ? "กำลังบันทึก…" : state === "error" ? error : "กด Enter เพื่อเพิ่ม ชื่อใหม่จะสร้าง Tag ที่ทุกคนใช้ได้"}
      </p>
    </div>
  );
}
