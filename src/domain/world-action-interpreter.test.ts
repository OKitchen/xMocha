import { describe, it, expect } from "vitest";

import { interpretWorldAction } from "./world-action-interpreter";
import type { WorldPack, WorldRuntimeState } from "./world-types";

function makeMinimalPack(overrides: Partial<WorldPack> = {}): WorldPack {
  return {
    schemaVersion: "world-pack-v1",
    worldPackId: "test-pack",
    version: 1,
    visibility: "curated",
    sourceType: "narrative",
    title: "Test World",
    language: "en",
    premise: "A test scenario",
    timeAnchor: "Present day",
    sourceAttribution: { label: "Test", rightsBasis: "public-domain" },
    canonFacts: [],
    rules: [],
    locations: [],
    characters: [
      {
        id: "char-a",
        name: "Alice",
        playable: true,
        identity: "A brave explorer",
        personality: ["bold"],
        goals: ["explore"],
        capabilities: ["investigate", "negotiate"],
        limitations: [],
        knownFactIds: [],
        unknownFactIds: [],
      },
      {
        id: "char-b",
        name: "Bob",
        playable: false,
        identity: "A merchant",
        personality: ["cautious"],
        goals: ["profit"],
        capabilities: [],
        limitations: [],
        knownFactIds: [],
        unknownFactIds: [],
      },
    ],
    relationships: [],
    openingScenario: {
      id: "opening-1",
      title: "The beginning",
      locationId: "loc-1",
      activeCharacterIds: ["char-b"],
      event: "Story begins",
      suggestedGoals: ["Survive"],
    },
    ...overrides,
  };
}

function makeRuntime(overrides: Partial<WorldRuntimeState> = {}): WorldRuntimeState {
  return {
    schemaVersion: "world-runtime-v1",
    worldPackId: "test-pack",
    worldPackVersion: 1,
    revision: 0,
    checkpoint: "turn-prepared",
    turn: 1,
    maxTurns: 5,
    playerCharacter: {
      characterId: "char-a",
      name: "Alice",
      identity: "A brave explorer",
      currentGoal: "Explore the world",
      capabilities: ["调度下人", "处理人情关系", "观察下人反应"],
      limitations: [],
      isCustom: false,
    },
    currentLocationId: "loc-1",
    activeCharacterIds: ["char-b"],
    characterStates: [],
    relationships: [],
    milestones: [],
    worldFlags: [],
    recentEvents: [],
    ...overrides,
  };
}

describe("interpretWorldAction", () => {
  it("detects investigate intent from Chinese keywords", () => {
    const result = interpretWorldAction({
      rawInput: "调查这件事的真相",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("investigate");
    expect(result.riskLabel).toBe("low");
  });

  it("detects investigate intent from English keywords", () => {
    const result = interpretWorldAction({
      rawInput: "investigate the missing records",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("investigate");
  });

  it("detects negotiate intent", () => {
    const result = interpretWorldAction({
      rawInput: "negotiate a deal with Bob",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("negotiate");
    expect(result.riskLabel).toBe("medium");
  });

  it("detects command intent", () => {
    const result = interpretWorldAction({
      rawInput: "命令下人准备物资",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("command");
  });

  it("detects threaten intent with high risk", () => {
    const result = interpretWorldAction({
      rawInput: "威胁他如果不合作就惩罚",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("threaten");
    expect(result.riskLabel).toBe("high");
  });

  it("detects deceive intent with high risk", () => {
    const result = interpretWorldAction({
      rawInput: "deceive everyone about the plan",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("deceive");
    expect(result.riskLabel).toBe("high");
  });

  it("detects withdraw intent with low risk", () => {
    const result = interpretWorldAction({
      rawInput: "withdraw from the situation and wait",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("withdraw");
    expect(result.riskLabel).toBe("low");
  });

  it("defaults to negotiate for unmatched input", () => {
    const result = interpretWorldAction({
      rawInput: "do something completely unknown",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.intent).toBe("negotiate");
  });

  it("respects fallbackRisk override", () => {
    const result = interpretWorldAction({
      rawInput: "investigate",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
      fallbackRisk: "high",
    });
    expect(result.riskLabel).toBe("high");
  });

  it("finds target characters by name", () => {
    const result = interpretWorldAction({
      rawInput: "talk to Bob about the issue",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.targetCharacterIds).toContain("char-b");
  });

  it("flags modern-technology actions as violating limitations", () => {
    const result = interpretWorldAction({
      rawInput: "打电话给律师处理合同",
      runtime: makeRuntime(),
      pack: makeMinimalPack(),
    });
    expect(result.violatesLimitations.length).toBeGreaterThan(0);
    expect(result.feasible).toBe(false);
  });

  it("produces English explanation for en-language pack", () => {
    const result = interpretWorldAction({
      rawInput: "investigate",
      runtime: makeRuntime(),
      pack: makeMinimalPack({ language: "en" }),
    });
    expect(result.explanation).toContain("Intent:");
  });

  it("produces Chinese explanation for zh-CN language pack", () => {
    const result = interpretWorldAction({
      rawInput: "调查",
      runtime: makeRuntime(),
      pack: makeMinimalPack({ language: "zh-CN" }),
    });
    expect(result.explanation).toContain("动作意图判定为");
  });
});
