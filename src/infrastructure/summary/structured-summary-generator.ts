import type { SummaryGenerator } from "../../application/ports";
import { sessionSummarySchema } from "../../domain/schemas";
import type { SessionState, SessionSummary } from "../../domain/types";
import {
  AnthropicJsonClient,
  type JsonGenerationClient,
} from "../llm/anthropic-client";
import { buildStructuredSummaryPrompt } from "./summary-prompts";

export class StructuredSummaryGenerator implements SummaryGenerator {
  constructor(
    private readonly client: JsonGenerationClient = new AnthropicJsonClient(),
    private readonly providerLabel = "LLM",
  ) {}

  async generate(session: SessionState): Promise<SessionSummary> {
    const basePrompt = buildStructuredSummaryPrompt(session);
    const prompts = [
      basePrompt,
      `${basePrompt}\n\nYour previous answer was invalid. Return only strict JSON matching the required shape. Do not include Markdown, code fences, or commentary.`,
    ];

    let lastError: unknown;

    for (let attempt = 0; attempt < prompts.length; attempt += 1) {
      try {
        const responseText = await this.client.generateJson(prompts[attempt]!);
        const parsedJson = JSON.parse(responseText);
        return sessionSummarySchema.parse(parsedJson);
      } catch (error) {
        console.warn("summary_generation_attempt_failed", {
          provider: this.providerLabel,
          attempt: attempt + 1,
          message: error instanceof Error ? error.message : String(error),
        });
        lastError = error;
      }
    }

    throw new Error(
      `${this.providerLabel} summary generation failed after retry: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
