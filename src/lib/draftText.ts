import type { Draft } from "./types";

/** 확정·선택·옵션 순으로 표시할 초안 본문 */
export function getDraftText(
  draft:
    | {
        edited?: string;
        options?: string[];
        selected?: number | null;
      }
    | undefined,
): string {
  if (!draft) return "";
  const edited = draft.edited?.trim() ?? "";
  if (edited) return edited;
  if (
    draft.selected != null &&
    draft.selected >= 0 &&
    draft.options?.[draft.selected]?.trim()
  ) {
    return draft.options[draft.selected].trim();
  }
  return (draft.options ?? []).find((t) => t.trim())?.trim() ?? "";
}

export type MergePiece = {
  title: string;
  text: string;
  teacherNote: string;
  level?: string;
  confirmed: boolean;
};

export function collectDocumentMergePieces(
  documents: { id: string; title: string }[],
  drafts: Draft[],
  studentId: string,
  section: Draft["section"],
  subjectId?: string,
): MergePiece[] {
  const pieces: MergePiece[] = [];
  for (const doc of documents) {
    const draft = drafts.find(
      (d) =>
        d.studentId === studentId &&
        d.section === section &&
        d.documentId === doc.id &&
        (subjectId ? d.subjectId === subjectId : !d.subjectId),
    );
    if (!draft) continue;
    if (!draft.confirmed && !getDraftText(draft)) continue;
    const text = getDraftText(draft);
    if (!text) continue;
    pieces.push({
      title: doc.title || "문서",
      text,
      teacherNote: "",
      level:
        draft.selected != null
          ? draft.levels?.[draft.selected]
          : undefined,
      confirmed: draft.confirmed,
    });
  }
  const confirmed = pieces.filter((p) => p.confirmed);
  return confirmed.length ? confirmed : pieces;
}
