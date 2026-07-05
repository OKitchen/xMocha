import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type {
  BranchGenerator,
  SummaryGenerator,
} from "../../application/ports";
import { TurnOrchestrator } from "../../application/turn-orchestrator";
import {
  getPresetScenarioDefaultTheme,
  getPresetScenarioPack,
  isPresetScenarioId,
} from "../../domain/preset-scenarios";
import { createSession } from "../../domain/session-engine";
import type {
  Branch,
  OutputLanguage,
  PresetScenarioId,
  RiskProfile,
  SessionState,
  Theme,
  UserAuthoredActionInput,
  UserContextPackInput,
} from "../../domain/types";
import { FileSessionRepository } from "../../infrastructure/persistence/file-session-repository";
import {
  createBranchGenerator,
  createSummaryGenerator,
  createTurnOrchestrator,
} from "../../infrastructure/runtime/create-runtime";

type TurnChoice =
  | { kind: "branch"; branchId: string }
  | { kind: "custom"; action: UserAuthoredActionInput };

function printBranch(branch: Branch, index: number): void {
  console.log(
    `  ${index + 1}. ${branch.title} [${branch.riskProfile}] -> ${branch.consequence}`,
  );
  console.log(`     ${branch.summary}`);
}

async function main(): Promise<void> {
  const repository = new FileSessionRepository();
  const command = process.argv[2] ?? "start";

  if (command === "list") {
    await listSessions(repository);
    return;
  }

  if (command === "resume") {
    const sessionId = process.argv[3];
    await resumeSession(sessionId, repository);
    return;
  }

  if (command === "start") {
    const summaryGenerator = createSummaryGenerator();
    const orchestrator = createTurnOrchestrator();
    const session = await createInteractiveSession();
    await runSession(session, repository, orchestrator, summaryGenerator);
    return;
  }

  throw new Error(
    `Unsupported command "${command}". Use "start", "list", or "resume <sessionId>".`,
  );
}

async function runSession(
  initialSession: SessionState,
  repository: FileSessionRepository,
  orchestrator: TurnOrchestrator,
  summaryGenerator: SummaryGenerator,
): Promise<void> {
  let session = initialSession;
  await repository.save(session);

  console.log("\nxMocha 交互式 session");
  console.log(`Session: ${session.sessionId}`);
  if (session.presetScenarioId) {
    console.log(`预设场景: ${session.presetScenarioId}`);
  }
  console.log(`困境: ${session.dilemma}`);

  while (session.status === "active" && session.turn < session.maxTurns) {
    const turn = await orchestrator.generateTurn(session);

    console.log(`\nTurn ${turn.turnNumber}`);
    if (turn.groundingContext) {
      console.log(
        `Grounding: ${turn.groundingContext.scenarioTitle} -> ${turn.groundingContext.worldContext.currentWorldPressure}`,
      );
    }
    turn.branches.forEach(printBranch);

    const choice = await chooseTurnAction(turn.branches, session.turn);

    if (!choice) {
      throw new Error("No turn action available to select.");
    }

    if (choice.kind === "branch") {
      console.log(`Selected branch: ${choice.branchId}`);
      session = orchestrator.chooseBranch(session, turn, choice.branchId);
    } else {
      console.log(`Selected custom action: ${choice.action.rawInput}`);
      session = orchestrator.chooseUserAuthoredAction(session, turn, choice.action);
    }
    await repository.save(session);

    console.log("Quantum trace:");
    session.quantumTrace.forEach((entry) => console.log(`  - ${entry}`));
  }

  if (!session.summary) {
    const summary = await summaryGenerator.generate(session);
    session = {
      ...session,
      summary,
    };
    await repository.save(session);
  }

  printSessionCompletion(session);
}

async function listSessions(repository: FileSessionRepository): Promise<void> {
  const sessions = await repository.list();

  if (sessions.length === 0) {
    console.log("No saved sessions found.");
    return;
  }

  console.log("\nSaved sessions:");
  for (const session of sessions) {
    const dilemma = truncate(session.dilemma, 60);
    console.log(
      `- ${session.sessionId} | ${session.status} | turn ${session.turn}/${session.maxTurns} | ${dilemma}`,
    );
  }
}

async function resumeSession(
  sessionId: string | undefined,
  repository: FileSessionRepository,
): Promise<void> {
  const targetSessionId =
    sessionId ?? (await chooseSessionToResume(repository));

  if (!targetSessionId) {
    console.log("No session selected.");
    return;
  }

  const session = await repository.load(targetSessionId);

  if (!session) {
    throw new Error(`Session "${targetSessionId}" was not found.`);
  }

  if (session.status === "complete" && session.summary) {
    console.log(`Resumed completed session: ${session.sessionId}`);
    printSessionCompletion(session);
    return;
  }

  const summaryGenerator = createSummaryGenerator();
  const orchestrator = createTurnOrchestrator();

  console.log(`Resuming session ${session.sessionId}...`);
  await runSession(session, repository, orchestrator, summaryGenerator);
}

async function createInteractiveSession(): Promise<SessionState> {
  const presetScenarioId = normalizePresetScenarioId(
    process.env.XMOCHA_PRESET_SCENARIO,
  );

  if (process.env.XMOCHA_AUTOPILOT === "1") {
    const presetScenario = getPresetScenarioPack(presetScenarioId);
    return createSession({
      dilemma:
        process.env.XMOCHA_DEMO_DILEMMA ??
        presetScenario?.baseDilemma ??
        "Should I accept a startup offer or stay in my stable current role?",
      theme:
        (process.env.XMOCHA_THEME as Theme | undefined) ??
        getPresetScenarioDefaultTheme(presetScenarioId),
      language: normalizeOutputLanguage(process.env.XMOCHA_LANGUAGE),
      maxTurns: Number(process.env.XMOCHA_MAX_TURNS ?? "2"),
      presetScenarioId,
      userContextPack: presetScenario
        ? {
            userGoal: process.env.XMOCHA_USER_GOAL,
            currentPosition: process.env.XMOCHA_CURRENT_POSITION,
            riskPreference: normalizeRiskProfile(
              process.env.XMOCHA_USER_RISK_PREFERENCE ?? "",
            ),
            timeHorizon: process.env.XMOCHA_USER_TIME_HORIZON,
            personalConstraints: splitCommaSeparatedEnv(
              process.env.XMOCHA_USER_CONSTRAINTS,
            ),
            keyStakeholders: splitCommaSeparatedEnv(
              process.env.XMOCHA_USER_STAKEHOLDERS,
            ),
          }
        : undefined,
    });
  }

  const rl = createInterface({ input, output });

  try {
    const presetInput = (
      await rl.question(
        "选择预设场景 [none|ai_future_of_work]（默认: none）\n> ",
      )
    ).trim();
    const interactivePresetScenarioId = normalizePresetScenarioId(presetInput);
    const presetScenario = getPresetScenarioPack(interactivePresetScenarioId);
    const dilemma =
      (
        await rl.question(
          presetScenario
            ? `你想探索什么困境？直接回车使用预设默认值。\n> `
            : "你想探索什么困境？\n> ",
        )
      ).trim() ||
      presetScenario?.baseDilemma ||
      "Should I accept a startup offer or stay in my stable current role?";

    const themeInput =
      (
        await rl.question(
          `Choose a theme [adventure|sci-fi|dream|hell|humorous] (default: ${presetScenario?.theme ?? "sci-fi"})\n> `,
        )
      ).trim() || "sci-fi";

    const maxTurnsInput =
      (
        await rl.question(
          "模拟几轮？（默认: 2）\n> ",
        )
      ).trim() || "2";

    const normalizedTheme = normalizeTheme(themeInput);
    const maxTurns = normalizeMaxTurns(maxTurnsInput);
    const userContextPack = presetScenario
      ? await chooseUserContextPackOverride(rl, presetScenario.scenarioId)
      : undefined;

    return createSession({
      dilemma,
      theme: presetScenario ? presetScenario.theme : normalizedTheme,
      language: normalizeOutputLanguage(process.env.XMOCHA_LANGUAGE),
      maxTurns,
      presetScenarioId: interactivePresetScenarioId,
      userContextPack,
    });
  } finally {
    rl.close();
  }
}

function normalizeOutputLanguage(value: string | undefined): OutputLanguage {
  return value === "zh-CN" ? "zh-CN" : "en";
}

async function chooseTurnAction(
  branches: Branch[],
  step: number,
): Promise<TurnChoice | undefined> {
  if (process.env.XMOCHA_AUTOPILOT === "1") {
    return {
      kind: "branch",
      branchId: step === 0 ? branches[0]?.id ?? "b1" : branches[1]?.id ?? branches[0]?.id ?? "b1",
    };
  }

  const rl = createInterface({ input, output });

  try {
    const rawChoice = (
      await rl.question(
        `选择分支 [1-${branches.length}]，输入 "c" 自定义行动，或直接回车选择 1\n> `,
      )
    ).trim();

    if (rawChoice.toLowerCase() === "c") {
      const rawInput = (
        await rl.question("描述你自己的行动 / 想法 / 决定\n> ")
      ).trim();

      if (!rawInput) {
        console.log("自定义行动为空，默认选择分支 1。");
        return {
          kind: "branch",
          branchId: branches[0]?.id ?? "b1",
        };
      }

      const riskInput = (
        await rl.question(
          "可选风险画像 [low|medium|high]（默认: medium）\n> ",
        )
      ).trim();
      const anchorInput = (
        await rl.question(
          `可选关联分支 [1-${branches.length}]，或直接回车表示无\n> `,
        )
      ).trim();

      return {
        kind: "custom",
        action: {
          rawInput,
          riskProfile: normalizeRiskProfile(riskInput),
          anchorBranchId: normalizeAnchorBranchId(anchorInput, branches),
        },
      };
    }

    const index = rawChoice === "" ? 0 : Number(rawChoice) - 1;

    if (!Number.isInteger(index) || index < 0 || index >= branches.length) {
      console.log("选择无效，默认选择分支 1。");
      return {
        kind: "branch",
        branchId: branches[0]?.id ?? "b1",
      };
    }

    return {
      kind: "branch",
      branchId: branches[index]?.id ?? branches[0]?.id ?? "b1",
    };
  } finally {
    rl.close();
  }
}

async function chooseSessionToResume(
  repository: FileSessionRepository,
): Promise<string | undefined> {
  const sessions = await repository.list();

  if (sessions.length === 0) {
    console.log("No saved sessions found.");
    return undefined;
  }

  if (process.env.XMOCHA_AUTOPILOT === "1") {
    return sessions[0]?.sessionId;
  }

  console.log("\nSaved sessions:");
  sessions.forEach((session, index) => {
    console.log(
      `  ${index + 1}. ${session.sessionId} | ${session.status} | turn ${session.turn}/${session.maxTurns} | ${truncate(session.dilemma, 50)}`,
    );
  });

  const rl = createInterface({ input, output });

  try {
    const rawChoice = (
      await rl.question(
        `Choose a session [1-${sessions.length}] or press Enter for 1\n> `,
      )
    ).trim();

    const index = rawChoice === "" ? 0 : Number(rawChoice) - 1;

    if (!Number.isInteger(index) || index < 0 || index >= sessions.length) {
      console.log("Invalid selection. Defaulting to session 1.");
      return sessions[0]?.sessionId;
    }

    return sessions[index]?.sessionId;
  } finally {
    rl.close();
  }
}

function printSessionCompletion(session: SessionState): void {
  console.log("\nCanonical path:");
  session.canonicalPath.forEach((step) => {
    console.log(`  Turn ${step.turn}: ${step.title} -> ${step.consequence}`);
  });

  if (session.shadowTimelines.length > 0) {
    console.log("\nShadow timelines:");
    session.shadowTimelines.forEach((branches, index) => {
      console.log(`  Turn ${index + 1} roads not taken:`);
      branches.forEach((branch) => {
        console.log(`    - ${branch.title} -> ${branch.consequence}`);
      });
    });
  }

  console.log("\nFinal persona:");
  console.log(session.userPersona);

  if (session.summary) {
    console.log("\nSummary:");
    console.log(session.summary.narrative);
    console.log("\nDecision arc:");
    session.summary.decisionArc.forEach((item) => console.log(`  - ${item}`));
    if (session.summary.alternateHint) {
      console.log(`\nAlternate reality: ${session.summary.alternateHint}`);
    }
  }

  console.log(`Status: ${session.status}`);
  console.log(`Saved to repository as ${session.sessionId}.json`);
}

function normalizeTheme(inputTheme: string): Theme {
  const theme = inputTheme.toLowerCase();

  if (
    theme === "adventure" ||
    theme === "sci-fi" ||
    theme === "dream" ||
    theme === "hell" ||
    theme === "humorous"
  ) {
    return theme;
  }

  return "sci-fi";
}

function normalizeMaxTurns(inputTurns: string): number {
  const turns = Number(inputTurns);

  if (!Number.isInteger(turns) || turns <= 0) {
    return 2;
  }

  return Math.min(turns, 5);
}

function normalizeRiskProfile(inputRisk: string): RiskProfile | undefined {
  const risk = inputRisk.toLowerCase();

  if (risk === "low" || risk === "medium" || risk === "high") {
    return risk;
  }

  return undefined;
}

function normalizeAnchorBranchId(
  inputValue: string,
  branches: Branch[],
): string | undefined {
  if (!inputValue) {
    return undefined;
  }

  const index = Number(inputValue) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= branches.length) {
    return undefined;
  }

  return branches[index]?.id;
}

function normalizePresetScenarioId(
  value: string | undefined,
): PresetScenarioId | undefined {
  if (!value || value === "none") {
    return undefined;
  }

  return isPresetScenarioId(value) ? value : undefined;
}

async function chooseUserContextPackOverride(
  rl: ReturnType<typeof createInterface>,
  presetScenarioId: PresetScenarioId,
): Promise<UserContextPackInput | undefined> {
  if (presetScenarioId !== "ai_future_of_work") {
    return undefined;
  }

  console.log("\nai_future_of_work 的可选用户上下文覆盖。");
  console.log("直接回车表示保留预设默认值。");

  const userGoal = (
    await rl.question("用户目标覆盖\n> ")
  ).trim();
  const currentPosition = (
    await rl.question("当前处境覆盖\n> ")
  ).trim();
  const riskPreference = normalizeRiskProfile(
    (
      await rl.question("风险偏好覆盖 [low|medium|high]\n> ")
    ).trim(),
  );
  const timeHorizon = (
    await rl.question("时间范围覆盖\n> ")
  ).trim();
  const personalConstraints = splitCommaSeparatedInput(
    (
      await rl.question("个人约束覆盖 [用英文逗号分隔]\n> ")
    ).trim(),
  );
  const keyStakeholders = splitCommaSeparatedInput(
    (
      await rl.question("关键利益相关者覆盖 [用英文逗号分隔]\n> ")
    ).trim(),
  );

  if (
    !userGoal &&
    !currentPosition &&
    !riskPreference &&
    !timeHorizon &&
    !personalConstraints &&
    !keyStakeholders
  ) {
    return undefined;
  }

  return {
    userGoal: userGoal || undefined,
    currentPosition: currentPosition || undefined,
    riskPreference,
    timeHorizon: timeHorizon || undefined,
    personalConstraints,
    keyStakeholders,
  };
}

function splitCommaSeparatedInput(value: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCommaSeparatedEnv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return splitCommaSeparatedInput(value);
}

function truncate(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 3)}...`;
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    if (
      error.message.includes("DEEPSEEK_API_KEY is required") ||
      error.message.includes("ANTHROPIC_API_KEY is required") ||
      error.message.includes("HF_TOKEN or GEMMA_API_KEY is required") ||
      error.message.includes("Unsupported GEMMA_RUNTIME") ||
      error.message.includes("Unsupported XMOCHA_MODEL_PROVIDER") ||
      error.message.includes("Unsupported command")
    ) {
      console.error(error.message);
      console.error(
        'Set the matching API key to run the real structured generator. For the hackathon Gemma 4 path, set `HF_TOKEN` and `GEMMA_RUNTIME=huggingface`, then run `npm run dev:gemma`. Use `npm run dev:mock` for the fallback harness, or run commands like `npm run dev -- list` and `npm run dev -- resume <sessionId>`.',
      );
      process.exitCode = 1;
      return;
    }

    console.error(error);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
