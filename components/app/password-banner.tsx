"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { InfoIcon } from "@/components/icons";

const KEY = "password-banner-dismissed";

function isDismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// แถบแนะนำตั้งรหัสผ่าน (ไม่บังคับ) กด × แล้วไม่แสดงอีก
export function PasswordBanner() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    window.dispatchEvent(new Event(KEY));
  }

  return (
    <div className="mx-auto mb-6 flex max-w-[1600px] items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
      <InfoIcon className="size-5 shrink-0" />
      <p className="flex-1">ตั้งรหัสผ่านเพื่อเข้าสู่ระบบด้วยอีเมลได้ นอกจาก Google</p>
      <Link href="/settings" className="shrink-0 font-semibold hover:underline">
        ตั้งเลย
      </Link>
      <button type="button" onClick={dismiss} aria-label="ปิด" className="shrink-0 rounded-md px-2 py-1 text-lg leading-none hover:bg-brand/10">
        ×
      </button>
    </div>
  );
}

function subscribe(callback: () => void) {
  window.addEventListener(KEY, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(KEY, callback);
    window.removeEventListener("storage", callback);
  };
}
