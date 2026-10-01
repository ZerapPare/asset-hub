import type { Metadata } from "next";
import { TagTable } from "@/components/tags/tag-table";
import { listTags } from "@/lib/api/tags";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Tag — AssetHub" };

export default async function TagsPage() {
  const user = (await getCurrentUser())!;
  const tags = await listTags(user.user_id);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tag</h1>
        <p className="mt-1 text-ink-muted">{tags.length} Tag กลางของระบบ · กดที่ Tag เพื่อดู Asset</p>
      </div>

      <TagTable tags={tags} />
    </div>
  );
}
