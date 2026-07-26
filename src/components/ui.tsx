"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
        <div className="mx-auto max-w-[1080px] px-4 py-4 sm:px-6 sm:py-5">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[15px] leading-snug text-[var(--ink-muted-80)] sm:text-[17px]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
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
