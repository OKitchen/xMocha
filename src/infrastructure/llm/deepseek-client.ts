import type { JsonGenerationClient } from "./anthropic-client";
import { stripCodeFence } from "./llm-utils";
import type { OpenAIChatResponse } from "./llm-utils";
import { getDefaultModelForProvider } from "./model-catalog";

export type DeepSeekJsonClientOptions = {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
};

export class DeepSeekJsonClient implements JsonGenerationClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(options: DeepSeekJsonClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY is required to use DeepSeek structured generation.",
      );
    }

    this.apiKey = apiKey;
    this.model =
      options.model ??
      process.env.DEEPSEEK_MODEL ??
      getDefaultModelForProvider("deepseek");
    this.maxTokens = options.maxTokens ?? 2200;
    this.baseUrl = options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  }

  async generateJson(prompt: string, options: { signal?: AbortSignal } = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: options.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const responseText = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(responseText) as OpenAIChatResponse;
    } catch {
      throw new Error(
        `DeepSeek returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `DeepSeek request failed with status ${response.status}.`,
      );
    }

    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("DeepSeek returned an empty response.");
    }

    return stripCodeFence(text);
  }
}
