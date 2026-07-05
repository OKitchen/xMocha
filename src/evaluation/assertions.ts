import { buildAblationReport } from "../domain/ablation-report";
import type { SessionState, TurnGenerationResult } from "../domain/types";

export type EvaluationCheck = {
  name: string;
  passed: boolean;
  details: string;
};

export type TurnEvaluationMetrics = {
  branchCount: number;
  distinctRiskProfiles: number;
  scoreTotal: number;
  communityCount: number;
  deltaCount: number;
  influenceEventCount: number;
};

function check(condition: boolean, name: string, details: string): EvaluationCheck {
  return { name, passed: condition, details };
}

function branchIds(result: TurnGenerationResult): string[] {
  return result.branches.map((branch) => branch.id);
}

export function evaluateTurnStructure(result: TurnGenerationResult): {
  checks: EvaluationCheck[];
  metrics: TurnEvaluationMetrics;
} {
  const ids = branchIds(result);
  const uniqueIds = new Set(ids);
  const uniqueTitles = new Set(result.branches.map((branch) => branch.title.trim()));
  const scoreTotal = Number(
    result.branches.reduce((sum, branch) => sum + branch.score, 0).toFixed(2),
  );
  const uniqueRiskProfiles = new Set(
    result.branches.map((branch) => branch.riskProfile),
  ).size;
  const deltaIds = new Set(result.branchWorldDeltas.map((delta) => delta.branchId));
  const communityIds = new Set(
    result.branchCommunities.map((community) => community.branchId),
  );
  const influenceBranchIds = new Set(
    result.influenceEvents.map((event) => event.branchId),
  );
  const visualPortalIds = new Set(
    result.visualScene?.branchPortals.map((portal) => portal.branchId) ?? [],
  );

  const checks = [
    check(
      result.branches.length >= 3 && result.branches.length <= 4,
      "branch-count",
      `Expected 3-4 branches, got ${result.branches.length}.`,
    ),
    check(
      uniqueIds.size === ids.length,
      "branch-id-uniqueness",
      `Expected unique branch ids, got ${ids.join(", ")}.`,
    ),
    check(
      uniqueTitles.size === result.branches.length,
      "branch-title-diversity",
      `Expected unique branch titles, got ${Array.from(uniqueTitles).join(" | ")}.`,
    ),
    check(
      uniqueRiskProfiles >= 2,
      "risk-profile-diversity",
      `Expected at least 2 distinct risk profiles, got ${uniqueRiskProfiles}.`,
    ),
    check(
      Math.abs(scoreTotal - 1) <= 0.05,
      "score-normalization",
      `Expected scores to sum near 1.00, got ${scoreTotal.toFixed(2)}.`,
    ),
    check(
      result.branchWorldDeltas.length === result.branches.length,
      "world-delta-count",
      `Expected ${result.branches.length} world deltas, got ${result.branchWorldDeltas.length}.`,
    ),
    check(
      result.branchCommunities.length === result.branches.length,
      "community-count",
      `Expected ${result.branches.length} communities, got ${result.branchCommunities.length}.`,
    ),
    check(
      ids.every((id) => deltaIds.has(id)),
      "world-delta-linkage",
      "Each branch should have a matching world delta.",
    ),
    check(
      ids.every((id) => communityIds.has(id)),
      "community-linkage",
      "Each branch should have a matching branch community.",
    ),
    check(
      result.influenceEvents.length >= result.branches.length * 2,
      "influence-event-count",
      `Expected at least ${result.branches.length * 2} influence events, got ${result.influenceEvents.length}.`,
    ),
    check(
      ids.every((id) => influenceBranchIds.has(id)),
      "influence-event-linkage",
      "Each branch should have at least one matching influence event.",
    ),
    check(
      Boolean(result.visualScene),
      "visual-scene-presence",
      "Expected a generated or fallback visual scene for the turn.",
    ),
    check(
      ids.every((id) => visualPortalIds.has(id)),
      "visual-portal-linkage",
      "Each branch should have a matching room portal.",
    ),
  ];

  return {
    checks,
    metrics: {
      branchCount: result.branches.length,
      distinctRiskProfiles: uniqueRiskProfiles,
      scoreTotal,
      communityCount: result.branchCommunities.length,
      deltaCount: result.branchWorldDeltas.length,
      influenceEventCount: result.influenceEvents.length,
    },
  };
}

export function evaluateCompletedSession(session: SessionState): EvaluationCheck[] {
  const ablationReport = buildAblationReport(session);

  return [
    check(
      session.status === "complete",
      "session-complete",
      `Expected completed session, got ${session.status}.`,
    ),
    check(
      session.canonicalPath.length === session.maxTurns,
      "canonical-path-length",
      `Expected canonical path length ${session.maxTurns}, got ${session.canonicalPath.length}.`,
    ),
    check(
      session.shadowTimelines.length === session.maxTurns,
      "shadow-timeline-length",
      `Expected shadow timeline length ${session.maxTurns}, got ${session.shadowTimelines.length}.`,
    ),
    check(
      session.quantumTrace.length > 0,
      "quantum-trace-presence",
      "Expected non-empty quantum trace after completing a session.",
    ),
    check(
      (session.influenceEvents?.length ?? 0) > 0,
      "influence-event-presence",
      "Expected non-empty influence events after completing a session.",
    ),
    check(
      Boolean(session.simulationState),
      "simulation-state-presence",
      "Expected simulation state after completing a session.",
    ),
    check(
      session.simulationState?.updatedAtTurn === session.turn,
      "simulation-state-turn",
      `Expected simulation state updated at turn ${session.turn}, got ${session.simulationState?.updatedAtTurn ?? "none"}.`,
    ),
    check(
      (session.simulationState?.stakeholders.length ?? 0) > 0,
      "simulation-stakeholder-presence",
      "Expected at least one stakeholder in simulation state.",
    ),
    check(
      ablationReport.runs.length === 4,
      "ablation-run-count",
      `Expected 4 ablation runs, got ${ablationReport.runs.length}.`,
    ),
    check(
      ablationReport.runs.every((run) => run.deltaFromFull),
      "ablation-full-delta",
      "Expected every ablation run to include deltaFromFull.",
    ),
    check(
      ablationReport.influenceEventCount === (session.influenceEvents?.length ?? 0),
      "ablation-event-count",
      `Expected ablation event count to match session influence events, got ${ablationReport.influenceEventCount}.`,
    ),
    check(
      Boolean(session.summary?.narrative?.trim()),
      "summary-narrative",
      "Expected generated summary narrative.",
    ),
    check(
      (session.summary?.decisionArc.length ?? 0) >= 1,
      "summary-decision-arc",
      "Expected at least one decision arc item in summary.",
    ),
  ];
}
