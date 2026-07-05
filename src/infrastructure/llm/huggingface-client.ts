import { ProxyAgent, setGlobalDispatcher } from "undici";

import type { JsonGenerationClient } from "./anthropic-client";
import { describeFetchFailure, parseNumberEnv, stripCodeFence } from "./llm-utils";
import type { OpenAIChatResponse } from "./llm-utils";
import { getDefaultModelForProvider } from "./model-catalog";

export type HuggingFaceRouterJsonClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
};

let configuredProxy: string | undefined;

function configureProxyIfNeeded(): void {
  const proxy =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;

  if (!proxy || configuredProxy === proxy) {
    return;
  }

  setGlobalDispatcher(new ProxyAgent(proxy));
  configuredProxy = proxy;
}

export function getHuggingFaceRuntimeLabel(model?: string): string {
  return `Hugging Face Router (${model ?? process.env.HUGGINGFACE_MODEL ?? process.env.HF_MODEL ?? getDefaultModelForProvider("huggingface")})`;
}

export class HuggingFaceRouterJsonClient implements JsonGenerationClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly model: string;
  private readonly temperature: number;

  constructor(options: HuggingFaceRouterJsonClientOptions = {}) {
    configureProxyIfNeeded();

    const apiKey =
      options.apiKey ??
      process.env.HF_TOKEN ??
      process.env.HUGGINGFACE_API_KEY ??
      process.env.HF_API_TOKEN;

    if (!apiKey) {
      throw new Error(
        "HF_TOKEN is required to use Hugging Face Router generation.",
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (
      options.baseUrl ??
      process.env.HUGGINGFACE_BASE_URL ??
      process.env.HF_BASE_URL ??
      "https://router.huggingface.co/v1"
    ).replace(/\/$/, "");
    this.maxTokens =
      options.maxTokens ??
      parseNumberEnv(process.env.HUGGINGFACE_MAX_TOKENS) ??
      parseNumberEnv(process.env.HF_MAX_TOKENS) ??
      6000;
    this.model =
      options.model ??
      process.env.HUGGINGFACE_MODEL ??
      process.env.HF_MODEL ??
      getDefaultModelForProvider("huggingface");
    this.temperature =
      options.temperature ??
      parseNumberEnv(process.env.HUGGINGFACE_TEMPERATURE) ??
      parseNumberEnv(process.env.HF_TEMPERATURE) ??
      0.7;
  }

  async generateJson(prompt: string, options: { signal?: AbortSignal } = {}): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "You are the configured model powering xMocha. Return strict JSON only. Do not include Markdown, code fences, or commentary.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });
    } catch (error) {
      throw new Error(
        `Hugging Face Router request failed. Confirm HUGGINGFACE_BASE_URL="${this.baseUrl}" and HUGGINGFACE_MODEL="${this.model}". ${
          describeFetchFailure(error)
        }`,
      );
    }

    const responseText = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(responseText) as OpenAIChatResponse;
    } catch {
      throw new Error(
        `Hugging Face Router returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `Hugging Face Router request failed with status ${response.status}. Check HUGGINGFACE_MODEL="${this.model}".`,
      );
    }

    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("Hugging Face Router returned an empty response.");
    }

    return stripCodeFence(text);
  }
}
