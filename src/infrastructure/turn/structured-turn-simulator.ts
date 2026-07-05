import type { TurnSimulator } from "../../application/ports";
import {
  branchCommunitiesSchema,
  turnSimulationResultSchema,
} from "../../domain/schemas";
import type {
  Branch,
  BranchCommunity,
  BranchWorldDelta,
  OutputLanguage,
  InfluenceEvent,
  TurnGenerationInput,
  TurnSimulationResult,
} from "../../domain/types";
import { inferDilemmaKind, type DilemmaKind } from "../../domain/dilemma-kind";
import { findOutputLanguageIssues } from "../../domain/output-language";
import {
  buildFallbackInfluenceEvents,
  reconcileInfluenceEvents,
} from "../../domain/influence-events";
import type { JsonGenerationClient } from "../llm/anthropic-client";
import { AnthropicJsonClient } from "../llm/anthropic-client";
import { reconcileCommunitiesForBranches } from "../society/structured-society-simulator";
import { buildTurnSimulationPrompt } from "./turn-simulation-prompts";

function unwrapTurnPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const candidate = payload as {
    data?: unknown;
    result?: unknown;
    turn?: unknown;
    turnSimulation?: unknown;
    turnSimulationResult?: unknown;
  };

  return (
    candidate.turnSimulationResult ??
    candidate.turnSimulation ??
    candidate.turn ??
    candidate.result ??
    candidate.data ??
    payload
  );
}

function looksLikeCommunity(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { agents?: unknown; branchId?: unknown };
  return typeof candidate.branchId === "string" && Array.isArray(candidate.agents);
}

function looksLikeInfluenceEvent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    branchId?: unknown;
    explanation?: unknown;
    sourceType?: unknown;
    targetType?: unknown;
  };
  return (
    typeof candidate.branchId === "string" &&
    typeof candidate.explanation === "string" &&
    typeof candidate.sourceType === "string" &&
    typeof candidate.targetType === "string"
  );
}

function findArray(
  payload: unknown,
  predicate: (value: unknown) => boolean,
): unknown[] | undefined {
  if (Array.isArray(payload)) {
    return payload.some(predicate) ? payload : undefined;
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const values = Object.values(payload);
  if (values.length > 0 && values.every(predicate)) {
    return values;
  }

  for (const value of values) {
    const nested: unknown[] | undefined = findArray(value, predicate);
    if (nested) return nested;
  }

  return undefined;
}

function normalizeActorType(value: unknown, fallback: string) {
  return value === "individual" || value === "society" || value === "environment"
    ? value
    : fallback;
}

function normalizeDimension(value: unknown) {
  return value === "trust" ||
    value === "risk" ||
    value === "behavior" ||
    value === "opportunity" ||
    value === "pressure"
    ? value
    : "pressure";
}

function normalizeDirection(value: unknown) {
  return value === "increase" || value === "decrease" || value === "redirect"
    ? value
    : "redirect";
}

function normalizeIntensity(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeVisualPosition(value: unknown) {
  return value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "upper-left" ||
    value === "upper-right" ||
    value === "lower-left" ||
    value === "lower-right"
    ? value
    : "center";
}

function normalizeVisualStyle(value: unknown) {
  return value === "career-studio" ||
    value === "city-apartment" ||
    value === "night-cafe"
    ? value
    : "career-studio";
}

function normalizeCollapseCue(value: unknown) {
  return value === "split" ||
    value === "pull" ||
    value === "echo" ||
    value === "pressure-rise"
    ? value
    : "echo";
}

function normalizeObjectType(value: unknown) {
  return value === "desk" ||
    value === "window" ||
    value === "screen" ||
    value === "plant" ||
    value === "clock" ||
    value === "map" ||
    value === "artifact"
    ? value
    : "artifact";
}

function normalizeStance(value: unknown) {
  return value === "supportive" ||
    value === "resistant" ||
    value === "neutral" ||
    value === "uncertain"
    ? value
    : "uncertain";
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;

  const strings = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return strings.length > 0 ? strings : fallback;
}

function normalizeColorPalette(value: unknown): string[] {
  const palette = normalizeStringList(value, [
    "#0f172a",
    "#38bdf8",
    "#5eead4",
  ]);

  return [...palette, "#0f172a", "#38bdf8", "#5eead4"].slice(0, 5);
}

function normalizeVisualScenePayload(
  visualScene: unknown,
  turnNumber: number,
): unknown | undefined {
  if (!visualScene || typeof visualScene !== "object" || Array.isArray(visualScene)) {
    return undefined;
  }

  const candidate = visualScene as {
    avatar?: Record<string, unknown>;
    branchPortals?: unknown;
    caption?: unknown;
    collapseCue?: unknown;
    mode?: unknown;
    room?: Record<string, unknown>;
    stakeholders?: unknown;
    style?: unknown;
    turnNumber?: unknown;
  };
  const avatar = candidate.avatar ?? {};
  const room = candidate.room ?? {};
  const branchPortals = Array.isArray(candidate.branchPortals)
    ? candidate.branchPortals
    : [];
  const roomObjects = Array.isArray(room.objects) ? room.objects : [];
  const stakeholders = Array.isArray(candidate.stakeholders)
    ? candidate.stakeholders
    : [];

  return {
    mode: "avatar-room",
    style: normalizeVisualStyle(candidate.style),
    turnNumber:
      typeof candidate.turnNumber === "number" &&
      Number.isInteger(candidate.turnNumber)
        ? candidate.turnNumber
        : turnNumber,
    avatar: {
      posture:
        typeof avatar.posture === "string" ? avatar.posture : "observing the room",
      expression:
        typeof avatar.expression === "string" ? avatar.expression : "focused",
      energy: normalizeIntensity(avatar.energy),
      stressSignal:
        typeof avatar.stressSignal === "string"
          ? avatar.stressSignal
          : "soft pressure halo",
      focusAura:
        typeof avatar.focusAura === "string" ? avatar.focusAura : "blue focus field",
    },
    room: {
      atmosphere:
        typeof room.atmosphere === "string"
          ? room.atmosphere
          : "decision room with suspended futures",
      lighting:
        typeof room.lighting === "string" ? room.lighting : "cool studio light",
      colorPalette: normalizeColorPalette(room.colorPalette),
      objects: roomObjects.map((object, index) => {
        const item =
          object && typeof object === "object"
            ? (object as Record<string, unknown>)
            : {};

        return {
          id: typeof item.id === "string" ? item.id : `object-${index + 1}`,
          label: typeof item.label === "string" ? item.label : "room signal",
          type: normalizeObjectType(item.type),
          position: normalizeVisualPosition(item.position),
          state: typeof item.state === "string" ? item.state : "active",
          description:
            typeof item.description === "string"
              ? item.description
              : "A visual cue in the decision room.",
        };
      }),
      pressureIndicators: normalizeStringList(room.pressureIndicators, [
        "The room is waiting for collapse.",
      ]),
    },
    branchPortals: branchPortals.map((portal, index) => {
      const item =
        portal && typeof portal === "object"
          ? (portal as Record<string, unknown>)
          : {};

      return {
        branchId: typeof item.branchId === "string" ? item.branchId : `b${index + 1}`,
        portalLabel:
          typeof item.portalLabel === "string"
            ? item.portalLabel
            : `Future ${index + 1}`,
        position: normalizeVisualPosition(item.position),
        color: typeof item.color === "string" ? item.color : "#60a5fa",
        symbol: typeof item.symbol === "string" ? item.symbol : "portal",
        motion: typeof item.motion === "string" ? item.motion : "slow pulse",
        roomEffect:
          typeof item.roomEffect === "string"
            ? item.roomEffect
            : "changes the room if observed",
      };
    }),
    stakeholders: stakeholders.map((stakeholder, index) => {
      const item =
        stakeholder && typeof stakeholder === "object"
          ? (stakeholder as Record<string, unknown>)
          : {};

      return {
        stakeholderId:
          typeof item.stakeholderId === "string"
            ? item.stakeholderId
            : `stakeholder-${index + 1}`,
        label: typeof item.label === "string" ? item.label : "Stakeholder",
        stance: normalizeStance(item.stance),
        position: normalizeVisualPosition(item.position),
        influence: normalizeIntensity(item.influence),
        mood: typeof item.mood === "string" ? item.mood : "watching",
      };
    }),
    collapseCue: normalizeCollapseCue(candidate.collapseCue),
    caption:
      typeof candidate.caption === "string"
        ? candidate.caption
        : "The room is waiting for one future to become real.",
  };
}

function normalizeInfluenceEventsPayload(
  events: unknown,
  turnNumber: number,
): unknown[] {
  const eventArray = Array.isArray(events)
    ? events
    : findArray(events, looksLikeInfluenceEvent) ?? [];

  return eventArray
    .filter((event) => event && typeof event === "object")
    .map((event, index) => {
      const candidate = event as {
        branchId?: unknown;
        dimension?: unknown;
        direction?: unknown;
        explanation?: unknown;
        id?: unknown;
        intensity?: unknown;
        sourceId?: unknown;
        sourceType?: unknown;
        targetId?: unknown;
        targetType?: unknown;
        turn?: unknown;
      };
      const branchId =
        typeof candidate.branchId === "string" ? candidate.branchId : "b1";
      const sourceType = normalizeActorType(candidate.sourceType, "individual");
      const targetType = normalizeActorType(
        candidate.targetType,
        sourceType === "individual" ? "society" : "individual",
      );

      return {
        ...candidate,
        id:
          typeof candidate.id === "string"
            ? candidate.id
            : `ie-${turnNumber}-${branchId}-${index + 1}`,
        turn:
          typeof candidate.turn === "number" && Number.isInteger(candidate.turn)
            ? candidate.turn
            : turnNumber,
        branchId,
        sourceType,
        sourceId:
          typeof candidate.sourceId === "string"
            ? candidate.sourceId
            : sourceType === "individual"
              ? "observer"
              : "system",
        targetType,
        targetId:
          typeof candidate.targetId === "string"
            ? candidate.targetId
            : targetType === "individual"
              ? "observer"
              : "primary-stakeholder",
        dimension: normalizeDimension(candidate.dimension),
        direction: normalizeDirection(candidate.direction),
        intensity: normalizeIntensity(candidate.intensity),
        explanation:
          typeof candidate.explanation === "string"
            ? candidate.explanation
            : "This event captures a causal influence between the observer and surrounding reality.",
      };
    });
}

function normalizeTurnPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const candidate = payload as {
    branchCommunities?: unknown;
    influenceEvents?: unknown;
    turnNumber?: unknown;
  };
  const turnNumber =
    typeof candidate.turnNumber === "number" && Number.isInteger(candidate.turnNumber)
      ? candidate.turnNumber
      : 1;

  return {
    ...candidate,
    branchCommunities: Array.isArray(candidate.branchCommunities)
      ? candidate.branchCommunities
      : findArray(candidate.branchCommunities, looksLikeCommunity) ?? [],
    influenceEvents: Array.isArray(candidate.influenceEvents)
      ? normalizeInfluenceEventsPayload(candidate.influenceEvents, turnNumber)
      : normalizeInfluenceEventsPayload(candidate.influenceEvents, turnNumber),
    visualScene: normalizeVisualScenePayload(
      (candidate as { visualScene?: unknown }).visualScene,
      turnNumber,
    ),
  };
}

function normalizeScores(result: TurnSimulationResult): TurnSimulationResult {
  const total = result.branches.reduce((sum, branch) => sum + branch.score, 0);

  if (total <= 0) {
    return {
      ...result,
      branches: result.branches.map((branch, _index, branches) => ({
        ...branch,
        score: Number((1 / branches.length).toFixed(2)),
      })),
    };
  }

  return {
    ...result,
    branches: result.branches.map((branch) => ({
      ...branch,
      score: Number((branch.score / total).toFixed(2)),
    })),
  };
}

function fallbackWorldDeltaForBranch(
  branch: Branch,
  language: OutputLanguage,
  dilemmaKind: DilemmaKind,
): BranchWorldDelta {
  const useChinese = language !== "en";

  if (dilemmaKind === "food") {
    return {
      branchId: branch.id,
      activatedConstraints: useChinese
        ? branch.riskProfile === "high"
          ? ["可能排队、踩雷，或多花一点预算。"]
          : branch.riskProfile === "low"
            ? ["选择更稳，但节日感或新鲜感会少一点。"]
            : ["需要协调口味、距离、时间和当下胃口。"]
        : branch.riskProfile === "high"
          ? ["There may be queues, disappointment, or extra cost."]
          : branch.riskProfile === "low"
            ? ["The choice is reliable, but less novel or festive."]
            : ["Taste, distance, timing, and appetite need coordination."],
      activatedOpportunities: useChinese
        ? branch.riskProfile === "high"
          ? ["这顿饭更可能变成有记忆点的小体验。"]
          : branch.riskProfile === "low"
            ? ["能更快吃上舒服、可靠的一顿。"]
            : ["可以在方便和体验之间找到一个平衡。"]
        : branch.riskProfile === "high"
          ? ["The meal can become a memorable small experience."]
          : branch.riskProfile === "low"
            ? ["You can eat something comfortable and reliable quickly."]
            : ["You can balance convenience with a little ritual."],
      pressureShift: useChinese
        ? branch.riskProfile === "high"
          ? "这顿饭会测试你今天愿不愿意用一点不确定性换新鲜感。"
          : branch.riskProfile === "low"
            ? "这顿饭会测试你是否更需要安稳、熟悉和省心。"
            : "这顿饭会测试你如何平衡仪式感、口味和现实条件。"
        : branch.riskProfile === "high"
          ? "The meal tests whether novelty is worth uncertainty today."
          : branch.riskProfile === "low"
            ? "The meal tests whether comfort and ease matter most today."
            : "The meal tests how you balance ritual, taste, and practical constraints.",
    };
  }

  if (useChinese) {
    return {
      branchId: branch.id,
      activatedConstraints:
        branch.riskProfile === "high"
          ? ["额外成本、时间或不确定性会上升。"]
          : branch.riskProfile === "low"
            ? ["省心路径可能少一点新鲜感。"]
            : ["需要同时管理现实条件和个人偏好。"],
      activatedOpportunities:
        branch.riskProfile === "high"
          ? ["更有机会获得一次难忘体验。"]
          : branch.riskProfile === "low"
            ? ["能更快得到一个稳定、可执行的结果。"]
            : ["可以在稳妥和体验之间保留转向空间。"],
      pressureShift:
        branch.riskProfile === "high"
          ? "现实条件会提醒你：更有体验感的选择通常也更费事。"
          : branch.riskProfile === "low"
            ? "现实条件会奖励省心，但也可能让这次选择显得普通。"
            : "现实条件会观察你能不能在偏好和方便之间做取舍。",
    };
  }

  return {
    branchId: branch.id,
    activatedConstraints:
      branch.riskProfile === "high"
        ? ["Extra cost, time, or uncertainty rises."]
        : branch.riskProfile === "low"
          ? ["The easiest path may feel less fresh."]
          : ["You must manage practical constraints and personal preference."],
    activatedOpportunities:
      branch.riskProfile === "high"
        ? ["The choice may become more memorable."]
        : branch.riskProfile === "low"
          ? ["You can reach a stable, executable result faster."]
          : ["You can keep room to adjust between safety and experience."],
    pressureShift:
      branch.riskProfile === "high"
        ? "Reality reminds you that richer experiences usually take more effort."
        : branch.riskProfile === "low"
          ? "Reality rewards ease, but may make the choice feel ordinary."
          : "Reality asks you to trade off preference and convenience.",
  };
}

function reconcileWorldDeltas(
  branches: Branch[],
  deltas: BranchWorldDelta[],
  input: TurnGenerationInput,
): BranchWorldDelta[] {
  const deltasByBranchId = new Map(
    deltas.map((delta) => [delta.branchId, delta]),
  );
  const dilemmaKind = inferDilemmaKind(input.session);

  return branches.map(
    (branch) =>
      deltasByBranchId.get(branch.id) ??
      fallbackWorldDeltaForBranch(
        branch,
        input.session.language,
        dilemmaKind,
      ),
  );
}

function parseCommunities(payload: unknown): BranchCommunity[] {
  return branchCommunitiesSchema.parse(payload);
}

function repairResult(
  result: TurnSimulationResult,
  input: TurnGenerationInput,
): TurnSimulationResult {
  const branchWorldDeltas = reconcileWorldDeltas(
    result.branches,
    result.branchWorldDeltas,
    input,
  );
  const branchCommunities = reconcileCommunitiesForBranches(
    parseCommunities(result.branchCommunities),
    result.branches,
    input.session.language,
    inferDilemmaKind(input.session),
  );
  const influenceEvents =
    result.influenceEvents.length > 0
      ? reconcileInfluenceEvents({
          branches: result.branches,
          branchCommunities,
          branchWorldDeltas,
          influenceEvents: result.influenceEvents,
          turnNumber: result.turnNumber,
        })
      : buildFallbackInfluenceEvents({
          branches: result.branches,
          branchCommunities,
          branchWorldDeltas,
          turnNumber: result.turnNumber,
        });

  return normalizeScores({
    ...result,
    branchWorldDeltas,
    branchCommunities,
    influenceEvents,
  });
}

function assertBranchLinkage(result: TurnSimulationResult): void {
  const branchIds = new Set(result.branches.map((branch) => branch.id));

  for (const delta of result.branchWorldDeltas) {
    if (!branchIds.has(delta.branchId)) {
      throw new Error(`Turn simulator referenced unknown delta branch id "${delta.branchId}".`);
    }
  }

  for (const community of result.branchCommunities) {
    if (!branchIds.has(community.branchId)) {
      throw new Error(
        `Turn simulator referenced unknown community branch id "${community.branchId}".`,
      );
    }
  }

  for (const event of result.influenceEvents) {
    if (!branchIds.has(event.branchId)) {
      throw new Error(`Turn simulator referenced unknown influence branch id "${event.branchId}".`);
    }
  }
}

function assertOutputLanguage(result: TurnSimulationResult, input: TurnGenerationInput): void {
  const issues = findOutputLanguageIssues({
    language: input.session.language,
    fields: [
      ...result.branches.flatMap((branch) => [
        { label: `${branch.id}.title`, text: branch.title },
        { label: `${branch.id}.summary`, text: branch.summary },
        { label: `${branch.id}.consequence`, text: branch.consequence },
        { label: `${branch.id}.timeHorizon`, text: branch.timeHorizon },
        { label: `${branch.id}.keyUncertainty`, text: branch.keyUncertainty },
      ]),
      ...result.branchWorldDeltas.flatMap((delta) => [
        { label: `${delta.branchId}.pressureShift`, text: delta.pressureShift },
        ...delta.activatedConstraints.map((text, index) => ({
          label: `${delta.branchId}.constraint.${index + 1}`,
          text,
        })),
        ...delta.activatedOpportunities.map((text, index) => ({
          label: `${delta.branchId}.opportunity.${index + 1}`,
          text,
        })),
      ]),
      ...result.branchCommunities.flatMap((community) => [
        { label: `${community.branchId}.socialDynamics`, text: community.socialDynamics },
        { label: `${community.branchId}.dominantNarrative`, text: community.dominantNarrative },
        ...community.agents.flatMap((agent, index) => [
          { label: `${community.branchId}.agent.${index + 1}.role`, text: agent.role },
          { label: `${community.branchId}.agent.${index + 1}.motivation`, text: agent.motivation },
          { label: `${community.branchId}.agent.${index + 1}.reaction`, text: agent.reaction },
        ]),
      ]),
      ...result.influenceEvents.map((event) => ({
        label: `${event.branchId}.${event.id}.explanation`,
        text: event.explanation,
      })),
      { label: "visual.caption", text: result.visualScene?.caption },
      ...(result.visualScene?.room.pressureIndicators.map((text, index) => ({
        label: `visual.pressure.${index + 1}`,
        text,
      })) ?? []),
    ],
  });

  if (issues.length > 0) {
    throw new Error(`Output language mismatch. ${issues.slice(0, 4).join(" | ")}`);
  }
}

export class StructuredTurnSimulator implements TurnSimulator {
  constructor(
    private readonly client: JsonGenerationClient = new AnthropicJsonClient(),
    private readonly providerLabel = "LLM",
  ) {}

  async simulate(input: TurnGenerationInput): Promise<TurnSimulationResult> {
    const basePrompt = buildTurnSimulationPrompt(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const prompt = attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nYour previous answer was invalid: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }\nReturn only strict JSON matching the required top-level shape. Include branchCommunities, influenceEvents, and visualScene for every branch. If output language is zh-CN, rewrite every user-visible natural-language value in Simplified Chinese.`;
      try {
        const responseText = await this.client.generateJson(prompt);
        const parsedJson = normalizeTurnPayload(
          unwrapTurnPayload(JSON.parse(responseText)),
        );
        const parsed = turnSimulationResultSchema.parse(parsedJson);
        const repaired = repairResult(parsed, input);
        assertBranchLinkage(repaired);
        assertOutputLanguage(repaired, input);
        return repaired;
      } catch (error) {
        console.warn("turn_simulation_attempt_failed", {
          provider: this.providerLabel,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        });
        lastError = error;
      }
    }

    throw new Error(
      `${this.providerLabel} turn simulation failed after retry: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
