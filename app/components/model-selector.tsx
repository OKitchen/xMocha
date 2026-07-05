"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

export type OutputLanguage = "zh-CN" | "en";
export type RuntimeModelProvider =
  | "anthropic"
  | "deepseek"
  | "gemma"
  | "google"
  | "huggingface"
  | "openai";
export type ModelProviderOption = "default" | RuntimeModelProvider;
export type RuntimeTurnSimulator = "legacy" | "unified";

export type ModelSelection = {
  provider: ModelProviderOption;
  model: string;
};

export type RequestModelConfig = {
  provider: RuntimeModelProvider;
  model?: string;
  turnSimulator?: RuntimeTurnSimulator;
};

type PublicModelProvider = {
  id: RuntimeModelProvider;
  labels: Record<OutputLanguage, string>;
  defaultModel: string;
  defaultTurnSimulator?: RuntimeTurnSimulator;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  configured: boolean;
  status: "ready" | "missing_env" | "local_runtime";
  modelPresets: Array<{ label: string; model: string }>;
  setupNotes: Record<OutputLanguage, string>;
};

type PublicModelCatalog = {
  defaultProvider: RuntimeModelProvider;
  defaultModel: string;
  providers: PublicModelProvider[];
  forcedFallback: {
    decision: boolean;
    world: boolean;
  };
  warnings: Array<{
    code: string;
    message: Record<OutputLanguage, string>;
  }>;
};

type ModelTestResponse =
  | {
      ok: true;
      provider: string;
      model: string;
      latencyMs: number;
    }
  | {
      ok: false;
      provider?: string;
      model?: string;
      error?: string;
      diagnostic?: {
        code: string;
        message: Record<OutputLanguage, string>;
      };
      latencyMs?: number;
    };

type ModelSelectorProps = {
  language: OutputLanguage;
  mode: "decision" | "world";
  value: ModelSelection;
  onChange: (next: ModelSelection) => void;
  title: string;
  hint: string;
  providerLabel: string;
  modelLabel: string;
  help: string;
  inputStyle: CSSProperties;
  mutedStyle: CSSProperties;
  buttonStyle?: CSSProperties;
};

const copy = {
  "zh-CN": {
    loading: "正在读取服务器模型配置…",
    loadFailed: "无法读取 /api/models；将使用服务器默认配置。",
    serverDefault: "服务器默认",
    defaultDetail: (provider: string, model: string) =>
      `服务器默认：${provider} / ${model}`,
    configured: "已检测到配置；请用测试按钮确认账号权限和模型可用。",
    localRuntime: "本地运行时：请用测试按钮确认 Ollama 或兼容服务可用。",
    missingEnv: (vars: string) => `缺少服务器环境变量：${vars}`,
    forcedDecision:
      "当前 Decision Mode 被强制设为 mock/fallback，模型选择不会影响生成结果。",
    forcedWorld:
      "当前 World Mode 被强制设为 deterministic fallback，模型选择不会影响生成结果。",
    test: "测试所选模型",
    testing: "正在测试…",
    testOk: (provider: string, model: string, latency: number) =>
      `测试成功：${provider} / ${model}（${latency}ms）`,
    testFailed: (reason: string) => `测试失败：${reason}`,
    defaultPlaceholder: "使用服务器默认模型",
    customPlaceholder: "输入模型名或选择预设",
  },
  en: {
    loading: "Reading server model config…",
    loadFailed: "Could not read /api/models; server default will still be used.",
    serverDefault: "Server default",
    defaultDetail: (provider: string, model: string) =>
      `Server default: ${provider} / ${model}`,
    configured: "Env configured; use the test button to verify account and model access.",
    localRuntime: "Local runtime: use the test button to verify Ollama or a compatible service.",
    missingEnv: (vars: string) => `Missing server env var: ${vars}`,
    forcedDecision:
      "Decision Mode is forced to mock/fallback, so model selection will not affect generation.",
    forcedWorld:
      "World Mode is forced to deterministic fallback, so model selection will not affect generation.",
    test: "Test selected model",
    testing: "Testing…",
    testOk: (provider: string, model: string, latency: number) =>
      `Test passed: ${provider} / ${model} (${latency}ms)`,
    testFailed: (reason: string) => `Test failed: ${reason}`,
    defaultPlaceholder: "Use server default model",
    customPlaceholder: "Type a model name or choose a preset",
  },
} satisfies Record<OutputLanguage, Record<string, unknown>>;

export function modelConfigFromSelection(
  selection: ModelSelection,
  catalog?: PublicModelCatalog | null,
): RequestModelConfig | undefined {
  if (selection.provider === "default") return undefined;

  const provider = catalog?.providers.find(
    (candidate) => candidate.id === selection.provider,
  );
  const model = selection.model.trim();

  return {
    provider: selection.provider,
    ...(model ? { model } : {}),
    ...(provider?.defaultTurnSimulator
      ? { turnSimulator: provider.defaultTurnSimulator }
      : {}),
  };
}

export function ModelSelector({
  language,
  mode,
  value,
  onChange,
  title,
  hint,
  providerLabel,
  modelLabel,
  help,
  inputStyle,
  mutedStyle,
  buttonStyle,
}: ModelSelectorProps) {
  const text = copy[language];
  const [catalog, setCatalog] = useState<PublicModelCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/models", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("models route failed");
        }
        return response.json() as Promise<PublicModelCatalog>;
      })
      .then((nextCatalog) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!catalog || value.provider === "default" || value.model.trim()) {
      return;
    }

    const provider = catalog.providers.find(
      (candidate) => candidate.id === value.provider,
    );
    if (provider) {
      onChange({ provider: value.provider, model: provider.defaultModel });
    }
  }, [catalog, onChange, value.model, value.provider]);

  const selectedProvider = useMemo(
    () =>
      value.provider === "default"
        ? undefined
        : catalog?.providers.find((provider) => provider.id === value.provider),
    [catalog, value.provider],
  );
  const effectiveProvider = useMemo(
    () =>
      value.provider === "default"
        ? catalog?.providers.find((provider) => provider.id === catalog.defaultProvider)
        : selectedProvider,
    [catalog, selectedProvider, value.provider],
  );
  const forcedFallbackActive = Boolean(catalog?.forcedFallback[mode]);
  const inputId = `model-preset-${mode}`;

  function handleProviderChange(nextProvider: ModelProviderOption) {
    setTestResult(null);

    if (nextProvider === "default") {
      onChange({ provider: "default", model: "" });
      return;
    }

    const provider = catalog?.providers.find(
      (candidate) => candidate.id === nextProvider,
    );
    onChange({
      provider: nextProvider,
      model: provider?.defaultModel ?? "",
    });
  }

  async function testSelectedModel() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelConfig: modelConfigFromSelection(value, catalog),
        }),
      });
      const data = (await response.json()) as ModelTestResponse;

      if (!response.ok || !data.ok) {
        const diagnostic = data.ok ? undefined : data.diagnostic;
        const rawError = data.ok ? undefined : data.error;
        const reason = diagnostic?.message[language] ??
          rawError ??
          "unknown error";
        setTestResult(
          text.testFailed(reason),
        );
        return;
      }

      setTestResult(text.testOk(data.provider, data.model, data.latencyMs));
    } catch (error) {
      setTestResult(
        text.testFailed(error instanceof Error ? error.message : "unknown error"),
      );
    } finally {
      setTesting(false);
    }
  }

  const statusLines = [
    !catalog ? text.loading : null,
    loadError ? text.loadFailed : null,
    catalog
      ? text.defaultDetail(
          catalog.providers.find((provider) => provider.id === catalog.defaultProvider)
            ?.labels[language] ?? catalog.defaultProvider,
          catalog.defaultModel,
        )
      : null,
    forcedFallbackActive
      ? mode === "decision"
        ? text.forcedDecision
        : text.forcedWorld
      : null,
    effectiveProvider?.status === "missing_env"
      ? text.missingEnv(effectiveProvider.missingEnvVars.join(", "))
      : null,
    effectiveProvider?.status === "local_runtime" ? text.localRuntime : null,
    effectiveProvider?.status === "ready" && !forcedFallbackActive
      ? text.configured
      : null,
    testResult,
  ].filter((line): line is string => Boolean(line));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <strong>{title}</strong>
        <p style={{ ...mutedStyle, margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
          {hint}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label>
          {providerLabel}
          <select
            aria-label={providerLabel}
            style={inputStyle}
            value={value.provider}
            disabled={forcedFallbackActive}
            onChange={(event) =>
              handleProviderChange(event.target.value as ModelProviderOption)
            }
          >
            <option value="default">
              {catalog
                ? `${text.serverDefault} (${catalog.providers.find((provider) => provider.id === catalog.defaultProvider)?.labels[language] ?? catalog.defaultProvider})`
                : text.serverDefault}
            </option>
            {catalog?.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.labels[language]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {modelLabel}
          <input
            aria-label={modelLabel}
            list={inputId}
            style={inputStyle}
            value={value.model}
            disabled={value.provider === "default" || forcedFallbackActive}
            onChange={(event) =>
              onChange({ provider: value.provider, model: event.target.value })
            }
            placeholder={
              value.provider === "default"
                ? text.defaultPlaceholder
                : selectedProvider?.defaultModel ?? text.customPlaceholder
            }
          />
          <datalist id={inputId}>
            {selectedProvider?.modelPresets.map((preset) => (
              <option key={preset.model} value={preset.model}>
                {preset.label}
              </option>
            ))}
          </datalist>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            ...(buttonStyle ?? {
              border: "1px solid #314d75",
              borderRadius: 10,
              background: "#17243a",
              color: "#dbeafe",
              padding: "9px 11px",
              fontWeight: 800,
              cursor: "pointer",
            }),
            opacity: testing || forcedFallbackActive ? 0.65 : 1,
            cursor: testing || forcedFallbackActive ? "not-allowed" : "pointer",
          }}
          disabled={testing || forcedFallbackActive}
          onClick={testSelectedModel}
        >
          {testing ? text.testing : text.test}
        </button>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <p style={{ ...mutedStyle, margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          {help}
        </p>
        {statusLines.map((line) => (
          <p
            key={line}
            style={{
              margin: 0,
              color:
                line === text.configured
                  ? "#86efac"
                  : line === testResult &&
                      (testResult.startsWith("Test passed") ||
                        testResult.startsWith("测试成功"))
                    ? "#86efac"
                    : "#facc15",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
