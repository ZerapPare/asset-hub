import { NextResponse } from "next/server";
import { getPreviewUrl } from "@/lib/assets/files";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse } from "@/lib/http";

// เหมือน download แต่เปิดในหน้าเว็บ (inline) และไม่บันทึก audit
export async function GET(_request: Request, ctx: RouteContext<"/api/assets/[id]/preview">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const url = await getPreviewUrl(user.user_id, (await ctx.params).id);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
