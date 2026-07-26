"use client";

import { useMemo, useState } from "react";
import { findDraft, useAppStore } from "@/lib/store";
import type { Draft, Section, StudentDoc } from "@/lib/types";
import { DRAFT_LEVEL_HINTS, PROVIDER_LABELS } from "@/lib/types";
import { orderCredentials } from "@/lib/utils";
import {
  btnPrimary,
  btnSecondary,
  Field,
  inputClass,
} from "./ui";

/** 단일 학생 문서에 대해 초안 생성·선택·수정·확정 */
export function PerDocumentDraft({
  studentId,
  section,
  subjectId,
  subjectName,
  doc,
}: {
  studentId: string;
  section: Section;
  subjectId?: string;
  subjectName?: string;
  doc: StudentDoc;
}) {
  const {
    data,
    upsertDraft,
    selectDraftOption,
    editDraft,
    confirmDraft,
  } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const draft = useMemo(
    () => findDraft(data.drafts, studentId, section, subjectId, doc.id),
    [data.drafts, studentId, section, subjectId, doc.id],
  );

  const credentials = useMemo(
    () =>
      orderCredentials(data.settings.apiKeys, data.settings.activeApiKeyId),
    [data.settings.apiKeys, data.settings.activeApiKeyId],
  );

  async function onGenerate() {
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    if (!doc.text.trim() && !doc.teacherNote.trim()) {
      setError("문서 본문 또는 교사 메모가 필요합니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          subjectName,
          documents: [
            {
              title: doc.title,
              text: doc.text,
              teacherNote: doc.teacherNote,
            },
          ],
          charLimit: data.settings.charLimits[section],
          credentials,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "생성 실패");
      upsertDraft({
        studentId,
        section,
        subjectId,
        documentId: doc.id,
        options: json.drafts as string[],
        levels: json.levels as Draft["levels"],
        provider: json.used?.provider,
        model: json.used?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-[18px] border border-[var(--hairline)] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            이 문서 초안
          </p>
          <p className="text-xs text-[var(--ink-muted-48)]">
            건별로 최상·상·중·하 초안을 만들고 확정할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          disabled={busy}
          onClick={() => void onGenerate()}
        >
          {busy ? "생성 중…" : draft ? "초안 다시 생성" : "초안 생성"}
        </button>
      </div>

      {error ? (
        <p className="mb-3 whitespace-pre-wrap rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {!draft ? (
        <p className="text-sm text-[var(--ink-muted-48)]">
          아직 초안이 없습니다. «초안 생성»을 눌러 주세요.
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
}

export function DocumentDraftEditor({
  draft,
  onSelect,
  onEdit,
  onConfirm,
}: {
  draft: Draft;
  onSelect: (index: number) => void;
  onEdit: (text: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {draft.options.map((option, index) => {
          const level = draft.levels?.[index];
          return (
            <button
              key={`${draft.id}_${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                draft.selected === index
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--hairline)] hover:border-[var(--primary)]/40"
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
              <p className="line-clamp-4 whitespace-pre-wrap text-[var(--ink-muted-80)]">
                {option}
              </p>
            </button>
          );
        })}
      </div>
      <Field label="선택한 문서 초안 수정">
        <textarea
          className={`${inputClass} min-h-24`}
          value={draft.edited}
          onChange={(e) => onEdit(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={draft.confirmed ? btnSecondary : btnPrimary}
          onClick={onConfirm}
        >
          {draft.confirmed ? "문서 초안 확정됨" : "문서 초안 확정"}
        </button>
        {draft.provider ? (
          <span className="text-xs text-[var(--ink-muted-48)]">
            {PROVIDER_LABELS[draft.provider]}
            {draft.model ? ` / ${draft.model}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
