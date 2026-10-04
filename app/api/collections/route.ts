import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { createCollection } from "@/lib/collections/mutations";
import { handle, readJson } from "@/lib/http";

export function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const id = await createCollection(user.user_id, await readJson(request));
    return NextResponse.json({ id }, { status: 201 });
  });
}
