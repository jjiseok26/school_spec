export type Provider = "google" | "nvidia" | "openai" | "anthropic";

export type Section =
  | "subject"
  | "behavior"
  | "autonomy"
  | "career"
  | "volunteer"
  | "club";

export type ActivityCategory = Extract<
  Section,
  "autonomy" | "career" | "volunteer"
>;

export interface ApiKeyEntry {
  id: string;
  label: string;
  provider: Provider;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface RegisteredModel {
  id: string;
  provider: Provider;
  modelId: string;
  label: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  className: string;
  number: string;
  name: string;
}

export interface StudentDoc {
  id: string;
  studentId: string;
  section: Section;
  subjectId?: string;
  title: string;
  text: string;
  teacherNote: string;
  createdAt: string;
}

export interface ScheduleItem {
  id: string;
  date: string;
  category: ActivityCategory;
  title: string;
  note: string;
}

export interface ScheduleCheck {
  studentId: string;
  scheduleItemId: string;
  /** 해당 학생·활동에 대한 교사 관찰 내용 */
  observation?: string;
}

/** 자율활동 임원(학생자치회 등) 기록 */
export interface OfficerRole {
  id: string;
  studentId: string;
  /** 임원명. 예: 1학기 전교 학생자치회 부회장 */
  title: string;
  startDate: string;
  endDate: string;
  /** 임원 기간 중 행동특성·참여도·협력도·활동실적 등 관찰 */
  observation: string;
  /** @deprecated 생기부 반영 시 사용하지 않음. 호환용 */
  gradeLabel?: string;
}

export type DraftLevel = "최상" | "상" | "중" | "하";

export const DRAFT_LEVELS: DraftLevel[] = ["최상", "상", "중", "하"];

export const DRAFT_LEVEL_HINTS: Record<DraftLevel, string> = {
  최상: "근거를 가장 풍부·체계적으로 서술",
  상: "주요 활동과 역할을 충실히 서술",
  중: "핵심만 간결하게 서술",
  하: "최소한의 사실만 짧게 서술",
};

export function isDraftLevel(value: string): value is DraftLevel {
  return (DRAFT_LEVELS as string[]).includes(value);
}

export interface Draft {
  id: string;
  studentId: string;
  section: Section;
  subjectId?: string;
  /** 있으면 해당 학생 문서 전용 초안. 없으면 전체 수합 초안 */
  documentId?: string;
  options: string[];
  /** 각 options[i]에 대응하는 등급. 없으면 초안 번호로 표시 */
  levels?: DraftLevel[];
  selected: number | null;
  edited: string;
  confirmed: boolean;
  provider?: Provider;
  model?: string;
  createdAt: string;
}

export type CharLimits = Record<Section, string>;

export interface ClubGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Settings {
  charLimits: CharLimits;
  activeApiKeyId: string | null;
  apiKeys: ApiKeyEntry[];
  customModels: RegisteredModel[];
  draftCount: number;
  includeKeysInExport: boolean;
  /** 설정에서 지정한 교사 담당 과목. 있으면 교과특기에서 고정됨 */
  teacherSubjectId: string | null;
  /** 담임학급. 있으면 학급 선택 시 기본값으로 먼저 보임 */
  teacherClassName: string | null;
}

export interface AppData {
  version: 1;
  subjects: Subject[];
  students: Student[];
  documents: StudentDoc[];
  scheduleItems: ScheduleItem[];
  scheduleChecks: ScheduleCheck[];
  drafts: Draft[];
  /** 등록된 동아리 목록 (각각 동아리원 포함) */
  clubs: ClubGroup[];
  /** 자율활동 임원 기록 */
  officers: OfficerRole[];
  settings: Settings;
}

export interface Credential {
  provider: Provider;
  apiKey: string;
  model: string;
  label?: string;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google Gemini",
  nvidia: "NVIDIA",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  google: "gemini-2.5-flash",
  nvidia: "meta/llama-3.3-70b-instruct",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
};

/** 제공자별 기본 추천 모델 (사용자가 추가로 등록 가능) */
export const BUILT_IN_MODELS: Record<
  Provider,
  { modelId: string; label: string }[]
> = {
  google: [
    { modelId: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    {
      modelId: "gemini-3.5-flash-lite",
      label: "Gemini 3.5 Flash-Lite",
    },
    { modelId: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { modelId: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { modelId: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  nvidia: [
    {
      modelId: "meta/llama-3.3-70b-instruct",
      label: "Llama 3.3 70B",
    },
    {
      modelId: "meta/llama-3.1-70b-instruct",
      label: "Llama 3.1 70B",
    },
    {
      modelId: "mistralai/mistral-large-2-instruct",
      label: "Mistral Large 2",
    },
  ],
  openai: [
    { modelId: "gpt-4o-mini", label: "GPT-4o mini" },
    { modelId: "gpt-4o", label: "GPT-4o" },
    { modelId: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { modelId: "o4-mini", label: "o4-mini" },
  ],
  anthropic: [
    { modelId: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { modelId: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    { modelId: "claude-sonnet-4-0", label: "Claude Sonnet 4" },
  ],
};

export function listModelsForProvider(
  provider: Provider,
  customModels: RegisteredModel[],
) {
  type ModelOption = {
    modelId: string;
    label: string;
    source: "builtin" | "custom";
    id?: string;
  };
  const builtIn: ModelOption[] = BUILT_IN_MODELS[provider].map((m) => ({
    ...m,
    source: "builtin" as const,
  }));
  const custom: ModelOption[] = customModels
    .filter((m) => m.provider === provider)
    .map((m) => ({
      modelId: m.modelId,
      label: m.label || m.modelId,
      source: "custom" as const,
      id: m.id,
    }));
  const seen = new Set(builtIn.map((m) => m.modelId));
  const merged: ModelOption[] = [...builtIn];
  for (const item of custom) {
    if (seen.has(item.modelId)) continue;
    seen.add(item.modelId);
    merged.push(item);
  }
  return merged;
}

export const SECTION_LABELS: Record<Section, string> = {
  subject: "교과 세부능력 및 특기사항",
  behavior: "행동특성 및 발달상황",
  autonomy: "자율활동",
  career: "진로활동",
  volunteer: "봉사활동",
  club: "동아리활동",
};

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  "autonomy",
  "career",
  "volunteer",
];

export const EMPTY_CHAR_LIMITS: CharLimits = {
  subject: "",
  behavior: "",
  autonomy: "",
  career: "",
  volunteer: "",
  club: "",
};

/** 중등 기본 교과목 (그 외는 사용자가 추가) */
export const DEFAULT_SUBJECT_NAMES = [
  "국어",
  "영어",
  "수학",
  "정보",
  "사회",
  "도덕",
  "과학",
  "기술·가정",
  "음악",
  "미술",
  "체육",
] as const;

export function createDefaultSubjects(): Subject[] {
  return DEFAULT_SUBJECT_NAMES.map((name, index) => ({
    id: `subj_default_${index + 1}`,
    name,
  }));
}

export function mergeDefaultSubjects(existing: Subject[]): Subject[] {
  const names = new Set(existing.map((s) => s.name.trim()));
  const merged = [...existing];
  DEFAULT_SUBJECT_NAMES.forEach((name, index) => {
    if (names.has(name)) return;
    merged.push({ id: `subj_default_${index + 1}`, name });
  });
  // 기본 과목 순서를 앞에, 그 외 추가는 과목은 뒤에
  const defaultOrder = new Map<string, number>(
    DEFAULT_SUBJECT_NAMES.map((name, i) => [name, i] as [string, number]),
  );
  return merged.sort((a, b) => {
    const ai = defaultOrder.has(a.name) ? defaultOrder.get(a.name)! : 1000;
    const bi = defaultOrder.has(b.name) ? defaultOrder.get(b.name)! : 1000;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name, "ko");
  });
}

export function createEmptyData(): AppData {
  return {
    version: 1,
    subjects: createDefaultSubjects(),
    students: [],
    documents: [],
    scheduleItems: [],
    scheduleChecks: [],
    drafts: [],
    clubs: [],
    officers: [],
    settings: {
      charLimits: { ...EMPTY_CHAR_LIMITS },
      activeApiKeyId: null,
      apiKeys: [],
      customModels: [],
      draftCount: 3,
      includeKeysInExport: false,
      teacherSubjectId: null,
      teacherClassName: null,
    },
  };
}
