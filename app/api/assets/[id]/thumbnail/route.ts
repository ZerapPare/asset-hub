import { NextResponse } from "next/server";
import { getThumbnailUrl } from "@/lib/assets/files";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/assets/[id]/thumbnail">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const url = await getThumbnailUrl(user.user_id, (await ctx.params).id);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
