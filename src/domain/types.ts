import type {
  ExperiencePlan,
  TurnRun,
  WorldRuntimeState,
  WorldTurnResult,
} from "./world-types";

export type Theme = "adventure" | "sci-fi" | "dream" | "hell" | "humorous";

export type SessionMode = "decision" | "world";

export type Domain = "career";

export type SessionStatus = "active" | "complete" | "abandoned";

export type RiskProfile = "low" | "medium" | "high";

export type Stance = "supportive" | "resistant" | "neutral" | "uncertain";

export type PresetScenarioId = "ai_future_of_work";

export type OutputLanguage = "en" | "zh-CN";

export type VisualMode = "avatar-room";

export type VisualStyle = "career-studio" | "city-apartment" | "night-cafe";

export type ModelProvider =
  | "anthropic"
  | "deepseek"
  | "gemma"
  | "google"
  | "huggingface"
  | "openai";

export type SessionModelConfig = {
  provider: ModelProvider;
  model?: string;
  turnSimulator?: "legacy" | "unified";
};

export type VisualPosition =
  | "left"
  | "center"
  | "right"
  | "upper-left"
  | "upper-right"
  | "lower-left"
  | "lower-right";

export type CollapseVisualCue = "split" | "pull" | "echo" | "pressure-rise";

export type InfluenceActorType = "individual" | "society" | "environment";

export type InfluenceDimension =
  | "trust"
  | "risk"
  | "behavior"
  | "opportunity"
  | "pressure";

export type InfluenceDirection = "increase" | "decrease" | "redirect";

export type SimulationScope = "individual" | "society" | "coupled";

export type IndividualState = {
  skills: Record<string, number>;
  confidence: number;
  reputation: number;
  trust: number;
  financialStability: number;
  stress: number;
  riskTolerance: number;
  identity: string[];
};

export type StakeholderState = {
  id: string;
  role: string;
  stance: Stance;
  trust: number;
  resistance: number;
  influence: number;
  currentGoal: string;
};

export type SimulationState = {
  scope: SimulationScope;
  individual: IndividualState;
  stakeholders: StakeholderState[];
  environmentMetrics: Record<string, number>;
  updatedAtTurn: number;
};

export type AblationMode =
  | "full-coupled"
  | "no-individual-influence"
  | "no-society-influence"
  | "isolated-baseline";

export type AblationFeatureFlags = {
  individualToWorld: boolean;
  worldToIndividual: boolean;
};

export type AblationMetricSnapshot = {
  individual: Record<string, number>;
  society: Record<string, number>;
  environment: Record<string, number>;
};

export type AblationMetricDelta = {
  individual: Record<string, number>;
  society: Record<string, number>;
  environment: Record<string, number>;
  totalDistance: number;
};

export type AblationRunResult = {
  mode: AblationMode;
  label: string;
  flags: AblationFeatureFlags;
  includedEventCount: number;
  excludedEventCount: number;
  finalState: SimulationState;
  metrics: AblationMetricSnapshot;
  deltaFromInitial: AblationMetricDelta;
  deltaFromFull?: AblationMetricDelta;
};

export type AblationReport = {
  reportVersion: "ablation-v1";
  sessionId: string;
  turns: number;
  canonicalPath: Array<{
    turn: number;
    branchId: string;
    title: string;
  }>;
  influenceEventCount: number;
  initialMetrics: AblationMetricSnapshot;
  runs: AblationRunResult[];
  headlineInsights: string[];
};

export type ScenarioRole = {
  role: string;
  baselineStance: Stance;
  motivation: string;
  influence: number;
  relationship: string;
};

export type UserProvidedDataSourceKind = "text" | "markdown" | "json" | "pdf" | "note";

export type UserFactType =
  | "goal"
  | "constraint"
  | "stakeholder"
  | "resource"
  | "risk"
  | "option"
  | "timeline"
  | "background"
  | "pressure"
  | "preference"
  | "other";

export type UserProvidedDataSource = {
  id: string;
  kind: UserProvidedDataSourceKind;
  title: string;
  content: string;
};

export type UserFactItem = {
  id: string;
  type: UserFactType;
  label?: string;
  value?: string;
  summary: string;
  tags: string[];
  timeScope?: string;
  confidence: number;
  sourceRefIds: string[];
  userConfirmed: boolean;
};

export type DerivedUserBrief = {
  userIntentSummary?: string;
  keyConstraints: string[];
  keyStakeholders: string[];
  activeOptions: string[];
  decisionPressures: string[];
  openQuestions: string[];
};

export type UserProvidedDataPack = {
  sources: UserProvidedDataSource[];
  factItems: UserFactItem[];
  derivedBrief: DerivedUserBrief;
};

export type UserProvidedDataSourceInput = {
  kind?: UserProvidedDataSourceKind;
  title?: string;
  content: string;
};

export type UserFactItemInput = {
  type?: UserFactType;
  label?: string;
  value?: string;
  summary: string;
  tags?: string[];
  timeScope?: string;
  sourceRefIds?: string[];
  userConfirmed?: boolean;
};

export type UserProvidedDataInput = {
  rawText?: string;
  sources?: UserProvidedDataSourceInput[];
  facts?: UserFactItemInput[];
};

export type UserContextPack = {
  userGoal: string;
  currentPosition: string;
  availableOptions: string[];
  riskPreference: RiskProfile;
  timeHorizon: string;
  personalConstraints: string[];
  keyStakeholders: string[];
  successCriteria: string[];
};

export type UserContextPackInput = Partial<UserContextPack>;

export type PresetScenarioPack = {
  scenarioId: PresetScenarioId;
  title: string;
  theme: Theme;
  domain: Domain;
  summary: string;
  baseDilemma: string;
  worldFacts: string[];
  constraints: string[];
  opportunities: string[];
  socialTensions: string[];
  seedNarratives: string[];
  roleCast: ScenarioRole[];
  starterUserContext: UserContextPack;
};

export type GroundingContext = {
  sourceType: "preset" | "user-provided" | "preset+user-provided";
  presetScenarioId?: PresetScenarioId;
  scenarioTitle?: string;
  worldFactsUsed: string[];
  socialTensionsUsed: string[];
  roleCastUsed: Array<{
    role: string;
    relationship: string;
    baselineStance: Stance;
  }>;
  userContextSummary?: {
    userGoal: string;
    currentPosition: string;
    riskPreference: RiskProfile;
    timeHorizon: string;
    personalConstraints: string[];
    keyStakeholders: string[];
    successCriteria: string[];
  };
  userProvidedDataSummary?: {
    sourceCount: number;
    factCount: number;
    topFacts: Array<{
      type: UserFactType;
      summary: string;
    }>;
    derivedBrief: DerivedUserBrief;
  };
  worldContext: WorldContext;
};

export type GroundingLogEntry = {
  turn: number;
  selectedBranchId: string;
  selectedBranchTitle: string;
  groundingContext: Omit<GroundingContext, "worldContext"> & {
    worldContextSummary: {
      setting: string;
      externalConditions: string;
      currentWorldPressure: string;
    };
  };
};

export type UserPersona = {
  riskTolerance: RiskProfile;
  emotionalState: string;
  primaryValue: string;
  recentWins: string[];
  openWounds: string[];
};

export type WorldContext = {
  domain: Domain;
  setting: string;
  externalConditions: string;
  constraints: string[];
  opportunities: string[];
  stableRules: string[];
  currentWorldPressure: string;
};

export type Branch = {
  id: string;
  title: string;
  summary: string;
  consequence: string;
  score: number;
  timeHorizon: string;
  riskProfile: RiskProfile;
  keyUncertainty: string;
};

export type BranchWorldDelta = {
  branchId: string;
  activatedConstraints: string[];
  activatedOpportunities: string[];
  pressureShift: string;
};

export type CommunityAgent = {
  role: string;
  stance: Stance;
  motivation: string;
  influence: number;
  reaction: string;
};

export type BranchCommunity = {
  branchId: string;
  agents: CommunityAgent[];
  socialDynamics: string;
  dominantNarrative: string;
};

export type BranchVisualCue = {
  branchId: string;
  portalLabel: string;
  position: VisualPosition;
  color: string;
  symbol: string;
  motion: string;
  roomEffect: string;
};

export type RoomObjectCue = {
  id: string;
  label: string;
  type: "desk" | "window" | "screen" | "plant" | "clock" | "map" | "artifact";
  position: VisualPosition;
  state: string;
  description: string;
};

export type StakeholderVisualCue = {
  stakeholderId: string;
  label: string;
  stance: Stance;
  position: VisualPosition;
  influence: number;
  mood: string;
};

export type TurnVisualScene = {
  mode: VisualMode;
  style: VisualStyle;
  turnNumber: number;
  avatar: {
    posture: string;
    expression: string;
    energy: number;
    stressSignal: string;
    focusAura: string;
  };
  room: {
    atmosphere: string;
    lighting: string;
    colorPalette: string[];
    objects: RoomObjectCue[];
    pressureIndicators: string[];
  };
  branchPortals: BranchVisualCue[];
  stakeholders: StakeholderVisualCue[];
  collapseCue: CollapseVisualCue;
  caption: string;
};

export type InfluenceEvent = {
  id: string;
  turn: number;
  branchId: string;
  sourceType: InfluenceActorType;
  sourceId: string;
  targetType: InfluenceActorType;
  targetId: string;
  dimension: InfluenceDimension;
  direction: InfluenceDirection;
  intensity: number;
  explanation: string;
};

export type CanonicalStep = Branch & {
  turn: number;
};

export type ShadowBranch = Branch & {
  turn: number;
};

export type SessionSummary = {
  narrative: string;
  decisionArc: string[];
  alternateHint?: string;
};

export type UserAuthoredActionInput = {
  rawInput: string;
  riskProfile?: RiskProfile;
  timeHorizon?: string;
  anchorBranchId?: string;
};

export type UserAuthoredAction = {
  turn: number;
  rawInput: string;
  title: string;
  summary: string;
  consequence: string;
  riskProfile: RiskProfile;
  timeHorizon: string;
  anchorBranchId?: string;
};

export type VisualHistoryEntry = {
  turn: number;
  selectedBranchId: string;
  selectedBranchTitle: string;
  memoryLabel: string;
  shadowLabels: string[];
  scene: TurnVisualScene;
};

export type GenerationFailureStage =
  | "start_session"
  | "choose_branch"
  | "generate_next_turn"
  | "summary_generation";

export type GenerationFailureLogEntry = {
  timestamp: string;
  stage: GenerationFailureStage;
  turn: number;
  message: string;
  recoverable: boolean;
  fallbackUsed: boolean;
  selectedBranchTitle?: string;
};

export type SessionAnalyticsEventName =
  | "session_started"
  | "first_turn_generated"
  | "branch_selected"
  | "next_turn_generated"
  | "session_completed"
  | "generation_failed"
  | "share_clicked"
  | "contact_submitted"
  | "feedback_submitted"
  | "world_compile_started"
  | "world_compile_completed"
  | "world_pack_confirmed"
  | "world_session_started"
  | "world_milestone_changed"
  | "world_session_completed"
  | "world_session_replayed";

export type SessionAnalyticsEvent = {
  timestamp: string;
  name: SessionAnalyticsEventName;
  turn: number;
  metadata?: Record<string, string | number | boolean>;
};

export type SessionState = {
  schemaVersion?: "session-v1";
  mode?: SessionMode;
  revision?: number;
  sessionId: string;
  dilemma: string;
  language: OutputLanguage;
  visualMode: VisualMode;
  visualStyle: VisualStyle;
  domain: Domain;
  theme: Theme;
  modelConfig?: SessionModelConfig;
  presetScenarioId?: PresetScenarioId;
  turn: number;
  maxTurns: number;
  status: SessionStatus;
  canonicalPath: CanonicalStep[];
  quantumTrace: string[];
  shadowTimelines: ShadowBranch[][];
  userPersona: UserPersona;
  userContextPack?: UserContextPack;
  userProvidedData?: UserProvidedDataPack;
  userAuthoredActions: UserAuthoredAction[];
  visualHistory: VisualHistoryEntry[];
  influenceEvents: InfluenceEvent[];
  initialSimulationState?: SimulationState;
  simulationState: SimulationState;
  groundingLog: GroundingLogEntry[];
  generationFailures: GenerationFailureLogEntry[];
  analyticsEvents: SessionAnalyticsEvent[];
  lastWorldContext?: WorldContext;
  pendingTurn?: TurnGenerationResult;
  worldPackId?: string;
  worldPackVersion?: number;
  worldExperiencePlan?: ExperiencePlan;
  worldRuntimeState?: WorldRuntimeState;
  pendingWorldTurn?: WorldTurnResult;
  worldTurnRuns?: TurnRun[];
  privateWorld?: boolean;
  sessionAccessTokenHash?: string;
  worldAccessTokenHash?: string;
  summary?: SessionSummary;
};

export type TurnGenerationInput = {
  session: SessionState;
  worldContext: WorldContext;
};

export type AgentTrace = {
  provider: string;
  model: string;
  observerState: string;
  environmentPressure: string;
  generativeSteps: string[];
  deterministicSteps: string[];
  humanMovement: string[];
  environmentDynamics: string[];
};

export type TurnDraft = {
  turnNumber: number;
  branches: Branch[];
  branchWorldDeltas: BranchWorldDelta[];
};

export type SocietySimulationInput = TurnGenerationInput & TurnDraft;

export type TurnSimulationResult = TurnDraft & {
  branchCommunities: BranchCommunity[];
  influenceEvents: InfluenceEvent[];
  visualScene?: TurnVisualScene;
};

export type TurnGenerationResult = {
  turnNumber: number;
  branches: Branch[];
  branchWorldDeltas: BranchWorldDelta[];
  branchCommunities: BranchCommunity[];
  influenceEvents: InfluenceEvent[];
  visualScene?: TurnVisualScene;
  groundingContext?: GroundingContext;
  agentTrace?: AgentTrace;
};

export type CollapseResult = {
  session: SessionState;
  selectedBranch: Branch;
  archivedBranches: ShadowBranch[];
};
