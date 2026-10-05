import type { Metadata } from "next";
import Link from "next/link";
import { AssetCard } from "@/components/assets/asset-card";
import { fileTypeMeta } from "@/components/assets/file-type";
import { LiveStatusBadge } from "@/components/assets/live-status";
import { statusMeta } from "@/components/assets/status-badge";
import { StorageBar } from "@/components/charts/storage-bar";
import { WeeklyUploadsChart } from "@/components/charts/weekly-uploads";
import { AlertIcon, CheckIcon, FileIcon, ImageIcon, LayersIcon, SpinnerIcon, UploadIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/current-user";
import { STORAGE_QUOTA } from "@/lib/config";
import { getDashboard, type Dashboard, type ProcessingItem } from "@/lib/assets/dashboard";
import { formatBytes, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "แดชบอร์ด — AssetHub" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <EmptyState>ไม่พบบัญชีของคุณในระบบ กรุณาออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง</EmptyState>;
  }

  const data = await getDashboard(user.user_id);
  const { DOCUMENT: docs, IMAGE: images } = data.byType;
  const usedPct = Math.round((data.storageUsed / STORAGE_QUOTA) * 100);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">แดชบอร์ด</h1>
          <p className="mt-1 text-ink-muted">ภาพรวม Asset ที่คุณอัปโหลด</p>
        </div>
        {/* จอมือถือใช้ปุ่มอัปโหลดใน topbar แทน */}
        <Link href="/upload" className="hidden h-12 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-hover sm:flex">
          <UploadIcon className="size-5" />
          อัปโหลด Asset
        </Link>
      </div>

      {/* มือถือ: ยอดรวมเต็มแถว แล้วเอกสาร/รูปภาพคู่กัน, จอใหญ่: 3 ช่องแถวเดียว */}
      <section aria-label="สรุปจำนวน Asset" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile icon={<LayersIcon />} label="Asset ทั้งหมด" value={data.totalAssets} className="col-span-2 sm:col-span-1">
          {data.processing + data.failed > 0 ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {data.processing > 0 && <StatusCount status="PROCESSING" count={data.processing} />}
              {data.failed > 0 && <StatusCount status="FAILED" count={data.failed} />}
            </span>
          ) : (
            "ประมวลผลครบทุกไฟล์"
          )}
        </StatTile>
        <StatTile icon={<FileIcon />} label="เอกสาร" value={docs.count} swatch={fileTypeMeta.DOCUMENT.swatch}>
          {formatBytes(docs.bytes)}
        </StatTile>
        <StatTile icon={<ImageIcon />} label="รูปภาพ" value={images.count} swatch={fileTypeMeta.IMAGE.swatch}>
          {formatBytes(images.bytes)}
        </StatTile>
      </section>

      {/* จอใหญ่: สถานะการประมวลผล | กราฟอัปโหลด */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ProcessingPanel data={data} />
        <WeeklyUploadsChart weeks={data.weekly} />
      </div>

      <section aria-labelledby="storage-heading" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="storage-heading" className="font-semibold">พื้นที่จัดเก็บ</h2>
          <p className="text-sm text-ink-muted">
            <span className="text-lg font-bold text-ink tabular-nums">{formatBytes(data.storageUsed)}</span> จาก{" "}
            {formatBytes(STORAGE_QUOTA)} · {usedPct}%
          </p>
        </div>
        <StorageBar documents={docs.bytes} images={images.bytes} quota={STORAGE_QUOTA} className="mt-4 h-2.5" />
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
          <Legend swatch={fileTypeMeta.DOCUMENT.swatch} label="เอกสาร" bytes={docs.bytes} />
          <Legend swatch={fileTypeMeta.IMAGE.swatch} label="รูปภาพ" bytes={images.bytes} />
        </ul>
      </section>

      <section aria-labelledby="recent-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="recent-heading" className="text-xl font-bold">อัปโหลดล่าสุด</h2>
          {data.recent.length > 0 && (
            <Link href="/assets" className="text-sm font-semibold text-brand hover:text-brand-hover">
              ดูทั้งหมด
            </Link>
          )}
        </div>
        {data.recent.length === 0 ? (
          <EmptyState>
            คุณยังไม่ได้อัปโหลด Asset —{" "}
            <Link href="/upload" className="font-semibold text-brand hover:text-brand-hover">
              อัปโหลดไฟล์แรก
            </Link>
          </EmptyState>
        ) : (
          // มือถือแสดง 4 ใบพอ ไม่ให้ต้องเลื่อนยาว
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-sm:[&>*:nth-child(n+5)]:hidden">
            {data.recent.map((asset) => (
              <AssetCard key={asset.id} asset={asset} meName={user.display_name} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// สถานะการประมวลผล: พร้อมค้นด้วยความหมาย + ไฟล์ที่กำลังประมวลผล (อัปเดตสด) + ไฟล์ที่ล้มพร้อมสาเหตุ
function ProcessingPanel({ data }: { data: Dashboard }) {
  const { semantic } = data;
  const readyPct = semantic.total > 0 ? Math.round((semantic.ready / semantic.total) * 100) : 0;
  const allDone = data.processing === 0 && data.failed === 0;

  return (
    <section aria-labelledby="processing-heading" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 id="processing-heading" className="font-semibold">สถานะการประมวลผล</h2>

      {/* ไฟล์ที่ READY แล้ว ค้นแบบ Semantic ได้กี่ไฟล์ */}
      <div className="mt-3">
        <p className="text-sm text-ink-muted">
          พร้อมค้นด้วยความหมาย{" "}
          <span className="text-lg font-bold text-ink tabular-nums">{semantic.ready.toLocaleString("th-TH")}</span> จาก{" "}
          {semantic.total.toLocaleString("th-TH")} ไฟล์
        </p>
        <div
          role="img"
          aria-label={`พร้อมค้นด้วยความหมาย ${semantic.ready} จาก ${semantic.total} ไฟล์`}
          className="mt-2 h-2 overflow-hidden rounded-full bg-brand-soft"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${readyPct}%` }} />
        </div>
        {semantic.pending + semantic.failed + semantic.noText > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {semantic.pending > 0 && (
              <li className="inline-flex items-center gap-1 text-info">
                <SpinnerIcon className="size-3.5" />
                กำลังสร้างข้อมูลค้นหา {semantic.pending}
              </li>
            )}
            {semantic.failed > 0 && (
              <li className="inline-flex items-center gap-1 text-danger">
                <AlertIcon className="size-3.5" />
                สร้างไม่สำเร็จ {semantic.failed} · ระบบลองใหม่อัตโนมัติ
              </li>
            )}
            {semantic.noText > 0 && (
              <li className="inline-flex items-center gap-1 text-ink-muted">
                <FileIcon className="size-3.5" />
                ไม่มีข้อความให้ค้น (ภาพสแกน) {semantic.noText}
              </li>
            )}
          </ul>
        )}
      </div>

      {allDone ? (
        <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-4 text-sm text-success">
          <CheckIcon className="size-4" />
          ประมวลผลครบทุกไฟล์
        </p>
      ) : (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {data.processingItems.length > 0 && (
            <StatusList title="กำลังประมวลผล" items={data.processingItems} total={data.processing} />
          )}
          {data.failedItems.length > 0 && (
            <StatusList title="ประมวลผลไม่สำเร็จ" items={data.failedItems} total={data.failed} />
          )}
        </div>
      )}
    </section>
  );
}

function StatusList({ title, items, total }: { title: string; items: ProcessingItem[]; total: number }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink-muted">
        {title} <span className="tabular-nums">({total})</span>
      </h3>
      <ul className="mt-2 divide-y divide-line">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/assets/${item.id}`} className="flex items-start gap-3 py-2 hover:text-brand-ink">
              <span className={`mt-1.5 size-2 shrink-0 rounded-sm ${fileTypeMeta[item.fileType].swatch}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className={`block text-sm ${item.reason ? "text-danger" : "text-ink-muted"}`}>
                  {item.reason ?? `${item.extension} · อัปโหลด ${formatRelative(item.createdAt)}`}
                </span>
              </span>
              {/* อัปเดตสดจนเสร็จ */}
              <LiveStatusBadge assetId={item.id} status={item.status} />
            </Link>
          </li>
        ))}
      </ul>
      {total > items.length && <p className="mt-1 text-sm text-ink-muted">และอีก {total - items.length} ไฟล์</p>}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  swatch,
  className = "",
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  swatch?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <span className="size-5 shrink-0 [&>svg]:size-5">{icon}</span>
        <span className="truncate">{label}</span>
        {swatch && <span className={`ml-auto size-2.5 shrink-0 rounded-sm ${swatch}`} aria-hidden="true" />}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:mt-3 sm:text-4xl">{value.toLocaleString("th-TH")}</p>
      <div className="mt-1 text-sm text-ink-muted">{children}</div>
    </div>
  );
}

function StatusCount({ status, count }: { status: "PROCESSING" | "FAILED"; count: number }) {
  const { label, Icon, text } = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${text}`}>
      <Icon className="size-3.5" />
      {label} {count}
    </span>
  );
}

function Legend({ swatch, label, bytes }: { swatch: string; label: string; bytes: number }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${swatch}`} aria-hidden="true" />
      {label} <span className="font-medium text-ink tabular-nums">{formatBytes(bytes)}</span>
    </li>
  );
}
