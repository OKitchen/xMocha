import { applyCollapse } from "../../domain/collapse-handler";
import { createSession, markSessionComplete } from "../../domain/session-engine";
import {
  assertSessionOwnerAccess,
  createSessionAccessToken,
  hashSessionAccessToken,
} from "../../domain/session-access";
import { appendAnalyticsEvent } from "../../domain/session-telemetry";
import {
  applyInfluenceEventsToSimulationState,
  simulationStateForSession,
} from "../../domain/simulation-state";
import type {
  SessionModelConfig,
  SessionState,
  SessionSummary,
  SimulationState,
  TurnGenerationResult,
  UserAuthoredActionInput,
} from "../../domain/types";
import { influenceEventsForBranch } from "../../domain/influence-events";
import { interpretWorldAction } from "../../domain/world-action-interpreter";
import { verifyWorldAccessToken } from "../../domain/world-access";
import {
  applyWorldCandidate,
  createExperiencePlan,
  createInitialWorldRuntimeState,
  markWorldCandidatesPending,
  prepareWorldRuntimeState,
  revealSelectedWorldBranch,
  revealWorldTurnOutcomes,
  worldTurnToTurnGenerationResult,
} from "../../domain/world-state";
import type {
  CustomWorldCharacterInput,
  StoredWorldPack,
  WorldCandidate,
  WorldEvent,
  WorldPack,
  WorldRuntimeState,
  WorldTurnResult,
} from "../../domain/world-types";
import { createJsonGenerationClient } from "../../infrastructure/llm/provider-factory";
import { withRuntimeModelConfig } from "../../infrastructure/llm/runtime-model-config";
import {
  createSessionRepository,
  createTurnRunRepository,
  createWorldPackRepository,
} from "../../infrastructure/runtime/create-runtime";
import { WorldTurnSimulator } from "../../infrastructure/world/world-turn-simulator";

export type StartWorldSessionParams = {
  worldPackId: string;
  worldPackVersion?: number;
  ownerToken?: string;
  playerCharacterId?: string;
  customCharacter?: CustomWorldCharacterInput;
  primaryGoal: string;
  language?: "zh-CN" | "en";
  modelConfig?: SessionModelConfig;
};

export type StartedWorldSession = {
  session: SessionState;
  accessToken: string;
};

export async function startWorldSession(
  params: StartWorldSessionParams,
): Promise<StartedWorldSession> {
  const packRecord = await loadAuthorizedPack(
    params.worldPackId,
    params.worldPackVersion,
    params.ownerToken,
  );
  const { plan, player } = createExperiencePlan({
    pack: packRecord.pack,
    playerCharacterId: params.playerCharacterId,
    customCharacter: params.customCharacter,
    primaryGoal: params.primaryGoal,
  });
  const runtimeState = createInitialWorldRuntimeState({
    pack: packRecord.pack,
    plan,
    player,
  });
  const accessToken = createSessionAccessToken();
  let session = createSession({
    dilemma: params.primaryGoal,
    theme: "adventure",
    language: params.language ?? packRecord.pack.language,
    modelConfig: params.modelConfig,
    visualStyle: "night-cafe",
    maxTurns: 5,
    sessionAccessTokenHash: hashSessionAccessToken(accessToken),
  });
  session = appendAnalyticsEvent(
    {
      ...session,
      simulationState: seedWorldSimulationState({
        simulationState: session.simulationState,
        pack: packRecord.pack,
        runtime: runtimeState,
        language: params.language ?? packRecord.pack.language,
      }),
      mode: "world",
      revision: 0,
      worldPackId: packRecord.pack.worldPackId,
      worldPackVersion: packRecord.pack.version,
      worldExperiencePlan: plan,
      worldRuntimeState: runtimeState,
      privateWorld: packRecord.pack.visibility === "private",
      worldAccessTokenHash: packRecord.ownerTokenHash,
    },
    "world_session_started",
    { worldPackId: packRecord.pack.worldPackId },
  );

  const generated = await generatePendingWorldTurn(session, packRecord.pack);
  session = generated.session;
  const repository = createSessionRepository();
  await repository.save(session);
  await persistTurnRuns(generated.runs, session.sessionId);
  return { session, accessToken };
}

export async function chooseWorldTurnAction(params: {
  session: SessionState;
  accessToken?: string;
  branchId?: string;
  authoredAction?: UserAuthoredActionInput;
  expectedRevision?: number;
}): Promise<SessionState> {
  assertWorldAccess(params.session, params.accessToken);
  const packRecord = await loadWorldPackForSession(params.session);
  const runtime = requireWorldRuntime(params.session);
  const pendingWorldTurn = params.session.pendingWorldTurn;
  const pendingTurn = params.session.pendingTurn;
  if (!pendingWorldTurn || !pendingTurn) {
    throw new Error("World session has no pending turn.");
  }
  if (
    params.expectedRevision !== undefined &&
    params.expectedRevision !== runtime.revision
  ) {
    throw new Error(
      `World state revision conflict: expected ${params.expectedRevision}, current ${runtime.revision}.`,
    );
  }

  const candidate = params.authoredAction
    ? synthesizeCustomWorldCandidate({
        action: params.authoredAction,
        runtime,
        pendingWorldTurn,
        pack: packRecord.pack,
        language: params.session.language,
      })
    : pendingWorldTurn.candidates.find((item) => item.id === params.branchId);
  if (!candidate) throw new Error("Selected world candidate was not found.");

  const preparedTurn = params.authoredAction
    ? appendCustomCandidateToTurn(
        pendingTurn,
        pendingWorldTurn,
        candidate,
        packRecord.pack,
        params.session.language,
        runtime,
      )
    : pendingTurn;
  const turnForCollapse = revealWorldTurnOutcomes(
    preparedTurn,
    params.authoredAction
      ? [...pendingWorldTurn.candidates, candidate]
      : pendingWorldTurn.candidates,
  );
  const collapse = applyCollapse(params.session, turnForCollapse, candidate.id);
  const nextRuntime = applyWorldCandidate({
    state: runtime,
    candidate,
    expectedRevision: params.expectedRevision,
  });
  const selectedInfluenceEvents = influenceEventsForBranch(
    preparedTurn.influenceEvents ?? [],
    candidate.id,
  );
  const simulationState = syncWorldPressureToSimulationState(
    applyInfluenceEventsToSimulationState(
      seedWorldSimulationState({
        simulationState: simulationStateForSession(params.session),
        pack: packRecord.pack,
        runtime,
        language: params.session.language,
      }),
      selectedInfluenceEvents,
      pendingWorldTurn.turnNumber,
    ),
    nextRuntime,
  );
  let collapsed = appendAnalyticsEvent(
    {
      ...collapse.session,
      influenceEvents: [
        ...(collapse.session.influenceEvents ?? []),
        ...selectedInfluenceEvents,
      ],
      simulationState,
      revision: nextRuntime.revision,
      worldRuntimeState: nextRuntime,
      pendingTurn: undefined,
      pendingWorldTurn: undefined,
    },
    "branch_selected",
    {
      branchId: candidate.id,
      selectedBranchTitle: candidate.actionTitle,
      authoredAction: Boolean(params.authoredAction),
      mode: "world",
    },
  );
  if (params.authoredAction) {
    collapsed = {
      ...collapsed,
      userAuthoredActions: [
        ...collapsed.userAuthoredActions,
        {
          turn: pendingWorldTurn.turnNumber,
          rawInput: params.authoredAction.rawInput,
          title: candidate.actionTitle,
          summary: params.authoredAction.rawInput,
          consequence: candidate.stateDelta.eventSummary,
          riskProfile: candidate.riskLabel,
          timeHorizon: "下一场景",
          anchorBranchId: params.authoredAction.anchorBranchId,
        },
      ],
    };
  }

  const repository = createSessionRepository();
  await recordWorldTurnCommit({
    sessionId: params.session.sessionId,
    turn: pendingWorldTurn.turnNumber,
    candidateId: candidate.id,
    revisionAfter: nextRuntime.revision,
  });
  await repository.save(collapsed);

  if (collapsed.turn >= collapsed.maxTurns) {
    const complete = appendAnalyticsEvent(
      {
        ...markSessionComplete(collapsed),
        summary: buildWorldSummary(collapsed, packRecord.pack),
      },
      "world_session_completed",
      { worldPackId: packRecord.pack.worldPackId },
    );
    await repository.save(complete);
    return complete;
  }

  const generated = await generatePendingWorldTurn(
    {
      ...collapsed,
      worldRuntimeState: prepareWorldRuntimeState(nextRuntime),
    },
    packRecord.pack,
  );
  await repository.save(generated.session);
  await persistTurnRuns(generated.runs, generated.session.sessionId);
  return generated.session;
}

export async function retryWorldTurn(params: {
  session: SessionState;
  accessToken?: string;
}): Promise<SessionState> {
  assertWorldAccess(params.session, params.accessToken);
  if (params.session.pendingWorldTurn && params.session.pendingTurn) return params.session;
  if (params.session.status !== "active") return params.session;
  const packRecord = await loadWorldPackForSession(params.session);
  const runtime = prepareWorldRuntimeState(requireWorldRuntime(params.session));
  const generated = await generatePendingWorldTurn(
    { ...params.session, worldRuntimeState: runtime },
    packRecord.pack,
  );
  await createSessionRepository().save(generated.session);
  await persistTurnRuns(generated.runs, generated.session.sessionId);
  return generated.session;
}

export function assertWorldAccess(session: SessionState, token?: string): void {
  if (session.mode !== "world") return;
  assertSessionOwnerAccess(session, token);
}

export function projectSessionForClient(session: SessionState): SessionState {
  if (session.mode !== "world") return session;
  const pendingWorldTurn = session.pendingWorldTurn;
  const pendingTurn = session.pendingTurn;
  const worldRuntimeState = session.worldRuntimeState
    ? sanitizeWorldRuntimeForClient(session.worldRuntimeState, session.language)
    : undefined;
  const hiddenLabel = session.language === "en"
    ? "Revealed after this future is selected."
    : "选择这一未来后揭示。";
  return {
    ...session,
    worldRuntimeState,
    sessionAccessTokenHash: undefined,
    worldAccessTokenHash: undefined,
    worldTurnRuns: undefined,
    pendingTurn: pendingTurn
      ? {
          ...pendingTurn,
          branchWorldDeltas: pendingTurn.branchWorldDeltas.map((delta) => ({
            ...delta,
            pressureShift: hiddenLabel,
          })),
          branchCommunities: pendingTurn.branchCommunities.map((community) => ({
            ...community,
            dominantNarrative: hiddenLabel,
            agents: community.agents.map((agent) => ({
              ...agent,
              motivation: hiddenLabel,
              reaction: hiddenLabel,
            })),
          })),
        }
      : undefined,
    pendingWorldTurn: pendingWorldTurn
      ? {
          ...pendingWorldTurn,
          candidates: pendingWorldTurn.candidates.map((candidate) => ({
            ...candidate,
            hiddenOutcome: "",
            npcReactions: candidate.npcReactions.map((reaction) => ({
              ...reaction,
              reaction: hiddenLabel,
              usedFactIds: [],
              privateIntent: undefined,
            })),
          })),
        }
      : undefined,
  };
}

function sanitizeWorldRuntimeForClient(
  runtime: WorldRuntimeState,
  language: SessionState["language"],
): WorldRuntimeState {
  return {
    ...runtime,
    eventQueue: runtime.eventQueue
      ?.filter((event) => event.visibility !== "private")
      .map((event) => sanitizeWorldEventForClient(event, language)),
  };
}

function sanitizeWorldEventForClient(
  event: WorldEvent,
  language: SessionState["language"],
): WorldEvent {
  if (event.visibility !== "rumor") return { ...event };
  return {
    ...event,
    description: language === "en"
      ? `Rumor: ${event.description}`
      : `传闻：${event.description}`,
  };
}

async function loadAuthorizedPack(
  worldPackId: string,
  version: number | undefined,
  ownerToken: string | undefined,
): Promise<StoredWorldPack> {
  const record = await createWorldPackRepository().load(worldPackId, version);
  if (!record) throw new Error(`WorldPack "${worldPackId}" was not found.`);
  if (!verifyWorldAccessToken(ownerToken, record.ownerTokenHash)) {
    throw new Error("Private WorldPack owner token is invalid.");
  }
  return record;
}

async function loadWorldPackForSession(session: SessionState): Promise<StoredWorldPack> {
  if (!session.worldPackId) throw new Error("World session has no WorldPack id.");
  const record = await createWorldPackRepository().load(
    session.worldPackId,
    session.worldPackVersion,
  );
  if (!record) throw new Error(`WorldPack "${session.worldPackId}" was not found.`);
  return record;
}

function requireWorldRuntime(session: SessionState): WorldRuntimeState {
  if (!session.worldRuntimeState) throw new Error("World runtime state is missing.");
  return session.worldRuntimeState;
}

async function generatePendingWorldTurn(
  session: SessionState,
  pack: WorldPack,
): Promise<{ session: SessionState; runs: import("../../domain/world-types").TurnRun[] }> {
  const state = requireWorldRuntime(session);
  let simulator: WorldTurnSimulator;
  try {
    if (process.env.XMOCHA_WORLD_GENERATOR === "fallback") {
      throw new Error("World deterministic fallback requested.");
    }
    const { client, modelLabel, providerLabel } = await withRuntimeModelConfig(
      session.modelConfig,
      async () => createJsonGenerationClient(),
    );
    simulator = new WorldTurnSimulator(client, providerLabel, undefined, modelLabel);
  } catch (error) {
    console.warn("world_simulator_client_creation_failed", {
      sessionId: session.sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    simulator = new WorldTurnSimulator(
      undefined,
      "deterministic-fallback",
      undefined,
      "none",
      error instanceof Error ? error.message : String(error),
    );
  }
  const simulation = await simulator.simulate({
    sessionId: session.sessionId,
    pack,
    state,
    language: session.language,
  });
  const pendingTurn = worldTurnToTurnGenerationResult({
    result: simulation.result,
    pack,
    language: session.language,
    state,
  });
  return {
    runs: simulation.runs,
    session: appendAnalyticsEvent(
      {
        ...session,
        worldRuntimeState: markWorldCandidatesPending(state),
        pendingWorldTurn: simulation.result,
        pendingTurn,
      },
      session.turn === 0 ? "first_turn_generated" : "next_turn_generated",
      { fallback: simulation.usedFallback, mode: "world" },
    ),
  };
}

function synthesizeCustomWorldCandidate(params: {
  action: UserAuthoredActionInput;
  runtime: WorldRuntimeState;
  pendingWorldTurn: WorldTurnResult;
  pack: WorldPack;
  language: SessionState["language"];
}): WorldCandidate {
  const anchor = params.action.anchorBranchId
    ? params.pendingWorldTurn.candidates.find(
        (candidate) => candidate.id === params.action.anchorBranchId,
      )
    : params.pendingWorldTurn.candidates[1];
  const activeMilestone = params.runtime.milestones.find(
    (milestone) => milestone.status === "active",
  );
  const raw = params.action.rawInput.trim();
  const useChinese = params.language !== "en";
  const listSeparator = useChinese ? "、" : ", ";
  const capabilityText = params.runtime.playerCharacter.capabilities.join(listSeparator);
  const limitationText = params.runtime.playerCharacter.limitations.join(listSeparator);
  const interpreted = interpretWorldAction({
    rawInput: raw,
    runtime: params.runtime,
    pack: params.pack,
    fallbackRisk: params.action.riskProfile ?? anchor?.riskLabel,
  });
  const possible = interpreted.feasible;
  const risk = interpreted.riskLabel;
  const outcome = useChinese
    ? possible
      ? `你按自己的方式尝试“${raw}”。${interpreted.explanation} 在场人物开始据此重新判断你的手段。`
      : `你尝试“${raw}”，但受到身份、能力或局势边界限制。${interpreted.explanation} 行动没有按预期完成，却暴露了你的意图并产生关系代价。`
    : possible
      ? `You attempt “${raw}”. ${interpreted.explanation} Others update their read of your methods.`
      : `You attempt “${raw}”, but identity, capability, or situational limits block the intended result. ${interpreted.explanation}`;
  const primaryNpc = interpreted.targetCharacterIds[0] ?? params.runtime.activeCharacterIds[0];
  const targetNpcIds = interpreted.targetCharacterIds.length > 0
    ? interpreted.targetCharacterIds
    : params.runtime.activeCharacterIds;

  return {
    id: `ua-${params.pendingWorldTurn.turnNumber}-${params.runtime.revision + 1}`,
    actionTitle: raw.slice(0, 48),
    visibleCue: useChinese
      ? `自定义行动；意图：${interpreted.intent}；已有能力：${capabilityText || "无明确能力"}；边界：${limitationText || "世界规则"}`
      : `Self-authored action; intent: ${interpreted.intent}; capabilities: ${capabilityText || "none specified"}; limits: ${limitationText || "world rules"}.`,
    hiddenOutcome: outcome,
    riskLabel: risk,
    requiredCapabilities: interpreted.requiredCapabilities,
    participatingCharacterIds: targetNpcIds.slice(0, 3),
    npcReactions: primaryNpc
      ? [
          {
            characterId: primaryNpc,
            stance: possible ? "uncertain" : "resistant",
            reaction: outcome,
            usedFactIds: [
              params.pack.characters.find((character) => character.id === primaryNpc)
                ?.knownFactIds[0] ?? params.pack.canonFacts[0]!.id,
            ],
          },
        ]
      : [],
    stateDelta: {
      activeCharacterIds: params.runtime.activeCharacterIds,
      relationshipDeltas: primaryNpc
        ? [
            {
              sourceCharacterId: params.runtime.playerCharacter.characterId,
              targetCharacterId: primaryNpc,
              affinityDelta: possible && interpreted.intent === "comfort" ? 1 : possible ? 0 : -1,
              tensionDelta: possible && risk === "high" ? 1 : possible ? 0 : 1,
            },
          ]
        : [],
      characterDeltas: primaryNpc
        ? [
            {
              characterId: primaryNpc,
              attitudeDelta: possible ? 0 : -1,
              addKnownFlags: [`observed-custom-action-${params.runtime.turn + 1}`],
            },
          ]
        : [],
      addWorldFlags: [`custom-action-turn-${params.runtime.turn + 1}`],
      removeWorldFlags: [],
      eventSummary: outcome,
    },
    milestoneSignals: activeMilestone
      ? [
          {
            milestoneId: activeMilestone.id,
            signal: outcome,
            proposedStatus: possible && params.runtime.turn >= 1 ? "achieved" : "active",
          },
        ]
      : [],
    groundingFactIds: [
      ...new Set([
        ...params.pack.canonFacts.slice(0, 2).map((fact) => fact.id),
        ...(primaryNpc
          ? params.pack.characters.find((character) => character.id === primaryNpc)
              ?.knownFactIds.slice(0, 1) ?? []
          : []),
      ]),
    ],
  };
}

function appendCustomCandidateToTurn(
  turn: TurnGenerationResult,
  pendingWorldTurn: WorldTurnResult,
  candidate: WorldCandidate,
  pack: WorldPack,
  language: SessionState["language"],
  runtime: WorldRuntimeState,
): TurnGenerationResult {
  const syntheticWorldTurn: WorldTurnResult = {
    ...pendingWorldTurn,
    candidates: [candidate],
  };
  const mapped = worldTurnToTurnGenerationResult({
    result: syntheticWorldTurn,
    pack,
    language,
    state: runtime,
  });
  const revealed = revealSelectedWorldBranch(mapped, candidate);
  return {
    ...turn,
    branches: [...turn.branches, ...revealed.branches],
    branchWorldDeltas: [...turn.branchWorldDeltas, ...revealed.branchWorldDeltas],
    branchCommunities: [...turn.branchCommunities, ...revealed.branchCommunities],
    influenceEvents: [...turn.influenceEvents, ...revealed.influenceEvents],
  };
}

async function recordWorldTurnCommit(params: {
  sessionId: string;
  turn: number;
  candidateId: string;
  revisionAfter: number;
}): Promise<void> {
  try {
    const repository = createTurnRunRepository();
    const runs = await repository.listForSession(params.sessionId);
    const latest = runs
      .filter((run) => run.turn === params.turn)
      .sort((left, right) => right.attempt - left.attempt)[0];
    if (!latest) return;
    await repository.saveMany([
      {
        ...latest,
        revisionAfter: params.revisionAfter,
        selectedCandidateId: params.candidateId,
      },
    ]);
  } catch (error) {
    console.error("world_trace_commit_failed", {
      sessionId: params.sessionId,
      turn: params.turn,
      candidateId: params.candidateId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function persistTurnRuns(
  runs: import("../../domain/world-types").TurnRun[],
  sessionId: string,
): Promise<void> {
  try {
    await createTurnRunRepository().saveMany(runs);
  } catch (error) {
    console.error("world_trace_save_failed", {
      sessionId,
      runCount: runs.length,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildWorldSummary(session: SessionState, pack: WorldPack): SessionSummary {
  const useChinese = session.language !== "en";
  const path = session.canonicalPath.map((step, index) =>
    useChinese ? step.title : englishSafeLabel(step.title, `turn ${index + 1} choice`),
  );
  const milestones = session.worldRuntimeState?.milestones ?? [];
  const achieved = milestones.filter((milestone) => milestone.status === "achieved");
  const failed = milestones.filter((milestone) => milestone.status === "failed");
  const unresolved = milestones.filter((milestone) =>
    milestone.status === "active" || milestone.status === "locked"
  );
  const playerName = useChinese
    ? session.worldRuntimeState?.playerCharacter.name ?? "自己的角色"
    : englishSafeLabel(session.worldRuntimeState?.playerCharacter.name, "your character");
  const worldTitle = useChinese
    ? pack.title
    : englishSafeLabel(pack.title, "this world");
  const goal = session.worldExperiencePlan?.primaryGoal ?? session.dilemma;
  const pathText = path.length > 0
    ? path.map((title) => `「${title}」`).join("、")
    : useChinese ? "尚未形成选择轨迹" : "no selected path";
  return {
    narrative: useChinese
      ? `你以${playerName}进入《${pack.title}》，围绕“${goal}”走完一段五轮人生章节。你依次选择了${pathText}。这些行动改变了人物态度、关系压力与世界标记；章节结果为：达成 ${achieved.length} 个 milestone，失败 ${failed.length} 个，仍未完成 ${unresolved.length} 个。`
      : `You entered ${worldTitle} as ${playerName} and played a five-turn life chapter around “${goal}”. Your choices changed relationships, pressure, and world flags. Chapter outcome: ${achieved.length} milestone(s) achieved, ${failed.length} failed, ${unresolved.length} unresolved.`,
    decisionArc: path,
    alternateHint: useChinese
      ? "影子路径保留了每一轮未被观察的另一种展开。"
      : "Shadow paths preserve the unobserved alternatives from every turn.",
  };
}

function englishSafeLabel(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const cjkCount = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return cjkCount >= 2 ? fallback : trimmed;
}

function seedWorldSimulationState(params: {
  simulationState: SimulationState;
  pack: WorldPack;
  runtime: WorldRuntimeState;
  language: SessionState["language"];
}): SimulationState {
  const useChinese = params.language !== "en";
  const activeIds = new Set(params.runtime.activeCharacterIds);
  const candidateCharacters = params.pack.characters
    .filter((character) =>
      character.id !== params.runtime.playerCharacter.characterId &&
      (activeIds.has(character.id) || character.playable),
    )
    .slice(0, 5);
  const fallbackCharacters = params.pack.characters
    .filter((character) => character.id !== params.runtime.playerCharacter.characterId)
    .slice(0, 5);
  const characters = candidateCharacters.length > 0 ? candidateCharacters : fallbackCharacters;

  if (characters.length === 0) {
    return syncWorldPressureToSimulationState(
      {
        ...params.simulationState,
        updatedAtTurn: params.runtime.turn,
      },
      params.runtime,
    );
  }

  const genericStakeholderIds = new Set(["primary-stakeholder", "society"]);
  const existingSpecific = params.simulationState.stakeholders.filter(
    (stakeholder) => !genericStakeholderIds.has(stakeholder.id),
  );
  const existingIds = new Set(existingSpecific.map((stakeholder) => stakeholder.id));
  const relationshipByTarget = new Map(
    params.runtime.relationships
      .filter((relationship) =>
        relationship.sourceCharacterId === params.runtime.playerCharacter.characterId,
      )
      .map((relationship) => [relationship.targetCharacterId, relationship]),
  );
  const seeded = characters
    .filter((character) => !existingIds.has(character.id))
    .map((character) => {
      const relationship = relationshipByTarget.get(character.id);
      const affinity = relationship?.affinity ?? 0;
      const tension = relationship?.tension ?? 1;
      const trust = clampMetric(0.5 + affinity * 0.08 - tension * 0.04);
      const resistance = clampMetric(0.45 + tension * 0.08 - affinity * 0.05);
      return {
        id: character.id,
        role: character.name,
        stance: resistance - trust > 0.18 ? "resistant" as const : trust - resistance > 0.18 ? "supportive" as const : "uncertain" as const,
        trust,
        resistance,
        influence: activeIds.has(character.id) ? 0.68 : 0.52,
        currentGoal: character.goals[0] ?? (useChinese ? "按自身利益回应局势。" : "Respond from their own interests."),
      };
    });

  return syncWorldPressureToSimulationState(
    {
      ...params.simulationState,
      stakeholders: [...existingSpecific, ...seeded],
      updatedAtTurn: params.runtime.turn,
    },
    params.runtime,
  );
}

function syncWorldPressureToSimulationState(
  simulationState: SimulationState,
  runtime: WorldRuntimeState,
): SimulationState {
  if (!runtime.worldPressure) {
    return {
      ...simulationState,
      updatedAtTurn: Math.max(simulationState.updatedAtTurn, runtime.turn),
    };
  }

  const pressure = runtime.worldPressure;
  return {
    ...simulationState,
    environmentMetrics: {
      ...simulationState.environmentMetrics,
      behavior: clampMetric(pressure.householdOrder / 100),
      momentum: clampMetric((pressure.householdOrder + pressure.ritualOrder) / 200),
      opportunity: clampMetric(pressure.informationClarity / 100),
      pressure: clampMetric(pressure.hiddenResentment / 100),
      risk: clampMetric((pressure.hiddenResentment + (100 - pressure.authorityLegitimacy)) / 200),
      trust: clampMetric(pressure.publicFace / 100),
    },
    updatedAtTurn: Math.max(simulationState.updatedAtTurn, runtime.turn),
  };
}

function clampMetric(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(3));
}
