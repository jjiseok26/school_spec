import { DEFAULT_MODELS, DRAFT_LEVELS, PROVIDER_LABELS, type Credential, type DraftLevel, isDraftLevel } from "./types";

export interface ImagePart {
  mediaType: string;
  base64: string;
}

export interface CompletionRequest {
  system: string;
  user: string;
  image?: ImagePart;
  json: boolean;
  maxTokens?: number;
}

const OPENAI_COMPATIBLE_BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
};

async function readError(res: Response) {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message ?? parsed?.message ?? raw;
  } catch {
    return raw;
  }
}

async function callOpenAiCompatible(
  credential: Credential,
  request: CompletionRequest,
) {
  const base = OPENAI_COMPATIBLE_BASE[credential.provider];
  const content: unknown = request.image
    ? [
        { type: "text", text: request.user },
        {
          type: "image_url",
          image_url: {
            url: `data:${request.image.mediaType};base64,${request.image.base64}`,
          },
        },
      ]
    : request.user;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credential.apiKey}`,
    },
    body: JSON.stringify({
      model: credential.model || DEFAULT_MODELS[credential.provider],
      messages: [
        { role: "system", content: request.system },
        { role: "user", content },
      ],
      temperature: 0.7,
      max_tokens: request.maxTokens ?? 4096,
      ...(request.json && credential.provider === "openai"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

async function callGoogle(credential: Credential, request: CompletionRequest) {
  const model = credential.model || DEFAULT_MODELS.google;
  const parts: unknown[] = [{ text: request.user }];
  if (request.image) {
    parts.push({
      inline_data: {
        mime_type: request.image.mediaType,
        data: request.image.base64,
      },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": credential.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: request.maxTokens ?? 4096,
          ...(request.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const candidateParts = data?.candidates?.[0]?.content?.parts ?? [];
  return candidateParts
    .map((part: { text?: string }) => part?.text ?? "")
    .join("");
}

async function callAnthropic(
  credential: Credential,
  request: CompletionRequest,
) {
  const content: unknown[] = [];
  if (request.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: request.image.mediaType,
        data: request.image.base64,
      },
    });
  }
  content.push({ type: "text", text: request.user });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": credential.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: credential.model || DEFAULT_MODELS.anthropic,
      system: request.system,
      max_tokens: request.maxTokens ?? 4096,
      temperature: 0.7,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return (data?.content ?? [])
    .map((block: { type: string; text?: string }) =>
      block?.type === "text" ? (block.text ?? "") : "",
    )
    .join("");
}

export async function complete(
  credential: Credential,
  request: CompletionRequest,
) {
  if (!credential.apiKey) {
    throw new Error(`${PROVIDER_LABELS[credential.provider]} API 키가 없습니다.`);
  }
  switch (credential.provider) {
    case "google":
      return callGoogle(credential, request);
    case "anthropic":
      return callAnthropic(credential, request);
    case "openai":
    case "nvidia":
      return callOpenAiCompatible(credential, request);
    default:
      throw new Error("지원하지 않는 AI 제공자입니다.");
  }
}

export interface CompletionResult {
  text: string;
  credential: Credential;
  /** 성공 전에 실패한 키 id (우선순위 자동 조정용) */
  failedIds: string[];
}

/** 첫 번째 자격 증명부터 순서대로 시도하고, 실패하면 다음 키로 넘어간다. */
export async function completeWithFallback(
  credentials: Credential[],
  request: CompletionRequest,
): Promise<CompletionResult> {
  const errors: string[] = [];
  const failedIds: string[] = [];
  for (const credential of credentials) {
    try {
      const text = await complete(credential, request);
      if (text.trim()) return { text, credential, failedIds };
      errors.push(
        `${credential.label ?? PROVIDER_LABELS[credential.provider]}: 빈 응답`,
      );
      if (credential.id) failedIds.push(credential.id);
    } catch (error) {
      errors.push(
        `${credential.label ?? PROVIDER_LABELS[credential.provider]}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (credential.id) failedIds.push(credential.id);
    }
  }
  throw new Error(
    errors.length
      ? `모든 API 키가 실패했습니다.\n${errors.join("\n")}`
      : "사용 가능한 API 키가 없습니다. 설정에서 키를 등록하세요.",
  );
}

/** 모델이 코드블록이나 설명을 덧붙여도 등급별 초안을 뽑아낸다. */
export function parseLeveledDrafts(raw: string): {
  options: string[];
  levels: DraftLevel[];
} {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const candidates = [cleaned];
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) candidates.push(arrayMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const fromMap: { level: DraftLevel; text: string }[] = [];
        for (const level of DRAFT_LEVELS) {
          const text = parsed[level] ?? parsed.drafts?.[level];
          if (typeof text === "string" && text.trim()) {
            fromMap.push({ level, text: text.trim() });
          }
        }
        if (fromMap.length) {
          return {
            options: fromMap.map((d) => d.text),
            levels: fromMap.map((d) => d.level),
          };
        }
      }

      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.drafts)
          ? parsed.drafts
          : null;

      if (list) {
        const items = list
          .map((item: unknown, index: number) => {
            if (typeof item === "string") {
              return {
                level: DRAFT_LEVELS[index] ?? ("중" as DraftLevel),
                text: item.trim(),
              };
            }
            if (item && typeof item === "object") {
              const obj = item as { level?: string; text?: string };
              const levelRaw = String(obj.level ?? "").trim();
              const level = isDraftLevel(levelRaw)
                ? levelRaw
                : (DRAFT_LEVELS[index] ?? "중");
              const text = String(obj.text ?? "").trim();
              return text ? { level, text } : null;
            }
            return null;
          })
          .filter(Boolean) as { level: DraftLevel; text: string }[];

        if (items.length) {
          const ordered = DRAFT_LEVELS.map((level) =>
            items.find((item) => item.level === level),
          ).filter(Boolean) as { level: DraftLevel; text: string }[];
          const finalItems = ordered.length ? ordered : items;
          return {
            options: finalItems.map((d) => d.text),
            levels: finalItems.map((d) => d.level),
          };
        }
      }
    } catch {
      // 다음 후보
    }
  }

  const fallback = cleaned ? [cleaned] : [];
  return {
    options: fallback,
    levels: fallback.map((_, i) => DRAFT_LEVELS[i] ?? "중"),
  };
}

export function parseDrafts(raw: string): string[] {
  return parseLeveledDrafts(raw).options;
}
