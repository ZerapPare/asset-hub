function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ไฮไลต์คำค้นในข้อความ (ไม่สนตัวพิมพ์เล็กใหญ่)
export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim();
  if (!q) return <>{text}</>;

  // split ด้วย capture group: index คี่ = ส่วนที่ตรงคำค้น
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-brand-soft px-0.5 text-brand-ink">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
