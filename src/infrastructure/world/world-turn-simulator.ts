import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { findOutputLanguageIssues } from "../../domain/output-language";
import { previewWorldCandidateState } from "../../domain/world-state";
import {
  liteWorldTurnResultSchema,
  worldTurnResultSchema,
} from "../../domain/world-schemas";
import { validateWorldTurn } from "../../domain/world-validation";
import type {
  AgentTraceNode,
  CandidateStatePreview,
  LiteWorldTurnResult,
  TurnRun,
  WorldCandidate,
  WorldEvent,
  WorldPack,
  WorldPromptStyle,
  WorldRuntimeState,
  WorldTurnResult,
} from "../../domain/world-types";
import type { JsonGenerationClient } from "../llm/anthropic-client";
import { getActiveModelName, getActiveProviderLabel } from "../llm/provider-factory";
import {
  buildLiteWorldTurnPrompt,
  buildWorldTurnPrompt,
  WORLD_TURN_PROMPT_VERSION,
} from "./world-prompts";

export type WorldTurnSimulation = {
  result: WorldTurnResult;
  runs: TurnRun[];
  usedFallback: boolean;
};

const worldGenerationTimeoutMs = Math.max(
  1_000,
  Number(process.env.XMOCHA_WORLD_GENERATION_TIMEOUT_MS) || 15_000,
);

class WorldGenerationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`World generation timed out after ${timeoutMs}ms.`);
    this.name = "WorldGenerationTimeoutError";
  }
}

export class WorldTurnSimulator {
  constructor(
    private readonly client?: JsonGenerationClient,
    private readonly providerLabel = getActiveProviderLabel(),
    private readonly timeoutMs = worldGenerationTimeoutMs,
    private readonly modelLabel = getActiveModelName(),
    private readonly fallbackReason?: string,
  ) {}

  async simulate(params: {
    sessionId: string;
    pack: WorldPack;
    state: WorldRuntimeState;
    language?: "zh-CN" | "en";
  }): Promise<WorldTurnSimulation> {
    const runs: TurnRun[] = [];
    let repairIssues: string[] | undefined;

    if (this.client) {
      const client = this.client;
      const promptStyle = resolveWorldPromptStyle(this.providerLabel);
      const deadlineAt = performance.now() + this.timeoutMs;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const remainingMs = deadlineAt - performance.now();
        if (remainingMs <= 0) break;
        const startedAt = new Date().toISOString();
        const started = performance.now();
        try {
          const prompt = promptStyle === "lite"
            ? buildLiteWorldTurnPrompt({
                pack: params.pack,
                state: params.state,
                language: params.language,
                repairIssues,
              })
            : buildWorldTurnPrompt({
                pack: params.pack,
                state: params.state,
                language: params.language,
                repairIssues,
              });
          const raw = await withWorldGenerationTimeout(
            (signal) => client.generateJson(prompt, { signal }),
            Math.max(1, remainingMs),
          );
          const result = promptStyle === "lite"
            ? hydrateLiteWorldTurn({
                lite: liteWorldTurnResultSchema.parse(JSON.parse(raw)),
                pack: params.pack,
                state: params.state,
                language: params.language,
              })
            : worldTurnResultSchema.parse(JSON.parse(raw));
          const issues = [
            ...validateWorldTurn({
              pack: params.pack,
              state: params.state,
              result,
            }),
            ...validateWorldTurnOutputLanguage(result, params.language),
          ];
          runs.push(
            buildRun({
              params,
              attempt,
              startedAt,
              durationMs: performance.now() - started,
              status: issues.length === 0 ? "success" : "validation_failed",
              validationIssueCodes: issues.map((issue) => issue.code),
              fallbackUsed: false,
              retryReason: repairIssues?.join(", "),
              providerLabel: this.providerLabel,
              modelLabel: this.modelLabel,
              promptStyle,
              result,
            }),
          );
          if (issues.length === 0) {
            return { result, runs, usedFallback: false };
          }
          repairIssues = issues.map((issue) => `${issue.code}: ${issue.message}`);
        } catch (error) {
          const timedOut = error instanceof WorldGenerationTimeoutError;
          repairIssues = [error instanceof Error ? error.message : String(error)];
          runs.push(
            buildRun({
              params,
              attempt,
              startedAt,
              durationMs: performance.now() - started,
              status: timedOut ? "timeout" : "validation_failed",
              validationIssueCodes: [timedOut ? "MODEL_TIMEOUT" : "MODEL_OR_SCHEMA_FAILURE"],
              fallbackUsed: false,
              retryReason: repairIssues[0],
              providerLabel: this.providerLabel,
              modelLabel: this.modelLabel,
              promptStyle,
            }),
          );
          if (timedOut) break;
        }
      }
    }

    const fallback = buildFallbackWorldTurn(params.pack, params.state, params.language);
    const fallbackReason = repairIssues?.join(", ") ?? this.fallbackReason;
    runs.push(
      buildRun({
        params,
        attempt: runs.length + 1,
        startedAt: new Date().toISOString(),
        durationMs: 0,
        status: "fallback",
        validationIssueCodes: fallbackReason ? ["MODEL_FALLBACK"] : [],
        fallbackUsed: true,
        retryReason: fallbackReason,
        providerLabel: this.providerLabel,
        modelLabel: this.modelLabel,
        promptStyle: resolveWorldPromptStyle(this.providerLabel),
        result: fallback,
      }),
    );
    return { result: fallback, runs, usedFallback: true };
  }
}

function validateWorldTurnOutputLanguage(
  result: WorldTurnResult,
  language?: "zh-CN" | "en",
): Array<{ code: string; message: string }> {
  return findOutputLanguageIssues({
    language,
    fields: [
      { label: "visibleScene", text: result.visibleScene },
      ...result.candidates.flatMap((candidate) => [
        { label: `${candidate.id}.actionTitle`, text: candidate.actionTitle },
        { label: `${candidate.id}.visibleCue`, text: candidate.visibleCue },
        { label: `${candidate.id}.hiddenOutcome`, text: candidate.hiddenOutcome },
        { label: `${candidate.id}.eventSummary`, text: candidate.stateDelta.eventSummary },
        ...candidate.npcReactions.map((reaction, index) => ({
          label: `${candidate.id}.npcReaction.${index + 1}`,
          text: reaction.reaction,
        })),
        ...candidate.milestoneSignals.map((signal, index) => ({
          label: `${candidate.id}.milestoneSignal.${index + 1}`,
          text: signal.signal,
        })),
      ]),
    ],
  }).map((message) => ({
    code: "OUTPUT_LANGUAGE_MISMATCH",
    message,
  }));
}

function resolveWorldPromptStyle(providerLabel: string): WorldPromptStyle {
  if (process.env.XMOCHA_WORLD_PROMPT_STYLE === "full") return "full";
  if (process.env.XMOCHA_WORLD_PROMPT_STYLE === "lite") return "lite";
  return /Hugging Face Router|Gemma 4|Ollama/i.test(providerLabel) ? "lite" : "full";
}

function hydrateLiteWorldTurn(params: {
  lite: LiteWorldTurnResult;
  pack: WorldPack;
  state: WorldRuntimeState;
  language?: "zh-CN" | "en";
}): WorldTurnResult {
  const base = buildFallbackWorldTurn(params.pack, params.state, params.language);
  const useChinese = (params.language ?? params.pack.language) !== "en";
  const byId = new Map<string, LiteWorldTurnResult["candidates"][number]>(
    params.lite.candidates.map((candidate) => [candidate.id, candidate]),
  );

  return {
    ...base,
    turnNumber: params.lite.turnNumber,
    stateRevision: params.lite.stateRevision,
    visibleScene: params.lite.visibleScene,
    candidates: base.candidates.map((candidate) => {
      const text = byId.get(candidate.id);
      if (!text) return candidate;
      if (shouldPreferProgressiveFallbackText(text, candidate, params.state, useChinese)) {
        return candidate;
      }

      return {
        ...candidate,
        actionTitle: text.actionTitle,
        visibleCue: text.visibleCue,
        hiddenOutcome: text.hiddenOutcome,
        stateDelta: {
          ...candidate.stateDelta,
          eventSummary: text.eventSummary,
        },
        milestoneSignals: candidate.milestoneSignals.map((signal) => ({
          ...signal,
          signal: text.eventSummary,
        })),
      };
    }),
  };
}

async function withWorldGenerationTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new WorldGenerationTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function buildRun(params: {
  params: { sessionId: string; pack: WorldPack; state: WorldRuntimeState };
  attempt: number;
  startedAt: string;
  durationMs: number;
  status: TurnRun["status"];
  validationIssueCodes: string[];
  fallbackUsed: boolean;
  retryReason?: string;
  providerLabel: string;
  modelLabel: string;
  promptStyle: WorldPromptStyle;
  result?: WorldTurnResult;
}): TurnRun {
  const candidateStatePreviews = params.result
    ? params.result.candidates.map((candidate) =>
        previewWorldCandidateState(candidate, params.params.state),
      )
    : [];
  const nodes = buildTraceNodes({
    result: params.result,
    startedAt: params.startedAt,
    durationMs: params.durationMs,
    status: params.status,
    validationIssueCodes: params.validationIssueCodes,
    fallbackUsed: params.fallbackUsed,
    candidateStatePreviews,
    retryReason: params.retryReason,
  });
  return {
    traceId: randomUUID(),
    sessionId: params.params.sessionId,
    turn: params.params.state.turn + 1,
    attempt: params.attempt,
    mode: "world",
    worldPackId: params.params.pack.worldPackId,
    worldPackVersion: params.params.pack.version,
    promptVersion: WORLD_TURN_PROMPT_VERSION,
    promptStyle: params.promptStyle,
    provider: params.fallbackUsed ? "deterministic-fallback" : params.providerLabel,
    model: params.fallbackUsed ? "none" : params.modelLabel,
    activeCharacterIds: [...params.params.state.activeCharacterIds],
    groundingFactIds: [
      ...new Set(params.result?.candidates.flatMap((candidate) => candidate.groundingFactIds) ?? []),
    ],
    revisionBefore: params.params.state.revision,
    startedAt: params.startedAt,
    durationMs: Math.round(params.durationMs),
    status: params.status,
    validationIssueCodes: params.validationIssueCodes,
    retryReason: params.retryReason,
    fallbackUsed: params.fallbackUsed,
    nodes,
    candidateStatePreviews,
  };
}

function buildTraceNodes(params: {
  result?: WorldTurnResult;
  startedAt: string;
  durationMs: number;
  status: TurnRun["status"];
  validationIssueCodes: string[];
  fallbackUsed: boolean;
  candidateStatePreviews: CandidateStatePreview[];
  retryReason?: string;
}): AgentTraceNode[] {
  const rootId = "context-builder";
  const simulatorId = params.fallbackUsed ? "fallback" : "turn-simulator";
  const validatorStatus = params.validationIssueCodes.length === 0 ? "success" : "failed";
  const candidateIds = params.result?.candidates.map((candidate) => candidate.id) ?? [];
  const base: AgentTraceNode[] = [
    traceNode({
      nodeId: rootId,
      kind: "context_builder",
      status: "success",
      outputRefs: ["worldPack", "runtimeState", "activeCharacters", "relevantFacts"],
      startedAt: params.startedAt,
      durationMs: 0,
    }),
    traceNode({
      nodeId: "planner",
      parentNodeId: rootId,
      kind: "planner",
      status: "success",
      inputRefs: ["currentMilestone", "recentEvents", "worldPressure"],
      outputRefs: ["candidateRequirements"],
      startedAt: params.startedAt,
      durationMs: 0,
    }),
    traceNode({
      nodeId: simulatorId,
      parentNodeId: "planner",
      kind: params.fallbackUsed ? "fallback" : "turn_simulator",
      status: params.status === "success" || params.status === "fallback" ? "success" : "failed",
      inputRefs: ["worldTurnPrompt"],
      outputRefs: candidateIds,
      startedAt: params.startedAt,
      durationMs: params.durationMs,
      issueCodes: params.retryReason ? [params.retryReason] : [],
    }),
    traceNode({
      nodeId: "validator",
      parentNodeId: simulatorId,
      kind: "validator",
      status: validatorStatus,
      inputRefs: candidateIds,
      outputRefs: params.validationIssueCodes.length === 0 ? ["validatedWorldTurn"] : [],
      startedAt: params.startedAt,
      durationMs: 0,
      issueCodes: params.validationIssueCodes,
    }),
  ];

  const candidateNodes = candidateIds.map((candidateId) =>
    traceNode({
      nodeId: `candidate-${candidateId}`,
      parentNodeId: "validator",
      kind: "candidate",
      status: validatorStatus,
      inputRefs: ["validatedWorldTurn"],
      outputRefs: [`preview-${candidateId}`],
      startedAt: params.startedAt,
      durationMs: 0,
      issueCodes: params.validationIssueCodes,
    }),
  );
  const previewNodes = params.candidateStatePreviews.map((preview) =>
    traceNode({
      nodeId: `preview-${preview.candidateId}`,
      parentNodeId: `candidate-${preview.candidateId}`,
      kind: "state_preview",
      status: "success",
      inputRefs: [preview.candidateId, `revision-${preview.parentRevision}`],
      outputRefs: [`preview-revision-${preview.previewRevision}`],
      startedAt: params.startedAt,
      durationMs: 0,
    }),
  );
  return [...base, ...candidateNodes, ...previewNodes];
}

function traceNode(params: {
  nodeId: string;
  parentNodeId?: string;
  kind: AgentTraceNode["kind"];
  status: AgentTraceNode["status"];
  inputRefs?: string[];
  outputRefs?: string[];
  startedAt: string;
  durationMs: number;
  issueCodes?: string[];
}): AgentTraceNode {
  return {
    nodeId: params.nodeId,
    parentNodeId: params.parentNodeId,
    kind: params.kind,
    status: params.status,
    inputRefs: params.inputRefs ?? [],
    outputRefs: params.outputRefs ?? [],
    startedAt: params.startedAt,
    durationMs: Math.round(params.durationMs),
    issueCodes: params.issueCodes ?? [],
  };
}

function buildFallbackWorldTurn(
  pack: WorldPack,
  state: WorldRuntimeState,
  language?: "zh-CN" | "en",
): WorldTurnResult {
  const useChinese = (language ?? pack.language) !== "en";
  const active = state.activeCharacterIds.slice(0, 3);
  const npcCards = active
    .map((id) => pack.characters.find((character) => character.id === id))
    .filter((character): character is NonNullable<typeof character> => Boolean(character))
    .slice(0, 2);
  const factIds = pack.canonFacts.slice(0, 3).map((fact) => fact.id);
  const milestone = state.milestones.find((item) => item.status === "active")
    ?? state.milestones.at(-1);
  const templates = fallbackTemplates({ pack, useChinese, milestoneId: milestone?.id, state });

  return {
    turnNumber: state.turn + 1,
    stateRevision: state.revision,
    visibleScene: fallbackVisibleScene({ pack, state, useChinese }),
    candidates: templates.map((template, index) => ({
      id: `b${index + 1}`,
      actionTitle: template.title,
      visibleCue: template.cue,
      hiddenOutcome: template.outcome,
      riskLabel: template.risk,
      requiredCapabilities: [],
      participatingCharacterIds: npcCards.map((character) => character.id),
      npcReactions: npcCards.flatMap((character, npcIndex) =>
        character.knownFactIds[0]
          ? [{
              characterId: character.id,
              stance: template.risk === "high"
                ? "resistant" as const
                : npcIndex === 0 ? "supportive" as const : "uncertain" as const,
              reaction: useChinese
                ? `${character.name}根据自己掌握的情况，对“${template.title}”表现出${template.risk === "high" ? "戒备" : "有限配合"}。`
                : `${character.name} shows ${template.risk === "high" ? "caution" : "limited support"} for “${template.title}” based on known facts.`,
              usedFactIds: [character.knownFactIds[0]],
            }]
          : [],
      ),
      stateDelta: {
        activeCharacterIds: active,
        relationshipDeltas: npcCards.flatMap((character) =>
          state.relationships.some((relationship) =>
            relationship.sourceCharacterId === state.playerCharacter.characterId
            && relationship.targetCharacterId === character.id)
            ? [{
                sourceCharacterId: state.playerCharacter.characterId,
                targetCharacterId: character.id,
                affinityDelta: template.affinity,
                tensionDelta: template.tension,
              }]
            : [],
        ),
        characterDeltas: npcCards.map((character) => ({
          characterId: character.id,
          attitudeDelta: template.affinity,
          addKnownFlags: [`observed-${template.risk}-turn-${state.turn + 1}`],
        })),
        addWorldFlags: [`turn-${state.turn + 1}-${template.risk}`],
        removeWorldFlags: [],
        eventSummary: template.event,
      },
      milestoneSignals: milestone
        ? [
            {
              milestoneId: milestone.id,
              signal: template.event,
              proposedStatus:
                state.turn >= 1 && template.risk !== "low" ? "achieved" : "active",
            },
          ]
        : [],
      groundingFactIds: [
        ...new Set([
          factIds[index % factIds.length] ?? pack.canonFacts[0]!.id,
          ...npcCards.flatMap((character) => character.knownFactIds.slice(0, 1)),
        ]),
      ],
    })),
  };
}

function fallbackVisibleScene(params: {
  pack: WorldPack;
  state: WorldRuntimeState;
  useChinese: boolean;
}): string {
  const event = currentPressureEvent(params.state);
  const recent = params.state.recentEvents.at(-1) ?? params.pack.openingScenario.event;
  if (!event) return recent;

  if (params.useChinese) {
    const status = event.status === "active"
      ? "正在发酵"
      : event.status === "scheduled"
        ? "即将逼近"
        : event.status === "resolved"
          ? "已有结果"
          : "已经错过";
    return `${recent} 同时，${event.description}（${status}）。`;
  }

  const status = event.status === "active"
    ? "active"
    : event.status === "scheduled"
      ? "approaching"
      : event.status;
  return `${recent} Meanwhile, ${event.description} (${status}).`;
}

function currentPressureEvent(state: WorldRuntimeState): WorldEvent | undefined {
  return (state.eventQueue ?? [])
    .filter((event) =>
      event.status === "active" ||
      (event.status === "scheduled" && (
        event.dueTurn === undefined ||
        event.dueTurn <= state.turn + 1
      )),
    )
    .sort((a, b) => {
      const statusWeight = (event: WorldEvent): number =>
        event.status === "active" ? 2 : event.status === "scheduled" ? 1 : 0;
      return statusWeight(b) - statusWeight(a) || b.severity - a.severity;
    })[0];
}

type FallbackTemplate = {
  title: string;
  cue: string;
  outcome: string;
  event: string;
  risk: "low" | "medium" | "high";
  affinity: number;
  tension: number;
};

type FallbackStage = "understand" | "align" | "resolve" | "consequence";

function fallbackStage(
  state: WorldRuntimeState,
  milestoneId: string | undefined,
): FallbackStage {
  if (hasEnteredConsequencePhase(state)) return "consequence";
  if (state.turn >= 2 || milestoneId?.includes("resolve")) return "resolve";
  if (state.turn >= 1 || milestoneId?.includes("align")) return "align";
  return "understand";
}

function hasEnteredConsequencePhase(state: WorldRuntimeState): boolean {
  const recentText = state.recentEvents.join(" ");
  const highRiskTurns = state.worldFlags.filter((flag) => /-high$/.test(flag)).length;
  const resistantCharacters = state.characterStates.filter(
    (character) => character.attitude <= -2,
  ).length;
  return (
    (state.turn >= 1 && highRiskTurns > 0) ||
    (state.turn >= 2 &&
    (
      resistantCharacters > 0 ||
      /当众|质问|追问|发难|摊牌|孤立|反制|public|confront|challenge|retaliat/i.test(recentText)
    ))
  );
}

function shouldPreferProgressiveFallbackText(
  text: LiteWorldTurnResult["candidates"][number],
  candidate: WorldCandidate,
  state: WorldRuntimeState,
  useChinese: boolean,
): boolean {
  if (!hasEnteredConsequencePhase(state)) return false;
  const value = `${text.actionTitle} ${text.visibleCue} ${text.eventSummary}`;
  if (useChinese) {
    if (/质问|追问|发难|当众表明|搭话试探|退避观察|暗察局势/.test(value)) {
      return true;
    }
  } else if (/confront|demand|question again|press again|watch and wait|step back and observe/i.test(value)) {
    return true;
  }

  return candidate.riskLabel === "high" && /问|question|demand/i.test(value);
}

function odysseyFallbackTemplates(stage: FallbackStage, useChinese: boolean): FallbackTemplate[] {
  if (useChinese) {
    if (stage === "align") return [
      { title: "约束船员沉默", cue: "让幸存船员复述计划、假名和不能出声的时机。", outcome: "恐慌被压成共同节奏，但船员对奥德修斯的信任仍然紧绷。", event: "船员把恐惧变成可执行的洞内计划。", risk: "low", affinity: 1, tension: -1 },
      { title: "献酒并说无人", cue: "把烈酒递给波吕斐摩斯，同时让“无人”这个名字进入他的醉意。", outcome: "巨人的食欲变成弱点，但整套计划押在一个脆弱谎言上。", event: "烈酒和假名打开第一道真正逃生窗口。", risk: "medium", affinity: 1, tension: 0 },
      { title: "立刻刺下橄榄木桩", cue: "趁波吕斐摩斯睡去，用削尖木桩行动，不等恐惧拖垮船员。", outcome: "独眼巨人失明，洞穴陷入混乱，后续都进入危机时机。", event: "橄榄木桩刺瞎巨人，陷阱变成洞口时机问题。", risk: "high", affinity: -1, tension: 2 },
    ];
    if (stage === "resolve") return [
      { title: "随羊群静默离开", cue: "让幸存者藏在羊腹下，禁止任何人在船安全前夸口。", outcome: "船员带着较少损失抵达岸边，但英雄故事暂时仍无真名。", event: "羊群逃脱靠沉默和纪律成功。", risk: "low", affinity: 1, tension: -1 },
      { title: "黎明前向船示警", cue: "借羊群出洞的机会和岸边瞭望者配合，先把船移出石块射程。", outcome: "船开始离岸，但波吕斐摩斯仍知道敌人逃走并可能诅咒。", event: "岸边时机把洞穴逃生变成争分夺秒的离岸。", risk: "medium", affinity: 1, tension: 0 },
      { title: "以真名认领功绩", cue: "告诉波吕斐摩斯是谁刺瞎了他，同时承受名声和神怒风险。", outcome: "奥德修斯赢得故事，波塞冬的未来压力也进入归途。", event: "真名固定荣耀，也把海上诅咒召入章节结局。", risk: "high", affinity: -1, tension: 2 },
    ];
    return [
      { title: "盘点洞穴约束", cue: "先观察巨石、羊群、储物和独眼巨人的习惯，再决定是否动武。", outcome: "你看清单靠蛮力会困死所有人，局势获得一点清晰度。", event: "洞穴被看成巨石、时机和食欲构成的问题。", risk: "low", affinity: 0, tension: -1 },
      { title: "谨慎请求客礼", cue: "援引宙斯与待客之礼，同时隐藏你对洞口巨石的恐惧。", outcome: "波吕斐摩斯蔑视客礼，冲突的道德形状变清楚。", event: "客礼请求失败，但违礼让船员有了反抗理由。", risk: "medium", affinity: 0, tension: 1 },
      { title: "趁主人未返抢物资", cue: "听从船员最初冲动，试图带走奶酪和牲畜回船。", outcome: "你得到物资，也冒着还没看清洞主就被堵住的风险。", event: "快速劫取测试开局由饥饿还是谨慎主导。", risk: "high", affinity: -1, tension: 1 },
    ];
  }

  if (stage === "align") return [
    { title: "Bind the crew to silence", cue: "Make the surviving men rehearse the plan, the false name, and the moment nobody may speak.", outcome: "Crew panic settles into shared timing, though trust in Odysseus remains strained.", event: "The crew turns fear into a coordinated cave plan.", risk: "low", affinity: 1, tension: -1 },
    { title: "Offer wine and Noman", cue: "Give Polyphemus the strong wine while letting the name Noman settle into his drunken memory.", outcome: "The Cyclops' appetite becomes vulnerability, but the whole plan depends on one fragile lie.", event: "Wine and the false name open the first real escape window.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Drive the olive stake now", cue: "Use the sharpened stake while Polyphemus sleeps, before fear breaks the crew's nerve.", outcome: "The Cyclops is blinded and the cave erupts, forcing every later move into crisis timing.", event: "The olive stake blinds Polyphemus and changes the trap into a threshold problem.", risk: "high", affinity: -1, tension: 2 },
  ];
  if (stage === "resolve") return [
    { title: "Leave under the flock quietly", cue: "Keep every survivor hidden beneath the sheep and forbid any boast until the ship is clear.", outcome: "The crew reaches the shore with fewer losses, but the heroic story stays unnamed for now.", event: "The sheepfold escape succeeds through silence and discipline.", risk: "low", affinity: 1, tension: -1 },
    { title: "Signal the ship before dawn", cue: "Use the sheepfold exit to coordinate with the lookout and move the ship before stones find it.", outcome: "The ship gets moving, though Polyphemus still learns enough to curse the sea path.", event: "Shore timing turns cave escape into a contested launch.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Claim the deed by name", cue: "Tell Polyphemus who blinded him and accept the fame and divine risk together.", outcome: "Odysseus wins the story, but Poseidon's future pressure becomes part of the voyage.", event: "The true name fixes glory and calls a sea curse into the chapter ending.", risk: "high", affinity: -1, tension: 2 },
  ];
  return [
    { title: "Count the cave's constraints", cue: "Study the boulder, flock, stores, and Cyclops habits before choosing violence.", outcome: "You identify why simple force will trap everyone, buying a little clarity.", event: "The cave is mapped as a problem of stone, timing, and appetite.", risk: "low", affinity: 0, tension: -1 },
    { title: "Press guest-right carefully", cue: "Invoke Zeus and hospitality while hiding how much you fear the stone at the entrance.", outcome: "Polyphemus reveals contempt for guest-law and exposes the moral shape of the conflict.", event: "Guest-right fails, but the violation gives the crew a reason to resist.", risk: "medium", affinity: 0, tension: 1 },
    { title: "Seize supplies before he returns", cue: "Act on the crew's first instinct and try to carry cheese and animals back to the ship.", outcome: "You gain resources but risk being caught before the cave's owner is understood.", event: "A fast raid tests whether hunger or caution rules the opening move.", risk: "high", affinity: -1, tension: 1 },
  ];
}

function odysseyConsequenceTemplates(
  state: WorldRuntimeState,
  useChinese: boolean,
): FallbackTemplate[] {
  const highRiskTurns = state.worldFlags.filter((flag) => /-high$/.test(flag)).length;
  const depth = Math.max(highRiskTurns, state.turn - 1);

  if (useChinese) {
    if (depth <= 1) {
      return [
        { title: "重建船员胆气", cue: "阻止众人四散，重复下一步必须安静完成的动作。", outcome: "恐慌降低到足以协作，但死伤带来的怨气仍接近哗变。", event: "船员纪律被恢复到足以继续逃生。", risk: "low", affinity: 1, tension: -1 },
        { title: "让呼喊反噬巨人", cue: "让波吕斐摩斯喊出“无人”伤他，使邻近独眼巨人误会。", outcome: "邻居误解危险，为你争取时间，但洞内混乱更响。", event: "“无人”诡计把求救声变成误导。", risk: "medium", affinity: 1, tension: 0 },
        { title: "穿过失明怒火", cue: "在伤口后的危机中推进计划，不给波吕斐摩斯适应时间。", outcome: "你获得速度，但每个幸存者都处在巨人的怒火里。", event: "失明怒火把洞穴压缩成一条危险逃路。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    if (depth === 2) {
      return [
        { title: "演练羊腹藏身", cue: "把每个幸存者分配到一只羊下，在洞口前测试沉默。", outcome: "逃生变得具体，但行动慢的人仍可能暴露。", event: "羊群计划把恐惧变成可执行出口。", risk: "low", affinity: 1, tension: -1 },
        { title: "让老公羊载奥德修斯", cue: "把最危险的负担交给巨人熟悉的老公羊，催促船员继续移动。", outcome: "奥德修斯有了出路，但计划依赖波吕斐摩斯相信习惯。", event: "老公羊成为洞穴与海岸之间的关键。", risk: "medium", affinity: 1, tension: 1 },
        { title: "引开洞口摸索", cue: "制造一声假响，让巨人的手离开羊群一瞬。", outcome: "缝隙打开，但波吕斐摩斯几乎摸出规律。", event: "洞口诱导险些把出口撕开。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    return [
      { title: "不夸口直接离岸", cue: "让岸上众人奋力划船，阻止奥德修斯报出真名。", outcome: "船更干净地逃离，但功绩仍藏在“无人”背后。", event: "章节以沉默保护生还收束。", risk: "low", affinity: 1, tension: -1 },
      { title: "警戒石块并划走", cue: "由瞭望者报出距离，船员划出波吕斐摩斯投石范围。", outcome: "船躲过石块，但巨人仍知道敌人逃脱。", event: "有纪律的离岸把船带出洞穴射程。", risk: "medium", affinity: 1, tension: 0 },
      { title: "承担真名与诅咒", cue: "让奥德修斯认领功绩，并让船员准备承受神明后果。", outcome: "故事属于奥德修斯，波塞冬的怒意进入归海之路。", event: "荣耀与诅咒绑定在一起，章节结束。", risk: "high", affinity: -1, tension: 2 },
    ];
  }

  if (depth <= 1) {
    return [
      { title: "Rebuild crew nerve", cue: "Stop the men from scattering and repeat the next quiet step.", outcome: "Panic drops enough for a coordinated move, but grief remains close to mutiny.", event: "Crew discipline is restored just enough to continue the escape.", risk: "low", affinity: 1, tension: -1 },
      { title: "Turn his cry against him", cue: "Let Polyphemus shout Noman's name while the neighboring Cyclopes listen.", outcome: "The neighbors misunderstand the danger, buying time at the cost of louder chaos.", event: "The Noman trick converts a cry for help into confusion.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Push through the blinded rage", cue: "Use the crisis after the wound to force the plan forward before Polyphemus adapts.", outcome: "You gain momentum, but every survivor is now inside the Cyclops' rage.", event: "Blinded rage narrows the cave into one dangerous escape path.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  if (depth === 2) {
    return [
      { title: "Practice the sheep concealment", cue: "Assign each survivor to an animal and test silence before the threshold.", outcome: "The escape becomes concrete, though slower men may still be left exposed.", event: "The flock plan changes fear into a physical exit method.", risk: "low", affinity: 1, tension: -1 },
      { title: "Use the old ram for Odysseus", cue: "Put the riskiest burden under the trusted ram and keep the crew moving.", outcome: "Odysseus has a path out, but the plan depends on Polyphemus trusting habit.", event: "The old ram becomes the hinge between cave and shore.", risk: "medium", affinity: 1, tension: 1 },
      { title: "Draw Polyphemus from the threshold", cue: "Create a noise or false cue that pulls his hands away from the flock for one breath.", outcome: "A gap opens, but the Cyclops nearly catches the pattern.", event: "A threshold distraction almost breaks the cave open.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  return [
    { title: "Sail without boasting", cue: "Make the shore party row hard and keep Odysseus from revealing his name.", outcome: "The ship escapes cleaner, but the deed remains hidden behind Noman.", event: "The chapter closes with survival protected by silence.", risk: "low", affinity: 1, tension: -1 },
    { title: "Warn and row through stones", cue: "Let the lookout call range while the crew rows beyond Polyphemus' throws.", outcome: "The ship survives the stones, though the Cyclops still knows enemies escaped.", event: "A disciplined launch carries the crew beyond the cave's reach.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Own the name and curse", cue: "Let Odysseus claim the deed and prepare the crew for divine consequence.", outcome: "The story belongs to Odysseus, and Poseidon's anger enters the sea road home.", event: "Glory and curse bind together as the chapter ends.", risk: "high", affinity: -1, tension: 2 },
  ];
}

function mythicFallbackTemplates(params: {
  pack: WorldPack;
  useChinese: boolean;
  stage: FallbackStage;
}): FallbackTemplate[] {
  if (params.pack.worldPackId === "odyssey-cyclops-v1") {
    return odysseyFallbackTemplates(params.stage, params.useChinese);
  }

  if (params.useChinese) {
    if (params.stage === "align") return [
      { title: "约定取木限度", cue: "先向山灵说明每次取木石的边界，让誓愿不变成无度消耗。", outcome: "山林暂时松动，愿意把一条可持续的取材路线显出来。", event: "取材边界被说清，山林从戒备转为有限配合。", risk: "low", affinity: 1, tension: -1 },
      { title: "以祭告换见证", cue: "请祭者和旅人共同记下女娃之名，让誓愿从孤鸣变成可传的话。", outcome: "见证者开始聚拢，但誓愿也被仪式规则约束。", event: "祭告让女娃之名被听见，也带来新的仪式代价。", risk: "medium", affinity: 1, tension: 0 },
      { title: "当潮声前宣告女娃", cue: "迎着潮使说出女娃溺海之事，逼东海回应这个名字。", outcome: "东海无法完全沉默，但潮压立刻升高。", event: "女娃之名被公开推向海潮，东海阻力随之抬升。", risk: "high", affinity: -1, tension: 2 },
    ];
    if (params.stage === "resolve") return [
      { title: "立下可续之径", cue: "把路线、木石和见证者安排成下一次仍能重复的秩序。", outcome: "填海未完成，但誓愿得到可以延续的形状。", event: "一条可续的山海路线固定下来。", risk: "low", affinity: 1, tension: -1 },
      { title: "让山海共同记名", cue: "要求山守、潮使和祭者各自承认女娃之名的一部分。", outcome: "多方都留下记号，但每一方都附带自己的条件。", event: "女娃之名进入山、海与见证者的共同记忆。", risk: "medium", affinity: 1, tension: 0 },
      { title: "把木石投向海渊", cue: "不再投向浅潮，而是把最重的木石直接推向海渊边界。", outcome: "海渊被迫回应，精卫也承受最强记忆反噬。", event: "木石触及海渊，誓愿换来清楚回应和沉重代价。", risk: "high", affinity: -1, tension: 2 },
    ];
    return [
      { title: "辨认山海征兆", cue: "先听鸟鸣、叶声和潮声，判断哪一种力量正在逼近。", outcome: "你确认了第一股阻力来自哪里，避免过早惊动海潮。", event: "山海征兆被辨认出来，第一处压力有了方向。", risk: "low", affinity: 0, tension: -1 },
      { title: "请求山灵借路", cue: "向山守和木石之灵说明誓愿，换取一条通向海岸的路。", outcome: "山灵愿意试探性让路，但要求你承认取材代价。", event: "山灵借出一条路，也把取材代价摆到明处。", risk: "medium", affinity: 1, tension: 0 },
      { title: "直向海潮投石", cue: "不等各方同意，直接把第一块石投向东海。", outcome: "海潮立刻回应，见证者也开始判断这是不是徒劳。", event: "第一块石触动海潮，誓愿和阻力同时变得可见。", risk: "high", affinity: -1, tension: 1 },
    ];
  }

  if (params.stage === "align") return [
    { title: "Set a gathering limit", cue: "Define how much wood and stone can be taken so the vow does not become endless extraction.", outcome: "The mountain relaxes slightly and reveals a sustainable route.", event: "Resource boundaries turn mountain caution into limited cooperation.", risk: "low", affinity: 1, tension: -1 },
    { title: "Trade ritual for witness", cue: "Ask ritualists and travelers to record Nüwa's name so the vow is no longer a lone cry.", outcome: "Witnesses gather, while ritual rules begin to bind the vow.", event: "Ritual makes Nüwa's name audible and creates a new cost.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Name Nüwa before the tide", cue: "Speak the drowning openly to force the East Sea to answer the name.", outcome: "The sea cannot stay fully silent, but tide pressure rises at once.", event: "Nüwa's name reaches the tide and raises sea resistance.", risk: "high", affinity: -1, tension: 2 },
  ];
  if (params.stage === "resolve") return [
    { title: "Fix a repeatable route", cue: "Arrange route, material, and witnesses so the next flight can continue.", outcome: "The sea is not filled, but the vow gains a durable shape.", event: "A repeatable mountain-to-sea route is fixed.", risk: "low", affinity: 1, tension: -1 },
    { title: "Make mountain and sea remember", cue: "Ask keeper, tide envoy, and ritualist to each acknowledge part of Nüwa's name.", outcome: "All sides leave marks, each with conditions.", event: "Nüwa's name enters shared mountain, sea, and witness memory.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Cast stones into the depth", cue: "Stop throwing at shallow tide and push the heaviest stone toward the sea-depth threshold.", outcome: "The deep sea answers, and Jingwei bears the strongest memory backlash.", event: "Wood and stone touch the depth, winning an answer at heavy cost.", risk: "high", affinity: -1, tension: 2 },
  ];
  return [
    { title: "Read the omens", cue: "Listen to bird cry, leaf noise, and tide to learn which force is approaching.", outcome: "You identify the first pressure without waking the full sea.", event: "Mountain and sea signs reveal the first direction of pressure.", risk: "low", affinity: 0, tension: -1 },
    { title: "Ask the mountain for passage", cue: "Explain the vow to the keeper and spirits to win a road toward the shore.", outcome: "The mountain gives a trial path and asks you to name the cost.", event: "A mountain road opens, while the cost of taking material becomes visible.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Throw stone at the tide", cue: "Do not wait for consensus; cast the first stone directly into the East Sea.", outcome: "The tide answers immediately and witnesses judge whether the act is futile.", event: "The first stone wakes the tide; vow and resistance become visible together.", risk: "high", affinity: -1, tension: 1 },
  ];
}

function mythicConsequenceTemplates(params: {
  pack: WorldPack;
  useChinese: boolean;
  state: WorldRuntimeState;
}): FallbackTemplate[] {
  if (params.pack.worldPackId === "odyssey-cyclops-v1") {
    return odysseyConsequenceTemplates(params.state, params.useChinese);
  }

  const highRiskTurns = params.state.worldFlags.filter((flag) => /-high$/.test(flag)).length;
  const depth = Math.max(highRiskTurns, params.state.turn - 1);

  if (params.useChinese) {
    if (depth <= 1) {
      return [
        { title: "退回山路稳住木石", cue: "暂不再冲海，先让山路和木石不被潮声吓散。", outcome: "山林压力下降，你也看清谁愿意继续见证。", event: "誓愿退回山路整理，新的见证线索浮出。", risk: "low", affinity: 0, tension: -1 },
        { title: "请祭者缓冲潮怒", cue: "让祭者把冲突转成可被听见的祭告，而非单纯对抗。", outcome: "潮怒稍缓，但祭者要求你给誓愿一个可讲述的形状。", event: "祭告介入，让海潮对抗变成有代价的调停。", risk: "medium", affinity: 1, tension: 0 },
        { title: "承受潮反逼其回应", cue: "接住海潮反击，不再解释，只逼东海留下回应。", outcome: "东海回击更重，但女娃之名也无法再被完全吞回。", event: "潮反落到精卫身上，冲突进入后果阶段。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    if (depth === 2) {
      return [
        { title: "保存木石痕迹", cue: "先保住被潮水冲散前留下的木石位置和见证话语。", outcome: "证据让誓愿不再只是传闻，但推进速度变慢。", event: "木石痕迹留下，冲突从潮怒转向见证争夺。", risk: "low", affinity: 0, tension: -1 },
        { title: "拉旅人共同作证", cue: "让采木人和祭者同时说明自己所见，扩大判断场。", outcome: "见证者愿意开口，也把凡人的恐惧带入局面。", event: "新见证加入，山海关系开始重新排列。", risk: "medium", affinity: 1, tension: 1 },
        { title: "点明海渊代价", cue: "说清东海吞没的不只是木石，还有女娃之名。", outcome: "海渊压力露出一角，精卫也被推到更难退的位置。", event: "海渊代价被点明，深处压力第一次变得可见。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    return [
      { title: "保留誓愿退潮", cue: "承认本轮未能推进海岸，但保住下一次衔木的路。", outcome: "精卫带着损失离开潮线，但誓愿没有断裂。", event: "章节以保留誓愿的退潮收束。", risk: "low", affinity: 0, tension: -1 },
      { title: "定下山海交换", cue: "用一次明确祭告换取山材和潮线的暂时承认。", outcome: "冲突得到暂时安排，未来债务也被写进山海。", event: "一项山海交换固定了结果和未来债务。", risk: "medium", affinity: 1, tension: 0 },
      { title: "公开承担填海代价", cue: "接受潮声、山损和见证压力，把答案钉在女娃之名上。", outcome: "誓愿被固定下来，精卫也成为众人记住代价的人。", event: "填海代价公开落定，章节清楚收束。", risk: "high", affinity: -1, tension: 2 },
    ];
  }

  if (depth <= 1) {
    return [
      { title: "Return to the mountain path", cue: "Stop pressing the sea and steady the route and materials first.", outcome: "Mountain pressure falls, and you see who will keep witnessing.", event: "The vow returns to the mountain path and surfaces a witness clue.", risk: "low", affinity: 0, tension: -1 },
      { title: "Let ritual buffer the tide", cue: "Turn confrontation into a rite that can be heard.", outcome: "Tide anger eases, but the ritualist asks for a story-shaped vow.", event: "Ritual turns sea confrontation into costly mediation.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Absorb the tide backlash", cue: "Take the sea's counterblow and force it to leave an answer.", outcome: "The sea hits harder, but Nüwa's name cannot be swallowed whole.", event: "Tide backlash moves the conflict into consequences.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  if (depth === 2) {
    return [
      { title: "Preserve traces of wood and stone", cue: "Record what remains before the tide scatters it.", outcome: "Evidence keeps the vow from becoming rumor, but slows progress.", event: "Traces shift the conflict from tide anger to witness claims.", risk: "low", affinity: 0, tension: -1 },
      { title: "Bring travelers as witnesses", cue: "Ask gatherer and ritualist to testify together.", outcome: "Witnesses speak, and mortal fear enters the scene.", event: "New witnesses rearrange the mountain-sea relationship map.", risk: "medium", affinity: 1, tension: 1 },
      { title: "Name the depth's cost", cue: "Say the sea swallowed not only wood and stone, but Nüwa's name.", outcome: "The deep pressure shows itself and narrows Jingwei's retreat.", event: "The cost of the depth becomes visible.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  return [
    { title: "Withdraw with the vow intact", cue: "Accept this tide's loss while keeping the next flight possible.", outcome: "Jingwei leaves the tide line damaged, but the vow is unbroken.", event: "The chapter closes with the vow intact.", risk: "low", affinity: 0, tension: -1 },
    { title: "Fix a mountain-sea exchange", cue: "Trade a clear rite for temporary recognition from material and tide.", outcome: "The conflict is arranged for now, and future debt remains.", event: "A mountain-sea exchange fixes result and debt.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Own the cost of filling the sea", cue: "Accept tide, mountain loss, and witness pressure to fix the answer to Nüwa's name.", outcome: "The vow is fixed, and Jingwei is remembered as the bearer of its cost.", event: "The cost of filling the sea lands publicly and closes the chapter.", risk: "high", affinity: -1, tension: 2 },
  ];
}

function consequenceTemplates(params: {
  pack: WorldPack;
  useChinese: boolean;
  state: WorldRuntimeState;
}): FallbackTemplate[] {
  if (params.pack.worldTemplate === "mythic_exploration") {
    return mythicConsequenceTemplates(params);
  }

  const highRiskTurns = params.state.worldFlags.filter((flag) => /-high$/.test(flag)).length;
  const depth = Math.max(highRiskTurns, params.state.turn - 1);

  if (params.useChinese) {
    if (depth <= 1) {
      return [
        { title: "暂避锋芒修复体面", cue: "不再追问同一人，先收束场面并观察谁借机站队。", outcome: "局势降温，你看清一名旁观者的真实立场。", event: "暂避锋芒后，新的站队线索浮出水面。", risk: "low", affinity: 0, tension: -1 },
        { title: "请旁人居中缓冲", cue: "把冲突交给第三方转圜，测试是否还能保住关系余地。", outcome: "第三方愿意传话，但也要求你付出体面上的让步。", event: "第三方介入，让对抗转为一场有代价的调停。", risk: "medium", affinity: 1, tension: 0 },
        { title: "承受反制迫其摊牌", cue: "不再重复质问，而是接住对方反制，逼出下一层代价。", outcome: "对方借势回击，你获得明确答案，也被更多人记住。", event: "公开反制落到你身上，冲突进入后果阶段。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    if (depth === 2) {
      return [
        { title: "保住退路收集旁证", cue: "先保存能自证的线索，避免被对方一句话定性。", outcome: "旁证让你的处境不再完全被动，但推进速度变慢。", event: "旁证出现，冲突从情绪对抗转向事实争夺。", risk: "low", affinity: 0, tension: -1 },
        { title: "拉入新证人作保", cue: "请一个新角色见证局势，把单线冲突变成多人判断。", outcome: "新证人愿意作保，也把自己的利益带进局面。", event: "新证人入场，关系网开始重新排列。", risk: "medium", affinity: 1, tension: 1 },
        { title: "点明代价逼后台", cue: "把已经发生的代价说清，逼暗处推动者现形。", outcome: "幕后压力露出一角，你也被推到更难退的位置。", event: "代价被点明，幕后压力第一次变得可见。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    if (depth === 3) {
      return [
        { title: "收束残局保住身份", cue: "承认局部失误，保住继续行动的最低身份。", outcome: "你失去一部分主动权，但避免被彻底逐出局面。", event: "身份被保住，行动空间缩小但没有消失。", risk: "low", affinity: 0, tension: -1 },
        { title: "交换认错换余地", cue: "用一次明确让步换取继续谈判的余地。", outcome: "对方接受让步，却把新条件写进关系账本。", event: "认错换来余地，也生成一笔新的人情债。", risk: "medium", affinity: 1, tension: 0 },
        { title: "逼众人作最终判断", cue: "把事实和代价同时摆出，让在场人无法继续含糊。", outcome: "阵营被迫分明，你得到结果，也失去缓冲。", event: "众人被迫判断，章节进入最终清算。", risk: "high", affinity: -1, tension: 2 },
      ];
    }
    return [
      { title: "保留余地退场", cue: "承认本章代价，留下将来还能回来的线索。", outcome: "你带着损失离场，但没有让所有关系彻底断裂。", event: "章节以保留余地的退场收束。", risk: "low", affinity: 0, tension: -1 },
      { title: "定下一项交换", cue: "用明确承诺换取一个可记录的结局。", outcome: "冲突得到暂时安排，后续债务也被写进世界。", event: "一项交换固定了结果和未来债务。", risk: "medium", affinity: 1, tension: 0 },
      { title: "公开承担最终代价", cue: "接受名声与关系损失，把答案钉在明处。", outcome: "真相被固定下来，你也成为众人记住代价的人。", event: "最终代价公开落定，章节清楚收束。", risk: "high", affinity: -1, tension: 2 },
    ];
  }

  if (depth <= 1) {
    return [
      { title: "Step back and repair face", cue: "Stop pressing the same person and watch who takes sides.", outcome: "The scene cools, revealing one bystander's real stance.", event: "Stepping back surfaces a new alignment clue.", risk: "low", affinity: 0, tension: -1 },
      { title: "Ask a mediator to buffer", cue: "Move the conflict through a third party and test whether room remains.", outcome: "The mediator carries the message, but asks for a face-saving concession.", event: "A third party turns confrontation into costly mediation.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Absorb the countermove", cue: "Do not repeat the challenge; take the backlash and force the next cost into view.", outcome: "The opponent counters publicly; you get clarity and a larger reputation mark.", event: "Public backlash moves the conflict into consequences.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  if (depth === 2) {
    return [
      { title: "Preserve evidence", cue: "Keep corroborating details before the opponent defines the story.", outcome: "Evidence reduces helplessness but slows your advance.", event: "Corroboration shifts conflict from emotion to facts.", risk: "low", affinity: 0, tension: -1 },
      { title: "Bring in a witness", cue: "Make a new actor witness the scene and widen the judgment.", outcome: "The witness helps, while bringing their own interest into play.", event: "A new witness rearranges the relationship map.", risk: "medium", affinity: 1, tension: 1 },
      { title: "Name the hidden cost", cue: "State the cost already paid and force the backstage pressure into view.", outcome: "The hidden pressure shows itself, and your retreat path narrows.", event: "The cost becomes visible and reveals backstage pressure.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  if (depth === 3) {
    return [
      { title: "Keep standing", cue: "Admit a limited mistake to preserve minimum standing.", outcome: "You lose initiative but stay inside the scene.", event: "Standing survives, though room to act shrinks.", risk: "low", affinity: 0, tension: -1 },
      { title: "Trade apology for room", cue: "Make a concrete concession in exchange for continued negotiation.", outcome: "The concession is accepted and recorded as a future obligation.", event: "An apology buys room and creates a debt.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Force final judgment", cue: "Put facts and costs together so nobody can stay vague.", outcome: "Sides become clear; you gain an answer and lose buffer.", event: "The scene moves into final reckoning.", risk: "high", affinity: -1, tension: 2 },
    ];
  }
  return [
    { title: "Exit with a thread", cue: "Accept this chapter's cost while leaving one return path.", outcome: "You leave with losses, but not every relationship is broken.", event: "The chapter closes with a narrow return path.", risk: "low", affinity: 0, tension: -1 },
    { title: "Fix one exchange", cue: "Trade a clear promise for a recorded ending.", outcome: "The conflict is arranged for now, and a future debt remains.", event: "An exchange fixes both result and debt.", risk: "medium", affinity: 1, tension: 0 },
    { title: "Own the final cost", cue: "Accept reputation and relationship damage to fix the answer publicly.", outcome: "The truth is fixed, and you are remembered as the cost bearer.", event: "The final cost lands publicly and closes the chapter.", risk: "high", affinity: -1, tension: 2 },
  ];
}

function fallbackTemplates(params: {
  pack: WorldPack;
  useChinese: boolean;
  milestoneId?: string;
  state: WorldRuntimeState;
}): FallbackTemplate[] {
  const stage = fallbackStage(params.state, params.milestoneId);
  if (stage === "consequence") {
    return consequenceTemplates(params);
  }
  if (params.pack.worldTemplate === "mythic_exploration") {
    return mythicFallbackTemplates({ pack: params.pack, useChinese: params.useChinese, stage });
  }
  if (!params.useChinese) {
    if (stage === "align") return [
      { title: "Pilot shared checks", cue: "Test a limited responsibility split before changing the whole system.", outcome: "The pilot earns practical support and exposes one unresolved ownership gap.", event: "A limited pilot turns informal support into observable cooperation.", risk: "low", affinity: 1, tension: -1 },
      { title: "Trade a bounded promise", cue: "Offer a specific concession in return for accountable support.", outcome: "A key person commits resources, while the promise becomes a recorded obligation.", event: "A bounded exchange creates support and a future debt.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Publish rewards and penalties", cue: "Force every responsible person to take a visible position.", outcome: "Execution accelerates, but resistance becomes public and personal.", event: "Public incentives establish alignment at a relationship cost.", risk: "high", affinity: -1, tension: 1 },
    ];
    if (stage === "resolve") return [
      { title: "Hand over a revised procedure", cue: "Convert the chapter's lessons into a small durable operating rule.", outcome: "The immediate problem stabilizes and the rule can survive your absence.", event: "A revised procedure produces a durable but limited result.", risk: "low", affinity: 1, tension: -1 },
      { title: "Close with a human buffer", cue: "Secure the result while preserving room for face and exceptions.", outcome: "The goal advances without breaking the coalition, though one ambiguity remains.", event: "The chapter closes through a workable compromise.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Own the result publicly", cue: "Make the final decision visible and accept its political cost.", outcome: "The goal changes the world clearly, and opponents now know exactly whom to blame.", event: "A public final decision resolves the chapter and fixes its cost to your name.", risk: "high", affinity: -1, tension: 2 },
    ];
    return [
      { title: "Audit the roster", cue: "Compare named duties with what is actually happening before assigning blame.", outcome: "A mismatch reveals the first concrete source of disorder.", event: "The audit identifies a responsibility gap without escalating the conflict.", risk: "low", affinity: 0, tension: -1 },
      { title: "Compare private accounts", cue: "Ask key people separately and look for contradictions.", outcome: "Conflicting accounts expose both a hidden dependency and a possible ally.", event: "Private accounts reveal the main obstacle and shift one relationship.", risk: "medium", affinity: 1, tension: 0 },
      { title: "Inspect in public", cue: "Test responsibility in front of everyone and demand an immediate answer.", outcome: "The failure point becomes undeniable, while the responsible party turns defensive.", event: "A public inspection reveals the obstacle and raises resistance.", risk: "high", affinity: -1, tension: 1 },
    ];
  }
  if (stage === "align") return [
    { title: "试行双人复核", cue: "先在一项事务中明确两人交叉复核，不立刻改变全府规程。", outcome: "试行获得实际配合，也暴露出一个仍无人愿意承担的责任空档。", event: "有限试行把口头支持变成了可观察的合作。", risk: "low", affinity: 1, tension: -1 },
    { title: "交换有限承诺", cue: "以一项边界清楚的人情，换取关键人物对职责和资源的明确承诺。", outcome: "关键人物开始提供资源，但这份承诺也成为日后需要偿还的人情。", event: "一项有边界的交换带来支持，也留下未来义务。", risk: "medium", affinity: 1, tension: 0 },
    { title: "公布首轮赏罚", cue: "让所有管事公开面对执行结果，立即选择支持或抵抗。", outcome: "执行速度明显提升，但原本隐蔽的抵抗也变成了公开对立。", event: "公开赏罚建立了阵营，同时提高了关系代价。", risk: "high", affinity: -1, tension: 1 },
  ];
  if (stage === "resolve") return [
    { title: "交付修订规程", cue: "把前几轮经验压缩成一套离开你也能执行的小规程。", outcome: "眼前混乱得到稳定，新规程也获得了继续运行的最低条件。", event: "修订规程让目标产生了持久但有限的结果。", risk: "low", affinity: 1, tension: -1 },
    { title: "保留人情缓冲", cue: "守住关键结果，同时给相关人物留下体面和有限例外。", outcome: "目标在不拆散合作关系的情况下推进，但仍保留一处模糊空间。", event: "一项可执行的折中为章节收尾。", risk: "medium", affinity: 1, tension: 0 },
    { title: "公开承担结果", cue: "把最终决定公开，并由自己承担它带来的家族与人情代价。", outcome: "目标清楚地改变了局势，反对者也明确知道该把代价归到谁身上。", event: "公开决断完成了章节目标，也把代价固定在你的名声上。", risk: "high", affinity: -1, tension: 2 },
  ];
  return [
    { title: "逐项核对名册", cue: "先把名册职责与实际差役逐项对照，不急于追责。", outcome: "名册与实差的一处错位暴露出来，混乱第一次有了具体来源。", event: "核对名册识别出责任缺口，没有立即扩大冲突。", risk: "low", affinity: 0, tension: -1 },
    { title: "分头询问管事", cue: "让关键人物分别说明情况，再比较其中的矛盾。", outcome: "两份说法的矛盾暴露出隐藏依赖，也显出一名可能合作的人。", event: "私下说法揭示了主要阻力，并改变了一段关系。", risk: "medium", affinity: 1, tension: 0 },
    { title: "当众抽查差役", cue: "在众人面前验证职责，要求相关管事立即解释。", outcome: "迟误源头无法再被掩盖，但被点名的人也转为公开戒备。", event: "公开抽查揭示了阻力，同时提高了对抗压力。", risk: "high", affinity: -1, tension: 1 },
  ];
}
