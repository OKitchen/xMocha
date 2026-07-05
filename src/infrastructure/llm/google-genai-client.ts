import { GoogleGenAI, ThinkingLevel } from "@google/genai";

import type { JsonGenerationClient } from "./anthropic-client";
import { parseNumberEnv, stripCodeFence } from "./llm-utils";
import { getDefaultModelForProvider } from "./model-catalog";

export type GoogleGenAIJsonClientOptions = {
  apiKey?: string;
  maxOutputTokens?: number;
  model?: string;
  temperature?: number;
  thinkingLevel?: string;
};

function describeGoogleError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause as
    | { code?: string; message?: string; name?: string }
    | undefined;
  const causeDetails = cause
    ? ` Cause: ${cause.name ?? "Error"}${cause.code ? ` (${cause.code})` : ""}: ${cause.message ?? "unknown error"}.`
    : "";

  return `${error.name}: ${error.message}.${causeDetails}`;
}

function normalizeThinkingLevel(value: string | undefined): ThinkingLevel | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "MINIMAL") return ThinkingLevel.MINIMAL;
  if (normalized === "LOW") return ThinkingLevel.LOW;
  if (normalized === "MEDIUM") return ThinkingLevel.MEDIUM;
  if (normalized === "HIGH") return ThinkingLevel.HIGH;

  return undefined;
}

export function getGoogleGenAIRuntimeLabel(model?: string): string {
  return `Google Gemini API (${model ?? process.env.GOOGLE_GENAI_MODEL ?? process.env.GEMINI_MODEL ?? getDefaultModelForProvider("google")})`;
}

export class GoogleGenAIJsonClient implements JsonGenerationClient {
  private readonly client: GoogleGenAI;
  private readonly maxOutputTokens: number;
  private readonly model: string;
  private readonly temperature: number;
  private readonly thinkingLevel?: ThinkingLevel;

  constructor(options: GoogleGenAIJsonClientOptions = {}) {
    const apiKey =
      options.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY or GEMINI_API_KEY is required to use Google Gemini API generation.",
      );
    }

    this.client = new GoogleGenAI({ apiKey });
    this.model =
      options.model ??
      process.env.GOOGLE_GENAI_MODEL ??
      process.env.GEMINI_MODEL ??
      getDefaultModelForProvider("google");
    this.maxOutputTokens =
      options.maxOutputTokens ??
      parseNumberEnv(process.env.GOOGLE_MAX_OUTPUT_TOKENS) ??
      parseNumberEnv(process.env.GEMINI_MAX_OUTPUT_TOKENS) ??
      6000;
    this.temperature =
      options.temperature ??
      parseNumberEnv(process.env.GOOGLE_TEMPERATURE) ??
      parseNumberEnv(process.env.GEMINI_TEMPERATURE) ??
      0.7;
    this.thinkingLevel = normalizeThinkingLevel(
      options.thinkingLevel ??
        process.env.GOOGLE_THINKING_LEVEL ??
        process.env.GEMINI_THINKING_LEVEL,
    );
  }

  async generateJson(prompt: string, _options: { signal?: AbortSignal } = {}): Promise<string> {
    let response;

    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction:
            "You are Gemma 4 powering xMocha. Return strict JSON only. Do not include Markdown, code fences, or commentary.",
          temperature: this.temperature,
          maxOutputTokens: this.maxOutputTokens,
          responseMimeType: "application/json",
          ...(this.thinkingLevel
            ? {
                thinkingConfig: {
                  thinkingLevel: this.thinkingLevel,
                },
              }
            : {}),
        },
      });
    } catch (error) {
      throw new Error(`Google GenAI request failed. ${describeGoogleError(error)}`, {
        cause: error,
      });
    }

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Google Gemini API returned an empty response.");
    }

    return stripCodeFence(text);
  }
}
