import { inferDilemmaKind } from "../../domain/dilemma-kind";
import type { SessionState } from "../../domain/types";

function outputLanguageInstruction(session: SessionState): string {
  if (session.language === "en") {
    return "Write all natural-language summary fields in English.";
  }

  return [
    "Write all natural-language summary fields in Simplified Chinese.",
    "Keep JSON keys in English.",
    "Translate enum-like persona values into natural Chinese inside user-visible text; do not expose raw values like ambition, high, charged, low, medium, or adaptability.",
  ].join("\n");
}

export function buildStructuredSummaryPrompt(session: SessionState): string {
  const dilemmaKind = inferDilemmaKind(session);
  const canonicalPath = session.canonicalPath
    .map(
      (step) =>
        `Turn ${step.turn}: ${step.title} -> ${step.consequence}. ${step.summary}`,
    )
    .join("\n");

  const quantumTrace =
    session.quantumTrace.length === 0
      ? "No quantum trace available."
      : session.quantumTrace.map((entry) => `- ${entry}`).join("\n");

  const shadowHighlights = session.shadowTimelines
    .flat()
    .slice(0, 3)
    .map((branch) => branch.title)
    .join(", ");
  const shadowTimelineByTurn = session.shadowTimelines
    .map((branches, index) => {
      const compact = branches
        .slice(0, 2)
        .map((branch) => `${branch.title} -> ${branch.consequence}`)
        .join(" | ");

      return compact ? `Turn ${index + 1}: ${compact}` : undefined;
    })
    .filter(Boolean)
    .join("\n");
  const latestAuthoredAction = session.userAuthoredActions.at(-1);
  const finalSimulationState = session.simulationState
    ? `
Final simulation state:
- individual: confidence=${formatMetric(session.simulationState.individual.confidence)}, reputation=${formatMetric(session.simulationState.individual.reputation)}, trust=${formatMetric(session.simulationState.individual.trust)}, stress=${formatMetric(session.simulationState.individual.stress)}
- environment: ${Object.entries(session.simulationState.environmentMetrics)
        .map(([name, value]) => `${name}=${formatMetric(value)}`)
        .join(", ") || "none"}
- stakeholders: ${session.simulationState.stakeholders
        .slice(0, 5)
        .map(
          (stakeholder) =>
            `${stakeholder.role} [${stakeholder.stance}] trust=${formatMetric(stakeholder.trust)} resistance=${formatMetric(stakeholder.resistance)}`,
        )
        .join("; ") || "none"}
`
    : "";

  const userProvidedGrounding = session.userProvidedData
    ? `
User-provided grounding:
- source count: ${session.userProvidedData.sources.length}
- fact count: ${session.userProvidedData.factItems.length}
- user intent summary: ${session.userProvidedData.derivedBrief.userIntentSummary ?? "none"}
- key constraints: ${session.userProvidedData.derivedBrief.keyConstraints.join(", ") || "none"}
- key stakeholders: ${session.userProvidedData.derivedBrief.keyStakeholders.join(", ") || "none"}
- active options: ${session.userProvidedData.derivedBrief.activeOptions.join(", ") || "none"}
- decision pressures: ${session.userProvidedData.derivedBrief.decisionPressures.join(", ") || "none"}
`
    : "";

  return `
You are xMocha, writing the completion summary for a branching decision journey.

Return only valid JSON. Do not add any commentary before or after the JSON.
Do not include Markdown, code fences, or explanatory text.
${outputLanguageInstruction(session)}

Session:
- dilemma: ${session.dilemma}
- output language: ${session.language ?? "en"}
- decision kind: ${dilemmaKind}
- theme: ${session.theme}
- turns completed: ${session.turn}

Canonical path:
${canonicalPath}

Quantum trace:
${quantumTrace}

Final persona:
- risk tolerance: ${session.userPersona.riskTolerance}
- emotional state: ${session.userPersona.emotionalState}
- primary value: ${session.userPersona.primaryValue}
- recent wins: ${session.userPersona.recentWins.join(", ") || "none"}
- open wounds: ${session.userPersona.openWounds.join(", ") || "none"}

Shadow highlights:
${shadowHighlights || "none"}

Shadow timeline snapshots:
${shadowTimelineByTurn || "none"}

Recent user-authored action:
${
  latestAuthoredAction
    ? `- title: ${latestAuthoredAction.title}
- raw input: ${latestAuthoredAction.rawInput}
- consequence: ${latestAuthoredAction.consequence}`
    : "none"
}

${userProvidedGrounding}

${finalSimulationState}

Return JSON with this shape:
{
  "narrative": "2-4 paragraph cohesive ending",
  "decisionArc": ["short insight 1", "short insight 2"],
  "alternateHint": "optional one-sentence road-not-taken reflection"
}

If shadow timelines exist, the narrative should briefly acknowledge at least one road-not-taken pressure, not only the canonical path.
If decision kind is "food", write like a human reflection about a meal decision. Mention concrete trade-offs such as appetite, festival ritual, convenience, company, budget, distance, wait time, comfort, or novelty. Do not mention career, market, manager, startup, reputation, users, customers, MVP, funding, growth ceiling, or identity shift.
If decision kind is "general", keep the summary practical and emotionally legible. Do not inflate ordinary choices into career strategy or life transformation unless the user's own dilemma requires that.
`.trim();
}

function formatMetric(value: number): string {
  return value.toFixed(2);
}
