"use client";

import { useState } from "react";

type Week = { week: string; documents: number; images: number };

// คอลัมน์ซ้อน เอกสาร (ล่าง) + รูปภาพ (บน) ต่อสัปดาห์ — สีเดียวกับ StorageBar
// hover/focus คอลัมน์ = tooltip; มีตาราง sr-only ให้ screen reader อ่านค่าครบ

const dayMonth = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

function weekLabel(week: string) {
  return dayMonth.format(new Date(`${week}T00:00:00Z`));
}

function weekRange(week: string) {
  const end = new Date(`${week}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${weekLabel(week)} – ${dayMonth.format(end)}`;
}

// เพดานแกน y เป็นเลขกลมๆ (4 / 10 / 20 / 50 …) ให้เส้นกลางเป็นจำนวนเต็ม
function niceMax(value: number) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((m) => m * step).find((v) => v >= value)!;
}

export function WeeklyUploadsChart({ weeks, className = "" }: { weeks: Week[]; className?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = weeks.map((w) => w.documents + w.images);
  const sum = totals.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(...totals));
  const ticks = [max, max / 2, 0];
  const shown = active === null ? null : weeks[active];

  return (
    <figure className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="font-semibold">อัปโหลดรายสัปดาห์</h2>
          <p className="text-sm text-ink-muted">{weeks.length} สัปดาห์ล่าสุด · รวม {sum.toLocaleString("th-TH")} ไฟล์</p>
        </div>
        <ul className="flex gap-4 text-sm text-ink-muted" aria-label="คำอธิบายสี">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-series-doc" aria-hidden="true" />
            เอกสาร
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-series-img" aria-hidden="true" />
            รูปภาพ
          </li>
        </ul>
      </figcaption>

      {sum === 0 ? (
        <p className="mt-6 py-10 text-center text-sm text-ink-muted">ยังไม่มีการอัปโหลดใน {weeks.length} สัปดาห์ล่าสุด</p>
      ) : (
        <div className="mt-5" aria-hidden="true">
          <div className="flex h-44 gap-2">
            {/* แกน y: เลขกลมๆ 3 ระดับ */}
            <div className="relative w-6 shrink-0 text-right text-xs tabular-nums text-ink-muted">
              {ticks.map((t) => (
                <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="relative flex-1" onMouseLeave={() => setActive(null)}>
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - t / max) * 100}%` }} />
              ))}
              <div className="relative flex h-full items-end">
                {weeks.map((w, i) => {
                  const total = totals[i];
                  return (
                    <div
                      key={w.week}
                      className={`flex h-full flex-1 items-end justify-center rounded-md ${active === i ? "bg-line-soft" : ""}`}
                      onMouseEnter={() => setActive(i)}
                    >
                      {total > 0 && (
                        // ล่าง = เอกสาร, บน = รูปภาพ; ปลายบนมน 4px, ฐานเหลี่ยม, เว้น 2px ระหว่างชั้น
                        <div className="flex w-full max-w-6 flex-col-reverse gap-0.5" style={{ height: `${(total / max) * 100}%` }}>
                          {w.documents > 0 && (
                            <div
                              className={`bg-series-doc ${w.images === 0 ? "rounded-t-[4px]" : ""}`}
                              style={{ flexGrow: w.documents, flexBasis: 0 }}
                            />
                          )}
                          {w.images > 0 && (
                            <div className="rounded-t-[4px] bg-series-img" style={{ flexGrow: w.images, flexBasis: 0 }} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {shown && active !== null && (
                <div
                  className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-md ${
                    active < 2 ? "left-0" : active > weeks.length - 3 ? "right-0" : "-translate-x-1/2"
                  }`}
                  style={active >= 2 && active <= weeks.length - 3 ? { left: `${((active + 0.5) / weeks.length) * 100}%` } : undefined}
                >
                  <p className="font-semibold">สัปดาห์ {weekRange(shown.week)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-ink-muted">
                    <span className="size-2.5 rounded-sm bg-series-doc" />
                    เอกสาร <span className="ml-auto pl-4 font-medium tabular-nums text-ink">{shown.documents}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-muted">
                    <span className="size-2.5 rounded-sm bg-series-img" />
                    รูปภาพ <span className="ml-auto pl-4 font-medium tabular-nums text-ink">{shown.images}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* แกน x: แสดงเว้นสัปดาห์ ไม่ให้ชนกัน (สัปดาห์ล่าสุดแสดงเสมอ) */}
          <div className="ml-8 mt-2 flex h-4 text-xs text-ink-muted">
            {weeks.map((w, i) => (
              // ป้ายกว้างกว่าคอลัมน์ได้ (เว้นทีละสัปดาห์) — วางกึ่งกลางคอลัมน์ ไม่ตัดบรรทัด
              <span key={w.week} className="relative flex-1">
                {(weeks.length - 1 - i) % 2 === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{weekLabel(w.week)}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <table className="sr-only">
        <caption>จำนวนอัปโหลดรายสัปดาห์</caption>
        <thead>
          <tr>
            <th scope="col">สัปดาห์</th>
            <th scope="col">เอกสาร</th>
            <th scope="col">รูปภาพ</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week}>
              <th scope="row">{weekRange(w.week)}</th>
              <td>{w.documents}</td>
              <td>{w.images}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
