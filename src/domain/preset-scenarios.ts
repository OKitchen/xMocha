import type {
  PresetScenarioId,
  PresetScenarioPack,
  Theme,
} from "./types";

const aiFutureOfWorkScenario: PresetScenarioPack = {
  scenarioId: "ai_future_of_work",
  title: "AI Future Of Work",
  theme: "sci-fi",
  domain: "career",
  summary:
    "A grounded career scenario where AI is rapidly changing expectations, team structure, and what counts as leverage.",
  baseDilemma:
    "AI is rapidly changing my field. Should I double down on my current role, pivot toward AI-native work, or redesign my position before the market defines me?",
  worldFacts: [
    "Teams are under pressure to do more with fewer people by adopting AI-assisted workflows.",
    "Managers reward visible adaptation, but are skeptical of shallow AI theater.",
    "Peers disagree about whether AI raises leverage or accelerates replacement risk.",
  ],
  constraints: [
    "Your reputation can be damaged if you look either complacent or opportunistically hype-driven.",
    "Learning time competes with current delivery expectations.",
    "AI tools can increase output unevenly, which creates comparison pressure inside teams.",
  ],
  opportunities: [
    "A visible AI-native repositioning can expand your future role definition.",
    "Early experimentation can create internal leverage before job boundaries harden.",
    "Strong judgment about where AI helps and where it fails can become a trust advantage.",
  ],
  socialTensions: [
    "Some stakeholders want speed and automation, while others fear quality erosion and replacement.",
    "Peers may resent or admire someone who becomes the local AI-forward person too quickly.",
    "Leadership wants efficiency gains without publicizing instability.",
  ],
  seedNarratives: [
    "Adapt early, but do not become reducible to tool enthusiasm.",
    "The field rewards legible repositioning more than private anxiety.",
    "What looks like experimentation to you may look like threat signaling to others.",
  ],
  roleCast: [
    {
      role: "Manager",
      baselineStance: "uncertain",
      motivation: "Wants higher output without destabilizing the team.",
      influence: 0.86,
      relationship: "Direct evaluator of near-term credibility and role evolution.",
    },
    {
      role: "Peer Engineer",
      baselineStance: "uncertain",
      motivation: "Wants fairness, relevance, and not to be left behind.",
      influence: 0.64,
      relationship: "Shapes informal status and comparison pressure.",
    },
    {
      role: "AI-forward Operator",
      baselineStance: "supportive",
      motivation: "Wants visible adoption and proof that new workflows matter.",
      influence: 0.72,
      relationship: "Can sponsor experimentation if momentum looks real.",
    },
    {
      role: "Personal Support System",
      baselineStance: "supportive",
      motivation: "Wants sustainable growth, not panic-driven reinvention.",
      influence: 0.58,
      relationship: "Absorbs the emotional cost of your career repositioning.",
    },
  ],
  starterUserContext: {
    userGoal: "Stay professionally relevant while increasing long-term leverage.",
    currentPosition: "A capable operator in a field now being reshaped by AI.",
    availableOptions: [
      "Double down on current strengths and adopt AI gradually.",
      "Reposition toward AI-native work and visible experimentation.",
      "Redesign the role internally before external pressure forces a change.",
    ],
    riskPreference: "medium",
    timeHorizon: "6-12 months",
    personalConstraints: [
      "Current responsibilities leave limited experimentation time.",
      "You cannot afford a prolonged period of visible confusion.",
    ],
    keyStakeholders: [
      "manager",
      "peer engineers",
      "AI-forward operator",
      "personal support system",
    ],
    successCriteria: [
      "Remain trusted while becoming more future-relevant.",
      "Create optionality without looking unstable.",
    ],
  },
};

const presetScenarioPacks: Record<PresetScenarioId, PresetScenarioPack> = {
  ai_future_of_work: aiFutureOfWorkScenario,
};

export function getPresetScenarioPack(
  scenarioId: PresetScenarioId | undefined,
): PresetScenarioPack | undefined {
  if (!scenarioId) {
    return undefined;
  }

  return presetScenarioPacks[scenarioId];
}

export function isPresetScenarioId(value: unknown): value is PresetScenarioId {
  return value === "ai_future_of_work";
}

export function listPresetScenarioPacks(): PresetScenarioPack[] {
  return Object.values(presetScenarioPacks);
}

export function getPresetScenarioDefaultTheme(
  scenarioId: PresetScenarioId | undefined,
): Theme {
  return getPresetScenarioPack(scenarioId)?.theme ?? "sci-fi";
}
