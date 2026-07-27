"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getDraftText } from "@/lib/draftText";
import { SECTION_LABELS, type Section } from "@/lib/types";
import { btnPrimary, btnSecondary, Card, Field, inputClass } from "./ui";

/** 반별 학생 자료를 엑셀로 내려받고, 채워서 다시 올리는 패널 */
export function ClassExcelPanel({
  section,
  subjectId,
  subjectName,
  lockClassName,
}: {
  section: Section;
  subjectId?: string;
  subjectName?: string;
  /** 지정하면 이 학급만 대상으로 하고 학급 선택을 잠금 */
  lockClassName?: string | null;
}) {
  const { data, importDocuments } = useAppStore();
  const preferredClass = data.settings.teacherClassName;
  const locked = Boolean(lockClassName);
  const [className, setClassName] = useState(
    lockClassName ?? preferredClass ?? "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const classes = useMemo(() => {
    const list = [
      ...new Set(data.students.map((s) => s.className).filter(Boolean)),
    ];
    if (preferredClass && !list.includes(preferredClass)) {
      list.push(preferredClass);
    }
    return list.sort((a, b) => {
      if (preferredClass) {
        if (a === preferredClass) return -1;
        if (b === preferredClass) return 1;
      }
      return a.localeCompare(b, "ko");
    });
  }, [data.students, preferredClass]);

  useEffect(() => {
    if (lockClassName) {
      setClassName(lockClassName);
      return;
    }
    if (preferredClass && (!className || !classes.includes(className))) {
      setClassName(preferredClass);
    }
  }, [lockClassName, preferredClass, classes, className]);

  const sectionLabel =
    SECTION_LABELS[section] + (subjectName ? ` (${subjectName})` : "");

  async function onDownload() {
    if (!className) {
      setMessage("학급을 선택하세요.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const students = data.students
        .filter((s) => s.className === className)
        .sort((a, b) =>
          `${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
            `${b.number.padStart(3, "0")}-${b.name}`,
            "ko",
          ),
        );

      function docsForStudent(studentId: string) {
        return data.documents.filter(
          (doc) =>
            doc.studentId === studentId &&
            doc.section === section &&
            (subjectId ? doc.subjectId === subjectId : true),
        );
      }

      function draftsForStudent(studentId: string) {
        return data.drafts.filter(
          (draft) =>
            draft.studentId === studentId &&
            draft.section === section &&
            (subjectId ? draft.subjectId === subjectId : !draft.subjectId),
        );
      }

      function draftForDocument(studentId: string, documentId: string) {
        return draftsForStudent(studentId).find(
          (d) => d.documentId === documentId,
        );
      }

      const includeData = students.some((student) => {
        const docs = docsForStudent(student.id);
        if (
          docs.some(
            (doc) =>
              doc.text.trim() ||
              doc.teacherNote.trim() ||
              doc.title.trim(),
          )
        ) {
          return true;
        }
        return docs.some((doc) =>
          Boolean(getDraftText(draftForDocument(student.id, doc.id))),
        );
      });

      const { Workbook } = await import("exceljs");
      const wb = new Workbook();
      const ws = wb.addWorksheet("학생자료", {
        views: [{ state: "frozen", ySplit: 2 }],
      });

      ws.columns = [
        { key: "number", width: 7 },
        { key: "name", width: 12 },
        { key: "title", width: 22 },
        { key: "text", width: 60 },
        { key: "note", width: 36 },
        { key: "final", width: 60 },
      ];

      ws.mergeCells("A1:F1");
      const titleCell = ws.getCell("A1");
      titleCell.value = includeData
        ? `${className}반 · ${sectionLabel} 학생 자료`
        : `${className}반 · ${sectionLabel} 입력 양식`;
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

      const headers = [
        "번호",
        "이름",
        "수행과제(문서 제목)",
        "학생 작성 내용",
        "교사 메모",
        "항목별 초안(문서별·업로드 시 무시)",
      ];
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
      headerRow.height = 22;

      function styleDataRow(row: import("exceljs").Row) {
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.font = { name: "맑은 고딕", size: 10 };
          cell.alignment = {
            vertical: "top",
            horizontal: col <= 2 ? "center" : "left",
            wrapText: col >= 3,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFF0F0F0" } },
            bottom: { style: "thin", color: { argb: "FFF0F0F0" } },
            left: { style: "thin", color: { argb: "FFF0F0F0" } },
            right: { style: "thin", color: { argb: "FFF0F0F0" } },
          };
        });
      }

      for (const student of students) {
        // 배열로 넣어 key 매핑 누락으로 교사메모·초안이 비는 문제를 방지
        const pushRow = (
          title: string,
          text: string,
          note: string,
          final: string,
        ) => {
          const row = ws.addRow([
            student.number,
            student.name,
            title,
            text,
            note,
            final,
          ]);
          styleDataRow(row);
        };

        if (!includeData) {
          pushRow("", "", "", "");
          continue;
        }

        const docs = docsForStudent(student.id);

        if (docs.length) {
          docs.forEach((doc) => {
            const itemDraft = getDraftText(
              draftForDocument(student.id, doc.id),
            );
            pushRow(doc.title, doc.text, doc.teacherNote, itemDraft);
          });
        } else {
          pushRow("", "", "", "");
        }
      }

      if (students.length === 0) {
        for (let i = 0; i < 10; i++) {
          const row = ws.addRow(["", "", "", "", "", ""]);
          styleDataRow(row);
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeLabel = sectionLabel.replace(/[\\/:*?"<>| ]+/g, "_");
      a.download = includeData
        ? `${className}_${safeLabel}_학생자료.xlsx`
        : `${className}_${safeLabel}_입력양식.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(
        includeData
          ? `${className}반 ${students.length}명의 자료(교사 메모·문서별 초안 포함)를 내려받았습니다.`
          : `${className}반 자료가 없어 빈 입력 양식을 내려받았습니다.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "다운로드 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    if (!className) {
      setMessage("업로드할 학급을 먼저 선택하세요.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        defval: "",
      });

      const headerIdx = grid.findIndex((row) =>
        row.some((cell) => String(cell).trim() === "이름"),
      );
      if (headerIdx < 0) {
        throw new Error("'이름' 열이 있는 헤더 행을 찾지 못했습니다.");
      }
      const header = grid[headerIdx].map((c) => String(c).trim());
      const col = (aliases: string[]) =>
        header.findIndex((h) => aliases.some((a) => h.includes(a)));
      const numberCol = col(["번호"]);
      const nameCol = col(["이름"]);
      const titleCol = col(["수행과제", "문서 제목", "제목"]);
      const textCol = col(["학생 작성", "내용"]);
      const noteCol = col(["교사 메모", "메모"]);

      if (nameCol < 0 || textCol < 0) {
        throw new Error("'이름'과 '학생 작성 내용' 열이 필요합니다.");
      }

      const rows = grid
        .slice(headerIdx + 1)
        .map((row) => ({
          className,
          number: numberCol >= 0 ? String(row[numberCol] ?? "").trim() : "",
          name: String(row[nameCol] ?? "").trim(),
          title: titleCol >= 0 ? String(row[titleCol] ?? "").trim() : "",
          text: String(row[textCol] ?? "").trim(),
          teacherNote: noteCol >= 0 ? String(row[noteCol] ?? "").trim() : "",
        }))
        .filter((r) => r.name);

      if (!rows.length) {
        throw new Error("반영할 행이 없습니다.");
      }

      const result = importDocuments({ section, subjectId, rows });
      setMessage(
        `업로드 완료: 문서 ${result.added}개 추가, ${result.updated}개 갱신` +
          (result.newStudents ? `, 학생 ${result.newStudents}명 신규 등록` : ""),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card title="반별 자료 엑셀 업로드 · 다운로드">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="학급">
          {locked ? (
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] px-3 py-2 text-sm">
              <span className="font-semibold text-[var(--ink)]">
                {lockClassName}
              </span>
              <span className="text-[var(--ink-muted-48)]"> (담임)</span>
            </div>
          ) : (
            <select
              className={inputClass}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            >
              <option value="">학급 선택</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {c === preferredClass ? " (담임)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label={`${sectionLabel} 자료`}
          hint="다운로드 시 해당 학급의 학생 작성·교사 메모·문서별 초안을 함께 채웁니다. 전체 수합 초안은 포함하지 않습니다. 자료가 없으면 번호·이름만 있는 빈 양식을 내려줍니다."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || !className}
              onClick={() => void onDownload()}
            >
              {busy ? "처리 중…" : "엑셀 다운로드"}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy || !className}
              onClick={() => fileRef.current?.click()}
            >
              엑셀 업로드
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
              }}
            />
          </div>
        </Field>
      </div>
      {message ? (
        <p className="mt-2 text-sm text-[var(--ink-muted-80)]">{message}</p>
      ) : null}
    </Card>
  );
}
