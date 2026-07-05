import { performance } from "node:perf_hooks";

import type {
  BranchGenerator,
  SocietySimulator,
  SummaryGenerator,
  TurnSimulator,
  WorldModelProvider,
} from "../../application/ports";
import { TurnOrchestrator } from "../../application/turn-orchestrator";
import { createSession } from "../../domain/session-engine";
import type {
  BranchCommunity,
  SessionState,
  SessionSummary,
  SocietySimulationInput,
  TurnDraft,
  TurnGenerationInput,
  TurnGenerationResult,
  TurnSimulationResult,
  WorldContext,
} from "../../domain/types";
import { evaluateCompletedSession, evaluateTurnStructure } from "../../evaluation/assertions";
import {
  evaluationScenarios,
  type EvaluationScenario,
} from "../../evaluation/scenarios";
import {
  createBranchGenerator,
  createSocietySimulator,
  createSummaryGenerator,
  createTurnSimulator,
  createWorldModelProvider,
} from "../../infrastructure/runtime/create-runtime";

type TimingKey =
  | "worldModelMs"
  | "turnSimulatorMs"
  | "branchMs"
  | "societyMs"
  | "summaryMs";

type TimingMetrics = Record<TimingKey, number>;

type EvaluationConfig = {
  mode: "full" | "smoke";
  scenarioIds?: Set<string>;
  maxScenarios?: number;
  maxTurnsOverride?: number;
};

type ScenarioReport = {
  scenarioId: string;
  checks: Array<{ name: string; passed: boolean; details: string }>;
  turns: Array<{
    turnNumber: number;
    selectedBranchId: string;
    selectedBranchTitle: string;
    scoreTotal: number;
    distinctRiskProfiles: number;
    influenceEventCount: number;
    timings: TimingMetrics;
  }>;
  summaryTimingMs: number;
  totalTimings: TimingMetrics;
};

async function main(): Promise<void> {
  const config = readConfig();
  const timingState = createEmptyTimings();
  const worldModelProvider = new TimedWorldModelProvider(
    createWorldModelProvider(),
    timingState,
  );
  const branchGenerator = new TimedBranchGenerator(
    createBranchGenerator(),
    timingState,
  );
  const societySimulator = new TimedSocietySimulator(
    createSocietySimulator(),
    timingState,
  );
  const summaryGenerator = new TimedSummaryGenerator(
    createSummaryGenerator(),
    timingState,
  );
  const turnSimulator = createTurnSimulator();
  const orchestrator = new TurnOrchestrator(
    worldModelProvider,
    branchGenerator,
    societySimulator,
    undefined,
    undefined,
    turnSimulator ? new TimedTurnSimulator(turnSimulator, timingState) : undefined,
  );
  const reports: ScenarioReport[] = [];
  const scenarios = selectScenarios(config);

  for (const scenario of scenarios) {
    let session = createSession({
      dilemma: scenario.dilemma,
      theme: scenario.theme,
      maxTurns: config.maxTurnsOverride ?? scenario.maxTurns,
    });

    const scenarioChecks: ScenarioReport["checks"] = [];
    const turns: ScenarioReport["turns"] = [];
    const scenarioTimingStart = copyTimings(timingState);

    while (session.status === "active" && session.turn < session.maxTurns) {
      const turnTimingStart = copyTimings(timingState);
      const turn = await orchestrator.generateTurn(session);
      const { checks, metrics } = evaluateTurnStructure(turn);
      scenarioChecks.push(...checks);

      const selected = chooseBranch(turn);
      turns.push({
        turnNumber: turn.turnNumber,
        selectedBranchId: selected.id,
        selectedBranchTitle: selected.title,
        scoreTotal: metrics.scoreTotal,
        distinctRiskProfiles: metrics.distinctRiskProfiles,
        influenceEventCount: metrics.influenceEventCount,
        timings: diffTimings(turnTimingStart, timingState),
      });

      session = orchestrator.chooseBranch(session, turn, selected.id);
    }

    const summaryTimingStart = copyTimings(timingState);
    session = {
      ...session,
      summary: await summaryGenerator.generate(session),
    };

    scenarioChecks.push(...evaluateCompletedSession(session));
    reports.push({
      scenarioId: scenario.id,
      checks: scenarioChecks,
      turns,
      summaryTimingMs: diffTimings(summaryTimingStart, timingState).summaryMs,
      totalTimings: diffTimings(scenarioTimingStart, timingState),
    });
  }

  printReports(reports, config);

  const failedChecks = reports.flatMap((report) =>
    report.checks.filter((check) => !check.passed).map((check) => ({
      scenarioId: report.scenarioId,
      ...check,
    })),
  );

  if (failedChecks.length > 0) {
    process.exitCode = 1;
  }
}

function chooseBranch(turn: TurnGenerationResult) {
  return [...turn.branches].sort((left, right) => right.score - left.score)[0]!;
}

function printReports(reports: ScenarioReport[], config: EvaluationConfig): void {
  const provider = process.env.XMOCHA_BRANCH_GENERATOR === "mock"
    ? "mock"
    : (process.env.XMOCHA_MODEL_PROVIDER ?? "gemma");
  const overallTimings = reports.reduce(
    (accumulator, report) => addTimings(accumulator, report.totalTimings),
    createEmptyTimings(),
  );

  console.log(`xMocha core evaluation`);
  console.log(`provider: ${provider}`);
  console.log(`mode: ${config.mode}`);
  console.log(`scenarios: ${reports.length}`);
  if (config.maxTurnsOverride) {
    console.log(`turn override: ${config.maxTurnsOverride}`);
  }

  for (const report of reports) {
    const passed = report.checks.filter((check) => check.passed).length;
    const failed = report.checks.filter((check) => !check.passed);

    console.log(`\nScenario: ${report.scenarioId}`);
    console.log(`Checks: ${passed}/${report.checks.length} passed`);

    for (const turn of report.turns) {
      console.log(
        `  Turn ${turn.turnNumber}: chose ${turn.selectedBranchId} (${turn.selectedBranchTitle}) | scoreTotal=${turn.scoreTotal.toFixed(2)} | riskProfiles=${turn.distinctRiskProfiles} | world=${turn.timings.worldModelMs.toFixed(0)}ms turn=${turn.timings.turnSimulatorMs.toFixed(0)}ms branch=${turn.timings.branchMs.toFixed(0)}ms society=${turn.timings.societyMs.toFixed(0)}ms`,
      );
      console.log(`    influenceEvents=${turn.influenceEventCount}`);
    }

    console.log(
      `  Timing totals: world=${report.totalTimings.worldModelMs.toFixed(0)}ms turn=${report.totalTimings.turnSimulatorMs.toFixed(0)}ms branch=${report.totalTimings.branchMs.toFixed(0)}ms society=${report.totalTimings.societyMs.toFixed(0)}ms summary=${report.summaryTimingMs.toFixed(0)}ms`,
    );

    if (failed.length === 0) {
      console.log(`  Result: PASS`);
      continue;
    }

    console.log(`  Result: FAIL`);
    for (const check of failed) {
      console.log(`  - ${check.name}: ${check.details}`);
    }
  }

  console.log(
    `\nOverall timing: world=${overallTimings.worldModelMs.toFixed(0)}ms turn=${overallTimings.turnSimulatorMs.toFixed(0)}ms branch=${overallTimings.branchMs.toFixed(0)}ms society=${overallTimings.societyMs.toFixed(0)}ms summary=${overallTimings.summaryMs.toFixed(0)}ms`,
  );
}

function readConfig(): EvaluationConfig {
  const mode = process.env.XMOCHA_EVAL_MODE === "smoke" ? "smoke" : "full";
  const scenarioIds = process.env.XMOCHA_EVAL_SCENARIOS
    ? new Set(
        process.env.XMOCHA_EVAL_SCENARIOS.split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      )
    : undefined;
  const maxScenarios =
    process.env.XMOCHA_EVAL_MAX_SCENARIOS
      ? Number(process.env.XMOCHA_EVAL_MAX_SCENARIOS)
      : undefined;
  const maxTurnsOverride =
    process.env.XMOCHA_EVAL_MAX_TURNS
      ? Number(process.env.XMOCHA_EVAL_MAX_TURNS)
      : mode === "smoke"
        ? 1
        : undefined;

  return {
    mode,
    scenarioIds,
    maxScenarios: Number.isFinite(maxScenarios) ? maxScenarios : undefined,
    maxTurnsOverride:
      Number.isFinite(maxTurnsOverride) && (maxTurnsOverride ?? 0) > 0
        ? maxTurnsOverride
        : undefined,
  };
}

function selectScenarios(config: EvaluationConfig): EvaluationScenario[] {
  let scenarios = evaluationScenarios;

  if (config.scenarioIds && config.scenarioIds.size > 0) {
    scenarios = scenarios.filter((scenario) => config.scenarioIds?.has(scenario.id));
  }

  if (config.mode === "smoke") {
    scenarios = scenarios.slice(0, 1);
  }

  if (config.maxScenarios && config.maxScenarios > 0) {
    scenarios = scenarios.slice(0, config.maxScenarios);
  }

  return scenarios;
}

function createEmptyTimings(): TimingMetrics {
  return {
    worldModelMs: 0,
    turnSimulatorMs: 0,
    branchMs: 0,
    societyMs: 0,
    summaryMs: 0,
  };
}

function copyTimings(source: TimingMetrics): TimingMetrics {
  return { ...source };
}

function addTimings(left: TimingMetrics, right: TimingMetrics): TimingMetrics {
  return {
    worldModelMs: left.worldModelMs + right.worldModelMs,
    turnSimulatorMs: left.turnSimulatorMs + right.turnSimulatorMs,
    branchMs: left.branchMs + right.branchMs,
    societyMs: left.societyMs + right.societyMs,
    summaryMs: left.summaryMs + right.summaryMs,
  };
}

function diffTimings(start: TimingMetrics, end: TimingMetrics): TimingMetrics {
  return {
    worldModelMs: end.worldModelMs - start.worldModelMs,
    turnSimulatorMs: end.turnSimulatorMs - start.turnSimulatorMs,
    branchMs: end.branchMs - start.branchMs,
    societyMs: end.societyMs - start.societyMs,
    summaryMs: end.summaryMs - start.summaryMs,
  };
}

class TimedWorldModelProvider implements WorldModelProvider {
  constructor(
    private readonly inner: WorldModelProvider,
    private readonly timings: TimingMetrics,
  ) {}

  async getContext(session: SessionState): Promise<WorldContext> {
    const started = performance.now();
    try {
      return await this.inner.getContext(session);
    } finally {
      this.timings.worldModelMs += performance.now() - started;
    }
  }
}

class TimedTurnSimulator implements TurnSimulator {
  constructor(
    private readonly inner: TurnSimulator,
    private readonly timings: TimingMetrics,
  ) {}

  async simulate(input: TurnGenerationInput): Promise<TurnSimulationResult> {
    const started = performance.now();
    try {
      return await this.inner.simulate(input);
    } finally {
      this.timings.turnSimulatorMs += performance.now() - started;
    }
  }
}

class TimedBranchGenerator implements BranchGenerator {
  constructor(
    private readonly inner: BranchGenerator,
    private readonly timings: TimingMetrics,
  ) {}

  async generate(input: TurnGenerationInput): Promise<TurnDraft> {
    const started = performance.now();
    try {
      return await this.inner.generate(input);
    } finally {
      this.timings.branchMs += performance.now() - started;
    }
  }
}

class TimedSocietySimulator implements SocietySimulator {
  constructor(
    private readonly inner: SocietySimulator,
    private readonly timings: TimingMetrics,
  ) {}

  async simulate(input: SocietySimulationInput): Promise<BranchCommunity[]> {
    const started = performance.now();
    try {
      return await this.inner.simulate(input);
    } finally {
      this.timings.societyMs += performance.now() - started;
    }
  }
}

class TimedSummaryGenerator implements SummaryGenerator {
  constructor(
    private readonly inner: SummaryGenerator,
    private readonly timings: TimingMetrics,
  ) {}

  async generate(session: SessionState): Promise<SessionSummary> {
    const started = performance.now();
    try {
      return await this.inner.generate(session);
    } finally {
      this.timings.summaryMs += performance.now() - started;
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : `Unknown evaluation error: ${String(error)}`,
  );
  process.exitCode = 1;
});
