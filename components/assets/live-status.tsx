"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DbProcessingStatus } from "@/lib/schema";
import type { ProcessingStatus } from "@/lib/types";
import { StatusBadge } from "./status-badge";

// ถามสถานะไฟล์ที่ยังประมวลผลไม่เสร็จจาก /api/assets/status เป็นระยะ
// - ทุก badge ในหน้าใช้ตัวถามร่วมกัน: 1 request ต่อรอบ ไม่ว่าจะมีกี่ไฟล์
// - ถามเฉพาะไฟล์ที่ยัง UPLOADING / PROCESSING หยุดเองเมื่อได้ READY / FAILED
// - แท็บไม่ได้เปิดดูอยู่ = หยุดถาม กลับมาดูแล้วถามทันที
// - ถามนานเกิน 2 นาทีแล้วยังไม่เสร็จ ลดความถี่เหลือทุก 15 วินาที

const POLL_MS = 3_000;
const SLOW_POLL_MS = 15_000;
const SLOW_AFTER_MS = 2 * 60_000;
const MAX_IDS_PER_REQUEST = 100;

const PENDING = new Set<DbProcessingStatus>(["UPLOADING", "PROCESSING"]);

const statuses = new Map<string, DbProcessingStatus>();
const listeners = new Map<string, Set<() => void>>();
const watchedSince = new Map<string, number>();
/** ไฟล์ที่เลิกถามแล้ว (ไม่พบ / หมดสิทธิ์ / session หมด) */
const stopped = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function pendingIds() {
  return [...listeners.keys()].filter((id) => !stopped.has(id) && PENDING.has(statuses.get(id)!));
}

function schedule(delay?: number) {
  if (timer || document.hidden) return;
  const ids = pendingIds();
  if (ids.length === 0) return;
  const oldest = Math.min(...ids.map((id) => watchedSince.get(id) ?? Date.now()));
  timer = setTimeout(poll, delay ?? (Date.now() - oldest > SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS));
}

function notify(id: string) {
  listeners.get(id)?.forEach((listener) => listener());
}

async function poll() {
  timer = null;
  const ids = pendingIds().slice(0, MAX_IDS_PER_REQUEST);
  if (ids.length === 0 || document.hidden) return;

  try {
    const res = await fetch(`/api/assets/status?ids=${ids.join(",")}`, { cache: "no-store" });
    if (res.status === 401) {
      // session หมดอายุ — หยุดถามทั้งหมด
      ids.forEach((id) => stopped.add(id));
      return;
    }
    if (res.ok) {
      const { statuses: next } = (await res.json()) as { statuses: Record<string, { status: DbProcessingStatus }> };
      for (const id of ids) {
        const status = next[id]?.status;
        if (!status) {
          stopped.add(id); // ถูกลบหรือไม่มีสิทธิ์แล้ว
        } else if (status !== statuses.get(id)) {
          statuses.set(id, status);
          notify(id);
        }
      }
    }
  } catch {
    // เน็ตหลุด — ลองใหม่รอบถัดไป
  }
  schedule();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (timer) clearTimeout(timer);
      timer = null;
    } else {
      schedule(0);
    }
  });
}

/** สถานะล่าสุดของ Asset — เริ่มจากค่าที่ server ส่งมา แล้วอัปเดตเองจนกว่าจะเสร็จ */
export function useLiveStatus(assetId: string, initial: DbProcessingStatus): DbProcessingStatus {
  const subscribe = useCallback(
    (listener: () => void) => {
      let set = listeners.get(assetId);
      if (!set) {
        set = new Set();
        listeners.set(assetId, set);
        statuses.set(assetId, initial);
        watchedSince.set(assetId, Date.now());
        stopped.delete(assetId);
      }
      set.add(listener);
      schedule();

      return () => {
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(assetId);
          statuses.delete(assetId);
          watchedSince.delete(assetId);
          stopped.delete(assetId);
        }
      };
    },
    [assetId, initial],
  );

  return useSyncExternalStore(
    subscribe,
    () => statuses.get(assetId) ?? initial,
    () => initial,
  );
}

/** ป้ายสถานะที่อัปเดตเอง ใช้แทน StatusBadge ในรายการไฟล์ */
export function LiveStatusBadge({
  assetId,
  status,
  solid = false,
  hideWhenReady = false,
}: {
  assetId: string;
  status: ProcessingStatus;
  solid?: boolean;
  /** ซ่อนเมื่อ Ready (หน้าค้นหาแสดงเฉพาะสถานะที่ผิดปกติ) */
  hideWhenReady?: boolean;
}) {
  const live = useLiveStatus(assetId, status);
  // UPLOADING ไม่ควรโผล่ในรายการ ถ้าเจอให้แสดงเป็นกำลังประมวลผล
  const shown: ProcessingStatus = live === "UPLOADING" ? "PROCESSING" : live;
  if (hideWhenReady && shown === "READY") return null;
  return <StatusBadge status={shown} solid={solid} />;
}
