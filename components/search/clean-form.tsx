"use client";

import type { ComponentProps } from "react";

type FormProps = ComponentProps<"form">;
type SubmitEvent = Parameters<NonNullable<FormProps["onSubmit"]>>[0];

// ฟอร์ม GET ที่ไม่ส่งช่องที่ค่าว่าง — URL จะไม่มี "&collection=&tag=" ติดมา
export function CleanForm({ onSubmit, ...props }: FormProps) {
  const handleSubmit = (event: SubmitEvent) => {
    for (const el of Array.from(event.currentTarget.elements)) {
      if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name && el.value === "") {
        el.disabled = true;
      }
    }
    onSubmit?.(event);
  };

  return <form method="get" {...props} onSubmit={handleSubmit} />;
}
