"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  // ข้อความซ้ายของ footer
  footerStart?: ReactNode;
  wide?: boolean;
};

// popup จาก <dialog> (focus + Esc ในตัว)
export function Modal({ open, onClose, title, subtitle, children, footer, footerStart, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
      className={`m-auto ${wide ? "w-[min(760px,calc(100%-2rem))]" : "w-[min(560px,calc(100%-2rem))]"} max-w-none rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink">
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-line bg-canvas/60 px-6 py-4">
          {footerStart && <div className="mr-auto text-sm text-ink-muted">{footerStart}</div>}
          {footer}
        </div>
      )}
    </dialog>
  );
}
