import Anthropic from "@anthropic-ai/sdk";

import { stripCodeFence } from "./llm-utils";
import { getDefaultModelForProvider } from "./model-catalog";

export interface JsonGenerationClient {
  generateJson(prompt: string, options?: { signal?: AbortSignal }): Promise<string>;
}

export type AnthropicJsonClientOptions = {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
};

export class AnthropicJsonClient implements JsonGenerationClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: AnthropicJsonClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required to use Claude structured generation.",
      );
    }

    this.client = new Anthropic({ apiKey });
    this.model =
      options.model ??
      process.env.ANTHROPIC_MODEL ??
      getDefaultModelForProvider("anthropic");
    this.maxTokens = options.maxTokens ?? 2200;
  }

  async generateJson(prompt: string, _options: { signal?: AbortSignal } = {}): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Claude returned an empty response.");
    }

    return stripCodeFence(text);
  }
}

