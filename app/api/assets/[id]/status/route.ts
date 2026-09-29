import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse } from "@/lib/http";
import { getProcessingStatus } from "@/lib/processing/status";
import { isUuid } from "@/lib/validate";

// สถานะการประมวลผล ให้หน้าเว็บถามซ้ำเป็นระยะจนกว่าจะเป็น READY / FAILED
// ← { status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED", updatedAt, error? }
export async function GET(_request: Request, ctx: RouteContext<"/api/assets/[id]/status">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const { id } = await ctx.params;
    if (!isUuid(id)) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");

    const result = await getProcessingStatus(user.user_id, id);
    if (!result) throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์");

    // สถานะเปลี่ยนตลอด ห้าม cache
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
