"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppShell,
  Card,
  Field,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/ui";
import { useAppStore } from "@/lib/store";
import {
  DEFAULT_MODELS,
  PROVIDER_LABELS,
  SECTION_LABELS,
  listModelsForProvider,
  type AppData,
  type Provider,
  type Section,
} from "@/lib/types";
import { downloadTextFile } from "@/lib/utils";

const PROVIDERS = Object.keys(PROVIDER_LABELS) as Provider[];
const API_KEY_LINKS = [
  {
    label: "Google Gemini API 키 발급",
    url: "https://aistudio.google.com/app/apikey",
  },
  {
    label: "NVIDIA NIM 무료 API 키 발급",
    url: "https://build.nvidia.com/settings/api-keys",
  },
  {
    label: "Meta Llama API 키 발급",
    url: "https://llama.developer.meta.com/docs/api-keys/",
  },
] as const;

const SETTINGS_SECTIONS = [
  { id: "teacher", label: "교사 정보" },
  { id: "api", label: "API 키" },
  { id: "models", label: "모델" },
  { id: "options", label: "생성 옵션" },
  { id: "backup", label: "백업" },
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

function isListedModel(
  modelId: string,
  options: { modelId: string }[],
) {
  return options.some((m) => m.modelId === modelId);
}

export default function SettingsPage() {
  const {
    data,
    addApiKey,
    updateApiKey,
    removeApiKey,
    setActiveApiKey,
    moveApiKey,
    addCustomModel,
    updateCustomModel,
    removeCustomModel,
    setCharLimit,
    setIncludeKeysInExport,
    setTeacherSubjectId,
    setTeacherClassName,
    exportData,
    importData,
    reset,
  } = useAppStore();

  const customModels = data.settings.customModels ?? [];

  const [form, setForm] = useState({
    label: "",
    provider: "google" as Provider,
    apiKey: "",
    model: DEFAULT_MODELS.google,
  });
  const [modelForm, setModelForm] = useState({
    provider: "google" as Provider,
    modelId: "",
    label: "",
  });
  const [message, setMessage] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("teacher");
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollingRef = useRef(false);

  const modelOptions = useMemo(
    () => listModelsForProvider(form.provider, customModels),
    [form.provider, customModels],
  );
  const formUsesCustomModel = !isListedModel(form.model, modelOptions);

  useEffect(() => {
    const elements = SETTINGS_SECTIONS.map((s) =>
      document.getElementById(`settings-${s.id}`),
    ).filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        const top = visible[0]?.target as HTMLElement | undefined;
        if (!top?.id.startsWith("settings-")) return;
        const id = top.id.slice("settings-".length) as SettingsSectionId;
        if (SETTINGS_SECTIONS.some((s) => s.id === id)) {
          setActiveSection(id);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 0.25, 0.5],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function scrollToSection(id: SettingsSectionId) {
    const el = document.getElementById(`settings-${id}`);
    if (!el) return;
    setActiveSection(id);
    scrollingRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      scrollingRef.current = false;
    }, 600);
  }

  function onAddKey() {
    if (!form.apiKey.trim()) {
      setMessage("API 키를 입력하세요.");
      return;
    }
    if (!form.model.trim()) {
      setMessage("모델을 선택하거나 직접 입력하세요.");
      return;
    }
    addApiKey({
      label: form.label.trim() || PROVIDER_LABELS[form.provider],
      provider: form.provider,
      apiKey: form.apiKey.trim(),
      model: form.model.trim() || DEFAULT_MODELS[form.provider],
      enabled: true,
    });
    setForm({
      label: "",
      provider: form.provider,
      apiKey: "",
      model: DEFAULT_MODELS[form.provider],
    });
    setMessage("API 키를 등록했습니다.");
  }

  function onAddModel() {
    if (!modelForm.modelId.trim()) {
      setMessage("모델 ID를 입력하세요.");
      return;
    }
    const id = addCustomModel({
      provider: modelForm.provider,
      modelId: modelForm.modelId.trim(),
      label: modelForm.label.trim() || modelForm.modelId.trim(),
    });
    if (!id) {
      setMessage("이미 등록된 모델이거나 저장에 실패했습니다.");
      return;
    }
    setModelForm({
      provider: modelForm.provider,
      modelId: "",
      label: "",
    });
    setMessage(
      `${PROVIDER_LABELS[modelForm.provider]} 모델 "${modelForm.modelId.trim()}"을(를) 등록했습니다.`,
    );
  }

  async function testKey(id: string) {
    const entry = data.settings.apiKeys.find((k) => k.id === id);
    if (!entry) return;
    setTestingId(id);
    setMessage("");
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: {
            provider: entry.provider,
            apiKey: entry.apiKey,
            model: entry.model,
            label: entry.label,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "연결 실패");
      setMessage(
        `연결 성공: ${json.providerLabel} / ${json.model} (응답: ${json.preview})`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "연결 실패");
    } finally {
      setTestingId(null);
    }
  }

  function onExport() {
    const payload = exportData(data.settings.includeKeysInExport);
    downloadTextFile(
      `생기부도우미_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
    );
    setMessage(
      data.settings.includeKeysInExport
        ? "저장했습니다. (API 키 포함)"
        : "저장했습니다. (API 키 제외)",
    );
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (parsed?.version !== 1) {
        throw new Error("지원하지 않는 JSON 형식입니다.");
      }
      const includeKeys = window.confirm(
        "JSON에 포함된 API 키도 불러올까요?\n취소를 누르면 기존 키를 유지합니다.",
      );
      importData(parsed, includeKeys);
      setMessage("불러오기가 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "불러오기 실패");
    }
  }

  return (
    <AppShell
      title="설정"
      subtitle="API 키·모델, 글자 수, JSON 백업을 관리합니다. 데이터는 이 브라우저에만 저장됩니다."
    >
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          aria-label="설정 목차"
          className="lg:sticky lg:top-32 lg:self-start"
        >
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-left text-sm font-medium transition-transform active:scale-95 lg:w-full lg:rounded-xl ${
                  activeSection === section.id
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--hairline)] bg-[var(--surface-pearl)] text-[var(--ink)]"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="space-y-4">
          {message ? (
            <p className="whitespace-pre-wrap rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}

          <section id="settings-teacher" className="scroll-mt-28">
            <Card title="교사 정보">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="담당 과목"
                  hint="교과특기 화면에서 과목이 고정됩니다. 교과특기 페이지의 «이 과목 고정»으로도 설정할 수 있습니다."
                >
                  <select
                    className={inputClass}
                    value={data.settings.teacherSubjectId ?? ""}
                    onChange={(e) =>
                      setTeacherSubjectId(
                        e.target.value ? e.target.value : null,
                      )
                    }
                  >
                    <option value="">지정 안 함</option>
                    {data.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="담임학급"
                  hint="학급 선택 시 이 반이 기본으로 먼저 선택됩니다. 목록에 없으면 직접 입력하세요."
                >
                  <input
                    className={inputClass}
                    list="teacher-class-options"
                    value={data.settings.teacherClassName ?? ""}
                    onChange={(e) =>
                      setTeacherClassName(
                        e.target.value ? e.target.value : null,
                      )
                    }
                    placeholder="예: 2-3"
                  />
                  <datalist id="teacher-class-options">
                    {[
                      ...new Set(
                        data.students
                          .map((s) => s.className)
                          .filter(Boolean),
                      ),
                    ]
                      .sort((a, b) => a.localeCompare(b, "ko"))
                      .map((c) => (
                        <option key={c} value={c} />
                      ))}
                  </datalist>
                </Field>
              </div>
            </Card>
          </section>

          <section id="settings-api" className="scroll-mt-28 space-y-4">
            <Card title="AI API 키 등록">
              <Field
                label="API 키 발급 사이트"
                hint="항목을 선택하면 공식 발급 사이트가 새 창에서 열립니다. Llama API는 현재 미리보기 서비스일 수 있습니다."
              >
                <select
                  className={`${inputClass} mb-3`}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      window.open(
                        e.target.value,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }}
                >
                  <option value="">발급 사이트를 선택하세요</option>
                  {API_KEY_LINKS.map((link) => (
                    <option key={link.url} value={link.url}>
                      {link.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="별칭">
                  <input
                    className={inputClass}
                    value={form.label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="예: 개인 Gemini, 학교 OpenAI"
                  />
                </Field>
                <Field label="제공자">
                  <select
                    className={inputClass}
                    value={form.provider}
                    onChange={(e) => {
                      const provider = e.target.value as Provider;
                      setForm((f) => ({
                        ...f,
                        provider,
                        model: DEFAULT_MODELS[provider],
                      }));
                    }}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="API 키">
                  <input
                    className={inputClass}
                    type="password"
                    value={form.apiKey}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    placeholder="sk-... / AIza... 등"
                  />
                </Field>
                <Field
                  label="모델"
                  hint={
                    formUsesCustomModel
                      ? "모델 ID를 직접 입력하세요."
                      : "목록에서 고르거나, 직접 입력을 선택하세요."
                  }
                >
                  <select
                    className={inputClass}
                    value={formUsesCustomModel ? "__custom__" : form.model}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setForm((f) => ({
                          ...f,
                          model: isListedModel(f.model, modelOptions)
                            ? ""
                            : f.model,
                        }));
                        return;
                      }
                      setForm((f) => ({ ...f, model: e.target.value }));
                    }}
                  >
                    {modelOptions.map((m) => (
                      <option
                        key={`${m.source}-${m.modelId}`}
                        value={m.modelId}
                      >
                        {m.label} ({m.modelId})
                        {m.source === "custom" ? " · 등록" : ""}
                      </option>
                    ))}
                    <option value="__custom__">직접 입력…</option>
                  </select>
                  {formUsesCustomModel ? (
                    <input
                      className={`${inputClass} mt-2`}
                      value={form.model}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, model: e.target.value }))
                      }
                      placeholder="모델 ID"
                    />
                  ) : null}
                </Field>
              </div>
              <div className="mt-3">
                <button type="button" className={btnPrimary} onClick={onAddKey}>
                  키 추가
                </button>
              </div>
            </Card>

            <Card title={`등록된 키 (${data.settings.apiKeys.length})`}>
              {data.settings.apiKeys.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Google, NVIDIA, OpenAI, Claude 키를 여러 개 등록할 수 있습니다.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-slate-600">
                    위쪽이 우선순위가 높습니다. 생성 시 위에서부터 시도하고, 앞선
                    키가 실패하면 다음 키로 넘어갑니다. 성공한 키는 자동으로
                    1순위가 되고, 실패한 키는 뒤로 밀립니다.
                  </p>
                  <ul className="space-y-3">
                    {data.settings.apiKeys.map((key, index) => {
                      const options = listModelsForProvider(
                        key.provider,
                        customModels,
                      );
                      const usesCustom = !isListedModel(key.model, options);
                      const isFirst =
                        data.settings.activeApiKeyId === key.id || index === 0;
                      return (
                        <li
                          key={key.id}
                          className={`rounded-xl border p-3 ${
                            isFirst && key.enabled
                              ? "border-indigo-400 bg-indigo-50"
                              : "border-slate-200"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                  isFirst && key.enabled
                                    ? "bg-[var(--primary)] text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                                title="우선순위"
                              >
                                {index + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {key.label}{" "}
                                  <span className="text-xs font-normal text-slate-500">
                                    {PROVIDER_LABELS[key.provider]}
                                  </span>
                                  {isFirst && key.enabled ? (
                                    <span className="ml-2 text-xs font-medium text-indigo-700">
                                      1순위
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-xs text-slate-500">
                                  모델: {key.model} · 키: {"*".repeat(8)}
                                  {key.apiKey.slice(-4)}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={btnSecondary}
                                disabled={index === 0}
                                onClick={() => moveApiKey(key.id, "up")}
                              >
                                위로
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
                                disabled={
                                  index === data.settings.apiKeys.length - 1
                                }
                                onClick={() => moveApiKey(key.id, "down")}
                              >
                                아래로
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
                                onClick={() => setActiveApiKey(key.id)}
                              >
                                {isFirst && key.enabled
                                  ? "1순위"
                                  : "1순위로"}
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
                                disabled={testingId === key.id}
                                onClick={() => void testKey(key.id)}
                              >
                                {testingId === key.id
                                  ? "테스트 중…"
                                  : "연결 테스트"}
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
                                onClick={() =>
                                  updateApiKey(key.id, {
                                    enabled: !key.enabled,
                                  })
                                }
                              >
                                {key.enabled ? "사용 중" : "비활성"}
                              </button>
                              <button
                                type="button"
                                className={btnDanger}
                                onClick={() => removeApiKey(key.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={key.label}
                              onChange={(e) =>
                                updateApiKey(key.id, { label: e.target.value })
                              }
                            />
                            <div className="space-y-2">
                              <select
                                className={inputClass}
                                value={usesCustom ? "__custom__" : key.model}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") {
                                    updateApiKey(key.id, {
                                      model: isListedModel(key.model, options)
                                        ? ""
                                        : key.model,
                                    });
                                    return;
                                  }
                                  updateApiKey(key.id, {
                                    model: e.target.value,
                                  });
                                }}
                              >
                                {options.map((m) => (
                                  <option
                                    key={`${key.id}-${m.modelId}`}
                                    value={m.modelId}
                                  >
                                    {m.label} ({m.modelId})
                                  </option>
                                ))}
                                <option value="__custom__">직접 입력…</option>
                              </select>
                              {usesCustom ? (
                                <input
                                  className={inputClass}
                                  value={key.model}
                                  onChange={(e) =>
                                    updateApiKey(key.id, {
                                      model: e.target.value,
                                    })
                                  }
                                  placeholder="모델 ID"
                                />
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          </section>

          <section id="settings-models" className="scroll-mt-28">
            <Card title="새 모델 등록">
              <p className="mb-3 text-sm text-slate-600">
                기본 목록에 없는 모델 ID를 등록해 두면, API 키 추가 시 선택할 수
                있습니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="제공자">
                  <select
                    className={inputClass}
                    value={modelForm.provider}
                    onChange={(e) =>
                      setModelForm((f) => ({
                        ...f,
                        provider: e.target.value as Provider,
                      }))
                    }
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="모델 ID" hint="API에 전달되는 정확한 모델 이름">
                  <input
                    className={inputClass}
                    value={modelForm.modelId}
                    onChange={(e) =>
                      setModelForm((f) => ({ ...f, modelId: e.target.value }))
                    }
                    placeholder="예: gemini-2.5-pro, gpt-4.1"
                  />
                </Field>
                <Field label="표시 이름(선택)">
                  <input
                    className={inputClass}
                    value={modelForm.label}
                    onChange={(e) =>
                      setModelForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="예: Gemini 2.5 Pro"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={onAddModel}
                >
                  모델 등록
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  내가 등록한 모델 ({customModels.length})
                </p>
                {customModels.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    등록된 사용자 모델이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {customModels.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2"
                      >
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                          {PROVIDER_LABELS[m.provider]}
                        </span>
                        <input
                          className={`${inputClass} max-w-[10rem]`}
                          value={m.label}
                          onChange={(e) =>
                            updateCustomModel(m.id, { label: e.target.value })
                          }
                          placeholder="표시 이름"
                        />
                        <input
                          className={`${inputClass} min-w-[12rem] flex-1`}
                          value={m.modelId}
                          onChange={(e) =>
                            updateCustomModel(m.id, {
                              modelId: e.target.value,
                            })
                          }
                          placeholder="모델 ID"
                        />
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => removeCustomModel(m.id)}
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </section>

          <section id="settings-options" className="scroll-mt-28">
            <Card title="생성 옵션">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(SECTION_LABELS) as Section[]).map((section) => (
                  <Field
                    key={section}
                    label={`${SECTION_LABELS[section]} 글자 수`}
                  >
                    <input
                      className={inputClass}
                      value={data.settings.charLimits[section]}
                      onChange={(e) => setCharLimit(section, e.target.value)}
                      placeholder="비우면 무제한"
                      inputMode="numeric"
                    />
                  </Field>
                ))}
                <Field label="초안 등급">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    생성 시 항상 최상 / 상 / 중 / 하 4등급으로 작성됩니다.
                  </div>
                </Field>
              </div>
            </Card>
          </section>

          <section id="settings-backup" className="scroll-mt-28">
            <Card title="저장하기 / 불러오기">
              <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.settings.includeKeysInExport}
                  onChange={(e) => setIncludeKeysInExport(e.target.checked)}
                />
                저장할때 API 키 포함
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={onExport}>
                  저장하기
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => fileRef.current?.click()}
                >
                  불러오기
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onImport(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => {
                    if (
                      window.confirm(
                        "이 브라우저의 모든 학생·문서·초안·키를 삭제할까요?",
                      )
                    ) {
                      reset();
                      setMessage("데이터를 초기화했습니다.");
                    }
                  }}
                >
                  전체 초기화
                </button>
              </div>
            </Card>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
