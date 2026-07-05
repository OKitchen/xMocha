import { z } from "zod/v4";

export const riskProfileSchema = z.enum(["low", "medium", "high"]);

export const stanceSchema = z.enum([
  "supportive",
  "resistant",
  "neutral",
  "uncertain",
]);

export const influenceActorTypeSchema = z.enum([
  "individual",
  "society",
  "environment",
]);

export const influenceDimensionSchema = z.enum([
  "trust",
  "risk",
  "behavior",
  "opportunity",
  "pressure",
]);

export const influenceDirectionSchema = z.enum([
  "increase",
  "decrease",
  "redirect",
]);

export const visualPositionSchema = z.enum([
  "left",
  "center",
  "right",
  "upper-left",
  "upper-right",
  "lower-left",
  "lower-right",
]);

export const visualStyleSchema = z.enum([
  "career-studio",
  "city-apartment",
  "night-cafe",
]);

export const collapseVisualCueSchema = z.enum([
  "split",
  "pull",
  "echo",
  "pressure-rise",
]);

export const branchSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  consequence: z.string(),
  score: z.number().min(0).max(1),
  timeHorizon: z.string(),
  riskProfile: riskProfileSchema,
  keyUncertainty: z.string(),
});

export const branchWorldDeltaSchema = z.object({
  branchId: z.string(),
  activatedConstraints: z.array(z.string()),
  activatedOpportunities: z.array(z.string()),
  pressureShift: z.string(),
});

export const communityAgentSchema = z.object({
  role: z.string(),
  stance: stanceSchema,
  motivation: z.string(),
  influence: z.number().min(0).max(1),
  reaction: z.string(),
});

export const branchCommunitySchema = z.object({
  branchId: z.string(),
  agents: z.array(communityAgentSchema).min(1),
  socialDynamics: z.string(),
  dominantNarrative: z.string(),
});

export const branchCommunitiesSchema = z.array(branchCommunitySchema);

export const branchVisualCueSchema = z.object({
  branchId: z.string(),
  portalLabel: z.string(),
  position: visualPositionSchema,
  color: z.string(),
  symbol: z.string(),
  motion: z.string(),
  roomEffect: z.string(),
});

export const roomObjectCueSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["desk", "window", "screen", "plant", "clock", "map", "artifact"]),
  position: visualPositionSchema,
  state: z.string(),
  description: z.string(),
});

export const stakeholderVisualCueSchema = z.object({
  stakeholderId: z.string(),
  label: z.string(),
  stance: stanceSchema,
  position: visualPositionSchema,
  influence: z.number().min(0).max(1),
  mood: z.string(),
});

export const turnVisualSceneSchema = z.object({
  mode: z.literal("avatar-room"),
  style: visualStyleSchema,
  turnNumber: z.number().int().positive(),
  avatar: z.object({
    posture: z.string(),
    expression: z.string(),
    energy: z.number().min(0).max(1),
    stressSignal: z.string(),
    focusAura: z.string(),
  }),
  room: z.object({
    atmosphere: z.string(),
    lighting: z.string(),
    colorPalette: z.array(z.string()).min(3).max(5),
    objects: z.array(roomObjectCueSchema),
    pressureIndicators: z.array(z.string()),
  }),
  branchPortals: z.array(branchVisualCueSchema),
  stakeholders: z.array(stakeholderVisualCueSchema),
  collapseCue: collapseVisualCueSchema,
  caption: z.string(),
});

export const influenceEventSchema = z.object({
  id: z.string(),
  turn: z.number().int().positive(),
  branchId: z.string(),
  sourceType: influenceActorTypeSchema,
  sourceId: z.string(),
  targetType: influenceActorTypeSchema,
  targetId: z.string(),
  dimension: influenceDimensionSchema,
  direction: influenceDirectionSchema,
  intensity: z.number().min(0).max(1),
  explanation: z.string(),
});

export const influenceEventsSchema = z.array(influenceEventSchema);

export const sessionSummarySchema = z.object({
  narrative: z.string(),
  decisionArc: z.array(z.string()).min(1),
  alternateHint: z.string().optional(),
});

export const turnDraftSchema = z.object({
  turnNumber: z.number().int().positive(),
  branches: z.array(branchSchema).min(3).max(4),
  branchWorldDeltas: z.array(branchWorldDeltaSchema),
});

export const turnGenerationResultSchema = turnDraftSchema.extend({
  branchCommunities: z.array(branchCommunitySchema),
  influenceEvents: influenceEventsSchema,
  visualScene: turnVisualSceneSchema.optional(),
});

export const turnSimulationResultSchema = turnGenerationResultSchema;
