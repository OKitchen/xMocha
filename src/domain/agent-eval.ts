import type { SessionState } from "./types";
import type { TurnRun } from "./world-types";

export type AgentEvalCase = {
  caseId: string;
  sessionId: string;
  mode: "decision" | "world";
  provider: string;
  model?: string;
  promptStyle?: "full" | "lite";
  worldPackId?: string;
  turn: number;
  inputSummary: string;
  candidateSummaries: string[];
  selectedCandidateId?: string;
  validationIssueCodes: string[];
  fallbackUsed: boolean;
  userFeedback?: {
    completed: boolean;
    helpful?: boolean;
    rating?: number;
    freeText?: string;
  };
  humanScores?: {
    characterConsistency?: number;
    worldCoherence?: number;
    actionRelevance?: number;
    fun?: number;
  };
};

export function buildAgentEvalCases(params: {
  session: SessionState;
  turnRuns: TurnRun[];
  userFeedback?: AgentEvalCase["userFeedback"];
  humanScores?: AgentEvalCase["humanScores"];
}): AgentEvalCase[] {
  return params.turnRuns.map((run) => ({
    caseId: `${run.sessionId}:${run.turn}:${run.attempt}`,
    sessionId: run.sessionId,
    mode: run.mode,
    provider: run.provider,
    model: run.model,
    promptStyle: run.promptStyle,
    worldPackId: run.worldPackId,
    turn: run.turn,
    inputSummary: summarizeInput(params.session, run),
    candidateSummaries: summarizeCandidates(run),
    selectedCandidateId: run.selectedCandidateId,
    validationIssueCodes: [...run.validationIssueCodes],
    fallbackUsed: run.fallbackUsed,
    userFeedback: params.userFeedback,
    humanScores: params.humanScores,
  }));
}

function summarizeInput(session: SessionState, run: TurnRun): string {
  const goal = session.worldExperiencePlan?.primaryGoal ?? session.dilemma;
  const recent = session.worldRuntimeState?.recentEvents.join(" / ") ?? session.canonicalPath.at(-1)?.summary;
  return [
    `mode=${run.mode}`,
    `turn=${run.turn}`,
    `goal=${goal}`,
    recent ? `recent=${recent}` : undefined,
    `active=${run.activeCharacterIds.join(",")}`,
  ].filter(Boolean).join("; ");
}

function summarizeCandidates(run: TurnRun): string[] {
  if (run.candidateStatePreviews?.length) {
    return run.candidateStatePreviews.map((preview) =>
      [
        preview.candidateId,
        `rev ${preview.parentRevision}->${preview.previewRevision}`,
        `active=${preview.activeCharacterIds.join(",")}`,
        `flags=${preview.worldFlags.slice(-3).join(",")}`,
        `recent=${preview.recentEvents.at(-1) ?? ""}`,
      ].join("; "),
    );
  }
  return run.nodes
    ?.filter((node) => node.kind === "candidate")
    .map((node) => `${node.nodeId}; status=${node.status}; issues=${node.issueCodes.join(",")}`)
    ?? [];
}
