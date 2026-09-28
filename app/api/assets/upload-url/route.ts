import { NextResponse } from "next/server";
import { createUpload, type UploadInput } from "@/lib/assets/upload";
import { getCurrentUser } from "@/lib/auth/current-user";
import { HttpError, errorResponse, readJson } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "UNAUTHORIZED");
    const body = await readJson<UploadInput>(request);
    return NextResponse.json(await createUpload(user.user_id, body as UploadInput));
  } catch (error) {
    return errorResponse(error);
  }
}
