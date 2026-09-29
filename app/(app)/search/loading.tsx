// แสดงระหว่างรอผลค้นหาจาก server (หน้าตาเดียวกับผลแบบ Grid ซึ่งเป็นค่าเริ่มต้น)
export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังค้นหา…</span>
      <div className="space-y-2">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-line-soft" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded bg-line-soft" />
      </div>
      <div className="flex items-end justify-between border-b border-line pb-2">
        <div className="h-7 w-48 animate-pulse rounded bg-line-soft" />
        <div className="h-12 w-72 animate-pulse rounded-xl bg-line-soft" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="aspect-[16/7] animate-pulse bg-line-soft" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-line-soft" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-line-soft" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
