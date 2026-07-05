import { performance } from "node:perf_hooks";

import { createSession } from "../../domain/session-engine";
import type { Branch, RiskProfile, SessionState, UserContextPackInput } from "../../domain/types";
import {
  createSummaryGenerator,
  createTurnOrchestrator,
} from "../../infrastructure/runtime/create-runtime";

type RunCase = {
  id: string;
  userContextPack: UserContextPackInput;
  firstTurnStrategy: "conservative" | "aggressive";
};

type TurnSnapshot = {
  turn: number;
  chosenBranchTitle: string;
  chosenRisk: RiskProfile;
  worldPressure?: string;
  branchTitles: string[];
};

async function main(): Promise<void> {
  const runCases: RunCase[] = [
    {
      id: "stability-first__conservative",
      firstTurnStrategy: "conservative",
      userContextPack: {
        userGoal: "Stay trusted while adapting to AI without destabilizing income.",
        currentPosition: "Senior IC with important roadmap ownership.",
        riskPreference: "low",
        timeHorizon: "12 months",
        personalConstraints: ["Cannot absorb a visible failed experiment this quarter."],
        keyStakeholders: ["manager", "teammates", "family"],
      },
    },
    {
      id: "stability-first__aggressive",
      firstTurnStrategy: "aggressive",
      userContextPack: {
        userGoal: "Stay trusted while adapting to AI without destabilizing income.",
        currentPosition: "Senior IC with important roadmap ownership.",
        riskPreference: "low",
        timeHorizon: "12 months",
        personalConstraints: ["Cannot absorb a visible failed experiment this quarter."],
        keyStakeholders: ["manager", "teammates", "family"],
      },
    },
    {
      id: "ambition-first__conservative",
      firstTurnStrategy: "conservative",
      userContextPack: {
        userGoal: "Become the visible internal AI transition lead.",
        currentPosition: "Senior IC with appetite for expanded influence.",
        riskPreference: "high",
        timeHorizon: "9 months",
        personalConstraints: ["Need visible momentum before org boundaries harden."],
        keyStakeholders: ["manager", "platform lead", "executive sponsor"],
      },
    },
    {
      id: "ambition-first__aggressive",
      firstTurnStrategy: "aggressive",
      userContextPack: {
        userGoal: "Become the visible internal AI transition lead.",
        currentPosition: "Senior IC with appetite for expanded influence.",
        riskPreference: "high",
        timeHorizon: "9 months",
        personalConstraints: ["Need visible momentum before org boundaries harden."],
        keyStakeholders: ["manager", "platform lead", "executive sponsor"],
      },
    },
  ];

  const orchestrator = createTurnOrchestrator();
  const summaryGenerator = createSummaryGenerator();
  const started = performance.now();

  for (const runCase of runCases) {
    let session = createSession({
      presetScenarioId: "ai_future_of_work",
      maxTurns: 3,
      userContextPack: runCase.userContextPack,
    });

    const snapshots: TurnSnapshot[] = [];

    while (session.status === "active" && session.turn < session.maxTurns) {
      const turn = await orchestrator.generateTurn(session);
      const chosenBranch = chooseBranch(turn.branches, session.turn, runCase.firstTurnStrategy);
      snapshots.push({
        turn: turn.turnNumber,
        chosenBranchTitle: chosenBranch.title,
        chosenRisk: chosenBranch.riskProfile,
        worldPressure: turn.groundingContext?.worldContext.currentWorldPressure,
        branchTitles: turn.branches.map((branch) => branch.title),
      });
      session = orchestrator.chooseBranch(session, turn, chosenBranch.id);
    }

    const summary = await summaryGenerator.generate(session);
    printRunCase(runCase, snapshots, summary.narrative);
  }

  console.log(`\nManual benchmark finished in ${Math.round(performance.now() - started)}ms.`);
}

function chooseBranch(
  branches: Branch[],
  currentTurn: number,
  strategy: RunCase["firstTurnStrategy"],
): Branch {
  if (currentTurn === 0) {
    const prioritized = [...branches].sort((left, right) => {
      return strategy === "conservative"
        ? riskRank(left.riskProfile) - riskRank(right.riskProfile)
        : riskRank(right.riskProfile) - riskRank(left.riskProfile);
    });

    return prioritized[0] ?? branches[0]!;
  }

  return [...branches].sort((left, right) => right.score - left.score)[0] ?? branches[0]!;
}

function riskRank(risk: RiskProfile): number {
  if (risk === "low") return 0;
  if (risk === "medium") return 1;
  return 2;
}

function printRunCase(
  runCase: RunCase,
  snapshots: TurnSnapshot[],
  narrative: string,
): void {
  console.log(`\n=== Manual benchmark: ${runCase.id} ===`);
  console.log(`User goal: ${runCase.userContextPack.userGoal}`);
  console.log(`Risk preference: ${runCase.userContextPack.riskPreference ?? "medium"}`);
  console.log(`First-turn strategy: ${runCase.firstTurnStrategy}`);

  for (const snapshot of snapshots) {
    console.log(`\nTurn ${snapshot.turn}`);
    console.log(`Chosen: ${snapshot.chosenBranchTitle} [${snapshot.chosenRisk}]`);
    if (snapshot.worldPressure) {
      console.log(`World pressure: ${snapshot.worldPressure}`);
    }
    console.log(`Branch set: ${snapshot.branchTitles.join(" | ")}`);
  }

  console.log(`\nSummary excerpt: ${narrative.slice(0, 400)}${narrative.length > 400 ? "..." : ""}`);
  console.log("\nReviewer notes:");
  console.log("- Entanglement signal: strong | partial | weak");
  console.log("- Grounding signal: strong | partial | weak");
  console.log("- Society signal: worth it | situational | not worth it");
  console.log("- Notes:");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
