import { randomUUID } from "node:crypto";

import { getPresetScenarioPack } from "./preset-scenarios";
import { createInitialSimulationState } from "./simulation-state";
import { normalizeUserProvidedDataInput } from "./user-provided-data";
import type {
  Domain,
  OutputLanguage,
  SessionModelConfig,
  SessionState,
  Theme,
  UserContextPack,
  UserContextPackInput,
  UserPersona,
  UserProvidedDataInput,
  VisualMode,
  VisualStyle,
} from "./types";

const defaultPersona: UserPersona = {
  riskTolerance: "medium",
  emotionalState: "curious",
  primaryValue: "clarity",
  recentWins: [],
  openWounds: [],
};

export function createSession(params: {
  dilemma?: string;
  theme?: Theme;
  domain?: Domain;
  maxTurns?: number;
  presetScenarioId?: SessionState["presetScenarioId"];
  language?: OutputLanguage;
  visualMode?: VisualMode;
  visualStyle?: VisualStyle;
  modelConfig?: SessionModelConfig;
  sessionAccessTokenHash?: string;
  userContextPack?: UserContextPackInput;
  userProvidedData?: UserProvidedDataInput;
}): SessionState {
  const presetScenario = getPresetScenarioPack(params.presetScenarioId);
  const dilemma = params.dilemma?.trim() || presetScenario?.baseDilemma;

  if (!dilemma) {
    throw new Error("A dilemma or preset scenario is required to create a session.");
  }

  const language = params.language ?? "en";
  const basePersona = language === "en"
    ? defaultPersona
    : {
        ...defaultPersona,
        emotionalState: "好奇",
        primaryValue: "清晰",
      };
  const userPersona = presetScenario
    ? {
        ...basePersona,
        riskTolerance: presetScenario.starterUserContext.riskPreference,
        emotionalState: language === "en" ? "watchful" : "观察中",
        primaryValue: language === "en" ? "adaptability" : "适应力",
      }
    : { ...basePersona };
  const normalizedUserProvidedData = normalizeUserProvidedDataInput(
    params.userProvidedData,
    {
      dilemma,
      language,
      userContextPack: params.userContextPack,
    },
  );
  const userContextPack = mergeUserContextPack(
    presetScenario?.starterUserContext,
    mergeDerivedUserContext(params.userContextPack, normalizedUserProvidedData),
  );

  const initialSimulationState = createInitialSimulationState({
    userPersona,
    userContextPack,
    presetScenario,
    language,
    turn: 0,
  });

  return {
    schemaVersion: "session-v1",
    mode: "decision",
    revision: 0,
    sessionId: randomUUID(),
    dilemma,
    language,
    visualMode: params.visualMode ?? "avatar-room",
    visualStyle: params.visualStyle ?? "career-studio",
    domain: params.domain ?? presetScenario?.domain ?? "career",
    theme: params.theme ?? presetScenario?.theme ?? "sci-fi",
    modelConfig: params.modelConfig,
    sessionAccessTokenHash: params.sessionAccessTokenHash,
    presetScenarioId: params.presetScenarioId,
    turn: 0,
    maxTurns: params.maxTurns ?? 5,
    status: "active",
    canonicalPath: [],
    quantumTrace: [],
    shadowTimelines: [],
    userContextPack,
    userProvidedData: normalizedUserProvidedData,
    userAuthoredActions: [],
    visualHistory: [],
    influenceEvents: [],
    initialSimulationState,
    simulationState: initialSimulationState,
    groundingLog: [],
    generationFailures: [],
    analyticsEvents: [],
    userPersona,
  };
}

function mergeDerivedUserContext(
  explicitPack: UserContextPackInput | undefined,
  userProvidedData: ReturnType<typeof normalizeUserProvidedDataInput>,
): UserContextPackInput | undefined {
  if (!userProvidedData) return explicitPack;
  const derived = userProvidedData.derivedBrief;

  return {
    ...explicitPack,
    userGoal: explicitPack?.userGoal ?? derived.userIntentSummary,
    availableOptions:
      explicitPack?.availableOptions && explicitPack.availableOptions.length > 0
        ? explicitPack.availableOptions
        : derived.activeOptions,
    personalConstraints:
      explicitPack?.personalConstraints && explicitPack.personalConstraints.length > 0
        ? explicitPack.personalConstraints
        : derived.keyConstraints,
    keyStakeholders:
      explicitPack?.keyStakeholders && explicitPack.keyStakeholders.length > 0
        ? explicitPack.keyStakeholders
        : derived.keyStakeholders,
    successCriteria:
      explicitPack?.successCriteria && explicitPack.successCriteria.length > 0
        ? explicitPack.successCriteria
        : ["选择应能同时解释上行空间、下行风险和下一步验证方式。"],
  };
}

function mergeUserContextPack(
  basePack: UserContextPack | undefined,
  overridePack: UserContextPackInput | undefined,
): UserContextPack | undefined {
  if (!basePack && !overridePack) {
    return undefined;
  }

  const mergedBase: UserContextPack = basePack ?? {
    userGoal: "Clarify the next move.",
    currentPosition: "A person navigating a changing career situation.",
    availableOptions: [],
    riskPreference: "medium",
    timeHorizon: "3-6 months",
    personalConstraints: [],
    keyStakeholders: [],
    successCriteria: [],
  };

  return {
    userGoal: overridePack?.userGoal?.trim() || mergedBase.userGoal,
    currentPosition:
      overridePack?.currentPosition?.trim() || mergedBase.currentPosition,
    availableOptions:
      overridePack?.availableOptions?.filter(Boolean) ?? mergedBase.availableOptions,
    riskPreference: overridePack?.riskPreference ?? mergedBase.riskPreference,
    timeHorizon: overridePack?.timeHorizon?.trim() || mergedBase.timeHorizon,
    personalConstraints:
      overridePack?.personalConstraints?.filter(Boolean) ??
      mergedBase.personalConstraints,
    keyStakeholders:
      overridePack?.keyStakeholders?.filter(Boolean) ?? mergedBase.keyStakeholders,
    successCriteria:
      overridePack?.successCriteria?.filter(Boolean) ?? mergedBase.successCriteria,
  };
}

export function assertSessionIsActive(session: SessionState): void {
  if (session.status !== "active") {
    throw new Error(`Session ${session.sessionId} is not active.`);
  }
}

export function nextTurnNumber(session: SessionState): number {
  return session.turn + 1;
}

export function markSessionAbandoned(session: SessionState): SessionState {
  return {
    ...session,
    status: "abandoned",
  };
}

export function markSessionComplete(session: SessionState): SessionState {
  return {
    ...session,
    status: "complete",
  };
}
