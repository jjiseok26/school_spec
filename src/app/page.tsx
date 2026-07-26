"use client";

import Link from "next/link";
import { AppShell, Card, btnPrimary, btnSecondary } from "@/components/ui";
import { useAppStore } from "@/lib/store";
import { SECTION_LABELS } from "@/lib/types";

const ROLES = [
  {
    href: "/subject",
    title: "교과 교사",
    desc: "과목을 추가하고 학생 문서·교사 메모로 교과 특기사항을 작성합니다.",
  },
  {
    href: "/behavior",
    title: "담임 · 행발",
    desc: "행동특성 및 발달상황을 학생 자료와 관찰 메모로 작성합니다.",
  },
  {
    href: "/creative",
    title: "담임 · 창체",
    desc: "자율·진로·봉사를 한 화면에서 작성합니다. 학교 일정 체크를 지원합니다.",
  },
  {
    href: "/club",
    title: "동아리 담당",
    desc: "동아리 활동 자료로 동아리 특기사항을 작성합니다.",
  },
  {
    href: "/report",
    title: "활동 열람 · 인쇄",
    desc: "학생을 골라 활동별 작성 내용을 모아서 보고, 인쇄하거나 파일로 받습니다.",
  },
];

export default function HomePage() {
  const { data, ready } = useAppStore();
  const confirmed = data.drafts.filter((d) => d.confirmed).length;
  const keys = data.settings.apiKeys.length;

  return (
    <AppShell
      title="시작하기"
      subtitle="학생 문서를 근거로 생기부 특기사항 초안을 만들고, 선택·수정·확정합니다."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="등록 학생" value={ready ? data.students.length : "-"} />
        <Stat label="등록 API 키" value={ready ? keys : "-"} />
        <Stat label="확정된 초안" value={ready ? confirmed : "-"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((role) => (
          <Card key={role.href} title={role.title}>
            <p className="mb-4 text-sm text-slate-600">{role.desc}</p>
            <Link href={role.href} className={btnPrimary}>
              바로가기
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="빠른 준비">
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>설정에서 Google / NVIDIA / OpenAI / Claude API 키를 등록합니다.</li>
            <li>학생·자료에서 학급 학생을 등록합니다.</li>
            <li>해당 역할 화면에서 문서를 넣고 최상/상/중/하 초안을 생성합니다.</li>
            <li>활동열람에서 학생별 자료를 인쇄·다운로드합니다.</li>
            <li>JSON으로 내보내 다른 PC에서도 불러올 수 있습니다.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings" className={btnPrimary}>
              설정으로
            </Link>
            <Link href="/students" className={btnSecondary}>
              학생 등록
            </Link>
          </div>
        </Card>
        <Card title="작성 가능 항목">
          <ul className="space-y-2 text-sm text-slate-600">
            {Object.entries(SECTION_LABELS).map(([key, label]) => (
              <li key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                {label}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] border border-[var(--hairline)] bg-white p-5">
      <p className="text-[13px] text-[var(--ink-muted-48)]">{label}</p>
      <p className="mt-1 text-[34px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}
