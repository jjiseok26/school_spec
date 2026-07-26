"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AppShell,
  Card,
  SegmentedTabs,
  btnSecondary,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import {
  PROVIDER_LABELS,
  SECTION_LABELS,
  type Section,
} from "@/lib/types";
import { copyText } from "@/lib/utils";

const SECTION_ORDER: Section[] = [
  "subject",
  "behavior",
  "autonomy",
  "career",
  "volunteer",
  "club",
];

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id ?? "";
  const { data } = useAppStore();
  const [viewTab, setViewTab] = useState<"schedule" | Section>("schedule");

  const student = data.students.find((s) => s.id === studentId);

  const documents = useMemo(
    () => data.documents.filter((d) => d.studentId === studentId),
    [data.documents, studentId],
  );
  const drafts = useMemo(
    () => data.drafts.filter((d) => d.studentId === studentId),
    [data.drafts, studentId],
  );
  const checkedItems = useMemo(() => {
    const ids = new Set(
      data.scheduleChecks
        .filter((c) => c.studentId === studentId)
        .map((c) => c.scheduleItemId),
    );
    return data.scheduleItems.filter((item) => ids.has(item.id));
  }, [data.scheduleChecks, data.scheduleItems, studentId]);

  if (!student) {
    return (
      <AppShell title="학생 데이터" subtitle="학생을 찾을 수 없습니다.">
        <Card>
          <p className="mb-3 text-sm text-slate-600">
            목록에 없는 학생이거나 데이터가 초기화되었습니다.
          </p>
          <Link href="/students" className={btnSecondary}>
            학생 목록으로
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${student.className} ${student.number ? `${student.number}번 ` : ""}${student.name}`}
      subtitle="이 학생에게 연결된 문서·초안·창체 체크를 한눈에 확인합니다."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/students" className={btnSecondary}>
          ← 학생 목록
        </Link>
        <Link href={`/report?student=${studentId}`} className={btnSecondary}>
          활동열람·인쇄
        </Link>
        <Link href={`/subject`} className={btnSecondary}>
          교과특기 작성
        </Link>
        <Link href={`/behavior`} className={btnSecondary}>
          행발 작성
        </Link>
        <Link href={`/creative`} className={btnSecondary}>
          창체 작성
        </Link>
        <Link href={`/club`} className={btnSecondary}>
          동아리 작성
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="문서" value={documents.length} />
        <Stat label="초안" value={drafts.length} />
        <Stat
          label="확정 초안"
          value={drafts.filter((d) => d.confirmed).length}
        />
      </div>

      <SegmentedTabs
        tabs={[
          { id: "schedule" as const, label: "창체 일정" },
          ...SECTION_ORDER.map((section) => ({
            id: section,
            label: SECTION_LABELS[section],
          })),
        ]}
        value={viewTab}
        onChange={setViewTab}
      />

      {viewTab === "schedule" ? (
        <Card title="창체 참여 일정">
          {checkedItems.length === 0 ? (
            <p className="text-sm text-slate-500">체크된 창체 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {checkedItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-200 px-3 py-2"
                >
                  <span className="mr-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                    {SECTION_LABELS[item.category]}
                  </span>
                  {[item.date, item.title].filter(Boolean).join(" · ")}
                  {item.note ? (
                    <span className="mt-0.5 block text-slate-500">
                      {item.note}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        (() => {
          const section = viewTab;
          const sectionDocs = documents.filter((d) => d.section === section);
          const sectionDrafts = drafts.filter((d) => d.section === section);
          return (
            <Card title={SECTION_LABELS[section]}>
              {!sectionDocs.length && !sectionDrafts.length ? (
                <p className="text-sm text-slate-500">
                  이 영역의 자료가 없습니다.
                </p>
              ) : (
                <div className="space-y-4">
                  {sectionDocs.map((doc) => {
                    const subjectName = doc.subjectId
                      ? data.subjects.find((s) => s.id === doc.subjectId)?.name
                      : null;
                    return (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <strong className="text-sm">
                            {doc.title || "문서"}
                          </strong>
                          {subjectName ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                              {subjectName}
                            </span>
                          ) : null}
                        </div>
                        {doc.text ? (
                          <p className="whitespace-pre-wrap text-sm text-slate-700">
                            {doc.text}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">(본문 없음)</p>
                        )}
                        {doc.teacherNote ? (
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 px-2 py-1.5 text-sm text-amber-900">
                            <span className="font-medium">교사 메모: </span>
                            {doc.teacherNote}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}

                  {sectionDrafts.map((draft) => {
                    const subjectName = draft.subjectId
                      ? data.subjects.find((s) => s.id === draft.subjectId)
                          ?.name
                      : null;
                    return (
                      <div
                        key={draft.id}
                        className={`rounded-xl border p-3 ${
                          draft.confirmed
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                draft.confirmed
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {draft.confirmed ? "확정" : "작성 중"}
                            </span>
                            {subjectName ? (
                              <span className="text-slate-500">
                                {subjectName}
                              </span>
                            ) : null}
                            {draft.provider ? (
                              <span className="text-slate-500">
                                {PROVIDER_LABELS[draft.provider]}
                                {draft.model ? ` / ${draft.model}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => void copyText(draft.edited)}
                          >
                            복사
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800">
                          {draft.edited || "(내용 없음)"}
                        </p>
                        {draft.options.length > 1 ? (
                          <details className="mt-2 text-sm text-slate-600">
                            <summary className="cursor-pointer">
                              다른 등급 초안 {draft.options.length}개 보기
                            </summary>
                            <ol className="mt-2 list-none space-y-2">
                              {draft.options.map((opt, i) => (
                                <li
                                  key={`${draft.id}_${i}`}
                                  className="rounded-lg border border-slate-200 px-3 py-2"
                                >
                                  <span className="mb-1 inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">
                                    {draft.levels?.[i] ?? `초안 ${i + 1}`}
                                  </span>
                                  <p className="whitespace-pre-wrap">{opt}</p>
                                </li>
                              ))}
                            </ol>
                          </details>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })()
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
