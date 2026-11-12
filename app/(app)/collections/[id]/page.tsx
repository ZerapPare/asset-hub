import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionView, type CollectionKind } from "@/components/collections/collection-view";
import type { FilterOption, SearchResult } from "@/components/search/types";
import { runSearch, type SearchOutcome } from "@/lib/assets/run-search";
import type { SearchSort } from "@/lib/assets/search";
import type { SemanticSort } from "@/lib/assets/semantic";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCollectionDetail, listCollectionAssets, type CollectionSort } from "@/lib/collections/queries";

export async function generateMetadata({ params }: PageProps<"/collections/[id]">): Promise<Metadata> {
  const user = await getCurrentUser();
  const c = user && (await getCollectionDetail(user.user_id, (await params).id));
  return { title: `${c ? c.name : "ไม่พบ Collection"} — AssetHub` };
}

// ค่าว่าง = การเรียงเริ่มต้นของแต่ละแบบ (ไม่ใส่ใน URL)
const SORT_OPTIONS: Record<CollectionKind, FilterOption[]> = {
  browse: [
    { value: "", label: "ล่าสุด" },
    { value: "oldest", label: "เก่าสุด" },
    { value: "name", label: "ชื่อ A–Z" },
  ],
  keyword: [
    { value: "", label: "ตรงที่สุด" },
    { value: "newest", label: "ล่าสุด" },
    { value: "oldest", label: "เก่าสุด" },
    { value: "name", label: "ชื่อ A–Z" },
  ],
  semantic: [
    { value: "", label: "ใกล้เคียงที่สุด" },
    { value: "newest", label: "ล่าสุด" },
  ],
};

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = (await getCurrentUser())!;
  const collection = await getCollectionDetail(user.user_id, id);
  if (!collection) notFound();

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const mode = sp.mode === "semantic" ? "semantic" : "keyword";
  const kind: CollectionKind = q ? mode : "browse";
  const rawSort = typeof sp.sort === "string" ? sp.sort : "";
  const sort = SORT_OPTIONS[kind].some((o) => o.value === rawSort) ? rawSort : "";

  // ไม่มีคำค้น = รายการไฟล์ใน Collection / มีคำค้น = ระบบค้นหาเดียวกับหน้า Asset กรองเฉพาะ Collection นี้
  let outcome: SearchOutcome;
  if (kind === "browse") {
    const assets = await listCollectionAssets(user.user_id, id, { sort: (sort || "newest") as CollectionSort });
    outcome = { results: assets.map((asset): SearchResult => ({ asset, tags: [], matchedIn: [] })), timedOut: false, fellBack: false };
  } else {
    outcome = await runSearch(user.user_id, q, kind, { collectionId: id }, (sort || undefined) as SearchSort | SemanticSort | undefined);
  }

  return (
    <CollectionView
      // key แค่ id: ถ้าใส่คำค้น/การเรียงด้วย จะ remount ทุกครั้งที่ URL เปลี่ยน ช่องค้นหาหลุด focus ระหว่างพิมพ์
      key={id}
      collection={collection}
      results={outcome.results}
      timedOut={outcome.timedOut}
      fellBack={outcome.fellBack}
      myUserId={user.user_id}
      meName={user.display_name}
      q={q}
      mode={mode}
      kind={kind}
      sort={sort}
      sortOptions={SORT_OPTIONS[kind]}
    />
  );
}
