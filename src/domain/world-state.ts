import { randomUUID } from "node:crypto";

import type {
  Branch,
  BranchCommunity,
  BranchWorldDelta,
  InfluenceEvent,
  OutputLanguage,
  TurnGenerationResult,
} from "./types";
import type {
  CharacterCard,
  CustomWorldCharacterInput,
  ExperiencePlan,
  Milestone,
  PlayerCharacterState,
  WorldCandidate,
  WorldEvent,
  WorldPack,
  WorldPressureState,
  WorldRuntimeState,
  WorldTurnResult,
  CandidateStatePreview,
} from "./world-types";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function playerFromExisting(character: CharacterCard, goal: string): PlayerCharacterState {
  return {
    characterId: character.id,
    name: character.name,
    identity: character.identity,
    currentGoal: goal,
    capabilities: [...character.capabilities],
    limitations: [...character.limitations],
    isCustom: false,
  };
}

function playerFromCustom(input: CustomWorldCharacterInput): PlayerCharacterState {
  return {
    characterId: `custom-${randomUUID()}`,
    name: input.name.trim(),
    identity: input.identity.trim(),
    currentGoal: input.goal.trim(),
    capabilities: [input.strength.trim()].filter(Boolean),
    limitations: [input.weakness.trim()].filter(Boolean),
    isCustom: true,
  };
}

export function createExperiencePlan(params: {
  pack: WorldPack;
  playerCharacterId?: string;
  customCharacter?: CustomWorldCharacterInput;
  primaryGoal: string;
}): { plan: ExperiencePlan; player: PlayerCharacterState } {
  const goal = params.primaryGoal.trim();
  if (!goal) throw new Error("A primary world goal is required.");

  let player: PlayerCharacterState;
  if (params.customCharacter) {
    const fields = [
      params.customCharacter.name,
      params.customCharacter.identity,
      params.customCharacter.goal,
      params.customCharacter.strength,
      params.customCharacter.weakness,
    ];
    if (fields.some((value) => !value.trim())) {
      throw new Error("Custom character name, identity, goal, strength, and weakness are required.");
    }
    player = playerFromCustom(params.customCharacter);
  } else {
    const character = params.pack.characters.find(
      (candidate) => candidate.id === params.playerCharacterId && candidate.playable,
    );
    if (!character) throw new Error("A playable character is required.");
    player = playerFromExisting(character, goal);
  }

  const useChinese = params.pack.language !== "en";
  const milestones: Milestone[] = useChinese
    ? [
        {
          id: "milestone-understand",
          order: 1,
          description: `弄清阻碍“${goal}”的关键人物、规则与现实压力。`,
          status: "active",
          progressSignals: [],
          successConditions: ["至少识别一个关键阻力或隐藏关系。"],
          failureConditions: ["在不了解局势的情况下作出不可逆承诺。"],
        },
        {
          id: "milestone-align",
          order: 2,
          description: "争取至少一个关键角色的实际配合，或明确主要对手。",
          status: "locked",
          progressSignals: [],
          successConditions: ["一个关键关系发生可观察的支持性变化。"],
          failureConditions: ["所有关键关系同时转为强烈抵抗。"],
        },
        {
          id: "milestone-resolve",
          order: 3,
          description: `作出能够推进“${goal}”并承担明确代价的决定。`,
          status: "locked",
          progressSignals: [],
          successConditions: ["目标产生可观察结果，且代价被世界状态记录。"],
          failureConditions: ["章节结束时目标没有产生任何现实变化。"],
        },
      ]
    : [
        {
          id: "milestone-understand",
          order: 1,
          description: `Understand the people, rules, and pressure blocking “${goal}”.`,
          status: "active",
          progressSignals: [],
          successConditions: ["Identify at least one key obstacle or hidden relationship."],
          failureConditions: ["Make an irreversible commitment without understanding the situation."],
        },
        {
          id: "milestone-align",
          order: 2,
          description: "Gain practical support from one key character or identify the main opponent.",
          status: "locked",
          progressSignals: [],
          successConditions: ["A key relationship shifts toward observable support."],
          failureConditions: ["Every key relationship becomes strongly resistant."],
        },
        {
          id: "milestone-resolve",
          order: 3,
          description: `Make a consequential move that advances “${goal}” and carries a visible cost.`,
          status: "locked",
          progressSignals: [],
          successConditions: ["The goal changes the world state and the cost is recorded."],
          failureConditions: ["The chapter ends without any observable change."],
        },
      ];

  return {
    player,
    plan: {
      primaryGoal: goal,
      playerCharacterId: player.characterId,
      milestones,
      successDefinition: useChinese
        ? `章节结束时，“${goal}”已产生可观察的世界或关系变化。`
        : `By chapter end, “${goal}” has created an observable world or relationship change.`,
      failureDefinition: useChinese
        ? "五轮结束后目标没有现实变化，或关键关系代价使目标失去意义。"
        : "After five turns, the goal has not changed reality or its relationship cost has made it meaningless.",
    },
  };
}

export function createInitialWorldRuntimeState(params: {
  pack: WorldPack;
  plan: ExperiencePlan;
  player: PlayerCharacterState;
}): WorldRuntimeState {
  const activeCharacterIds = params.pack.openingScenario.activeCharacterIds
    .filter((id) => id !== params.player.characterId)
    .slice(0, 3);

  return {
    schemaVersion: "world-runtime-v1",
    worldPackId: params.pack.worldPackId,
    worldPackVersion: params.pack.version,
    revision: 0,
    checkpoint: "turn-prepared",
    turn: 0,
    maxTurns: 5,
    playerCharacter: params.player,
    currentLocationId: params.pack.openingScenario.locationId,
    activeCharacterIds,
    characterStates: params.pack.characters.map((character) => ({
      characterId: character.id,
      attitude: 0,
      currentGoal: character.goals[0] ?? "Observe the changing situation.",
      knownFlags: [],
      condition: "active",
    })),
    relationships: params.pack.relationships.map((relationship) => ({ ...relationship })),
    milestones: params.plan.milestones.map((milestone) => ({ ...milestone })),
    worldFlags: [params.pack.openingScenario.id],
    recentEvents: [params.pack.openingScenario.event],
    worldPressure: params.pack.pressureDefaults
      ? { ...params.pack.pressureDefaults }
      : undefined,
    eventQueue: initializeWorldEventQueue(params.pack),
  };
}

function transitionMilestones(
  milestones: Milestone[],
  candidate: WorldCandidate,
  params: {
    currentTurn: number;
    eventQueueBefore: WorldEvent[];
    eventQueueAfter: WorldEvent[] | undefined;
    pressureBefore: WorldPressureState | undefined;
    pressureAfter: WorldPressureState | undefined;
  },
): Milestone[] {
  const signals = new Map(candidate.milestoneSignals.map((signal) => [signal.milestoneId, signal]));
  const next = milestones.map((milestone) => {
    const signal = signals.get(milestone.id);
    if (!signal) return { ...milestone, progressSignals: [...milestone.progressSignals] };

    const allowedStatus = evaluateMilestoneTransition({
      milestone,
      candidate,
      proposedStatus: signal.proposedStatus,
      currentTurn: params.currentTurn,
      eventQueueBefore: params.eventQueueBefore,
      eventQueueAfter: params.eventQueueAfter,
      pressureBefore: params.pressureBefore,
      pressureAfter: params.pressureAfter,
    });
    return {
      ...milestone,
      status: allowedStatus,
      progressSignals: [...milestone.progressSignals, signal.signal].slice(-3),
    };
  });

  const activeIndex = next.findIndex((milestone) => milestone.status === "active");
  if (activeIndex >= 0) return next;

  const nextLocked = next.find((milestone) => milestone.status === "locked");
  if (nextLocked) nextLocked.status = "active";
  return next;
}

function evaluateMilestoneTransition(params: {
  milestone: Milestone;
  candidate: WorldCandidate;
  proposedStatus: Milestone["status"];
  currentTurn: number;
  eventQueueBefore: WorldEvent[];
  eventQueueAfter: WorldEvent[] | undefined;
  pressureBefore: WorldPressureState | undefined;
  pressureAfter: WorldPressureState | undefined;
}): Milestone["status"] {
  if (params.milestone.status !== "active") return params.milestone.status;
  if (params.proposedStatus === "failed") return "failed";
  if (params.proposedStatus !== "achieved") return params.milestone.status;
  if (!hasMilestoneCompletionEvidence(params)) return params.milestone.status;
  return "achieved";
}

function hasMilestoneCompletionEvidence(params: {
  milestone: Milestone;
  candidate: WorldCandidate;
  currentTurn: number;
  eventQueueBefore: WorldEvent[];
  eventQueueAfter: WorldEvent[] | undefined;
  pressureBefore: WorldPressureState | undefined;
  pressureAfter: WorldPressureState | undefined;
}): boolean {
  const nextTurn = params.currentTurn + 1;
  const text = [
    params.candidate.actionTitle,
    params.candidate.visibleCue,
    params.candidate.hiddenOutcome,
    params.candidate.stateDelta.eventSummary,
    ...params.candidate.stateDelta.addWorldFlags,
  ].join(" ");
  const hasRelationshipMovement = params.candidate.stateDelta.relationshipDeltas.some(
    (delta) => delta.affinityDelta !== 0 || delta.tensionDelta !== 0,
  );
  const hasCharacterMovement = params.candidate.stateDelta.characterDeltas.some(
    (delta) => delta.attitudeDelta !== 0 || delta.addKnownFlags.length > 0 || Boolean(delta.currentGoal),
  );
  const hasNpcPosition = params.candidate.npcReactions.some(
    (reaction) => reaction.stance === "supportive" || reaction.stance === "resistant",
  );
  const hasWorldFlag = params.candidate.stateDelta.addWorldFlags.length > 0;
  const hasEventResolution = eventQueueResolvedOrExpired(
    params.eventQueueBefore,
    params.eventQueueAfter,
  );
  const hasPressureMovement = pressureChanged(params.pressureBefore, params.pressureAfter);
  const hasInvestigationSignal = /查|问|探|核|听|看|试探|线索|名册|账|record|investigate|audit|clar/i.test(text);
  const hasCostOrConsequence = (
    params.candidate.riskLabel !== "low" ||
    hasEventResolution ||
    hasPressureMovement ||
    /代价|后果|承担|公开|责罚|怨|冲突|cost|consequence/i.test(text)
  );

  if (params.milestone.order === 1) {
    return hasInvestigationSignal || hasCharacterMovement || hasEventResolution;
  }
  if (params.milestone.order === 2) {
    return nextTurn >= 2 && (hasRelationshipMovement || hasNpcPosition || hasEventResolution);
  }
  return (
    nextTurn >= 4 &&
    hasCostOrConsequence &&
    (hasWorldFlag || hasEventResolution || hasRelationshipMovement || hasPressureMovement)
  );
}

export function applyWorldCandidate(params: {
  state: WorldRuntimeState;
  candidate: WorldCandidate;
  expectedRevision?: number;
}): WorldRuntimeState {
  if (
    params.expectedRevision !== undefined &&
    params.expectedRevision !== params.state.revision
  ) {
    throw new Error(
      `World state revision conflict: expected ${params.expectedRevision}, current ${params.state.revision}.`,
    );
  }

  const state = params.state;
  const relationships = state.relationships.map((relationship) => {
    const delta = params.candidate.stateDelta.relationshipDeltas.find(
      (candidate) =>
        candidate.sourceCharacterId === relationship.sourceCharacterId &&
        candidate.targetCharacterId === relationship.targetCharacterId,
    );
    const useModelDelta = hasMeaningfulRelationshipDelta(delta);
    const inferred = useModelDelta
      ? undefined
      : inferRelationshipDeltaFromNpcReaction({
          candidate: params.candidate,
          relationship,
          playerCharacterId: state.playerCharacter.characterId,
        });
    if (!delta && !inferred) return { ...relationship };
    const affinityDelta = useModelDelta
      ? delta!.affinityDelta
      : inferred?.affinityDelta ?? delta?.affinityDelta ?? 0;
    const tensionDelta = useModelDelta
      ? delta!.tensionDelta
      : inferred?.tensionDelta ?? delta?.tensionDelta ?? 0;
    return {
      ...relationship,
      affinity: clamp(relationship.affinity + affinityDelta, -5, 5),
      tension: clamp(relationship.tension + tensionDelta, 0, 5),
    };
  });

  const characterStates = state.characterStates.map((character) => {
    const delta = params.candidate.stateDelta.characterDeltas.find(
      (candidate) => candidate.characterId === character.characterId,
    );
    const useModelDelta = hasMeaningfulCharacterDelta(delta);
    const inferred = useModelDelta
      ? undefined
      : inferCharacterDeltaFromNpcReaction(params.candidate, character.characterId);
    if (!delta && !inferred) return { ...character, knownFlags: [...character.knownFlags] };
    const attitudeDelta = useModelDelta
      ? delta!.attitudeDelta
      : inferred?.attitudeDelta ?? delta?.attitudeDelta ?? 0;
    return {
      ...character,
      attitude: clamp(character.attitude + attitudeDelta, -5, 5),
      currentGoal: delta?.currentGoal ?? character.currentGoal,
      condition: delta?.condition ?? character.condition,
      lastInteraction: params.candidate.stateDelta.eventSummary,
      knownFlags: [
        ...new Set([
          ...character.knownFlags,
          ...(delta?.addKnownFlags ?? []),
          ...(inferred?.addKnownFlags ?? []),
        ]),
      ].slice(-8),
    };
  });

  const removedFlags = new Set(params.candidate.stateDelta.removeWorldFlags);
  const eventQueueBefore = state.eventQueue ?? [];
  const transitionedEventQueue = transitionWorldEventQueue({
    events: eventQueueBefore,
    candidate: params.candidate,
    playerCharacterId: state.playerCharacter.characterId,
    nextTurn: state.turn + 1,
  });
  const eventQueue = appendCandidateFollowUpEvent({
    events: transitionedEventQueue,
    state,
    candidate: params.candidate,
    nextTurn: state.turn + 1,
  });
  const eventFlags = eventTransitionFlags(eventQueueBefore, eventQueue, state.turn + 1);
  const worldFlags = [
    ...new Set([
      ...state.worldFlags.filter((flag) => !removedFlags.has(flag)),
      ...params.candidate.stateDelta.addWorldFlags,
      ...eventFlags,
    ]),
  ].slice(-18);
  const worldPressure = updateWorldPressure(state.worldPressure, params.candidate);

  return {
    ...state,
    revision: state.revision + 1,
    checkpoint: "turn-committed",
    turn: state.turn + 1,
    currentLocationId:
      params.candidate.stateDelta.nextLocationId ?? state.currentLocationId,
    activeCharacterIds: params.candidate.stateDelta.activeCharacterIds.slice(0, 3),
    characterStates,
    relationships,
    milestones: transitionMilestones(state.milestones, params.candidate, {
      currentTurn: state.turn,
      eventQueueBefore,
      eventQueueAfter: eventQueue,
      pressureBefore: state.worldPressure,
      pressureAfter: worldPressure,
    }),
    worldFlags,
    recentEvents: [
      ...state.recentEvents,
      params.candidate.stateDelta.eventSummary,
    ].slice(-5),
    worldPressure,
    eventQueue,
  };
}

export function previewWorldCandidateState(
  candidate: WorldCandidate,
  state: WorldRuntimeState,
): CandidateStatePreview {
  const preview = applyWorldCandidate({
    state: structuredClone(state),
    candidate: structuredClone(candidate),
    expectedRevision: state.revision,
  });
  return {
    candidateId: candidate.id,
    parentRevision: state.revision,
    previewRevision: preview.revision,
    activeCharacterIds: [...preview.activeCharacterIds],
    relationshipSnapshot: preview.relationships.map((relationship) => ({ ...relationship })),
    milestoneSnapshot: preview.milestones.map((milestone) => ({
      ...milestone,
      progressSignals: [...milestone.progressSignals],
      successConditions: [...milestone.successConditions],
      failureConditions: [...milestone.failureConditions],
    })),
    worldFlags: [...preview.worldFlags],
    recentEvents: [...preview.recentEvents],
    pressureSnapshot: preview.worldPressure ? { ...preview.worldPressure } : undefined,
    eventQueueSnapshot: preview.eventQueue?.map(cloneWorldEvent),
  };
}

export function initializeWorldEventQueue(pack: WorldPack): WorldEvent[] | undefined {
  if (!pack.eventSeeds?.length) return undefined;
  return pack.eventSeeds.map((event) => ({
    ...cloneWorldEvent(event),
    status:
      event.status === "scheduled" && event.dueTurn !== undefined && event.dueTurn <= 0
        ? "active"
        : event.status,
  }));
}

function transitionWorldEventQueue(params: {
  events: WorldEvent[];
  candidate: WorldCandidate;
  playerCharacterId: string;
  nextTurn: number;
}): WorldEvent[] | undefined {
  if (params.events.length === 0) return undefined;
  return params.events.map((event) => {
    const next = cloneWorldEvent(event);
    if (
      next.status === "scheduled" &&
      next.dueTurn !== undefined &&
      next.dueTurn <= params.nextTurn
    ) {
      next.status = "active";
      return next;
    }

    if (next.status !== "active") return next;

    if (candidateTouchesEvent(params.candidate, next, params.playerCharacterId)) {
      next.status = "resolved";
    } else if (next.dueTurn !== undefined && params.nextTurn > next.dueTurn + 1) {
      next.status = "expired";
    }
    return next;
  });
}

function appendCandidateFollowUpEvent(params: {
  events: WorldEvent[] | undefined;
  state: WorldRuntimeState;
  candidate: WorldCandidate;
  nextTurn: number;
}): WorldEvent[] | undefined {
  const existing = params.events ?? [];
  if (params.nextTurn >= params.state.maxTurns) {
    return pruneWorldEvents(existing);
  }

  const event = buildCandidateFollowUpEvent(params);
  if (!event) return pruneWorldEvents(existing);
  return pruneWorldEvents([...existing, event]);
}

function buildCandidateFollowUpEvent(params: {
  state: WorldRuntimeState;
  candidate: WorldCandidate;
  nextTurn: number;
}): WorldEvent | undefined {
  const linkedCharacterIds = [
    params.state.playerCharacter.characterId,
    ...params.candidate.participatingCharacterIds,
    ...params.candidate.npcReactions.map((reaction) => reaction.characterId),
    ...params.candidate.stateDelta.activeCharacterIds,
  ].filter((id, index, all) => id && all.indexOf(id) === index).slice(0, 5);

  if (linkedCharacterIds.length === 0) return undefined;

  return {
    id: `event-followup-turn-${params.nextTurn}-${safeEventId(params.candidate.id)}`,
    turnCreated: params.nextTurn,
    dueTurn: params.nextTurn + 1,
    source: "player",
    visibility: followUpVisibility(params.candidate),
    severity: followUpSeverity(params.candidate),
    status: "scheduled",
    description: followUpDescription(params.candidate),
    linkedCharacterIds,
    linkedFactionIds: [],
  };
}

function followUpVisibility(candidate: WorldCandidate): WorldEvent["visibility"] {
  if (candidate.riskLabel === "high") return "public";
  if (candidate.riskLabel === "medium") return "rumor";
  return "private";
}

function followUpSeverity(candidate: WorldCandidate): number {
  if (candidate.riskLabel === "high") return 0.75;
  if (candidate.riskLabel === "medium") return 0.5;
  return 0.3;
}

function followUpDescription(candidate: WorldCandidate): string {
  const text = candidate.stateDelta.eventSummary || candidate.hiddenOutcome || candidate.actionTitle;
  return /[\u3400-\u9fff]/u.test(text)
    ? `后续影响：${text}`
    : `Follow-up consequence: ${text}`;
}

function safeEventId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";
}

function pruneWorldEvents(events: WorldEvent[]): WorldEvent[] | undefined {
  if (events.length === 0) return undefined;
  const unresolved = events.filter(
    (event) => event.status === "scheduled" || event.status === "active",
  );
  const closed = events
    .filter((event) => event.status === "resolved" || event.status === "expired")
    .slice(-8);
  return [...unresolved, ...closed].slice(-18).map(cloneWorldEvent);
}

function eventTransitionFlags(
  before: WorldEvent[],
  after: WorldEvent[] | undefined,
  turn: number,
): string[] {
  if (!after?.length) return [];
  const beforeById = new Map(before.map((event) => [event.id, event.status]));
  return after
    .filter((event) => beforeById.get(event.id) !== event.status)
    .map((event) => `event-${event.status}-${event.id}-turn-${turn}`)
    .slice(0, 4);
}

function eventQueueResolvedOrExpired(
  before: WorldEvent[],
  after: WorldEvent[] | undefined,
): boolean {
  if (!after?.length) return false;
  const beforeById = new Map(before.map((event) => [event.id, event.status]));
  return after.some((event) => {
    const beforeStatus = beforeById.get(event.id);
    return (
      beforeStatus !== event.status &&
      (event.status === "resolved" || event.status === "expired")
    );
  });
}

function pressureChanged(
  before: WorldPressureState | undefined,
  after: WorldPressureState | undefined,
): boolean {
  if (!before || !after) return false;
  return (
    before.ritualOrder !== after.ritualOrder ||
    before.householdOrder !== after.householdOrder ||
    before.publicFace !== after.publicFace ||
    before.hiddenResentment !== after.hiddenResentment ||
    before.authorityLegitimacy !== after.authorityLegitimacy ||
    before.informationClarity !== after.informationClarity
  );
}

function candidateTouchesEvent(
  candidate: WorldCandidate,
  event: WorldEvent,
  playerCharacterId: string,
): boolean {
  const touchedCharacters = new Set(
    [
      ...candidate.participatingCharacterIds,
      ...candidate.npcReactions.map((reaction) => reaction.characterId),
      ...candidate.stateDelta.activeCharacterIds,
      ...candidate.stateDelta.characterDeltas.map((delta) => delta.characterId),
      ...candidate.stateDelta.relationshipDeltas.flatMap((delta) => [
        delta.sourceCharacterId,
        delta.targetCharacterId,
      ]),
    ].filter((id) => id !== playerCharacterId),
  );
  if (event.linkedCharacterIds.some((id) => touchedCharacters.has(id))) return true;

  const text = [
    candidate.actionTitle,
    candidate.visibleCue,
    candidate.hiddenOutcome,
    candidate.stateDelta.eventSummary,
  ].join(" ");
  return eventKeywords(event.description).some((keyword) => text.includes(keyword));
}

function eventKeywords(description: string): string[] {
  return description
    .split(/[，。、“”「」『』；;,.!?？\s]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(0, 5);
}

function cloneWorldEvent(event: WorldEvent): WorldEvent {
  return {
    ...event,
    linkedCharacterIds: [...event.linkedCharacterIds],
    linkedFactionIds: [...event.linkedFactionIds],
  };
}

function updateWorldPressure(
  pressure: WorldPressureState | undefined,
  candidate: WorldCandidate,
): WorldPressureState | undefined {
  if (!pressure) return undefined;
  const text = [
    candidate.actionTitle,
    candidate.visibleCue,
    candidate.hiddenOutcome,
    candidate.stateDelta.eventSummary,
    ...candidate.stateDelta.addWorldFlags,
  ].join(" ");
  const next = { ...pressure };
  const riskShift = candidate.riskLabel === "high" ? 4 : candidate.riskLabel === "medium" ? 2 : 1;

  if (/核对|整理|查|问|audit|investigate|compare/i.test(text)) {
    next.informationClarity += 6;
    next.householdOrder += 2;
  }
  if (/规矩|赏罚|调度|抽查|公开|command|penalt|reward/i.test(text)) {
    next.householdOrder += 5;
    next.authorityLegitimacy += candidate.riskLabel === "high" ? 2 : 4;
    next.hiddenResentment += riskShift;
  }
  if (/安抚|缓和|体面|人情|私下|comfort|face|buffer|private/i.test(text)) {
    next.publicFace += 4;
    next.hiddenResentment -= 3;
  }
  if (/礼|丧事|宾客|ritual|mourning|guest/i.test(text)) {
    next.ritualOrder += 3;
    next.publicFace += 2;
  }
  if (candidate.riskLabel === "high") {
    next.hiddenResentment += 3;
    next.publicFace -= 2;
  }

  return {
    ritualOrder: clamp(next.ritualOrder, 0, 100),
    householdOrder: clamp(next.householdOrder, 0, 100),
    publicFace: clamp(next.publicFace, 0, 100),
    hiddenResentment: clamp(next.hiddenResentment, 0, 100),
    authorityLegitimacy: clamp(next.authorityLegitimacy, 0, 100),
    informationClarity: clamp(next.informationClarity, 0, 100),
  };
}

function hasMeaningfulRelationshipDelta(
  delta: WorldCandidate["stateDelta"]["relationshipDeltas"][number] | undefined,
): boolean {
  return Boolean(delta && (delta.affinityDelta !== 0 || delta.tensionDelta !== 0));
}

function hasMeaningfulCharacterDelta(
  delta: WorldCandidate["stateDelta"]["characterDeltas"][number] | undefined,
): boolean {
  return Boolean(delta && delta.attitudeDelta !== 0);
}

function inferCharacterDeltaFromNpcReaction(
  candidate: WorldCandidate,
  characterId: string,
): { attitudeDelta: number; addKnownFlags: string[] } | undefined {
  const reaction = candidate.npcReactions.find((item) => item.characterId === characterId);
  if (!reaction) return undefined;

  let attitudeDelta = 0;
  if (reaction.stance === "supportive") attitudeDelta += 1;
  if (reaction.stance === "resistant") attitudeDelta -= 1;
  if (reaction.stance === "uncertain" && candidate.riskLabel === "high") attitudeDelta -= 1;
  if (candidate.riskLabel === "high" && reaction.stance !== "supportive") attitudeDelta -= 1;
  if (candidate.riskLabel === "low" && reaction.stance === "supportive") attitudeDelta += 1;

  return {
    attitudeDelta: clamp(attitudeDelta, -2, 2),
    addKnownFlags: [`reaction-${reaction.stance}-${candidate.riskLabel}`],
  };
}

function inferRelationshipDeltaFromNpcReaction(params: {
  candidate: WorldCandidate;
  relationship: WorldRuntimeState["relationships"][number];
  playerCharacterId: string;
}): { affinityDelta: number; tensionDelta: number } | undefined {
  const otherCharacterId =
    params.relationship.sourceCharacterId === params.playerCharacterId
      ? params.relationship.targetCharacterId
      : params.relationship.targetCharacterId === params.playerCharacterId
        ? params.relationship.sourceCharacterId
        : undefined;
  if (!otherCharacterId) return undefined;

  const reaction = params.candidate.npcReactions.find(
    (item) => item.characterId === otherCharacterId,
  );
  if (!reaction) return undefined;

  let affinityDelta = 0;
  let tensionDelta = 0;
  if (reaction.stance === "supportive") {
    affinityDelta += 1;
    tensionDelta -= 1;
  }
  if (reaction.stance === "resistant") {
    affinityDelta -= 1;
    tensionDelta += 1;
  }
  if (reaction.stance === "uncertain" && params.candidate.riskLabel !== "low") {
    tensionDelta += 1;
  }
  if (params.candidate.riskLabel === "high" && reaction.stance !== "supportive") {
    tensionDelta += 1;
  }

  if (affinityDelta === 0 && tensionDelta === 0) return undefined;
  return {
    affinityDelta: clamp(affinityDelta, -2, 2),
    tensionDelta: clamp(tensionDelta, -2, 2),
  };
}

export function prepareWorldRuntimeState(state: WorldRuntimeState): WorldRuntimeState {
  return { ...state, checkpoint: "turn-prepared" };
}

export function markWorldCandidatesPending(state: WorldRuntimeState): WorldRuntimeState {
  return { ...state, checkpoint: "pending-candidates" };
}

function branchCommunityForCandidate(
  candidate: WorldCandidate,
  pack: WorldPack,
): BranchCommunity {
  return {
    branchId: candidate.id,
    agents: candidate.npcReactions.map((reaction) => ({
      role:
        pack.characters.find((character) => character.id === reaction.characterId)?.name ??
        reaction.characterId,
      stance: reaction.stance,
      motivation: reaction.reaction,
      influence: 0.65,
      reaction: reaction.reaction,
    })),
    socialDynamics: candidate.visibleCue,
    dominantNarrative: candidate.visibleCue,
  };
}

export function worldTurnToTurnGenerationResult(params: {
  result: WorldTurnResult;
  pack: WorldPack;
  language: OutputLanguage;
  state?: WorldRuntimeState;
}): TurnGenerationResult {
  const branchScores = normalizeWorldBranchScores(params.result.candidates, params.state);
  const branches: Branch[] = params.result.candidates.map((candidate, index) => ({
    id: candidate.id,
    title: candidate.actionTitle,
    summary: candidate.visibleCue,
    consequence:
      params.language === "en"
        ? "The outcome will be revealed after observation."
        : "选择后揭示这一行动的真实结果。",
    score: branchScores[index] ?? Number((1 / params.result.candidates.length).toFixed(2)),
    timeHorizon: params.language === "en" ? "next scene" : "下一场景",
    riskProfile: candidate.riskLabel,
    keyUncertainty: formatWorldKeyUncertainty(candidate, params.pack, params.language, params.state),
  }));
  const branchWorldDeltas: BranchWorldDelta[] = params.result.candidates.map(
    (candidate) => ({
      branchId: candidate.id,
      activatedConstraints: candidate.stateDelta.removeWorldFlags,
      activatedOpportunities: candidate.stateDelta.addWorldFlags,
      pressureShift: candidate.stateDelta.eventSummary,
    }),
  );
  const branchCommunities = params.result.candidates.map((candidate) =>
    branchCommunityForCandidate(candidate, params.pack),
  );
  const influenceEvents: InfluenceEvent[] = params.result.candidates.flatMap(
    (candidate) => [
      {
        id: `world-${params.result.turnNumber}-${candidate.id}-out`,
        turn: params.result.turnNumber,
        branchId: candidate.id,
        sourceType: "individual",
        sourceId: "observer",
        targetType: "society",
        targetId: candidate.participatingCharacterIds[0] ?? "world",
        dimension: societyInfluenceDimension(candidate),
        direction: societyInfluenceDirection(candidate),
        intensity: candidate.riskLabel === "high" ? 0.78 : candidate.riskLabel === "medium" ? 0.58 : 0.42,
        explanation: candidate.visibleCue,
      },
      {
        id: `world-${params.result.turnNumber}-${candidate.id}-back`,
        turn: params.result.turnNumber,
        branchId: candidate.id,
        sourceType: "society",
        sourceId: candidate.participatingCharacterIds[0] ?? "world",
        targetType: "individual",
        targetId: "observer",
        dimension: candidate.riskLabel === "high" ? "risk" : candidate.riskLabel === "medium" ? "behavior" : "trust",
        direction: individualInfluenceDirection(candidate),
        intensity: candidate.riskLabel === "high" ? 0.75 : 0.45,
        explanation: candidate.visibleCue,
      },
      ...(candidate.riskLabel === "high"
        ? [
            {
              id: `world-${params.result.turnNumber}-${candidate.id}-reputation`,
              turn: params.result.turnNumber,
              branchId: candidate.id,
              sourceType: "society" as const,
              sourceId: candidate.participatingCharacterIds[0] ?? "world",
              targetType: "individual" as const,
              targetId: "observer",
              dimension: "trust" as const,
              direction: "decrease" as const,
              intensity: 0.5,
              explanation: params.language === "en"
                ? `Public risk makes the observer easier to blame: ${candidate.stateDelta.eventSummary}`
                : `公开风险让观察者更容易被归责：${candidate.stateDelta.eventSummary}`,
            },
          ]
        : []),
    ],
  );

  return {
    turnNumber: params.result.turnNumber,
    branches,
    branchWorldDeltas,
    branchCommunities,
    influenceEvents,
  };
}

function normalizeWorldBranchScores(
  candidates: WorldCandidate[],
  state?: WorldRuntimeState,
): number[] {
  const rawScores = candidates.map((candidate) =>
    scoreWorldCandidate(candidate, state),
  );
  const total = rawScores.reduce((sum, score) => sum + score, 0) || 1;
  const normalized = rawScores.map((score) => Number((score / total).toFixed(2)));
  const drift = Number((1 - normalized.reduce((sum, score) => sum + score, 0)).toFixed(2));
  if (normalized.length > 0) {
    normalized[normalized.length - 1] = Number((normalized[normalized.length - 1]! + drift).toFixed(2));
  }
  return normalized;
}

function scoreWorldCandidate(
  candidate: WorldCandidate,
  state?: WorldRuntimeState,
): number {
  const riskBase = candidate.riskLabel === "low"
    ? 0.42
    : candidate.riskLabel === "medium"
      ? 0.34
      : 0.24;
  let score = riskBase;

  const milestoneSignal = candidate.milestoneSignals[0];
  if (milestoneSignal?.proposedStatus === "achieved") score += 0.16;
  if (milestoneSignal?.proposedStatus === "active") score += 0.06;
  if (milestoneSignal?.proposedStatus === "failed") score -= 0.14;

  const relationshipShift = candidate.stateDelta.relationshipDeltas.reduce(
    (sum, delta) => sum + delta.affinityDelta * 0.04 - delta.tensionDelta * 0.035,
    0,
  );
  const attitudeShift = candidate.stateDelta.characterDeltas.reduce(
    (sum, delta) => sum + delta.attitudeDelta * 0.035,
    0,
  );
  score += relationshipShift + attitudeShift;

  for (const reaction of candidate.npcReactions) {
    if (reaction.stance === "supportive") score += 0.035;
    if (reaction.stance === "resistant") score -= 0.045;
    if (reaction.stance === "uncertain") score -= 0.01;
  }

  if (state) {
    const activeEvent = strongestCurrentEvent(state);
    const touchesCurrentEvent = activeEvent
      ? candidateTouchesEvent(candidate, activeEvent, state.playerCharacter.characterId)
      : false;
    if (activeEvent) {
      if (touchesCurrentEvent) score += 0.08 + activeEvent.severity * 0.04;
      if (!touchesCurrentEvent && candidate.riskLabel === "low") score -= 0.05 + activeEvent.severity * 0.04;
      if (!touchesCurrentEvent && candidate.riskLabel === "high") score -= 0.02;
    }

    const pressure = state.worldPressure;
    if (pressure) {
      if (pressure.hiddenResentment >= 70 && candidate.riskLabel === "high") score -= 0.08;
      if (pressure.publicFace <= 35 && candidate.riskLabel === "high") score -= 0.06;
      if (pressure.informationClarity <= 40 && candidate.riskLabel === "low") score += 0.05;
      if (pressure.householdOrder <= 35 && candidate.riskLabel === "medium") score += 0.05;
      if (pressure.authorityLegitimacy <= 35 && candidate.riskLabel === "medium") score += 0.03;
    }

    const activeMilestone = state.milestones.find((milestone) => milestone.status === "active");
    if (
      activeMilestone &&
      candidate.milestoneSignals.some((signal) => signal.milestoneId === activeMilestone.id)
    ) {
      score += 0.05;
    }
  }

  if (candidate.stateDelta.addWorldFlags.length > 0) score += 0.015;
  if (candidate.stateDelta.eventSummary.length > 0) score += 0.015;

  return Number(Math.min(0.82, Math.max(0.08, score)).toFixed(3));
}

function formatWorldKeyUncertainty(
  candidate: WorldCandidate,
  pack: WorldPack,
  language: OutputLanguage,
  state?: WorldRuntimeState,
): string {
  const useChinese = language !== "en";
  const targetName = pack.characters.find(
    (character) => character.id === candidate.participatingCharacterIds[0],
  )?.name;
  const targetState = state?.characterStates.find(
    (character) => character.characterId === candidate.participatingCharacterIds[0],
  );
  const activeEvent = state ? strongestCurrentEvent(state) : undefined;
  const eventPhrase = activeEvent
    ? activeEvent.description.slice(0, useChinese ? 26 : 80)
    : undefined;
  const pressurePhrase = state?.worldPressure
    ? strongestPressurePhrase(state.worldPressure, useChinese)
    : undefined;
  const attitudePhrase = targetState
    ? worldAttitudeUncertaintyPhrase(targetState.attitude, useChinese)
    : undefined;

  if (useChinese) {
    if (eventPhrase && targetName) {
      return `${targetName}${attitudePhrase ?? "会如何表态"}，以及“${eventPhrase}”会把代价推向谁。`;
    }
    if (eventPhrase) {
      return `“${eventPhrase}”会被推进、拖延，还是转化成新的流言压力。`;
    }
    if (pressurePhrase && targetName) {
      return `${targetName}${attitudePhrase ?? "会如何回应"}，同时${pressurePhrase}是否恶化。`;
    }
    if (candidate.riskLabel === "high") {
      return targetName
        ? `${targetName}会如何反制，以及这一步会不会公开损害名声。`
        : "公开反制与名声代价会怎样落到你身上。";
    }
    if (candidate.riskLabel === "medium") {
      return targetName
        ? `${targetName}是否愿意配合，以及交换条件会不会变成新债。`
        : "有限试探能否换来真实配合，而不是新的牵制。";
    }
    return "保守行动能否换来足够信息，而不是错过推进时机。";
  }

  if (eventPhrase && targetName) {
    return `How ${targetName} responds, and who absorbs the cost of “${eventPhrase}”.`;
  }
  if (eventPhrase) {
    return `Whether “${eventPhrase}” advances, stalls, or becomes new rumor pressure.`;
  }
  if (pressurePhrase && targetName) {
    return `How ${targetName} responds, and whether ${pressurePhrase} worsens.`;
  }
  if (candidate.riskLabel === "high") {
    return targetName
      ? `How ${targetName} retaliates, and whether the public cost lands on you.`
      : "How retaliation and public cost land on you.";
  }
  if (candidate.riskLabel === "medium") {
    return targetName
      ? `Whether ${targetName} cooperates, and what obligation the exchange creates.`
      : "Whether a limited probe creates real cooperation or a new bind.";
  }
  return "Whether caution produces enough information before the moment closes.";
}

function strongestCurrentEvent(state: WorldRuntimeState): WorldEvent | undefined {
  return [...(state.eventQueue ?? [])]
    .filter((event) =>
      event.status === "active" ||
      (event.status === "scheduled" && event.dueTurn === state.turn + 1),
    )
    .sort((left, right) => right.severity - left.severity)[0];
}

function strongestPressurePhrase(
  pressure: NonNullable<WorldRuntimeState["worldPressure"]>,
  useChinese: boolean,
): string {
  const entries = [
    { key: "hiddenResentment", value: pressure.hiddenResentment, zh: "暗怨", en: "hidden resentment" },
    { key: "publicFace", value: 100 - pressure.publicFace, zh: "体面压力", en: "face pressure" },
    { key: "informationClarity", value: 100 - pressure.informationClarity, zh: "信息混乱", en: "information fog" },
    { key: "householdOrder", value: 100 - pressure.householdOrder, zh: "秩序压力", en: "order pressure" },
    { key: "authorityLegitimacy", value: 100 - pressure.authorityLegitimacy, zh: "权威合法性", en: "authority legitimacy" },
  ];
  const strongest = entries.sort((left, right) => right.value - left.value)[0];
  return useChinese
    ? `${strongest?.zh ?? "局势压力"}`
    : `${strongest?.en ?? "world pressure"}`;
}

function worldAttitudeUncertaintyPhrase(
  attitude: number,
  useChinese: boolean,
): string {
  if (useChinese) {
    if (attitude <= -2) return "会不会借机反制";
    if (attitude >= 2) return "是否愿意继续护持";
    return "会如何重新站队";
  }
  if (attitude <= -2) return "may retaliate";
  if (attitude >= 2) return "may keep protecting you";
  return "may reposition";
}

function societyInfluenceDimension(candidate: WorldCandidate): InfluenceEvent["dimension"] {
  if (candidate.riskLabel === "high") return "pressure";
  if (candidate.riskLabel === "medium") return "opportunity";
  return "trust";
}

function societyInfluenceDirection(candidate: WorldCandidate): InfluenceEvent["direction"] {
  if (candidate.riskLabel === "high") return "increase";
  if (candidate.riskLabel === "medium") return "redirect";
  return "increase";
}

function individualInfluenceDirection(candidate: WorldCandidate): InfluenceEvent["direction"] {
  if (candidate.riskLabel === "high") return "increase";
  if (candidate.riskLabel === "medium") return "redirect";
  return "increase";
}

export function revealSelectedWorldBranch(
  turn: TurnGenerationResult,
  candidate: WorldCandidate,
): TurnGenerationResult {
  return {
    ...turn,
    branches: turn.branches.map((branch) =>
      branch.id === candidate.id
        ? {
            ...branch,
            summary: candidate.hiddenOutcome,
            consequence: candidate.stateDelta.eventSummary,
          }
        : branch,
    ),
  };
}

export function revealWorldTurnOutcomes(
  turn: TurnGenerationResult,
  candidates: WorldCandidate[],
): TurnGenerationResult {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return {
    ...turn,
    branches: turn.branches.map((branch) => {
      const candidate = byId.get(branch.id);
      return candidate
        ? {
            ...branch,
            summary: candidate.hiddenOutcome,
            consequence: candidate.stateDelta.eventSummary,
          }
        : branch;
    }),
  };
}
