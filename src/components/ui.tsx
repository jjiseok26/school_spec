"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { downloadTextFile } from "@/lib/utils";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/students", label: "학생등록" },
  { href: "/subject", label: "교과특기" },
  { href: "/behavior", label: "행발" },
  { href: "/creative", label: "창체" },
  { href: "/club", label: "동아리" },
  { href: "/report", label: "활동열람" },
  { href: "/settings", label: "설정" },
] as const;

const SIDEBAR_EXPANDED_KEY = "app-sidebar-expanded";

function NavLinks({
  pathname,
  expanded,
  onNavigate,
}: {
  pathname: string | null;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-2">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--ink-muted-80)] hover:bg-white hover:text-[var(--ink)]"
          } ${expanded ? "" : "justify-center px-2"}`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${
              isActive(item.href)
                ? "bg-white/20"
                : "bg-[var(--surface-pearl)] text-[var(--ink)]"
            }`}
          >
            {item.label.slice(0, 1)}
          </span>
          {expanded ? <span className="truncate">{item.label}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

function GlobalBackupButtons() {
  const { data, exportData, importData, setIncludeKeysInExport } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState("");

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2500);
  }

  function onExport() {
    const payload = exportData(data.settings.includeKeysInExport);
    downloadTextFile(
      `생기부도우미_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
    );
    flash(
      data.settings.includeKeysInExport
        ? "저장 완료 (API 키 포함)"
        : "저장 완료 (API 키 제외)",
    );
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (parsed?.version !== 1) {
        throw new Error("지원하지 않는 JSON 형식입니다.");
      }
      const includeKeys = window.confirm(
        "JSON에 포함된 API 키도 불러올까요?\n취소를 누르면 기존 키를 유지합니다.",
      );
      importData(parsed, includeKeys);
      flash("불러오기가 완료되었습니다.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "불러오기 실패");
    }
  }

  return (
    <div className="relative flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--hairline)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-transform hover:bg-[var(--surface-pearl)] active:scale-95"
          onClick={onExport}
        >
          저장하기
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--hairline)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-transform hover:bg-[var(--surface-pearl)] active:scale-95"
          onClick={() => fileRef.current?.click()}
        >
          불러오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = "";
          }}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[var(--ink-muted-80)]">
        <input
          type="checkbox"
          className="rounded border-[var(--hairline)]"
          checked={data.settings.includeKeysInExport}
          onChange={(e) => setIncludeKeysInExport(e.target.checked)}
        />
        저장할때 API 키 포함
      </label>
      {toast ? (
        <p className="absolute right-0 top-full z-50 mt-2 max-w-[240px] rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      setSidebarExpanded(localStorage.getItem(SIDEBAR_EXPANDED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const desktopSidebarWidth = sidebarExpanded ? "lg:pl-56" : "lg:pl-[4.25rem]";

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="no-print sticky top-0 z-50 bg-black text-white">
        <div className="flex h-11 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="메뉴 열기"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/80 hover:text-white lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <span className="text-lg leading-none">☰</span>
            </button>
            <Link
              href="/"
              className="truncate text-[13px] font-semibold tracking-tight text-white/90 hover:text-white"
            >
              생기부 교사도우미
            </Link>
          </div>
          <button
            type="button"
            aria-label="사이드바 펼치기"
            className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-[12px] text-white/70 hover:text-white lg:inline-flex"
            onClick={toggleSidebar}
          >
            {sidebarExpanded ? "메뉴 접기" : "메뉴 펼치기"}
          </button>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {mobileNavOpen ? (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="fixed inset-0 top-11 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="no-print fixed left-0 top-11 z-50 flex h-[calc(100dvh-2.75rem)] w-56 flex-col border-r border-[var(--hairline)] bg-[var(--parchment)] shadow-xl lg:hidden">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-3 py-2">
              <span className="text-sm font-semibold text-[var(--ink)]">메뉴</span>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-[var(--ink-muted-48)]"
                onClick={() => setMobileNavOpen(false)}
              >
                닫기
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              expanded
              onNavigate={() => setMobileNavOpen(false)}
            />
          </aside>
        </>
      ) : null}

      {/* 데스크톱 접이식 사이드바 */}
      <aside
        className={`no-print fixed left-0 top-11 z-40 hidden h-[calc(100dvh-2.75rem)] flex-col border-r border-[var(--hairline)] bg-[var(--parchment)]/95 backdrop-blur-sm transition-[width] duration-200 lg:flex ${
          sidebarExpanded ? "w-56" : "w-[4.25rem]"
        }`}
      >
        <NavLinks pathname={pathname} expanded={sidebarExpanded} />
        <div className="border-t border-[var(--hairline)] p-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-[var(--ink-muted-80)] hover:bg-white hover:text-[var(--ink)] ${
              sidebarExpanded ? "" : "justify-center"
            }`}
            aria-expanded={sidebarExpanded}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-pearl)] text-base">
              {sidebarExpanded ? "‹" : "›"}
            </span>
            {sidebarExpanded ? <span>메뉴 접기</span> : null}
          </button>
        </div>
      </aside>

      <div
        className={`flex min-h-[calc(100dvh-2.75rem)] flex-col transition-[padding] duration-200 ${desktopSidebarWidth}`}
      >
        <header className="no-print sticky top-11 z-30 border-b border-[var(--hairline)] bg-[var(--parchment)]/80 backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8 sm:py-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-[15px] leading-snug text-[var(--ink-muted-80)] sm:text-[17px]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <GlobalBackupButtons />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>

        <footer className="no-print border-t border-[var(--hairline)] bg-[var(--parchment)]">
          <div className="px-4 py-6 text-center text-[13px] text-[var(--ink-muted-48)] sm:px-6 lg:px-8">
            © {new Date().getFullYear()} Jiseok. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}

export function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[var(--hairline)] bg-white p-4 sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[14px] font-medium text-[var(--ink)]">{label}</span>
      {children}
      {hint ? (
        <span className="block text-[12px] leading-snug text-[var(--ink-muted-48)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap gap-1.5 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
            value === tab.id
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--hairline)] bg-[var(--surface-pearl)] text-[var(--ink)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5 text-[15px] text-[var(--ink)] outline-none transition focus:border-[var(--primary-focus)] focus:ring-2 focus:ring-[var(--primary-focus)]/30";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2.5 text-[15px] font-medium text-white transition-transform hover:bg-[#0b6ad6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface-pearl)] px-4 py-2.5 text-[15px] font-medium text-[var(--ink)] transition-transform hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

export const btnGhostPill =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--primary)] bg-transparent px-5 py-2.5 text-[15px] font-medium text-[var(--primary)] transition-transform hover:bg-[var(--primary)]/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

export const btnDanger =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-[15px] font-medium text-rose-600 transition-transform hover:bg-rose-100 active:scale-95";
