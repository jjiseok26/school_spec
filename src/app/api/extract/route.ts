import { NextResponse } from "next/server";
import {
  arrayBufferToBase64,
  extractTextFromFile,
  isImageFile,
} from "@/lib/extract";
import { OCR_PROMPT } from "@/lib/prompts";
import { completeWithFallback } from "@/lib/providers";
import type { Credential } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "파일이 필요합니다." },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const extracted = await extractTextFromFile(
      file.name,
      buffer,
      file.type || undefined,
    );

    if (!extracted.needsOcr) {
      return NextResponse.json({
        text: extracted.text,
        source: file.name,
        ocr: false,
      });
    }

    const credentialsRaw = form.get("credentials");
    if (typeof credentialsRaw !== "string") {
      return NextResponse.json(
        {
          error:
            "이미지 OCR에는 API 키가 필요합니다. 설정에서 키를 등록한 뒤 다시 시도하세요.",
        },
        { status: 400 },
      );
    }

    let credentials: Credential[];
    try {
      credentials = JSON.parse(credentialsRaw) as Credential[];
    } catch {
      return NextResponse.json(
        { error: "API 키 정보가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (!credentials.length) {
      return NextResponse.json(
        { error: "사용 가능한 API 키가 없습니다." },
        { status: 400 },
      );
    }

    const { text, credential, failedIds } = await completeWithFallback(credentials, {
      system: OCR_PROMPT,
      user: "이미지의 텍스트를 추출하세요.",
      image: {
        mediaType: extracted.mediaType || file.type || "image/jpeg",
        base64: arrayBufferToBase64(buffer),
      },
      json: false,
      maxTokens: credentials[0]?.provider === "nvidia" ? 2048 : 4096,
    });

    return NextResponse.json({
      text: text.trim(),
      source: file.name,
      ocr: true,
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
          error instanceof Error
            ? error.message
            : "문서 텍스트 추출에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    supported: [
      "txt",
      "docx",
      "pdf",
      "hwpx",
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
    ],
    note: "구형 .hwp는 .hwpx 또는 PDF로 변환해 주세요.",
    imageHint: isImageFile("x.png") ? "images supported" : "",
  });
}
