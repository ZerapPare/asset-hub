"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { Logo } from "@/components/brand/logo";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { SIDEBAR_COOKIE } from "@/lib/config";

// ต้องตรงกับ breakpoint lg ของ Tailwind
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => true);
}

type SidebarContextValue = {
  isDesktop: boolean;
  /** จอคอม: sidebar กางอยู่ (จำใน cookie) */
  desktopOpen: boolean;
  /** จอเล็ก: drawer เปิดอยู่ */
  mobileOpen: boolean;
  toggle: () => void;
  closeMobile: (restoreFocus: boolean) => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}

// จอคอม (lg+): กาง/หุบ sidebar, จอเล็ก: sidebar เป็น drawer เลื่อนทับหน้า
export function SidebarProvider({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  const isDesktop = useIsDesktop();
  const [desktopOpen, setDesktopOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => {
    if (isDesktop) {
      const next = !desktopOpen;
      setDesktopOpen(next);
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
    } else {
      setMobileOpen((open) => !open);
    }
  }, [isDesktop, desktopOpen]);

  const closeMobile = useCallback((restoreFocus: boolean) => {
    setMobileOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // drawer เปิดอยู่: กด Esc ปิด และล็อกไม่ให้หน้าหลังเลื่อน
  useEffect(() => {
    if (!mobileOpen || isDesktop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMobile(true);
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen, isDesktop, closeMobile]);

  return (
    <SidebarContext.Provider value={{ isDesktop, desktopOpen, mobileOpen, toggle, closeMobile, toggleRef }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function SidebarFrame({ children }: { children: ReactNode }) {
  const { isDesktop, desktopOpen, mobileOpen, closeMobile } = useSidebar();
  const asideRef = useRef<HTMLElement>(null);
  const visible = isDesktop ? desktopOpen : mobileOpen;

  useEffect(() => {
    if (mobileOpen && !isDesktop) asideRef.current?.focus();
  }, [mobileOpen, isDesktop]);

  return (
    <>
      {mobileOpen && (
        <div aria-hidden="true" onClick={() => closeMobile(true)} className="fixed inset-0 z-30 bg-ink/40 lg:hidden" />
      )}
      <aside
        id="app-sidebar"
        ref={asideRef}
        tabIndex={-1}
        aria-label="เมนูหลัก"
        inert={!visible}
        // กดลิงก์ในเมนูแล้วปิด drawer
        onClick={(e) => (e.target as HTMLElement).closest("a") && closeMobile(false)}
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-line bg-surface shadow-xl outline-none transition-transform duration-200 motion-reduce:transition-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:sticky lg:top-0 lg:bottom-auto lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 lg:overflow-hidden lg:shadow-none lg:transition-[width] ${
          desktopOpen ? "lg:w-72" : "lg:w-0 lg:border-r-0"
        }`}
      >
        <div className="flex h-full w-72 flex-col overflow-y-auto px-4 py-6">{children}</div>
      </aside>
    </>
  );
}

// sidebar ซ่อนอยู่: แสดงโลโก้ ชี้เมาส์/โฟกัสแล้วกลายเป็น ☰
// sidebar กางอยู่ (จอคอม): แสดง ☰ อย่างเดียว เพราะโลโก้อยู่ใน sidebar แล้ว
// ใช้ class lg: แทน isDesktop เพื่อให้ HTML จาก server ถูกตั้งแต่แรก ไม่กระพริบบนมือถือ
export function SidebarToggle() {
  const { isDesktop, desktopOpen, mobileOpen, toggle, toggleRef } = useSidebar();
  const open = isDesktop ? desktopOpen : mobileOpen;

  return (
    <button
      ref={toggleRef}
      type="button"
      onClick={toggle}
      aria-controls="app-sidebar"
      aria-expanded={open}
      aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
      className="group relative size-12 shrink-0 rounded-xl text-ink-muted outline-none hover:bg-canvas hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/20"
    >
      <span
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 ${
          desktopOpen ? "lg:hidden" : ""
        }`}
      >
        <Logo compact />
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          desktopOpen ? "lg:opacity-100" : ""
        }`}
      >
        <MenuIcon className="size-6" />
      </span>
    </button>
  );
}

// ปุ่ม X ใน drawer (จอเล็กเท่านั้น จอคอมใช้ปุ่มใน topbar)
export function SidebarCloseButton() {
  const { closeMobile } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => closeMobile(true)}
      aria-label="ปิดเมนู"
      className="flex size-10 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink lg:hidden"
    >
      <CloseIcon className="size-5" />
    </button>
  );
}
