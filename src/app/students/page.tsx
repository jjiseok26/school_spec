"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AppShell,
  Card,
  Field,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import { SECTION_LABELS, type Section, type Student } from "@/lib/types";

export default function StudentsPage() {
  const {
    data,
    addStudent,
    addStudents,
    createClassRoster,
    updateStudent,
    removeStudent,
    removeClassStudents,
    addDocument,
  } = useAppStore();

  const [className, setClassName] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [rosterCount, setRosterCount] = useState("30");
  const [namePrefix, setNamePrefix] = useState("학생");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"single" | "roster" | "bulk">("single");
  const [listClass, setListClass] = useState("");

  const ADD_TABS: { id: typeof tab; label: string }[] = [
    { id: "single", label: "1명 추가" },
    { id: "roster", label: "학급 한 번에" },
    { id: "bulk", label: "명단 붙여넣기" },
  ];

  const classTabs = useMemo(() => {
    const preferred = data.settings.teacherClassName;
    const list = [
      ...new Set(data.students.map((s) => s.className).filter(Boolean)),
    ];
    return list.sort((a, b) => {
      if (preferred) {
        if (a === preferred) return -1;
        if (b === preferred) return 1;
      }
      return a.localeCompare(b, "ko");
    });
  }, [data.students, data.settings.teacherClassName]);

  useEffect(() => {
    if (!classTabs.length) {
      setListClass("");
      return;
    }
    const preferred = data.settings.teacherClassName;
    if (preferred && classTabs.includes(preferred)) {
      if (!listClass || !classTabs.includes(listClass)) {
        setListClass(preferred);
      }
      return;
    }
    if (!listClass || !classTabs.includes(listClass)) {
      setListClass(classTabs[0]);
    }
  }, [classTabs, listClass, data.settings.teacherClassName]);

  const listedStudents = useMemo(
    () =>
      data.students
        .filter((s) =>
          listClass ? s.className === listClass : true,
        )
        .sort((a, b) =>
          `${a.number.padStart(3, "0")}-${a.name}`.localeCompare(
            `${b.number.padStart(3, "0")}-${b.name}`,
            "ko",
          ),
        ),
    [data.students, listClass],
  );

  function onAdd() {
    if (!name.trim()) {
      setMessage("이름을 입력하세요.");
      return;
    }
    addStudent({
      className: className.trim() || "미지정",
      number: number.trim(),
      name: name.trim(),
    });
    setName("");
    setNumber("");
    setMessage("학생을 추가했습니다.");
  }

  function onCreateRoster() {
    const count = Number(rosterCount);
    if (!Number.isFinite(count) || count < 1) {
      setMessage("인원 수를 1 이상으로 입력하세요.");
      return;
    }
    if (!className.trim()) {
      setMessage("학급을 입력한 뒤 일괄 생성하세요. (예: 2-3)");
      return;
    }
    const ids = createClassRoster(
      className.trim(),
      count,
      namePrefix.trim() || "학생",
    );
    setMessage(
      `${className.trim()} 학급 ${ids.length}명을 한 번에 만들었습니다. 목록에서 이름을 수정하세요.`,
    );
  }

  function onBulk() {
    const lines = bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const inputs: Omit<Student, "id">[] = [];
    for (const line of lines) {
      const parts = line.includes(",")
        ? line.split(",").map((x) => x.trim())
        : line.split(/\s+/);
      let studentClass = className.trim() || "미지정";
      let studentNumber = "";
      let studentName = "";
      if (parts.length >= 3) {
        studentClass = parts[0] || studentClass;
        studentNumber = parts[1] || "";
        studentName = parts.slice(2).join(" ");
      } else if (parts.length === 2) {
        if (className.trim()) {
          studentNumber = parts[0];
          studentName = parts[1];
        } else {
          studentClass = parts[0];
          studentName = parts[1];
        }
      } else {
        studentName = parts[0] || "";
      }
      if (!studentName) continue;
      inputs.push({
        className: studentClass,
        number: studentNumber,
        name: studentName,
      });
    }
    if (!inputs.length) {
      setMessage("등록할 명단이 없습니다.");
      return;
    }
    addStudents(inputs);
    setBulk("");
    setMessage(`${inputs.length}명을 일괄 등록했습니다.`);
  }

  function onBulkFile(file: File) {
    void file.text().then((text) => {
      setBulk(text.replace(/^\uFEFF/, ""));
      setMessage("파일을 불러왔습니다. 내용을 확인한 뒤 일괄 등록을 누르세요.");
    });
  }

  return (
    <AppShell
      title="학생등록"
      subtitle="학생을 한 명씩 추가하거나, 학급 인원만큼 한 번에 만들 수 있습니다."
    >
      <Card title="학생 추가">
        <div className="mb-4 inline-flex rounded-full border border-[var(--hairline)] bg-[var(--parchment)] p-1">
          {ADD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
                tab === t.id
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--ink-muted-80)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "single" ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="학급">
                <input
                  className={inputClass}
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="예: 2-3"
                />
              </Field>
              <Field label="번호">
                <input
                  className={inputClass}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="예: 12"
                />
              </Field>
              <Field label="이름">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                />
              </Field>
            </div>
            <div className="mt-3">
              <button type="button" className={btnPrimary} onClick={onAdd}>
                추가
              </button>
            </div>
          </div>
        ) : null}

        {tab === "roster" ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="학급">
                <input
                  className={inputClass}
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="예: 2-3"
                />
              </Field>
              <Field label="인원 수">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={rosterCount}
                  onChange={(e) => setRosterCount(e.target.value)}
                  placeholder="30"
                />
              </Field>
              <Field label="이름 접두어" hint="예: 학생 → 학생1, 학생2…">
                <input
                  className={inputClass}
                  value={namePrefix}
                  onChange={(e) => setNamePrefix(e.target.value)}
                  placeholder="학생"
                />
              </Field>
            </div>
            <div className="mt-3">
              <button
                type="button"
                className={btnPrimary}
                onClick={onCreateRoster}
              >
                {rosterCount || "N"}명 한 번에 만들기
              </button>
            </div>
          </div>
        ) : null}

        {tab === "bulk" ? (
          <div>
            <Field
              label="명단 (한 줄에 한 명)"
              hint="형식 예: 2-3,12,홍길동 또는 2-3 12 홍길동. 학급을 위에 적어두면 번호 이름만 넣어도 됩니다."
            >
              <textarea
                className={`${inputClass} min-h-28`}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={onBulk}>
                일괄 등록
              </button>
              <label className={`${btnSecondary} cursor-pointer`}>
                CSV/텍스트 불러오기
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onBulkFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}
      </Card>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

      <div className="mt-4">
        <Card
          title={`학생 목록 (${listClass ? listedStudents.length : data.students.length}${listClass ? ` / 전체 ${data.students.length}` : ""})`}
        >
          {data.students.length === 0 ? (
            <p className="text-sm text-slate-500">등록된 학생이 없습니다.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="max-w-xs flex-1">
                  <Field label="학급">
                    <select
                      className={inputClass}
                      value={listClass}
                      onChange={(e) => setListClass(e.target.value)}
                    >
                      {classTabs.map((c) => (
                        <option key={c} value={c}>
                          {c} (
                          {
                            data.students.filter((s) => s.className === c)
                              .length
                          }
                          명)
                          {c === data.settings.teacherClassName
                            ? " · 담임"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {listClass ? (
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => {
                      const count = data.students.filter(
                        (s) => s.className === listClass,
                      ).length;
                      if (
                        !window.confirm(
                          `«${listClass}» 학급 학생 ${count}명과 관련 문서·초안·일정·임원 기록을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
                        )
                      ) {
                        return;
                      }
                      const removed = removeClassStudents(listClass);
                      setMessage(
                        `«${listClass}» 학급 학생 ${removed}명을 삭제했습니다.`,
                      );
                    }}
                  >
                    학급 전체 삭제
                  </button>
                ) : null}
              </div>

              {listedStudents.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted-48)]">
                  이 학급에 등록된 학생이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b text-[var(--ink-muted-48)]">
                      <tr>
                        <th className="px-2 py-2">학급</th>
                        <th className="px-2 py-2">번호</th>
                        <th className="px-2 py-2">이름</th>
                        <th className="px-2 py-2">문서</th>
                        <th className="px-2 py-2">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listedStudents.map((s) => {
                        const docCount = data.documents.filter(
                          (d) => d.studentId === s.id,
                        ).length;
                        const draftCount = data.drafts.filter(
                          (d) => d.studentId === s.id,
                        ).length;
                        return (
                          <tr
                            key={s.id}
                            className="border-b border-[var(--hairline)]"
                          >
                            <td className="px-2 py-2">
                              <DeferredStudentInput
                                value={s.className}
                                onCommit={(className) =>
                                  updateStudent(s.id, { className })
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <DeferredStudentInput
                                value={s.number}
                                onCommit={(number) =>
                                  updateStudent(s.id, { number })
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className={inputClass}
                                value={s.name}
                                onChange={(e) =>
                                  updateStudent(s.id, { name: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 text-[var(--ink-muted-48)]">
                              문서 {docCount} · 초안 {draftCount}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/students/${s.id}`}
                                  className={btnSecondary}
                                >
                                  데이터 보기
                                </Link>
                                <Link
                                  href={`/report?student=${s.id}`}
                                  className={btnSecondary}
                                >
                                  활동열람
                                </Link>
                                <QuickMemo
                                  studentId={s.id}
                                  onAdd={(section, text) =>
                                    addDocument({
                                      studentId: s.id,
                                      section,
                                      title: "빠른 메모",
                                      text,
                                      teacherNote: "",
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className={btnDanger}
                                  onClick={() => {
                                    const label = [
                                      s.className,
                                      s.number ? `${s.number}번` : "",
                                      s.name,
                                    ]
                                      .filter(Boolean)
                                      .join(" ");
                                    if (
                                      !window.confirm(
                                        `«${label}» 학생과 관련 문서·초안·일정·임원 기록을 삭제할까요?`,
                                      )
                                    ) {
                                      return;
                                    }
                                    removeStudent(s.id);
                                    setMessage(`${s.name} 학생을 삭제했습니다.`);
                                  }}
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function DeferredStudentInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  function commit() {
    if (draft === value) return;
    onCommit(draft);
  }

  return (
    <input
      className={inputClass}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        commit();
        (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function QuickMemo({
  studentId,
  onAdd,
}: {
  studentId: string;
  onAdd: (section: Section, text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("behavior");
  const [text, setText] = useState("");

  if (!open) {
    return (
      <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
        메모
      </button>
    );
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2">
      <select
        className={inputClass}
        value={section}
        onChange={(e) => setSection(e.target.value as Section)}
      >
        {(Object.keys(SECTION_LABELS) as Section[]).map((key) => (
          <option key={key} value={key}>
            {SECTION_LABELS[key]}
          </option>
        ))}
      </select>
      <textarea
        className={`${inputClass} min-h-16`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="관찰 메모"
      />
      <div className="flex gap-1">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            if (!text.trim()) return;
            onAdd(section, text.trim());
            setText("");
            setOpen(false);
          }}
        >
          저장
        </button>
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      <span className="sr-only">{studentId}</span>
    </div>
  );
}
