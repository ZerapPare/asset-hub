"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { GoogleIcon } from "@/components/icons";
import { GOOGLE_LOGIN_URL } from "@/lib/api/auth";

const MIN = 8;
const REAUTH_URL = `${GOOGLE_LOGIN_URL}?returnTo=/settings`;

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";

type Props = { hasPassword: boolean; recentGoogleAuth: boolean };

export function PasswordForm({ hasPassword, recentGoogleAuth }: Props) {
  const router = useRouter();
  const needCurrent = hasPassword && !recentGoogleAuth;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(false);
    if (next.length < MIN) return setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN} ตัวอักษร`);
    if (next !== confirm) return setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    if (needCurrent && !current) return setError("กรุณากรอกรหัสผ่านเดิม");

    setError(undefined);
    setPending(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: next, currentPassword: needCurrent ? current : undefined }),
      });
      if (res.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setDone(true);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(
          res.status === 403
            ? "รหัสผ่านเดิมไม่ถูกต้อง"
            : (body.error?.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"),
        );
      }
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
          บันทึกรหัสผ่านแล้ว เข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้ได้ (อุปกรณ์อื่นจะถูกออกจากระบบ)
        </p>
      )}

      {needCurrent && (
        <div>
          <label htmlFor="current-password" className="mb-2 block font-medium">
            รหัสผ่านเดิม
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
          <a href={REAUTH_URL} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover">
            <GoogleIcon className="size-4" />
            ลืมรหัสผ่าน? ยืนยันตัวตนด้วย Google แทน
          </a>
        </div>
      )}

      <div>
        <label htmlFor="new-password" className="mb-2 block font-medium">
          รหัสผ่านใหม่
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-describedby="new-password-hint"
          className={inputClass}
        />
        <p id="new-password-hint" className="mt-2 text-sm text-ink-muted">
          อย่างน้อย {MIN} ตัวอักษร
        </p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-2 block font-medium">
          ยืนยันรหัสผ่านใหม่
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-brand px-6 font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "กำลังบันทึก…" : hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
      </button>
    </form>
  );
}
