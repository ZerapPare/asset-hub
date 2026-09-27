import type { Metadata } from "next";
import { TagTable } from "@/components/tags/tag-table";
import { listTags } from "@/lib/api/tags";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Tag — AssetHub" };

export default async function TagsPage() {
  const [user, tags] = await Promise.all([getCurrentUser(), listTags()]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tag</h1>
        <p className="mt-1 text-ink-muted">{tags.length} Tag ใช้ร่วมกันทั้งองค์กร · กดที่ Tag เพื่อดู Asset</p>
      </div>

      <TagTable tags={tags} meName={user!.display_name} />
    </div>
  );
}
