import { describe, it, expect } from "vitest";

import { applyCollapse, branchToCompactSummary } from "./collapse-handler";
import type {
  Branch,
  SessionState,
  TurnGenerationResult,
} from "./types";

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: "b1",
    title: "Test Branch",
    summary: "A summary",
    consequence: "A consequence",
    score: 0.7,
    timeHorizon: "3-6 months",
    riskProfile: "medium",
    keyUncertainty: "Some uncertainty",
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: "test-session",
    dilemma: "Test dilemma",
    language: "en",
    visualMode: "avatar-room",
    visualStyle: "career-studio",
    domain: "career",
    theme: "sci-fi",
    turn: 0,
    maxTurns: 5,
    status: "active",
    canonicalPath: [],
    quantumTrace: [],
    shadowTimelines: [],
    userPersona: {
      riskTolerance: "medium",
      emotionalState: "curious",
      primaryValue: "clarity",
      recentWins: [],
      openWounds: [],
    },
    userAuthoredActions: [],
    visualHistory: [],
    influenceEvents: [],
    simulationState: {
      scope: "coupled",
      individual: {
        skills: { adaptation: 0.5 },
        confidence: 0.5,
        reputation: 0.5,
        trust: 0.5,
        financialStability: 0.6,
        stress: 0.35,
        riskTolerance: 0.55,
        identity: [],
      },
      stakeholders: [],
      environmentMetrics: {},
      updatedAtTurn: 0,
    },
    groundingLog: [],
    generationFailures: [],
    analyticsEvents: [],
    ...overrides,
  };
}

function makeTurnResult(overrides: Partial<TurnGenerationResult> = {}): TurnGenerationResult {
  return {
    turnNumber: 1,
    branches: [
      makeBranch({ id: "b1", title: "Branch One" }),
      makeBranch({ id: "b2", title: "Branch Two" }),
      makeBranch({ id: "b3", title: "Branch Three" }),
    ],
    branchWorldDeltas: [],
    branchCommunities: [],
    influenceEvents: [],
    ...overrides,
  };
}

describe("applyCollapse", () => {
  it("selects the chosen branch and archives the rest", () => {
    const session = makeSession();
    const turnResult = makeTurnResult();
    const result = applyCollapse(session, turnResult, "b2");

    expect(result.selectedBranch.id).toBe("b2");
    expect(result.selectedBranch.title).toBe("Branch Two");
    expect(result.archivedBranches).toHaveLength(2);
    expect(result.archivedBranches.map((b) => b.id)).toEqual(["b1", "b3"]);
  });

  it("advances the session turn number", () => {
    const session = makeSession({ turn: 0 });
    const turnResult = makeTurnResult({ turnNumber: 1 });
    const result = applyCollapse(session, turnResult, "b1");

    expect(result.session.turn).toBe(1);
  });

  it("appends the selected branch to the canonical path", () => {
    const session = makeSession({ canonicalPath: [] });
    const turnResult = makeTurnResult({ turnNumber: 1 });
    const result = applyCollapse(session, turnResult, "b1");

    expect(result.session.canonicalPath).toHaveLength(1);
    expect(result.session.canonicalPath[0].turn).toBe(1);
    expect(result.session.canonicalPath[0].id).toBe("b1");
  });

  it("appends archived branches to shadow timelines", () => {
    const session = makeSession({ shadowTimelines: [] });
    const turnResult = makeTurnResult({ turnNumber: 1 });
    const result = applyCollapse(session, turnResult, "b1");

    expect(result.session.shadowTimelines).toHaveLength(1);
    expect(result.session.shadowTimelines[0]).toHaveLength(2);
  });

  it("marks session complete when maxTurns reached", () => {
    const session = makeSession({ turn: 4, maxTurns: 5 });
    const turnResult = makeTurnResult({ turnNumber: 5 });
    const result = applyCollapse(session, turnResult, "b1");

    expect(result.session.status).toBe("complete");
  });

  it("keeps session active when maxTurns not yet reached", () => {
    const session = makeSession({ turn: 2, maxTurns: 5 });
    const turnResult = makeTurnResult({ turnNumber: 3 });
    const result = applyCollapse(session, turnResult, "b1");

    expect(result.session.status).toBe("active");
  });

  it("throws when selectedBranchId does not exist", () => {
    const session = makeSession();
    const turnResult = makeTurnResult();

    expect(() => applyCollapse(session, turnResult, "nonexistent")).toThrow(
      'Selected branch "nonexistent" was not found.',
    );
  });
});

describe("branchToCompactSummary", () => {
  it("combines title and consequence", () => {
    const branch = makeBranch({ title: "Bold move", consequence: "High exposure" });
    expect(branchToCompactSummary(branch)).toBe("Bold move: High exposure");
  });
});
