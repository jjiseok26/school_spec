"use client";

import { useMemo, useState } from "react";
import { findDraft, useAppStore } from "@/lib/store";
import {
  formatActivityDate,
  formatOfficerLabel,
} from "@/lib/prompts";
import {
  ACTIVITY_CATEGORIES,
  DRAFT_LEVELS,
  PROVIDER_LABELS,
  SECTION_LABELS,
  type ActivityCategory,
  type Draft,
  type DraftLevel,
  type OfficerRole,
} from "@/lib/types";
import { copyText, orderCredentials } from "@/lib/utils";
import { DocumentDraftEditor } from "./PerDocumentDraft";
import {
  btnPrimary,
  btnSecondary,
  Card,
  Field,
  SegmentedTabs,
  inputClass,
} from "./ui";

export function scheduleDraftKey(scheduleItemId: string) {
  return `sch:${scheduleItemId}`;
}

export function officerDraftKey(officerId: string) {
  return `off:${officerId}`;
}

type Scope = "all" | ActivityCategory;

type ActivityRow = {
  id: string;
  date: string;
  title: string;
  note: string;
  observation: string;
};

async function callGenerate(
  body: Record<string, unknown>,
  onPriority?: (usedId: string | undefined, failedIds: string[]) => void,
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "생성 실패");
  onPriority?.(
    (json.used as { id?: string } | undefined)?.id,
    (json.failedIds as string[] | undefined) ?? [],
  );
  return json as {
    drafts: string[];
    levels?: Draft["levels"];
    used?: { id?: string; provider: Draft["provider"]; model: string };
    failedIds?: string[];
  };
}

/** 창체 특기사항: 영역별·항목별 초안 생성 */
export function CreativeDraftPanel({ studentId }: { studentId: string }) {
  const {
    data,
    upsertDraft,
    selectDraftOption,
    editDraft,
    confirmDraft,
    setCharLimit,
    adjustApiKeyPriority,
  } = useAppStore();
  const [scope, setScope] = useState<Scope>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const credentials = useMemo(
    () =>
      orderCredentials(data.settings.apiKeys, data.settings.activeApiKeyId),
    [data.settings.apiKeys, data.settings.activeApiKeyId],
  );

  function notePriority(usedId?: string, failedIds: string[] = []) {
    if (usedId) adjustApiKeyPriority(usedId, failedIds);
  }

  const checksByItem = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data.scheduleChecks) {
      if (c.studentId !== studentId) continue;
      map.set(c.scheduleItemId, c.observation ?? "");
    }
    return map;
  }, [data.scheduleChecks, studentId]);

  function activitiesFor(category: ActivityCategory): ActivityRow[] {
    return data.scheduleItems
      .filter(
        (item) => item.category === category && checksByItem.has(item.id),
      )
      .sort((a, b) =>
        `${a.date}-${a.title}`.localeCompare(`${b.date}-${b.title}`, "ko"),
      )
      .map((item) => ({
        id: item.id,
        date: item.date,
        title: item.title,
        note: item.note,
        observation: checksByItem.get(item.id) ?? "",
      }));
  }

  const officers = useMemo(
    () =>
      data.officers
        .filter((o) => o.studentId === studentId)
        .sort((a, b) =>
          `${a.startDate}-${a.title}`.localeCompare(
            `${b.startDate}-${b.title}`,
            "ko",
          ),
        ),
    [data.officers, studentId],
  );

  function docsFor(category: ActivityCategory) {
    return data.documents
      .filter((d) => d.studentId === studentId && d.section === category)
      .map((d) => ({
        title: d.title,
        text: d.text,
        teacherNote: d.teacherNote,
      }));
  }

  function composeLevelOptions(blocks: string[][]): string[] {
    return DRAFT_LEVELS.map((_, i) =>
      blocks
        .map((block) => block[i]?.trim() ?? "")
        .filter(Boolean)
        .join(" "),
    );
  }

  /** 임원·일정을 분리 생성한 뒤, 영역 최종 초안은 임원(앞)+일정(뒤)로 이어 붙인다. */
  async function runCategoryGeneration(category: ActivityCategory) {
    const activities = activitiesFor(category);
    const offs = category === "autonomy" ? officers : [];
    if (!activities.length && !offs.length) {
      throw new Error(
        `${SECTION_LABELS[category]}: 체크된 일정${category === "autonomy" ? "·임원" : ""}이 없습니다.`,
      );
    }

    const officerBlocks: string[][] = [];
    let levels: DraftLevel[] | undefined;
    let used:
      | { provider: Draft["provider"]; model: string }
      | undefined;

    if (offs.length) {
      for (const officer of offs) {
        setBusyKey(`off:${officer.id}`);
        const json = await callGenerate(
          {
            section: "autonomy",
            documents: docsFor("autonomy"),
            officers: [
              {
                title: officer.title,
                startDate: officer.startDate,
                endDate: officer.endDate,
                observation: officer.observation,
              },
            ],
            charLimit: data.settings.charLimits.autonomy,
            credentials,
          },
          notePriority,
        );
        upsertDraft({
          studentId,
          section: "autonomy",
          documentId: officerDraftKey(officer.id),
          options: json.drafts,
          levels: json.levels,
          provider: json.used?.provider,
          model: json.used?.model,
        });
        officerBlocks.push(json.drafts);
        levels = json.levels ?? levels;
        if (json.used) {
          used = { provider: json.used.provider, model: json.used.model };
        }
      }
    }

    let activityOptions: string[] | undefined;
    if (activities.length) {
      setBusyKey(`cat:${category}`);
      const json = await callGenerate(
        {
          section: category,
          documents: docsFor(category),
          checkedActivities: activities.map((a) => ({
            date: a.date,
            title: a.title,
            note: a.note,
            observation: a.observation,
          })),
          charLimit: data.settings.charLimits[category],
          credentials,
        },
        notePriority,
      );
      activityOptions = json.drafts;
      levels = json.levels ?? levels;
      if (json.used) {
        used = { provider: json.used.provider, model: json.used.model };
      }
    }

    const options = composeLevelOptions([
      ...(officerBlocks.length ? [composeLevelOptions(officerBlocks)] : []),
      ...(activityOptions ? [activityOptions] : []),
    ]);

    upsertDraft({
      studentId,
      section: category,
      options,
      levels: levels ?? [...DRAFT_LEVELS],
      provider: used?.provider,
      model: used?.model,
    });
  }

  async function generateCategory(category: ActivityCategory) {
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    setBusyKey(`cat:${category}`);
    setError("");
    try {
      await runCategoryGeneration(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusyKey(null);
    }
  }

  async function generateAllCategories() {
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    setError("");
    for (const category of ACTIVITY_CATEGORIES) {
      const activities = activitiesFor(category);
      const offs = category === "autonomy" ? officers : [];
      if (!activities.length && !offs.length) continue;
      setBusyKey(`cat:${category}`);
      try {
        await runCategoryGeneration(category);
      } catch (err) {
        setError(
          err instanceof Error
            ? `${SECTION_LABELS[category]}: ${err.message}`
            : "생성 실패",
        );
        setBusyKey(null);
        return;
      }
    }
    setBusyKey(null);
  }

  async function generateActivityItem(
    category: ActivityCategory,
    item: ActivityRow,
  ) {
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    setBusyKey(`sch:${item.id}`);
    setError("");
    try {
      const json = await callGenerate({
        section: category,
        documents: docsFor(category),
        checkedActivities: [
          {
            date: item.date,
            title: item.title,
            note: item.note,
            observation: item.observation,
          },
        ],
        charLimit: data.settings.charLimits[category],
        credentials,
      }, notePriority);
      upsertDraft({
        studentId,
        section: category,
        documentId: scheduleDraftKey(item.id),
        options: json.drafts,
        levels: json.levels,
        provider: json.used?.provider,
        model: json.used?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusyKey(null);
    }
  }

  async function generateOfficerItem(officer: OfficerRole) {
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    setBusyKey(`off:${officer.id}`);
    setError("");
    try {
      const json = await callGenerate({
        section: "autonomy",
        documents: docsFor("autonomy"),
        officers: [
          {
            title: officer.title,
            startDate: officer.startDate,
            endDate: officer.endDate,
            observation: officer.observation,
          },
        ],
        charLimit: data.settings.charLimits.autonomy,
        credentials,
      }, notePriority);
      upsertDraft({
        studentId,
        section: "autonomy",
        documentId: officerDraftKey(officer.id),
        options: json.drafts,
        levels: json.levels,
        provider: json.used?.provider,
        model: json.used?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusyKey(null);
    }
  }

  async function generateAllItems(category: ActivityCategory) {
    const activities = activitiesFor(category);
    const offs = category === "autonomy" ? officers : [];
    if (!activities.length && !offs.length) {
      setError(`${SECTION_LABELS[category]}에 생성할 항목이 없습니다.`);
      return;
    }
    setError("");
    for (const item of activities) {
      setBusyKey(`sch:${item.id}`);
      try {
        const json = await callGenerate({
          section: category,
          documents: docsFor(category),
          checkedActivities: [
            {
              date: item.date,
              title: item.title,
              note: item.note,
              observation: item.observation,
            },
          ],
          charLimit: data.settings.charLimits[category],
          credentials,
        }, notePriority);
        upsertDraft({
          studentId,
          section: category,
          documentId: scheduleDraftKey(item.id),
          options: json.drafts,
          levels: json.levels,
          provider: json.used?.provider,
          model: json.used?.model,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "생성 실패");
        setBusyKey(null);
        return;
      }
    }
    if (category === "autonomy") {
      for (const officer of offs) {
        setBusyKey(`off:${officer.id}`);
        try {
          const json = await callGenerate({
            section: "autonomy",
            documents: docsFor("autonomy"),
            officers: [
              {
                title: officer.title,
                startDate: officer.startDate,
                endDate: officer.endDate,
                observation: officer.observation,
              },
            ],
            charLimit: data.settings.charLimits.autonomy,
            credentials,
          }, notePriority);
          upsertDraft({
            studentId,
            section: "autonomy",
            documentId: officerDraftKey(officer.id),
            options: json.drafts,
            levels: json.levels,
            provider: json.used?.provider,
            model: json.used?.model,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "생성 실패");
          setBusyKey(null);
          return;
        }
      }
    }
    setBusyKey(null);
  }

  async function mergeItemDrafts(category: ActivityCategory) {
    if (!credentials.length) {
      setError("설정에서 API 키를 등록하세요.");
      return;
    }
    const activities = activitiesFor(category);
    const offs = category === "autonomy" ? officers : [];
    const pieces: { title: string; text: string; teacherNote: string }[] = [];

    // 임원 초안을 앞에 두고, 일정 초안을 뒤에 둠
    for (const officer of offs) {
      const draft = findDraft(
        data.drafts,
        studentId,
        "autonomy",
        undefined,
        officerDraftKey(officer.id),
      );
      const text = draft?.edited.trim() || "";
      if (!text) continue;
      pieces.push({
        title: formatOfficerLabel(officer),
        text,
        teacherNote: "",
      });
    }
    for (const item of activities) {
      const draft = findDraft(
        data.drafts,
        studentId,
        category,
        undefined,
        scheduleDraftKey(item.id),
      );
      const text = draft?.edited.trim() || "";
      if (!text) continue;
      pieces.push({
        title: item.title || "일정",
        text,
        teacherNote: "",
      });
    }

    if (!pieces.length) {
      setError(
        "수합할 항목별 초안이 없습니다. 먼저 각 항목의 초안을 생성·확정하세요.",
      );
      return;
    }

    setBusyKey(`merge:${category}`);
    setError("");
    try {
      const json = await callGenerate({
        section: category,
        documents: pieces,
        mergeMode: true,
        charLimit: data.settings.charLimits[category],
        credentials,
      }, notePriority);
      upsertDraft({
        studentId,
        section: category,
        options: json.drafts,
        levels: json.levels,
        provider: json.used?.provider,
        model: json.used?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "수합 실패");
    } finally {
      setBusyKey(null);
    }
  }

  async function onCopy(text: string) {
    if (!text) return;
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const busy = busyKey !== null;
  const visibleCategories: ActivityCategory[] =
    scope === "all" ? [...ACTIVITY_CATEGORIES] : [scope];

  const totalReady = ACTIVITY_CATEGORIES.reduce((sum, cat) => {
    const n =
      activitiesFor(cat).length + (cat === "autonomy" ? officers.length : 0);
    return sum + n;
  }, 0);

  return (
    <div className="space-y-4">
      <Card title="창체 초안 생성">
        <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
          체크한 일정·임원을 항목별로 초안을 만들거나, 자율·진로·봉사 영역별로 한
          번에 생성할 수 있습니다. 임원 활동은 일정과 따로 작성되며, 영역 최종
          특기사항에서는 임원 내용이 앞에 이어집니다.
        </p>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="글자 수 제한 (영역별)">
            <div className="grid gap-2">
              {ACTIVITY_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-[var(--ink-muted-48)]">
                    {SECTION_LABELS[cat]}
                  </span>
                  <input
                    className={inputClass}
                    value={data.settings.charLimits[cat]}
                    onChange={(e) => setCharLimit(cat, e.target.value)}
                    placeholder="무제한"
                    inputMode="numeric"
                  />
                </div>
              ))}
            </div>
          </Field>
          <Field label="1순위 API 키">
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] px-3 py-2 text-sm text-[var(--ink-muted-80)]">
              {(() => {
                const first = credentials[0];
                return first
                  ? `${first.label ?? PROVIDER_LABELS[first.provider]} · ${PROVIDER_LABELS[first.provider]}`
                  : "미선택 (설정에서 등록)";
              })()}
            </div>
          </Field>
        </div>

        <SegmentedTabs
          tabs={[
            { id: "all" as const, label: "전체" },
            ...ACTIVITY_CATEGORIES.map((cat) => ({
              id: cat,
              label: SECTION_LABELS[cat],
            })),
          ]}
          value={scope}
          onChange={setScope}
        />

        {scope === "all" ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[18px] border border-[var(--hairline)] bg-[var(--parchment)] p-3">
            <p className="flex-1 text-sm text-[var(--ink-muted-80)]">
              체크·임원 항목이 있는 영역을 순서대로 생성합니다. (대상{" "}
              {totalReady}건)
            </p>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || totalReady === 0}
              onClick={() => void generateAllCategories()}
            >
              {busyKey?.startsWith("cat:")
                ? "영역별 생성 중…"
                : "전체 영역 일정 기반 초안 생성"}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mb-3 whitespace-pre-wrap rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </Card>

      {visibleCategories.map((category) => {
        const activities = activitiesFor(category);
        const offs = category === "autonomy" ? officers : [];
        const merged = findDraft(data.drafts, studentId, category);
        const itemDraftCount =
          activities.filter((a) =>
            Boolean(
              findDraft(
                data.drafts,
                studentId,
                category,
                undefined,
                scheduleDraftKey(a.id),
              )?.edited.trim(),
            ),
          ).length +
          offs.filter((o) =>
            Boolean(
              findDraft(
                data.drafts,
                studentId,
                "autonomy",
                undefined,
                officerDraftKey(o.id),
              )?.edited.trim(),
            ),
          ).length;
        const itemTotal = activities.length + offs.length;

        return (
          <Card
            key={category}
            title={SECTION_LABELS[category]}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy || itemTotal === 0}
                  onClick={() => void generateAllItems(category)}
                >
                  {busyKey?.startsWith("sch:") || busyKey?.startsWith("off:")
                    ? "항목별 생성 중…"
                    : `모든 항목 초안 생성 (${itemTotal})`}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy || itemDraftCount === 0}
                  onClick={() => void mergeItemDrafts(category)}
                >
                  {busyKey === `merge:${category}`
                    ? "수합 중…"
                    : `항목 초안 수합 (${itemDraftCount}/${itemTotal})`}
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || itemTotal === 0}
                  onClick={() => void generateCategory(category)}
                >
                  {busyKey === `cat:${category}`
                    ? "생성 중…"
                    : "영역 일정 기반 초안 생성"}
                </button>
              </div>
            }
          >
            {itemTotal === 0 ? (
              <p className="text-sm text-[var(--ink-muted-48)]">
                이 영역에 체크된 일정이
                {category === "autonomy" ? "·임원이" : "이"} 없습니다. 일정
                체크
                {category === "autonomy" ? "·임원" : ""} 탭에서 먼저
                등록하세요.
              </p>
            ) : (
              <div className="space-y-3">
                {category === "autonomy" && offs.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted-48)]">
                      임원 (항목별)
                    </p>
                    {offs.map((officer) => {
                      const key = officerDraftKey(officer.id);
                      const draft = findDraft(
                        data.drafts,
                        studentId,
                        "autonomy",
                        undefined,
                        key,
                      );
                      return (
                        <ItemDraftBlock
                          key={officer.id}
                          label={formatOfficerLabel(officer)}
                          hint={
                            officer.observation.trim()
                              ? `관찰: ${officer.observation.trim()}`
                              : "관찰 없음"
                          }
                          draft={draft}
                          busy={busyKey === `off:${officer.id}`}
                          disabled={busy}
                          onGenerate={() => void generateOfficerItem(officer)}
                          onSelect={(i) => {
                            if (draft) selectDraftOption(draft.id, i);
                          }}
                          onEdit={(text) => {
                            if (draft) editDraft(draft.id, text);
                          }}
                          onConfirm={() => {
                            if (draft) confirmDraft(draft.id);
                          }}
                        />
                      );
                    })}
                  </div>
                ) : null}

                {activities.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted-48)]">
                      체크한 일정 (항목별)
                    </p>
                    {activities.map((item) => {
                      const key = scheduleDraftKey(item.id);
                      const draft = findDraft(
                        data.drafts,
                        studentId,
                        category,
                        undefined,
                        key,
                      );
                      const date = formatActivityDate(item.date);
                      const title = item.title.trim() || "활동";
                      return (
                        <ItemDraftBlock
                          key={item.id}
                          label={date ? `${title}(${date})` : title}
                          hint={
                            item.observation.trim()
                              ? `관찰: ${item.observation.trim()}`
                              : item.note
                                ? `비고: ${item.note}`
                                : "관찰 없음"
                          }
                          draft={draft}
                          busy={busyKey === `sch:${item.id}`}
                          disabled={busy}
                          onGenerate={() =>
                            void generateActivityItem(category, item)
                          }
                          onSelect={(i) => {
                            if (draft) selectDraftOption(draft.id, i);
                          }}
                          onEdit={(text) => {
                            if (draft) editDraft(draft.id, text);
                          }}
                          onConfirm={() => {
                            if (draft) confirmDraft(draft.id);
                          }}
                        />
                      );
                    })}
                  </div>
                ) : null}

                <div className="border-t border-[var(--hairline)] pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted-48)]">
                    {SECTION_LABELS[category]} 영역 특기사항 (최종)
                  </p>
                  {!merged ? (
                    <p className="text-sm text-[var(--ink-muted-48)]">
                      «영역 일정 기반 초안 생성» 또는 «항목 초안 수합»으로 최종
                      특기사항을 만드세요.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <DocumentDraftEditor
                        draft={merged}
                        onSelect={(i) => selectDraftOption(merged.id, i)}
                        onEdit={(text) => editDraft(merged.id, text)}
                        onConfirm={() => confirmDraft(merged.id)}
                      />
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => void onCopy(merged.edited)}
                      >
                        {copied ? "복사됨" : "확정문 복사"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ItemDraftBlock({
  label,
  hint,
  draft,
  busy,
  disabled,
  onGenerate,
  onSelect,
  onEdit,
  onConfirm,
}: {
  label: string;
  hint: string;
  draft?: Draft;
  busy: boolean;
  disabled: boolean;
  onGenerate: () => void;
  onSelect: (index: number) => void;
  onEdit: (text: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--hairline)] bg-white p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--ink)]">{label}</p>
          <p className="text-xs text-[var(--ink-muted-48)]">{hint}</p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          disabled={disabled}
          onClick={onGenerate}
        >
          {busy ? "생성 중…" : draft ? "초안 다시 생성" : "이 항목 초안 생성"}
        </button>
      </div>
      {!draft ? (
        <p className="text-sm text-[var(--ink-muted-48)]">
          아직 초안이 없습니다.
        </p>
      ) : (
        <DocumentDraftEditor
          draft={draft}
          onSelect={onSelect}
          onEdit={onEdit}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
}
