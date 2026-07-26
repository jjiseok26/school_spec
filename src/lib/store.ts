"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  createEmptyData,
  mergeDefaultSubjects,
  type AppData,
  type ApiKeyEntry,
  type ClubGroup,
  type Draft,
  type DraftLevel,
  type ScheduleCheck,
  type ScheduleItem,
  type Section,
  type Student,
  type StudentDoc,
  type RegisteredModel,
} from "./types";

const STORAGE_KEY = "school-spec-app-data-v1";

type Listener = () => void;
const listeners = new Set<Listener>();

let memoryData: AppData = createEmptyData();
let hydrated = false;
const SERVER_SNAPSHOT: AppData = createEmptyData();

/** 이전 clubMemberIds / teacherClubName → clubs[] 마이그레이션 */
function migrateClubs(parsed: Partial<AppData> & {
  clubMemberIds?: string[];
  settings?: AppData["settings"] & { teacherClubName?: string | null };
}): ClubGroup[] {
  if (Array.isArray(parsed.clubs) && parsed.clubs.length > 0) {
    return parsed.clubs.map((c) => ({
      id: c.id,
      name: c.name,
      memberIds: [...(c.memberIds ?? [])],
    }));
  }
  const legacyMembers = parsed.clubMemberIds ?? [];
  const legacyName = parsed.settings?.teacherClubName?.trim();
  if (legacyName || legacyMembers.length) {
    return [
      {
        id: `club_migrated_${Date.now().toString(36)}`,
        name: legacyName || "동아리",
        memberIds: [...legacyMembers],
      },
    ];
  }
  return [];
}

function subscribeClientReady() {
  return () => {};
}
function getClientReadySnapshot() {
  return true;
}
function getServerReadySnapshot() {
  return false;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function persist(next: AppData) {
  memoryData = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  emit();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed?.version === 1) {
        const migratedClubs = migrateClubs(
          parsed as Partial<AppData> & {
            clubMemberIds?: string[];
            settings?: AppData["settings"] & {
              teacherClubName?: string | null;
            };
          },
        );
        const {
          clubMemberIds: _legacyMembers,
          settings: parsedSettings,
          ...rest
        } = parsed as AppData & { clubMemberIds?: string[] };
        const {
          teacherClubName: _legacyClubName,
          ...restSettings
        } = (parsedSettings ?? {}) as AppData["settings"] & {
          teacherClubName?: string | null;
        };
        memoryData = {
          ...createEmptyData(),
          ...rest,
          subjects: mergeDefaultSubjects(parsed.subjects ?? []),
          clubs: migratedClubs,
          settings: {
            ...createEmptyData().settings,
            ...restSettings,
            charLimits: {
              ...createEmptyData().settings.charLimits,
              ...parsed.settings?.charLimits,
            },
            customModels: parsed.settings?.customModels ?? [],
            teacherSubjectId: parsed.settings?.teacherSubjectId ?? null,
            teacherClassName: parsed.settings?.teacherClassName ?? null,
          },
        };
        // 기본 과목이 비어 있던 기존 데이터를 보완한 경우 저장
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryData));
      }
    } else {
      memoryData = createEmptyData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryData));
    }
  } catch {
    memoryData = createEmptyData();
  }
}

function subscribe(listener: Listener) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrate();
  return memoryData;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function useAppStore() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribeClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );

  const update = useCallback((recipe: (draft: AppData) => void) => {
    const next = structuredClone(getSnapshot());
    recipe(next);
    persist(next);
  }, []);

  const actions = useMemo(
    () => ({
      reset() {
        persist(createEmptyData());
      },
      importData(incoming: AppData, includeKeys: boolean) {
        const base = createEmptyData();
        const merged: AppData = {
          ...base,
          ...incoming,
          version: 1,
          subjects: mergeDefaultSubjects(incoming.subjects ?? []),
          clubs: migrateClubs(incoming as Partial<AppData> & {
            clubMemberIds?: string[];
            settings?: AppData["settings"] & { teacherClubName?: string | null };
          }),
          settings: {
            ...base.settings,
            ...incoming.settings,
            charLimits: {
              ...base.settings.charLimits,
              ...incoming.settings?.charLimits,
            },
            customModels:
              incoming.settings?.customModels ??
              getSnapshot().settings.customModels ??
              [],
            apiKeys: includeKeys
              ? incoming.settings?.apiKeys ?? []
              : getSnapshot().settings.apiKeys,
            activeApiKeyId: includeKeys
              ? (incoming.settings?.activeApiKeyId ?? null)
              : getSnapshot().settings.activeApiKeyId,
            teacherSubjectId:
              incoming.settings?.teacherSubjectId ??
              getSnapshot().settings.teacherSubjectId ??
              null,
            teacherClassName:
              incoming.settings?.teacherClassName ??
              getSnapshot().settings.teacherClassName ??
              null,
          },
        };
        persist(merged);
      },
      exportData(includeKeys: boolean): AppData {
        const snapshot = structuredClone(getSnapshot());
        if (!includeKeys) {
          snapshot.settings.apiKeys = [];
          snapshot.settings.activeApiKeyId = null;
        }
        return snapshot;
      },
      setCharLimit(section: Section, value: string) {
        update((d) => {
          d.settings.charLimits[section] = value;
        });
      },
      setDraftCount(count: number) {
        update((d) => {
          d.settings.draftCount = Math.min(5, Math.max(1, count));
        });
      },
      setIncludeKeysInExport(value: boolean) {
        update((d) => {
          d.settings.includeKeysInExport = value;
        });
      },
      setTeacherSubjectId(subjectId: string | null) {
        update((d) => {
          d.settings.teacherSubjectId = subjectId;
        });
      },
      setTeacherClassName(className: string | null) {
        update((d) => {
          d.settings.teacherClassName = className?.trim() || null;
        });
      },
      addApiKey(entry: Omit<ApiKeyEntry, "id">) {
        const id = uid("key");
        update((d) => {
          d.settings.apiKeys.push({ ...entry, id });
          if (!d.settings.activeApiKeyId) d.settings.activeApiKeyId = id;
        });
        return id;
      },
      updateApiKey(id: string, patch: Partial<ApiKeyEntry>) {
        update((d) => {
          const target = d.settings.apiKeys.find((k) => k.id === id);
          if (target) Object.assign(target, patch);
        });
      },
      removeApiKey(id: string) {
        update((d) => {
          d.settings.apiKeys = d.settings.apiKeys.filter((k) => k.id !== id);
          if (d.settings.activeApiKeyId === id) {
            d.settings.activeApiKeyId = d.settings.apiKeys[0]?.id ?? null;
          }
        });
      },
      setActiveApiKey(id: string | null) {
        update((d) => {
          d.settings.activeApiKeyId = id;
        });
      },
      addCustomModel(entry: Omit<RegisteredModel, "id">) {
        const modelId = entry.modelId.trim();
        if (!modelId) return null;
        const snapshot = getSnapshot();
        const exists = (snapshot.settings.customModels ?? []).some(
          (m) => m.provider === entry.provider && m.modelId === modelId,
        );
        if (exists) return null;
        const id = uid("model");
        update((d) => {
          if (!d.settings.customModels) d.settings.customModels = [];
          d.settings.customModels.push({
            id,
            provider: entry.provider,
            modelId,
            label: entry.label.trim() || modelId,
          });
        });
        return id;
      },
      updateCustomModel(id: string, patch: Partial<RegisteredModel>) {
        update((d) => {
          const target = d.settings.customModels?.find((m) => m.id === id);
          if (!target) return;
          if (patch.modelId !== undefined) target.modelId = patch.modelId.trim();
          if (patch.label !== undefined) target.label = patch.label.trim();
          if (patch.provider !== undefined) target.provider = patch.provider;
        });
      },
      removeCustomModel(id: string) {
        update((d) => {
          d.settings.customModels = (d.settings.customModels ?? []).filter(
            (m) => m.id !== id,
          );
        });
      },
      addSubject(name: string) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const exists = getSnapshot().subjects.some((s) => s.name === trimmed);
        if (exists) return getSnapshot().subjects.find((s) => s.name === trimmed)!.id;
        const id = uid("subj");
        update((d) => {
          d.subjects.push({ id, name: trimmed });
        });
        return id;
      },
      ensureDefaultSubjects() {
        update((d) => {
          d.subjects = mergeDefaultSubjects(d.subjects);
        });
      },
      removeSubject(id: string) {
        update((d) => {
          d.subjects = d.subjects.filter((s) => s.id !== id);
          if (d.settings.teacherSubjectId === id) {
            d.settings.teacherSubjectId = null;
          }
        });
      },
      addStudent(input: Omit<Student, "id">) {
        const id = uid("stu");
        update((d) => {
          d.students.push({ ...input, id });
        });
        return id;
      },
      addStudents(inputs: Omit<Student, "id">[]) {
        const ids: string[] = [];
        update((d) => {
          for (const input of inputs) {
            const id = uid("stu");
            ids.push(id);
            d.students.push({ ...input, id });
          }
        });
        return ids;
      },
      createClassRoster(className: string, count: number, namePrefix = "학생") {
        const safeClass = className.trim() || "미지정";
        const n = Math.min(60, Math.max(1, Math.floor(count)));
        const inputs: Omit<Student, "id">[] = [];
        for (let i = 1; i <= n; i++) {
          inputs.push({
            className: safeClass,
            number: String(i),
            name: `${namePrefix}${i}`,
          });
        }
        const ids: string[] = [];
        update((d) => {
          for (const input of inputs) {
            const id = uid("stu");
            ids.push(id);
            d.students.push({ ...input, id });
          }
        });
        return ids;
      },
      updateStudent(id: string, patch: Partial<Student>) {
        update((d) => {
          const target = d.students.find((s) => s.id === id);
          if (target) Object.assign(target, patch);
        });
      },
      removeStudent(id: string) {
        update((d) => {
          d.students = d.students.filter((s) => s.id !== id);
          d.documents = d.documents.filter((doc) => doc.studentId !== id);
          d.scheduleChecks = d.scheduleChecks.filter((c) => c.studentId !== id);
          d.drafts = d.drafts.filter((draft) => draft.studentId !== id);
          for (const club of d.clubs) {
            club.memberIds = club.memberIds.filter((sid) => sid !== id);
          }
        });
      },
      addClub(name: string) {
        const id = uid("club");
        const trimmed = name.trim();
        if (!trimmed) return null;
        update((d) => {
          d.clubs.push({ id, name: trimmed, memberIds: [] });
        });
        return id;
      },
      updateClub(id: string, patch: Partial<Pick<ClubGroup, "name">>) {
        update((d) => {
          const target = d.clubs.find((c) => c.id === id);
          if (!target) return;
          if (patch.name !== undefined) {
            const name = patch.name.trim();
            if (name) target.name = name;
          }
        });
      },
      removeClub(id: string) {
        update((d) => {
          d.clubs = d.clubs.filter((c) => c.id !== id);
          // 해당 동아리 문서·초안도 함께 정리 (club section + subjectId=clubId)
          d.documents = d.documents.filter(
            (doc) => !(doc.section === "club" && doc.subjectId === id),
          );
          d.drafts = d.drafts.filter(
            (draft) => !(draft.section === "club" && draft.subjectId === id),
          );
        });
      },
      addClubMembers(clubId: string, studentIds: string[]) {
        update((d) => {
          const club = d.clubs.find((c) => c.id === clubId);
          if (!club) return;
          const set = new Set(club.memberIds);
          for (const sid of studentIds) {
            if (d.students.some((s) => s.id === sid)) set.add(sid);
          }
          club.memberIds = [...set];
        });
      },
      removeClubMember(clubId: string, studentId: string) {
        update((d) => {
          const club = d.clubs.find((c) => c.id === clubId);
          if (!club) return;
          club.memberIds = club.memberIds.filter((id) => id !== studentId);
        });
      },
      addDocument(input: Omit<StudentDoc, "id" | "createdAt">) {
        const id = uid("doc");
        update((d) => {
          d.documents.push({
            ...input,
            id,
            createdAt: new Date().toISOString(),
          });
        });
        return id;
      },
      /** 엑셀 업로드 행을 일괄 반영. 학생은 학급+이름으로 찾고 없으면 생성,
       *  문서는 학생+제목이 같으면 덮어쓰고 없으면 추가한다. */
      importDocuments(input: {
        section: Section;
        subjectId?: string;
        rows: {
          className: string;
          number: string;
          name: string;
          title: string;
          text: string;
          teacherNote: string;
        }[];
      }) {
        let added = 0;
        let updated = 0;
        let newStudents = 0;
        update((d) => {
          for (const row of input.rows) {
            if (!row.name.trim()) continue;
            let student = d.students.find(
              (s) =>
                s.className === row.className &&
                s.name === row.name.trim() &&
                (row.number ? s.number === row.number : true),
            );
            if (!student) {
              student = {
                id: uid("stu"),
                className: row.className,
                number: row.number,
                name: row.name.trim(),
              };
              d.students.push(student);
              newStudents += 1;
            }
            if (!row.text.trim() && !row.teacherNote.trim()) continue;
            const title = row.title.trim() || "엑셀 업로드";
            const existing = d.documents.find(
              (doc) =>
                doc.studentId === student!.id &&
                doc.section === input.section &&
                (input.subjectId
                  ? doc.subjectId === input.subjectId
                  : !doc.subjectId) &&
                doc.title === title,
            );
            if (existing) {
              existing.text = row.text;
              existing.teacherNote = row.teacherNote;
              updated += 1;
            } else {
              d.documents.push({
                id: uid("doc"),
                studentId: student.id,
                section: input.section,
                subjectId: input.subjectId,
                title,
                text: row.text,
                teacherNote: row.teacherNote,
                createdAt: new Date().toISOString(),
              });
              added += 1;
            }
          }
        });
        return { added, updated, newStudents };
      },
      updateDocument(id: string, patch: Partial<StudentDoc>) {
        update((d) => {
          const target = d.documents.find((doc) => doc.id === id);
          if (target) Object.assign(target, patch);
        });
      },
      removeDocument(id: string) {
        update((d) => {
          d.documents = d.documents.filter((doc) => doc.id !== id);
          d.drafts = d.drafts.filter((draft) => draft.documentId !== id);
        });
      },
      setScheduleItems(items: Omit<ScheduleItem, "id">[]) {
        update((d) => {
          // 학교 일정은 전교 공용. 같은 날짜·구분·활동명이면 기존 ID를 유지해 체크를 보존한다.
          const next = items.map((item) => {
            const prev = d.scheduleItems.find(
              (s) =>
                s.date === item.date &&
                s.category === item.category &&
                s.title === item.title,
            );
            return { ...item, id: prev?.id ?? uid("sch") };
          });
          const keepIds = new Set(next.map((s) => s.id));
          d.scheduleItems = next;
          d.scheduleChecks = d.scheduleChecks.filter((c) =>
            keepIds.has(c.scheduleItemId),
          );
        });
      },
      addScheduleItem(item: Omit<ScheduleItem, "id">) {
        const id = uid("sch");
        update((d) => {
          d.scheduleItems.push({ ...item, id });
        });
        return id;
      },
      /** 등록된 학교 일정을 전체 학생 참여 체크로 일괄 반영 */
      applySchedulesToAllStudents(scheduleItemIds?: string[]) {
        let applied = 0;
        update((d) => {
          const targets = scheduleItemIds?.length
            ? d.scheduleItems.filter((s) => scheduleItemIds.includes(s.id))
            : d.scheduleItems;
          const existing = new Set(
            d.scheduleChecks.map((c) => `${c.studentId}:${c.scheduleItemId}`),
          );
          for (const student of d.students) {
            for (const item of targets) {
              const key = `${student.id}:${item.id}`;
              if (existing.has(key)) continue;
              d.scheduleChecks.push({
                studentId: student.id,
                scheduleItemId: item.id,
              });
              existing.add(key);
              applied += 1;
            }
          }
        });
        return applied;
      },
      updateScheduleItem(id: string, patch: Partial<Omit<ScheduleItem, "id">>) {
        update((d) => {
          const target = d.scheduleItems.find((item) => item.id === id);
          if (target) Object.assign(target, patch);
        });
      },
      removeScheduleItem(id: string) {
        update((d) => {
          d.scheduleItems = d.scheduleItems.filter((item) => item.id !== id);
          d.scheduleChecks = d.scheduleChecks.filter(
            (c) => c.scheduleItemId !== id,
          );
        });
      },
      toggleScheduleCheck(studentId: string, scheduleItemId: string) {
        update((d) => {
          const idx = d.scheduleChecks.findIndex(
            (c) =>
              c.studentId === studentId && c.scheduleItemId === scheduleItemId,
          );
          if (idx >= 0) d.scheduleChecks.splice(idx, 1);
          else d.scheduleChecks.push({ studentId, scheduleItemId });
        });
      },
      setScheduleObservation(
        studentId: string,
        scheduleItemId: string,
        observation: string,
      ) {
        update((d) => {
          const target = d.scheduleChecks.find(
            (c) =>
              c.studentId === studentId && c.scheduleItemId === scheduleItemId,
          );
          if (!target) {
            d.scheduleChecks.push({
              studentId,
              scheduleItemId,
              observation: observation.trim(),
            });
            return;
          }
          target.observation = observation.trim();
        });
      },
      setScheduleChecks(checks: ScheduleCheck[]) {
        update((d) => {
          d.scheduleChecks = checks;
        });
      },
      upsertDraft(input: {
        studentId: string;
        section: Section;
        subjectId?: string;
        documentId?: string;
        options: string[];
        levels?: DraftLevel[];
        provider?: Draft["provider"];
        model?: string;
      }) {
        const id = uid("draft");
        update((d) => {
          d.drafts = d.drafts.filter(
            (draft) => !sameDraftSlot(draft, input),
          );
          d.drafts.unshift({
            id,
            studentId: input.studentId,
            section: input.section,
            subjectId: input.subjectId,
            documentId: input.documentId,
            options: input.options,
            levels: input.levels,
            selected: 0,
            edited: input.options[0] ?? "",
            confirmed: false,
            provider: input.provider,
            model: input.model,
            createdAt: new Date().toISOString(),
          });
        });
        return id;
      },
      selectDraftOption(id: string, index: number) {
        update((d) => {
          const target = d.drafts.find((draft) => draft.id === id);
          if (!target) return;
          target.selected = index;
          target.edited = target.options[index] ?? "";
          target.confirmed = false;
        });
      },
      editDraft(id: string, text: string) {
        update((d) => {
          const target = d.drafts.find((draft) => draft.id === id);
          if (!target) return;
          target.edited = text;
          target.confirmed = false;
        });
      },
      confirmDraft(id: string) {
        update((d) => {
          const target = d.drafts.find((draft) => draft.id === id);
          if (!target) return;
          target.confirmed = true;
        });
      },
      removeDraft(id: string) {
        update((d) => {
          d.drafts = d.drafts.filter((draft) => draft.id !== id);
        });
      },
    }),
    [update],
  );

  return { data, ready, ...actions };
}

function sameDraftSlot(
  draft: Draft,
  input: {
    studentId: string;
    section: Section;
    subjectId?: string;
    documentId?: string;
  },
) {
  if (draft.studentId !== input.studentId) return false;
  if (draft.section !== input.section) return false;
  const sameSubject = input.subjectId
    ? draft.subjectId === input.subjectId
    : !draft.subjectId;
  if (!sameSubject) return false;
  if (input.documentId) return draft.documentId === input.documentId;
  return !draft.documentId;
}

export function findDraft(
  drafts: Draft[],
  studentId: string,
  section: Section,
  subjectId?: string,
  documentId?: string,
) {
  return drafts.find((draft) =>
    sameDraftSlot(draft, { studentId, section, subjectId, documentId }),
  );
}

export function findDocuments(
  documents: StudentDoc[],
  studentId: string,
  section: Section,
  subjectId?: string,
) {
  return documents.filter(
    (doc) =>
      doc.studentId === studentId &&
      doc.section === section &&
      (subjectId ? doc.subjectId === subjectId : true),
  );
}

export { uid };
