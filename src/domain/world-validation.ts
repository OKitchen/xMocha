import { worldPackSchema, worldTurnResultSchema } from "./world-schemas";
import type {
  WorldPack,
  WorldTurnResult,
  WorldValidationIssue,
  WorldRuntimeState,
} from "./world-types";

export function validateWorldPack(pack: WorldPack): WorldValidationIssue[] {
  const parsed = worldPackSchema.safeParse(pack);
  const issues: WorldValidationIssue[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        code: "WORLD_PACK_SCHEMA",
        message: `${issue.path.join(".")}: ${issue.message}`,
      }));

  if (!parsed.success) return issues;

  const characterIds = new Set<string>();
  const locationIds = new Set<string>();
  const factIds = new Set<string>();
  const ruleIds = new Set<string>();
  const factionIds = new Set<string>();

  for (const character of pack.characters) {
    if (characterIds.has(character.id)) {
      issues.push({ code: "DUPLICATE_CHARACTER_ID", message: character.id });
    }
    characterIds.add(character.id);
  }

  for (const location of pack.locations) {
    if (locationIds.has(location.id)) {
      issues.push({ code: "DUPLICATE_LOCATION_ID", message: location.id });
    }
    locationIds.add(location.id);
  }

  for (const location of pack.locations) {
    for (const connectedId of location.connectedLocationIds) {
      if (!locationIds.has(connectedId)) {
        issues.push({
          code: "UNKNOWN_CONNECTED_LOCATION",
          message: `${location.id} -> ${connectedId}`,
        });
      }
    }
  }

  for (const fact of pack.canonFacts) {
    if (factIds.has(fact.id)) {
      issues.push({ code: "DUPLICATE_FACT_ID", message: fact.id });
    }
    factIds.add(fact.id);
  }

  for (const rule of pack.rules) {
    if (ruleIds.has(rule.id)) {
      issues.push({ code: "DUPLICATE_RULE_ID", message: rule.id });
    }
    ruleIds.add(rule.id);
  }

  for (const faction of pack.factions ?? []) {
    if (factionIds.has(faction.id)) {
      issues.push({ code: "DUPLICATE_FACTION_ID", message: faction.id });
    }
    factionIds.add(faction.id);
    for (const characterId of faction.memberCharacterIds) {
      if (!characterIds.has(characterId)) {
        issues.push({
          code: "UNKNOWN_FACTION_CHARACTER",
          message: `${faction.id} -> ${characterId}`,
        });
      }
    }
  }

  for (const character of pack.characters) {
    for (const factId of [...character.knownFactIds, ...character.unknownFactIds]) {
      if (!factIds.has(factId)) {
        issues.push({
          code: "UNKNOWN_CHARACTER_FACT",
          message: `${character.id} -> ${factId}`,
        });
      }
    }
  }

  if (!pack.characters.some((character) => character.playable)) {
    issues.push({ code: "NO_PLAYABLE_CHARACTER", message: pack.title });
  }

  for (const relationship of pack.relationships) {
    if (
      !characterIds.has(relationship.sourceCharacterId) ||
      !characterIds.has(relationship.targetCharacterId)
    ) {
      issues.push({
        code: "UNKNOWN_RELATIONSHIP_CHARACTER",
        message: `${relationship.sourceCharacterId} -> ${relationship.targetCharacterId}`,
      });
    }
  }

  for (const event of pack.eventSeeds ?? []) {
    for (const characterId of event.linkedCharacterIds) {
      if (!characterIds.has(characterId)) {
        issues.push({
          code: "UNKNOWN_EVENT_CHARACTER",
          message: `${event.id} -> ${characterId}`,
        });
      }
    }
    for (const factionId of event.linkedFactionIds) {
      if (!factionIds.has(factionId)) {
        issues.push({
          code: "UNKNOWN_EVENT_FACTION",
          message: `${event.id} -> ${factionId}`,
        });
      }
    }
  }

  if (!locationIds.has(pack.openingScenario.locationId)) {
    issues.push({
      code: "UNKNOWN_OPENING_LOCATION",
      message: pack.openingScenario.locationId,
    });
  }

  for (const characterId of pack.openingScenario.activeCharacterIds) {
    if (!characterIds.has(characterId)) {
      issues.push({ code: "UNKNOWN_OPENING_CHARACTER", message: characterId });
    }
  }

  return issues;
}

export function validateWorldTurn(params: {
  pack: WorldPack;
  state: WorldRuntimeState;
  result: WorldTurnResult;
}): WorldValidationIssue[] {
  const parsed = worldTurnResultSchema.safeParse(params.result);
  const issues: WorldValidationIssue[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        code: "WORLD_TURN_SCHEMA",
        message: `${issue.path.join(".")}: ${issue.message}`,
      }));

  if (!parsed.success) return issues;

  const characterIds = new Set(params.pack.characters.map((character) => character.id));
  characterIds.add(params.state.playerCharacter.characterId);
  const locationIds = new Set(params.pack.locations.map((location) => location.id));
  const factIds = new Set(params.pack.canonFacts.map((fact) => fact.id));
  const milestoneIds = new Set(params.state.milestones.map((milestone) => milestone.id));
  const candidateIds = new Set<string>();

  if (params.result.turnNumber !== params.state.turn + 1) {
    issues.push({ code: "UNEXPECTED_TURN", message: String(params.result.turnNumber) });
  }
  if (params.result.stateRevision !== params.state.revision) {
    issues.push({
      code: "REVISION_MISMATCH",
      message: `${params.result.stateRevision} != ${params.state.revision}`,
    });
  }

  const risks = new Set(params.result.candidates.map((candidate) => candidate.riskLabel));
  if (risks.size !== 3) {
    issues.push({
      code: "RISK_PROFILES_NOT_DISTINCT",
      message: [...risks].join(", "),
    });
  }

  for (const candidate of params.result.candidates) {
    if (candidateIds.has(candidate.id)) {
      issues.push({ code: "DUPLICATE_CANDIDATE_ID", message: candidate.id });
    }
    candidateIds.add(candidate.id);

    for (const characterId of [
      ...candidate.participatingCharacterIds,
      ...candidate.npcReactions.map((reaction) => reaction.characterId),
      ...candidate.stateDelta.activeCharacterIds,
      ...candidate.stateDelta.characterDeltas.map((delta) => delta.characterId),
    ]) {
      if (!characterIds.has(characterId)) {
        issues.push({
          code: "UNKNOWN_TURN_CHARACTER",
          candidateId: candidate.id,
          message: characterId,
        });
      }
    }

    if (
      candidate.stateDelta.nextLocationId &&
      !locationIds.has(candidate.stateDelta.nextLocationId)
    ) {
      issues.push({
        code: "UNKNOWN_TURN_LOCATION",
        candidateId: candidate.id,
        message: candidate.stateDelta.nextLocationId,
      });
    }
    if (candidate.stateDelta.nextLocationId) {
      const current = params.pack.locations.find(
        (location) => location.id === params.state.currentLocationId,
      );
      const reachable =
        candidate.stateDelta.nextLocationId === params.state.currentLocationId ||
        current?.connectedLocationIds.includes(candidate.stateDelta.nextLocationId);
      if (!reachable) {
        issues.push({
          code: "UNREACHABLE_TURN_LOCATION",
          candidateId: candidate.id,
          message: `${params.state.currentLocationId} -> ${candidate.stateDelta.nextLocationId}`,
        });
      }
    }

    for (const factId of candidate.groundingFactIds) {
      if (!factIds.has(factId)) {
        issues.push({
          code: "UNKNOWN_GROUNDING_FACT",
          candidateId: candidate.id,
          message: factId,
        });
      }
    }

    for (const capability of candidate.requiredCapabilities) {
      if (!params.state.playerCharacter.capabilities.includes(capability)) {
        issues.push({
          code: "UNDEFINED_PLAYER_CAPABILITY",
          candidateId: candidate.id,
          message: capability,
        });
      }
    }

    for (const reaction of candidate.npcReactions) {
      const character = params.pack.characters.find(
        (item) => item.id === reaction.characterId,
      );
      if (!character) continue;
      for (const factId of reaction.usedFactIds) {
        if (!factIds.has(factId)) {
          issues.push({
            code: "UNKNOWN_REACTION_FACT",
            candidateId: candidate.id,
            message: `${reaction.characterId} -> ${factId}`,
          });
        } else if (!character.knownFactIds.includes(factId)) {
          issues.push({
            code: "NPC_KNOWLEDGE_BOUNDARY",
            candidateId: candidate.id,
            message: `${reaction.characterId} cannot use ${factId}`,
          });
        } else if (!candidate.groundingFactIds.includes(factId)) {
          issues.push({
            code: "UNGROUNDED_NPC_REACTION",
            candidateId: candidate.id,
            message: `${reaction.characterId} -> ${factId}`,
          });
        }
      }
    }

    for (const signal of candidate.milestoneSignals) {
      if (!milestoneIds.has(signal.milestoneId)) {
        issues.push({
          code: "UNKNOWN_MILESTONE",
          candidateId: candidate.id,
          message: signal.milestoneId,
        });
      }
    }

    for (const delta of candidate.stateDelta.relationshipDeltas) {
      if (
        !characterIds.has(delta.sourceCharacterId) ||
        !characterIds.has(delta.targetCharacterId)
      ) {
        issues.push({
          code: "UNKNOWN_RELATIONSHIP_DELTA_CHARACTER",
          candidateId: candidate.id,
          message: `${delta.sourceCharacterId} -> ${delta.targetCharacterId}`,
        });
      }
    }
  }

  return issues;
}
