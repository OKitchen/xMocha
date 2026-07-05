import type { WorldPack, WorldRuntimeState, WorldTemplateId } from "../../domain/world-types";

export const WORLD_TURN_PROMPT_VERSION = "world-turn-v1";

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function worldTemplate(pack: WorldPack): WorldTemplateId {
  if (pack.worldTemplate) return pack.worldTemplate;
  return pack.rules.some((rule) => rule.id.startsWith("rule-court-")) ||
    pack.canonFacts.some((fact) => fact.tags.includes("court_intrigue"))
    ? "court_intrigue"
    : pack.rules.some((rule) => rule.id.startsWith("rule-mythic-")) ||
        pack.canonFacts.some((fact) => fact.tags.includes("mythic_exploration"))
      ? "mythic_exploration"
      : "generic";
}

function templatePromptGuidance(template: WorldTemplateId): string {
  if (template === "court_intrigue") {
    return [
      "- If template is court_intrigue, choices should preserve the logic of face, rank, rumor, favors, servants/mediators, and faction pressure.",
      "- b1 should preserve face/gather information, b2 should use mediation/favor exchange, and b3 should make authority or public reputation risk visible.",
    ].join("\n");
  }
  if (template === "mythic_exploration") {
    return [
      "- If template is mythic_exploration, choices should preserve geography, creature/omen pressure, taboo boundaries, artifacts, and survival/exploration tradeoffs.",
      "- b1 should observe or choose a safer route, b2 should negotiate with a guide/guardian or test a clue, and b3 should cross a boundary or confront the creature/omen.",
    ].join("\n");
  }
  if (template === "anime_faction") {
    return [
      "- If template is anime_faction, choices should preserve explicit ability limits, faction alignment, rival pressure, and mission stakes.",
      "- b1 should gather information or conserve power, b2 should coordinate with an ally/faction, and b3 should use a risky explicit ability or challenge a rival.",
    ].join("\n");
  }
  return "- Use the source's concrete rules, character roles, relationships, and opening pressure. Keep the three futures meaningfully different.";
}

export function buildWorldTurnPrompt(params: {
  pack: WorldPack;
  state: WorldRuntimeState;
  language?: "zh-CN" | "en";
  repairIssues?: string[];
}): string {
  const activeCharacters = params.pack.characters.filter((character) =>
    params.state.activeCharacterIds.includes(character.id),
  );
  const involvedCharacterIds = new Set([
    params.state.playerCharacter.characterId,
    ...params.state.activeCharacterIds,
  ]);
  const relevantFacts = params.pack.canonFacts.filter((fact) =>
    activeCharacters.some(
      (character) =>
        character.knownFactIds.includes(fact.id) || character.unknownFactIds.includes(fact.id),
    ),
  ).slice(0, 8);
  const currentMilestone = params.state.milestones.find(
    (milestone) => milestone.status === "active",
  );
  const relevantFactionIds = new Set(
    (params.pack.factions ?? [])
      .filter((faction) =>
        faction.memberCharacterIds.some((characterId) =>
          involvedCharacterIds.has(characterId),
        ),
      )
      .map((faction) => faction.id),
  );
  const availableEvents = params.state.eventQueue ?? params.pack.eventSeeds ?? [];
  const relevantEvents = availableEvents
    .filter((event) =>
      event.status === "active" ||
      event.status === "scheduled" ||
      event.dueTurn === params.state.turn + 1 ||
      event.linkedCharacterIds.some((id) =>
        params.state.activeCharacterIds.includes(id) ||
        id === params.state.playerCharacter.characterId,
      ) ||
      event.linkedFactionIds.some((id) => relevantFactionIds.has(id)),
    )
    .slice(0, 4);
  const eventPulse = buildEventPulse(relevantEvents, params.state.turn);
  const relevantRelationships = params.state.relationships
    .filter((relationship) =>
      involvedCharacterIds.has(relationship.sourceCharacterId) ||
      involvedCharacterIds.has(relationship.targetCharacterId),
    )
    .slice(0, 8);
  const compactCharacters = activeCharacters.map((character) => ({
    id: character.id,
    name: character.name,
    identity: character.identity,
    personality: character.personality.slice(0, 3),
    goals: character.goals.slice(0, 2),
    capabilities: character.capabilities,
    limitations: character.limitations,
    knownFactIds: character.knownFactIds,
  }));
  const compactLocations = params.pack.locations.map((location) => ({
    id: location.id,
    name: location.name,
    connectedLocationIds: location.connectedLocationIds,
  }));
  const compactRules = [
    ...params.pack.rules.filter((rule) => rule.severity === "hard"),
    ...params.pack.rules.filter((rule) => rule.severity === "soft").slice(0, 2),
  ];
  const useChinese = (params.language ?? params.pack.language) !== "en";
  const template = worldTemplate(params.pack);
  const languageInstruction = useChinese
    ? "All user-visible natural-language fields must be in Simplified Chinese."
    : "All user-visible natural-language fields must be in English. If source facts, events, or names are in another language, translate or romanize them; do not write Chinese sentences in visibleScene, actionTitle, visibleCue, hiddenOutcome, eventSummary, npcReactions.reaction, or milestoneSignals.signal.";

  return `
You are xMocha World Mode's scene simulator.
Return strict JSON only. Generate exactly three candidate futures in one response.
Treat character knowledge, capabilities, hard rules, stable ids, and the time anchor as binding constraints.
Personality is a soft prior: the player may act against it, but NPCs should react plausibly.
Do not reveal privateIntent in visibleScene, actionTitle, visibleCue, or hiddenOutcome.
${languageInstruction}

WorldPack:
${json({
  id: params.pack.worldPackId,
  version: params.pack.version,
  premise: params.pack.premise,
  template: worldTemplate(params.pack),
  timeAnchor: params.pack.timeAnchor,
  rules: compactRules,
  locations: compactLocations,
  canonFacts: relevantFacts.length > 0 ? relevantFacts : params.pack.canonFacts.slice(0, 5),
  activeCharacters: compactCharacters,
  relationships: relevantRelationships,
  factions: (params.pack.factions ?? []).filter((faction) => relevantFactionIds.has(faction.id)),
  eventSeeds: relevantEvents.map((event) => ({
    id: event.id,
    dueTurn: event.dueTurn,
    status: event.status,
    visibility: event.visibility,
    severity: event.severity,
    description: event.description,
    linkedCharacterIds: event.linkedCharacterIds,
    linkedFactionIds: event.linkedFactionIds,
  })),
  eventPulse,
})}

Canonical runtime state:
${json({
  revision: params.state.revision,
  turn: params.state.turn,
  player: params.state.playerCharacter,
  currentLocationId: params.state.currentLocationId,
  activeCharacterIds: params.state.activeCharacterIds,
  characterStates: params.state.characterStates.filter((state) =>
    params.state.activeCharacterIds.includes(state.characterId),
  ),
  currentMilestone,
  worldFlags: params.state.worldFlags,
  recentEvents: params.state.recentEvents,
  worldPressure: params.state.worldPressure,
})}

${
  params.repairIssues?.length
    ? `The previous response failed validation. Repair these issues:\n- ${params.repairIssues.join("\n- ")}`
    : ""
}

Requirements:
- turnNumber must be ${params.state.turn + 1}.
- stateRevision must be ${params.state.revision}.
- candidates must use ids b1, b2, b3.
- Candidates must be meaningfully different and use low, medium, and high risk once each.
- Use only character, location, milestone, and fact ids supplied above.
- participatingCharacterIds and activeCharacterIds contain at most three ids.
- Relationship and attitude deltas must be between -2 and 2.
- The next location, if present, must be connected to the current location or remain current.
- milestoneSignals may add progress to the active milestone. Do not activate a locked milestone directly.
- Every candidate must cite at least one groundingFactId.
- requiredCapabilities must use exact strings from player.capabilities; use [] when none is required.
- Every NPC reaction must list usedFactIds, and every listed fact must appear in that character's knownFactIds.
- Use factions, eventSeeds, eventPulse, and worldPressure as soft simulation context. They should shape visible pressure and NPC reactions, but do not invent new ids.
${templatePromptGuidance(template)}
- If there are active or due events, visibleScene must acknowledge the strongest current pressure.
- At least one candidate should directly address an active/due event; another may delay, redirect, or make the event worse.
- Event summaries should describe how the situation changes, not just what the player tries.
- Do not output pressure deltas; deterministic code will preview and commit pressure changes.
- Keep strings concise. actionTitle <= 16 Chinese chars or 8 English words; visibleCue/hiddenOutcome/eventSummary <= 40 Chinese chars or 24 English words.

Return this shape:
{
  "turnNumber": ${params.state.turn + 1},
  "stateRevision": ${params.state.revision},
  "visibleScene": "string",
  "candidates": [
    {
      "id": "b1",
      "actionTitle": "string",
      "visibleCue": "short non-spoiler clue",
      "hiddenOutcome": "scene outcome revealed after choice",
      "riskLabel": "low",
      "requiredCapabilities": [],
      "participatingCharacterIds": ["character-id"],
      "npcReactions": [
        {
          "characterId": "character-id",
          "stance": "supportive | resistant | neutral | uncertain",
          "reaction": "string",
          "usedFactIds": ["fact-known-by-this-character"],
          "privateIntent": "optional internal intent"
        }
      ],
      "stateDelta": {
        "nextLocationId": "optional-location-id",
        "activeCharacterIds": ["character-id"],
        "relationshipDeltas": [
          {
            "sourceCharacterId": "character-id",
            "targetCharacterId": "character-id",
            "affinityDelta": 0,
            "tensionDelta": 0
          }
        ],
        "characterDeltas": [
          {
            "characterId": "character-id",
            "attitudeDelta": 0,
            "currentGoal": "optional string",
            "condition": "optional string",
            "addKnownFlags": []
          }
        ],
        "addWorldFlags": [],
        "removeWorldFlags": [],
        "eventSummary": "string"
      },
      "milestoneSignals": [
        {
          "milestoneId": "active-milestone-id",
          "signal": "string",
          "proposedStatus": "active | achieved | failed"
        }
      ],
      "groundingFactIds": ["fact-id"]
    }
  ]
}`.trim();
}

export function buildLiteWorldTurnPrompt(params: {
  pack: WorldPack;
  state: WorldRuntimeState;
  language?: "zh-CN" | "en";
  repairIssues?: string[];
}): string {
  const activeCharacters = params.pack.characters
    .filter((character) => params.state.activeCharacterIds.includes(character.id))
    .map((character) => ({
      id: character.id,
      name: character.name,
      identity: character.identity,
      goals: character.goals.slice(0, 2),
      knownFactIds: character.knownFactIds.slice(0, 4),
    }));
  const currentMilestone = params.state.milestones.find(
    (milestone) => milestone.status === "active",
  );
  const facts = params.pack.canonFacts
    .filter((fact) =>
      activeCharacters.some((character) => character.knownFactIds.includes(fact.id)),
    )
    .slice(0, 5);
  const relevantEvents = (params.state.eventQueue ?? params.pack.eventSeeds ?? [])
    .filter((event) =>
      event.status === "active" ||
      event.dueTurn === params.state.turn + 1 ||
      event.linkedCharacterIds.some((id) => params.state.activeCharacterIds.includes(id)),
    )
    .slice(0, 4)
    .map((event) => ({
      id: event.id,
      dueTurn: event.dueTurn,
      status: event.status,
      visibility: event.visibility,
      severity: event.severity,
      description: event.description,
    }));
  const eventPulse = buildEventPulse(relevantEvents, params.state.turn);
  const useChinese = (params.language ?? params.pack.language) !== "en";
  const template = worldTemplate(params.pack);
  const languageInstruction = useChinese
    ? "All natural-language fields must be in Simplified Chinese."
    : "All natural-language fields must be in English. Translate or romanize non-English source material; do not write Chinese sentences in visibleScene, actionTitle, visibleCue, hiddenOutcome, or eventSummary.";
  const recentText = params.state.recentEvents.join(" ");
  const priorHighRiskTurns = params.state.worldFlags.filter((flag) => /-high$/.test(flag)).length;
  const resistantCharacters = params.state.characterStates
    .filter((character) => character.attitude <= -2)
    .map((character) => character.characterId);
  const consequencePhase = (
    (params.state.turn >= 1 && priorHighRiskTurns > 0) ||
    (params.state.turn >= 2 && (
      resistantCharacters.length > 0 ||
      /当众|质问|追问|发难|摊牌|孤立|反制|public|confront|challenge|retaliat/i.test(recentText)
    ))
  );

  return `
You are xMocha World Mode's lightweight scene writer.
Return strict JSON only. Do not include Markdown or commentary.
${languageInstruction}

Write three concise playable futures for this scene. Deterministic code will apply state deltas, so do not invent ids, mechanics, or hidden extra state.

Context:
${json({
  premise: params.pack.premise,
  template: worldTemplate(params.pack),
  timeAnchor: params.pack.timeAnchor,
  player: params.state.playerCharacter,
  activeCharacters,
  currentLocationId: params.state.currentLocationId,
  currentMilestone,
  recentEvents: params.state.recentEvents,
  facts,
  worldPressure: params.state.worldPressure,
  eventQueue: relevantEvents,
  eventPulse,
  branchMemory: {
    priorHighRiskTurns,
    resistantCharacters,
    consequencePhase,
    recentChosenOutcomes: params.state.recentEvents.slice(-5),
  },
})}

${
  params.repairIssues?.length
    ? `The previous response failed validation. Repair these issues:\n- ${params.repairIssues.join("\n- ")}`
    : ""
}

Requirements:
- turnNumber must be ${params.state.turn + 1}.
- stateRevision must be ${params.state.revision}.
- candidates must use ids b1, b2, b3.
- Use riskLabel low for b1, medium for b2, high for b3.
- b1 should be cautious, b2 social/negotiated, b3 forceful/public.
${templatePromptGuidance(template)}
- Do not repeat prior action intent with cosmetic wording. The next turn must change leverage, actor, or consequence.
- If consequencePhase is true, do not offer another direct question/confrontation against the same person. Move to fallout: repair face, bring in a mediator/new actor, accept retaliation, or force a concrete consequence.
- If eventPulse has active or due events, make the visibleScene and at least one eventSummary show that pressure evolving.
- Event summaries should record a changed situation that future turns can build on.
- Keep actionTitle <= 16 Chinese chars or 8 English words.
- Keep visibleCue, hiddenOutcome, and eventSummary <= 36 Chinese chars or 22 English words.

Return exactly:
{
  "turnNumber": ${params.state.turn + 1},
  "stateRevision": ${params.state.revision},
  "visibleScene": "string",
  "candidates": [
    {
      "id": "b1",
      "riskLabel": "low",
      "actionTitle": "string",
      "visibleCue": "string",
      "hiddenOutcome": "string",
      "eventSummary": "string"
    },
    {
      "id": "b2",
      "riskLabel": "medium",
      "actionTitle": "string",
      "visibleCue": "string",
      "hiddenOutcome": "string",
      "eventSummary": "string"
    },
    {
      "id": "b3",
      "riskLabel": "high",
      "actionTitle": "string",
      "visibleCue": "string",
      "hiddenOutcome": "string",
      "eventSummary": "string"
    }
  ]
}`.trim();
}

function buildEventPulse(
  events: Array<{
    id: string;
    dueTurn?: number;
    status: "scheduled" | "active" | "resolved" | "expired";
    visibility?: string;
    severity?: number;
    description: string;
  }>,
  currentTurn: number,
): {
  active: string[];
  dueNow: string[];
  upcoming: string[];
  recentlyClosed: string[];
} {
  return {
    active: events
      .filter((event) => event.status === "active")
      .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
      .map(formatEventPulseItem),
    dueNow: events
      .filter((event) => event.status === "scheduled" && event.dueTurn === currentTurn + 1)
      .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
      .map(formatEventPulseItem),
    upcoming: events
      .filter((event) =>
        event.status === "scheduled" &&
        event.dueTurn !== undefined &&
        event.dueTurn > currentTurn + 1,
      )
      .sort((a, b) => (a.dueTurn ?? 99) - (b.dueTurn ?? 99))
      .map(formatEventPulseItem),
    recentlyClosed: events
      .filter((event) => event.status === "resolved" || event.status === "expired")
      .map(formatEventPulseItem),
  };
}

function formatEventPulseItem(event: {
  id: string;
  dueTurn?: number;
  status: string;
  visibility?: string;
  severity?: number;
  description: string;
}): string {
  return `${event.id}(${event.status}, T${event.dueTurn ?? "?"}, ${event.visibility ?? "unknown"}, severity=${event.severity ?? 0}): ${event.description}`;
}
