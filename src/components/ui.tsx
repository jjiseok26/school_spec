"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { downloadTextFile } from "@/lib/utils";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/students", label: "학생·자료" },
  { href: "/subject", label: "교과특기" },
  { href: "/behavior", label: "행발" },
  { href: "/creative", label: "창체" },
  { href: "/club", label: "동아리" },
  { href: "/report", label: "활동열람" },
  { href: "/settings", label: "설정" },
];

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
        ? "JSON 내보내기 완료 (API 키 포함)"
        : "JSON 내보내기 완료 (API 키 제외)",
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
      flash("JSON을 불러왔습니다.");
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
          JSON 내보내기
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--hairline)] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-transform hover:bg-[var(--surface-pearl)] active:scale-95"
          onClick={() => fileRef.current?.click()}
        >
          JSON 불러오기
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
        내보내기에 API 키 포함
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
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* global-nav: slim near-black bar */}
      <div className="no-print sticky top-0 z-40 bg-black text-white">
        <div className="mx-auto flex h-11 max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-[13px] font-semibold tracking-tight text-white/90 hover:text-white"
          >
            생기부 교사도우미
          </Link>
          <button
            type="button"
            aria-label="메뉴"
            aria-expanded={open}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:text-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          </button>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1 text-[12px] tracking-tight transition-transform active:scale-95 ${
                  isActive(item.href)
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* mobile menu tray */}
        {open ? (
          <div className="border-t border-white/10 lg:hidden">
            <nav className="mx-auto grid max-w-[1440px] grid-cols-2 gap-1 px-4 py-3 sm:grid-cols-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm transition-transform active:scale-95 ${
                    isActive(item.href)
                      ? "bg-white/15 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </div>

      {/* sub-nav-frosted: page title strip */}
      <header className="no-print sticky top-11 z-30 border-b border-[var(--hairline)] bg-[var(--parchment)]/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-[1080px] items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
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

      <main className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="no-print border-t border-[var(--hairline)] bg-[var(--parchment)]">
        <div className="mx-auto max-w-[1080px] px-4 py-6 text-center text-[13px] text-[var(--ink-muted-48)] sm:px-6">
          © {new Date().getFullYear()} Jiseok. All rights reserved.
        </div>
      </footer>
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
