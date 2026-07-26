"use client";

import { useMemo, useRef, useState } from "react";
import { findDraft, useAppStore } from "@/lib/store";
import type { Section } from "@/lib/types";
import { orderCredentials } from "@/lib/utils";
import { PerDocumentDraft } from "./PerDocumentDraft";
import {
  btnPrimary,
  btnSecondary,
  Card,
  Field,
  inputClass,
} from "./ui";

const CUSTOM_TITLE = "__custom__";

function TitlePicker({
  value,
  onChange,
  options,
  label = "문서 제목",
  hint,
}: {
  value: string;
  onChange: (title: string) => void;
  options: string[];
  label?: string;
  hint?: string;
}) {
  const inList = Boolean(value && options.includes(value));
  const [mode, setMode] = useState<"list" | "custom">(
    value && !inList ? "custom" : "list",
  );
  const selectValue =
    mode === "custom" ? CUSTOM_TITLE : inList ? value : "";

  return (
    <Field label={label} hint={hint}>
      <select
        className={inputClass}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_TITLE) {
            setMode("custom");
            if (inList) onChange("");
            return;
          }
          setMode("list");
          onChange(next);
        }}
      >
        <option value="">제목을 선택하세요</option>
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value={CUSTOM_TITLE}>직접 입력…</option>
      </select>
      {mode === "custom" ? (
        <input
          className={`${inputClass} mt-2`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="새 문서 제목 입력"
          autoFocus
        />
      ) : null}
    </Field>
  );
}

export function DocumentPanel({
  studentId,
  section,
  subjectId,
  subjectName,
}: {
  studentId: string;
  section: Section;
  subjectId?: string;
  subjectName?: string;
}) {
  const {
    data,
    addDocument,
    updateDocument,
    removeDocument,
    adjustApiKeyPriority,
  } = useAppStore();
  const [paste, setPaste] = useState("");
  const [title, setTitle] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const docs = data.documents.filter(
    (doc) =>
      doc.studentId === studentId &&
      doc.section === section &&
      (subjectId ? doc.subjectId === subjectId : true),
  );

  /** 같은 영역·과목에서 한 번이라도 쓴 제목 → 다른 학생에게도 드롭다운으로 제공 */
  const titleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const doc of data.documents) {
      if (doc.section !== section) continue;
      if (subjectId) {
        if (doc.subjectId !== subjectId) continue;
      }
      const t = doc.title.trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [data.documents, section, subjectId]);

  const activeDoc =
    docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null;

  async function extractFiles(files: FileList | File[]) {
    if (!studentId) {
      setMessage("학생을 먼저 선택하세요.");
      return;
    }
    setBusy(true);
    setMessage("");
    const credentials = orderCredentials(
      data.settings.apiKeys,
      data.settings.activeApiKeyId,
    );
    const list = Array.from(files);
    let ok = 0;
    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        if (credentials.length) {
          form.append("credentials", JSON.stringify(credentials));
        }
        const res = await fetch("/api/extract", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "추출 실패");
        if (json.used?.id) {
          adjustApiKeyPriority(json.used.id, json.failedIds ?? []);
        }
        addDocument({
          studentId,
          section,
          subjectId,
          title: title.trim() || file.name,
          text: json.text || "",
          teacherNote: teacherNote.trim(),
        });
        ok += 1;
      }
      setTitle("");
      setTeacherNote("");
      setMessage(`${ok}개 파일을 추가했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "추출 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addPaste() {
    if (!studentId) {
      setMessage("학생을 먼저 선택하세요.");
      return;
    }
    if (!paste.trim()) {
      setMessage("붙여넣을 텍스트를 입력하세요.");
      return;
    }
    addDocument({
      studentId,
      section,
      subjectId,
      title: title.trim() || "붙여넣기",
      text: paste.trim(),
      teacherNote: teacherNote.trim(),
    });
    setPaste("");
    setTitle("");
    setTeacherNote("");
    setMessage("텍스트를 추가했습니다.");
  }

  return (
    <Card title="학생 문서 · 교사 메모">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TitlePicker
            value={title}
            onChange={setTitle}
            options={titleOptions}
            label="문서 제목"
            hint="한 번 입력한 제목은 같은 영역·과목의 다른 학생에게도 드롭다운으로 나타납니다."
          />
          <Field label="파일 업로드 (복수 가능)">
            <input
              ref={fileRef}
              type="file"
              multiple
              className={inputClass}
              accept=".txt,.docx,.pdf,.hwpx,.png,.jpg,.jpeg,.webp,.gif,image/*"
              onChange={(e) => {
                if (e.target.files?.length) void extractFiles(e.target.files);
              }}
            />
          </Field>
        </div>
        <Field label="텍스트 붙여넣기">
          <textarea
            className={`${inputClass} min-h-28`}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="학생 작성문을 붙여넣으세요."
          />
        </Field>
        <Field
          label="교사 추가 정보"
          hint="관찰 메모, 단원명, 역할 등을 적으면 생성에 반영됩니다."
        >
          <textarea
            className={`${inputClass} min-h-20`}
            value={teacherNote}
            onChange={(e) => setTeacherNote(e.target.value)}
            placeholder="예: 모듈 발표에서 자료 조사와 발표를 담당함"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={addPaste}
          >
            텍스트 추가
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "추출 중…" : "파일 선택"}
          </button>
        </div>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        <div className="space-y-3 pt-2">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">등록된 문서가 없습니다.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 border-b border-[var(--hairline)] pb-2">
                {docs.map((doc) => {
                  const docDraft = findDraft(
                    data.drafts,
                    studentId,
                    section,
                    subjectId,
                    doc.id,
                  );
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setActiveDocId(doc.id)}
                      className={`max-w-[200px] truncate rounded-full px-3 py-1.5 text-sm transition-transform active:scale-95 ${
                        activeDoc?.id === doc.id
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

              {activeDoc ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">문서 편집</strong>
                    <button
                      type="button"
                      className="text-xs text-rose-600"
                      onClick={() => {
                        removeDocument(activeDoc.id);
                        setActiveDocId(null);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                  <TitlePicker
                    key={activeDoc.id}
                    value={activeDoc.title}
                    onChange={(next) =>
                      updateDocument(activeDoc.id, { title: next })
                    }
                    options={titleOptions}
                    label="문서 제목 수정"
                    hint="제목을 바꾸면 이 문서에만 적용되고, 새 제목은 드롭다운에 추가됩니다."
                  />
                  <div className="mt-2">
                    <Field label="본문">
                      <textarea
                        className={`${inputClass} min-h-24`}
                        value={activeDoc.text}
                        onChange={(e) =>
                          updateDocument(activeDoc.id, {
                            text: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <div className="mt-2">
                    <Field label="교사 메모">
                      <textarea
                        className={`${inputClass} min-h-16`}
                        value={activeDoc.teacherNote}
                        onChange={(e) =>
                          updateDocument(activeDoc.id, {
                            teacherNote: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>

                  <PerDocumentDraft
                    studentId={studentId}
                    section={section}
                    subjectId={subjectId}
                    subjectName={subjectName}
                    doc={activeDoc}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
