"use client";

import { useEffect, useMemo, useState } from "react";
import { findDocuments, useAppStore } from "@/lib/store";
import { collectDocumentMergePieces } from "@/lib/draftText";
import { SECTION_LABELS, type Section } from "@/lib/types";
import { orderCredentials } from "@/lib/utils";
import { btnPrimary, Card, Field, inputClass } from "./ui";

/** 반 학생 전원에 대해 문서별 초안을 수합해 최종 초안 생성 */
export function ClassDraftMergePanel({
  section,
  subjectId,
  subjectName,
  lockClassName,
}: {
  section: Section;
  subjectId?: string;
  subjectName?: string;
  lockClassName?: string | null;
}) {
  const { data, upsertDraft, adjustApiKeyPriority } = useAppStore();
  const preferredClass = data.settings.teacherClassName;
  const locked = Boolean(lockClassName);
  const [className, setClassName] = useState(
    lockClassName ?? preferredClass ?? "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  const roster = useMemo(
    () =>
      data.students
        .filter((s) => s.className === className)
        .sort((a, b) =>
          `${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
            `${b.number.padStart(3, "0")}-${b.name}`,
            "ko",
          ),
        ),
    [data.students, className],
  );

  const mergeableCount = useMemo(() => {
    if (!className) return 0;
    return roster.filter((student) => {
      const docs = findDocuments(
        data.documents,
        student.id,
        section,
        subjectId,
      );
      return collectDocumentMergePieces(
        docs,
        data.drafts,
        student.id,
        section,
        subjectId,
      ).length > 0;
    }).length;
  }, [roster, data.documents, data.drafts, section, subjectId, className]);

  async function mergeClass() {
    if (!className) {
      setMessage("학급을 선택하세요.");
      return;
    }
    const credentials = orderCredentials(
      data.settings.apiKeys,
      data.settings.activeApiKeyId,
    );
    if (!credentials.length) {
      setMessage("설정에서 API 키를 등록하세요.");
      return;
    }
    if (!mergeableCount) {
      setMessage(
        "수합할 문서별 초안이 있는 학생이 없습니다. 각 학생의 문서별 초안을 먼저 생성·확정하세요.",
      );
      return;
    }

    setBusy(true);
    setMessage("");
    let ok = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      for (const student of roster) {
        const documents = findDocuments(
          data.documents,
          student.id,
          section,
          subjectId,
        );
        const usePieces = collectDocumentMergePieces(
          documents,
          data.drafts,
          student.id,
          section,
          subjectId,
        );
        if (!usePieces.length) {
          skipped += 1;
          continue;
        }

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section,
            subjectName,
            documents: usePieces.map((p) => ({
              title: p.level ? `${p.title} (${p.level})` : p.title,
              text: p.text,
              teacherNote: "",
            })),
            mergeMode: true,
            charLimit: data.settings.charLimits[section],
            credentials,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          errors.push(`${student.name}: ${json.error || "수합 실패"}`);
          continue;
        }
        if (json.used?.id) {
          adjustApiKeyPriority(json.used.id, json.failedIds ?? []);
        }
        upsertDraft({
          studentId: student.id,
          section,
          subjectId,
          options: json.drafts,
          levels: json.levels,
          provider: json.used?.provider,
          model: json.used?.model,
        });
        ok += 1;
      }

      if (errors.length) {
        setMessage(
          `완료: ${ok}명 수합, ${skipped}명 건너뜀. 실패 ${errors.length}명 — ${errors.slice(0, 3).join(" / ")}${errors.length > 3 ? " …" : ""}`,
        );
      } else {
        setMessage(
          `${className}반 ${ok}명의 최종 초안을 생성했습니다.${skipped ? ` (초안 없음 ${skipped}명 건너뜀)` : ""}`,
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "일괄 수합 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="반 전체 초안 수합">
      <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
        선택한 학급 학생마다 문서별 초안을 모아 «전체 초안 수합하여 최종 초안
        생성»과 같은 방식으로 최종 특기사항을 만듭니다. 학생별로 문서별 초안이
        있어야 합니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="학급">
          {locked ? (
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] px-3 py-2 text-sm">
              <span className="font-semibold text-[var(--ink)]">
                {lockClassName}
              </span>
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
        <Field label={sectionLabel}>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !className || mergeableCount === 0}
            onClick={() => void mergeClass()}
          >
            {busy
              ? "반 전체 수합 중…"
              : `반 전체 초안 수합하여 최종 초안 생성 (${mergeableCount}/${roster.length})`}
          </button>
        </Field>
      </div>
      {message ? (
        <p className="mt-2 text-sm text-[var(--ink-muted-80)]">{message}</p>
      ) : null}
    </Card>
  );
}
