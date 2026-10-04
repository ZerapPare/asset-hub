import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionView } from "@/components/collections/collection-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { COLLECTION_SORTS, getCollectionDetail, listCollectionAssets, type CollectionSort } from "@/lib/collections/queries";

export async function generateMetadata({ params }: PageProps<"/collections/[id]">): Promise<Metadata> {
  const user = await getCurrentUser();
  const c = user && (await getCollectionDetail(user.user_id, (await params).id));
  return { title: `${c ? c.name : "ไม่พบ Collection"} — AssetHub` };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = (await getCurrentUser())!;
  const collection = await getCollectionDetail(user.user_id, id);
  if (!collection) notFound();

  const q = typeof sp.q === "string" ? sp.q : "";
  const sort = COLLECTION_SORTS.includes(sp.sort as CollectionSort) ? (sp.sort as CollectionSort) : "newest";
  const assets = await listCollectionAssets(user.user_id, id, { q, sort });

  return (
    <CollectionView
      key={`${q}|${sort}`}
      collection={collection}
      assets={assets}
      myUserId={user.user_id}
      meName={user.display_name}
      q={q}
      sort={sort}
    />
  );
}
