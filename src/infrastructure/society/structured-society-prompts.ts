import { inferDilemmaKind } from "../../domain/dilemma-kind";
import { getPresetScenarioPack } from "../../domain/preset-scenarios";
import type { SocietySimulationInput } from "../../domain/types";

function serializeList(label: string, values: string[]): string {
  if (values.length === 0) {
    return `${label}: none`;
  }

  return `${label}:\n- ${values.join("\n- ")}`;
}

function serializeUserProvidedFacts(
  facts: Array<{
    type: string;
    summary: string;
  }>,
): string {
  if (facts.length === 0) {
    return "user-provided facts: none";
  }

  return `user-provided facts:\n- ${facts
    .map((fact) => `[${fact.type}] ${fact.summary}`)
    .join("\n- ")}`;
}

function serializeRecentAuthoredAction(
  action:
    | {
        title: string;
        rawInput: string;
        riskProfile: string;
        consequence: string;
      }
    | undefined,
): string {
  if (!action) {
    return "recent user-authored action: none";
  }

  return `recent user-authored action:
- title: ${action.title}
- raw input: ${action.rawInput}
- risk profile: ${action.riskProfile}
- consequence: ${action.consequence}`;
}

export function buildStructuredSocietyPrompt(
  input: SocietySimulationInput,
): string {
  const { session, worldContext, branches, branchWorldDeltas, turnNumber } = input;
  const dilemmaKind = inferDilemmaKind(session);
  const presetScenario = getPresetScenarioPack(session.presetScenarioId);
  const canonicalPath =
    session.canonicalPath.length === 0
      ? "No prior choices yet."
      : session.canonicalPath
          .map(
            (step) =>
              `Turn ${step.turn}: ${step.title} -> ${step.consequence}`,
          )
          .join("\n");

  const quantumTrace =
    session.quantumTrace.length === 0
      ? "No quantum trace yet."
      : session.quantumTrace.map((entry) => `- ${entry}`).join("\n");
  const latestAuthoredAction = session.userAuthoredActions.at(-1);

  const branchBlock = branches
    .map((branch) => {
      const delta = branchWorldDeltas.find((item) => item.branchId === branch.id);
      return [
        `Branch ${branch.id}: ${branch.title}`,
        `- summary: ${branch.summary}`,
        `- consequence: ${branch.consequence}`,
        `- risk profile: ${branch.riskProfile}`,
        `- time horizon: ${branch.timeHorizon}`,
        `- key uncertainty: ${branch.keyUncertainty}`,
        `- pressure shift: ${delta?.pressureShift ?? "none"}`,
        `- activated constraints: ${delta?.activatedConstraints.join(", ") || "none"}`,
        `- activated opportunities: ${delta?.activatedOpportunities.join(", ") || "none"}`,
      ].join("\n");
    })
    .join("\n\n");

  const roleCastBlock = presetScenario
    ? presetScenario.roleCast
        .map(
          (role) =>
            `- ${role.role} [${role.baselineStance}] - ${role.relationship}; motivation: ${role.motivation}`,
        )
        .join("\n")
    : "none";

  return `
You are xMocha's society simulator.

Your job is to generate a plausible stakeholder community snapshot for each branch of a decision simulation.
Return only valid JSON. Do not add commentary before or after the JSON.
Do not include Markdown, code fences, or explanatory text.

Session:
- dilemma: ${session.dilemma}
- domain: ${session.domain}
- decision kind: ${dilemmaKind}
- theme: ${session.theme}
- turn number: ${turnNumber}

Canonical path so far:
${canonicalPath}

Quantum trace:
${quantumTrace}

${serializeRecentAuthoredAction(latestAuthoredAction)}

User persona:
- risk tolerance: ${session.userPersona.riskTolerance}
- emotional state: ${session.userPersona.emotionalState}
- primary value: ${session.userPersona.primaryValue}
- recent wins: ${session.userPersona.recentWins.join(", ") || "none"}
- open wounds: ${session.userPersona.openWounds.join(", ") || "none"}

World context:
- setting: ${worldContext.setting}
- external conditions: ${worldContext.externalConditions}
- current world pressure: ${worldContext.currentWorldPressure}
${serializeList("constraints", worldContext.constraints)}
${serializeList("opportunities", worldContext.opportunities)}
${serializeList("stable rules", worldContext.stableRules)}

${
  session.userProvidedData
    ? `User-provided grounding:
- source count: ${session.userProvidedData.sources.length}
- fact count: ${session.userProvidedData.factItems.length}
- user intent summary: ${session.userProvidedData.derivedBrief.userIntentSummary ?? "none"}
${serializeList("derived key constraints", session.userProvidedData.derivedBrief.keyConstraints)}
${serializeList("derived key stakeholders", session.userProvidedData.derivedBrief.keyStakeholders)}
${serializeList("derived active options", session.userProvidedData.derivedBrief.activeOptions)}
${serializeList("derived decision pressures", session.userProvidedData.derivedBrief.decisionPressures)}
${serializeUserProvidedFacts(
  session.userProvidedData.factItems.slice(0, 8).map((fact) => ({
    type: fact.type,
    summary: fact.summary,
  })),
)}
`
    : ""
}

${
  presetScenario
    ? `Grounding context:
- source type: preset scenario
- scenario id: ${presetScenario.scenarioId}
- scenario title: ${presetScenario.title}
- scenario summary: ${presetScenario.summary}
${serializeList("world facts", presetScenario.worldFacts)}
${serializeList("social tensions", presetScenario.socialTensions)}
${serializeList("seed narratives", presetScenario.seedNarratives)}
role cast:
${roleCastBlock}
Grounding user context:
- goal: ${session.userContextPack?.userGoal ?? presetScenario.starterUserContext.userGoal}
- current position: ${session.userContextPack?.currentPosition ?? presetScenario.starterUserContext.currentPosition}
- risk preference: ${session.userContextPack?.riskPreference ?? presetScenario.starterUserContext.riskPreference}
- time horizon: ${session.userContextPack?.timeHorizon ?? presetScenario.starterUserContext.timeHorizon}
${serializeList(
  "personal constraints",
  session.userContextPack?.personalConstraints ??
    presetScenario.starterUserContext.personalConstraints,
)}
${serializeList(
  "key stakeholders",
  session.userContextPack?.keyStakeholders ??
    presetScenario.starterUserContext.keyStakeholders,
)}
${serializeList(
  "success criteria",
  session.userContextPack?.successCriteria ??
    presetScenario.starterUserContext.successCriteria,
)}
`
    : ""
}

Branches to simulate:
${branchBlock}

Output requirements:
1. Return one community object for every branch.
2. Each community must reference the matching branch id.
3. Each branch must contain exactly 3 stakeholder agents.
4. Stakeholders must be plausible for the actual dilemma and meaningfully react to that branch.
5. The mix of stances should reflect support, resistance, neutrality, or uncertainty.
6. Influence must be a decimal between 0 and 1.
7. "socialDynamics" should describe the tension around that branch.
8. "dominantNarrative" should summarize how people around the user would read that choice.
9. If decision kind is "food", use stakeholders such as appetite, energy level, dining companion, family/friends, budget/time, convenience, restaurant availability, or festival mood. Do not use career stakeholders like manager, customers, cofounder, users, or mentor.
10. If decision kind is "general", use everyday stakeholders such as self, close person, time, budget, energy, practical constraints, or personal preference. Do not force career/social-market framing.
${
  latestAuthoredAction
    ? '11. If a recent user-authored action exists, reactions should clearly address that self-authored move and its second-order social consequences.'
    : ""
}

Return JSON with this exact shape:
[
  {
    "branchId": "b1",
    "agents": [
      {
        "role": "string",
        "stance": "supportive | resistant | neutral | uncertain",
        "motivation": "string",
        "influence": 0.7,
        "reaction": "string"
      }
    ],
    "socialDynamics": "string",
    "dominantNarrative": "string"
  }
]
`.trim();
}
