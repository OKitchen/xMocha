import { getPresetScenarioPack } from "./preset-scenarios";
import {
  applyInfluenceEventsToSimulationState,
  createInitialSimulationState,
} from "./simulation-state";
import type {
  AblationFeatureFlags,
  AblationMetricDelta,
  AblationMetricSnapshot,
  AblationMode,
  AblationReport,
  AblationRunResult,
  InfluenceEvent,
  SessionState,
  SimulationState,
} from "./types";

const ABLATION_CONFIGS: Array<{
  mode: AblationMode;
  label: string;
  flags: AblationFeatureFlags;
}> = [
  {
    mode: "full-coupled",
    label: "Full Coupled",
    flags: {
      individualToWorld: true,
      worldToIndividual: true,
    },
  },
  {
    mode: "no-individual-influence",
    label: "No Individual Influence",
    flags: {
      individualToWorld: false,
      worldToIndividual: true,
    },
  },
  {
    mode: "no-society-influence",
    label: "No Society Influence",
    flags: {
      individualToWorld: true,
      worldToIndividual: false,
    },
  },
  {
    mode: "isolated-baseline",
    label: "Isolated Baseline",
    flags: {
      individualToWorld: false,
      worldToIndividual: false,
    },
  },
];

export function buildAblationReport(session: SessionState): AblationReport {
  const initialState = initialSimulationStateForSession(session);
  const initialMetrics = metricsForState(initialState);
  const eventsByTurn = groupEventsByTurn(session.influenceEvents ?? []);
  const runs = ABLATION_CONFIGS.map((config) =>
    runAblation({
      config: {
        ...config,
        label: ablationLabel(config.mode, session.language),
      },
      initialState,
      initialMetrics,
      eventsByTurn,
    }),
  );
  const fullRun = runs.find((run) => run.mode === "full-coupled");
  const runsWithFullDelta = fullRun
    ? runs.map((run) => ({
        ...run,
        deltaFromFull:
          run.mode === "full-coupled"
            ? zeroDelta(run.metrics)
            : diffMetrics(run.metrics, fullRun.metrics),
      }))
    : runs;

  return {
    reportVersion: "ablation-v1",
    sessionId: session.sessionId,
    turns: session.turn,
    canonicalPath: session.canonicalPath.map((step) => ({
      turn: step.turn,
      branchId: step.id,
      title: step.title,
    })),
    influenceEventCount: session.influenceEvents?.length ?? 0,
    initialMetrics,
    runs: runsWithFullDelta,
    headlineInsights: buildHeadlineInsights(
      runsWithFullDelta,
      session.language ?? "en",
    ),
  };
}

function runAblation(params: {
  config: (typeof ABLATION_CONFIGS)[number];
  initialState: SimulationState;
  initialMetrics: AblationMetricSnapshot;
  eventsByTurn: Array<{ turn: number; events: InfluenceEvent[] }>;
}): AblationRunResult {
  let state = params.initialState;
  let includedEventCount = 0;
  let excludedEventCount = 0;

  for (const turnEvents of params.eventsByTurn) {
    const includedEvents = turnEvents.events.filter((event) =>
      includeEventForFlags(event, params.config.flags),
    );

    includedEventCount += includedEvents.length;
    excludedEventCount += turnEvents.events.length - includedEvents.length;
    state = applyInfluenceEventsToSimulationState(
      state,
      includedEvents,
      turnEvents.turn,
    );
  }

  const metrics = metricsForState(state);

  return {
    mode: params.config.mode,
    label: params.config.label,
    flags: params.config.flags,
    includedEventCount,
    excludedEventCount,
    finalState: state,
    metrics,
    deltaFromInitial: diffMetrics(metrics, params.initialMetrics),
  };
}

function includeEventForFlags(
  event: InfluenceEvent,
  flags: AblationFeatureFlags,
): boolean {
  const individualToWorld =
    event.sourceType === "individual" && event.targetType !== "individual";
  const worldToIndividual =
    event.sourceType !== "individual" && event.targetType === "individual";

  if (!flags.individualToWorld && individualToWorld) {
    return false;
  }

  if (!flags.worldToIndividual && worldToIndividual) {
    return false;
  }

  return true;
}

function initialSimulationStateForSession(session: SessionState): SimulationState {
  return session.initialSimulationState ?? createInitialSimulationState({
    userPersona: session.userPersona,
    userContextPack: session.userContextPack,
    presetScenario: getPresetScenarioPack(session.presetScenarioId),
    turn: 0,
  });
}

function groupEventsByTurn(
  events: InfluenceEvent[],
): Array<{ turn: number; events: InfluenceEvent[] }> {
  const eventsByTurn = new Map<number, InfluenceEvent[]>();

  for (const event of events) {
    const turnEvents = eventsByTurn.get(event.turn) ?? [];
    turnEvents.push(event);
    eventsByTurn.set(event.turn, turnEvents);
  }

  return Array.from(eventsByTurn.entries())
    .sort(([leftTurn], [rightTurn]) => leftTurn - rightTurn)
    .map(([turn, turnEvents]) => ({
      turn,
      events: turnEvents,
    }));
}

function metricsForState(state: SimulationState): AblationMetricSnapshot {
  const stakeholderCount = state.stakeholders.length;
  const stakeholderTrust = average(
    state.stakeholders.map((stakeholder) => stakeholder.trust),
  );
  const stakeholderResistance = average(
    state.stakeholders.map((stakeholder) => stakeholder.resistance),
  );
  const stakeholderInfluence = average(
    state.stakeholders.map((stakeholder) => stakeholder.influence),
  );

  return {
    individual: {
      confidence: roundMetric(state.individual.confidence),
      reputation: roundMetric(state.individual.reputation),
      trust: roundMetric(state.individual.trust),
      financialStability: roundMetric(state.individual.financialStability),
      stress: roundMetric(state.individual.stress),
      riskTolerance: roundMetric(state.individual.riskTolerance),
      adaptation: roundMetric(state.individual.skills.adaptation ?? 0),
      aiFluency: roundMetric(state.individual.skills.aiFluency ?? 0),
    },
    society: {
      stakeholderCount,
      averageTrust: roundMetric(stakeholderTrust),
      averageResistance: roundMetric(stakeholderResistance),
      averageInfluence: roundMetric(stakeholderInfluence),
      supportiveCount: state.stakeholders.filter(
        (stakeholder) => stakeholder.stance === "supportive",
      ).length,
      resistantCount: state.stakeholders.filter(
        (stakeholder) => stakeholder.stance === "resistant",
      ).length,
    },
    environment: Object.fromEntries(
      Object.entries(state.environmentMetrics)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => [name, roundMetric(value)]),
    ),
  };
}

function diffMetrics(
  next: AblationMetricSnapshot,
  previous: AblationMetricSnapshot,
): AblationMetricDelta {
  const individual = diffMetricGroup(next.individual, previous.individual);
  const society = diffMetricGroup(next.society, previous.society);
  const environment = diffMetricGroup(next.environment, previous.environment);

  return {
    individual,
    society,
    environment,
    totalDistance: roundMetric(
      distance(individual) + distance(society) + distance(environment),
    ),
  };
}

function zeroDelta(metrics: AblationMetricSnapshot): AblationMetricDelta {
  return {
    individual: zeroMetricGroup(metrics.individual),
    society: zeroMetricGroup(metrics.society),
    environment: zeroMetricGroup(metrics.environment),
    totalDistance: 0,
  };
}

function diffMetricGroup(
  next: Record<string, number>,
  previous: Record<string, number>,
): Record<string, number> {
  const keys = new Set([...Object.keys(next), ...Object.keys(previous)]);

  return Object.fromEntries(
    Array.from(keys)
      .sort()
      .map((key) => [key, roundMetric((next[key] ?? 0) - (previous[key] ?? 0))]),
  );
}

function zeroMetricGroup(metrics: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(metrics).map((key) => [key, 0]));
}

function buildHeadlineInsights(
  runs: AblationRunResult[],
  language: SessionState["language"],
): string[] {
  const full = runs.find((run) => run.mode === "full-coupled");
  const noIndividual = runs.find(
    (run) => run.mode === "no-individual-influence",
  );
  const noSociety = runs.find((run) => run.mode === "no-society-influence");
  const isolated = runs.find((run) => run.mode === "isolated-baseline");

  if (!full || !noIndividual || !noSociety || !isolated) {
    return [];
  }

  if (language !== "en") {
    return [
      `关闭个人对世界的影响后，最终状态与完整耦合实验的差异距离为 ${formatDistance(noIndividual.deltaFromFull?.totalDistance ?? 0)}。`,
      `关闭世界对个人的影响后，最终状态与完整耦合实验的差异距离为 ${formatDistance(noSociety.deltaFromFull?.totalDistance ?? 0)}。`,
      `关闭两个方向后，隔离基线与完整耦合实验的差异距离为 ${formatDistance(isolated.deltaFromFull?.totalDistance ?? 0)}。`,
    ];
  }

  return [
    `Removing individual-to-world influence changes the final state by ${formatDistance(noIndividual.deltaFromFull?.totalDistance ?? 0)} from the coupled run.`,
    `Removing world-to-individual influence changes the final state by ${formatDistance(noSociety.deltaFromFull?.totalDistance ?? 0)} from the coupled run.`,
    `Removing both directions leaves an isolated baseline ${formatDistance(isolated.deltaFromFull?.totalDistance ?? 0)} away from the coupled run.`,
  ];
}

function ablationLabel(
  mode: AblationMode,
  language: SessionState["language"],
): string {
  if (language === "en") {
    return ABLATION_CONFIGS.find((config) => config.mode === mode)?.label ?? mode;
  }

  if (mode === "full-coupled") return "完整耦合";
  if (mode === "no-individual-influence") return "关闭个人影响";
  if (mode === "no-society-influence") return "关闭社会影响";
  return "隔离基线";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distance(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + Math.abs(value), 0);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function formatDistance(value: number): string {
  return value.toFixed(2);
}
