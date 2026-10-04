import { NextResponse, type NextRequest } from "next/server";
import { requireCollectionRole } from "@/lib/access";
import { requireUser } from "@/lib/auth/current-user";
import { listAddCandidates } from "@/lib/collections/queries";
import { handle } from "@/lib/http";

// ไฟล์ที่เพิ่มได้ (popup เพิ่มไฟล์)
export function GET(request: NextRequest, ctx: RouteContext<"/api/collections/[id]/candidates">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await requireCollectionRole(user.user_id, id, "EDITOR");
    const assets = await listAddCandidates(user.user_id, id, request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ assets }, { headers: { "Cache-Control": "no-store" } });
  });
}
