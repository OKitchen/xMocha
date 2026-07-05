import { describe, it, expect } from "vitest";

import { encodeEntanglement } from "./entanglement-encoder";
import type { Branch, SessionState } from "./types";

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: "test-session",
    dilemma: "Test dilemma",
    language: "en",
    visualMode: "avatar-room",
    visualStyle: "career-studio",
    domain: "career",
    theme: "sci-fi",
    turn: 1,
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

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: "b1",
    title: "Test Path",
    summary: "Take the test path",
    consequence: "Things change",
    score: 0.7,
    timeHorizon: "3-6 months",
    riskProfile: "medium",
    keyUncertainty: "Will it work?",
    ...overrides,
  };
}

describe("encodeEntanglement", () => {
  it("appends trace entries to quantumTrace", () => {
    const session = makeSession({ quantumTrace: [] });
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch(),
    });
    expect(result.quantumTrace.length).toBeGreaterThan(0);
  });

  it("limits quantumTrace to 5 entries", () => {
    const session = makeSession({
      quantumTrace: ["a", "b", "c", "d"],
    });
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch(),
    });
    expect(result.quantumTrace.length).toBeLessThanOrEqual(5);
  });

  it("updates userPersona riskTolerance based on branch risk", () => {
    const session = makeSession();
    const highRisk = makeBranch({ riskProfile: "high" });
    const result = encodeEntanglement({ session, selectedBranch: highRisk });
    expect(result.userPersona.riskTolerance).toBe("high");

    const lowRisk = makeBranch({ riskProfile: "low" });
    const result2 = encodeEntanglement({ session, selectedBranch: lowRisk });
    expect(result2.userPersona.riskTolerance).toBe("low");
  });

  it("appends branch title to recentWins", () => {
    const session = makeSession();
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch({ title: "Bold Move" }),
    });
    expect(result.userPersona.recentWins).toContain("Bold Move");
  });

  it("limits recentWins to 3 entries", () => {
    const session = makeSession({
      userPersona: {
        riskTolerance: "medium",
        emotionalState: "curious",
        primaryValue: "clarity",
        recentWins: ["w1", "w2", "w3"],
        openWounds: [],
      },
    });
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch({ title: "w4" }),
    });
    expect(result.userPersona.recentWins).toHaveLength(3);
    expect(result.userPersona.recentWins).toContain("w4");
    expect(result.userPersona.recentWins).not.toContain("w1");
  });

  it("appends keyUncertainty to openWounds for high-risk branches", () => {
    const session = makeSession();
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch({
        riskProfile: "high",
        keyUncertainty: "High stakes",
      }),
    });
    expect(result.userPersona.openWounds).toContain("High stakes");
  });

  it("does not add openWounds for non-high-risk branches", () => {
    const session = makeSession();
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch({ riskProfile: "low" }),
    });
    expect(result.userPersona.openWounds).toEqual([]);
  });

  it("uses Chinese emotional state for zh-CN sessions", () => {
    const session = makeSession({ language: "zh-CN" });
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch({ riskProfile: "high" }),
    });
    expect(result.userPersona.emotionalState).toBe("高能但紧绷");
  });

  it("uses English emotional state for en sessions", () => {
    const session = makeSession({ language: "en" });
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch({ riskProfile: "high" }),
    });
    expect(result.userPersona.emotionalState).toBe("charged");
  });

  it("includes branchWorldDelta pressure shift in trace", () => {
    const session = makeSession();
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch(),
      branchWorldDelta: {
        branchId: "b1",
        activatedConstraints: [],
        activatedOpportunities: [],
        pressureShift: "Rising tension",
      },
    });
    expect(result.quantumTrace.some((entry) => entry === "Rising tension")).toBe(true);
  });

  it("includes branchCommunity dominant narrative in trace", () => {
    const session = makeSession();
    const result = encodeEntanglement({
      session,
      selectedBranch: makeBranch(),
      branchCommunity: {
        branchId: "b1",
        agents: [],
        socialDynamics: "Complex",
        dominantNarrative: "Change is happening",
      },
    });
    expect(result.quantumTrace.some((entry) => entry === "Change is happening")).toBe(true);
  });
});
