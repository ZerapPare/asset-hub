"use client";

import { useEffect, useRef, useState } from "react";
import { fileTypeMeta } from "@/components/assets/file-type";
import { ExpandIcon, SpinnerIcon, ZoomInIcon, ZoomOutIcon } from "@/components/icons";
import type { FileType } from "@/lib/types";
import { previewUrl } from "./api";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

type Props = { assetId: string; fileType: FileType; name: string; extension: string };

export function PreviewPanel({ assetId, fileType, name, extension }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const isImage = fileType === "IMAGE";
  const meta = fileTypeMeta[fileType];
  // iframe จับ error ไม่ได้ → เช็กก่อนว่า /preview พาไป S3 ได้ (redirect) ก่อนแสดง PDF
  const [pdfReady, setPdfReady] = useState(false);

  useEffect(() => {
    if (isImage) return;
    let cancelled = false;
    fetch(previewUrl(assetId), { redirect: "manual" })
      .then((res) => {
        if (cancelled) return;
        if (res.type === "opaqueredirect" || res.ok) setPdfReady(true);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [assetId, isImage]);

  const changeZoom = (delta: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));

  return (
    <section
      ref={frameRef}
      aria-label="ตัวอย่างไฟล์"
      className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl bg-hero text-hero-ink lg:min-h-[640px]"
    >
      <span className="absolute left-5 top-5 z-10 rounded-lg bg-hero-raised px-3 py-1.5 text-sm">
        {isImage ? "รูปภาพ" : "เอกสาร"}
      </span>

      <div className="flex flex-1 items-center justify-center overflow-auto p-6 pt-16">
        {failed ? (
          <div className={`flex size-48 flex-col items-center justify-center gap-2 rounded-2xl ${meta.tint}`}>
            <meta.Icon className="size-14" />
            <span className="font-bold">{extension.toUpperCase()}</span>
            <span className="px-4 text-center text-xs opacity-80">ยังแสดงตัวอย่างไม่ได้</span>
          </div>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl(assetId)}
            alt={name}
            onError={() => setFailed(true)}
            style={{ transform: `scale(${zoom})` }}
            className="max-h-[70vh] max-w-full origin-center rounded-lg shadow-2xl transition-transform"
          />
        ) : pdfReady ? (
          <iframe src={previewUrl(assetId)} title={`ตัวอย่าง ${name}`} className="h-[70vh] w-full rounded-lg bg-surface" />
        ) : (
          <SpinnerIcon className="size-8 animate-spin opacity-60" />
        )}
      </div>

      <div className="mx-auto mb-5 flex items-center gap-1 rounded-xl bg-surface p-1 text-ink shadow-lg">
        {isImage && !failed && (
          <>
            <button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="ซูมออก" className="rounded-lg p-2 hover:bg-canvas disabled:opacity-40">
              <ZoomOutIcon className="size-5" />
            </button>
            <button type="button" onClick={() => setZoom(1)} className="min-w-16 rounded-lg px-2 py-2 text-sm font-semibold tabular-nums hover:bg-canvas" aria-label="รีเซ็ตการซูม">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="ซูมเข้า" className="rounded-lg p-2 hover:bg-canvas disabled:opacity-40">
              <ZoomInIcon className="size-5" />
            </button>
            <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          </>
        )}
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : frameRef.current?.requestFullscreen())}
          aria-label="เต็มจอ"
          className="rounded-lg p-2 hover:bg-canvas"
        >
          <ExpandIcon className="size-5" />
        </button>
      </div>
    </section>
  );
}
