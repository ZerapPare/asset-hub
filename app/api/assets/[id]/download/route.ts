import { NextResponse } from "next/server";
import { getDownloadUrl } from "@/lib/assets/files";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse } from "@/lib/http";

// ตรวจสิทธิ์ → redirect ไป presigned URL (ไฟล์ไม่ผ่าน Lambda)
export async function GET(_request: Request, ctx: RouteContext<"/api/assets/[id]/download">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const url = await getDownloadUrl(user.user_id, (await ctx.params).id);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
