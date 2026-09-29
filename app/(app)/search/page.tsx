import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, CloseIcon, GridIcon, ListIcon, SearchIcon, SortIcon, SparkleIcon } from "@/components/icons";
import { CleanForm } from "@/components/search/clean-form";
import { FilterPanel } from "@/components/search/filter-panel";
import { OWNER_OPTIONS, UPLOADED_OPTIONS } from "@/components/search/options";
import { FilterSelect } from "@/components/search/filter-select";
import { mockSemanticSearch } from "@/components/search/mock";
import { SearchResultCard } from "@/components/search/search-result-card";
import type { FilterOption, SearchFilters, SearchMode, SearchResult, SearchView } from "@/components/search/types";
import {
  SEARCH_LIMIT,
  SEARCH_SORTS,
  SearchTimeoutError,
  UPLOADED_RANGES,
  getSearchFilterOptions,
  searchAssets,
} from "@/lib/assets/search";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "ค้นหา — AssetHub" };

const PARAM_KEYS = ["q", "mode", "type", "uploaded", "owner", "collection", "tag", "sort", "view"] as const;
type Params = Record<(typeof PARAM_KEYS)[number], string>;

const FILTER_KEYS = ["uploaded", "owner", "collection", "tag"] as const satisfies readonly (keyof SearchFilters)[];
const noFilters = { uploaded: "", owner: "", collection: "", tag: "" };

const typeTabs: FilterOption[] = [
  { value: "", label: "ทั้งหมด" },
  { value: "document", label: "เอกสาร" },
  { value: "image", label: "รูปภาพ" },
];

// Semantic เรียงตามชื่อไม่มีประโยชน์ เหลือแค่ความใกล้เคียงกับวันที่
const sortOptions: Record<SearchMode, FilterOption[]> = {
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

const examples: Record<SearchMode, string[]> = {
  keyword: ["รายงาน", "marketing", "Phoenix"],
  semantic: ["รูปคนประชุมในออฟฟิศ", "เอกสารเกี่ยวกับสวัสดิการพนักงาน"],
};

// ค่าใน URL ที่ไม่อยู่ในรายการ ถือว่าไม่ได้เลือก (ไม่ขึ้น chip และไม่ส่งไป query)
const allowed: Partial<Record<keyof Params, readonly string[]>> = {
  type: ["document", "image"],
  uploaded: UPLOADED_RANGES,
  owner: ["me"],
  sort: SEARCH_SORTS,
  view: ["list"],
  mode: ["semantic"],
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    PARAM_KEYS.map((key) => {
      const value = typeof raw[key] === "string" ? raw[key].trim() : "";
      const list = allowed[key];
      return [key, list && !list.includes(value) ? "" : value];
    }),
  ) as Params;
  const mode: SearchMode = params.mode === "semantic" ? "semantic" : "keyword";
  if (mode === "semantic" && !sortOptions.semantic.some((o) => o.value === params.sort)) params.sort = "";
  // ค่าเริ่มต้นเป็น Grid เหมือนหน้า Asset ทั้งหมด
  const view: SearchView = params.view === "list" ? "list" : "grid";
  const { q } = params;
  const filters: SearchFilters = { uploaded: params.uploaded, owner: params.owner, collection: params.collection, tag: params.tag };

  // ลิงก์จากค่าปัจจุบัน + ค่าที่เปลี่ยน (ไม่ใส่ค่าว่างและค่าเริ่มต้นใน URL)
  const href = (overrides: Partial<Params>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (!value || (key === "mode" && value === "keyword") || (key === "view" && value === "grid")) continue;
      next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/search?${qs}` : "/search";
  };

  if (!q) return <NoQuery />;

  const user = (await getCurrentUser())!;
  const { collections: collectionOptions, tags: tagOptions } = await getSearchFilterOptions(user.user_id);

  let results: SearchResult[] = [];
  let timedOut = false;
  if (mode === "keyword") {
    try {
      results = await searchAssets(user.user_id, q, {
        type: params.type === "image" ? "IMAGE" : params.type === "document" ? "DOCUMENT" : undefined,
        uploaded: (params.uploaded || undefined) as (typeof UPLOADED_RANGES)[number] | undefined,
        mine: params.owner === "me",
        collectionId: params.collection || undefined,
        tag: params.tag || undefined,
        sort: (params.sort || undefined) as (typeof SEARCH_SORTS)[number] | undefined,
      });
    } catch (error) {
      if (!(error instanceof SearchTimeoutError)) throw error;
      timedOut = true;
    }
  } else {
    // TODO: Semantic Search จริง (pgvector + Bedrock)
    results = mockSemanticSearch(q, params.type, filters);
  }

  const activeFilters = FILTER_KEYS.filter((key) => filters[key]);
  const isFiltered = activeFilters.length > 0 || params.type !== "";
  const clearFiltersHref = href({ ...noFilters, type: "" });
  const chipLabel: Record<(typeof FILTER_KEYS)[number], string> = {
    uploaded: `อัปโหลด: ${labelOf(UPLOADED_OPTIONS, filters.uploaded)}`,
    owner: `เจ้าของ: ${labelOf(OWNER_OPTIONS, filters.owner)}`,
    collection: `Collection: ${labelOf(collectionOptions, filters.collection)}`,
    tag: `Tag: ${labelOf(tagOptions, filters.tag)}`,
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 break-words text-3xl font-bold tracking-tight">
            ผลการค้นหา “<span className="text-brand-ink">{q}</span>”
          </h1>
          {/* topbar ซ่อนปุ่มเลือกโหมดบนจอเล็ก */}
          <ModeSwitch mode={mode} href={href} className="md:hidden" />
        </div>
        <p className="mt-1 text-ink-muted">
          พบ{" "}
          <span className="font-semibold text-ink">
            {results.length >= SEARCH_LIMIT ? `${SEARCH_LIMIT}+` : results.length}
          </span>{" "}
          ไฟล์{results.length >= SEARCH_LIMIT && ` (แสดง ${SEARCH_LIMIT} รายการแรก ลองใช้ตัวกรองให้แคบลง)`} ·{" "}
          {mode === "semantic"
            ? "ค้นตามความหมาย แสดงเฉพาะไฟล์ที่ประมวลผลเสร็จแล้ว"
            : "ค้นจากชื่อไฟล์ Tag Collection คำอธิบาย และเนื้อหาในเอกสาร"}
        </p>
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
            keep={{ q, mode: mode === "semantic" ? mode : "", type: params.type, sort: params.sort, view: params.view }}
            collectionOptions={collectionOptions}
            tagOptions={tagOptions}
            activeCount={activeFilters.length}
            clearHref={href(noFilters)}
          />
          <CleanForm action="/search">
            {(["q", "mode", "type", ...FILTER_KEYS, "view"] as const).map(
              (key) => params[key] && <input key={key} type="hidden" name={key} value={params[key]} />,
            )}
            <FilterSelect name="sort" label="เรียงตาม" icon={<SortIcon />} value={params.sort} options={sortOptions[mode]} />
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
            body={`ไม่มีไฟล์ที่ตรงกับ “${q}” ภายใต้ตัวกรองที่เลือก ลองล้างตัวกรองแล้วค้นอีกครั้ง`}
            action={
              <Link href={clearFiltersHref} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">
                ล้างตัวกรอง
              </Link>
            }
          />
        ) : (
          <EmptyBlock
            title={`ไม่พบไฟล์ที่ตรงกับ “${q}”`}
            body="ลองตรวจการสะกด ใช้คำที่สั้นลง หรือค้นแบบ Semantic เพื่อหาจากความหมาย"
            action={
              mode === "keyword" && (
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
        <section aria-label="ผลการค้นหา" className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "space-y-3"}>
          {results.map((result) => (
            // Semantic ไม่ไฮไลต์ เพราะไม่ได้ค้นจากคำที่ตรงกัน
            <SearchResultCard key={result.asset.id} result={result} query={mode === "keyword" ? q : ""} layout={view} />
          ))}
        </section>
      )}
    </div>
  );
}

function labelOf(options: FilterOption[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function ModeSwitch({
  mode,
  href,
  className = "",
}: {
  mode: SearchMode;
  href: (overrides: Partial<Params>) => string;
  className?: string;
}) {
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
function ViewToggle({ view, href }: { view: SearchView; href: (overrides: Partial<Params>) => string }) {
  const items = [
    { value: "list", label: "รายการ", Icon: ListIcon },
    { value: "grid", label: "ตาราง", Icon: GridIcon },
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

// ยังไม่ได้ค้นหา: ช่องค้นหาอยู่บน topbar แล้ว หน้านี้แนะนำวิธีใช้
function NoQuery() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <SearchIcon className="size-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">ค้นหาไฟล์ในองค์กร</h1>
        <p className="text-ink-muted">พิมพ์คำค้นในช่องค้นหาด้านบน หรือลองจากตัวอย่าง</p>
      </div>
      <div className="w-full space-y-3 pt-2 text-sm">
        {(["keyword", "semantic"] as const).map((mode) => (
          <div key={mode} className="flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1 text-ink-subtle">
              {mode === "semantic" ? <SparkleIcon className="size-4" /> : <SearchIcon className="size-4" />}
              {mode === "semantic" ? "ค้นตามความหมาย:" : "ค้นตามคำ:"}
            </span>
            {examples[mode].map((example) => (
              <Link
                key={example}
                href={`/search?q=${encodeURIComponent(example)}${mode === "semantic" ? "&mode=semantic" : ""}`}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-ink-muted hover:border-brand/40 hover:text-brand-ink"
              >
                {example}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
