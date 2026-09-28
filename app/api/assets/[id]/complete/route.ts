import { NextResponse } from "next/server";
import { completeUpload } from "@/lib/assets/upload";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse } from "@/lib/http";
import { isUuid } from "@/lib/validate";

export async function POST(_request: Request, ctx: RouteContext<"/api/assets/[id]/complete">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const { id } = await ctx.params;
    if (!isUuid(id)) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
    return NextResponse.json(await completeUpload(user.user_id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
