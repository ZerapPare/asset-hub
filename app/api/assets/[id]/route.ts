import { NextResponse } from "next/server";
import { softDeleteAsset } from "@/lib/assets/delete";
import { updateAssetDetails, type DetailsInput } from "@/lib/assets/details";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse, readJson } from "@/lib/http";
import { isUuid } from "@/lib/validate";

// แก้รายละเอียด (เจ้าของเท่านั้น)
export async function PATCH(request: Request, ctx: RouteContext<"/api/assets/[id]">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const { id } = await ctx.params;
    if (!isUuid(id)) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
    await updateAssetDetails(user.user_id, id, await readJson<DetailsInput>(request));
    return NextResponse.json({ ok: true }); 
  } catch (error) {
    return errorResponse(error);
  }
}

// ลบ (soft delete, เจ้าของเท่านั้น)
export async function DELETE(_request: Request, ctx: RouteContext<"/api/assets/[id]">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const { id } = await ctx.params;
    if (!isUuid(id)) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");
    await softDeleteAsset(user.user_id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
