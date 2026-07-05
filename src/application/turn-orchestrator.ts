import { applyCollapse } from "../domain/collapse-handler";
import { encodeEntanglement } from "../domain/entanglement-encoder";
import {
  buildFallbackInfluenceEvents,
  influenceEventsForBranch,
} from "../domain/influence-events";
import { getPresetScenarioPack } from "../domain/preset-scenarios";
import {
  assertSessionIsActive,
  markSessionComplete,
  nextTurnNumber,
} from "../domain/session-engine";
import {
  applyInfluenceEventsToSimulationState,
  simulationStateForSession,
} from "../domain/simulation-state";
import { synthesizeUserAuthoredAction } from "../domain/user-authored-action";
import {
  buildVisualHistoryEntry,
  ensureTurnVisualScene,
} from "../domain/visual-scene";
import type {
  AgentTrace,
  GroundingLogEntry,
  SessionState,
  TurnGenerationResult,
  UserAuthoredActionInput,
  WorldContext,
} from "../domain/types";
import type {
  BranchGenerator,
  SocietySimulator,
  TurnSimulator,
  WorldModelProvider,
} from "./ports";

export class TurnOrchestrator {
  constructor(
    private readonly worldModelProvider: WorldModelProvider,
    private readonly branchGenerator: BranchGenerator,
    private readonly societySimulator: SocietySimulator,
    private readonly providerLabel = "LLM",
    private readonly modelLabel = "unknown",
    private readonly turnSimulator?: TurnSimulator,
  ) {}

  async generateTurn(session: SessionState): Promise<TurnGenerationResult> {
    assertSessionIsActive(session);
    const activeSession: SessionState = {
      ...session,
      visualMode: session.visualMode ?? "avatar-room",
      visualStyle: session.visualStyle ?? "career-studio",
      visualHistory: session.visualHistory ?? [],
      userAuthoredActions: session.userAuthoredActions ?? [],
      influenceEvents: session.influenceEvents ?? [],
      groundingLog: session.groundingLog ?? [],
      simulationState: simulationStateForSession(session),
    };

    const worldContext = await this.worldModelProvider.getContext(activeSession);
    const generationInput = {
      session: {
        ...activeSession,
        lastWorldContext: worldContext,
      },
      worldContext,
    };
    const rawTurnResult = this.turnSimulator
      ? await this.turnSimulator.simulate(generationInput)
      : await this.generateTurnWithLegacyPipeline(generationInput);
    const turnResult = ensureTurnVisualScene(generationInput, rawTurnResult);

    if (turnResult.turnNumber !== nextTurnNumber(activeSession)) {
      throw new Error("Turn generator returned an unexpected turn number.");
    }

    const groundingContext = buildGroundingContext(generationInput.session, worldContext);

    return {
      ...turnResult,
      groundingContext,
      agentTrace: buildAgentTrace({
        session: activeSession,
        providerLabel: this.providerLabel,
        modelLabel: this.modelLabel,
        turnResult: {
          ...turnResult,
          groundingContext,
        },
        worldContext,
      }),
    };
  }

  private async generateTurnWithLegacyPipeline(
    generationInput: {
      session: SessionState;
      worldContext: NonNullable<SessionState["lastWorldContext"]>;
    },
  ): Promise<Omit<TurnGenerationResult, "agentTrace" | "groundingContext">> {
    const turnDraft = await this.branchGenerator.generate(generationInput);

    const branchCommunities = await this.societySimulator.simulate({
      ...generationInput,
      ...turnDraft,
    });

    const influenceEvents = buildFallbackInfluenceEvents({
      branches: turnDraft.branches,
      branchCommunities,
      branchWorldDeltas: turnDraft.branchWorldDeltas,
      turnNumber: turnDraft.turnNumber,
    });

    return {
      ...turnDraft,
      branchCommunities,
      influenceEvents,
    };
  }

  chooseBranch(
    session: SessionState,
    turnResult: TurnGenerationResult,
    selectedBranchId: string,
  ): SessionState {
    const collapseResult = applyCollapse(session, turnResult, selectedBranchId);
    const branchCommunity = turnResult.branchCommunities.find(
      (community) => community.branchId === selectedBranchId,
    );
    const branchWorldDelta = turnResult.branchWorldDeltas.find(
      (delta) => delta.branchId === selectedBranchId,
    );
    const groundingLogEntry = buildGroundingLogEntry(
      turnResult,
      selectedBranchId,
      collapseResult.selectedBranch.title,
    );
    const selectedInfluenceEvents = influenceEventsForBranch(
      turnResult.influenceEvents ?? [],
      selectedBranchId,
    );
    const simulationState = applyInfluenceEventsToSimulationState(
      simulationStateForSession(session),
      selectedInfluenceEvents,
      turnResult.turnNumber,
    );
    const visualHistoryEntry = buildVisualHistoryEntry({
      turnResult,
      selectedBranchId,
    });

    const entangledSession = encodeEntanglement({
      session: {
        ...collapseResult.session,
        lastWorldContext:
          turnResult.groundingContext?.worldContext ?? session.lastWorldContext,
        influenceEvents: [
          ...(collapseResult.session.influenceEvents ?? []),
          ...selectedInfluenceEvents,
        ],
        simulationState,
        visualHistory: visualHistoryEntry
          ? [...(collapseResult.session.visualHistory ?? []), visualHistoryEntry]
          : (collapseResult.session.visualHistory ?? []),
        groundingLog: groundingLogEntry
          ? [...(collapseResult.session.groundingLog ?? []), groundingLogEntry]
          : (collapseResult.session.groundingLog ?? []),
      },
      selectedBranch: collapseResult.selectedBranch,
      branchCommunity,
      branchWorldDelta,
    });

    if (entangledSession.turn >= entangledSession.maxTurns) {
      return markSessionComplete(entangledSession);
    }

    return entangledSession;
  }

  chooseUserAuthoredAction(
    session: SessionState,
    turnResult: TurnGenerationResult,
    action: UserAuthoredActionInput,
  ): SessionState {
    const synthesized = synthesizeUserAuthoredAction({
      session,
      turnResult,
      action,
    });

    const augmentedTurn: TurnGenerationResult = {
      ...turnResult,
      branches: [...turnResult.branches, synthesized.branch],
      branchWorldDeltas: [...turnResult.branchWorldDeltas, synthesized.branchWorldDelta],
      branchCommunities: [...turnResult.branchCommunities, synthesized.branchCommunity],
      influenceEvents: [
        ...(turnResult.influenceEvents ?? []),
        ...buildFallbackInfluenceEvents({
          branches: [synthesized.branch],
          branchCommunities: [synthesized.branchCommunity],
          branchWorldDeltas: [synthesized.branchWorldDelta],
          turnNumber: turnResult.turnNumber,
        }),
      ],
    };

    const augmentedTurnWithVisuals = ensureTurnVisualScene(
      {
        session: {
          ...session,
          simulationState: simulationStateForSession(session),
        },
        worldContext:
          turnResult.groundingContext?.worldContext ??
          session.lastWorldContext ??
          fallbackWorldContext(session),
      },
      {
        ...augmentedTurn,
        visualScene: undefined,
      },
    );

    const nextSession = this.chooseBranch(
      session,
      augmentedTurnWithVisuals,
      synthesized.branch.id,
    );

    return {
      ...nextSession,
      userAuthoredActions: [
        ...(nextSession.userAuthoredActions ?? []),
        synthesized.actionRecord,
      ],
    };
  }
}

function fallbackWorldContext(session: SessionState): WorldContext {
  return {
    domain: session.domain,
    setting: "A personal decision room shaped by the observer's current dilemma.",
    externalConditions: "The outside world is uncertain but responsive to visible action.",
    constraints: ["Choices must remain legible to the people affected by them."],
    opportunities: ["A self-authored path can reveal options the original menu missed."],
    stableRules: ["Every collapse changes both personal state and social interpretation."],
    currentWorldPressure: "The room is waiting for the observer to make one path real.",
  };
}

function buildGroundingContext(
  session: SessionState,
  worldContext: SessionState["lastWorldContext"] extends infer _ ? NonNullable<SessionState["lastWorldContext"]> : never,
) {
  const presetScenario = getPresetScenarioPack(session.presetScenarioId);

  if (!presetScenario && !session.userProvidedData) {
    return undefined;
  }

  return {
    sourceType: presetScenario
      ? session.userProvidedData
        ? ("preset+user-provided" as const)
        : ("preset" as const)
      : ("user-provided" as const),
    presetScenarioId: presetScenario?.scenarioId,
    scenarioTitle: presetScenario?.title,
    worldFactsUsed: presetScenario?.worldFacts.slice(0, 3)
      ?? session.userProvidedData?.factItems.slice(0, 5).map((fact) => fact.summary)
      ?? [],
    socialTensionsUsed: presetScenario?.socialTensions.slice(0, 2)
      ?? session.userProvidedData?.derivedBrief.decisionPressures.slice(0, 4)
      ?? [],
    roleCastUsed:
      presetScenario?.roleCast.slice(0, 4).map((role) => ({
        role: role.role,
        relationship: role.relationship,
        baselineStance: role.baselineStance,
      })) ?? session.userProvidedData?.derivedBrief.keyStakeholders.slice(0, 4).map((stakeholder) => ({
        role: stakeholder,
        relationship: "user-provided stakeholder",
        baselineStance: "uncertain" as const,
      })) ?? [],
    userContextSummary: session.userContextPack
      ? {
          userGoal: session.userContextPack.userGoal,
          currentPosition: session.userContextPack.currentPosition,
          riskPreference: session.userContextPack.riskPreference,
          timeHorizon: session.userContextPack.timeHorizon,
          personalConstraints: session.userContextPack.personalConstraints,
          keyStakeholders: session.userContextPack.keyStakeholders,
          successCriteria: session.userContextPack.successCriteria,
        }
      : undefined,
    userProvidedDataSummary: session.userProvidedData
      ? {
          sourceCount: session.userProvidedData.sources.length,
          factCount: session.userProvidedData.factItems.length,
          topFacts: session.userProvidedData.factItems.slice(0, 5).map((fact) => ({
            type: fact.type,
            summary: fact.summary,
          })),
          derivedBrief: session.userProvidedData.derivedBrief,
        }
      : undefined,
    worldContext,
  };
}

function buildGroundingLogEntry(
  turnResult: TurnGenerationResult,
  selectedBranchId: string,
  selectedBranchTitle: string,
): GroundingLogEntry | undefined {
  if (!turnResult.groundingContext) {
    return undefined;
  }

  const { worldContext, ...rest } = turnResult.groundingContext;

  return {
    turn: turnResult.turnNumber,
    selectedBranchId,
    selectedBranchTitle,
    groundingContext: {
      ...rest,
      worldContextSummary: {
        setting: worldContext.setting,
        externalConditions: worldContext.externalConditions,
        currentWorldPressure: worldContext.currentWorldPressure,
      },
    },
  };
}

function buildAgentTrace(params: {
  providerLabel: string;
  modelLabel: string;
  session: SessionState;
  turnResult: Omit<TurnGenerationResult, "agentTrace">;
  worldContext: NonNullable<SessionState["lastWorldContext"]>;
}): AgentTrace {
  const { providerLabel, modelLabel, session, turnResult, worldContext } = params;
  const priorChoice = session.canonicalPath.at(-1);
  const latestAuthoredAction = session.userAuthoredActions.at(-1);
  const useChinese = session.language !== "en";

  const observerState =
    session.turn === 0
      ? useChinese
        ? "观察者第一次进入决策空间。"
        : "Observer is entering the decision space for the first time."
      : priorChoice
        ? useChinese
          ? `观察者已经坍缩到「${priorChoice.title}」，并携带 ${session.quantumTrace.length} 条痕迹信号。`
          : `Observer has collapsed toward "${priorChoice.title}" and is carrying ${session.quantumTrace.length} trace signal(s).`
        : useChinese
          ? "观察者已有决策历史，但没有找到上一条 canonical branch。"
          : "Observer has an active decision history but no prior canonical branch was found.";

  const humanMovement = [
    useChinese ? `输入困境: ${session.dilemma}` : `Input dilemma: ${session.dilemma}`,
    useChinese
      ? `当前位置: 第 ${session.turn}/${session.maxTurns} 轮`
      : `Current position: turn ${session.turn}/${session.maxTurns}`,
    priorChoice
      ? useChinese
        ? `上次坍缩: ${priorChoice.title} -> ${priorChoice.consequence}`
        : `Last collapse: ${priorChoice.title} -> ${priorChoice.consequence}`
      : useChinese
        ? "还没有发生坍缩。"
        : "No collapse has happened yet.",
    latestAuthoredAction
      ? useChinese
        ? `最近的用户自定义行动: ${latestAuthoredAction.title}`
        : `Recent user-authored action: ${latestAuthoredAction.title}`
      : useChinese
        ? "最新状态中没有用户自定义行动。"
        : "No user-authored action in the latest state.",
  ];

  const environmentDynamics = [
    useChinese ? `世界设定: ${worldContext.setting}` : `World setting: ${worldContext.setting}`,
    useChinese ? `压力: ${worldContext.currentWorldPressure}` : `Pressure: ${worldContext.currentWorldPressure}`,
    useChinese ? `生成分支数: ${turnResult.branches.length}` : `Generated branches: ${turnResult.branches.length}`,
    useChinese ? `环境变化数: ${turnResult.branchWorldDeltas.length}` : `Environment deltas: ${turnResult.branchWorldDeltas.length}`,
    useChinese ? `利益相关者模拟数: ${turnResult.branchCommunities.length}` : `Stakeholder simulations: ${turnResult.branchCommunities.length}`,
    useChinese ? `影响事件数: ${turnResult.influenceEvents.length}` : `Influence events: ${turnResult.influenceEvents.length}`,
    useChinese ? `模拟状态更新至第 ${session.simulationState.updatedAtTurn} 轮` : `Simulation state turn: ${session.simulationState.updatedAtTurn}`,
  ];

  return {
    provider: providerLabel,
    model: modelLabel,
    observerState,
    environmentPressure: worldContext.currentWorldPressure,
    generativeSteps: [
      useChinese
        ? `${providerLabel} 为这一轮现实生成候选分支、环境变化、利益相关者反应和影响事件。`
        : `${providerLabel} generated candidate branches, environment deltas, stakeholder reactions, and influence events for one reality turn.`,
    ],
    deterministicSteps: [
      useChinese
        ? "xMocha 使用 schema 验证结构化 JSON。"
        : "xMocha validates structured JSON with schemas.",
      useChinese
        ? "xMocha 归一化分支分数，修复缺失的 branch-linked 记录，并检查分支关联。"
        : "xMocha normalizes branch scores, repairs missing branch-linked records, and checks branch linkage.",
      useChinese
        ? "xMocha 记录个人-社会-环境之间的影响事件，用于因果分析。"
        : "xMocha records individual-society-environment influence events for causal analysis.",
      useChinese
        ? "xMocha 在坍缩后将被选中分支的影响事件确定性地归约进 simulation state。"
        : "xMocha deterministically reduces selected influence events into the simulation state after collapse.",
      useChinese
        ? "xMocha 执行坍缩、canonical path 更新、shadow timeline 归档、持久化和最大轮数控制。"
        : "xMocha performs collapse, canonical path updates, shadow timeline archival, persistence, and max-turn control.",
    ],
    humanMovement,
    environmentDynamics,
  };
}
