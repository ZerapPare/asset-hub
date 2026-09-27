import { formatBytes } from "@/lib/format";
import type { StorageSummary } from "@/lib/types";

type Props = Omit<StorageSummary, "used"> & { className?: string };

// แถบซ้อน เอกสาร + รูปภาพ
export function StorageBar({ documents, images, quota, className = "h-2" }: Props) {
  const segments = [
    { label: "เอกสาร", value: documents, color: "bg-series-doc" },
    { label: "รูปภาพ", value: images, color: "bg-series-img" },
  ].filter((s) => s.value > 0);
  const label = `ใช้ไป ${formatBytes(documents + images)} จาก ${formatBytes(quota)}: ${segments
    .map((s) => `${s.label} ${formatBytes(s.value)}`)
    .join(", ")}`;

  return (
    <div role="img" aria-label={label} className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-line-soft ${className}`}>
      {segments.map((s) => (
        <div
          key={s.label}
          title={`${s.label} ${formatBytes(s.value)}`}
          className={`rounded-full ${s.color}`}
          style={{ width: `${Math.max((s.value / quota) * 100, 0.5)}%` }}
        />
      ))}
    </div>
  );
}
