"use client";

import { useMemo, useState } from "react";
import { findDraft, findDocuments, useAppStore } from "@/lib/store";
import { collectDocumentMergePieces } from "@/lib/draftText";
import { formatActivityDate, formatOfficerLabel } from "@/lib/prompts";
import type { Draft, Section, StudentDoc } from "@/lib/types";
import {
  ACTIVITY_CATEGORIES,
  DRAFT_LEVEL_HINTS,
  PROVIDER_LABELS,
} from "@/lib/types";
import { copyText, orderCredentials } from "@/lib/utils";
import { DocumentDraftEditor } from "./PerDocumentDraft";
import {
  btnPrimary,
  btnSecondary,
  Card,
  Field,
  inputClass,
} from "./ui";

const ACTIVITY_SET = new Set<Section>(ACTIVITY_CATEGORIES);

export function DraftWorkbench({
  studentId,
  section,
  subjectId,
  subjectName,
  checkedActivities,
  officers,
  extraNote,
}: {
  studentId: string;
  section: Section;
  subjectId?: string;
  subjectName?: string;
  checkedActivities?: {
    date: string;
    title: string;
    note: string;
    observation?: string;
  }[];
  officers?: {
    gradeLabel?: string;
    title: string;
    startDate: string;
    endDate: string;
    observation?: string;
  }[];
  extraNote?: string;
}) {
  const {
    data,
    upsertDraft,
    selectDraftOption,
    editDraft,
    confirmDraft,
    setCharLimit,
    adjustApiKeyPriority,
  } = useAppStore();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  /** 체크 시 같은 학급 전체 학생에 생성·수합 적용 */
  const [applyToClass, setApplyToClass] = useState(false);

  const isActivitySection = ACTIVITY_SET.has(section);

  const documents = useMemo(
    () =>
      data.documents.filter(
        (doc) =>
          doc.studentId === studentId &&
          doc.section === section &&
          (subjectId ? doc.subjectId === subjectId : true),
      ),
    [data.documents, studentId, section, subjectId],
  );

  const sortedActivities = useMemo(() => {
    const list = [...(checkedActivities ?? [])];
    return list.sort((a, b) =>
      `${a.date}-${a.title}`.localeCompare(`${b.date}-${b.title}`, "ko"),
    );
  }, [checkedActivities]);

  const sortedOfficers = useMemo(() => {
    const list = [...(officers ?? [])];
    return list.sort((a, b) =>
      `${a.startDate}-${a.title}`.localeCompare(
        `${b.startDate}-${b.title}`,
        "ko",
      ),
    );
  }, [officers]);

  const mergedDraft = useMemo(
    () => findDraft(data.drafts, studentId, section, subjectId),
    [data.drafts, studentId, section, subjectId],
  );

  const credentials = useMemo(
    () =>
      orderCredentials(data.settings.apiKeys, data.settings.activeApiKeyId),
    [data.settings.apiKeys, data.settings.activeApiKeyId],
  );

  const selectedStudent = useMemo(
    () => data.students.find((s) => s.id === studentId),
    [data.students, studentId],
  );

  const classmates = useMemo(() => {
    if (!selectedStudent?.className) return [];
    return data.students
      .filter((s) => s.className === selectedStudent.className)
      .sort((a, b) =>
        `${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
          `${b.number.padStart(3, "0")}-${b.name}`,
          "ko",
        ),
      );
  }, [data.students, selectedStudent?.className]);

  const targetStudents = applyToClass
    ? classmates
    : selectedStudent
      ? [selectedStudent]
      : [];

  async function callGenerate(body: Record<string, unknown>) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "생성 실패");
    const usedId = (json.used as { id?: string } | undefined)?.id;
    const failedIds = (json.failedIds as string[] | undefined) ?? [];
    if (usedId) adjustApiKeyPriority(usedId, failedIds);
    return json as {
      drafts: string[];
      levels?: Draft["levels"];
      used?: { id?: string; provider: Draft["provider"]; model: string };
      failedIds?: string[];
    };
  }

  async function generateForDocument(doc: StudentDoc) {
    if (!studentId) {
      setError("학생을 선택하세요.");
      return;
    }
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    if (!doc.text.trim() && !doc.teacherNote.trim()) {
      setError("문서 본문 또는 교사 메모가 필요합니다.");
      return;
    }

    setBusyKey(doc.id);
    setError("");
    try {
      const json = await callGenerate({
        section,
        subjectName,
        documents: [
          {
            title: doc.title,
            text: doc.text,
            teacherNote: doc.teacherNote,
          },
        ],
        checkedActivities: sortedActivities,
        officers: sortedOfficers,
        charLimit: data.settings.charLimits[section],
        credentials,
      });
      upsertDraft({
        studentId,
        section,
        subjectId,
        documentId: doc.id,
        options: json.drafts,
        levels: json.levels,
        provider: json.used?.provider,
        model: json.used?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusyKey(null);
    }
  }

  async function generateAllDocuments() {
    if (!studentId) {
      setError("학생을 선택하세요.");
      return;
    }
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    const students = targetStudents;
    if (!students.length) {
      setError(
        applyToClass
          ? "학급 정보가 없어 전체 적용할 수 없습니다."
          : "학생을 선택하세요.",
      );
      return;
    }

    const jobs = students.flatMap((stu) => {
      const docs = findDocuments(
        data.documents,
        stu.id,
        section,
        subjectId,
      ).filter((doc) => doc.text.trim() || doc.teacherNote.trim());
      return docs.map((doc) => ({ student: stu, doc }));
    });

    if (!jobs.length) {
      setError(
        applyToClass
          ? "학급 학생에게 생성할 문서가 없습니다."
          : "등록된 문서가 없습니다.",
      );
      return;
    }

    setBusyKey("all-docs");
    setError("");
    setStatus("");
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const { student: stu, doc } of jobs) {
        setBusyKey(`all:${stu.id}:${doc.id}`);
        try {
          const json = await callGenerate({
            section,
            subjectName,
            documents: [
              {
                title: doc.title,
                text: doc.text,
                teacherNote: doc.teacherNote,
              },
            ],
            checkedActivities: sortedActivities,
            officers: sortedOfficers,
            charLimit: data.settings.charLimits[section],
            credentials,
          });
          upsertDraft({
            studentId: stu.id,
            section,
            subjectId,
            documentId: doc.id,
            options: json.drafts,
            levels: json.levels,
            provider: json.used?.provider,
            model: json.used?.model,
          });
          ok += 1;
        } catch (err) {
          errors.push(
            `${stu.name}/${doc.title || "문서"}: ${err instanceof Error ? err.message : "실패"}`,
          );
        }
      }
      if (errors.length) {
        setError(
          applyToClass
            ? `학급 문서 초안: ${ok}건 생성, 실패 ${errors.length}건 — ${errors.slice(0, 2).join(" / ")}`
            : errors[0],
        );
      } else if (applyToClass) {
        setStatus(
          `학급 ${students.length}명 · 문서 초안 ${ok}건을 생성했습니다.`,
        );
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function mergeDrafts() {
    if (!studentId) {
      setError("학생을 선택하세요.");
      return;
    }
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    const students = targetStudents;
    if (!students.length) {
      setError(
        applyToClass
          ? "학급 정보가 없어 전체 적용할 수 없습니다."
          : "학생을 선택하세요.",
      );
      return;
    }

    const jobs = students
      .map((stu) => {
        const docs = findDocuments(
          data.documents,
          stu.id,
          section,
          subjectId,
        );
        const usePieces = collectDocumentMergePieces(
          docs,
          data.drafts,
          stu.id,
          section,
          subjectId,
        );
        return { student: stu, usePieces };
      })
      .filter((j) => j.usePieces.length > 0);

    if (!jobs.length) {
      setError(
        "수합할 문서별 초안이 없습니다. 먼저 각 문서의 초안을 생성·확정하세요.",
      );
      return;
    }

    setBusyKey("merge");
    setError("");
    setStatus("");
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const { student: stu, usePieces } of jobs) {
        setBusyKey(`merge:${stu.id}`);
        try {
          const json = await callGenerate({
            section,
            subjectName,
            documents: usePieces.map((p) => ({
              title: p.level ? `${p.title} (${p.level})` : p.title,
              text: p.text,
              teacherNote: "",
            })),
            checkedActivities,
            officers: sortedOfficers,
            extraNote,
            mergeMode: true,
            charLimit: data.settings.charLimits[section],
            credentials,
          });
          upsertDraft({
            studentId: stu.id,
            section,
            subjectId,
            options: json.drafts,
            levels: json.levels,
            provider: json.used?.provider,
            model: json.used?.model,
          });
          ok += 1;
        } catch (err) {
          errors.push(
            `${stu.name}: ${err instanceof Error ? err.message : "수합 실패"}`,
          );
        }
      }
      if (errors.length) {
        setError(
          applyToClass
            ? `학급 수합: ${ok}명 완료, 실패 ${errors.length}명 — ${errors.slice(0, 2).join(" / ")}`
            : errors[0],
        );
      } else if (applyToClass) {
        setStatus(`학급 ${ok}명의 최종 초안을 생성했습니다.`);
      }
    } finally {
      setBusyKey(null);
    }
  }

  /** 체크된 일정(+문서)을 근거로 최종 특기사항 초안 생성 */
  async function generateFromSources() {
    if (!studentId) {
      setError("학생을 선택하세요.");
      return;
    }
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    if (
      isActivitySection &&
      sortedActivities.length === 0 &&
      sortedOfficers.length === 0
    ) {
      setError(
        section === "autonomy"
          ? "체크된 일정 또는 임원 기록이 없습니다. 일정 체크나 임원 탭에서 먼저 등록하세요."
          : "체크된 일정이 없습니다. 일정 체크 탭에서 참여 활동을 먼저 선택하세요.",
      );
      return;
    }
    setBusyKey("sources");
    setError("");
    try {
      const json = await callGenerate({
        section,
        subjectName,
        documents: documents.map((doc) => ({
          title: doc.title,
          text: doc.text,
          teacherNote: doc.teacherNote,
        })),
        checkedActivities: sortedActivities,
        officers: sortedOfficers,
        extraNote,
        charLimit: data.settings.charLimits[section],
        credentials,
      });
      upsertDraft({
        studentId,
        section,
        subjectId,
        options: json.drafts,
        levels: json.levels,
        provider: json.used?.provider,
        model: json.used?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusyKey(null);
    }
  }

  async function onCopy(text: string) {
    if (!text) return;
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const busy = busyKey !== null;
  const readyDocDraftCount = documents.filter((doc) => {
    const d = findDraft(data.drafts, studentId, section, subjectId, doc.id);
    return Boolean(d?.confirmed || d?.edited.trim());
  }).length;
  const confirmedDocDraftCount = documents.filter((doc) =>
    Boolean(
      findDraft(data.drafts, studentId, section, subjectId, doc.id)?.confirmed,
    ),
  ).length;

  const classMergeableCount = useMemo(() => {
    if (!applyToClass) return readyDocDraftCount > 0 ? 1 : 0;
    return classmates.filter((stu) => {
      const docs = findDocuments(data.documents, stu.id, section, subjectId);
      return (
        collectDocumentMergePieces(
          docs,
          data.drafts,
          stu.id,
          section,
          subjectId,
        ).length > 0
      );
    }).length;
  }, [
    applyToClass,
    classmates,
    data.documents,
    data.drafts,
    section,
    subjectId,
    readyDocDraftCount,
  ]);

  return (
    <Card title="초안 생성 · 선택 · 수정 · 확정">
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="글자 수 제한" hint="비우면 무제한으로 생성합니다.">
          <input
            className={inputClass}
            value={data.settings.charLimits[section]}
            onChange={(e) => setCharLimit(section, e.target.value)}
            placeholder="무제한"
            inputMode="numeric"
          />
        </Field>
        <Field label="1순위 API 키">
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] px-3 py-2 text-sm text-[var(--ink-muted-80)]">
            {(() => {
              const first = credentials[0];
              return first
                ? `${first.label ?? PROVIDER_LABELS[first.provider]} · ${PROVIDER_LABELS[first.provider]}`
                : "미선택 (설정에서 등록)";
            })()}
          </div>
        </Field>
      </div>

      <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
        {isActivitySection
          ? section === "autonomy"
            ? "체크한 일정·임원 기록과 교사 관찰을 바탕으로 특기사항을 만듭니다. 임원은 「임원명(기간)」 형식으로 반영되며 학년은 넣지 않습니다."
            : "체크한 일정과 교사 관찰을 바탕으로 「활동명(날짜)에서 …함.」 형식의 특기사항을 만듭니다. 행동 특성·참여도·협력도·실적·실제 역할을 충실히 반영합니다."
          : "문서마다 최상·상·중·하 초안을 만들고 확정한 뒤, «전체 초안 수합하여 최종 초안 생성»으로 최종 특기사항을 만들 수 있습니다. 학생 문서 탭에서도 건별로 생성·확정이 가능합니다."}
      </p>

      {isActivitySection ? (
        <div className="mb-4 rounded-[18px] border border-[var(--hairline)] bg-[var(--parchment)] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-[var(--ink)]">
                {section === "autonomy"
                  ? "일정·임원 기반 특기사항 초안 생성"
                  : "체크한 일정으로 특기사항 초안 생성"}
              </p>
              <p className="text-xs text-[var(--ink-muted-48)]">
                {section === "autonomy"
                  ? "예: 1학기 전교 학생자치회 부회장(2026.03.01.-2026.08.18.)으로서 …함."
                  : "예: 학급회의 및 임원 선출(2026.03.05.)에서 …을 함."}
              </p>
            </div>
            <button
              type="button"
              className={btnPrimary}
              disabled={
                busy ||
                !studentId ||
                (sortedActivities.length === 0 && sortedOfficers.length === 0)
              }
              onClick={() => void generateFromSources()}
            >
              {busyKey === "sources"
                ? "생성 중…"
                : section === "autonomy"
                  ? `일정·임원 기반 초안 생성 (${sortedActivities.length + sortedOfficers.length})`
                  : `일정 기반 초안 생성 (${sortedActivities.length})`}
            </button>
          </div>
          {sortedOfficers.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1 text-xs font-semibold text-[var(--ink-muted-48)]">
                임원
              </p>
              <ul className="space-y-1 text-sm text-[var(--ink-muted-80)]">
                {sortedOfficers.map((o, i) => (
                  <li key={`${o.title}_${o.startDate}_${i}`}>
                    <span>· {formatOfficerLabel(o)}</span>
                    {o.observation?.trim() ? (
                      <span className="mt-0.5 block pl-3 text-xs text-[var(--ink-muted-48)]">
                        관찰: {o.observation.trim()}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {sortedActivities.length === 0 && sortedOfficers.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted-48)]">
              {section === "autonomy"
                ? "일정 체크 또는 임원 탭에서 먼저 등록하세요."
                : "일정 체크 탭에서 참여 활동을 선택하세요."}
            </p>
          ) : sortedActivities.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--ink-muted-48)]">
                체크한 일정
              </p>
              <ul className="space-y-1 text-sm text-[var(--ink-muted-80)]">
                {sortedActivities.map((a, i) => {
                  const date = formatActivityDate(a.date);
                  const title = a.title.trim() || "활동";
                  return (
                    <li key={`${a.date}_${a.title}_${i}`}>
                      <span>
                        · {date ? `${title}(${date})` : title}
                        {a.note ? ` — ${a.note}` : ""}
                      </span>
                      {a.observation?.trim() ? (
                        <span className="mt-0.5 block pl-3 text-xs text-[var(--ink-muted-48)]">
                          관찰: {a.observation.trim()}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 whitespace-pre-wrap rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mb-3 whitespace-pre-wrap rounded-xl bg-[var(--parchment)] px-3 py-2 text-sm text-[var(--ink-muted-80)]">
          {status}
        </p>
      ) : null}

      {documents.length > 0 ? (
        <div className="mb-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--ink-muted-80)]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={applyToClass}
                onChange={(e) => setApplyToClass(e.target.checked)}
                disabled={busy || !studentId}
              />
              학급 전체 적용
              {selectedStudent?.className
                ? ` (${selectedStudent.className} · ${classmates.length}명)`
                : ""}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={busy || !studentId}
              onClick={() => void generateAllDocuments()}
            >
              {busyKey?.startsWith("all")
                ? applyToClass
                  ? "학급 문서별 생성 중…"
                  : "문서별 생성 중…"
                : applyToClass
                  ? `모든 문서 초안 생성 (학급 ${classmates.length}명)`
                  : "모든 문서 초안 생성"}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={
                busy ||
                !studentId ||
                (applyToClass
                  ? classMergeableCount === 0
                  : readyDocDraftCount === 0)
              }
              onClick={() => void mergeDrafts()}
            >
              {busyKey?.startsWith("merge")
                ? applyToClass
                  ? "학급 최종 초안 생성 중…"
                  : "최종 초안 생성 중…"
                : applyToClass
                  ? `전체 초안 수합하여 최종 초안 생성 (학급 ${classMergeableCount}/${classmates.length}명)`
                  : `전체 초안 수합하여 최종 초안 생성 (${confirmedDocDraftCount || readyDocDraftCount}/${documents.length})`}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {documents.map((doc) => {
              const docDraft = findDraft(
                data.drafts,
                studentId,
                section,
                subjectId,
                doc.id,
              );
              const isActive =
                (activeDocId ?? documents[0]?.id) === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDocId(doc.id)}
                  className={`max-w-[180px] truncate rounded-full px-3 py-1.5 text-sm transition-transform active:scale-95 ${
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--hairline)] bg-[var(--surface-pearl)] text-[var(--ink)]"
                  }`}
                  title={doc.title || "문서"}
                >
                  {docDraft?.confirmed
                    ? "✓ "
                    : docDraft?.edited.trim()
                      ? "· "
                      : ""}
                  {doc.title || "문서"}
                </button>
              );
            })}
          </div>

          {(() => {
            const doc =
              documents.find(
                (d) => d.id === (activeDocId ?? documents[0]?.id),
              ) ?? documents[0];
            if (!doc) return null;
            const draft = findDraft(
              data.drafts,
              studentId,
              section,
              subjectId,
              doc.id,
            );
            return (
              <div
                key={doc.id}
                className="rounded-[18px] border border-[var(--hairline)] bg-white p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {doc.title || "문서"}
                    </p>
                    <p className="text-xs text-[var(--ink-muted-48)]">
                      본문 {doc.text.trim().length}자
                      {doc.teacherNote.trim()
                        ? ` · 교사메모 ${doc.teacherNote.trim().length}자`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => void generateForDocument(doc)}
                  >
                    {busyKey === doc.id || busyKey === `all:${doc.id}`
                      ? "생성 중…"
                      : "이 문서 초안 생성"}
                  </button>
                </div>
                {!draft ? (
                  <p className="text-sm text-[var(--ink-muted-48)]">
                    아직 초안이 없습니다.
                  </p>
                ) : (
                  <DocumentDraftEditor
                    draft={draft}
                    onSelect={(index) => selectDraftOption(draft.id, index)}
                    onEdit={(text) => editDraft(draft.id, text)}
                    onConfirm={() => confirmDraft(draft.id)}
                  />
                )}
              </div>
            );
          })()}
        </div>
      ) : isActivitySection ? null : (
        <div className="mb-4">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !studentId}
            onClick={() => void generateFromSources()}
          >
            {busyKey === "sources"
              ? "생성 중…"
              : "초안 생성 (최상/상/중/하)"}
          </button>
          <p className="mt-2 text-sm text-[var(--ink-muted-48)]">
            문서가 없으면 체크된 활동·교사 메모만으로 초안을 만듭니다.
          </p>
        </div>
      )}

      <div className="border-t border-[var(--hairline)] pt-4">
        <h3 className="mb-2 text-[17px] font-semibold text-[var(--ink)]">
          {isActivitySection ? "일정 기반 특기사항 초안" : "수합 초안 (최종)"}
        </h3>
        {!mergedDraft ? (
          <p className="text-sm text-[var(--ink-muted-48)]">
            {isActivitySection
              ? "위에서 «일정 기반 초안 생성»을 누르면 여기에 표시됩니다."
              : documents.length > 0
                ? "문서별 초안을 만든 뒤 «전체 초안 수합하여 최종 초안 생성»을 누르면 여기에 최종 초안이 표시됩니다."
                : "초안을 생성하면 여기에 표시됩니다."}
          </p>
        ) : (
          <DraftEditor
            draft={mergedDraft}
            charLimit={data.settings.charLimits[section]}
            copied={copied}
            onSelect={(index) => selectDraftOption(mergedDraft.id, index)}
            onEdit={(text) => editDraft(mergedDraft.id, text)}
            onConfirm={() => confirmDraft(mergedDraft.id)}
            onCopy={() => void onCopy(mergedDraft.edited)}
          />
        )}
      </div>
    </Card>
  );
}

function DraftEditor({
  draft,
  charLimit,
  copied,
  onSelect,
  onEdit,
  onConfirm,
  onCopy,
}: {
  draft: Draft;
  charLimit: string;
  copied: boolean;
  onSelect: (index: number) => void;
  onEdit: (text: string) => void;
  onConfirm: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {draft.options.map((option, index) => {
          const level = draft.levels?.[index];
          return (
            <button
              key={`${draft.id}_${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className={`rounded-xl border px-3 py-3 text-left text-sm ${
                draft.selected === index
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--hairline)] bg-white hover:border-[var(--primary)]/40"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-white">
                  {level ?? `초안 ${index + 1}`}
                </span>
                {level ? (
                  <span className="text-xs text-[var(--ink-muted-48)]">
                    {DRAFT_LEVEL_HINTS[level]}
                  </span>
                ) : null}
                {draft.selected === index ? (
                  <span className="text-xs font-semibold text-[var(--primary)]">
                    선택됨
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-[var(--ink)]">{option}</p>
            </button>
          );
        })}
      </div>

      <Field label="선택한 수합 초안 수정">
        <textarea
          className={`${inputClass} min-h-36`}
          value={draft.edited}
          onChange={(e) => onEdit(e.target.value)}
        />
        <div className="mt-1 text-xs text-[var(--ink-muted-48)]">
          현재 {draft.edited.length}자
          {charLimit ? ` / 제한 ${charLimit}자` : " (무제한)"}
        </div>
      </Field>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onConfirm}>
          {draft.confirmed ? "확정됨" : "확정"}
        </button>
        <button type="button" className={btnSecondary} onClick={onCopy}>
          {copied ? "복사됨" : "확정문 복사"}
        </button>
        {draft.provider ? (
          <span className="self-center text-xs text-[var(--ink-muted-48)]">
            사용: {PROVIDER_LABELS[draft.provider]}
            {draft.model ? ` / ${draft.model}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
