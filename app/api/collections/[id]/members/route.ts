import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { addMember } from "@/lib/collections/mutations";
import { handle, readJson } from "@/lib/http";

export function POST(request: Request, ctx: RouteContext<"/api/collections/[id]/members">) {
  return handle(async () => {
    const user = await requireUser();
    await addMember(user.user_id, (await ctx.params).id, await readJson(request));
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
