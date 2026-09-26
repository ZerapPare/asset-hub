"use client";

import { useState, type SubmitEvent } from "react";
import { EyeIcon, EyeOffIcon, GoogleIcon, InfoIcon } from "@/components/icons";
import { GOOGLE_LOGIN_URL, login } from "@/lib/api/auth";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email) errors.email = "กรุณากรอกอีเมล";
  else if (!email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`))
    errors.email = `ใช้ได้เฉพาะอีเมล @${ALLOWED_EMAIL_DOMAIN}`;
  if (!password) errors.password = "กรุณากรอกรหัสผ่าน";
  return errors;
}

const inputClass =
  "h-14 w-full rounded-xl border bg-surface px-4 text-base text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 aria-invalid:border-danger";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(email.trim(), password);
    setFieldErrors(errors);
    setFormError(undefined);
    if (errors.email || errors.password) return;

    setPending(true);
    const result = await login(email.trim().toLowerCase(), password);
    setPending(false);
    // TODO: router.push("/library") เมื่อมีหน้า Library
    if (result.ok) setLoggedIn(true);
    else setFormError(result.message);
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-bold tracking-tight">เข้าสู่ระบบ</h2>
      <p className="mt-3 text-ink-muted">ใช้บัญชีอีเมลบริษัทของคุณ</p>

      {formError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      {loggedIn && (
        <p role="status" className="mt-6 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          เข้าสู่ระบบสำเร็จ (mock) — หน้า Library ยังไม่ได้ทำ
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
        <div>
          <label htmlFor="email" className="mb-2 block font-medium">
            อีเมลบริษัท
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={`${inputClass} border-line`}
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-2 text-sm text-danger">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="font-medium">
              รหัสผ่าน
            </label>
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              aria-expanded={showForgot}
              aria-controls="forgot-help"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={`${inputClass} border-line pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-subtle hover:text-ink"
            >
              {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="mt-2 text-sm text-danger">
              {fieldErrors.password}
            </p>
          )}
          {showForgot && (
            <div id="forgot-help" className="mt-3 flex gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <p>
                เข้าสู่ระบบด้วย Google แล้วไปที่หน้าโปรไฟล์เพื่อตั้งรหัสผ่านใหม่ ไม่ต้องใช้รหัสผ่านเดิม
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="h-14 w-full rounded-xl bg-brand font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>

      <div className="my-8 flex items-center gap-4 text-sm text-ink-subtle" role="separator">
        <span className="h-px flex-1 bg-line-soft" />
        หรือ
        <span className="h-px flex-1 bg-line-soft" />
      </div>

      <a
        href={GOOGLE_LOGIN_URL}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface font-semibold text-ink transition hover:border-ink-subtle hover:bg-canvas focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
      >
        <GoogleIcon className="size-6 text-brand" />
        เข้าสู่ระบบด้วย Google
      </a>

      <p className="mt-8 border-t border-line-soft pt-6 text-sm leading-relaxed text-ink-muted">
        ยังไม่เคยตั้งรหัสผ่าน? เข้าสู่ระบบด้วย Google ก่อน แล้วตั้งรหัสผ่านได้ที่หน้าโปรไฟล์
      </p>
    </div>
  );
}
