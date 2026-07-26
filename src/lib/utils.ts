import type { ActivityCategory, ApiKeyEntry, Credential } from "./types";

export function parseCharLimit(value: string | undefined | null) {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function orderCredentials(
  apiKeys: ApiKeyEntry[],
  activeApiKeyId: string | null,
): Credential[] {
  const enabled = apiKeys.filter((k) => k.enabled && k.apiKey.trim());
  if (!enabled.length) return [];

  const active = activeApiKeyId
    ? enabled.find((k) => k.id === activeApiKeyId)
    : undefined;
  const rest = enabled.filter((k) => k.id !== active?.id);

  // 같은 제공자 키를 우선 폴백한다.
  const ordered: ApiKeyEntry[] = [];
  if (active) {
    ordered.push(active);
    ordered.push(...rest.filter((k) => k.provider === active.provider));
    ordered.push(...rest.filter((k) => k.provider !== active.provider));
  } else {
    ordered.push(...rest);
  }

  return ordered.map((k) => ({
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

function findHeader(header: string[], aliases: string[]) {
  return header.findIndex((h) => aliases.includes(h));
}

function normalizeCategory(raw: string): ActivityCategory {
  const value = raw.trim().toLowerCase();
  if (
    value.includes("진로") ||
    value.includes("career") ||
    value === "진로활동"
  ) {
    return "career";
  }
  if (
    value.includes("봉사") ||
    value.includes("volunteer") ||
    value.includes("service")
  ) {
    return "volunteer";
  }
  return "autonomy";
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

export const SCHEDULE_TEMPLATE_CSV = [
  "날짜,구분,활동명,비고",
  "2026-03-05,자율,학급회의,반장 선출",
  "2026-04-12,진로,진로체험의 날,직업인 초청",
  "2026-05-20,봉사,교내 환경정화,운동장 주변",
].join("\n");

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

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
