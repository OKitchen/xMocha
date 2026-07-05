import type { ModelProvider, OutputLanguage, SessionModelConfig } from "../../domain/types";

export type ModelProviderOption = ModelProvider;
export type ModelProviderStatus = "ready" | "missing_env" | "local_runtime";

export type ModelPreset = {
  label: string;
  model: string;
};

export type ModelCatalogProvider = {
  id: ModelProviderOption;
  labels: Record<OutputLanguage, string>;
  defaultModel: string;
  defaultTurnSimulator?: SessionModelConfig["turnSimulator"];
  envGroups: string[][];
  requiredEnvVars: string[];
  modelPresets: ModelPreset[];
  setupNotes: Record<OutputLanguage, string>;
};

export type PublicModelProvider = {
  id: ModelProviderOption;
  labels: Record<OutputLanguage, string>;
  defaultModel: string;
  defaultTurnSimulator?: SessionModelConfig["turnSimulator"];
  requiredEnvVars: string[];
  missingEnvVars: string[];
  configured: boolean;
  status: ModelProviderStatus;
  modelPresets: ModelPreset[];
  setupNotes: Record<OutputLanguage, string>;
};

export type PublicModelCatalog = {
  defaultProvider: ModelProviderOption;
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

export const modelCatalogProviders: ModelCatalogProvider[] = [
  {
    id: "huggingface",
    labels: { "zh-CN": "Hugging Face Router", en: "Hugging Face Router" },
    defaultModel: "zai-org/GLM-5.2:zai-org",
    defaultTurnSimulator: "legacy",
    envGroups: [["HF_TOKEN", "HUGGINGFACE_API_KEY", "HF_API_TOKEN"]],
    requiredEnvVars: ["HF_TOKEN"],
    modelPresets: [
      { label: "GLM 5.2", model: "zai-org/GLM-5.2:zai-org" },
      { label: "Gemma 4 26B", model: "google/gemma-4-26B-A4B-it:novita" },
    ],
    setupNotes: {
      "zh-CN": "需要在服务器 .env.local 设置 HF_TOKEN。",
      en: "Requires HF_TOKEN in the server .env.local file.",
    },
  },
  {
    id: "openai",
    labels: { "zh-CN": "OpenAI", en: "OpenAI" },
    defaultModel: "gpt-5.4-mini",
    defaultTurnSimulator: "legacy",
    envGroups: [["OPENAI_API_KEY"]],
    requiredEnvVars: ["OPENAI_API_KEY"],
    modelPresets: [
      { label: "GPT-5.4 mini", model: "gpt-5.4-mini" },
      { label: "GPT-5.5", model: "gpt-5.5" },
    ],
    setupNotes: {
      "zh-CN": "需要在服务器 .env.local 设置 OPENAI_API_KEY。",
      en: "Requires OPENAI_API_KEY in the server .env.local file.",
    },
  },
  {
    id: "google",
    labels: { "zh-CN": "Google GenAI", en: "Google GenAI" },
    defaultModel: "gemma-4-26b-a4b-it",
    defaultTurnSimulator: "legacy",
    envGroups: [["GOOGLE_API_KEY", "GEMINI_API_KEY"]],
    requiredEnvVars: ["GOOGLE_API_KEY"],
    modelPresets: [
      { label: "Gemma 4 26B", model: "gemma-4-26b-a4b-it" },
      { label: "Gemini 2.5 Flash", model: "gemini-2.5-flash" },
    ],
    setupNotes: {
      "zh-CN": "需要在服务器 .env.local 设置 GOOGLE_API_KEY。",
      en: "Requires GOOGLE_API_KEY in the server .env.local file.",
    },
  },
  {
    id: "gemma",
    labels: { "zh-CN": "Gemma / Ollama", en: "Gemma / Ollama" },
    defaultModel: "gemma4",
    defaultTurnSimulator: "unified",
    envGroups: [],
    requiredEnvVars: [],
    modelPresets: [
      { label: "Ollama Gemma 4", model: "gemma4" },
      { label: "Gemma 4 26B Router", model: "google/gemma-4-26B-A4B-it:novita" },
    ],
    setupNotes: {
      "zh-CN": "默认使用本地 Ollama；点击测试模型可确认本地服务是否可用。",
      en: "Defaults to local Ollama; use Test model to verify the local runtime.",
    },
  },
  {
    id: "deepseek",
    labels: { "zh-CN": "DeepSeek", en: "DeepSeek" },
    defaultModel: "deepseek-chat",
    defaultTurnSimulator: "legacy",
    envGroups: [["DEEPSEEK_API_KEY"]],
    requiredEnvVars: ["DEEPSEEK_API_KEY"],
    modelPresets: [
      { label: "DeepSeek Chat", model: "deepseek-chat" },
      { label: "DeepSeek Reasoner", model: "deepseek-reasoner" },
    ],
    setupNotes: {
      "zh-CN": "需要在服务器 .env.local 设置 DEEPSEEK_API_KEY。",
      en: "Requires DEEPSEEK_API_KEY in the server .env.local file.",
    },
  },
  {
    id: "anthropic",
    labels: { "zh-CN": "Anthropic", en: "Anthropic" },
    defaultModel: "claude-sonnet-4-20250514",
    defaultTurnSimulator: "legacy",
    envGroups: [["ANTHROPIC_API_KEY"]],
    requiredEnvVars: ["ANTHROPIC_API_KEY"],
    modelPresets: [
      { label: "Claude Sonnet 4", model: "claude-sonnet-4-20250514" },
      { label: "Claude Opus 4", model: "claude-opus-4-20250514" },
    ],
    setupNotes: {
      "zh-CN": "需要在服务器 .env.local 设置 ANTHROPIC_API_KEY。",
      en: "Requires ANTHROPIC_API_KEY in the server .env.local file.",
    },
  },
];

export function isModelProvider(value: unknown): value is ModelProviderOption {
  return modelCatalogProviders.some((provider) => provider.id === value);
}

export function getModelCatalogProvider(provider: ModelProviderOption): ModelCatalogProvider {
  const match = modelCatalogProviders.find((candidate) => candidate.id === provider);
  if (!match) throw new Error(`Unsupported model provider "${provider}".`);
  return match;
}

export function getDefaultModelForProvider(provider: ModelProviderOption): string {
  return getModelCatalogProvider(provider).defaultModel;
}

export function getDefaultTurnSimulatorForProvider(
  provider: ModelProviderOption,
): SessionModelConfig["turnSimulator"] | undefined {
  return getModelCatalogProvider(provider).defaultTurnSimulator;
}

export function getConfiguredProvider(env: NodeJS.ProcessEnv = process.env): ModelProviderOption {
  const candidate = env.XMOCHA_MODEL_PROVIDER;
  return isModelProvider(candidate) ? candidate : "huggingface";
}

export function getConfiguredModelForProvider(
  provider: ModelProviderOption,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (provider === "anthropic") return env.ANTHROPIC_MODEL ?? getDefaultModelForProvider(provider);
  if (provider === "deepseek") return env.DEEPSEEK_MODEL ?? getDefaultModelForProvider(provider);
  if (provider === "google") {
    return env.GOOGLE_GENAI_MODEL ?? env.GEMINI_MODEL ?? getDefaultModelForProvider(provider);
  }
  if (provider === "huggingface") {
    return env.HUGGINGFACE_MODEL ?? env.HF_MODEL ?? getDefaultModelForProvider(provider);
  }
  if (provider === "openai") return env.OPENAI_MODEL ?? getDefaultModelForProvider(provider);
  if (provider === "gemma") {
    return env.GEMMA_MODEL ?? getDefaultModelForProvider(provider);
  }
  return getDefaultModelForProvider(provider);
}

export function buildPublicModelCatalog(
  env: NodeJS.ProcessEnv = process.env,
): PublicModelCatalog {
  const defaultProvider = getConfiguredProvider(env);
  const forcedFallback = {
    decision: env.XMOCHA_BRANCH_GENERATOR === "mock",
    world: env.XMOCHA_WORLD_GENERATOR === "fallback",
  };
  const providers = modelCatalogProviders.map((provider) =>
    toPublicModelProvider(provider, env),
  );
  const warnings: PublicModelCatalog["warnings"] = [];

  if (forcedFallback.decision) {
    warnings.push({
      code: "DECISION_FORCED_MOCK",
      message: {
        "zh-CN": "当前服务器设置了 XMOCHA_BRANCH_GENERATOR=mock，Decision Mode 会使用 mock/fallback，模型选择不会生效。",
        en: "XMOCHA_BRANCH_GENERATOR=mock is active, so Decision Mode uses mock/fallback generation and model selection will not affect output.",
      },
    });
  }

  if (forcedFallback.world) {
    warnings.push({
      code: "WORLD_FORCED_FALLBACK",
      message: {
        "zh-CN": "当前服务器设置了 XMOCHA_WORLD_GENERATOR=fallback，World Mode 会使用确定性备用生成。",
        en: "XMOCHA_WORLD_GENERATOR=fallback is active, so World Mode uses deterministic fallback generation.",
      },
    });
  }

  return {
    defaultProvider,
    defaultModel: getConfiguredModelForProvider(defaultProvider, env),
    providers,
    forcedFallback,
    warnings,
  };
}

function toPublicModelProvider(
  provider: ModelCatalogProvider,
  env: NodeJS.ProcessEnv,
): PublicModelProvider {
  if (provider.id === "gemma") {
    return toPublicGemmaProvider(provider, env);
  }

  const missingEnvVars = provider.envGroups
    .filter((group) => !group.some((name) => Boolean(env[name])))
    .map((group) => group[0]);
  const configured = missingEnvVars.length === 0;
  return {
    id: provider.id,
    labels: provider.labels,
    defaultModel: getConfiguredModelForProvider(provider.id, env),
    defaultTurnSimulator: provider.defaultTurnSimulator,
    requiredEnvVars: provider.requiredEnvVars,
    missingEnvVars,
    configured,
    status: configured ? "ready" : "missing_env",
    modelPresets: provider.modelPresets,
    setupNotes: provider.setupNotes,
  };
}

function toPublicGemmaProvider(
  provider: ModelCatalogProvider,
  env: NodeJS.ProcessEnv,
): PublicModelProvider {
  const runtime = normalizeGemmaRuntime(env.GEMMA_RUNTIME);
  const missingEnvVars = runtime === "huggingface" &&
    !env.HF_TOKEN &&
    !env.GEMMA_API_KEY
    ? ["HF_TOKEN"]
    : [];
  const configured = missingEnvVars.length === 0;
  const isLocalRuntime = runtime === "ollama" || runtime === "openai-compatible";
  const runtimeLabel =
    runtime === "huggingface"
      ? "Hugging Face Router"
      : runtime === "openai-compatible"
        ? "OpenAI-compatible"
        : "Ollama";

  return {
    id: provider.id,
    labels: {
      "zh-CN": `Gemma / ${runtimeLabel}`,
      en: `Gemma / ${runtimeLabel}`,
    },
    defaultModel: getConfiguredModelForProvider(provider.id, env),
    defaultTurnSimulator: provider.defaultTurnSimulator,
    requiredEnvVars: runtime === "huggingface" ? ["HF_TOKEN"] : [],
    missingEnvVars,
    configured,
    status: configured
      ? isLocalRuntime
        ? "local_runtime"
        : "ready"
      : "missing_env",
    modelPresets: provider.modelPresets,
    setupNotes: {
      "zh-CN": runtime === "huggingface"
        ? "通过 Hugging Face Router 使用 Gemma；需要 HF_TOKEN 或 GEMMA_API_KEY。"
        : runtime === "openai-compatible"
          ? "通过 GEMMA_BASE_URL 指向的 OpenAI-compatible 本地服务使用 Gemma。"
          : "默认使用本地 Ollama；点击测试模型可确认本地服务是否可用。",
      en: runtime === "huggingface"
        ? "Uses Gemma through Hugging Face Router; requires HF_TOKEN or GEMMA_API_KEY."
        : runtime === "openai-compatible"
          ? "Uses the OpenAI-compatible Gemma service at GEMMA_BASE_URL."
          : "Defaults to local Ollama; use Test model to verify the local runtime.",
    },
  };
}

function normalizeGemmaRuntime(value: string | undefined):
  | "huggingface"
  | "openai-compatible"
  | "ollama" {
  if (value === "huggingface" || value === "openai-compatible") return value;
  return "ollama";
}
