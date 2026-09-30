import { redirect } from "next/navigation";

// หน้าค้นหารวมเข้ากับหน้า Asset แล้ว — คงไว้ให้ลิงก์ /search?q=... เดิมยังใช้ได้
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") next.set(key, value);
  }
  const qs = next.toString();
  redirect(qs ? `/assets?${qs}` : "/assets");
}
