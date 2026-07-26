"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClassExcelPanel } from "@/components/ClassExcelPanel";
import { DocumentPanel } from "@/components/DocumentPanel";
import { DraftWorkbench } from "@/components/DraftWorkbench";
import { StudentPicker } from "@/components/StudentPicker";
import { StudentWorkTabs } from "@/components/StudentWorkTabs";
import {
  AppShell,
  Card,
  Field,
  SegmentedTabs,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import { DEFAULT_SUBJECT_NAMES } from "@/lib/types";

export default function SubjectPage() {
  const {
    data,
    addSubject,
    removeSubject,
    ensureDefaultSubjects,
    setTeacherSubjectId,
  } = useAppStore();
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [message, setMessage] = useState("");
  const [mainTab, setMainTab] = useState<"subject" | "excel">("subject");

  const fixedSubjectId =
    data.settings.teacherSubjectId &&
    data.subjects.some((s) => s.id === data.settings.teacherSubjectId)
      ? data.settings.teacherSubjectId
      : null;
  const isFixed = Boolean(fixedSubjectId);
  const effectiveSubjectId = fixedSubjectId ?? subjectId;

  useEffect(() => {
    if (fixedSubjectId) setSubjectId(fixedSubjectId);
  }, [fixedSubjectId]);

  const subject = data.subjects.find((s) => s.id === effectiveSubjectId);
  const defaultNames = new Set<string>(DEFAULT_SUBJECT_NAMES);

  function fixCurrentSubject() {
    if (!subjectId) {
      setMessage("고정할 과목을 먼저 선택하세요.");
      return;
    }
    setTeacherSubjectId(subjectId);
    setMessage("과목을 고정했습니다. 이 화면에서 선택한 과목만 사용됩니다.");
  }

  function unfixSubject() {
    setTeacherSubjectId(null);
    setMessage("과목 고정을 해제했습니다.");
  }

  return (
    <AppShell
      title="교과 세부능력 및 특기사항"
      subtitle={
        isFixed
          ? `담당 과목 «${subject?.name ?? ""}»이(가) 고정되어 있습니다.`
          : "기본 교과목이 준비되어 있습니다. 담당 과목을 선택해 고정할 수 있습니다."
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card title="학생">
            <StudentPicker value={studentId} onChange={setStudentId} />
          </Card>
        </div>

        <div className="space-y-4">
          <SegmentedTabs
            tabs={[
              { id: "subject", label: "과목 · 작성" },
              { id: "excel", label: "반별 엑셀" },
            ]}
            value={mainTab}
            onChange={setMainTab}
          />

          {mainTab === "subject" ? (
            <>
              <Card
                title="과목"
                actions={
                  isFixed ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={unfixSubject}
                    >
                      고정 해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        ensureDefaultSubjects();
                        setMessage("기본 교과목을 반영했습니다.");
                      }}
                    >
                      기본 과목 채우기
                    </button>
                  )
                }
              >
                {isFixed ? (
                  <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--parchment)] px-4 py-3">
                    <p className="text-[14px] text-[var(--ink-muted-48)]">
                      담당 과목 (고정됨)
                    </p>
                    <p className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                      {subject?.name}
                    </p>
                    <p className="mt-2 text-xs text-[var(--ink-muted-48)]">
                      고정 해제 후 다른 과목을 선택하거나,{" "}
                      <Link
                        href="/settings"
                        className="text-[var(--primary)] underline"
                      >
                        설정
                      </Link>
                      에서도 변경할 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <>
                    <Field
                      label="과목 선택"
                      hint="담당 과목을 고른 뒤 «이 과목 고정»을 누르면 이후에도 이 과목만 사용됩니다."
                    >
                      <select
                        className={inputClass}
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                      >
                        <option value="">과목을 선택하세요</option>
                        {data.subjects.map((s) => {
                          const isDefault = defaultNames.has(s.name);
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {isDefault ? "" : " (추가)"}
                            </option>
                          );
                        })}
                      </select>
                    </Field>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={!subjectId}
                        onClick={fixCurrentSubject}
                      >
                        이 과목 고정
                      </button>
                      <input
                        className={`${inputClass} max-w-xs`}
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder="그 외 과목명 (예: 한문, 일본어)"
                      />
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => {
                          if (!newSubject.trim()) return;
                          const id = addSubject(newSubject.trim());
                          if (id) setSubjectId(id);
                          setNewSubject("");
                          setMessage("과목을 추가했습니다.");
                        }}
                      >
                        과목 추가
                      </button>
                      {subjectId ? (
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => {
                            if (
                              subject &&
                              defaultNames.has(subject.name) &&
                              !window.confirm(
                                `"${subject.name}"은(는) 기본 과목입니다. 삭제할까요?`,
                              )
                            ) {
                              return;
                            }
                            removeSubject(subjectId);
                            setSubjectId("");
                          }}
                        >
                          선택 과목 삭제
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
                {message ? (
                  <p className="mt-2 text-sm text-[var(--ink-muted-80)]">
                    {message}
                  </p>
                ) : null}
              </Card>

              {studentId && effectiveSubjectId ? (
                <StudentWorkTabs
                  documents={
                    <DocumentPanel
                      studentId={studentId}
                      section="subject"
                      subjectId={effectiveSubjectId}
                      subjectName={subject?.name}
                    />
                  }
                  drafts={
                    <DraftWorkbench
                      studentId={studentId}
                      section="subject"
                      subjectId={effectiveSubjectId}
                      subjectName={subject?.name}
                    />
                  }
                />
              ) : (
                <Card>
                  <p className="text-sm text-[var(--ink-muted-48)]">
                    {isFixed
                      ? "왼쪽에서 학생을 선택하면 문서 입력과 초안 생성이 가능합니다."
                      : "왼쪽에서 학생을, 위에서 과목을 선택하면 문서 입력과 초안 생성이 가능합니다."}
                  </p>
                </Card>
              )}
            </>
          ) : null}

          {mainTab === "excel" ? (
            effectiveSubjectId ? (
              <ClassExcelPanel
                section="subject"
                subjectId={effectiveSubjectId}
                subjectName={subject?.name}
              />
            ) : (
              <Card>
                <p className="text-sm text-[var(--ink-muted-48)]">
                  먼저 «과목 · 작성» 탭에서 과목을 선택하세요.
                </p>
              </Card>
            )
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
