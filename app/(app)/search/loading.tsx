// แสดงระหว่างรอผลค้นหาจาก server
export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังค้นหา…</span>
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-line-soft" />
        <div className="h-4 w-80 animate-pulse rounded bg-line-soft" />
      </div>
      <div className="flex items-end justify-between border-b border-line pb-2">
        <div className="h-6 w-48 animate-pulse rounded bg-line-soft" />
        <div className="h-10 w-64 animate-pulse rounded-xl bg-line-soft" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
            <div className="size-16 shrink-0 animate-pulse rounded-xl bg-line-soft sm:size-20" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-1/2 animate-pulse rounded bg-line-soft" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-line-soft" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-line-soft" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
