import { getPresetScenarioPack } from "./preset-scenarios";
import type {
  IndividualState,
  InfluenceDirection,
  InfluenceEvent,
  OutputLanguage,
  PresetScenarioPack,
  SessionState,
  SimulationScope,
  SimulationState,
  StakeholderState,
  Stance,
  UserContextPack,
  UserPersona,
} from "./types";

const DEFAULT_ENVIRONMENT_METRICS: Record<string, number> = {
  behavior: 0.4,
  momentum: 0.4,
  opportunity: 0.5,
  pressure: 0.45,
  risk: 0.45,
  trust: 0.5,
};

export function createInitialSimulationState(params: {
  userPersona?: UserPersona;
  userContextPack?: UserContextPack;
  presetScenario?: PresetScenarioPack;
  language?: OutputLanguage;
  scope?: SimulationScope;
  turn?: number;
} = {}): SimulationState {
  const riskTolerance = riskProfileToNumber(
    params.userPersona?.riskTolerance ?? params.userContextPack?.riskPreference,
  );
  const identity = uniqueStrings([
    params.userPersona?.primaryValue,
    params.presetScenario ? "ai-adapter" : undefined,
    "decision-observer",
  ]);

  return {
    scope: params.scope ?? "coupled",
    individual: {
      skills: {
        adaptation: params.presetScenario ? 0.5 : 0.45,
        aiFluency: params.presetScenario?.scenarioId === "ai_future_of_work" ? 0.42 : 0.3,
        domain: 0.55,
      },
      confidence: 0.5,
      reputation: 0.5,
      trust: 0.5,
      financialStability: 0.6,
      stress: 0.35,
      riskTolerance,
      identity,
    },
    stakeholders: buildInitialStakeholders(
      params.presetScenario,
      params.userContextPack,
      params.language,
    ),
    environmentMetrics: { ...DEFAULT_ENVIRONMENT_METRICS },
    updatedAtTurn: params.turn ?? 0,
  };
}

export function simulationStateForSession(session: SessionState): SimulationState {
  return session.simulationState ?? createInitialSimulationState({
    userPersona: session.userPersona,
    userContextPack: session.userContextPack,
    presetScenario: getPresetScenarioPack(session.presetScenarioId),
    language: session.language,
    turn: session.turn,
  });
}

export function applyInfluenceEventsToSimulationState(
  currentState: SimulationState,
  events: InfluenceEvent[],
  turn: number,
): SimulationState {
  const state: SimulationState = {
    ...currentState,
    individual: {
      ...currentState.individual,
      skills: { ...currentState.individual.skills },
      identity: [...currentState.individual.identity],
    },
    stakeholders: currentState.stakeholders.map((stakeholder) => ({
      ...stakeholder,
    })),
    environmentMetrics: { ...currentState.environmentMetrics },
    updatedAtTurn: turn,
  };

  for (const event of events) {
    if (event.targetType === "individual") {
      applyIndividualInfluence(state.individual, event);
      continue;
    }

    if (event.targetType === "society") {
      applySocietyInfluence(state, event);
      continue;
    }

    applyEnvironmentInfluence(state, event);
  }

  return state;
}

function buildInitialStakeholders(
  presetScenario: PresetScenarioPack | undefined,
  userContextPack: UserContextPack | undefined,
  language: OutputLanguage | undefined,
): StakeholderState[] {
  const useChinese = language !== "en";
  const presetStakeholders =
    presetScenario?.roleCast.map((role) => ({
      id: normalizeActorId(role.role),
      role: role.role,
      stance: role.baselineStance,
      trust: stanceTrust(role.baselineStance),
      resistance: stanceResistance(role.baselineStance),
      influence: clamp(role.influence),
      currentGoal: role.motivation,
    })) ?? [];
  const existingIds = new Set(presetStakeholders.map((stakeholder) => stakeholder.id));
  const contextStakeholders =
    userContextPack?.keyStakeholders
      .filter((role) => !existingIds.has(normalizeActorId(role)))
      .map((role) => ({
        id: normalizeActorId(role),
        role,
        stance: "uncertain" as const,
        trust: 0.5,
        resistance: 0.45,
        influence: 0.5,
        currentGoal: useChinese
          ? "回应观察者的选择。"
          : "Respond to the observer's choices.",
      })) ?? [];

  const stakeholders = [...presetStakeholders, ...contextStakeholders];

  if (stakeholders.length > 0) {
    return stakeholders;
  }

  return [
    {
      id: "primary-stakeholder",
      role: useChinese ? "关键利益相关者" : "Primary Stakeholder",
      stance: "uncertain",
      trust: 0.5,
      resistance: 0.45,
      influence: 0.5,
      currentGoal: useChinese
        ? "回应观察者的选择。"
        : "Respond to the observer's choices.",
    },
  ];
}

function applyIndividualInfluence(
  individual: IndividualState,
  event: InfluenceEvent,
): void {
  const weight = clamp(event.intensity) * 0.18;

  if (event.dimension === "trust") {
    individual.trust = updateMetric(individual.trust, event.direction, weight);
    individual.reputation = updateMetric(
      individual.reputation,
      event.direction,
      weight * 0.4,
    );
    return;
  }

  if (event.dimension === "risk") {
    individual.stress = updateMetric(individual.stress, event.direction, weight);
    individual.financialStability = updateMetric(
      individual.financialStability,
      invertDirection(event.direction),
      weight * 0.55,
    );
    individual.riskTolerance = updateMetric(
      individual.riskTolerance,
      invertDirection(event.direction),
      weight * 0.25,
    );
    return;
  }

  if (event.dimension === "behavior") {
    individual.skills.adaptation = updateMetric(
      individual.skills.adaptation ?? 0.5,
      event.direction === "decrease" ? "decrease" : "increase",
      weight,
    );
    individual.confidence = updateMetric(
      individual.confidence,
      event.direction,
      weight * 0.35,
    );
    return;
  }

  if (event.dimension === "opportunity") {
    individual.confidence = updateMetric(
      individual.confidence,
      event.direction,
      weight,
    );
    individual.reputation = updateMetric(
      individual.reputation,
      event.direction,
      weight * 0.7,
    );
    individual.financialStability = updateMetric(
      individual.financialStability,
      event.direction,
      weight * 0.3,
    );
    return;
  }

  individual.stress = updateMetric(individual.stress, event.direction, weight);
  individual.confidence = updateMetric(
    individual.confidence,
    invertDirection(event.direction),
    weight * 0.35,
  );
}

function applySocietyInfluence(
  state: SimulationState,
  event: InfluenceEvent,
): void {
  const stakeholder = findOrCreateStakeholder(state, event.targetId);
  const weight = clamp(event.intensity) * 0.2;

  if (event.dimension === "trust") {
    stakeholder.trust = updateMetric(stakeholder.trust, event.direction, weight);
    stakeholder.resistance = updateMetric(
      stakeholder.resistance,
      invertDirection(event.direction),
      weight * 0.75,
    );
  } else if (event.dimension === "risk" || event.dimension === "pressure") {
    stakeholder.resistance = updateMetric(
      stakeholder.resistance,
      event.direction,
      weight,
    );
    stakeholder.trust = updateMetric(
      stakeholder.trust,
      invertDirection(event.direction),
      weight * 0.45,
    );
  } else if (event.dimension === "opportunity") {
    stakeholder.trust = updateMetric(stakeholder.trust, event.direction, weight * 0.6);
    stakeholder.influence = updateMetric(
      stakeholder.influence,
      event.direction,
      weight * 0.35,
    );
  } else {
    stakeholder.resistance = updateMetric(
      stakeholder.resistance,
      event.direction === "decrease" ? "increase" : "decrease",
      weight * 0.45,
    );
    stakeholder.influence = updateMetric(
      stakeholder.influence,
      event.direction === "decrease" ? "decrease" : "increase",
      weight * 0.25,
    );
  }

  stakeholder.stance = deriveStance(stakeholder);
}

function applyEnvironmentInfluence(
  state: SimulationState,
  event: InfluenceEvent,
): void {
  const weight = clamp(event.intensity) * 0.2;
  const current = state.environmentMetrics[event.dimension] ?? 0.5;
  state.environmentMetrics[event.dimension] = updateMetric(
    current,
    event.direction,
    weight,
  );

  if (event.dimension === "behavior" || event.dimension === "opportunity") {
    state.environmentMetrics.momentum = updateMetric(
      state.environmentMetrics.momentum ?? 0.5,
      event.direction,
      weight * 0.5,
    );
  }
}

function findOrCreateStakeholder(
  state: SimulationState,
  targetId: string,
): StakeholderState {
  const id = normalizeActorId(targetId) || "society";
  const existing = state.stakeholders.find(
    (stakeholder) =>
      stakeholder.id === id || normalizeActorId(stakeholder.role) === id,
  );

  if (existing) {
    return existing;
  }

  const useChinese = state.stakeholders.some((stakeholder) =>
    /[\u4e00-\u9fff]/.test(`${stakeholder.role} ${stakeholder.currentGoal}`),
  );
  const isPrimaryStakeholder = id === "primary-stakeholder";
  const stakeholder: StakeholderState = {
    id,
    role: isPrimaryStakeholder && useChinese
      ? "关键利益相关者"
      : humanizeActorId(targetId),
    stance: "uncertain",
    trust: 0.5,
    resistance: 0.45,
    influence: 0.5,
    currentGoal: useChinese
      ? "回应观察者的选择。"
      : "Respond to the observer's choices.",
  };
  state.stakeholders.push(stakeholder);
  return stakeholder;
}

function updateMetric(
  current: number,
  direction: InfluenceDirection,
  amount: number,
): number {
  if (direction === "redirect") {
    const delta = current < 0.5 ? amount : current > 0.5 ? -amount : amount * 0.5;
    return clamp(current + delta);
  }

  return clamp(current + (direction === "increase" ? amount : -amount));
}

function invertDirection(direction: InfluenceDirection): InfluenceDirection {
  if (direction === "increase") return "decrease";
  if (direction === "decrease") return "increase";
  return "redirect";
}

function deriveStance(stakeholder: StakeholderState): Stance {
  if (stakeholder.trust - stakeholder.resistance >= 0.18) return "supportive";
  if (stakeholder.resistance - stakeholder.trust >= 0.18) return "resistant";
  if (Math.abs(stakeholder.trust - stakeholder.resistance) <= 0.05) {
    return "neutral";
  }
  return "uncertain";
}

function stanceTrust(stance: Stance): number {
  if (stance === "supportive") return 0.72;
  if (stance === "resistant") return 0.3;
  if (stance === "neutral") return 0.5;
  return 0.45;
}

function stanceResistance(stance: Stance): number {
  if (stance === "supportive") return 0.25;
  if (stance === "resistant") return 0.75;
  if (stance === "neutral") return 0.45;
  return 0.55;
}

function riskProfileToNumber(
  riskProfile: UserPersona["riskTolerance"] | undefined,
): number {
  if (riskProfile === "low") return 0.3;
  if (riskProfile === "high") return 0.78;
  return 0.55;
}

function normalizeActorId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function humanizeActorId(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "Society";
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function clamp(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(3));
}
