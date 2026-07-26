import { NextResponse } from "next/server";
import {
  completeWithFallback,
  estimateDraftMaxTokens,
  parseLeveledDrafts,
  type CompletionRequest,
} from "@/lib/providers";
import {
  buildSystemPrompt,
  buildUserPrompt,
  stripGradeMarkersFromCreativeDraft,
} from "@/lib/prompts";
import {
  ACTIVITY_CATEGORIES,
  DRAFT_LEVELS,
  type Credential,
  type Section,
} from "@/lib/types";
import { parseCharLimit } from "@/lib/utils";

export const runtime = "nodejs";

interface GenerateBody {
  section: Section;
  subjectName?: string;
  documents?: { title: string; text: string; teacherNote: string }[];
  checkedActivities?: {
    date: string;
    title: string;
    note: string;
    observation?: string;
  }[];
  officers?: {
    gradeLabel?: string;
    title: string;
    startDate: string;
    endDate: string;
    observation?: string;
  }[];
  extraNote?: string;
  mergeMode?: boolean;
  charLimit?: string | number | null;
  credentials: Credential[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateBody;
    if (!body.section) {
      return NextResponse.json(
        { error: "작성 항목(section)이 필요합니다." },
        { status: 400 },
      );
    }
    if (!body.credentials?.length) {
      return NextResponse.json(
        { error: "사용할 API 키가 없습니다. 설정에서 등록하세요." },
        { status: 400 },
      );
    }

    const charLimit =
      typeof body.charLimit === "number"
        ? body.charLimit
        : parseCharLimit(String(body.charLimit ?? ""));

    const system = buildSystemPrompt(body.section, charLimit);
    const user = buildUserPrompt({
      section: body.section,
      subjectName: body.subjectName,
      documents: body.documents ?? [],
      checkedActivities: body.checkedActivities,
      officers: body.officers,
      extraNote: body.extraNote,
      mergeMode: body.mergeMode,
    });

    if (!user.trim() || user.trim().startsWith("위 근거 자료만")) {
      return NextResponse.json(
        { error: "생성에 사용할 근거 자료가 없습니다." },
        { status: 400 },
      );
    }

    const primaryProvider = body.credentials[0]?.provider;
    const request: CompletionRequest = {
      system,
      user,
      json: true,
      maxTokens: estimateDraftMaxTokens(charLimit, primaryProvider),
    };

    const first = await completeWithFallback(body.credentials, request);
    let text = first.text;
    let credential = first.credential;
    let failedIds = [...first.failedIds];
    let parsed = parseLeveledDrafts(text);

    if (parsed.options.length < DRAFT_LEVELS.length) {
      try {
        // 이미 성공한 키로만 재시도 — 처음부터 다시 폴백하면 NVIDIA 지연이 배가됨
        const retry = await completeWithFallback([credential], {
          ...request,
          maxTokens: estimateDraftMaxTokens(charLimit, credential.provider),
          user:
            user +
            `\n\n이전에 ${parsed.options.length}개만 나왔습니다. 최상/상/중/하 네 등급 초안을 모두 JSON으로 다시 작성하세요.`,
        });
        const more = parseLeveledDrafts(retry.text);
        if (more.options.length >= parsed.options.length) {
          parsed = more;
          text = retry.text;
          credential = retry.credential;
          failedIds = [...new Set([...failedIds, ...retry.failedIds])];
        }
      } catch {
        // 기존 초안이라도 반환
      }
    }

    if (!parsed.options.length) {
      return NextResponse.json(
        { error: "초안을 파싱하지 못했습니다. 다른 모델/키로 다시 시도하세요." },
        { status: 502 },
      );
    }

    const isCreative = (ACTIVITY_CATEGORIES as readonly string[]).includes(
      body.section,
    );
    const drafts = isCreative
      ? parsed.options.map(stripGradeMarkersFromCreativeDraft)
      : parsed.options;

    return NextResponse.json({
      drafts,
      levels: parsed.levels,
      used: {
        id: credential.id,
        provider: credential.provider,
        model: credential.model,
        label: credential.label,
      },
      failedIds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "초안 생성에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
