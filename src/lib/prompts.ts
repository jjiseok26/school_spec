import {
  ACTIVITY_CATEGORIES,
  DRAFT_LEVELS,
  DRAFT_LEVEL_HINTS,
  SECTION_LABELS,
  type ActivityCategory,
  type Section,
} from "./types";

const SECTION_GUIDE: Record<Section, string> = {
  subject:
    "교과 수업에서 관찰된 학습 태도, 탐구 과정, 산출물의 내용과 수준, 성장 과정을 서술한다. 단원명이나 활동명을 근거로 삼되 활동 나열에 그치지 말고 학생이 무엇을 어떻게 했는지 기술한다.",
  behavior:
    "학급 생활에서 지속적으로 관찰된 인성, 학습 태도, 대인 관계, 변화와 성장을 서술한다. 특정 사건 하나에 치우치지 않고 반복 관찰된 행동을 중심으로 기술한다.",
  autonomy:
    "자율활동은 학생이 체크한 학교·학급 일정과 임원 활동, 그에 대한 교사 관찰을 중심으로, 활동 과정에서 드러난 역할·참여·협력·실적을 구체적으로 서술한다.",
  career:
    "진로활동은 학생이 체크한 진로 관련 일정과 교사 관찰을 중심으로, 탐색·준비·실천 과정에서의 역할과 행동을 구체적으로 서술한다.",
  volunteer:
    "봉사활동은 학생이 체크한 봉사 일정과 교사 관찰을 중심으로, 맡은 역할과 실천 과정·태도·협력 모습을 구체적으로 서술한다.",
  club:
    "동아리활동에서 학생이 맡은 역할, 활동 주제와 탐구 과정, 산출물과 협업 모습을 서술한다.",
};

const ACTIVITY_SECTION_SET = new Set<Section>(ACTIVITY_CATEGORIES);

function isActivitySection(section: Section): section is ActivityCategory {
  return ACTIVITY_SECTION_SET.has(section);
}

/** 2026-03-05 → 2026.03.05. */
export function formatActivityDate(date: string) {
  const trimmed = date.trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}.`;
  if (/^\d{4}\.\d{2}\.\d{2}\.?$/.test(trimmed)) {
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }
  return trimmed;
}

/** 예: 1학기 전교 학생자치회 부회장(2026.03.01.-2026.08.18.) — 생기부에는 학년 미포함 */
export function formatOfficerLabel(input: {
  title: string;
  startDate: string;
  endDate: string;
}) {
  const start = formatActivityDate(input.startDate);
  const end = formatActivityDate(input.endDate);
  const period =
    start && end ? `${start}-${end}` : start || end || "";
  return period
    ? `${input.title.trim()}(${period})`
    : input.title.trim();
}

/** 해당 학년도 기본 임기: 3월 1일 ~ 다음 해 2월 말일 */
export function defaultOfficerDates(now = new Date()) {
  const y = now.getFullYear();
  const month = now.getMonth(); // 0=1월
  // 1~2월이면 직전 3월이 학년도 시작
  const startYear = month < 2 ? y - 1 : y;
  const endYear = startYear + 1;
  const isLeap =
    (endYear % 4 === 0 && endYear % 100 !== 0) || endYear % 400 === 0;
  const endDay = isLeap ? "29" : "28";
  return {
    startDate: `${startYear}-03-01`,
    endDate: `${endYear}-02-${endDay}`,
  };
}

/** 생기부 창체 특기사항에서 흔한 «N학년:» 접두어 제거 */
export function stripGradeMarkersFromCreativeDraft(text: string) {
  return text
    .replace(/(^|[.。]\s*)(\d{1,2})\s*학년\s*[:：]\s*/g, "$1")
    .replace(/^\s*(\d{1,2})\s*학년\s+/g, "")
    .trim();
}

export function buildSystemPrompt(section: Section, charLimit: number | null) {
  const limitRule = charLimit
    ? `- 각 초안은 공백을 포함하여 ${charLimit}자 이내로 작성한다. 이 분량을 넘기지 않는다.`
    : "- 분량 제한은 없으나 근거 자료에 있는 내용만으로 작성한다.";

  const levelGuide = DRAFT_LEVELS.map(
    (level) => `- ${level}: ${DRAFT_LEVEL_HINTS[level]}`,
  ).join("\n");

  const activityFormatRules = isActivitySection(section)
    ? [
        "",
        "창체 특기사항 작성 요령 (필수):",
        "- 체크된 각 활동을 뼈대로 하되, 활동명만 나열하지 말고 활동 내용에 기반해 충실히 서술한다.",
        "- 활동 과정에서 드러난 개별적인 행동 특성, 참여도, 협력도, 활동 실적 등을 평가·반영한다.",
        "- 교사 관찰, 학생 작성 문서, 상담·관련 자료를 참고하여 실제적인 역할과 활동 위주로 기록한다.",
        "- 각 문장은 반드시 「활동명(YYYY.MM.DD.)에서 …함.」 형식을 따른다.",
        "- 예: 학급회의 및 임원 선출(2026.03.05.)에서 반장 후보로 출마하여 공약을 발표하고, 학급 의견을 수렴하는 역할을 수행함.",
        "- 날짜는 근거에 주어진 형식을 그대로 쓴다. 활동명이 날짜보다 앞에 온다.",
        "- 교사 관찰 내용이 있으면 해당 활동 서술의 핵심 근거로 우선 반영한다.",
        "- 학생 문서·상담 자료는 각 활동의 역할·태도·실적을 뒷받침하는 근거로 사용한다.",
        "- 여러 활동이 있으면 날짜순으로 문장을 이어 쓰되, 각 활동마다 역할·참여·협력·실적 중 근거에 있는 요소를 구체적으로 담는다.",
        "- 근거에 없는 행동·성과를 지어내지 않는다. 근거가 빈약한 활동은 짧게만 쓴다.",
        ...(section === "autonomy"
          ? [
              "",
              "임원 활동 서술 (자율활동):",
              "- 등록된 임원은 「임원명(시작일-종료일)」 형식을 그대로 쓰고, 이어서 임원 기간의 역할·행동 특성·참여도·협력도·활동 실적을 서술한다.",
              "- 잘된 예: 전교 학생회장(2026.03.01.-2027.02.28.)으로서 학생 의견을 수렴하고 회의를 진행하는 역할을 수행함.",
              "- 잘못된 예(금지): 2학년: 전교 학생회장(2026.03.01.-2027.02.28.)으로서 …함.",
              "- 특기사항 문장 앞이나 중간에 «1학년:», «2학년:», «3학년:» 같은 학년 표기를 절대 넣지 않는다. 학년·학급 정보는 쓰지 않는다.",
              "- 임원 관찰 내용이 있으면 우선 반영하고, 없는 사실은 추가하지 않는다.",
            ]
          : [
              "",
              "창체 특기사항에는 «1학년:», «2학년:», «3학년:» 같은 학년 표기를 절대 넣지 않는다.",
            ]),
      ]
    : [];

  return [
    "당신은 대한민국 중학교 교사의 학교생활기록부 작성을 돕는 도우미다.",
    `작성 항목은 "${SECTION_LABELS[section]}"이다.`,
    SECTION_GUIDE[section],
    "",
    "작성 규칙:",
    "- 제공된 근거 자료(학생이 작성한 문서, 교사 관찰·메모, 체크된 활동, 상담·관련 자료)에 나타난 사실만 사용한다. 자료에 없는 내용은 절대 지어내지 않는다.",
    "- 사실과 관찰 중심으로 쓴다. 추측, 과장, 미사여구, 감탄, 상투적 칭찬 표현을 쓰지 않는다.",
    '- "매우", "정말", "훌륭하게", "뛰어난", "빛나는", "무궁무진한" 같은 막연한 수식어와 모호한 표현을 쓰지 않는다.',
    "- 평가어를 쓸 때는 반드시 그 판단의 근거가 되는 행동이나 산출물을 함께 적는다.",
    '- 문장은 "~함", "~임", "~하였음"과 같은 명사형(개조식) 종결로 끝낸다.',
    "- 학생 이름, 부모·친인척 정보, 교외 수상, 자격증, 어학 시험, 논문, 학교 밖 활동, 특정 대학·기관명은 쓰지 않는다.",
    '- 학생을 지칭할 때는 이름 대신 생략하거나 "본인" 등 중립적 표현을 쓴다.',
    limitRule,
    ...activityFormatRules,
    "",
    "등급별 초안 작성:",
    "- 반드시 최상, 상, 중, 하 네 등급의 초안을 각각 1개씩 작성한다.",
    "- 네 초안 모두 같은 근거 자료만 사용한다. 등급이 높다고 없는 사실을 만들지 않는다.",
    "- 등급은 '서술의 밀도·구체성·체계성' 차이를 의미한다. 창체의 경우 상위 등급일수록 역할·참여·협력·실적을 더 구체·체계적으로 서술한다.",
    levelGuide,
    "",
    "출력 형식:",
    '- 반드시 {"drafts":[{"level":"최상","text":"..."},{"level":"상","text":"..."},{"level":"중","text":"..."},{"level":"하","text":"..."}]} 형태의 JSON만 출력한다.',
    "- level 값은 반드시 최상, 상, 중, 하 중 하나다.",
    "- 각 text는 줄바꿈 없는 하나의 문단으로 작성한다.",
  ].join("\n");
}

export interface GenerationInput {
  section: Section;
  subjectName?: string;
  documents: { title: string; text: string; teacherNote: string }[];
  checkedActivities?: {
    date: string;
    title: string;
    note: string;
    observation?: string;
  }[];
  /** 자율활동 임원 기록 */
  officers?: {
    gradeLabel?: string;
    title: string;
    startDate: string;
    endDate: string;
    observation?: string;
  }[];
  extraNote?: string;
  /** 문서별 초안을 하나로 수합할 때 true */
  mergeMode?: boolean;
}

export function buildUserPrompt(input: GenerationInput) {
  const parts: string[] = [];
  const hasActivities = Boolean(input.checkedActivities?.length);
  const hasOfficers =
    input.section === "autonomy" && Boolean(input.officers?.length);
  const activityMode =
    isActivitySection(input.section) &&
    (hasActivities || hasOfficers) &&
    !input.mergeMode;

  if (input.subjectName) {
    parts.push(`[교과] ${input.subjectName}`);
  }

  if (input.mergeMode) {
    parts.push(
      "[수합 지시] 아래는 이미 작성된 특기사항 초안이다. 중복을 줄이고 흐름이 자연스럽도록 하나의 특기사항으로 수합하라. 각 초안에 없는 사실은 추가하지 않는다." +
        (isActivitySection(input.section)
          ? " «N학년:» 같은 학년 표기가 있으면 제거하고 수합하라."
          : ""),
    );
  }

  if (input.officers?.length && input.section === "autonomy") {
    const lines = input.officers.map((o) => {
      const label = formatOfficerLabel(o);
      const bits = [`- ${label}`];
      if (o.observation?.trim()) {
        bits.push(
          `  임원 기간 관찰(행동특성·참여도·협력도·활동실적): ${o.observation.trim()}`,
        );
      }
      return bits.join("\n");
    });
    parts.push(
      "[임원 활동 — 특기사항에 반드시 반영]\n" +
        "형식 예: 전교 학생회장(2026.03.01.-2027.02.28.)으로서 …함.\n" +
        "임원명·기간만 쓰고 «N학년:» 등 학년 정보는 절대 넣지 마라. 관찰 내용을 바탕으로 역할과 실적을 서술하라.\n" +
        lines.join("\n"),
    );
  }

  if (input.checkedActivities?.length) {
    const lines = input.checkedActivities.map((a) => {
      const date = formatActivityDate(a.date);
      const title = a.title.trim() || "활동";
      const head = date ? `${title}(${date})` : title;
      const bits = [`- ${head}`];
      if (a.note) bits.push(`  일정 비고: ${a.note}`);
      if (a.observation?.trim()) {
        bits.push(`  교사 관찰: ${a.observation.trim()}`);
      }
      return bits.join("\n");
    });
    parts.push(
      activityMode
        ? "[학생이 참여한 학교 활동 — 특기사항의 뼈대]\n" +
            "각 항목을 「활동명(날짜)에서 …함.」 형식으로 서술하라.\n" +
            "교사 관찰·학생 문서를 바탕으로 행동 특성, 참여도, 협력도, 활동 실적, 실제 역할을 충실히 반영하라.\n" +
            "아래 목록에 없는 활동은 쓰지 마라.\n" +
            lines.join("\n")
        : "[학생이 참여한 학교 활동]\n" + lines.join("\n"),
    );
  }

  input.documents.forEach((doc, i) => {
    if (input.mergeMode) {
      parts.push(
        `[문서별 초안 ${i + 1}${doc.title ? `: ${doc.title}` : ""}]\n${doc.text.trim()}`,
      );
      return;
    }
    const body = [
      `[학생 작성·상담·관련 자료 ${i + 1}${doc.title ? `: ${doc.title}` : ""}]`,
      doc.text.trim(),
    ];
    if (doc.teacherNote.trim()) {
      body.push(`[교사 추가 정보 ${i + 1}]\n${doc.teacherNote.trim()}`);
    }
    parts.push(body.join("\n"));
  });

  if (input.extraNote?.trim()) {
    parts.push(`[교사 추가 정보]\n${input.extraNote.trim()}`);
  }

  if (activityMode) {
    parts.push(
      [
        "위 임원·체크된 활동을 뼈대로 하고, 각 항목의 교사 관찰·학생 문서·상담 자료를 근거로 특기사항을 작성하라.",
        "활동·임원 기간에서 드러난 개별 행동 특성, 참여도, 협력도, 활동 실적과 실제 역할을 충실히 담아라.",
        "임원은 「임원명(시작일-종료일)」 형식만 쓰고 «N학년:» 표기는 금지한다. 일반 활동은 「활동명(YYYY.MM.DD.)에서 …함.」 형식을 따르며, 최상/상/중/하 등급 초안 4개를 JSON으로 작성하라.",
      ].join(" "),
    );
  } else {
    parts.push(
      input.mergeMode
        ? "위 문서별 초안만 사용하여 수합된 최상/상/중/하 등급 초안 4개를 JSON으로 작성하라."
        : "위 근거 자료만 사용하여 최상/상/중/하 등급 초안 4개를 JSON으로 작성하라.",
    );
  }

  return parts.join("\n\n");
}

export const OCR_PROMPT =
  "이 이미지는 학생이 작성한 학습활동지 또는 학교 문서다. 이미지에 적힌 글자를 그대로 옮겨 적어라. 해석, 요약, 설명을 덧붙이지 말고 본문 텍스트만 출력한다. 손글씨는 읽을 수 있는 범위에서 옮기고 판독이 어려운 부분은 (판독불가)로 표시한다.";
