import { describe, it, expect } from "vitest";

import {
  buildFallbackInfluenceEvents,
  reconcileInfluenceEvents,
  influenceEventsForBranch,
} from "./influence-events";
import type { Branch, BranchCommunity, BranchWorldDelta } from "./types";

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

function makeCommunity(branchId: string): BranchCommunity {
  return {
    branchId,
    agents: [
      {
        role: "manager",
        stance: "uncertain",
        motivation: "needs results",
        influence: 0.8,
        reaction: "watching closely",
      },
    ],
    socialDynamics: "Tension building",
    dominantNarrative: "Change is coming",
  };
}

function makeDelta(branchId: string): BranchWorldDelta {
  return {
    branchId,
    activatedConstraints: [],
    activatedOpportunities: [],
    pressureShift: "Pressure is increasing",
  };
}

describe("buildFallbackInfluenceEvents", () => {
  it("produces two events per branch (individual->society and society->individual)", () => {
    const branches = [makeBranch({ id: "b1" })];
    const events = buildFallbackInfluenceEvents({
      branches,
      branchCommunities: [makeCommunity("b1")],
      branchWorldDeltas: [makeDelta("b1")],
      turnNumber: 1,
    });
    expect(events).toHaveLength(2);
    expect(events[0].sourceType).toBe("individual");
    expect(events[0].targetType).toBe("society");
    expect(events[1].targetType).toBe("individual");
  });

  it("creates events for each branch", () => {
    const branches = [
      makeBranch({ id: "b1" }),
      makeBranch({ id: "b2" }),
      makeBranch({ id: "b3" }),
    ];
    const events = buildFallbackInfluenceEvents({
      branches,
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 2,
    });
    expect(events).toHaveLength(6);
  });

  it("sets correct intensity for different risk profiles", () => {
    const highRisk = makeBranch({ id: "high", riskProfile: "high" });
    const lowRisk = makeBranch({ id: "low", riskProfile: "low" });
    const events = buildFallbackInfluenceEvents({
      branches: [highRisk, lowRisk],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    const highEvents = events.filter((e) => e.branchId === "high");
    const lowEvents = events.filter((e) => e.branchId === "low");
    expect(highEvents[0].intensity).toBeGreaterThan(lowEvents[0].intensity);
  });

  it("sets correct dimension for high-risk branches", () => {
    const branch = makeBranch({ id: "b1", riskProfile: "high" });
    const events = buildFallbackInfluenceEvents({
      branches: [branch],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    expect(events[0].dimension).toBe("pressure");
    expect(events[1].dimension).toBe("risk");
  });

  it("sets correct dimension for low-risk branches", () => {
    const branch = makeBranch({ id: "b1", riskProfile: "low" });
    const events = buildFallbackInfluenceEvents({
      branches: [branch],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    expect(events[0].dimension).toBe("trust");
    expect(events[1].dimension).toBe("trust");
  });

  it("produces English explanations for non-CJK branches", () => {
    const branch = makeBranch({ id: "b1", title: "Bold move" });
    const events = buildFallbackInfluenceEvents({
      branches: [branch],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    expect(events[0].explanation).toContain("Choosing");
  });

  it("produces Chinese explanations for CJK branches", () => {
    const branch = makeBranch({ id: "b1", title: "大胆一步" });
    const events = buildFallbackInfluenceEvents({
      branches: [branch],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    expect(events[0].explanation).toContain("选择");
  });
});

describe("reconcileInfluenceEvents", () => {
  it("returns existing events if all branches are covered", () => {
    const branches = [makeBranch({ id: "b1" })];
    const existingEvents = buildFallbackInfluenceEvents({
      branches,
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    const result = reconcileInfluenceEvents({
      branches,
      branchCommunities: [],
      branchWorldDeltas: [],
      influenceEvents: existingEvents,
      turnNumber: 1,
    });
    expect(result).toHaveLength(existingEvents.length);
  });

  it("adds fallback events for missing branches", () => {
    const branches = [makeBranch({ id: "b1" }), makeBranch({ id: "b2" })];
    const existingEvents = buildFallbackInfluenceEvents({
      branches: [makeBranch({ id: "b1" })],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    const result = reconcileInfluenceEvents({
      branches,
      branchCommunities: [],
      branchWorldDeltas: [],
      influenceEvents: existingEvents,
      turnNumber: 1,
    });
    expect(result.length).toBeGreaterThan(existingEvents.length);
    expect(result.some((e) => e.branchId === "b2")).toBe(true);
  });

  it("filters out events for non-existent branches", () => {
    const result = reconcileInfluenceEvents({
      branches: [makeBranch({ id: "b1" })],
      branchCommunities: [],
      branchWorldDeltas: [],
      influenceEvents: buildFallbackInfluenceEvents({
        branches: [makeBranch({ id: "old-branch" })],
        branchCommunities: [],
        branchWorldDeltas: [],
        turnNumber: 1,
      }),
      turnNumber: 1,
    });
    expect(result.every((e) => e.branchId === "b1")).toBe(true);
  });
});

describe("influenceEventsForBranch", () => {
  it("filters events by branchId", () => {
    const events = buildFallbackInfluenceEvents({
      branches: [makeBranch({ id: "b1" }), makeBranch({ id: "b2" })],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    const filtered = influenceEventsForBranch(events, "b1");
    expect(filtered.every((e) => e.branchId === "b1")).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown branchId", () => {
    const events = buildFallbackInfluenceEvents({
      branches: [makeBranch({ id: "b1" })],
      branchCommunities: [],
      branchWorldDeltas: [],
      turnNumber: 1,
    });
    expect(influenceEventsForBranch(events, "nonexistent")).toEqual([]);
  });
});
