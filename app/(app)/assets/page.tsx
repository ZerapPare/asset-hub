import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CheckIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  SortIcon,
  SparkleIcon,
  UploadIcon,
} from "@/components/icons";
import { CleanForm } from "@/components/search/clean-form";
import { FilterPanel } from "@/components/search/filter-panel";
import { FilterSelect } from "@/components/search/filter-select";
import { mockSemanticSearch } from "@/components/search/mock";
import { OWNER_OPTIONS, UPLOADED_OPTIONS } from "@/components/search/options";
import { SearchResultCard } from "@/components/search/search-result-card";
import type { FilterOption, SearchFilters, SearchMode, SearchResult, SearchView } from "@/components/search/types";
import { UploadLink } from "@/components/upload/upload-link";
import { LIST_LIMIT, listAssets, type ListSort } from "@/lib/api/assets";
import {
  SEARCH_LIMIT,
  SearchTimeoutError,
  UPLOADED_RANGES,
  getSearchFilterOptions,
  searchAssets,
  type AssetFilterOptions,
  type SearchSort,
} from "@/lib/assets/search";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Asset ทั้งหมด — AssetHub" };

// หน้าเดียวทั้งดูไฟล์และค้นหา: ไม่มี q = รายการไฟล์ / มี q = ผลค้นหา (ช่องค้นหาอยู่บน topbar)
const PARAM_KEYS = ["q", "mode", "type", "uploaded", "owner", "collection", "tag", "sort", "view"] as const;
type Params = Record<(typeof PARAM_KEYS)[number], string>;
type Href = (overrides: Partial<Params>) => string;

const FILTER_KEYS = ["uploaded", "owner", "collection", "tag"] as const satisfies readonly (keyof SearchFilters)[];
const noFilters = { uploaded: "", owner: "", collection: "", tag: "" };

const typeTabs: FilterOption[] = [
  { value: "", label: "ทั้งหมด" },
  { value: "document", label: "เอกสาร" },
  { value: "image", label: "รูปภาพ" },
];

const typeTitles: Record<string, string> = { document: "เอกสาร", image: "รูปภาพ" };

// ค่าว่าง = การเรียงเริ่มต้นของแต่ละแบบ
// Semantic เรียงตามชื่อไม่มีประโยชน์ เหลือแค่ความใกล้เคียงกับวันที่
const sortOptions: Record<"browse" | SearchMode, FilterOption[]> = {
  browse: [
    { value: "", label: "ใหม่สุด" },
    { value: "oldest", label: "เก่าสุด" },
    { value: "name", label: "ชื่อ A–Z" },
  ],
  keyword: [
    { value: "", label: "ตรงที่สุด" },
    { value: "newest", label: "ใหม่สุด" },
    { value: "oldest", label: "เก่าสุด" },
    { value: "name", label: "ชื่อ A–Z" },
  ],
  semantic: [
    { value: "", label: "ใกล้เคียงที่สุด" },
    { value: "newest", label: "ใหม่สุด" },
  ],
};

// ค่าใน URL ที่ไม่อยู่ในรายการ ถือว่าไม่ได้เลือก (ไม่ขึ้น chip และไม่ส่งไป query)
const allowed: Partial<Record<keyof Params, readonly string[]>> = {
  type: ["document", "image"],
  uploaded: UPLOADED_RANGES,
  owner: ["me"],
  view: ["list"],
  mode: ["semantic"],
};

export default async function AssetsPage({ searchParams }: PageProps<"/assets">) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    PARAM_KEYS.map((key) => {
      const value = typeof raw[key] === "string" ? raw[key].trim() : "";
      const list = allowed[key];
      return [key, list && !list.includes(value) ? "" : value];
    }),
  ) as Params;
  const kind = params.q ? (params.mode === "semantic" ? "semantic" : "keyword") : "browse";
  if (kind === "browse") params.mode = "";
  if (!sortOptions[kind].some((o) => o.value === params.sort)) params.sort = "";

  return (
    // key: เปลี่ยนคำค้น / ตัวกรองแล้วแสดง skeleton ระหว่างรอผลใหม่
    <Suspense key={JSON.stringify(params)} fallback={<AssetsSkeleton />}>
      <AssetsView params={params} kind={kind} />
    </Suspense>
  );
}

async function AssetsView({ params, kind }: { params: Params; kind: "browse" | SearchMode }) {
  const { q } = params;
  // ค่าเริ่มต้นเป็น Grid
  const view: SearchView = params.view === "list" ? "list" : "grid";
  const filters: SearchFilters = { uploaded: params.uploaded, owner: params.owner, collection: params.collection, tag: params.tag };

  // ลิงก์จากค่าปัจจุบัน + ค่าที่เปลี่ยน (ไม่ใส่ค่าว่างและค่าเริ่มต้นใน URL)
  const href: Href = (overrides) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (!value || (key === "mode" && value === "keyword") || (key === "view" && value === "grid")) continue;
      next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/assets?${qs}` : "/assets";
  };

  const user = (await getCurrentUser())!;
  const filterOptions: AssetFilterOptions = {
    type: params.type === "image" ? "IMAGE" : params.type === "document" ? "DOCUMENT" : undefined,
    uploaded: (params.uploaded || undefined) as (typeof UPLOADED_RANGES)[number] | undefined,
    mine: params.owner === "me",
    collectionId: params.collection || undefined,
    tag: params.tag || undefined,
  };

  // sort ผ่านการตรวจกับ sortOptions[kind] แล้ว
  const sort = params.sort || undefined;
  const load = async (): Promise<{ results: SearchResult[]; timedOut: boolean }> => {
    if (kind === "browse") {
      const assets = await listAssets(user.user_id, { ...filterOptions, sort: sort as ListSort | undefined });
      return { results: assets.map((asset) => ({ asset, tags: [], matchedIn: [] })), timedOut: false };
    }
    if (kind === "semantic") {
      // TODO: Semantic Search จริง (pgvector + Bedrock)
      return { results: mockSemanticSearch(q, params.type, filters), timedOut: false };
    }
    try {
      return { results: await searchAssets(user.user_id, q, { ...filterOptions, sort: sort as SearchSort | undefined }), timedOut: false };
    } catch (error) {
      if (!(error instanceof SearchTimeoutError)) throw error;
      return { results: [], timedOut: true };
    }
  };
  const [{ collections: collectionOptions, tags: tagOptions }, { results, timedOut }] = await Promise.all([
    getSearchFilterOptions(user.user_id),
    load(),
  ]);

  const limit = kind === "browse" ? LIST_LIMIT : SEARCH_LIMIT;
  const atLimit = results.length >= limit;
  const activeFilters = FILTER_KEYS.filter((key) => filters[key]);
  const isFiltered = activeFilters.length > 0 || params.type !== "";
  const clearFiltersHref = href({ ...noFilters, type: "" });
  const chipLabel: Record<(typeof FILTER_KEYS)[number], string> = {
    uploaded: `อัปโหลด: ${labelOf(UPLOADED_OPTIONS, filters.uploaded)}`,
    owner: `เจ้าของ: ${labelOf(OWNER_OPTIONS, filters.owner)}`,
    collection: `Collection: ${labelOf(collectionOptions, filters.collection)}`,
    tag: `Tag: ${labelOf(tagOptions, filters.tag)}`,
  };
  const count = (
    <span className="font-semibold text-ink">{atLimit ? `${limit}+` : results.length}</span>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {kind === "browse" ? (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{typeTitles[params.type] ?? "Asset ทั้งหมด"}</h1>
              <p className="text-ink-muted">
                {count} ไฟล์{atLimit && ` (แสดง ${limit} รายการแรก ลองใช้ตัวกรองให้แคบลง)`}
              </p>
            </>
          ) : (
            <>
              <h1 className="min-w-0 break-words text-3xl font-bold tracking-tight">
                ผลการค้นหา “<span className="text-brand-ink">{q}</span>”
              </h1>
              <p className="text-ink-muted">
                พบ {count} ไฟล์{atLimit && ` (แสดง ${limit} รายการแรก ลองใช้ตัวกรองให้แคบลง)`} ·{" "}
                {kind === "semantic"
                  ? "ค้นตามความหมาย แสดงเฉพาะไฟล์ที่ประมวลผลเสร็จแล้ว"
                  : "ค้นจากชื่อไฟล์ Tag Collection คำอธิบาย และเนื้อหาในเอกสาร"}
              </p>
            </>
          )}
        </div>
        {kind === "browse" ? (
          <UploadLink className="flex h-12 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-hover">
            <UploadIcon className="size-5" />
            อัปโหลด Asset
          </UploadLink>
        ) : (
          // topbar ซ่อนปุ่มเลือกโหมดบนจอเล็ก
          <ModeSwitch mode={kind} href={href} className="md:hidden" />
        )}
      </header>

      {/* Toolbar: ซ้ายประเภทไฟล์ / ขวาตัวกรอง เรียงลำดับ รูปแบบการแสดง */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
        <nav aria-label="ประเภทไฟล์" className="-mb-px flex gap-1">
          {typeTabs.map((tab) => (
            <Link
              key={tab.value}
              href={href({ type: tab.value })}
              aria-current={params.type === tab.value ? "page" : undefined}
              className={`border-b-2 px-3 pb-3 pt-1 text-sm font-semibold transition ${
                params.type === tab.value ? "border-brand text-brand-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 pb-2">
          <FilterPanel
            values={filters}
            keep={{ q, mode: kind === "semantic" ? kind : "", type: params.type, sort: params.sort, view: params.view }}
            collectionOptions={collectionOptions}
            tagOptions={tagOptions}
            activeCount={activeFilters.length}
            clearHref={href(noFilters)}
          />
          <CleanForm action="/assets">
            {(["q", "mode", "type", ...FILTER_KEYS, "view"] as const).map(
              (key) => params[key] && <input key={key} type="hidden" name={key} value={params[key]} />,
            )}
            <FilterSelect name="sort" label="เรียงตาม" icon={<SortIcon />} value={params.sort} options={sortOptions[kind]} />
          </CleanForm>
          <ViewToggle view={view} href={href} />
        </div>
      </div>

      {activeFilters.length > 0 && (
        <ul aria-label="ตัวกรองที่ใช้อยู่" className="flex flex-wrap items-center gap-2">
          {activeFilters.map((key) => (
            <li key={key}>
              <Link
                href={href({ [key]: "" })}
                aria-label={`เอาตัวกรอง ${chipLabel[key]} ออก`}
                className="flex items-center gap-1.5 rounded-full bg-brand-soft py-1.5 pl-3 pr-2 text-sm font-medium text-brand-ink hover:bg-brand/15"
              >
                {chipLabel[key]}
                <CloseIcon className="size-3.5" />
              </Link>
            </li>
          ))}
          <li>
            <Link href={href(noFilters)} className="px-2 text-sm font-semibold text-ink-muted hover:text-ink">
              ล้างทั้งหมด
            </Link>
          </li>
        </ul>
      )}

      {timedOut ? (
        <EmptyBlock
          title="ค้นหาใช้เวลานานเกินไป"
          body="คำค้นนี้ตรงกับข้อมูลจำนวนมาก ลองใช้คำที่เจาะจงขึ้น หรือเลือกตัวกรองเพื่อจำกัดผลลัพธ์"
        />
      ) : results.length === 0 ? (
        isFiltered ? (
          <EmptyBlock
            title="ไม่พบไฟล์ที่ตรงกับตัวกรอง"
            body={
              kind === "browse"
                ? "ไม่มีไฟล์ภายใต้ตัวกรองที่เลือก ลองล้างตัวกรอง"
                : `ไม่มีไฟล์ที่ตรงกับ “${q}” ภายใต้ตัวกรองที่เลือก ลองล้างตัวกรองแล้วค้นอีกครั้ง`
            }
            action={
              <Link href={clearFiltersHref} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">
                ล้างตัวกรอง
              </Link>
            }
          />
        ) : kind === "browse" ? (
          <EmptyBlock
            title="ยังไม่มี Asset"
            body="อัปโหลดไฟล์ PDF หรือรูปภาพเพื่อเริ่มต้น"
            action={
              <UploadLink className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">
                อัปโหลดไฟล์แรก
              </UploadLink>
            }
          />
        ) : (
          <EmptyBlock
            title={`ไม่พบไฟล์ที่ตรงกับ “${q}”`}
            body="ลองตรวจการสะกด ใช้คำที่สั้นลง หรือค้นแบบ Semantic เพื่อหาจากความหมาย"
            action={
              kind === "keyword" && (
                <Link
                  href={href({ mode: "semantic", sort: "" })}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-brand/40 hover:text-brand-ink"
                >
                  <SparkleIcon className="size-4" />
                  ลองค้นแบบ Semantic
                </Link>
              )
            }
          />
        )
      ) : (
        <section
          aria-label={kind === "browse" ? "รายการไฟล์" : "ผลการค้นหา"}
          className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "space-y-3"}
        >
          {results.map((result) => (
            // ไฮไลต์เฉพาะ Keyword (Semantic ไม่ได้ค้นจากคำที่ตรงกัน)
            <SearchResultCard key={result.asset.id} result={result} query={kind === "keyword" ? q : ""} layout={view} />
          ))}
        </section>
      )}
    </div>
  );
}

function labelOf(options: FilterOption[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function ModeSwitch({ mode, href, className = "" }: { mode: SearchMode; href: Href; className?: string }) {
  return (
    <nav aria-label="โหมดการค้นหา" className={`inline-flex rounded-xl bg-surface p-1 ring-1 ring-line ${className}`}>
      {(
        [
          { value: "keyword", label: "Keyword", Icon: SearchIcon },
          { value: "semantic", label: "Semantic", Icon: SparkleIcon },
        ] as const
      ).map(({ value, label, Icon }) => (
        <Link
          key={value}
          href={href({ mode: value, sort: "" })}
          aria-current={mode === value ? "page" : undefined}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
            mode === value ? "bg-brand-soft text-brand-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

// ปุ่มสองฝั่งติดกัน ฝั่งที่เลือกพื้นส้มอ่อน + ✓
function ViewToggle({ view, href }: { view: SearchView; href: Href }) {
  const items = [
    { value: "grid", label: "ตาราง", Icon: GridIcon },
    { value: "list", label: "รายการ", Icon: ListIcon },
  ] as const;

  return (
    // มือถือ Grid เหลือคอลัมน์เดียว แทบไม่ต่างจาก List จึงซ่อนปุ่มนี้
    <nav aria-label="รูปแบบการแสดงผล" className="hidden h-12 overflow-hidden rounded-xl border border-line bg-surface sm:flex">
      {items.map(({ value, label, Icon }) => {
        const active = view === value;
        return (
          <Link
            key={value}
            href={href({ view: value })}
            aria-current={active ? "true" : undefined}
            aria-label={`แสดงแบบ${label}`}
            className={`flex items-center gap-1 border-line px-3 transition first:border-r ${
              active ? "bg-brand-soft text-brand-ink" : "text-ink-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {active && <CheckIcon className="size-3.5" />}
            <Icon className="size-4" />
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyBlock({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-canvas text-ink-subtle">
        <SearchIcon className="size-6" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="max-w-md text-sm text-ink-muted">{body}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

// ระหว่างรอผลจาก server (หน้าตาเดียวกับแบบ Grid ซึ่งเป็นค่าเริ่มต้น)
function AssetsSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลด…</span>
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
