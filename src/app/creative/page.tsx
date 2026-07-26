"use client";

import { useMemo, useState } from "react";
import { ClassExcelPanel } from "@/components/ClassExcelPanel";
import { CreativeDraftPanel } from "@/components/CreativeDraftPanel";
import { DocumentPanel } from "@/components/DocumentPanel";
import { OfficerPanel } from "@/components/OfficerPanel";
import { StudentPicker } from "@/components/StudentPicker";
import {
  AppShell,
  Card,
  Field,
  SegmentedTabs,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import {
  ACTIVITY_CATEGORIES,
  SECTION_LABELS,
  type ActivityCategory,
} from "@/lib/types";
import { parseScheduleCsv } from "@/lib/utils";

type ScheduleFilter = "all" | ActivityCategory;

const SAMPLE_SCHEDULE_ROWS = [
  {
    date: "2026-03-05",
    category: "자율",
    title: "학급회의",
    note: "반장 선출",
  },
  {
    date: "2026-04-12",
    category: "진로",
    title: "진로체험의 날",
    note: "직업인 초청",
  },
  {
    date: "2026-05-20",
    category: "봉사",
    title: "교내 환경정화",
    note: "운동장 주변",
  },
];

export default function CreativePage() {
  const {
    data,
    setScheduleItems,
    addScheduleItem,
    updateScheduleItem,
    removeScheduleItem,
    toggleScheduleCheck,
    setScheduleObservation,
    applySchedulesToAllStudents,
  } = useAppStore();
  const homeroom = data.settings.teacherClassName?.trim() || null;
  const [studentId, setStudentId] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    date: string;
    category: ActivityCategory;
    title: string;
    note: string;
  } | null>(null);
  const [tab, setTab] = useState<ActivityCategory>("autonomy");
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("all");
  const [setupTab, setSetupTab] = useState<"form" | "excel">("form");
  const [workTab, setWorkTab] = useState<
    "schedule" | "officers" | "documents" | "drafts"
  >("schedule");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<{
    date: string;
    category: ActivityCategory;
    title: string;
    note: string;
  }>({
    date: "",
    category: "autonomy",
    title: "",
    note: "",
  });

  const items = useMemo(() => {
    const list =
      scheduleFilter === "all"
        ? [...data.scheduleItems]
        : data.scheduleItems.filter((item) => item.category === scheduleFilter);
    return list.sort((a, b) =>
      `${a.date}-${a.category}-${a.title}`.localeCompare(
        `${b.date}-${b.category}-${b.title}`,
        "ko",
      ),
    );
  }, [data.scheduleItems, scheduleFilter]);

  async function onDownloadScheduleExcel() {
    setBusy(true);
    setMessage("");
    try {
      const { Workbook } = await import("exceljs");
      const wb = new Workbook();
      const ws = wb.addWorksheet("학교일정", {
        views: [{ state: "frozen", ySplit: 2 }],
      });
      ws.columns = [
        { key: "date", width: 14 },
        { key: "category", width: 10 },
        { key: "title", width: 28 },
        { key: "note", width: 36 },
      ];

      ws.mergeCells("A1:D1");
      const titleCell = ws.getCell("A1");
      titleCell.value = "창의적 체험활동 · 학교 일정 양식";
      titleCell.font = {
        name: "맑은 고딕",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0066CC" },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 30;

      const headers = ["날짜", "구분", "활동명", "비고"];
      const headerRow = ws.getRow(2);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: "맑은 고딕", size: 11, bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F7" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      });

      const rows =
        data.scheduleItems.length > 0
          ? data.scheduleItems.map((item) => ({
              date: item.date,
              category: SECTION_LABELS[item.category],
              title: item.title,
              note: item.note,
            }))
          : SAMPLE_SCHEDULE_ROWS;

      for (const rowData of rows) {
        const row = ws.addRow(rowData);
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.font = { name: "맑은 고딕", size: 10 };
          cell.alignment = {
            vertical: "middle",
            horizontal: col <= 2 ? "center" : "left",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFF0F0F0" } },
            bottom: { style: "thin", color: { argb: "FFF0F0F0" } },
            left: { style: "thin", color: { argb: "FFF0F0F0" } },
            right: { style: "thin", color: { argb: "FFF0F0F0" } },
          };
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.scheduleItems.length
        ? "창체_학교일정.xlsx"
        : "창체_학교일정_양식.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setMessage(
        data.scheduleItems.length
          ? `등록된 일정 ${data.scheduleItems.length}개를 엑셀로 내려받았습니다.`
          : "빈 학교 일정 양식(엑셀)을 내려받았습니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "다운로드 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setMessage("");
    try {
      const lower = file.name.toLowerCase();
      let text = "";
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(sheet);
      } else {
        text = await file.text();
      }

      const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
      const headerIdx = lines.findIndex((line) =>
        line.split(",").some((cell) => cell.replace(/"/g, "").trim() === "날짜"),
      );
      const csv =
        headerIdx >= 0
          ? [lines[headerIdx], ...lines.slice(headerIdx + 1)]
              .filter((line) => line.trim())
              .join("\n")
          : text;

      const items = parseScheduleCsv(csv);
      if (!items.length) {
        setMessage("일정 항목을 찾지 못했습니다. 열: 날짜, 구분, 활동명, 비고");
        return;
      }
      setScheduleItems(items);
      const applied = applySchedulesToAllStudents();
      setMessage(
        `${items.length}개 학교 일정을 등록했고, 전체 학생 ${data.students.length}명에게 반영했습니다.` +
          (applied ? ` (신규 체크 ${applied}건)` : ""),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  function onApplyToAll() {
    if (!data.scheduleItems.length) {
      setMessage("먼저 학교 일정을 등록하세요.");
      return;
    }
    if (!data.students.length) {
      setMessage("등록된 학생이 없습니다.");
      return;
    }
    if (
      !window.confirm(
        `등록된 학교 일정 ${data.scheduleItems.length}개를 전체 학생 ${data.students.length}명의 참여 일정으로 반영할까요?`,
      )
    ) {
      return;
    }
    const applied = applySchedulesToAllStudents();
    setMessage(
      `전체 학생에게 학교 일정을 반영했습니다.` +
        (applied ? ` (신규 체크 ${applied}건)` : " (이미 모두 반영됨)"),
    );
  }

  return (
    <AppShell
      title="창의적 체험활동"
      subtitle={
        homeroom
          ? `담임학급 «${homeroom}» 학생만 표시됩니다. 학교 일정을 올리고 참여 활동을 체크하세요.`
          : "자율·진로·봉사를 한 화면에서 작성합니다. 학교 일정을 올리고 참여 활동을 체크하세요."
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card title="학생">
            <StudentPicker
              value={studentId}
              onChange={setStudentId}
              lockClassName={homeroom}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <SegmentedTabs
            tabs={[
              { id: "form", label: "학교 일정 양식" },
              { id: "excel", label: "반별 엑셀" },
            ]}
            value={setupTab}
            onChange={setSetupTab}
          />

          {setupTab === "form" ? (
            <Card
              title="학교 일정 양식"
              actions={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => void onDownloadScheduleExcel()}
                  >
                    엑셀 다운로드
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy || !data.scheduleItems.length}
                    onClick={onApplyToAll}
                  >
                    전체 학생에게 반영
                  </button>
                </div>
              }
            >
              <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
                학교 일정은 전교 공용입니다. 등록·업로드하면 전체 학생 일정
                체크에 바로 반영됩니다.
              </p>
              <Field
                label="일정 엑셀 업로드"
                hint="열: 날짜, 구분(자율/진로/봉사), 활동명, 비고 · .xlsx 권장"
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className={inputClass}
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUpload(file);
                    e.target.value = "";
                  }}
                />
              </Field>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="날짜">
                  <input
                    type="date"
                    className={inputClass}
                    value={manual.date}
                    onChange={(e) =>
                      setManual((m) => ({ ...m, date: e.target.value }))
                    }
                  />
                </Field>
                <Field label="구분">
                  <select
                    className={inputClass}
                    value={manual.category}
                    onChange={(e) => {
                      const category = e.target.value as ActivityCategory;
                      setManual((m) => ({ ...m, category }));
                      setTab(category);
                      setScheduleFilter(category);
                    }}
                  >
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {SECTION_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="활동명">
                  <input
                    className={inputClass}
                    placeholder="활동명"
                    value={manual.title}
                    onChange={(e) =>
                      setManual((m) => ({ ...m, title: e.target.value }))
                    }
                  />
                </Field>
                <Field label="비고">
                  <input
                    className={inputClass}
                    placeholder="비고"
                    value={manual.note}
                    onChange={(e) =>
                      setManual((m) => ({ ...m, note: e.target.value }))
                    }
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    className={`${btnPrimary} w-full`}
                    onClick={() => {
                      if (!manual.title.trim()) {
                        setMessage("활동명을 입력하세요.");
                        return;
                      }
                      addScheduleItem({
                        date: manual.date.trim(),
                        category: manual.category,
                        title: manual.title.trim(),
                        note: manual.note.trim(),
                      });
                      applySchedulesToAllStudents();
                      setTab(manual.category);
                      setScheduleFilter(manual.category);
                      setManual((m) => ({
                        ...m,
                        date: "",
                        title: "",
                        note: "",
                      }));
                      setMessage(
                        `${SECTION_LABELS[manual.category]} 일정을 추가하고 전체 학생에게 반영했습니다.`,
                      );
                    }}
                  >
                    일정 추가
                  </button>
                </div>
              </div>
              {message ? (
                <p className="mt-2 text-sm text-[var(--ink-muted-80)]">
                  {message}
                </p>
              ) : null}
            </Card>
          ) : (
            <ClassExcelPanel section={tab} lockClassName={homeroom} />
          )}

          {!studentId ? (
            <Card>
              <p className="text-sm text-[var(--ink-muted-48)]">
                왼쪽 명단에서 학생을 선택하면 일정 체크·문서·초안을 작성할 수
                있습니다.
              </p>
            </Card>
          ) : (
            <>
              <SegmentedTabs
                tabs={[
                  { id: "schedule", label: "일정 체크" },
                  { id: "officers", label: "임원(자율)" },
                  { id: "documents", label: "학생 문서" },
                  { id: "drafts", label: "초안 생성" },
                ]}
                value={workTab}
                onChange={setWorkTab}
              />

              {workTab === "officers" ? (
                <OfficerPanel studentId={studentId} />
              ) : null}

              {workTab === "schedule" ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleFilter("all")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-95 ${
                        scheduleFilter === "all"
                          ? "bg-[var(--primary)] text-white"
                          : "border border-[var(--hairline)] bg-white text-[var(--ink)]"
                      }`}
                    >
                      전체
                    </button>
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setScheduleFilter(cat);
                          setTab(cat);
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-95 ${
                          scheduleFilter === cat
                            ? "bg-[var(--primary)] text-white"
                            : "border border-[var(--hairline)] bg-white text-[var(--ink)]"
                        }`}
                      >
                        {SECTION_LABELS[cat]}
                      </button>
                    ))}
                  </div>

                  <Card
                    title={
                      scheduleFilter === "all"
                        ? `전체 일정 체크 (${items.length})`
                        : `${SECTION_LABELS[scheduleFilter]} 일정 체크 (${items.length})`
                    }
                  >
                    {items.length === 0 ? (
                      <p className="text-sm text-[var(--ink-muted-48)]">
                        {scheduleFilter === "all"
                          ? "등록된 일정이 없습니다. 학교 일정 양식 탭에서 추가하세요."
                          : "이 영역의 일정이 없습니다. 양식을 업로드하거나 직접 추가하세요."}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {items.map((item) => {
                          const checked = data.scheduleChecks.some(
                            (c) =>
                              c.studentId === studentId &&
                              c.scheduleItemId === item.id,
                          );
                          if (editing?.id === item.id) {
                            return (
                              <li
                                key={item.id}
                                className="rounded-xl border border-[var(--primary)] px-3 py-3"
                              >
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  <input
                                    type="date"
                                    className={inputClass}
                                    value={editing.date}
                                    onChange={(e) =>
                                      setEditing((s) =>
                                        s ? { ...s, date: e.target.value } : s,
                                      )
                                    }
                                  />
                                  <select
                                    className={inputClass}
                                    value={editing.category}
                                    onChange={(e) =>
                                      setEditing((s) =>
                                        s
                                          ? {
                                              ...s,
                                              category: e.target
                                                .value as ActivityCategory,
                                            }
                                          : s,
                                      )
                                    }
                                  >
                                    {ACTIVITY_CATEGORIES.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {SECTION_LABELS[cat]}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    className={inputClass}
                                    placeholder="활동명"
                                    value={editing.title}
                                    onChange={(e) =>
                                      setEditing((s) =>
                                        s ? { ...s, title: e.target.value } : s,
                                      )
                                    }
                                  />
                                  <input
                                    className={inputClass}
                                    placeholder="비고"
                                    value={editing.note}
                                    onChange={(e) =>
                                      setEditing((s) =>
                                        s ? { ...s, note: e.target.value } : s,
                                      )
                                    }
                                  />
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    className={btnPrimary}
                                    onClick={() => {
                                      if (!editing.title.trim()) {
                                        setMessage("활동명을 입력하세요.");
                                        return;
                                      }
                                      updateScheduleItem(item.id, {
                                        date: editing.date.trim(),
                                        category: editing.category,
                                        title: editing.title.trim(),
                                        note: editing.note.trim(),
                                      });
                                      setEditing(null);
                                      setMessage(
                                        "일정을 수정했습니다. 전체 학생에게 반영됩니다.",
                                      );
                                    }}
                                  >
                                    저장
                                  </button>
                                  <button
                                    type="button"
                                    className={btnSecondary}
                                    onClick={() => setEditing(null)}
                                  >
                                    취소
                                  </button>
                                </div>
                              </li>
                            );
                          }
                          return (
                            <li
                              key={item.id}
                              className="rounded-xl border border-[var(--hairline)] px-3 py-2"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <label className="flex flex-1 cursor-pointer gap-3 text-sm">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={checked}
                                    onChange={() =>
                                      toggleScheduleCheck(studentId, item.id)
                                    }
                                  />
                                  <span>
                                    {scheduleFilter === "all" ? (
                                      <span className="mr-2 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs text-[var(--primary)]">
                                        {SECTION_LABELS[item.category]}
                                      </span>
                                    ) : null}
                                    <span className="font-medium text-[var(--ink)]">
                                      {[item.date, item.title]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                    {item.note ? (
                                      <span className="mt-0.5 block text-[var(--ink-muted-48)]">
                                        {item.note}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="text-xs text-[var(--primary)]"
                                    onClick={() =>
                                      setEditing({
                                        id: item.id,
                                        date: item.date,
                                        category: item.category,
                                        title: item.title,
                                        note: item.note,
                                      })
                                    }
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-rose-600"
                                    onClick={() => removeScheduleItem(item.id)}
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                              {checked ? (
                                <div className="mt-2 ml-7">
                                  <Field
                                    label="교사 관찰"
                                    hint="참여도, 협력도, 역할, 행동 특성, 실적 등 관찰한 내용을 적으면 특기사항 생성에 반영됩니다."
                                  >
                                    <textarea
                                      className={`${inputClass} min-h-16`}
                                      placeholder="예: 의견 조율 역할을 맡아 모둠 토의를 진행함. 다른 학생 발언을 경청하고 합의안을 정리함."
                                      value={
                                        data.scheduleChecks.find(
                                          (c) =>
                                            c.studentId === studentId &&
                                            c.scheduleItemId === item.id,
                                        )?.observation ?? ""
                                      }
                                      onChange={(e) =>
                                        setScheduleObservation(
                                          studentId,
                                          item.id,
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </>
              ) : null}

              {workTab === "documents" ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTab(cat)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-95 ${
                          tab === cat
                            ? "bg-[var(--primary)] text-white"
                            : "border border-[var(--hairline)] bg-white text-[var(--ink)]"
                        }`}
                      >
                        {SECTION_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                  <DocumentPanel studentId={studentId} section={tab} />
                </>
              ) : null}

              {workTab === "drafts" ? (
                <CreativeDraftPanel studentId={studentId} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
