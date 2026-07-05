import { describe, expect, it } from "vitest";

import {
  applyWorldCandidate,
  createExperiencePlan,
  createInitialWorldRuntimeState,
  prepareWorldRuntimeState,
} from "../../domain/world-state";
import { odysseyWorldPack } from "../../domain/world-packs";
import { WorldTurnSimulator } from "./world-turn-simulator";

function createOdysseyState() {
  const { plan, player } = createExperiencePlan({
    pack: odysseyWorldPack,
    playerCharacterId: "odysseus",
    primaryGoal: "As Odysseus, save surviving crew members",
  });

  return createInitialWorldRuntimeState({
    pack: odysseyWorldPack,
    plan,
    player,
  });
}

describe("WorldTurnSimulator fallback", () => {
  it("repairs or rejects Chinese model text in an English session before fallback", async () => {
    const badClient = {
      generateJson: async () => JSON.stringify({
        turnNumber: 1,
        stateRevision: 0,
        visibleScene: "逐项核对名册，先不要公开追责",
        candidates: [
          {
            id: "b1",
            riskLabel: "low",
            actionTitle: "逐项核对名册",
            visibleCue: "先稳住局面",
            hiddenOutcome: "责任缺口浮出",
            eventSummary: "核对名册识别出责任缺口",
          },
          {
            id: "b2",
            riskLabel: "medium",
            actionTitle: "分头询问管事",
            visibleCue: "比较说法",
            hiddenOutcome: "矛盾暴露",
            eventSummary: "私下说法改变关系",
          },
          {
            id: "b3",
            riskLabel: "high",
            actionTitle: "当众抽查差役",
            visibleCue: "公开验证",
            hiddenOutcome: "对方戒备",
            eventSummary: "公开抽查提高压力",
          },
        ],
      }),
    };
    const simulator = new WorldTurnSimulator(badClient, "Hugging Face Router", 500);
    const simulation = await simulator.simulate({
      sessionId: "test-session",
      pack: odysseyWorldPack,
      state: createOdysseyState(),
      language: "en",
    });

    expect(simulation.usedFallback).toBe(true);
    expect(simulation.runs.some((run) =>
      run.validationIssueCodes.includes("OUTPUT_LANGUAGE_MISMATCH"),
    )).toBe(true);
  });

  it("advances Odyssey fallback choices after the opening turn", async () => {
    const simulator = new WorldTurnSimulator(undefined, "deterministic-fallback");
    const first = await simulator.simulate({
      sessionId: "test-session",
      pack: odysseyWorldPack,
      state: createOdysseyState(),
      language: "en",
    });

    expect(first.result.candidates.map((candidate) => candidate.actionTitle)).toEqual([
      "Count the cave's constraints",
      "Press guest-right carefully",
      "Seize supplies before he returns",
    ]);

    const selectedMediumChoice = first.result.candidates.find((candidate) => candidate.id === "b2");
    expect(selectedMediumChoice).toBeDefined();
    const nextState = prepareWorldRuntimeState(
      applyWorldCandidate({
        state: createOdysseyState(),
        candidate: selectedMediumChoice!,
      }),
    );

    const second = await simulator.simulate({
      sessionId: "test-session",
      pack: odysseyWorldPack,
      state: nextState,
      language: "en",
    });

    expect(second.result.candidates.map((candidate) => candidate.actionTitle)).toEqual([
      "Bind the crew to silence",
      "Offer wine and Noman",
      "Drive the olive stake now",
    ]);
  });

  it("uses the lite prompt style for local Gemma/Ollama world generation", async () => {
    const simulator = new WorldTurnSimulator(undefined, "Gemma 4 (gemma4, ollama)");
    const simulation = await simulator.simulate({
      sessionId: "test-session",
      pack: odysseyWorldPack,
      state: createOdysseyState(),
      language: "en",
    });

    expect(simulation.runs[0]?.promptStyle).toBe("lite");
  });
});
