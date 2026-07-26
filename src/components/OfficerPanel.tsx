"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultOfficerDates,
  formatOfficerLabel,
} from "@/lib/prompts";
import { useAppStore } from "@/lib/store";
import {
  btnPrimary,
  btnSecondary,
  Card,
  Field,
  inputClass,
} from "./ui";

function emptyForm() {
  const dates = defaultOfficerDates();
  return {
    title: "",
    startDate: dates.startDate,
    endDate: dates.endDate,
    observation: "",
  };
}

export function OfficerPanel({ studentId }: { studentId: string }) {
  const { data, addOfficer, updateOfficer, removeOfficer } = useAppStore();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!editingId) setForm(emptyForm());
  }, [studentId, editingId]);

  const officers = useMemo(
    () =>
      data.officers
        .filter((o) => o.studentId === studentId)
        .sort((a, b) =>
          `${a.startDate}-${a.title}`.localeCompare(
            `${b.startDate}-${b.title}`,
            "ko",
          ),
        ),
    [data.officers, studentId],
  );

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function onSave() {
    if (!form.title.trim()) {
      setMessage("임원명을 입력하세요.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setMessage("시작일과 종료일을 입력하세요.");
      return;
    }
    const payload = {
      gradeLabel: "",
      title: form.title,
      startDate: form.startDate,
      endDate: form.endDate,
      observation: form.observation,
    };
    if (editingId) {
      updateOfficer(editingId, payload);
      setMessage("임원 정보를 수정했습니다.");
    } else {
      addOfficer({ studentId, ...payload });
      setMessage("임원을 등록했습니다.");
    }
    resetForm();
  }

  return (
    <Card title="임원 등록">
      <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
        특기사항에는{" "}
        <span className="text-[var(--ink)]">
          1학기 전교 학생자치회 부회장(2026.03.01.-2026.08.18.)
        </span>
        ,{" "}
        <span className="text-[var(--ink)]">
          전교 학생자치회 회장(2026.03.01.-2027.02.03.)
        </span>{" "}
       처럼 학년 없이 반영됩니다. 시작일은 해당 학년도 3월 1일, 종료일은 다음
        해 2월 말일이 기본값입니다.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="임원명" hint="직책명">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="예: 1학기 전교 학생자치회 부회장"
          />
        </Field>
        <Field label="시작일" hint="기본: 해당 연도 3월 1일">
          <input
            type="date"
            className={inputClass}
            value={form.startDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, startDate: e.target.value }))
            }
          />
        </Field>
        <Field label="종료일" hint="기본: 다음 해 2월 말일">
          <input
            type="date"
            className={inputClass}
            value={form.endDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, endDate: e.target.value }))
            }
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field
          label="임원 기간 관찰"
          hint="행동 특성, 참여도, 협력도, 활동 실적, 실제 역할 등"
        >
          <textarea
            className={`${inputClass} min-h-24`}
            value={form.observation}
            onChange={(e) =>
              setForm((f) => ({ ...f, observation: e.target.value }))
            }
            placeholder="예: 학급·학년 의견을 수렴해 학생회 안건을 정리하고, 회의 진행을 주도함. 부원과 역할을 나누어 행사를 준비함."
          />
        </Field>
      </div>

      {form.title && form.startDate && form.endDate ? (
        <p className="mt-2 rounded-xl bg-[var(--parchment)] px-3 py-2 text-sm text-[var(--ink-muted-80)]">
          생기부 반영 미리보기:{" "}
          <span className="font-medium text-[var(--ink)]">
            {formatOfficerLabel(form)}
          </span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onSave}>
          {editingId ? "수정 저장" : "임원 추가"}
        </button>
        {editingId ? (
          <button type="button" className={btnSecondary} onClick={resetForm}>
            취소
          </button>
        ) : null}
        <button
          type="button"
          className={btnSecondary}
          onClick={() =>
            setForm((f) => ({
              ...f,
              ...defaultOfficerDates(),
            }))
          }
        >
          기간을 학년도 기본값으로
        </button>
      </div>
      {message ? (
        <p className="mt-2 text-sm text-[var(--ink-muted-80)]">{message}</p>
      ) : null}

      <div className="mt-4 space-y-2 border-t border-[var(--hairline)] pt-4">
        {officers.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted-48)]">
            등록된 임원이 없습니다.
          </p>
        ) : (
          officers.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-[var(--hairline)] px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    {formatOfficerLabel(o)}
                  </p>
                  {o.observation.trim() ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink-muted-80)]">
                      {o.observation}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--ink-muted-48)]">
                      관찰 내용 없음 — 수정에서 입력하면 특기사항에 반영됩니다.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-[var(--primary)]"
                    onClick={() => {
                      setEditingId(o.id);
                      setForm({
                        title: o.title,
                        startDate: o.startDate,
                        endDate: o.endDate,
                        observation: o.observation,
                      });
                      setMessage("");
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-600"
                    onClick={() => {
                      if (!window.confirm("이 임원 기록을 삭제할까요?")) return;
                      removeOfficer(o.id);
                      if (editingId === o.id) resetForm();
                      setMessage("임원 기록을 삭제했습니다.");
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
