import type { BranchGenerator } from "../../application/ports";
import { findOutputLanguageIssues } from "../../domain/output-language";
import { turnDraftSchema } from "../../domain/schemas";
import type { TurnDraft, TurnGenerationInput } from "../../domain/types";
import type { JsonGenerationClient } from "../llm/anthropic-client";
import { AnthropicJsonClient } from "../llm/anthropic-client";
import { buildClaudeBranchGenerationPrompt } from "./branch-generation-prompts";

function normalizeScores(draft: TurnDraft): TurnDraft {
  const total = draft.branches.reduce((sum, branch) => sum + branch.score, 0);

  if (total <= 0) {
    return {
      ...draft,
      branches: draft.branches.map((branch, _index, branches) => ({
        ...branch,
        score: Number((1 / branches.length).toFixed(2)),
      })),
    };
  }

  return {
    ...draft,
    branches: draft.branches.map((branch) => ({
      ...branch,
      score: Number((branch.score / total).toFixed(2)),
    })),
  };
}

function assertBranchLinkage(draft: TurnDraft): void {
  const branchIds = new Set(draft.branches.map((branch) => branch.id));

  for (const delta of draft.branchWorldDeltas) {
    if (!branchIds.has(delta.branchId)) {
      throw new Error(`World delta references unknown branch id "${delta.branchId}".`);
    }
  }
}

function assertOutputLanguage(draft: TurnDraft, input: TurnGenerationInput): void {
  const issues = findOutputLanguageIssues({
    language: input.session.language,
    fields: [
      ...draft.branches.flatMap((branch) => [
        { label: `${branch.id}.title`, text: branch.title },
        { label: `${branch.id}.summary`, text: branch.summary },
        { label: `${branch.id}.consequence`, text: branch.consequence },
        { label: `${branch.id}.timeHorizon`, text: branch.timeHorizon },
        { label: `${branch.id}.keyUncertainty`, text: branch.keyUncertainty },
      ]),
      ...draft.branchWorldDeltas.flatMap((delta) => [
        { label: `${delta.branchId}.pressureShift`, text: delta.pressureShift },
        ...delta.activatedConstraints.map((text, index) => ({
          label: `${delta.branchId}.constraint.${index + 1}`,
          text,
        })),
        ...delta.activatedOpportunities.map((text, index) => ({
          label: `${delta.branchId}.opportunity.${index + 1}`,
          text,
        })),
      ]),
    ],
  });

  if (issues.length > 0) {
    throw new Error(`Output language mismatch. ${issues.slice(0, 4).join(" | ")}`);
  }
}

export class StructuredBranchGenerator implements BranchGenerator {
  constructor(
    private readonly client: JsonGenerationClient = new AnthropicJsonClient(),
    private readonly providerLabel = "LLM",
  ) {}

  async generate(input: TurnGenerationInput): Promise<TurnDraft> {
    const basePrompt = buildClaudeBranchGenerationPrompt(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const prompt = attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nYour previous answer was invalid: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }\nReturn only strict JSON matching the required shape. If output language is zh-CN, rewrite every user-visible natural-language value in Simplified Chinese. Do not include Markdown, code fences, or commentary.`;
      try {
        const responseText = await this.client.generateJson(prompt);
        const parsedJson = JSON.parse(responseText);
        const parsed = turnDraftSchema.parse(parsedJson);
        assertBranchLinkage(parsed);
        const normalized = normalizeScores(parsed);
        assertOutputLanguage(normalized, input);
        return normalized;
      } catch (error) {
        console.warn("branch_generation_attempt_failed", {
          provider: this.providerLabel,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        });
        lastError = error;
      }
    }

    throw new Error(
      `${this.providerLabel} structured generation failed after retry: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
