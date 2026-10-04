import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { addAssets, removeAssets } from "@/lib/collections/mutations";
import { handle, readJson } from "@/lib/http";

export function POST(request: Request, ctx: RouteContext<"/api/collections/[id]/assets">) {
  return handle(async () => {
    const user = await requireUser();
    const { assetIds } = await readJson<{ assetIds: string[] }>(request);
    const added = await addAssets(user.user_id, (await ctx.params).id, assetIds);
    return NextResponse.json({ added });
  });
}

export function DELETE(request: Request, ctx: RouteContext<"/api/collections/[id]/assets">) {
  return handle(async () => {
    const user = await requireUser();
    const { assetIds } = await readJson<{ assetIds: string[] }>(request);
    const removed = await removeAssets(user.user_id, (await ctx.params).id, assetIds);
    return NextResponse.json({ removed });
  });
}
