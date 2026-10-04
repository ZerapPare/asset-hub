"use client";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none transition placeholder:text-ink-subtle focus:border-brand focus:ring-4 focus:ring-brand/15";

type Props = {
  name: string;
  description: string;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  error?: string;
};

// ช่องชื่อ + คำอธิบาย (ใช้ทั้งสร้างและแก้ไข)
export function CollectionForm({ name, description, onName, onDescription, error }: Props) {
  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="collection-name" className="mb-2 block font-medium">ชื่อ</label>
        <input
          id="collection-name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={100}
          placeholder="เช่น โปรเจกต์จบ 2026"
          autoFocus
          className={`${inputClass} h-12`}
        />
      </div>
      <div>
        <label htmlFor="collection-desc" className="mb-2 block font-medium">คำอธิบาย (ไม่บังคับ)</label>
        <textarea
          id="collection-desc"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Collection นี้รวมไฟล์อะไรบ้าง"
          className={`${inputClass} py-3`}
        />
      </div>
    </div>
  );
}
