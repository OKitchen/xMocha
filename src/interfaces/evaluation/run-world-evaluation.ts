import { randomUUID } from "node:crypto";

import { worldRegressionCases } from "../../evaluation/world-regression-cases";
import { interpretWorldAction } from "../../domain/world-action-interpreter";
import { buildWorldChapterGoalSuggestions } from "../../domain/world-goals";
import { createExperiencePlan, createInitialWorldRuntimeState, applyWorldCandidate, prepareWorldRuntimeState, previewWorldCandidateState, worldTurnToTurnGenerationResult } from "../../domain/world-state";
import { redChamberWorldPack } from "../../domain/world-packs";
import {
  getWorldPackQualityWarnings,
  validateWorldPackQuality,
} from "../../domain/world-quality";
import { validateWorldPack, validateWorldTurn } from "../../domain/world-validation";
import type { WorldPack, WorldRuntimeState, WorldTurnResult } from "../../domain/world-types";
import { WorldCompiler } from "../../infrastructure/world/world-compiler";
import { WorldTurnSimulator } from "../../infrastructure/world/world-turn-simulator";

type Result = { id: string; passed: boolean; details: string };

async function main(): Promise<void> {
  const { plan, player } = createExperiencePlan({
    pack: redChamberWorldPack,
    playerCharacterId: "wang-xifeng",
    primaryGoal: "稳住宁国府内务并巩固管理权",
  });
  const initial = createInitialWorldRuntimeState({ pack: redChamberWorldPack, plan, player });
  const baseline = await new WorldTurnSimulator().simulate({
    sessionId: `eval-${randomUUID()}`,
    pack: redChamberWorldPack,
    state: initial,
  });
  const results: Result[] = [];

  for (const testCase of worldRegressionCases) {
    try {
      const passed = await evaluateCase(testCase.id, initial, baseline);
      results.push({ id: testCase.id, passed, details: testCase.expectation });
    } catch (error) {
      results.push({
        id: testCase.id,
        passed: false,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fiveTurn = await evaluateFiveTurnChapter(initial);
  results.push(fiveTurn);

  const passed = results.filter((result) => result.passed).length;
  console.log(`xMocha World evaluation: ${passed}/${results.length} passed`);
  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id}: ${result.details}`);
  }
  if (passed !== results.length) process.exitCode = 1;
}

async function evaluateCase(
  id: string,
  initial: WorldRuntimeState,
  baseline: Awaited<ReturnType<WorldTurnSimulator["simulate"]>>,
): Promise<boolean> {
  const pack = structuredClone(redChamberWorldPack);
  const turn = structuredClone(baseline.result);
  switch (id) {
    case "curated-pack-valid":
      return validateWorldPack(pack).length === 0;
    case "opening-location-boundary":
      pack.openingScenario.locationId = "missing";
      return hasPackIssue(pack, "UNKNOWN_OPENING_LOCATION");
    case "character-fact-reference":
      pack.characters[0]!.knownFactIds.push("missing");
      return hasPackIssue(pack, "UNKNOWN_CHARACTER_FACT");
    case "playable-character-required":
      pack.characters.forEach((character) => { character.playable = false; });
      return hasPackIssue(pack, "NO_PLAYABLE_CHARACTER");
    case "connected-location-reference":
      pack.locations[0]!.connectedLocationIds.push("missing");
      return hasPackIssue(pack, "UNKNOWN_CONNECTED_LOCATION");
    case "curated-pack-richness":
      return (
        pack.characters.length >= 10 &&
        (pack.factions?.length ?? 0) >= 6 &&
        pack.relationships.length >= 12 &&
        (pack.eventSeeds?.length ?? 0) >= 10 &&
        pack.canonFacts.length >= 20 &&
        Boolean(pack.pressureDefaults)
      );
    case "faction-character-reference":
      pack.factions![0]!.memberCharacterIds.push("missing");
      return hasPackIssue(pack, "UNKNOWN_FACTION_CHARACTER");
    case "event-character-reference":
      pack.eventSeeds![0]!.linkedCharacterIds.push("missing");
      return hasPackIssue(pack, "UNKNOWN_EVENT_CHARACTER");
    case "event-faction-reference":
      pack.eventSeeds![0]!.linkedFactionIds.push("missing");
      return hasPackIssue(pack, "UNKNOWN_EVENT_FACTION");
    case "compiler-quality-bad-character-name": {
      pack.visibility = "private";
      pack.sourceType = "narrative";
      pack.characters[0] = {
        ...pack.characters[0]!,
        id: "character-1",
        name: "见有人回",
      };
      pack.openingScenario.activeCharacterIds = ["character-1"];
      pack.openingScenario.suggestedGoals = ["稳住见有人回的处境"];
      return validateWorldPackQuality(pack).some((issue) =>
        issue.code === "LOW_CONFIDENCE_CHARACTER_NAME" ||
        issue.code === "LOW_CONFIDENCE_OPENING_CHARACTER",
      );
    }
    case "compiler-quality-trailing-verb-character": {
      pack.visibility = "private";
      pack.sourceType = "narrative";
      pack.characters[0] = {
        ...pack.characters[0]!,
        id: "character-1",
        name: "凤姐回",
      };
      pack.openingScenario.activeCharacterIds = ["character-1"];
      pack.openingScenario.suggestedGoals = ["稳住凤姐回的处境"];
      return validateWorldPackQuality(pack).some((issue) =>
        issue.code === "LOW_CONFIDENCE_CHARACTER_NAME" ||
        issue.code === "LOW_CONFIDENCE_OPENING_CHARACTER",
      );
    }
    case "compiler-quality-generic-relationships": {
      pack.visibility = "private";
      pack.sourceType = "narrative";
      pack.relationships = pack.characters.slice(1, 5).map((character) => ({
        sourceCharacterId: pack.characters[0]!.id,
        targetCharacterId: character.id,
        kind: "资料关联",
        affinity: 0,
        tension: 1,
        publicContext: "两人在资料中被自动归入同一开场冲突。",
      }));
      return (
        !validateWorldPackQuality(pack).some((issue) =>
          issue.code === "GENERIC_RELATIONSHIP_GRAPH",
        ) &&
        getWorldPackQualityWarnings(pack).some((issue) =>
          issue.code === "GENERIC_RELATIONSHIP_GRAPH",
        )
      );
    }
    case "compiler-quality-replacement-character":
      {
        const result = await new WorldCompiler().compile({
          title: "minor encoding fixture",
          language: "zh-CN",
          sourceType: "narrative",
          content: "贾瑞设法�栉�。凤姐说道，此事暂不可声张。",
          rightsConfirmed: true,
        });
        return (
          result.preprocessWarnings.some((issue) =>
            issue.code === "SOURCE_REPLACEMENT_CHARACTERS_REPLACED",
          ) &&
          !JSON.stringify(result.draft).includes("�")
        );
      }
    case "compiler-quality-too-many-replacement-characters":
      try {
        await new WorldCompiler().compile({
          title: "heavy encoding damage fixture",
          language: "zh-CN",
          sourceType: "narrative",
          content: "贾瑞".repeat(30) + "�".repeat(20),
          rightsConfirmed: true,
        });
        return false;
      } catch (error) {
        return error instanceof Error && error.message.includes("损坏比例较高");
      }
    case "fallback-turn-valid":
      return validateWorldTurn({ pack, state: initial, result: turn }).length === 0;
    case "candidate-id-unique":
      turn.candidates[1]!.id = turn.candidates[0]!.id;
      return hasTurnIssue(pack, initial, turn, "DUPLICATE_CANDIDATE_ID");
    case "revision-match":
      turn.stateRevision += 1;
      return hasTurnIssue(pack, initial, turn, "REVISION_MISMATCH");
    case "character-reference":
      turn.candidates[0]!.stateDelta.activeCharacterIds = ["missing"];
      return hasTurnIssue(pack, initial, turn, "UNKNOWN_TURN_CHARACTER");
    case "grounding-reference":
      turn.candidates[0]!.groundingFactIds = ["missing"];
      return hasTurnIssue(pack, initial, turn, "UNKNOWN_GROUNDING_FACT");
    case "capability-boundary":
      turn.candidates[0]!.requiredCapabilities = ["飞行"];
      return hasTurnIssue(pack, initial, turn, "UNDEFINED_PLAYER_CAPABILITY");
    case "npc-knowledge-boundary": {
      const reaction = turn.candidates[0]!.npcReactions[0]!;
      reaction.usedFactIds = ["fact-limited-mandate"];
      turn.candidates[0]!.groundingFactIds.push("fact-limited-mandate");
      return hasTurnIssue(pack, initial, turn, "NPC_KNOWLEDGE_BOUNDARY");
    }
    case "location-connectivity":
      turn.candidates[0]!.stateDelta.nextLocationId = "ningguo-halls";
      initial = { ...initial, currentLocationId: "rongguo-xifeng-room" };
      return hasTurnIssue(pack, initial, turn, "UNREACHABLE_TURN_LOCATION");
    case "risk-diversity":
      turn.candidates[1]!.riskLabel = turn.candidates[0]!.riskLabel;
      return hasTurnIssue(pack, initial, turn, "RISK_PROFILES_NOT_DISTINCT");
    case "model-timeout-fallback": {
      const stalledClient = { generateJson: async () => new Promise<string>(() => undefined) };
      const simulation = await new WorldTurnSimulator(stalledClient, "stalled-test", 5).simulate({
        sessionId: "timeout-eval",
        pack,
        state: initial,
      });
      return simulation.usedFallback && simulation.runs.some((run) => run.status === "timeout");
    }
    case "selected-delta-only": {
      const selected = turn.candidates[0]!;
      const next = applyWorldCandidate({ state: initial, candidate: selected, expectedRevision: 0 });
      return next.revision === 1 && next.recentEvents.at(-1) === selected.stateDelta.eventSummary;
    }
    case "candidate-preview-dry-run": {
      const selected = turn.candidates[0]!;
      const before = JSON.stringify(initial);
      const preview = previewWorldCandidateState(selected, initial);
      return (
        preview.parentRevision === initial.revision &&
        preview.previewRevision === initial.revision + 1 &&
        JSON.stringify(initial) === before
      );
    }
    case "pressure-preview-private": {
      const selected = turn.candidates[2]!;
      const preview = previewWorldCandidateState(selected, initial);
      return (
        Boolean(initial.worldPressure) &&
        Boolean(preview.pressureSnapshot) &&
        JSON.stringify(preview.pressureSnapshot) !== JSON.stringify(initial.worldPressure)
      );
    }
    case "npc-attitude-derived-from-reaction": {
      const selected = structuredClone(turn.candidates[2]!);
      selected.stateDelta.characterDeltas = selected.stateDelta.characterDeltas.map((delta) => ({
        ...delta,
        attitudeDelta: 0,
      }));
      const next = applyWorldCandidate({ state: initial, candidate: selected, expectedRevision: 0 });
      return next.characterStates.some((character) =>
        initial.activeCharacterIds.includes(character.characterId) &&
        character.attitude < 0,
      );
    }
    case "relationship-derived-from-reaction": {
      const selected = structuredClone(turn.candidates[2]!);
      selected.stateDelta.relationshipDeltas = [];
      selected.npcReactions = selected.npcReactions.map((reaction) => ({
        ...reaction,
        stance: "resistant",
      }));
      const next = applyWorldCandidate({ state: initial, candidate: selected, expectedRevision: 0 });
      return next.relationships.some((relationship) => {
        const before = initial.relationships.find((item) =>
          item.sourceCharacterId === relationship.sourceCharacterId &&
          item.targetCharacterId === relationship.targetCharacterId,
        );
        return before && (
          relationship.tension > before.tension ||
          relationship.affinity < before.affinity
        );
      });
    }
    case "event-queue-initialized":
      return (
        (initial.eventQueue?.length ?? 0) >= 10 &&
        initial.eventQueue!.some((event) => event.status === "scheduled" && event.dueTurn === 1)
      );
    case "scheduled-event-activates": {
      const selected = turn.candidates[0]!;
      const next = applyWorldCandidate({ state: initial, candidate: selected, expectedRevision: 0 });
      return Boolean(next.eventQueue?.some((event) => event.dueTurn === 1 && event.status === "active"));
    }
    case "active-event-resolves": {
      const stateWithActiveEvent: WorldRuntimeState = {
        ...initial,
        eventQueue: [
          {
            id: "eval-pinger-event",
            turnCreated: 0,
            dueTurn: 1,
            source: "world",
            visibility: "public",
            severity: 2,
            status: "active",
            description: "平儿被卷入内务调停。",
            linkedCharacterIds: ["pinger"],
            linkedFactionIds: [],
          },
        ],
      };
      const next = applyWorldCandidate({
        state: stateWithActiveEvent,
        candidate: turn.candidates[0]!,
        expectedRevision: 0,
      });
      return next.eventQueue?.find((event) => event.id === "eval-pinger-event")?.status === "resolved";
    }
    case "candidate-followup-event-created": {
      const next = applyWorldCandidate({
        state: initial,
        candidate: turn.candidates[0]!,
        expectedRevision: 0,
      });
      return Boolean(next.eventQueue?.some((event) =>
        event.id === "event-followup-turn-1-b1" &&
        event.source === "player" &&
        event.status === "scheduled" &&
        event.dueTurn === 2,
      ));
    }
    case "event-preview-private": {
      const before = JSON.stringify(initial.eventQueue);
      const preview = previewWorldCandidateState(turn.candidates[0]!, initial);
      return (
        JSON.stringify(initial.eventQueue) === before &&
        Boolean(preview.eventQueueSnapshot?.some((event) => event.status === "active"))
      );
    }
    case "followup-event-preview-private": {
      const before = JSON.stringify(initial.eventQueue);
      const preview = previewWorldCandidateState(turn.candidates[1]!, initial);
      return (
        JSON.stringify(initial.eventQueue) === before &&
        Boolean(preview.eventQueueSnapshot?.some((event) =>
          event.id === "event-followup-turn-1-b2" &&
          event.status === "scheduled" &&
          event.visibility === "rumor",
        ))
      );
    }
    case "turn-run-records-provider-model-prompt":
      return baseline.runs.every((run) =>
        Boolean(run.provider) &&
        Boolean(run.model) &&
        (run.promptStyle === "full" || run.promptStyle === "lite"),
      );
    case "duplicate-commit-rejected": {
      const next = applyWorldCandidate({ state: initial, candidate: turn.candidates[0]!, expectedRevision: 0 });
      try {
        applyWorldCandidate({ state: next, candidate: turn.candidates[0]!, expectedRevision: 0 });
        return false;
      } catch {
        return true;
      }
    }
    case "custom-action-modern-rejected": {
      const interpreted = interpretWorldAction({
        rawInput: "我用手机拍下管事偷懒并报警",
        runtime: initial,
        pack,
      });
      return !interpreted.feasible && interpreted.violatesLimitations.length > 0;
    }
    case "custom-action-investigate-feasible": {
      const interpreted = interpretWorldAction({
        rawInput: "让平儿私下核对名册并询问门房差役",
        runtime: initial,
        pack,
      });
      return interpreted.intent === "investigate" && interpreted.feasible;
    }
    case "role-goal-suggestions-recomputed": {
      const suggestions = buildWorldChapterGoalSuggestions({
        world: {
          openingScenario: {
            suggestedGoals: ["以凤姐的身份接近贾瑞并试探真实态度"],
          },
          characters: [
            { id: "fengjie", name: "凤姐", goals: ["稳住局面"] },
            { id: "dairu", name: "代儒", goals: ["约束贾瑞行为"] },
          ],
        },
        characterId: "dairu",
      });
      return (
        suggestions.length === 3 &&
        suggestions.every((suggestion) => suggestion.includes("代儒")) &&
        !suggestions.some((suggestion) => suggestion.includes("凤姐"))
      );
    }
    case "milestone-achievement-requires-evidence": {
      const selected = structuredClone(turn.candidates[0]!);
      selected.actionTitle = "暂时旁观";
      selected.visibleCue = "众人暂时停在原处，局势没有明显改变。";
      selected.hiddenOutcome = "各方继续观望。";
      selected.riskLabel = "low";
      selected.participatingCharacterIds = [];
      selected.npcReactions = [];
      selected.stateDelta = {
        nextLocationId: initial.currentLocationId,
        activeCharacterIds: [...initial.activeCharacterIds],
        relationshipDeltas: [],
        characterDeltas: [],
        addWorldFlags: [],
        removeWorldFlags: [],
        eventSummary: "众人暂时观望。",
      };
      selected.milestoneSignals = [
        {
          milestoneId: initial.milestones.find((milestone) => milestone.status === "active")!.id,
          signal: "模型尝试标记完成，但没有状态证据。",
          proposedStatus: "achieved",
        },
      ];
      const next = applyWorldCandidate({ state: initial, candidate: selected, expectedRevision: 0 });
      return next.milestones.find((milestone) => milestone.id === "milestone-understand")?.status === "active";
    }
    case "milestone-failure-recorded": {
      const selected = structuredClone(turn.candidates[0]!);
      selected.milestoneSignals = [
        {
          milestoneId: initial.milestones.find((milestone) => milestone.status === "active")!.id,
          signal: "在不了解局势时作出不可逆承诺。",
          proposedStatus: "failed",
        },
      ];
      const next = applyWorldCandidate({ state: initial, candidate: selected, expectedRevision: 0 });
      return (
        next.milestones.find((milestone) => milestone.id === "milestone-understand")?.status === "failed" &&
        next.milestones.find((milestone) => milestone.id === "milestone-align")?.status === "active"
      );
    }
    case "dynamic-world-branch-score": {
      turn.candidates[2]!.milestoneSignals = [
        {
          milestoneId: initial.milestones.find((milestone) => milestone.status === "active")!.id,
          signal: "直接推进当前目标",
          proposedStatus: "achieved",
        },
      ];
      turn.candidates[2]!.stateDelta.relationshipDeltas = [
        {
          sourceCharacterId: initial.playerCharacter.characterId,
          targetCharacterId: turn.candidates[2]!.participatingCharacterIds[0]!,
          affinityDelta: 2,
          tensionDelta: -1,
        },
      ];
      const mapped = worldTurnToTurnGenerationResult({
        result: turn,
        pack,
        language: "zh-CN",
        state: initial,
      });
      const scores = mapped.branches.map((branch) => branch.score);
      return (
        Math.abs(scores.reduce((sum, score) => sum + score, 0) - 1) <= 0.05 &&
        scores[2]! > 0.22 &&
        !(
          scores[0] === 0.44 &&
          scores[1] === 0.34 &&
          scores[2] === 0.22
        )
      );
    }
    case "dynamic-world-uncertainty": {
      const mapped = worldTurnToTurnGenerationResult({
        result: turn,
        pack,
        language: "zh-CN",
        state: {
          ...initial,
          eventQueue: [
            {
              id: "eval-active-court-event",
              turnCreated: 0,
              dueTurn: 1,
              source: "world",
              visibility: "public",
              severity: 0.9,
              status: "active",
              description: "管事权被当众质疑",
              linkedCharacterIds: [turn.candidates[0]!.participatingCharacterIds[0]!],
              linkedFactionIds: [],
            },
          ],
        },
      });
      return mapped.branches.some((branch) => branch.keyUncertainty.includes("管事权被当众质疑"));
    }
    case "narrative-compiler-private":
      return evaluateCompiler("narrative", "黛玉说道这是只应你我知道的测试密语。宝玉听后走进院中。", "只应你我知道的测试密语");
    case "lore-compiler-private":
      return evaluateCompiler("lore", "其山多异兽。又东三百里有一国，生灵栖息于海边，禁忌越过北岭。", "禁忌越过北岭");
    case "court-intrigue-template-compiler":
      return evaluateCourtIntrigueCompiler();
    case "mythic-exploration-template-compiler":
      return evaluateMythicExplorationCompiler();
    case "anime-faction-template-compiler":
      return evaluateAnimeFactionCompiler();
    case "mythic-fallback-character-extraction":
      return evaluateMythicFallbackCharacterExtraction();
    case "english-mythic-fallback-character-relationships":
      return evaluateEnglishMythicFallbackCharacterRelationships();
    default:
      return false;
  }
}

function hasPackIssue(pack: WorldPack, code: string): boolean {
  return validateWorldPack(pack).some((issue) => issue.code === code);
}

function hasTurnIssue(
  pack: WorldPack,
  state: WorldRuntimeState,
  turn: WorldTurnResult,
  code: string,
): boolean {
  return validateWorldTurn({ pack, state, result: turn }).some((issue) => issue.code === code);
}

async function evaluateCompiler(
  sourceType: "narrative" | "lore",
  content: string,
  secret: string,
): Promise<boolean> {
  const result = await new WorldCompiler().compile({
    title: `${sourceType} fixture`,
    language: "zh-CN",
    sourceType,
    content,
    rightsConfirmed: true,
  });
  const pack: WorldPack = {
    ...result.draft,
    worldPackId: "fixture",
    version: 1,
  };
  return (
    result.draft.visibility === "private" &&
    validateWorldPack(pack).length === 0 &&
    !JSON.stringify(result).includes(secret)
  );
}

async function evaluateCourtIntrigueCompiler(): Promise<boolean> {
  const result = await new WorldCompiler().compile({
    title: "红楼梦府内权力 fixture",
    language: "zh-CN",
    sourceType: "narrative",
    content: "凤姐说道府里管事须顾全体面。平儿听了去问丫鬟，贾琏又怕流言传到太太跟前。",
    rightsConfirmed: true,
  });
  const pack: WorldPack = {
    ...result.draft,
    worldPackId: "court-fixture",
    version: 1,
  };
  const hasCourtRules = pack.rules.some((rule) => rule.id === "rule-court-rank");
  const hasPressure = Boolean(pack.pressureDefaults);
  const hasEvents = (pack.eventSeeds?.length ?? 0) >= 3;
  const hasReviewWarning = result.preprocessWarnings.some((issue) =>
    issue.code === "FALLBACK_DRAFT_NEEDS_REVIEW" ||
    issue.code === "COMPILER_DETERMINISTIC_FALLBACK",
  );
  return (
    validateWorldPack(pack).length === 0 &&
    hasCourtRules &&
    hasPressure &&
    hasEvents &&
    hasReviewWarning
  );
}

async function evaluateMythicExplorationCompiler(): Promise<boolean> {
  const result = await new WorldCompiler().compile({
    title: "山海经异兽探索 fixture",
    language: "zh-CN",
    sourceType: "lore",
    content: "又东三百里曰青丘之山，其阳多玉，其阴多青雘。有兽焉，其状如狐而九尾。越过北岭为禁忌，祭者须避其声。",
    rightsConfirmed: true,
  });
  const pack: WorldPack = {
    ...result.draft,
    worldPackId: "mythic-fixture",
    version: 1,
  };
  const hasMythicRules = pack.rules.some((rule) => rule.id === "rule-mythic-boundary");
  const hasMythicEvents = Boolean(
    pack.eventSeeds?.some((event) => event.id === "event-mythic-taboo"),
  );
  const hasExplorationGoal = pack.openingScenario.suggestedGoals.some((goal) =>
    /探索|禁忌|异兽|线索/.test(goal),
  );
  return (
    validateWorldPack(pack).length === 0 &&
    pack.worldTemplate === "mythic_exploration" &&
    hasMythicRules &&
    hasMythicEvents &&
    hasExplorationGoal
  );
}

async function evaluateAnimeFactionCompiler(): Promise<boolean> {
  const result = await new WorldCompiler().compile({
    title: "忍者阵营任务 fixture",
    language: "zh-CN",
    sourceType: "narrative",
    content: "鸣人说道小队任务不能失败。佐助是宿敌也是队友，木叶阵营要求他们查明敌方动向。查克拉能力有消耗，贸然使用技能会暴露弱点。",
    rightsConfirmed: true,
  });
  const pack: WorldPack = {
    ...result.draft,
    worldPackId: "anime-fixture",
    version: 1,
  };
  const hasAbilityBoundary = pack.rules.some((rule) => rule.id === "rule-anime-ability-boundary");
  const hasFactionEvents = Boolean(
    pack.eventSeeds?.some((event) => event.id === "event-anime-rival-move"),
  );
  const hasFactionGoal = pack.openingScenario.suggestedGoals.some((goal) =>
    /阵营|任务|宿敌|能力/.test(goal),
  );
  return (
    validateWorldPack(pack).length === 0 &&
    pack.worldTemplate === "anime_faction" &&
    hasAbilityBoundary &&
    hasFactionEvents &&
    hasFactionGoal
  );
}

async function evaluateMythicFallbackCharacterExtraction(): Promise<boolean> {
  const result = await new WorldCompiler().compile({
    title: "青镜泽异兽记",
    language: "zh-CN",
    sourceType: "auto",
    content: "玄禾是年轻的采药人，熟悉山路。青砚是守泽人的后代，知道青镜泽的禁忌。犀婆是村里的祭者。否则会听见亲人的声音。三人必须决定从哪里进入青镜泽。",
    rightsConfirmed: true,
  });
  const pack: WorldPack = {
    ...result.draft,
    worldPackId: "mythic-fallback-fixture",
    version: 1,
  };
  const names = pack.characters.map((character) => character.name);
  return (
    pack.worldTemplate === "mythic_exploration" &&
    names.includes("玄禾") &&
    names.includes("青砚") &&
    names.includes("犀婆") &&
    !names.includes("否则会") &&
    !names.includes("三人必须") &&
    validateWorldPackQuality(pack).length === 0
  );
}

async function evaluateEnglishMythicFallbackCharacterRelationships(): Promise<boolean> {
  const result = await new WorldCompiler().compile({
    title: "The Ash-Raven of Thule",
    language: "en",
    sourceType: "lore",
    content: [
      "On the northern island of Thule, three roads meet at the Black Shore.",
      "Astrid is a young rune-reader from Whale-Rib Hall. She can read omens but cannot command spirits.",
      "Leif is a fisher and cliff-runner who knows the hidden paths. He once broke a shrine oath.",
      "Sigrun is the keeper of the yew gate. She knows taboo names and refuses to open the gate without an offering.",
      "Opening scene: Astrid, Leif, and Sigrun stand beside the yew gate as sunset approaches.",
    ].join("\n"),
    rightsConfirmed: true,
  });
  const pack: WorldPack = {
    ...result.draft,
    worldPackId: "english-mythic-fallback-fixture",
    version: 1,
  };
  const names = pack.characters.map((character) => character.name);
  const nonGenericRelationships = pack.relationships.filter((relationship) =>
    !/source-linked|opening conflict|资料关联/i.test(`${relationship.kind} ${relationship.publicContext}`),
  );
  return (
    pack.worldTemplate === "mythic_exploration" &&
    names.includes("Astrid") &&
    names.includes("Leif") &&
    names.includes("Sigrun") &&
    pack.characters.length >= 3 &&
    nonGenericRelationships.length >= 2 &&
    pack.openingScenario.activeCharacterIds.length >= 3 &&
    validateWorldPack(pack).length === 0 &&
    validateWorldPackQuality(pack).length === 0
  );
}

async function evaluateFiveTurnChapter(initial: WorldRuntimeState): Promise<Result> {
  let state = initial;
  const simulator = new WorldTurnSimulator();
  for (let turnNumber = 1; turnNumber <= 5; turnNumber += 1) {
    const simulation = await simulator.simulate({
      sessionId: "five-turn-eval",
      pack: redChamberWorldPack,
      state,
    });
    const issues = validateWorldTurn({ pack: redChamberWorldPack, state, result: simulation.result });
    if (issues.length > 0) {
      return { id: "five-turn-chapter", passed: false, details: issues.map((issue) => issue.code).join(", ") };
    }
    const selected = simulation.result.candidates[turnNumber % 3]!;
    state = applyWorldCandidate({ state, candidate: selected, expectedRevision: state.revision });
    if (turnNumber < 5) state = prepareWorldRuntimeState(state);
  }
  const selectedFollowUps = state.eventQueue?.filter((event) =>
    event.id.startsWith("event-followup-turn-"),
  ).length ?? 0;
  const changedEvents = state.eventQueue?.filter((event) =>
    event.status === "active" || event.status === "resolved" || event.status === "expired",
  ).length ?? 0;
  const passed = (
    state.turn === 5 &&
    state.revision === 5 &&
    state.recentEvents.length <= 5 &&
    state.activeCharacterIds.length <= 3 &&
    selectedFollowUps >= 3 &&
    changedEvents >= 4
  );
  return { id: "five-turn-chapter", passed, details: `turn=${state.turn}, revision=${state.revision}, checkpoint=${state.checkpoint}` };
}

await main();
