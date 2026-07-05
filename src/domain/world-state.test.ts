import { describe, it, expect } from "vitest";

import {
  createExperiencePlan,
  createInitialWorldRuntimeState,
  applyWorldCandidate,
  previewWorldCandidateState,
  initializeWorldEventQueue,
  prepareWorldRuntimeState,
  markWorldCandidatesPending,
  worldTurnToTurnGenerationResult,
  revealSelectedWorldBranch,
  revealWorldTurnOutcomes,
} from "./world-state";
import type { WorldPack, WorldCandidate, WorldRuntimeState, WorldTurnResult } from "./world-types";
import type { Branch, TurnGenerationResult } from "./types";

function makeWorldPack(overrides: Partial<WorldPack> = {}): WorldPack {
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
    canonFacts: [{ id: "fact-1", statement: "The world is round", tags: ["geography"] }],
    rules: [{ id: "rule-1", description: "No violence", severity: "hard" }],
    locations: [
      { id: "loc-1", name: "Town Square", description: "Central area", connectedLocationIds: ["loc-2"] },
      { id: "loc-2", name: "Castle", description: "The castle", connectedLocationIds: ["loc-1"] },
    ],
    characters: [
      {
        id: "char-player",
        name: "Hero",
        playable: true,
        identity: "The brave hero",
        personality: ["brave"],
        goals: ["Save the world"],
        capabilities: ["combat", "negotiation"],
        limitations: ["cannot fly"],
        knownFactIds: ["fact-1"],
        unknownFactIds: [],
      },
      {
        id: "char-npc",
        name: "Guide",
        playable: false,
        identity: "A wise guide",
        personality: ["wise"],
        goals: ["Observe"],
        capabilities: [],
        limitations: [],
        knownFactIds: [],
        unknownFactIds: [],
      },
    ],
    relationships: [
      {
        sourceCharacterId: "char-player",
        targetCharacterId: "char-npc",
        kind: "ally",
        affinity: 2,
        tension: 0,
        publicContext: "They are friends",
      },
    ],
    openingScenario: {
      id: "opening-1",
      title: "The Beginning",
      locationId: "loc-1",
      activeCharacterIds: ["char-npc"],
      event: "The quest begins",
      suggestedGoals: ["Find the artifact"],
    },
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<WorldCandidate> = {}): WorldCandidate {
  return {
    id: "b1",
    actionTitle: "Investigate the ruins",
    visibleCue: "Dust settles around the ancient stones",
    hiddenOutcome: "You find a hidden passage",
    riskLabel: "low",
    requiredCapabilities: [],
    participatingCharacterIds: ["char-npc"],
    npcReactions: [
      {
        characterId: "char-npc",
        stance: "supportive",
        reaction: "Nods approvingly",
        usedFactIds: [],
      },
    ],
    stateDelta: {
      activeCharacterIds: ["char-npc"],
      relationshipDeltas: [],
      characterDeltas: [],
      addWorldFlags: ["ruins-explored"],
      removeWorldFlags: [],
      eventSummary: "The ruins have been explored",
    },
    milestoneSignals: [],
    groundingFactIds: [],
    ...overrides,
  };
}

describe("createExperiencePlan", () => {
  it("creates a plan with 3 milestones for an existing character", () => {
    const pack = makeWorldPack();
    const { plan, player } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "Save the world",
    });
    expect(plan.milestones).toHaveLength(3);
    expect(plan.primaryGoal).toBe("Save the world");
    expect(player.characterId).toBe("char-player");
    expect(player.isCustom).toBe(false);
  });

  it("creates a plan with a custom character", () => {
    const pack = makeWorldPack();
    const { player } = createExperiencePlan({
      pack,
      customCharacter: {
        name: "Custom Hero",
        identity: "A custom identity",
        goal: "Custom goal",
        strength: "Strong",
        weakness: "Slow",
      },
      primaryGoal: "Custom mission",
    });
    expect(player.isCustom).toBe(true);
    expect(player.name).toBe("Custom Hero");
  });

  it("throws when primary goal is empty", () => {
    const pack = makeWorldPack();
    expect(() =>
      createExperiencePlan({ pack, playerCharacterId: "char-player", primaryGoal: "" }),
    ).toThrow("primary world goal");
  });

  it("throws when character is not playable", () => {
    const pack = makeWorldPack();
    expect(() =>
      createExperiencePlan({ pack, playerCharacterId: "char-npc", primaryGoal: "Test" }),
    ).toThrow("playable character");
  });

  it("generates English milestones for en-language packs", () => {
    const pack = makeWorldPack({ language: "en" });
    const { plan } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "Test",
    });
    expect(plan.milestones[0].description).toContain("Understand");
  });

  it("generates Chinese milestones for zh-CN packs", () => {
    const pack = makeWorldPack({ language: "zh-CN" });
    const { plan } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "测试目标",
    });
    expect(plan.milestones[0].description).toContain("弄清");
  });
});

describe("createInitialWorldRuntimeState", () => {
  it("creates state with correct initial values", () => {
    const pack = makeWorldPack();
    const { plan, player } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "Save the world",
    });
    const state = createInitialWorldRuntimeState({ pack, plan, player });

    expect(state.schemaVersion).toBe("world-runtime-v1");
    expect(state.revision).toBe(0);
    expect(state.turn).toBe(0);
    expect(state.maxTurns).toBe(5);
    expect(state.currentLocationId).toBe("loc-1");
    expect(state.playerCharacter.characterId).toBe("char-player");
  });

  it("excludes player character from activeCharacterIds", () => {
    const pack = makeWorldPack({
      openingScenario: {
        id: "o1",
        title: "Start",
        locationId: "loc-1",
        activeCharacterIds: ["char-player", "char-npc"],
        event: "Begin",
        suggestedGoals: [],
      },
    });
    const { plan, player } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "Test",
    });
    const state = createInitialWorldRuntimeState({ pack, plan, player });
    expect(state.activeCharacterIds).not.toContain("char-player");
    expect(state.activeCharacterIds).toContain("char-npc");
  });
});

describe("applyWorldCandidate", () => {
  function makeState(): WorldRuntimeState {
    const pack = makeWorldPack();
    const { plan, player } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "Test",
    });
    return createInitialWorldRuntimeState({ pack, plan, player });
  }

  it("increments revision and turn", () => {
    const state = makeState();
    const next = applyWorldCandidate({ state, candidate: makeCandidate() });
    expect(next.revision).toBe(state.revision + 1);
    expect(next.turn).toBe(state.turn + 1);
  });

  it("sets checkpoint to turn-committed", () => {
    const state = makeState();
    const next = applyWorldCandidate({ state, candidate: makeCandidate() });
    expect(next.checkpoint).toBe("turn-committed");
  });

  it("adds world flags from candidate", () => {
    const state = makeState();
    const next = applyWorldCandidate({
      state,
      candidate: makeCandidate({
        stateDelta: {
          ...makeCandidate().stateDelta,
          addWorldFlags: ["new-flag"],
        },
      }),
    });
    expect(next.worldFlags).toContain("new-flag");
  });

  it("removes world flags when specified", () => {
    const state = makeState();
    state.worldFlags.push("old-flag");
    const next = applyWorldCandidate({
      state,
      candidate: makeCandidate({
        stateDelta: {
          ...makeCandidate().stateDelta,
          removeWorldFlags: ["old-flag"],
        },
      }),
    });
    expect(next.worldFlags).not.toContain("old-flag");
  });

  it("appends event summary to recentEvents", () => {
    const state = makeState();
    const next = applyWorldCandidate({
      state,
      candidate: makeCandidate({
        stateDelta: {
          ...makeCandidate().stateDelta,
          eventSummary: "Something happened",
        },
      }),
    });
    expect(next.recentEvents).toContain("Something happened");
  });

  it("throws on revision conflict", () => {
    const state = makeState();
    expect(() =>
      applyWorldCandidate({ state, candidate: makeCandidate(), expectedRevision: 999 }),
    ).toThrow("revision conflict");
  });

  it("updates location when nextLocationId is set", () => {
    const state = makeState();
    const next = applyWorldCandidate({
      state,
      candidate: makeCandidate({
        stateDelta: {
          ...makeCandidate().stateDelta,
          nextLocationId: "loc-2",
        },
      }),
    });
    expect(next.currentLocationId).toBe("loc-2");
  });

  it("applies relationship deltas", () => {
    const state = makeState();
    const candidate = makeCandidate({
      stateDelta: {
        ...makeCandidate().stateDelta,
        relationshipDeltas: [
          {
            sourceCharacterId: "char-player",
            targetCharacterId: "char-npc",
            affinityDelta: 1,
            tensionDelta: 1,
          },
        ],
      },
    });
    const next = applyWorldCandidate({ state, candidate });
    const rel = next.relationships.find(
      (r) =>
        r.sourceCharacterId === "char-player" &&
        r.targetCharacterId === "char-npc",
    );
    expect(rel!.affinity).toBe(3);
    expect(rel!.tension).toBe(1);
  });
});

describe("previewWorldCandidateState", () => {
  it("creates a preview without mutating the original state", () => {
    const pack = makeWorldPack();
    const { plan, player } = createExperiencePlan({
      pack,
      playerCharacterId: "char-player",
      primaryGoal: "Test",
    });
    const state = createInitialWorldRuntimeState({ pack, plan, player });
    const candidate = makeCandidate();
    const preview = previewWorldCandidateState(candidate, state);

    expect(preview.candidateId).toBe("b1");
    expect(preview.parentRevision).toBe(0);
    expect(preview.previewRevision).toBe(1);
    expect(state.revision).toBe(0);
  });
});

describe("initializeWorldEventQueue", () => {
  it("returns undefined when no event seeds", () => {
    const pack = makeWorldPack({ eventSeeds: undefined });
    expect(initializeWorldEventQueue(pack)).toBeUndefined();
  });

  it("returns undefined when event seeds array is empty", () => {
    const pack = makeWorldPack({ eventSeeds: [] });
    expect(initializeWorldEventQueue(pack)).toBeUndefined();
  });

  it("activates events with dueTurn <= 0", () => {
    const pack = makeWorldPack({
      eventSeeds: [
        {
          id: "e1",
          turnCreated: 0,
          dueTurn: 0,
          source: "world",
          visibility: "public",
          severity: 0.5,
          status: "scheduled",
          description: "Test event",
          linkedCharacterIds: [],
          linkedFactionIds: [],
        },
      ],
    });
    const queue = initializeWorldEventQueue(pack);
    expect(queue![0].status).toBe("active");
  });
});

describe("prepareWorldRuntimeState / markWorldCandidatesPending", () => {
  it("sets checkpoint to turn-prepared", () => {
    const state: WorldRuntimeState = {
      schemaVersion: "world-runtime-v1",
      worldPackId: "test",
      worldPackVersion: 1,
      revision: 0,
      checkpoint: "turn-committed",
      turn: 0,
      maxTurns: 5,
      playerCharacter: {
        characterId: "p",
        name: "P",
        identity: "I",
        currentGoal: "G",
        capabilities: [],
        limitations: [],
        isCustom: false,
      },
      currentLocationId: "loc-1",
      activeCharacterIds: [],
      characterStates: [],
      relationships: [],
      milestones: [],
      worldFlags: [],
      recentEvents: [],
    };
    expect(prepareWorldRuntimeState(state).checkpoint).toBe("turn-prepared");
    expect(markWorldCandidatesPending(state).checkpoint).toBe("pending-candidates");
  });
});

describe("worldTurnToTurnGenerationResult", () => {
  it("converts WorldTurnResult to TurnGenerationResult", () => {
    const pack = makeWorldPack();
    const worldResult: WorldTurnResult = {
      turnNumber: 1,
      stateRevision: 0,
      visibleScene: "A clearing",
      candidates: [makeCandidate({ id: "b1" }), makeCandidate({ id: "b2", riskLabel: "medium" }), makeCandidate({ id: "b3", riskLabel: "high" })],
    };
    const result = worldTurnToTurnGenerationResult({
      result: worldResult,
      pack,
      language: "en",
    });
    expect(result.branches).toHaveLength(3);
    expect(result.branchWorldDeltas).toHaveLength(3);
    expect(result.branchCommunities).toHaveLength(3);
    expect(result.influenceEvents.length).toBeGreaterThan(0);
  });

  it("normalizes branch scores to sum to 1", () => {
    const pack = makeWorldPack();
    const worldResult: WorldTurnResult = {
      turnNumber: 1,
      stateRevision: 0,
      visibleScene: "Scene",
      candidates: [
        makeCandidate({ id: "b1", riskLabel: "low" }),
        makeCandidate({ id: "b2", riskLabel: "medium" }),
        makeCandidate({ id: "b3", riskLabel: "high" }),
      ],
    };
    const result = worldTurnToTurnGenerationResult({
      result: worldResult,
      pack,
      language: "en",
    });
    const totalScore = result.branches.reduce((sum, b) => sum + b.score, 0);
    expect(Math.abs(totalScore - 1)).toBeLessThan(0.02);
  });
});

describe("revealSelectedWorldBranch", () => {
  it("replaces summary and consequence for the selected branch", () => {
    const turn: TurnGenerationResult = {
      turnNumber: 1,
      branches: [
        { id: "b1", title: "A", summary: "hidden", consequence: "hidden", score: 0.5, timeHorizon: "now", riskProfile: "low", keyUncertainty: "?" },
        { id: "b2", title: "B", summary: "hidden", consequence: "hidden", score: 0.5, timeHorizon: "now", riskProfile: "medium", keyUncertainty: "?" },
      ],
      branchWorldDeltas: [],
      branchCommunities: [],
      influenceEvents: [],
    };
    const candidate = makeCandidate({
      id: "b1",
      hiddenOutcome: "Revealed summary",
      stateDelta: { ...makeCandidate().stateDelta, eventSummary: "Revealed consequence" },
    });
    const result = revealSelectedWorldBranch(turn, candidate);
    expect(result.branches[0].summary).toBe("Revealed summary");
    expect(result.branches[0].consequence).toBe("Revealed consequence");
    expect(result.branches[1].summary).toBe("hidden");
  });
});

describe("revealWorldTurnOutcomes", () => {
  it("reveals all matching candidates", () => {
    const turn: TurnGenerationResult = {
      turnNumber: 1,
      branches: [
        { id: "b1", title: "A", summary: "hidden", consequence: "hidden", score: 0.5, timeHorizon: "now", riskProfile: "low", keyUncertainty: "?" },
        { id: "b2", title: "B", summary: "hidden", consequence: "hidden", score: 0.5, timeHorizon: "now", riskProfile: "medium", keyUncertainty: "?" },
      ],
      branchWorldDeltas: [],
      branchCommunities: [],
      influenceEvents: [],
    };
    const candidates = [
      makeCandidate({ id: "b1", hiddenOutcome: "R1", stateDelta: { ...makeCandidate().stateDelta, eventSummary: "C1" } }),
      makeCandidate({ id: "b2", hiddenOutcome: "R2", stateDelta: { ...makeCandidate().stateDelta, eventSummary: "C2" } }),
    ];
    const result = revealWorldTurnOutcomes(turn, candidates);
    expect(result.branches[0].summary).toBe("R1");
    expect(result.branches[1].summary).toBe("R2");
  });
});
