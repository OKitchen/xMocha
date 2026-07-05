import { describe, it, expect } from "vitest";

import {
  createInitialSimulationState,
  applyInfluenceEventsToSimulationState,
} from "./simulation-state";
import type { InfluenceEvent, SimulationState, UserPersona } from "./types";

function makeEvent(overrides: Partial<InfluenceEvent> = {}): InfluenceEvent {
  return {
    id: "ie-1",
    turn: 1,
    branchId: "b1",
    sourceType: "individual",
    sourceId: "observer",
    targetType: "society",
    targetId: "primary-stakeholder",
    dimension: "trust",
    direction: "increase",
    intensity: 0.6,
    explanation: "A trust-building move",
    ...overrides,
  };
}

describe("createInitialSimulationState", () => {
  it("creates a default coupled simulation state", () => {
    const state = createInitialSimulationState();
    expect(state.scope).toBe("coupled");
    expect(state.individual.confidence).toBe(0.5);
    expect(state.individual.trust).toBe(0.5);
    expect(state.updatedAtTurn).toBe(0);
  });

  it("uses risk tolerance from user persona", () => {
    const persona: UserPersona = {
      riskTolerance: "high",
      emotionalState: "charged",
      primaryValue: "ambition",
      recentWins: [],
      openWounds: [],
    };
    const state = createInitialSimulationState({ userPersona: persona });
    expect(state.individual.riskTolerance).toBe(0.78);
  });

  it("uses low risk tolerance value", () => {
    const persona: UserPersona = {
      riskTolerance: "low",
      emotionalState: "steady",
      primaryValue: "stability",
      recentWins: [],
      openWounds: [],
    };
    const state = createInitialSimulationState({ userPersona: persona });
    expect(state.individual.riskTolerance).toBe(0.3);
  });

  it("builds stakeholders from user context key stakeholders", () => {
    const state = createInitialSimulationState({
      userContextPack: {
        userGoal: "test",
        currentPosition: "test",
        availableOptions: [],
        riskPreference: "medium",
        timeHorizon: "3 months",
        personalConstraints: [],
        keyStakeholders: ["My Boss", "My Team"],
        successCriteria: [],
      },
    });
    expect(state.stakeholders.length).toBeGreaterThanOrEqual(2);
    expect(state.stakeholders.some((s) => s.role === "My Boss")).toBe(true);
  });

  it("provides at least one default stakeholder when none given", () => {
    const state = createInitialSimulationState();
    expect(state.stakeholders.length).toBeGreaterThanOrEqual(1);
  });

  it("includes ai-adapter identity for preset scenarios", () => {
    const state = createInitialSimulationState({
      presetScenario: {
        scenarioId: "ai_future_of_work",
        title: "AI Test",
        theme: "sci-fi",
        domain: "career",
        summary: "test",
        baseDilemma: "test",
        worldFacts: [],
        constraints: [],
        opportunities: [],
        socialTensions: [],
        seedNarratives: [],
        roleCast: [],
        starterUserContext: {
          userGoal: "test",
          currentPosition: "test",
          availableOptions: [],
          riskPreference: "medium",
          timeHorizon: "3 months",
          personalConstraints: [],
          keyStakeholders: [],
          successCriteria: [],
        },
      },
    });
    expect(state.individual.identity).toContain("ai-adapter");
  });
});

describe("applyInfluenceEventsToSimulationState", () => {
  it("does not mutate the original state", () => {
    const state = createInitialSimulationState();
    const originalTrust = state.individual.trust;
    const events = [makeEvent({ targetType: "individual", dimension: "trust", direction: "increase" })];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);

    expect(state.individual.trust).toBe(originalTrust);
    expect(next.individual.trust).not.toBe(originalTrust);
  });

  it("increases individual trust on trust-increase event", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "individual",
        dimension: "trust",
        direction: "increase",
        intensity: 0.8,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.individual.trust).toBeGreaterThan(state.individual.trust);
  });

  it("increases individual stress on risk-increase event", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "individual",
        dimension: "risk",
        direction: "increase",
        intensity: 0.7,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.individual.stress).toBeGreaterThan(state.individual.stress);
  });

  it("updates society stakeholder trust on society-trust event", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "society",
        targetId: state.stakeholders[0].id,
        dimension: "trust",
        direction: "increase",
        intensity: 0.7,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.stakeholders[0].trust).toBeGreaterThan(state.stakeholders[0].trust);
  });

  it("updates environment metrics on environment event", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "environment",
        dimension: "opportunity",
        direction: "increase",
        intensity: 0.8,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.environmentMetrics.opportunity!).toBeGreaterThan(
      state.environmentMetrics.opportunity!,
    );
  });

  it("updates the turn number", () => {
    const state = createInitialSimulationState();
    const next = applyInfluenceEventsToSimulationState(state, [], 3);
    expect(next.updatedAtTurn).toBe(3);
  });

  it("creates a new stakeholder if targetId doesn't match existing ones", () => {
    const state = createInitialSimulationState();
    const initialCount = state.stakeholders.length;
    const events = [
      makeEvent({
        targetType: "society",
        targetId: "brand-new-stakeholder",
        dimension: "trust",
        direction: "increase",
        intensity: 0.5,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.stakeholders.length).toBe(initialCount + 1);
  });

  it("creates fallback primary stakeholders in Chinese for Chinese states", () => {
    const state = createInitialSimulationState({
      language: "zh-CN",
      userContextPack: {
        userGoal: "测试",
        currentPosition: "测试",
        availableOptions: [],
        riskPreference: "medium",
        timeHorizon: "3个月",
        personalConstraints: [],
        keyStakeholders: ["当前经理"],
        successCriteria: [],
      },
    });
    const events = [
      makeEvent({
        targetType: "society",
        targetId: "primary-stakeholder",
        dimension: "trust",
        direction: "increase",
        intensity: 0.5,
      }),
    ];

    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    const stakeholder = next.stakeholders.find(
      (item) => item.id === "primary-stakeholder",
    );

    expect(stakeholder?.role).toBe("关键利益相关者");
    expect(stakeholder?.currentGoal).toBe("回应观察者的选择。");
  });

  it("handles behavior dimension for individual events", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "individual",
        dimension: "behavior",
        direction: "increase",
        intensity: 0.6,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.individual.skills.adaptation).toBeGreaterThan(
      state.individual.skills.adaptation ?? 0.5,
    );
  });

  it("handles opportunity dimension for individual events", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "individual",
        dimension: "opportunity",
        direction: "increase",
        intensity: 0.7,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.individual.confidence).toBeGreaterThan(state.individual.confidence);
  });

  it("handles redirect direction", () => {
    const state = createInitialSimulationState();
    const events = [
      makeEvent({
        targetType: "individual",
        dimension: "trust",
        direction: "redirect",
        intensity: 0.5,
      }),
    ];
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.individual.trust).not.toBe(state.individual.trust);
  });

  it("clamps all values between 0 and 1", () => {
    const state = createInitialSimulationState();
    const events = Array.from({ length: 20 }, () =>
      makeEvent({
        targetType: "individual",
        dimension: "trust",
        direction: "increase",
        intensity: 1.0,
      }),
    );
    const next = applyInfluenceEventsToSimulationState(state, events, 1);
    expect(next.individual.trust).toBeLessThanOrEqual(1);
    expect(next.individual.trust).toBeGreaterThanOrEqual(0);
  });
});
