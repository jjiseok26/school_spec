"use client";

import { useEffect, useMemo, useState } from "react";
import { DocumentPanel } from "@/components/DocumentPanel";
import { DraftWorkbench } from "@/components/DraftWorkbench";
import { StudentPicker } from "@/components/StudentPicker";
import { StudentWorkTabs } from "@/components/StudentWorkTabs";
import {
  AppShell,
  Card,
  Field,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";

export default function ClubPage() {
  const {
    data,
    addClub,
    updateClub,
    removeClub,
    addClubMembers,
    removeClubMember,
  } = useAppStore();
  const clubs = data.clubs;
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [studentId, setStudentId] = useState("");
  const [newClubName, setNewClubName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [importClass, setImportClass] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!clubId && clubs[0]) setClubId(clubs[0].id);
    if (clubId && !clubs.some((c) => c.id === clubId)) {
      setClubId(clubs[0]?.id ?? "");
      setStudentId("");
    }
  }, [clubs, clubId]);

  const activeClub = clubs.find((c) => c.id === clubId) ?? null;

  useEffect(() => {
    setEditingName(activeClub?.name ?? "");
    setExtraNote("");
    setSelectedIds([]);
  }, [activeClub?.id, activeClub?.name]);

  const classes = useMemo(() => {
    const list = [
      ...new Set(data.students.map((s) => s.className).filter(Boolean)),
    ];
    return list.sort((a, b) => a.localeCompare(b, "ko"));
  }, [data.students]);

  useEffect(() => {
    if (!importClass && classes.length) setImportClass(classes[0]);
  }, [classes, importClass]);

  const memberSet = useMemo(
    () => new Set(activeClub?.memberIds ?? []),
    [activeClub],
  );

  const classStudents = useMemo(
    () =>
      data.students
        .filter((s) => s.className === importClass)
        .sort((a, b) =>
          a.number.padStart(3, "0").localeCompare(b.number.padStart(3, "0")),
        ),
    [data.students, importClass],
  );

  function onAddClub() {
    const id = addClub(newClubName);
    if (!id) {
      setMessage("동아리명을 입력하세요.");
      return;
    }
    setNewClubName("");
    setClubId(id);
    setStudentId("");
    setMessage(`«${newClubName.trim()}» 동아리를 추가했습니다.`);
  }

  function onSaveClubName() {
    if (!activeClub) return;
    if (!editingName.trim()) {
      setMessage("동아리명을 입력하세요.");
      return;
    }
    updateClub(activeClub.id, { name: editingName });
    setMessage("동아리명을 저장했습니다.");
  }

  function onDeleteClub() {
    if (!activeClub) return;
    if (
      !window.confirm(
        `«${activeClub.name}» 동아리와 관련 문서·초안을 삭제할까요?`,
      )
    ) {
      return;
    }
    removeClub(activeClub.id);
    setMessage(`«${activeClub.name}» 동아리를 삭제했습니다.`);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllInClass() {
    setSelectedIds(
      classStudents.filter((s) => !memberSet.has(s.id)).map((s) => s.id),
    );
  }

  function onImport() {
    if (!activeClub) {
      setMessage("동아리를 먼저 선택하세요.");
      return;
    }
    if (!selectedIds.length) {
      setMessage("가져올 학생을 선택하세요.");
      return;
    }
    addClubMembers(activeClub.id, selectedIds);
    setMessage(
      `${selectedIds.length}명을 «${activeClub.name}» 동아리원으로 추가했습니다.`,
    );
    setSelectedIds([]);
  }

  return (
    <AppShell
      title="동아리활동"
      subtitle="동아리를 여러 개 두고, 동아리별로 학생을 가져와 특기사항을 작성합니다."
    >
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card title="동아리 · 학생">
            <StudentPicker
              value={studentId}
              onChange={setStudentId}
              clubs={clubs}
              clubId={clubId}
              onClubChange={setClubId}
            />
            {studentId && activeClub && memberSet.has(studentId) ? (
              <button
                type="button"
                className="mt-3 text-xs text-rose-600"
                onClick={() => {
                  removeClubMember(activeClub.id, studentId);
                  setStudentId("");
                  setMessage("동아리원에서 제외했습니다.");
                }}
              >
                이 학생을 동아리원에서 제외
              </button>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="동아리 정보">
            <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Field label="동아리 추가">
                <input
                  className={inputClass}
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="예: 과학탐구반, 방송부"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAddClub();
                  }}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full sm:w-auto`}
                  onClick={onAddClub}
                >
                  추가
                </button>
              </div>
            </div>

            {!activeClub ? (
              <p className="text-sm text-[var(--ink-muted-48)]">
                동아리를 추가하면 여기에서 이름을 수정하고 동아리원을 관리할 수
                있습니다.
              </p>
            ) : (
              <div className="space-y-3 border-t border-[var(--hairline)] pt-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Field label="선택한 동아리명">
                    <input
                      className={inputClass}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={onSaveClubName}
                    >
                      이름 저장
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition-transform active:scale-95"
                      onClick={onDeleteClub}
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <Field label="담당교사 추가 메모" hint="역할, 주제, 산출물 등">
                  <textarea
                    className={`${inputClass} min-h-20`}
                    value={extraNote}
                    onChange={(e) => setExtraNote(e.target.value)}
                    placeholder="예: 실험 설계와 결과 정리를 담당함"
                  />
                </Field>
              </div>
            )}
          </Card>

          {activeClub ? (
            <Card title="학급에서 동아리원 가져오기">
              <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
                학급을 고른 뒤 학생을 선택해 «{activeClub.name}» 동아리원으로
                추가합니다.
              </p>
              <div className="mb-3 grid gap-3 sm:grid-cols-[200px_1fr]">
                <Field label="학급">
                  <select
                    className={inputClass}
                    value={importClass}
                    onChange={(e) => {
                      setImportClass(e.target.value);
                      setSelectedIds([]);
                    }}
                  >
                    {classes.length === 0 ? (
                      <option value="">등록된 학급 없음</option>
                    ) : (
                      classes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={!classStudents.length}
                    onClick={selectAllInClass}
                  >
                    미등록 전체 선택
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setSelectedIds([])}
                  >
                    선택 해제
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!selectedIds.length}
                    onClick={onImport}
                  >
                    선택 학생 가져오기 ({selectedIds.length})
                  </button>
                </div>
              </div>

              {classStudents.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted-48)]">
                  이 학급에 학생이 없습니다. 학생등록에서 먼저 등록하세요.
                </p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[var(--hairline)] p-2">
                  {classStudents.map((s) => {
                    const already = memberSet.has(s.id);
                    const checked = selectedIds.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                            already
                              ? "bg-[var(--parchment)] text-[var(--ink-muted-48)]"
                              : "hover:bg-[var(--parchment)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={already}
                            checked={already || checked}
                            onChange={() => toggleSelect(s.id)}
                          />
                          <span className="font-medium text-[var(--ink)]">
                            {s.number ? `${s.number}. ` : ""}
                            {s.name}
                          </span>
                          {already ? (
                            <span className="ml-auto text-xs text-[var(--primary)]">
                              이미 동아리원
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : null}

          {message ? (
            <p className="text-sm text-[var(--ink-muted-80)]">{message}</p>
          ) : null}

          {studentId && activeClub ? (
            <StudentWorkTabs
              documents={
                <DocumentPanel
                  studentId={studentId}
                  section="club"
                  subjectId={activeClub.id}
                  subjectName={activeClub.name}
                />
              }
              drafts={
                <DraftWorkbench
                  studentId={studentId}
                  section="club"
                  subjectId={activeClub.id}
                  subjectName={activeClub.name}
                  extraNote={extraNote}
                />
              }
            />
          ) : (
            <Card>
              <p className="text-sm text-[var(--ink-muted-48)]">
                {!activeClub
                  ? "동아리를 추가한 뒤 학급에서 동아리원을 가져와 주세요."
                  : "왼쪽에서 동아리를 고르고 동아리원을 선택하세요."}
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
