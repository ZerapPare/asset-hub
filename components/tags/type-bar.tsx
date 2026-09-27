import { fileTypeMeta } from "@/components/assets/file-type";
import type { FileType } from "@/lib/types";

export const typeLabels: Record<FileType, string> = {
  DOCUMENT: "เอกสาร",
  IMAGE: "รูปภาพ",
};

type Props = { counts: Record<FileType, number> };

// แถบซ้อนตามประเภทไฟล์ + label ตัวเลข
export function TypeBar({ counts }: Props) {
  const entries = (Object.keys(counts) as FileType[]).map((type) => ({ type, count: counts[type] }));
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const nonZero = entries.filter((e) => e.count > 0);
  const text = nonZero.map((e) => `${e.count} ${typeLabels[e.type]}`).join(" · ") || "—";

  return (
    <div className="flex items-center gap-3">
      <div role="img" aria-label={text} className="flex h-2 w-36 shrink-0 gap-0.5 overflow-hidden rounded-full bg-line-soft">
        {total > 0 &&
          nonZero.map((e) => (
            <div
              key={e.type}
              title={`${typeLabels[e.type]} ${e.count}`}
              className={`rounded-full ${fileTypeMeta[e.type].swatch}`}
              style={{ width: `${(e.count / total) * 100}%` }}
            />
          ))}
      </div>
      <span className="whitespace-nowrap text-sm text-ink-muted">{text}</span>
    </div>
  );
}
