import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { deleteCollection, updateCollection } from "@/lib/collections/mutations";
import { handle, readJson } from "@/lib/http";

export function PATCH(request: Request, ctx: RouteContext<"/api/collections/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    await updateCollection(user.user_id, (await ctx.params).id, await readJson(request));
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/collections/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    await deleteCollection(user.user_id, (await ctx.params).id);
    return NextResponse.json({ ok: true });
  });
}
