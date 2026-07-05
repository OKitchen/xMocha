import { AnthropicJsonClient, type JsonGenerationClient } from "./anthropic-client";
import { DeepSeekJsonClient } from "./deepseek-client";
import { GemmaJsonClient, getGemmaRuntimeLabel } from "./gemma-client";
import {
  getGoogleGenAIRuntimeLabel,
  GoogleGenAIJsonClient,
} from "./google-genai-client";
import {
  getHuggingFaceRuntimeLabel,
  HuggingFaceRouterJsonClient,
} from "./huggingface-client";
import {
  getOpenAIRuntimeLabel,
  OpenAIResponsesJsonClient,
} from "./openai-client";
import {
  getConfiguredModelForProvider,
  getConfiguredProvider,
  getDefaultModelForProvider,
} from "./model-catalog";
import { getRuntimeModelConfig } from "./runtime-model-config";

export function getActiveProviderLabel(): string {
  const config = getRuntimeModelConfig();
  const provider = config?.provider ?? getConfiguredProvider();

  if (process.env.XMOCHA_BRANCH_GENERATOR === "mock") {
    return "Mock";
  }

  if (provider === "anthropic") return "Anthropic";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "gemma") return getGemmaRuntimeLabel(config?.model);
  if (provider === "google") return getGoogleGenAIRuntimeLabel(config?.model);
  if (provider === "huggingface") return getHuggingFaceRuntimeLabel(config?.model);
  if (provider === "openai") return getOpenAIRuntimeLabel(config?.model);

  return provider;
}

export function getActiveModelName(): string {
  const config = getRuntimeModelConfig();
  const provider = config?.provider ?? getConfiguredProvider();
  if (process.env.XMOCHA_BRANCH_GENERATOR === "mock") return "mock";

  if (config?.model) return config.model;
  return getConfiguredModelForProvider(provider);
}

export function createJsonGenerationClient(): {
  client: JsonGenerationClient;
  modelLabel: string;
  providerLabel: string;
} {
  const config = getRuntimeModelConfig();
  const provider = config?.provider ?? getConfiguredProvider();

  if (provider === "anthropic") {
    const model = config?.model ?? getConfiguredModelForProvider(provider);
    return {
      client: new AnthropicJsonClient({ model }),
      modelLabel: model,
      providerLabel: "Anthropic",
    };
  }

  if (provider === "deepseek") {
    const model = config?.model ?? getConfiguredModelForProvider(provider);
    return {
      client: new DeepSeekJsonClient({ model }),
      modelLabel: model,
      providerLabel: "DeepSeek",
    };
  }

  if (provider === "gemma") {
    const model = config?.model ?? getConfiguredModelForProvider(provider);
    return {
      client: new GemmaJsonClient({ model }),
      modelLabel: model,
      providerLabel: getGemmaRuntimeLabel(model),
    };
  }

  if (provider === "google") {
    const model = config?.model ?? getConfiguredModelForProvider(provider);
    return {
      client: new GoogleGenAIJsonClient({ model }),
      modelLabel: model,
      providerLabel: getGoogleGenAIRuntimeLabel(model),
    };
  }

  if (provider === "huggingface") {
    const model = config?.model ?? getConfiguredModelForProvider(provider);
    return {
      client: new HuggingFaceRouterJsonClient({ model }),
      modelLabel: model,
      providerLabel: getHuggingFaceRuntimeLabel(model),
    };
  }

  if (provider === "openai") {
    const model = config?.model ?? getConfiguredModelForProvider(provider);
    return {
      client: new OpenAIResponsesJsonClient({ model }),
      modelLabel: model,
      providerLabel: getOpenAIRuntimeLabel(model),
    };
  }

  throw new Error(
    `Unsupported XMOCHA_MODEL_PROVIDER "${provider}". Use "gemma", "google", "huggingface", "openai", "deepseek", or "anthropic". Default is "${getDefaultModelForProvider("huggingface")}".`,
  );
}
