"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { ClubGroup } from "@/lib/types";
import { Field, inputClass } from "./ui";

function sortClasses(classes: string[], preferred?: string | null) {
  return [...classes].sort((a, b) => {
    if (preferred) {
      if (a === preferred) return -1;
      if (b === preferred) return 1;
    }
    return a.localeCompare(b, "ko");
  });
}

export function StudentPicker({
  value,
  onChange,
  classFilter,
  lockClassName,
  clubs,
  clubId,
  onClubChange,
}: {
  value: string;
  onChange: (studentId: string) => void;
  classFilter?: string;
  /** 지정하면 이 학급만 표시하고 학급 선택을 잠금 */
  lockClassName?: string | null;
  /** 있으면 학급 대신 동아리로 필터링 */
  clubs?: ClubGroup[];
  clubId?: string;
  onClubChange?: (clubId: string) => void;
}) {
  const { data } = useAppStore();
  const preferredClass = data.settings.teacherClassName;
  const locked = Boolean(lockClassName);
  const clubMode = Boolean(clubs);

  const classes = useMemo(
    () =>
      sortClasses(
        [...new Set(data.students.map((s) => s.className).filter(Boolean))],
        preferredClass,
      ),
    [data.students, preferredClass],
  );

  const [localClass, setLocalClass] = useState(
    lockClassName ?? classFilter ?? preferredClass ?? "",
  );
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (clubMode) return;
    if (lockClassName) {
      setLocalClass(lockClassName);
      return;
    }
    if (classFilter !== undefined) {
      setLocalClass(classFilter);
      return;
    }
    if (!initialized) {
      setLocalClass(preferredClass ?? "");
      setInitialized(true);
    }
  }, [lockClassName, classFilter, preferredClass, initialized, clubMode]);

  useEffect(() => {
    if (clubMode || locked || !value) return;
    const student = data.students.find((s) => s.id === value);
    if (student && localClass && student.className !== localClass) {
      setLocalClass(student.className);
    }
  }, [value, data.students, localClass, locked, clubMode]);

  const effectiveClass = lockClassName ?? localClass;
  const activeClub = clubs?.find((c) => c.id === clubId) ?? clubs?.[0];
  const memberSet = useMemo(
    () => new Set(activeClub?.memberIds ?? []),
    [activeClub],
  );

  const filtered = useMemo(() => {
    if (clubMode) {
      return data.students
        .filter((s) => memberSet.has(s.id))
        .sort((a, b) =>
          `${a.className}-${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
            `${b.className}-${b.number.padStart(3, "0")}-${b.name}`,
            "ko",
          ),
        );
    }
    return data.students
      .filter((s) => (effectiveClass ? s.className === effectiveClass : true))
      .sort((a, b) =>
        `${a.className}-${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
          `${b.className}-${b.number.padStart(3, "0")}-${b.name}`,
          "ko",
        ),
      );
  }, [data.students, effectiveClass, clubMode, memberSet]);

  return (
    <div className="space-y-3">
      {clubMode ? (
        <Field label="동아리">
          <select
            className={inputClass}
            value={clubId ?? activeClub?.id ?? ""}
            onChange={(e) => {
              onClubChange?.(e.target.value);
              onChange("");
            }}
          >
            {(clubs ?? []).length === 0 ? (
              <option value="">동아리를 먼저 추가하세요</option>
            ) : (
              (clubs ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.memberIds.length}명)
                </option>
              ))
            )}
          </select>
        </Field>
      ) : locked ? (
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] px-3 py-2 text-sm">
          <span className="text-[var(--ink-muted-48)]">학급 </span>
          <span className="font-semibold text-[var(--ink)]">
            {lockClassName}
          </span>
          <span className="text-[var(--ink-muted-48)]"> (담임)</span>
        </div>
      ) : (
        <Field label="학급">
          <select
            className={inputClass}
            value={localClass}
            onChange={(e) => {
              setLocalClass(e.target.value);
              onChange("");
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
      )}

      <div>
        <p className="mb-2 text-[14px] font-medium text-[var(--ink)]">
          {clubMode ? "동아리원" : "학생 명단"} ({filtered.length})
        </p>
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted-48)]">
            {data.students.length === 0
              ? "등록된 학생이 없습니다."
              : clubMode
                ? "이 동아리에 등록된 학생이 없습니다. 학급에서 가져와 주세요."
                : "해당 학급의 학생이 없습니다."}
          </p>
        ) : (
          <ul className="max-h-[min(60vh,420px)] space-y-1 overflow-y-auto">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    s.id === value
                      ? "bg-[var(--primary)] text-white"
                      : "hover:bg-[var(--parchment)]"
                  }`}
                >
                  <span className="font-medium">
                    {s.number ? `${s.number}. ` : ""}
                    {s.name}
                  </span>
                  {clubMode || !localClass ? (
                    <span
                      className={
                        s.id === value
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
    </div>
  );
}
