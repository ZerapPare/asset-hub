import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CollectionsEditor } from "@/components/asset-detail/collections-editor";
import { PreviewPanel } from "@/components/asset-detail/preview-panel";
import { SummaryCard } from "@/components/asset-detail/summary-card";
import { TagsEditor } from "@/components/asset-detail/tags-editor";
import { StatusBadge } from "@/components/assets/status-badge";
import { AlertIcon, ArrowLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, SpinnerIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { getAssetDetail, getAssetNeighbors } from "@/lib/assets/detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listEditableCollections } from "@/lib/collections/editable";
import { listTagNames } from "@/lib/tags/list";
import { formatBytes } from "@/lib/format";
import { VISIBILITY_OPTIONS } from "@/lib/upload/rules";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const typeLabel = { DOCUMENT: "เอกสาร", IMAGE: "รูปภาพ" } as const;

export async function generateMetadata({ params }: PageProps<"/assets/[id]">): Promise<Metadata> {
  const user = await getCurrentUser();
  const asset = user && (await getAssetDetail(user.user_id, (await params).id));
  return { title: `${asset ? asset.name : "ไม่พบไฟล์"} — AssetHub` };
}

export default async function AssetDetailPage({ params }: PageProps<"/assets/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const asset = await getAssetDetail(user.user_id, id);
  if (!asset) notFound();

  const [neighbors, editable, tagOptions] = await Promise.all([
    getAssetNeighbors(user.user_id, asset.id),
    asset.isOwner ? listEditableCollections(user.user_id) : Promise.resolve([]),
    asset.isOwner ? listTagNames() : Promise.resolve([]),
  ]);
  const visibility = VISIBILITY_OPTIONS.find((v) => v.value === asset.visibility);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/assets" aria-label="กลับไป Asset ทั้งหมด" className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface hover:border-ink-subtle">
          <ArrowLeftIcon className="size-5" />
        </Link>
        <nav aria-label="breadcrumb" className="min-w-0 flex-1 truncate text-ink-muted">
          <Link href="/assets" className="hover:text-ink">Asset ทั้งหมด</Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-ink">{asset.name}</span>
        </nav>
        {neighbors && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-ink-muted tabular-nums sm:inline">
              {neighbors.index + 1} จาก {neighbors.total}
            </span>
            <NeighborLink id={neighbors.prev} label="ไฟล์ก่อนหน้า">
              <ChevronLeftIcon className="size-5" />
            </NeighborLink>
            <NeighborLink id={neighbors.next} label="ไฟล์ถัดไป">
              <ChevronRightIcon className="size-5" />
            </NeighborLink>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <PreviewPanel assetId={asset.id} fileType={asset.fileType} name={asset.name} extension={asset.extension} />

        <aside className="divide-y divide-line rounded-3xl border border-line bg-surface">
          <SummaryCard asset={asset} />

          <Section title="รายละเอียด">
            <dl className="divide-y divide-line-soft">
              <Row label="ชนิดไฟล์">{asset.extension.toUpperCase()} {typeLabel[asset.fileType]}</Row>
              <Row label="ขนาดไฟล์">{formatBytes(asset.size)}</Row>
              <Row label="ขนาดภาพ">{asset.width && asset.height ? `${asset.width} × ${asset.height} px` : "—"}</Row>
              <Row label="อัปโหลดโดย">
                <span className="flex items-center gap-2">
                  <Avatar name={asset.owner.name} src={asset.owner.avatarUrl} />
                  <span className="truncate">{asset.owner.name}</span>
                  {asset.isOwner && <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand-ink">คุณ</span>}
                </span>
              </Row>
              <Row label="วันที่อัปโหลด">{dateTime.format(new Date(asset.createdAt))}</Row>
              <Row label="สิทธิ์การมองเห็น">{visibility?.label ?? asset.visibility}</Row>
              <Row label="สถานะ"><StatusBadge status={asset.status} /></Row>
            </dl>
          </Section>

          <Section title="สถานะการประมวลผล">
            <ProcessingBox status={asset.status} updatedAt={asset.updatedAt} error={asset.error} />
          </Section>

          <Section title="Tag">
            <TagsEditor key={asset.tags.join()} assetId={asset.id} tags={asset.tags} options={tagOptions} editable={asset.isOwner} />
          </Section>

          <Section title="Collection">
            <CollectionsEditor
              assetId={asset.id}
              current={asset.collections}
              editable={editable}
              canEdit={asset.isOwner}
              isPrivate={asset.visibility === "PRIVATE"}
            />
          </Section>
        </aside>
      </div>
    </div>
  );
}

function NeighborLink({ id, label, children }: { id: string | null; label: string; children: ReactNode }) {
  const cls = "flex size-12 items-center justify-center rounded-xl border border-line bg-surface";
  return id ? (
    <Link href={`/assets/${id}`} aria-label={label} className={`${cls} hover:border-ink-subtle`}>
      {children}
    </Link>
  ) : (
    <span aria-hidden="true" className={`${cls} opacity-40`}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

function ProcessingBox({ status, updatedAt, error }: { status: string; updatedAt: string; error: string | null }) {
  if (status === "READY") {
    return (
      <div className="flex gap-3 rounded-2xl border border-success/25 bg-success-soft p-4 text-success">
        <CheckIcon className="mt-0.5 size-5 shrink-0" />
        <div>
          <p><strong>พร้อมใช้งาน</strong> — ดูตัวอย่าง ดาวน์โหลด และค้นหาด้วย Semantic Search ได้</p>
          <p className="mt-1 text-sm opacity-80">ประมวลผลเสร็จ {dateTime.format(new Date(updatedAt))}</p>
        </div>
      </div>
    );
  }
  if (status === "FAILED") {
    return (
      <div className="flex gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-4 text-danger">
        <AlertIcon className="mt-0.5 size-5 shrink-0" />
        <div>
          <p><strong>ประมวลผลไม่สำเร็จ</strong> — ไฟล์นี้จะไม่ขึ้นใน Semantic Search แต่ยังดาวน์โหลดได้</p>
          {error && <p className="mt-1 text-sm opacity-80">สาเหตุ: {error}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-2xl border border-info/25 bg-info-soft p-4 text-info">
      <SpinnerIcon className="mt-0.5 size-5 shrink-0 animate-spin" />
      <p><strong>กำลังประมวลผล</strong> — กำลังเตรียมข้อมูลสำหรับ Semantic Search ระหว่างนี้ดาวน์โหลดได้ตามปกติ</p>
    </div>
  );
}
