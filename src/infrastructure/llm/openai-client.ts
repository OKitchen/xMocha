import type { JsonGenerationClient } from "./anthropic-client";
import { describeFetchFailure, parseNumberEnv, stripCodeFence } from "./llm-utils";
import { getDefaultModelForProvider } from "./model-catalog";

export type OpenAIResponsesJsonClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  model?: string;
};

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      output_text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export function getOpenAIRuntimeLabel(model?: string): string {
  return `OpenAI (${model ?? process.env.OPENAI_MODEL ?? getDefaultModelForProvider("openai")})`;
}

export class OpenAIResponsesJsonClient implements JsonGenerationClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly model: string;

  constructor(options: OpenAIResponsesJsonClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required to use OpenAI structured generation.",
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.maxOutputTokens =
      options.maxOutputTokens ??
      parseNumberEnv(process.env.OPENAI_MAX_OUTPUT_TOKENS) ??
      6000;
    this.model =
      options.model ??
      process.env.OPENAI_MODEL ??
      getDefaultModelForProvider("openai");
  }

  async generateJson(prompt: string, options: { signal?: AbortSignal } = {}): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_output_tokens: this.maxOutputTokens,
          input: [
            {
              role: "system",
              content:
                "You are the configured OpenAI model powering xMocha. Return strict JSON only. Do not include Markdown, code fences, or commentary.",
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
        `OpenAI Responses API request failed. Confirm OPENAI_BASE_URL="${this.baseUrl}" and OPENAI_MODEL="${this.model}". ${
          describeFetchFailure(error)
        }`,
      );
    }

    const responseText = await response.text();
    let payload: OpenAIResponsesPayload;
    try {
      payload = JSON.parse(responseText) as OpenAIResponsesPayload;
    } catch {
      throw new Error(
        `OpenAI returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `OpenAI request failed with status ${response.status}. Check OPENAI_MODEL="${this.model}".`,
      );
    }

    const text = extractResponseText(payload);

    if (!text) {
      throw new Error("OpenAI returned an empty response.");
    }

    return stripCodeFence(text);
  }
}

function extractResponseText(payload: OpenAIResponsesPayload): string | undefined {
  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.output_text ?? content.text ?? "")
    .join("\n")
    .trim() || undefined;
}
