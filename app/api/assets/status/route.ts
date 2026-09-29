import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse } from "@/lib/http";
import { MAX_STATUS_IDS, getProcessingStatuses } from "@/lib/processing/status";

// สถานะการประมวลผลหลายไฟล์ในครั้งเดียว — หน้าเว็บที่มีหลายไฟล์ยัง PROCESSING ใช้ตัวนี้แทนการยิงทีละไฟล์
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");

    const ids = (request.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > MAX_STATUS_IDS) {
      throw new HttpError(400, "TOO_MANY_IDS", `ถามได้ไม่เกิน ${MAX_STATUS_IDS} ไฟล์ต่อครั้ง`);
    }

    const statuses = await getProcessingStatuses(user.user_id, ids);
    return NextResponse.json({ statuses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
