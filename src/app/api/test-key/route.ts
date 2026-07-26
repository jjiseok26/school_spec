import { NextResponse } from "next/server";
import { complete } from "@/lib/providers";
import type { Credential } from "@/lib/types";
import { DEFAULT_MODELS, PROVIDER_LABELS } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { credential?: Credential };
    if (!body.credential?.apiKey) {
      return NextResponse.json(
        { error: "API 키가 필요합니다." },
        { status: 400 },
      );
    }

    const credential: Credential = {
      provider: body.credential.provider,
      apiKey: body.credential.apiKey,
      model: body.credential.model || DEFAULT_MODELS[body.credential.provider],
      label: body.credential.label,
    };

    const text = await complete(credential, {
      system: "You are a connectivity checker. Reply with OK only.",
      user: "ping",
      json: false,
      maxTokens: 16,
    });

    return NextResponse.json({
      ok: true,
      provider: credential.provider,
      providerLabel: PROVIDER_LABELS[credential.provider],
      model: credential.model,
      preview: text.slice(0, 80),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "연결 테스트에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
