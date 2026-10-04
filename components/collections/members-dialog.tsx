"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import type { CollectionMember } from "@/lib/collections/queries";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { COLLECTION_PERMISSIONS, type CollectionPermission } from "@/lib/schema";
import { ROLE_LABELS, collectionRequest } from "./api";

type Props = {
  collectionId: string;
  members: CollectionMember[];
  myUserId: string;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
};

const selectClass =
  "h-10 rounded-lg border border-line bg-surface px-2 text-sm font-medium outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

export function MembersDialog({ collectionId, members, myUserId, isOwner, open, onClose }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollectionPermission>("VIEWER");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      after?.();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  // เจ้าของคนเดียว = ออกไม่ได้
  const isLastOwner = isOwner && members.filter((m) => m.role === "OWNER").length === 1;

  const base = `/${collectionId}/members`;
  const add = () => run(() => collectionRequest(base, "POST", { email, permission: role }), () => setEmail(""));
  const change = (userId: string, permission: string) => run(() => collectionRequest(`${base}/${userId}`, "PATCH", { permission }));
  const remove = (userId: string) => run(() => collectionRequest(`${base}/${userId}`, "DELETE"));
  const leave = () =>
    run(
      () => collectionRequest(`${base}/${myUserId}`, "DELETE"),
      () => {
        onClose();
        router.push("/collections");
      },
    );

  return (
    <Modal open={open} onClose={onClose} title="สมาชิก" subtitle={`${members.length} คน · เฉพาะสมาชิกเห็น Collection นี้`}>
      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {isOwner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) add();
            }}
            className="flex flex-wrap gap-2"
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">อีเมลสมาชิกใหม่</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value as CollectionPermission)} aria-label="สิทธิ์" className={selectClass}>
              {COLLECTION_PERMISSIONS.map((p) => (
                <option key={p} value={p}>{ROLE_LABELS[p]}</option>
              ))}
            </select>
            <button type="submit" disabled={busy || !email.trim()} className="h-10 rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
              เพิ่ม
            </button>
            <p className="w-full text-xs text-ink-subtle">เพิ่มได้เฉพาะคนที่เคยเข้าสู่ระบบ AssetHub แล้ว</p>
          </form>
        )}

        <ul className="divide-y divide-line-soft rounded-xl border border-line">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.name} src={m.avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {m.name}
                  {m.userId === myUserId && <span className="ml-1 text-sm text-ink-muted">(คุณ)</span>}
                </span>
                <span className="block truncate text-sm text-ink-muted">{m.email}</span>
              </span>
              {isOwner && m.userId !== myUserId ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => change(m.userId, e.target.value)}
                    disabled={busy}
                    aria-label={`สิทธิ์ของ ${m.name}`}
                    className={selectClass}
                  >
                    {COLLECTION_PERMISSIONS.map((p) => (
                      <option key={p} value={p}>{ROLE_LABELS[p]}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => remove(m.userId)} disabled={busy} aria-label={`ลบ ${m.name}`} className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger">
                    <CloseIcon className="size-4" />
                  </button>
                </>
              ) : (
                <span className="text-sm font-medium text-ink-muted">{ROLE_LABELS[m.role]}</span>
              )}
            </li>
          ))}
        </ul>

        {isLastOwner ? (
          <p className="text-sm text-ink-muted">
            คุณเป็นเจ้าของคนเดียว จึงออกจาก Collection ไม่ได้ — ตั้งสมาชิกคนอื่นเป็นเจ้าของก่อน หรือลบ Collection แทน
          </p>
        ) : (
          <button type="button" onClick={leave} disabled={busy} className="text-sm font-semibold text-danger hover:underline">
            ออกจาก Collection นี้
          </button>
        )}
      </div>
    </Modal>
  );
}
