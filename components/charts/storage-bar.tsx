import { formatBytes } from "@/lib/format";

type Props = { documents: number; images: number; quota: number; className?: string };

// แถบซ้อน Documents + Images
export function StorageBar({ documents, images, quota, className = "h-2" }: Props) {
  const pct = (n: number) => `${Math.max((n / quota) * 100, 0.5)}%`;
  const label = `ใช้ไป ${formatBytes(documents + images)} จาก ${formatBytes(quota)}: เอกสาร ${formatBytes(documents)}, รูปภาพ ${formatBytes(images)}`;

  return (
    <div role="img" aria-label={label} className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-line-soft ${className}`}>
      <div title={`เอกสาร ${formatBytes(documents)}`} className="rounded-full bg-series-doc" style={{ width: pct(documents) }} />
      <div title={`รูปภาพ ${formatBytes(images)}`} className="rounded-full bg-series-img" style={{ width: pct(images) }} />
    </div>
  );
}
