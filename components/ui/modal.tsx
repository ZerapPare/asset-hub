"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

// popup จาก <dialog> (focus + Esc ในตัว)
export function Modal({ open, onClose, title, children, footer }: Props) {
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
      className="m-auto w-[min(560px,calc(100%-2rem))] max-w-none rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink">
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-3 border-t border-line bg-canvas/60 px-6 py-4">{footer}</div>}
    </dialog>
  );
}
