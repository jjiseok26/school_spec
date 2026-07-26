import type { ActivityCategory, ApiKeyEntry, Credential } from "./types";

export function parseCharLimit(value: string | undefined | null) {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function orderCredentials(
  apiKeys: ApiKeyEntry[],
  _activeApiKeyId?: string | null,
): Credential[] {
  // 배열 순서가 우선순위(앞이 높음). activeApiKeyId는 UI 표시용으로 유지.
  return apiKeys
    .filter((k) => k.enabled && k.apiKey.trim())
    .map((k) => ({
      id: k.id,
      provider: k.provider,
      apiKey: k.apiKey.trim(),
      model: k.model,
      label: k.label,
    }));
}

export function parseScheduleCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dateIdx = findHeader(header, ["date", "날짜", "일자"]);
  const categoryIdx = findHeader(header, ["category", "구분", "유형", "영역"]);
  const titleIdx = findHeader(header, ["title", "활동명", "활동", "내용"]);
  const noteIdx = findHeader(header, ["note", "비고", "메모", "설명"]);

  if (titleIdx < 0) {
    throw new Error("CSV에 '활동명' 또는 'title' 열이 필요합니다.");
  }

  const items: {
    date: string;
    category: ActivityCategory;
    title: string;
    note: string;
  }[] = [];

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const title = (cols[titleIdx] ?? "").trim();
    if (!title) continue;
    const category = normalizeCategory(
      categoryIdx >= 0 ? cols[categoryIdx] ?? "" : "autonomy",
    );
    items.push({
      date: dateIdx >= 0 ? (cols[dateIdx] ?? "").trim() : "",
      category,
      title,
      note: noteIdx >= 0 ? (cols[noteIdx] ?? "").trim() : "",
    });
  }
  return items;
}

function normalizeCategory(raw: string): ActivityCategory {
  const v = raw.trim().toLowerCase();
  if (v.includes("진로") || v.includes("career")) return "career";
  if (v.includes("봉사") || v.includes("volunteer") || v.includes("service"))
    return "volunteer";
  return "autonomy";
}

function findHeader(header: string[], aliases: string[]) {
  return header.findIndex((h) => aliases.some((a) => h.includes(a)));
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "application/json",
) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
