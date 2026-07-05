import { z } from "zod/v4";

const nonEmptyString = z.string().trim().min(1);

export const canonFactSchema = z.object({
  id: nonEmptyString,
  statement: nonEmptyString,
  tags: z.array(nonEmptyString),
});

export const worldRuleSchema = z.object({
  id: nonEmptyString,
  description: nonEmptyString,
  severity: z.enum(["hard", "soft"]),
});

export const locationCardSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  description: nonEmptyString,
  connectedLocationIds: z.array(nonEmptyString),
});

export const characterCardSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  playable: z.boolean(),
  identity: nonEmptyString,
  personality: z.array(nonEmptyString).min(1),
  goals: z.array(nonEmptyString).min(1),
  capabilities: z.array(nonEmptyString),
  limitations: z.array(nonEmptyString),
  knownFactIds: z.array(nonEmptyString),
  unknownFactIds: z.array(nonEmptyString),
  hiddenAgenda: nonEmptyString.optional(),
});

export const relationshipEdgeSchema = z.object({
  sourceCharacterId: nonEmptyString,
  targetCharacterId: nonEmptyString,
  kind: nonEmptyString,
  affinity: z.number().min(-5).max(5),
  tension: z.number().min(0).max(5),
  publicContext: nonEmptyString,
});

export const factionCardSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  role: nonEmptyString,
  publicGoal: nonEmptyString,
  hiddenPressure: nonEmptyString.optional(),
  influence: z.number().min(0).max(1),
  memberCharacterIds: z.array(nonEmptyString),
});

export const worldEventSchema = z.object({
  id: nonEmptyString,
  turnCreated: z.number().int().nonnegative(),
  dueTurn: z.number().int().positive().optional(),
  source: z.enum(["player", "npc", "world"]),
  visibility: z.enum(["public", "private", "rumor"]),
  severity: z.number().min(0).max(1),
  status: z.enum(["scheduled", "active", "resolved", "expired"]),
  description: nonEmptyString,
  linkedCharacterIds: z.array(nonEmptyString),
  linkedFactionIds: z.array(nonEmptyString),
});

export const worldPressureStateSchema = z.object({
  ritualOrder: z.number().min(0).max(100),
  householdOrder: z.number().min(0).max(100),
  publicFace: z.number().min(0).max(100),
  hiddenResentment: z.number().min(0).max(100),
  authorityLegitimacy: z.number().min(0).max(100),
  informationClarity: z.number().min(0).max(100),
});

export const openingScenarioSchema = z.object({
  id: nonEmptyString,
  title: nonEmptyString,
  locationId: nonEmptyString,
  activeCharacterIds: z.array(nonEmptyString).min(1).max(3),
  event: nonEmptyString,
  suggestedGoals: z.array(nonEmptyString).min(1).max(3),
});

export const worldPackSchema = z.object({
  schemaVersion: z.literal("world-pack-v1"),
  worldPackId: nonEmptyString,
  version: z.number().int().positive(),
  visibility: z.enum(["curated", "private"]),
  sourceType: z.enum(["narrative", "lore"]),
  worldTemplate: z.enum(["generic", "court_intrigue", "mythic_exploration", "anime_faction"]).optional(),
  title: nonEmptyString,
  language: z.enum(["zh-CN", "en"]),
  premise: nonEmptyString,
  timeAnchor: nonEmptyString,
  sourceAttribution: z.object({
    label: nonEmptyString,
    rightsBasis: z.enum(["public-domain", "user-confirmed-private-use"]),
  }),
  canonFacts: z.array(canonFactSchema).min(1),
  rules: z.array(worldRuleSchema).min(1),
  locations: z.array(locationCardSchema).min(1).max(3),
  characters: z.array(characterCardSchema).min(1).max(15),
  relationships: z.array(relationshipEdgeSchema),
  factions: z.array(factionCardSchema).optional(),
  eventSeeds: z.array(worldEventSchema).optional(),
  pressureDefaults: worldPressureStateSchema.optional(),
  openingScenario: openingScenarioSchema,
});

export const worldPackDraftSchema = worldPackSchema
  .omit({ worldPackId: true, version: true })
  .extend({
    worldPackId: nonEmptyString.optional(),
    version: z.number().int().positive().optional(),
  });

export const milestoneSchema = z.object({
  id: nonEmptyString,
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  description: nonEmptyString,
  status: z.enum(["locked", "active", "achieved", "failed"]),
  progressSignals: z.array(nonEmptyString),
  successConditions: z.array(nonEmptyString).min(1),
  failureConditions: z.array(nonEmptyString).min(1),
});

export const experiencePlanSchema = z.object({
  primaryGoal: nonEmptyString,
  playerCharacterId: nonEmptyString,
  milestones: z.array(milestoneSchema).length(3),
  successDefinition: nonEmptyString,
  failureDefinition: nonEmptyString,
});

const npcReactionSchema = z.object({
  characterId: nonEmptyString,
  stance: z.enum(["supportive", "resistant", "neutral", "uncertain"]),
  reaction: nonEmptyString,
  usedFactIds: z.array(nonEmptyString).min(1),
  privateIntent: nonEmptyString.optional(),
});

const worldStateDeltaSchema = z.object({
  nextLocationId: nonEmptyString.optional(),
  activeCharacterIds: z.array(nonEmptyString).max(3),
  relationshipDeltas: z.array(
    z.object({
      sourceCharacterId: nonEmptyString,
      targetCharacterId: nonEmptyString,
      affinityDelta: z.number().min(-2).max(2),
      tensionDelta: z.number().min(-2).max(2),
    }),
  ).default([]),
  characterDeltas: z.array(
    z.object({
      characterId: nonEmptyString,
      attitudeDelta: z.number().min(-2).max(2),
      currentGoal: nonEmptyString.optional(),
      condition: nonEmptyString.optional(),
      addKnownFlags: z.array(nonEmptyString),
    }),
  ).default([]),
  addWorldFlags: z.array(nonEmptyString).default([]),
  removeWorldFlags: z.array(nonEmptyString).default([]),
  eventSummary: nonEmptyString,
});

const milestoneSignalSchema = z.object({
  milestoneId: nonEmptyString,
  signal: nonEmptyString,
  proposedStatus: z.enum(["locked", "active", "achieved", "failed"]),
});

export const worldCandidateSchema = z.object({
  id: nonEmptyString,
  actionTitle: nonEmptyString,
  visibleCue: nonEmptyString,
  hiddenOutcome: nonEmptyString,
  riskLabel: z.enum(["low", "medium", "high"]),
  requiredCapabilities: z.array(nonEmptyString).default([]),
  participatingCharacterIds: z.array(nonEmptyString).max(3),
  npcReactions: z.array(npcReactionSchema).max(3),
  stateDelta: worldStateDeltaSchema,
  milestoneSignals: z.array(milestoneSignalSchema).default([]),
  groundingFactIds: z.array(nonEmptyString).min(1),
});

export const worldTurnResultSchema = z.object({
  turnNumber: z.number().int().positive(),
  stateRevision: z.number().int().nonnegative(),
  visibleScene: nonEmptyString,
  candidates: z.array(worldCandidateSchema).length(3),
});

export const liteWorldCandidateSchema = z.object({
  id: z.enum(["b1", "b2", "b3"]),
  riskLabel: z.enum(["low", "medium", "high"]),
  actionTitle: nonEmptyString,
  visibleCue: nonEmptyString,
  hiddenOutcome: nonEmptyString,
  eventSummary: nonEmptyString,
});

export const liteWorldTurnResultSchema = z.object({
  turnNumber: z.number().int().positive(),
  stateRevision: z.number().int().nonnegative(),
  visibleScene: nonEmptyString,
  candidates: z.array(liteWorldCandidateSchema).length(3),
});
