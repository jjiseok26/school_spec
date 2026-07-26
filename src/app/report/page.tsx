"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, Card, Field, SegmentedTabs, btnPrimary, btnSecondary, inputClass } from "@/components/ui";
import { useAppStore } from "@/lib/store";
import { SECTION_LABELS, type Section } from "@/lib/types";
import { downloadTextFile } from "@/lib/utils";

const SECTION_ORDER: Section[] = [
  "subject",
  "behavior",
  "autonomy",
  "career",
  "volunteer",
  "club",
];

function ReportPageInner() {
  const { data, removeDocument, removeDraft } = useAppStore();
  const searchParams = useSearchParams();
  const [studentId, setStudentId] = useState("");
  const [selectedClass, setSelectedClass] = useState(
    () => data.settings.teacherClassName ?? "",
  );
  const [viewTab, setViewTab] = useState<Section>("subject");

  const preferredClass = data.settings.teacherClassName;

  const classes = useMemo(() => {
    const list = [
      ...new Set(data.students.map((s) => s.className).filter(Boolean)),
    ];
    return list.sort((a, b) => {
      if (preferredClass) {
        if (a === preferredClass) return -1;
        if (b === preferredClass) return 1;
      }
      return a.localeCompare(b, "ko");
    });
  }, [data.students, preferredClass]);

  useEffect(() => {
    if (
      preferredClass &&
      (!selectedClass ||
        (classes.length > 0 &&
          !classes.includes(selectedClass) &&
          classes.includes(preferredClass)))
    ) {
      setSelectedClass(preferredClass);
    }
  }, [preferredClass, classes, selectedClass]);

  // URL ?student=... 로 진입 시 학급/학생 자동 선택
  useEffect(() => {
    const fromQuery = searchParams.get("student");
    if (fromQuery) {
      const target = data.students.find((s) => s.id === fromQuery);
      if (target) {
        setStudentId(fromQuery);
        setSelectedClass(target.className || "");
      }
    }
  }, [searchParams, data.students]);

  const roster = useMemo(
    () =>
      data.students
        .filter((s) => (selectedClass ? s.className === selectedClass : true))
        .sort((a, b) =>
          `${a.className}-${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
            `${b.className}-${b.number.padStart(3, "0")}-${b.name}`,
            "ko",
          ),
        ),
    [data.students, selectedClass],
  );

  const student = data.students.find((s) => s.id === studentId);

  const documents = useMemo(
    () =>
      studentId
        ? data.documents.filter((d) => d.studentId === studentId)
        : [],
    [data.documents, studentId],
  );

  const drafts = useMemo(
    () =>
      studentId ? data.drafts.filter((d) => d.studentId === studentId) : [],
    [data.drafts, studentId],
  );

  const studentLabel = student
    ? `${student.className} ${student.number ? `${student.number}번 ` : ""}${student.name}`
    : "";

  const subjectName = (id?: string) => {
    if (!id) return null;
    return (
      data.subjects.find((s) => s.id === id)?.name ??
      data.clubs.find((c) => c.id === id)?.name ??
      null
    );
  };

  /** 영역별 자료를 과목(또는 동아리) 단위로 묶고, 수합 → 근거 순으로 정렬 */
  function groupSectionContent(section: Section) {
    const sectionDocs = documents.filter((d) => d.section === section);
    const sectionDrafts = drafts.filter((d) => d.section === section);
    const keys = [
      ...new Set([
        ...sectionDocs.map((d) => d.subjectId ?? ""),
        ...sectionDrafts.map((d) => d.subjectId ?? ""),
      ]),
    ].sort((a, b) => {
      const an = subjectName(a || undefined) ?? "";
      const bn = subjectName(b || undefined) ?? "";
      return an.localeCompare(bn, "ko");
    });

    return keys.map((key) => {
      const sid = key || undefined;
      const match = (id?: string) => (id ?? "") === key;
      const groupDocs = sectionDocs.filter((d) => match(d.subjectId));
      const groupDrafts = sectionDrafts.filter((d) => match(d.subjectId));
      const mergedDrafts = groupDrafts.filter((d) => !d.documentId);
      const docDrafts = groupDrafts.filter((d) => d.documentId);
      return {
        subjectId: sid,
        name: subjectName(sid),
        mergedDrafts,
        docs: groupDocs,
        docDrafts,
        empty:
          !mergedDrafts.length && !groupDocs.length && !docDrafts.length,
      };
    });
  }

  function buildPlainText() {
    if (!student) return "";
    const lines: string[] = [
      "중등 생기부 교사도우미 · 학생 활동 자료",
      studentLabel,
      `출력일: ${new Date().toLocaleString("ko-KR")}`,
      "",
    ];

    for (const section of SECTION_ORDER) {
      const groups = groupSectionContent(section);
      if (!groups.length || groups.every((g) => g.empty)) continue;

      lines.push(`## ${SECTION_LABELS[section]}`);
      lines.push("");

      for (const group of groups) {
        if (group.empty) continue;
        if (group.name) {
          lines.push(`### ${group.name}`);
          lines.push("");
        }

        if (group.mergedDrafts.length) {
          lines.push("[최종 수합]");
          for (const draft of group.mergedDrafts) {
            const level =
              draft.selected != null
                ? draft.levels?.[draft.selected]
                : undefined;
            lines.push(
              `수합 초안${draft.confirmed ? " [확정]" : ""}${level ? ` [${level}]` : ""}`,
            );
            lines.push(draft.edited.trim() || "(내용 없음)");
            lines.push("");
          }
        }

        if (group.docs.length || group.docDrafts.length) {
          lines.push("[근거 자료]");
          for (const doc of group.docs) {
            lines.push(`문서: ${doc.title || "제목 없음"}`);
            if (doc.text.trim()) {
              lines.push("[학생 작성]");
              lines.push(doc.text.trim());
            }
            if (doc.teacherNote.trim()) {
              lines.push("[교사 메모]");
              lines.push(doc.teacherNote.trim());
            }
            lines.push("");
          }
          for (const draft of group.docDrafts) {
            const level =
              draft.selected != null
                ? draft.levels?.[draft.selected]
                : undefined;
            const docTitle = draft.documentId
              ? data.documents.find((d) => d.id === draft.documentId)?.title
              : null;
            lines.push(
              `문서 초안${docTitle ? ` · ${docTitle}` : ""}${draft.confirmed ? " [확정]" : ""}${level ? ` [${level}]` : ""}`,
            );
            lines.push(draft.edited.trim() || "(내용 없음)");
            lines.push("");
          }
        }
      }
    }

    return lines.join("\n");
  }

  function onDownloadTxt() {
    if (!student) return;
    downloadTextFile(
      `${studentLabel.replace(/\s+/g, "_")}_활동자료.txt`,
      buildPlainText(),
      "text/plain",
    );
  }

  async function onDownloadExcel() {
    if (!student) return;
    const XLSX = await import("xlsx");

    const rows: (string | number)[][] = [
      ["영역", "종류", "제목/과목", "수준", "확정", "학생 작성", "교사 메모"],
    ];

    for (const section of SECTION_ORDER) {
      for (const group of groupSectionContent(section)) {
        if (group.empty) continue;
        const subj = group.name;

        for (const draft of group.mergedDrafts) {
          const level =
            draft.selected != null
              ? draft.levels?.[draft.selected]
              : undefined;
          rows.push([
            SECTION_LABELS[section],
            "최종 수합",
            subj ? `수합 초안 (${subj})` : "수합 초안",
            level ?? "",
            draft.confirmed ? "확정" : "",
            draft.edited.trim() || "(내용 없음)",
            "",
          ]);
        }

        for (const doc of group.docs) {
          rows.push([
            SECTION_LABELS[section],
            "근거 문서",
            `${doc.title || "제목 없음"}${subj ? ` (${subj})` : ""}`,
            "",
            "",
            doc.text.trim(),
            doc.teacherNote.trim(),
          ]);
        }

        for (const draft of group.docDrafts) {
          const level =
            draft.selected != null
              ? draft.levels?.[draft.selected]
              : undefined;
          const docTitle = draft.documentId
            ? data.documents.find((d) => d.id === draft.documentId)?.title
            : null;
          rows.push([
            SECTION_LABELS[section],
            "근거 초안",
            `${docTitle || "문서 초안"}${subj ? ` (${subj})` : ""}`,
            level ?? "",
            draft.confirmed ? "확정" : "",
            draft.edited.trim() || "(내용 없음)",
            "",
          ]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 24 },
      { wch: 6 },
      { wch: 6 },
      { wch: 50 },
      { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "활동자료");
    XLSX.writeFile(wb, `${studentLabel.replace(/\s+/g, "_")}_활동자료.xlsx`);
  }

  function onPrint() {
    window.print();
  }

  function confirmDelete(label: string) {
    return window.confirm(`「${label}」을(를) 삭제할까요?`);
  }

  function onRemoveDocument(id: string, label: string) {
    if (!confirmDelete(label)) return;
    removeDocument(id);
  }

  function onRemoveDraft(id: string, label: string) {
    if (!confirmDelete(label)) return;
    removeDraft(id);
  }

  const hasContent = documents.length > 0 || drafts.length > 0;

  return (
    <AppShell
      title="활동 열람 · 인쇄"
      subtitle="학급을 고르면 왼쪽에 학생 명단이 나오고, 학생을 누르면 오른쪽에 활동 자료가 보입니다."
    >
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* 왼쪽: 학급 + 학생 명단 */}
        <div className="no-print space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card title="학급 · 학생">
            <Field label="학급">
              <select
                className={inputClass}
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setStudentId("");
                }}
              >
                <option value="">전체</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {c === preferredClass ? " (담임)" : ""}
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-3">
              <p className="mb-2 text-[14px] font-medium text-[var(--ink)]">
                학생 명단 ({roster.length})
              </p>
              {roster.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted-48)]">
                  해당 학급의 학생이 없습니다.
                </p>
              ) : (
                <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                  {roster.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentId(s.id);
                          setViewTab("subject");
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          s.id === studentId
                            ? "bg-[var(--primary)] text-white"
                            : "hover:bg-[var(--parchment)]"
                        }`}
                      >
                        <span className="font-medium">
                          {s.number ? `${s.number}. ` : ""}
                          {s.name}
                        </span>
                        {!selectedClass ? (
                          <span
                            className={
                              s.id === studentId
                                ? "text-white/70"
                                : "text-[var(--ink-muted-48)]"
                            }
                          >
                            {s.className}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* 오른쪽: 선택 학생의 활동 */}
        <div>
          {!student ? (
            <Card>
              <p className="text-sm text-[var(--ink-muted-48)]">
                왼쪽 명단에서 학생을 선택하세요.
              </p>
            </Card>
          ) : (
            <>
              <div className="no-print mb-4 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={onPrint}>
                  인쇄 · PDF 저장
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={onDownloadExcel}
                >
                  Excel 내보내기
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={onDownloadTxt}
                >
                  TXT 다운로드
                </button>
              </div>

              <div id="print-area" className="print-area space-y-4">
                <Card>
                  <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    {studentLabel}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ink-muted-48)]">
                    학생 활동 자료 · {new Date().toLocaleString("ko-KR")}
                  </p>
                </Card>

                <SegmentedTabs
                  className="no-print"
                  tabs={SECTION_ORDER.map((section) => ({
                    id: section,
                    label: SECTION_LABELS[section],
                  }))}
                  value={viewTab}
                  onChange={setViewTab}
                />

                {SECTION_ORDER.map((section) => {
                  const groups = groupSectionContent(section);
                  const empty =
                    !groups.length || groups.every((g) => g.empty);

                  return (
                    <div
                      key={section}
                      className={
                        viewTab === section
                          ? "block"
                          : "hidden print:block"
                      }
                    >
                      <Card title={SECTION_LABELS[section]}>
                        {empty ? (
                          <p className="text-sm text-[var(--ink-muted-48)]">
                            이 영역의 자료가 없습니다.
                          </p>
                        ) : (
                          <div className="space-y-6">
                            {groups.map((group) => {
                              if (group.empty) return null;
                              const subj = group.name;
                              return (
                                <div
                                  key={`${section}_${group.subjectId ?? "none"}`}
                                  className="space-y-3"
                                >
                                  {subj ? (
                                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                                      {subj}
                                    </h3>
                                  ) : null}

                                  {group.mergedDrafts.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted-48)]">
                                        최종 수합
                                      </p>
                                      {group.mergedDrafts.map((draft) => {
                                        const level =
                                          draft.selected != null
                                            ? draft.levels?.[draft.selected]
                                            : undefined;
                                        return (
                                          <div
                                            key={draft.id}
                                            className={`rounded-xl border p-3 ${
                                              draft.confirmed
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-[var(--primary)]/30 bg-[var(--primary)]/5"
                                            }`}
                                          >
                                            <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                                              <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="font-semibold text-[var(--ink)]">
                                                  수합 초안
                                                </span>
                                                {level ? (
                                                  <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-white">
                                                    {level}
                                                  </span>
                                                ) : null}
                                                {draft.confirmed ? (
                                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-white">
                                                    확정
                                                  </span>
                                                ) : null}
                                              </div>
                                              <button
                                                type="button"
                                                className="no-print shrink-0 text-xs text-rose-600"
                                                onClick={() =>
                                                  onRemoveDraft(
                                                    draft.id,
                                                    "수합 초안",
                                                  )
                                                }
                                              >
                                                삭제
                                              </button>
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                                              {draft.edited || "(내용 없음)"}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}

                                  {group.docs.length > 0 ||
                                  group.docDrafts.length > 0 ? (
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted-48)]">
                                        근거 자료
                                      </p>
                                      {group.docs.map((doc) => {
                                        const label = doc.title || "문서";
                                        return (
                                          <div
                                            key={doc.id}
                                            className="rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] p-3"
                                          >
                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                              <strong className="text-sm">
                                                {label}
                                              </strong>
                                              <button
                                                type="button"
                                                className="no-print text-xs text-rose-600"
                                                onClick={() =>
                                                  onRemoveDocument(
                                                    doc.id,
                                                    label,
                                                  )
                                                }
                                              >
                                                삭제
                                              </button>
                                            </div>
                                            {doc.text.trim() ? (
                                              <div className="mt-2">
                                                <p className="text-xs font-semibold text-[var(--ink-muted-48)]">
                                                  학생 작성
                                                </p>
                                                <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                                                  {doc.text}
                                                </p>
                                              </div>
                                            ) : null}
                                            {doc.teacherNote.trim() ? (
                                              <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5">
                                                <p className="text-xs font-semibold text-amber-800">
                                                  교사 메모
                                                </p>
                                                <p className="whitespace-pre-wrap text-sm text-amber-950">
                                                  {doc.teacherNote}
                                                </p>
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })}

                                      {group.docDrafts.map((draft) => {
                                        const level =
                                          draft.selected != null
                                            ? draft.levels?.[draft.selected]
                                            : undefined;
                                        const docTitle = draft.documentId
                                          ? data.documents.find(
                                              (d) =>
                                                d.id === draft.documentId,
                                            )?.title
                                          : null;
                                        const label = `문서 초안${docTitle ? ` · ${docTitle}` : ""}`;
                                        return (
                                          <div
                                            key={draft.id}
                                            className={`rounded-xl border p-3 ${
                                              draft.confirmed
                                                ? "border-emerald-300 bg-emerald-50"
                                                : "border-[var(--primary)]/30 bg-[var(--primary)]/5"
                                            }`}
                                          >
                                            <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                                              <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="font-semibold text-[var(--ink)]">
                                                  {label}
                                                </span>
                                                {level ? (
                                                  <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-white">
                                                    {level}
                                                  </span>
                                                ) : null}
                                                {draft.confirmed ? (
                                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-white">
                                                    확정
                                                  </span>
                                                ) : null}
                                              </div>
                                              <button
                                                type="button"
                                                className="no-print shrink-0 text-xs text-rose-600"
                                                onClick={() =>
                                                  onRemoveDraft(
                                                    draft.id,
                                                    label,
                                                  )
                                                }
                                              >
                                                삭제
                                              </button>
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                                              {draft.edited || "(내용 없음)"}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })}

                {!hasContent ? (
                  <div className="no-print">
                    <Card>
                      <p className="text-sm text-[var(--ink-muted-48)]">
                        이 학생의 활동 자료가 아직 없습니다.
                      </p>
                    </Card>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="활동 열람 · 인쇄" subtitle="불러오는 중…">
          <Card>
            <p className="text-sm text-[var(--ink-muted-48)]">
              잠시만 기다려 주세요.
            </p>
          </Card>
        </AppShell>
      }
    >
      <ReportPageInner />
    </Suspense>
  );
}
