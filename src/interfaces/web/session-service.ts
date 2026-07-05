import { buildAblationReport } from "../../domain/ablation-report";
import { createSession } from "../../domain/session-engine";
import {
  appendAnalyticsEvent,
  appendGenerationFailure,
} from "../../domain/session-telemetry";
import {
  assertSessionOwnerAccess,
  assertSessionReadAccess,
  createSessionAccessToken,
  hashSessionAccessToken,
  hasSessionOwnerAccess,
} from "../../domain/session-access";
import { inferDilemmaKind } from "../../domain/dilemma-kind";
import { normalizeUserProvidedDataInput } from "../../domain/user-provided-data";
import type {
  AblationReport,
  GenerationFailureStage,
  SessionModelConfig,
  OutputLanguage,
  PresetScenarioId,
  SessionState,
  SessionAnalyticsEventName,
  SessionSummary,
  Theme,
  TurnGenerationResult,
  UserAuthoredActionInput,
  UserContextPackInput,
  UserProvidedDataInput,
  VisualMode,
  VisualStyle,
} from "../../domain/types";
import { withRuntimeModelConfig } from "../../infrastructure/llm/runtime-model-config";
import {
  createFallbackSummaryGenerator,
  createFallbackTurnOrchestrator,
  createSessionRepository,
  createSummaryGenerator,
  createTurnOrchestrator,
} from "../../infrastructure/runtime/create-runtime";
import {
  chooseWorldTurnAction,
  projectSessionForClient,
  retryWorldTurn,
} from "./world-session-service";

const generationTimeoutMs = Math.max(
  1000,
  Number(process.env.XMOCHA_GENERATION_TIMEOUT_MS) || 30000,
);

class GenerationTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out after ${generationTimeoutMs}ms.`);
    this.name = "GenerationTimeoutError";
  }
}

export type StartedWebSession = {
  session: SessionState;
  accessToken: string;
};

export async function startWebSession(params: {
  dilemma?: string;
  theme?: Theme;
  language?: OutputLanguage;
  visualMode?: VisualMode;
  visualStyle?: VisualStyle;
  modelConfig?: SessionModelConfig;
  maxTurns?: number;
  presetScenarioId?: PresetScenarioId;
  userContextPack?: UserContextPackInput;
  userProvidedData?: UserProvidedDataInput;
}): Promise<StartedWebSession> {
  const repository = createSessionRepository();
  const accessToken = createSessionAccessToken();

  let session = appendAnalyticsEvent(
    createSession({
      dilemma: params.dilemma,
      theme: params.theme,
      language: params.language,
      visualMode: params.visualMode,
      visualStyle: params.visualStyle,
      modelConfig: params.modelConfig,
      maxTurns: params.maxTurns,
      presetScenarioId: params.presetScenarioId,
      sessionAccessTokenHash: hashSessionAccessToken(accessToken),
      userContextPack: params.userContextPack,
      userProvidedData: params.userProvidedData,
    }),
    "session_started",
  );

  const turnResult = await generateTurnWithFallback(session, "start_session");
  session = turnResult.session;

  if (!turnResult.turn) {
    await repository.save(session);
    throw new Error("Unable to generate the first turn, including fallback.");
  }

  const sessionWithPendingTurn = appendAnalyticsEvent(
    {
      ...session,
      pendingTurn: turnResult.turn,
    },
    "first_turn_generated",
    {
      fallback: turnResult.usedFallback,
    },
  );

  await repository.save(sessionWithPendingTurn);
  return { session: sessionWithPendingTurn, accessToken };
}

export async function retryWebTurnGeneration(params: {
  sessionId: string;
  accessToken?: string;
}): Promise<SessionState> {
  const repository = createSessionRepository();
  const session = await repository.load(params.sessionId);

  if (!session) {
    throw new Error(`Session "${params.sessionId}" was not found.`);
  }

  const normalizedSession = normalizeSessionArrays(session);

  if (normalizedSession.mode === "world") {
    return retryWorldTurn({
      session: normalizedSession,
      accessToken: params.accessToken,
    });
  }

  assertSessionOwnerAccess(normalizedSession, params.accessToken);

  if (normalizedSession.pendingTurn) {
    if (isPendingTurnOffDilemma(normalizedSession, normalizedSession.pendingTurn)) {
      const repairedSession = await prepareNextWebSessionState({
        ...normalizedSession,
        pendingTurn: undefined,
      });
      await repository.save(repairedSession);
      return repairedSession;
    }

    return normalizedSession;
  }

  if (normalizedSession.status === "complete" && normalizedSession.summary) {
    return normalizedSession;
  }

  const preparedSession = await prepareNextWebSessionState(
    normalizedSession,
  );
  await repository.save(preparedSession);
  return preparedSession;
}

export async function trackWebAnalyticsEvent(params: {
  sessionId: string;
  eventName: SessionAnalyticsEventName;
  metadata?: Record<string, string | number | boolean>;
  accessToken?: string;
}): Promise<SessionState> {
  const repository = createSessionRepository();
  const session = await repository.load(params.sessionId);

  if (!session) {
    throw new Error(`Session "${params.sessionId}" was not found.`);
  }
  assertSessionOwnerAccess(session, params.accessToken);

  const nextSession = appendAnalyticsEvent(
    normalizeSessionArrays(session),
    params.eventName,
    params.metadata,
  );

  await repository.save(nextSession);
  return nextSession;
}

export async function submitWebFeedback(params: {
  sessionId: string;
  helpful: boolean;
  recommendationScore: number;
  accessToken?: string;
}): Promise<SessionState> {
  const repository = createSessionRepository();
  const session = await repository.load(params.sessionId);

  if (!session) {
    throw new Error(`Session "${params.sessionId}" was not found.`);
  }
  assertSessionOwnerAccess(session, params.accessToken);

  const normalizedSession = normalizeSessionArrays(session);
  if (normalizedSession.status !== "complete") {
    throw new Error("Feedback can only be submitted for a completed session.");
  }

  const alreadySubmitted = normalizedSession.analyticsEvents.some(
    (event) => event.name === "feedback_submitted",
  );

  if (alreadySubmitted) {
    return normalizedSession;
  }

  const nextSession = appendAnalyticsEvent(
    normalizedSession,
    "feedback_submitted",
    {
      helpful: params.helpful,
      recommendationScore: params.recommendationScore,
    },
  );

  await repository.save(nextSession);
  return nextSession;
}

export async function getWebSession(
  sessionId: string,
  accessToken?: string,
): Promise<SessionState | null> {
  const repository = createSessionRepository();
  const session = await repository.load(sessionId);
  if (!session) return null;

  const repaired = hideOffDilemmaPendingTurnForClient(
    repairDecisionSessionForClient(normalizeSessionArrays(session)),
  );
  assertSessionReadAccess(repaired, accessToken);
  return projectWebSessionForClient(repaired, accessToken);
}

export async function getOwnedWebSession(
  sessionId: string,
  accessToken?: string,
): Promise<SessionState | null> {
  const repository = createSessionRepository();
  const session = await repository.load(sessionId);
  if (!session) return null;

  const repaired = hideOffDilemmaPendingTurnForClient(
    repairDecisionSessionForClient(normalizeSessionArrays(session)),
  );
  assertSessionOwnerAccess(repaired, accessToken);
  return projectWebSessionForClient(repaired, accessToken);
}

export async function getWebAblationReport(
  sessionId: string,
  accessToken?: string,
): Promise<AblationReport | null> {
  const repository = createSessionRepository();
  const session = await repository.load(sessionId);

  if (!session) {
    return null;
  }
  assertSessionReadAccess(session, accessToken);

  return buildAblationReport(session);
}

export async function chooseWebBranch(params: {
  sessionId: string;
  branchId: string;
}): Promise<SessionState> {
  return chooseWebTurnAction({
    sessionId: params.sessionId,
    branchId: params.branchId,
  });
}

export async function chooseWebTurnAction(params: {
  sessionId: string;
  branchId?: string;
  authoredAction?: UserAuthoredActionInput;
  expectedRevision?: number;
  accessToken?: string;
}): Promise<SessionState> {
  const repository = createSessionRepository();
  const session = await repository.load(params.sessionId);

  if (!session) {
    throw new Error(`Session "${params.sessionId}" was not found.`);
  }

  const normalizedSession = normalizeSessionArrays(session);

  if (normalizedSession.mode === "world") {
    return chooseWorldTurnAction({
      session: normalizedSession,
      branchId: params.branchId,
      authoredAction: params.authoredAction,
      expectedRevision: params.expectedRevision,
      accessToken: params.accessToken,
    });
  }
  assertSessionOwnerAccess(normalizedSession, params.accessToken);
  const pendingTurn = normalizedSession.pendingTurn;

  if (!pendingTurn) {
    throw new Error(`Session "${params.sessionId}" has no pending turn.`);
  }

  const orchestrator = createTurnOrchestrator();
  let nextSession: SessionState;

  if (params.authoredAction) {
    if (!params.authoredAction.rawInput.trim()) {
      throw new Error("authoredAction.rawInput is required.");
    }

    try {
      nextSession = orchestrator.chooseUserAuthoredAction(
        normalizedSession,
        pendingTurn,
        params.authoredAction,
      );
    } catch (error) {
      const failedSession = appendGenerationFailure(normalizedSession, {
        stage: "choose_branch",
        error,
        recoverable: false,
        fallbackUsed: false,
      });
      await repository.save(failedSession);
      throw error;
    }
  } else if (params.branchId) {
    try {
      nextSession = orchestrator.chooseBranch(
        normalizedSession,
        pendingTurn,
        params.branchId,
      );
    } catch (error) {
      const failedSession = appendGenerationFailure(normalizedSession, {
        stage: "choose_branch",
        error,
        recoverable: false,
        fallbackUsed: false,
      });
      await repository.save(failedSession);
      throw error;
    }
  } else {
    throw new Error("Either branchId or authoredAction is required.");
  }

  const selectedStep = nextSession.canonicalPath.at(-1);
  const collapsedSession = appendAnalyticsEvent(
    {
      ...normalizeSessionArrays(nextSession),
      pendingTurn: undefined,
    },
    "branch_selected",
    {
      branchId: params.branchId,
      selectedBranchTitle: selectedStep?.title,
      authoredAction: Boolean(params.authoredAction),
    },
  );

  await repository.save(collapsedSession);

  nextSession = await prepareNextWebSessionState(
    collapsedSession,
    selectedStep?.title,
  );
  await repository.save(nextSession);
  return nextSession;
}

export function projectWebSessionForClient(
  session: SessionState,
  accessToken?: string,
): SessionState {
  const owner = hasSessionOwnerAccess(session, accessToken);
  const projected = stripSessionAccessHashes(projectSessionForClient(session));
  return owner ? projected : redactPublicSession(projected);
}

function stripSessionAccessHashes(session: SessionState): SessionState {
  return {
    ...session,
    sessionAccessTokenHash: undefined,
    worldAccessTokenHash: undefined,
  };
}

function redactPublicSession(session: SessionState): SessionState {
  return {
    ...session,
    userContextPack: undefined,
    userProvidedData: undefined,
    groundingLog: [],
    analyticsEvents: [],
    generationFailures: [],
  };
}

async function prepareNextWebSessionState(
  session: SessionState,
  selectedBranchTitle?: string,
): Promise<SessionState> {
  if (session.status === "complete") {
    const summaryResult = await generateSummaryWithFallback(
      {
        ...session,
        pendingTurn: undefined,
      },
      selectedBranchTitle,
    );

    return appendAnalyticsEvent(
      {
        ...summaryResult.session,
        pendingTurn: undefined,
        summary: summaryResult.summary,
      },
      "session_completed",
      {
        fallback: summaryResult.usedFallback,
        summaryAvailable: Boolean(summaryResult.summary),
      },
    );
  }

  const stage: GenerationFailureStage =
    session.turn === 0 ? "start_session" : "generate_next_turn";
  const turnResult = await generateTurnWithFallback(
    {
      ...session,
      pendingTurn: undefined,
    },
    stage,
    selectedBranchTitle,
  );

  if (!turnResult.turn) {
    return {
      ...turnResult.session,
      pendingTurn: undefined,
    };
  }

  return appendAnalyticsEvent(
    {
      ...turnResult.session,
      pendingTurn: turnResult.turn,
    },
    session.turn === 0 ? "first_turn_generated" : "next_turn_generated",
    {
      fallback: turnResult.usedFallback,
    },
  );
}

async function generateTurnWithFallback(
  session: SessionState,
  stage: GenerationFailureStage,
  selectedBranchTitle?: string,
): Promise<{
  session: SessionState;
  turn?: TurnGenerationResult;
  usedFallback: boolean;
}> {
  let workingSession = normalizeSessionArrays(session);

  try {
    const turn = await withTimeout(
      withRuntimeModelConfig(workingSession.modelConfig, () =>
        createTurnOrchestrator().generateTurn(workingSession),
      ),
      stage,
    );

    return {
      session: workingSession,
      turn,
      usedFallback: false,
    };
  } catch (error) {
    workingSession = appendGenerationFailure(workingSession, {
      stage,
      error,
      recoverable: true,
      fallbackUsed: true,
      selectedBranchTitle,
    });
  }

  try {
    const fallbackTurn = await createFallbackTurnOrchestrator().generateTurn(
      workingSession,
    );

    return {
      session: workingSession,
      turn: fallbackTurn,
      usedFallback: true,
    };
  } catch (error) {
    workingSession = appendGenerationFailure(workingSession, {
      stage,
      error,
      recoverable: true,
      fallbackUsed: false,
      selectedBranchTitle,
    });

    return {
      session: workingSession,
      usedFallback: true,
    };
  }
}

async function generateSummaryWithFallback(
  session: SessionState,
  selectedBranchTitle?: string,
): Promise<{
  session: SessionState;
  summary?: SessionSummary;
  usedFallback: boolean;
}> {
  let workingSession = normalizeSessionArrays(session);

  try {
    const summary = await withTimeout(
      withRuntimeModelConfig(workingSession.modelConfig, () =>
        createSummaryGenerator().generate(workingSession),
      ),
      "summary_generation",
    );

    return {
      session: workingSession,
      summary,
      usedFallback: false,
    };
  } catch (error) {
    workingSession = appendGenerationFailure(workingSession, {
      stage: "summary_generation",
      error,
      recoverable: true,
      fallbackUsed: true,
      selectedBranchTitle,
    });
  }

  try {
    return {
      session: workingSession,
      summary: await createFallbackSummaryGenerator().generate(workingSession),
      usedFallback: true,
    };
  } catch (error) {
    return {
      session: appendGenerationFailure(workingSession, {
        stage: "summary_generation",
        error,
        recoverable: false,
        fallbackUsed: false,
        selectedBranchTitle,
      }),
      usedFallback: true,
    };
  }
}

function normalizeSessionArrays(session: SessionState): SessionState {
  return {
    ...session,
    schemaVersion: session.schemaVersion ?? "session-v1",
    mode: session.mode ?? "decision",
    revision: session.revision ?? 0,
    userAuthoredActions: session.userAuthoredActions ?? [],
    visualHistory: session.visualHistory ?? [],
    influenceEvents: session.influenceEvents ?? [],
    groundingLog: session.groundingLog ?? [],
    generationFailures: session.generationFailures ?? [],
    analyticsEvents: session.analyticsEvents ?? [],
  };
}

function repairDecisionSessionForClient(session: SessionState): SessionState {
  if (session.mode === "world" || !session.userProvidedData) return session;

  const shouldRepairBrief = shouldRepairUserProvidedBrief(
    session.userProvidedData.derivedBrief,
    session.language,
  );
  const repairContext = {
    dilemma: session.dilemma,
    language: session.language,
    userContextPack: shouldRepairBrief
      ? sanitizeUserContextForBriefRepair(session.userContextPack, session.language)
      : session.userContextPack,
  };
  const repairedData = shouldRepairBrief
    ? normalizeUserProvidedDataInput(
        {
          sources: session.userProvidedData.sources.map((source) => ({
            kind: source.kind,
            title: source.title,
            content: source.content,
          })),
          facts: session.userProvidedData.factItems.some((fact) => fact.userConfirmed)
            ? session.userProvidedData.factItems.map((fact) => ({
                type: fact.type,
                label: fact.label,
                value: fact.value,
                summary: fact.summary,
                tags: fact.tags,
                timeScope: fact.timeScope,
                sourceRefIds: fact.sourceRefIds,
                userConfirmed: fact.userConfirmed,
              }))
            : undefined,
        },
        repairContext,
      ) ?? session.userProvidedData
    : session.userProvidedData;

  return {
    ...session,
    userProvidedData: repairedData,
    userContextPack: session.userContextPack
      ? {
          ...session.userContextPack,
          availableOptions:
            repairedData.derivedBrief.activeOptions.length > 0
              ? repairedData.derivedBrief.activeOptions
              : session.userContextPack.availableOptions,
          keyStakeholders:
            repairedData.derivedBrief.keyStakeholders.length > 0
              ? repairedData.derivedBrief.keyStakeholders
              : session.userContextPack.keyStakeholders,
        }
      : session.userContextPack,
    simulationState: session.simulationState
      ? {
          ...session.simulationState,
          stakeholders: repairGenericStakeholdersForClient(
            session.simulationState.stakeholders,
            repairedData.derivedBrief.keyStakeholders,
            session.language,
          ),
        }
      : session.simulationState,
  };
}

function shouldRepairUserProvidedBrief(
  brief: NonNullable<SessionState["userProvidedData"]>["derivedBrief"],
  language: OutputLanguage,
): boolean {
  return isDerivedBriefEmpty(brief) || isDerivedBriefLikelyPolluted(brief, language);
}

function isDerivedBriefEmpty(
  brief: NonNullable<SessionState["userProvidedData"]>["derivedBrief"],
): boolean {
  return !brief.userIntentSummary &&
    brief.activeOptions.length === 0 &&
    brief.openQuestions.length === 0 &&
    brief.keyConstraints.length === 0 &&
    brief.keyStakeholders.length === 0 &&
    brief.decisionPressures.length === 0;
}

function isDerivedBriefLikelyPolluted(
  brief: NonNullable<SessionState["userProvidedData"]>["derivedBrief"],
  language: OutputLanguage,
): boolean {
  return brief.keyStakeholders.some((label) =>
    isPollutedStakeholderLabel(label, language),
  );
}

function sanitizeUserContextForBriefRepair(
  userContextPack: SessionState["userContextPack"],
  language: OutputLanguage,
): SessionState["userContextPack"] {
  if (!userContextPack) return userContextPack;

  return {
    ...userContextPack,
    keyStakeholders: userContextPack.keyStakeholders.filter(
      (stakeholder) => !isPollutedStakeholderLabel(stakeholder, language),
    ),
  };
}

function isPollutedStakeholderLabel(label: string, language?: OutputLanguage): boolean {
  return isWrongLanguageAutoStakeholderLabel(label, language) ||
    label.length > 96 ||
    /(customer agent|customer service|chatbot|vehicle brand|shopping consultant|google cloud|vertex ai|gemini)/i.test(
      label,
    );
}

function isWrongLanguageAutoStakeholderLabel(
  label: string,
  language?: OutputLanguage,
): boolean {
  return language === "en" &&
    /创业公司创始团队|当前雇主和团队|职业网络与未来招聘方|关键利益相关者/.test(label);
}

function translateKnownAutoStakeholderText(
  value: string,
  language: OutputLanguage,
): string {
  if (language !== "en") {
    return value
      .replace(/\bPrimary Stakeholder\b/g, "关键利益相关者")
      .replace(
        /\bRespond to the observer's choices\./g,
        "回应观察者的选择。",
      );
  }

  return value
    .replace(/创业公司创始团队/g, "Startup founding team")
    .replace(/当前雇主和团队/g, "Current employer and team")
    .replace(/职业网络与未来招聘方/g, "Professional network and future employers")
    .replace(/关键利益相关者/g, "Primary stakeholder")
    .replace(
      /围绕这个决定评估风险、可信度和下一步行动。/g,
      "Evaluate the decision's risk, credibility, and next move.",
    );
}

function repairGenericStakeholdersForClient(
  stakeholders: NonNullable<SessionState["simulationState"]>["stakeholders"],
  derivedStakeholders: string[],
  language: OutputLanguage,
): NonNullable<SessionState["simulationState"]>["stakeholders"] {
  const languageRepairedStakeholders = stakeholders.map((stakeholder) => ({
    ...stakeholder,
    role: translateKnownAutoStakeholderText(stakeholder.role, language),
    currentGoal: translateKnownAutoStakeholderText(
      stakeholder.currentGoal,
      language,
    ),
  }));
  if (derivedStakeholders.length === 0) return languageRepairedStakeholders;
  const useChinese = language !== "en";
  const onlyGeneric = languageRepairedStakeholders.length <= 1 &&
    languageRepairedStakeholders.every((stakeholder) =>
      stakeholder.id === "primary-stakeholder" ||
      stakeholder.role === "Primary Stakeholder" ||
      stakeholder.role === "关键利益相关者",
    );
  const otherPolluted = languageRepairedStakeholders.some((stakeholder) =>
    !isWrongLanguageAutoStakeholderLabel(stakeholder.role, language) &&
    isPollutedStakeholderLabel(stakeholder.role, language),
  );

  if (!onlyGeneric && !otherPolluted) return languageRepairedStakeholders;

  return derivedStakeholders.slice(0, 5).map((role, index) => ({
    id: `derived-stakeholder-${index + 1}`,
    role,
    stance: "uncertain" as const,
    trust: 0.5,
    resistance: 0.45,
    influence: index === 0 ? 0.72 : 0.58,
    currentGoal: useChinese
      ? "围绕这个决定评估风险、可信度和下一步行动。"
      : "Evaluate the decision's risk, credibility, and next move.",
  }));
}

function hideOffDilemmaPendingTurnForClient(session: SessionState): SessionState {
  if (!session.pendingTurn || !isPendingTurnOffDilemma(session, session.pendingTurn)) {
    return session;
  }

  return {
    ...session,
    pendingTurn: undefined,
    generationFailures: [
      ...(session.generationFailures ?? []),
      {
        timestamp: new Date().toISOString(),
        stage: "generate_next_turn",
        turn: session.turn,
        message: "Stored pending turn does not match the user's dilemma.",
        recoverable: true,
        fallbackUsed: false,
      },
    ],
  };
}

function isPendingTurnOffDilemma(
  session: SessionState,
  pendingTurn: TurnGenerationResult,
): boolean {
  const dilemmaKind = inferDilemmaKind(session);

  if (dilemmaKind === "food" || dilemmaKind === "general") {
    return false;
  }

  const turnText = [
    pendingTurn.groundingContext?.worldContext.setting,
    pendingTurn.groundingContext?.worldContext.currentWorldPressure,
    ...pendingTurn.branches.flatMap((branch) => [
      branch.title,
      branch.summary ?? "",
      branch.consequence,
      branch.keyUncertainty,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const foodHits = [
    /吃什么|吃饭|午饭|晚饭|早餐|宵夜|外卖|餐厅|火锅|奶茶|做饭|食物|面条|煮面|便当/.test(turnText),
    /\bfood\b|\beat\b|\bmeal\b|\blunch\b|\bdinner\b|\bbreakfast\b|\brestaurant\b|\btakeout\b/.test(turnText),
  ].filter(Boolean).length;

  const domainHits = [
    /岗位|工作|职业|职位|公司|创业|项目|客户|产品|坚守|转型|雇主|招聘/.test(turnText),
    /\bai\b|\bllm\b|\bcareer\b|\bjob\b|\brole\b|\bstartup\b|\bfounder\b|\bmarket\b|\bworkplace\b|\bhiring\b|\bemployer\b|\bmvp\b/.test(
      turnText,
    ),
  ].filter(Boolean).length;

  return foodHits > 0 && domainHits === 0;
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new GenerationTimeoutError(label));
    }, generationTimeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
