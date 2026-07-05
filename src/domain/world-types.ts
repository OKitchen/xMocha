import type { OutputLanguage, RiskProfile } from "./types";

export type WorldSourceType = "narrative" | "lore";
export type WorldVisibility = "curated" | "private";
export type WorldRuleSeverity = "hard" | "soft";
export type WorldTemplateId = "generic" | "court_intrigue" | "mythic_exploration" | "anime_faction";

export type CanonFact = {
  id: string;
  statement: string;
  tags: string[];
};

export type WorldRule = {
  id: string;
  description: string;
  severity: WorldRuleSeverity;
};

export type LocationCard = {
  id: string;
  name: string;
  description: string;
  connectedLocationIds: string[];
};

export type CharacterCard = {
  id: string;
  name: string;
  playable: boolean;
  identity: string;
  personality: string[];
  goals: string[];
  capabilities: string[];
  limitations: string[];
  knownFactIds: string[];
  unknownFactIds: string[];
  hiddenAgenda?: string;
};

export type RelationshipEdge = {
  sourceCharacterId: string;
  targetCharacterId: string;
  kind: string;
  affinity: number;
  tension: number;
  publicContext: string;
};

export type FactionCard = {
  id: string;
  name: string;
  role: string;
  publicGoal: string;
  hiddenPressure?: string;
  influence: number;
  memberCharacterIds: string[];
};

export type WorldEvent = {
  id: string;
  turnCreated: number;
  dueTurn?: number;
  source: "player" | "npc" | "world";
  visibility: "public" | "private" | "rumor";
  severity: number;
  status: "scheduled" | "active" | "resolved" | "expired";
  description: string;
  linkedCharacterIds: string[];
  linkedFactionIds: string[];
};

export type WorldPressureState = {
  ritualOrder: number;
  householdOrder: number;
  publicFace: number;
  hiddenResentment: number;
  authorityLegitimacy: number;
  informationClarity: number;
};

export type OpeningScenario = {
  id: string;
  title: string;
  locationId: string;
  activeCharacterIds: string[];
  event: string;
  suggestedGoals: string[];
};

export type WorldPack = {
  schemaVersion: "world-pack-v1";
  worldPackId: string;
  version: number;
  visibility: WorldVisibility;
  sourceType: WorldSourceType;
  worldTemplate?: WorldTemplateId;
  title: string;
  language: OutputLanguage;
  premise: string;
  timeAnchor: string;
  sourceAttribution: {
    label: string;
    rightsBasis: "public-domain" | "user-confirmed-private-use";
  };
  canonFacts: CanonFact[];
  rules: WorldRule[];
  locations: LocationCard[];
  characters: CharacterCard[];
  relationships: RelationshipEdge[];
  factions?: FactionCard[];
  eventSeeds?: WorldEvent[];
  pressureDefaults?: WorldPressureState;
  openingScenario: OpeningScenario;
};

export type WorldPackDraft = Omit<WorldPack, "worldPackId" | "version"> & {
  worldPackId?: string;
  version?: number;
};

export type StoredWorldPack = {
  pack: WorldPack;
  ownerTokenHash?: string;
  createdAt: string;
  updatedAt: string;
};

export type MilestoneStatus = "locked" | "active" | "achieved" | "failed";

export type Milestone = {
  id: string;
  order: 1 | 2 | 3;
  description: string;
  status: MilestoneStatus;
  progressSignals: string[];
  successConditions: string[];
  failureConditions: string[];
};

export type ExperiencePlan = {
  primaryGoal: string;
  playerCharacterId: string;
  milestones: Milestone[];
  successDefinition: string;
  failureDefinition: string;
};

export type CustomWorldCharacterInput = {
  name: string;
  identity: string;
  goal: string;
  strength: string;
  weakness: string;
};

export type PlayerCharacterState = {
  characterId: string;
  name: string;
  identity: string;
  currentGoal: string;
  capabilities: string[];
  limitations: string[];
  isCustom: boolean;
};

export type CharacterRuntimeState = {
  characterId: string;
  attitude: number;
  currentGoal: string;
  lastInteraction?: string;
  knownFlags: string[];
  condition: string;
};

export type WorldRuntimeState = {
  schemaVersion: "world-runtime-v1";
  worldPackId: string;
  worldPackVersion: number;
  revision: number;
  checkpoint: "turn-prepared" | "pending-candidates" | "turn-committed";
  turn: number;
  maxTurns: 5;
  playerCharacter: PlayerCharacterState;
  currentLocationId: string;
  activeCharacterIds: string[];
  characterStates: CharacterRuntimeState[];
  relationships: RelationshipEdge[];
  milestones: Milestone[];
  worldFlags: string[];
  recentEvents: string[];
  worldPressure?: WorldPressureState;
  eventQueue?: WorldEvent[];
};

export type NpcReaction = {
  characterId: string;
  stance: "supportive" | "resistant" | "neutral" | "uncertain";
  reaction: string;
  usedFactIds: string[];
  privateIntent?: string;
};

export type RelationshipDelta = {
  sourceCharacterId: string;
  targetCharacterId: string;
  affinityDelta: number;
  tensionDelta: number;
};

export type CharacterStateDelta = {
  characterId: string;
  attitudeDelta: number;
  currentGoal?: string;
  condition?: string;
  addKnownFlags: string[];
};

export type WorldStateDelta = {
  nextLocationId?: string;
  activeCharacterIds: string[];
  relationshipDeltas: RelationshipDelta[];
  characterDeltas: CharacterStateDelta[];
  addWorldFlags: string[];
  removeWorldFlags: string[];
  eventSummary: string;
};

export type MilestoneSignal = {
  milestoneId: string;
  signal: string;
  proposedStatus: MilestoneStatus;
};

export type WorldCandidate = {
  id: string;
  actionTitle: string;
  visibleCue: string;
  hiddenOutcome: string;
  riskLabel: RiskProfile;
  requiredCapabilities: string[];
  participatingCharacterIds: string[];
  npcReactions: NpcReaction[];
  stateDelta: WorldStateDelta;
  milestoneSignals: MilestoneSignal[];
  groundingFactIds: string[];
};

export type WorldTurnResult = {
  turnNumber: number;
  stateRevision: number;
  visibleScene: string;
  candidates: WorldCandidate[];
};

export type LiteWorldTurnResult = {
  turnNumber: number;
  stateRevision: number;
  visibleScene: string;
  candidates: Array<{
    id: "b1" | "b2" | "b3";
    riskLabel: RiskProfile;
    actionTitle: string;
    visibleCue: string;
    hiddenOutcome: string;
    eventSummary: string;
  }>;
};

export type WorldValidationIssue = {
  code: string;
  message: string;
  candidateId?: string;
};

export type AgentTraceNode = {
  nodeId: string;
  parentNodeId?: string;
  kind:
    | "context_builder"
    | "planner"
    | "turn_simulator"
    | "candidate"
    | "validator"
    | "state_preview"
    | "reducer"
    | "fallback";
  status: "success" | "failed" | "skipped";
  inputRefs: string[];
  outputRefs: string[];
  startedAt: string;
  durationMs: number;
  issueCodes: string[];
};

export type CandidateStatePreview = {
  candidateId: string;
  parentRevision: number;
  previewRevision: number;
  activeCharacterIds: string[];
  relationshipSnapshot: RelationshipEdge[];
  milestoneSnapshot: Milestone[];
  worldFlags: string[];
  recentEvents: string[];
  pressureSnapshot?: WorldPressureState;
  eventQueueSnapshot?: WorldEvent[];
};

export type WorldPromptStyle = "full" | "lite";

export type InterpretedWorldAction = {
  intent:
    | "investigate"
    | "negotiate"
    | "command"
    | "comfort"
    | "threaten"
    | "deceive"
    | "withdraw";
  targetCharacterIds: string[];
  requiredCapabilities: string[];
  violatesLimitations: string[];
  riskLabel: RiskProfile;
  feasible: boolean;
  explanation: string;
};

export type TurnRunStatus =
  | "success"
  | "validation_failed"
  | "timeout"
  | "fallback";

export type TurnRun = {
  traceId: string;
  sessionId: string;
  turn: number;
  attempt: number;
  mode: "world";
  worldPackId: string;
  worldPackVersion: number;
  promptVersion: string;
  promptStyle?: WorldPromptStyle;
  provider: string;
  model: string;
  activeCharacterIds: string[];
  groundingFactIds: string[];
  revisionBefore: number;
  revisionAfter?: number;
  startedAt: string;
  durationMs: number;
  status: TurnRunStatus;
  validationIssueCodes: string[];
  retryReason?: string;
  fallbackUsed: boolean;
  selectedCandidateId?: string;
  nodes?: AgentTraceNode[];
  candidateStatePreviews?: CandidateStatePreview[];
};
