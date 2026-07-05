import type {
  Branch,
  CanonicalStep,
  CollapseResult,
  SessionState,
  ShadowBranch,
  TurnGenerationResult,
} from "./types";

export function applyCollapse(
  session: SessionState,
  turnResult: TurnGenerationResult,
  selectedBranchId: string,
): CollapseResult {
  const selectedBranch = turnResult.branches.find(
    (branch) => branch.id === selectedBranchId,
  );

  if (!selectedBranch) {
    throw new Error(`Selected branch "${selectedBranchId}" was not found.`);
  }

  const turn = turnResult.turnNumber;
  const canonicalStep: CanonicalStep = {
    ...selectedBranch,
    turn,
  };

  const archivedBranches: ShadowBranch[] = turnResult.branches
    .filter((branch) => branch.id !== selectedBranchId)
    .map((branch) => ({
      ...branch,
      turn,
    }));

  const updatedSession: SessionState = {
    ...session,
    turn,
    status: turn >= session.maxTurns ? "complete" : "active",
    canonicalPath: [...session.canonicalPath, canonicalStep],
    shadowTimelines: [...session.shadowTimelines, archivedBranches],
  };

  return {
    session: updatedSession,
    selectedBranch,
    archivedBranches,
  };
}

export function branchToCompactSummary(branch: Branch): string {
  return `${branch.title}: ${branch.consequence}`;
}
