import JSZip from "jszip";

function decodeUtf8(buffer: ArrayBuffer) {
  return new TextDecoder("utf-8").decode(buffer);
}

async function extractDocx(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("docx에서 본문을 찾을 수 없습니다.");
  return xml
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractHwpx(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /Contents\/section\d+\.xml$/i.test(name))
    .sort();
  if (!sectionFiles.length) {
    throw new Error("hwpx에서 본문 section을 찾을 수 없습니다.");
  }
  const chunks: string[] = [];
  for (const name of sectionFiles) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) continue;
    const texts = [...xml.matchAll(/<(?:hp:)?t\b[^>]*>([\s\S]*?)<\/(?:hp:)?t>/gi)].map(
      (m) =>
        m[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'"),
    );
    chunks.push(texts.join(""));
  }
  const text = chunks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("hwpx에서 텍스트를 추출하지 못했습니다.");
  return text;
}

async function extractPdf(buffer: ArrayBuffer) {
  // pdf-parse 기본 엔트리는 테스트 PDF를 로드하려 해서 구현 파일을 직접 사용한다.
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (mod.default ?? mod) as (
    data: Buffer,
  ) => Promise<{ text: string }>;
  const result = await pdfParse(Buffer.from(buffer));
  const text = (result.text ?? "").trim();
  if (!text) throw new Error("PDF에서 텍스트를 추출하지 못했습니다.");
  return text;
}

export function isImageFile(name: string, mime?: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

export async function extractTextFromFile(
  fileName: string,
  buffer: ArrayBuffer,
  mime?: string,
): Promise<{ text: string; needsOcr: boolean; mediaType?: string }> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".txt") || mime === "text/plain") {
    return { text: decodeUtf8(buffer), needsOcr: false };
  }
  if (lower.endsWith(".docx")) {
    return { text: await extractDocx(buffer), needsOcr: false };
  }
  if (lower.endsWith(".hwpx")) {
    return { text: await extractHwpx(buffer), needsOcr: false };
  }
  if (lower.endsWith(".hwp")) {
    throw new Error(
      "구형 .hwp는 직접 추출을 지원하지 않습니다. .hwpx로 저장하거나 PDF/텍스트로 변환해 주세요.",
    );
  }
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    return { text: await extractPdf(buffer), needsOcr: false };
  }
  if (isImageFile(fileName, mime)) {
    return {
      text: "",
      needsOcr: true,
      mediaType: mime || guessImageMime(fileName),
    };
  }

  // 알 수 없는 형식은 UTF-8 텍스트로 시도
  const asText = decodeUtf8(buffer).trim();
  if (asText && !asText.includes("\u0000")) {
    return { text: asText, needsOcr: false };
  }
  throw new Error(
    `지원하지 않는 파일 형식입니다: ${fileName}. txt, docx, pdf, hwpx, 이미지 파일을 사용해 주세요.`,
  );
}

function guessImageMime(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}
