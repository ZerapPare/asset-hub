import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { changeMemberPermission, removeMember } from "@/lib/collections/mutations";
import { HttpError, handle, readJson } from "@/lib/http";
import { isUuid } from "@/lib/validate";

type Ctx = RouteContext<"/api/collections/[id]/members/[userId]">;

async function params(ctx: Ctx) {
  const p = await ctx.params;
  if (!isUuid(p.userId)) throw new HttpError(404, "MEMBER_NOT_FOUND", "ไม่พบสมาชิก");
  return p;
}

export function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id, userId } = await params(ctx);
    const { permission } = await readJson<{ permission: string }>(request);
    await changeMemberPermission(user.user_id, id, userId, permission);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(_request: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id, userId } = await params(ctx);
    await removeMember(user.user_id, id, userId);
    return NextResponse.json({ ok: true });
  });
}
