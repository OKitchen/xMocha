import http from "node:http";
import https from "node:https";

import type { JsonGenerationClient } from "./anthropic-client";
import { describeFetchFailure, parseNumberEnv, stripCodeFence } from "./llm-utils";
import type { OllamaChatResponse, OpenAIChatResponse } from "./llm-utils";
import { getDefaultModelForProvider } from "./model-catalog";

export type GemmaRuntime = "huggingface" | "openai-compatible" | "ollama";

export type GemmaJsonClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  model?: string;
  runtime?: GemmaRuntime;
  temperature?: number;
};

function inferRuntime(value: GemmaRuntime | undefined): GemmaRuntime {
  if (value) return value;
  if (process.env.GEMMA_RUNTIME) return process.env.GEMMA_RUNTIME as GemmaRuntime;
  return "ollama";
}

function assertSupportedRuntime(runtime: string): asserts runtime is GemmaRuntime {
  if (
    runtime !== "huggingface" &&
    runtime !== "openai-compatible" &&
    runtime !== "ollama"
  ) {
    throw new Error(
      `Unsupported GEMMA_RUNTIME "${runtime}". Use "huggingface", "openai-compatible", or "ollama".`,
    );
  }
}

async function postJsonDirect(
  urlString: string,
  body: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Request aborted."));
      return;
    }

    const url = new URL(urlString);
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        method: "POST",
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body).toString(),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    const abortRequest = () => request.destroy(new Error("Request aborted."));

    signal?.addEventListener("abort", abortRequest, { once: true });
    request.on("error", reject);
    request.on("close", () => {
      signal?.removeEventListener("abort", abortRequest);
    });
    request.write(body);
    request.end();
  });
}

export function getGemmaRuntimeLabel(model?: string, runtimeOverride?: GemmaRuntime): string {
  const runtime = inferRuntime(runtimeOverride);
  assertSupportedRuntime(runtime);

  const defaultModel = getDefaultModelForProvider("gemma");
  const envModelApplies =
    !runtimeOverride || !process.env.GEMMA_RUNTIME || process.env.GEMMA_RUNTIME === runtimeOverride;
  return `Gemma 4 (${model ?? (envModelApplies ? process.env.GEMMA_MODEL : undefined) ?? defaultModel}, ${runtime})`;
}

export class GemmaJsonClient implements JsonGenerationClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly model: string;
  private readonly runtime: GemmaRuntime;
  private readonly temperature: number;

  constructor(options: GemmaJsonClientOptions = {}) {
    const runtime = inferRuntime(options.runtime);
    assertSupportedRuntime(runtime);

    this.runtime = runtime;
    this.apiKey =
      this.runtime === "huggingface"
        ? options.apiKey ?? process.env.GEMMA_API_KEY ?? process.env.HF_TOKEN
        : options.apiKey ?? process.env.GEMMA_API_KEY;
    this.baseUrl = this.resolveBaseUrl(options.baseUrl).replace(/\/$/, "");
    this.maxTokens =
      options.maxTokens ??
      parseNumberEnv(process.env.GEMMA_MAX_TOKENS) ??
      (this.runtime === "ollama" ? 6000 : 2200);
    this.model = options.model ?? process.env.GEMMA_MODEL ?? this.defaultModel();
    this.temperature =
      options.temperature ?? parseNumberEnv(process.env.GEMMA_TEMPERATURE) ?? 0.7;

    if (this.runtime === "huggingface" && !this.apiKey) {
      throw new Error(
        "HF_TOKEN or GEMMA_API_KEY is required to use Gemma 4 through Hugging Face Router.",
      );
    }
  }

  async generateJson(prompt: string, options: { signal?: AbortSignal } = {}): Promise<string> {
    if (this.runtime === "ollama") {
      return this.generateWithOllama(prompt, options);
    }

    return this.generateWithOpenAICompatible(prompt, options);
  }

  private defaultModel(): string {
    return getDefaultModelForProvider("gemma");
  }

  private resolveBaseUrl(baseUrl: string | undefined): string {
    if (baseUrl) return baseUrl;
    if (process.env.GEMMA_BASE_URL) return process.env.GEMMA_BASE_URL;

    if (this.runtime === "huggingface") {
      return "https://router.huggingface.co/v1";
    }

    if (this.runtime === "openai-compatible") {
      return "http://localhost:1234/v1";
    }

    return process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  }

  private async generateWithOpenAICompatible(
    prompt: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
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
        `Gemma 4 request failed. Confirm GEMMA_RUNTIME="${this.runtime}", GEMMA_BASE_URL="${this.baseUrl}", and GEMMA_MODEL="${this.model}". ${
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
        `Gemma 4 returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `Gemma 4 request failed with status ${response.status}. Check GEMMA_BASE_URL="${this.baseUrl}" and GEMMA_MODEL="${this.model}".`,
      );
    }

    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("Gemma 4 returned an empty response.");
    }

    return stripCodeFence(text);
  }

  private async generateWithOllama(
    prompt: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<string> {
    let response: { ok: boolean; status: number; text: string };
    const body = JSON.stringify({
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
    });

    try {
      response = await postJsonDirect(
        `${this.baseUrl}/api/chat`,
        body,
        {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        options.signal,
      );
    } catch (error) {
      throw new Error(
        `Gemma Ollama request failed. Confirm Ollama is running at OLLAMA_BASE_URL="${this.baseUrl}" and the model "${this.model}" is available. ${
          describeFetchFailure(error)
        }`,
      );
    }

    const responseText = response.text;
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
