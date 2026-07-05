import type { JsonGenerationClient } from "./anthropic-client";
import { parseNumberEnv, stripCodeFence } from "./llm-utils";
import type { OllamaChatResponse } from "./llm-utils";

export type GemmaOllamaJsonClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  model?: string;
  runtime?: string;
  temperature?: number;
};

export class GemmaOllamaJsonClient implements JsonGenerationClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly model: string;
  private readonly temperature: number;

  constructor(options: GemmaOllamaJsonClientOptions = {}) {
    const runtime = options.runtime ?? process.env.GEMMA_RUNTIME ?? "ollama";

    if (runtime !== "ollama") {
      throw new Error(
        `Unsupported GEMMA_RUNTIME "${runtime}". First-version Gemma support uses "ollama".`,
      );
    }

    this.apiKey = options.apiKey ?? process.env.GEMMA_API_KEY;
    this.baseUrl = (
      options.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
      "http://localhost:11434"
    ).replace(/\/$/, "");
    this.maxTokens =
      options.maxTokens ?? parseNumberEnv(process.env.GEMMA_MAX_TOKENS) ?? 2200;
    this.model = options.model ?? process.env.GEMMA_MODEL ?? "gemma4";
    this.temperature =
      options.temperature ?? parseNumberEnv(process.env.GEMMA_TEMPERATURE) ?? 0.7;
  }

  async generateJson(prompt: string): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          options: {
            num_predict: this.maxTokens,
            temperature: this.temperature,
          },
          messages: [
            {
              role: "system",
              content:
                "You are Gemma 4 powering xMocha. Return strict JSON only. Do not include Markdown, code fences, or commentary.",
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
        `Gemma Ollama request failed. Confirm Ollama is running at OLLAMA_BASE_URL="${this.baseUrl}" and the model "${this.model}" is available. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const responseText = await response.text();
    let payload: OllamaChatResponse;
    try {
      payload = JSON.parse(responseText) as OllamaChatResponse;
    } catch {
      throw new Error(
        `Gemma Ollama returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.error ??
          `Gemma Ollama request failed with status ${response.status}. Check OLLAMA_BASE_URL="${this.baseUrl}" and GEMMA_MODEL="${this.model}".`,
      );
    }

    const text = payload.message?.content?.trim();

    if (!text) {
      throw new Error("Gemma Ollama returned an empty response.");
    }

    return stripCodeFence(text);
  }
}
