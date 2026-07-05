import type {
  Branch,
  BranchCommunity,
  BranchWorldDelta,
  RiskProfile,
  SessionState,
  TurnGenerationResult,
  UserAuthoredAction,
  UserAuthoredActionInput,
} from "./types";

type UserAuthoredActionSynthesis = {
  actionRecord: UserAuthoredAction;
  branch: Branch;
  branchWorldDelta: BranchWorldDelta;
  branchCommunity: BranchCommunity;
};

export function synthesizeUserAuthoredAction(params: {
  session: SessionState;
  turnResult: TurnGenerationResult;
  action: UserAuthoredActionInput;
}): UserAuthoredActionSynthesis {
  const anchorBranch = params.action.anchorBranchId
    ? params.turnResult.branches.find(
        (branch) => branch.id === params.action.anchorBranchId,
      )
    : undefined;
  const anchorWorldDelta = params.action.anchorBranchId
    ? params.turnResult.branchWorldDeltas.find(
        (delta) => delta.branchId === params.action.anchorBranchId,
      )
    : undefined;
  const anchorCommunity = params.action.anchorBranchId
    ? params.turnResult.branchCommunities.find(
        (community) => community.branchId === params.action.anchorBranchId,
      )
    : undefined;
  const lastWorldContext = params.session.lastWorldContext;

  const riskProfile = params.action.riskProfile ?? anchorBranch?.riskProfile ?? "medium";
  const timeHorizon =
    params.action.timeHorizon ?? anchorBranch?.timeHorizon ?? "3-6 months";
  const title = deriveTitle(params.action.rawInput);
  const summary = params.action.rawInput.trim();
  const consequence = deriveConsequence(
    params.action.rawInput,
    riskProfile,
    anchorBranch?.title,
  );
  const keyUncertainty = deriveUncertainty(
    params.action.rawInput,
    riskProfile,
    lastWorldContext?.currentWorldPressure,
  );
  const branchId = `ua-${params.turnResult.turnNumber}-${params.session.userAuthoredActions.length + 1}`;

  return {
    actionRecord: {
      turn: params.turnResult.turnNumber,
      rawInput: params.action.rawInput.trim(),
      title,
      summary,
      consequence,
      riskProfile,
      timeHorizon,
      anchorBranchId: params.action.anchorBranchId,
    },
    branch: {
      id: branchId,
      title,
      summary,
      consequence,
      score: 0.5,
      timeHorizon,
      riskProfile,
      keyUncertainty,
    },
    branchWorldDelta: {
      branchId,
      activatedConstraints: deriveConstraints(
        riskProfile,
        anchorWorldDelta?.activatedConstraints,
        lastWorldContext?.constraints,
      ),
      activatedOpportunities: deriveOpportunities(
        riskProfile,
        anchorWorldDelta?.activatedOpportunities,
        lastWorldContext?.opportunities,
      ),
      pressureShift: derivePressureShift(
        params.action.rawInput,
        riskProfile,
        lastWorldContext?.currentWorldPressure,
      ),
    },
    branchCommunity: {
      branchId,
      agents: communityAgentsForRisk(
        riskProfile,
        anchorCommunity?.agents.map((agent) => agent.role),
      ),
      socialDynamics: deriveSocialDynamics(
        riskProfile,
        anchorCommunity?.socialDynamics,
      ),
      dominantNarrative: deriveDominantNarrative(
        params.action.rawInput,
        riskProfile,
        anchorCommunity?.dominantNarrative,
      ),
    },
  };
}

function deriveTitle(rawInput: string): string {
  const cleaned = rawInput.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "User Authored Move";
  }

  const title = cleaned
    .split(/[.!?]/)[0]
    ?.split(" ")
    .slice(0, 6)
    .join(" ")
    .trim();

  if (!title) {
    return "User Authored Move";
  }

  return title.length > 48 ? `${title.slice(0, 45).trim()}...` : capitalize(title);
}

function deriveConsequence(
  rawInput: string,
  riskProfile: RiskProfile,
  anchorTitle: string | undefined,
): string {
  const anchorSuffix = anchorTitle ? ` beyond ${anchorTitle}` : "";
  const excerpt = rawInput.replace(/\s+/g, " ").trim().slice(0, 40);

  if (riskProfile === "high") {
    return excerpt
      ? `${excerpt.toLowerCase()} drives momentum with elevated exposure${anchorSuffix}`
      : `self-directed momentum with elevated exposure${anchorSuffix}`;
  }

  if (riskProfile === "low") {
    return excerpt
      ? `${excerpt.toLowerCase()} preserves stability with slower visible change${anchorSuffix}`
      : `self-directed stability with slower visible change${anchorSuffix}`;
  }

  return excerpt
    ? `${excerpt.toLowerCase()} preserves optionality with mixed signals${anchorSuffix}`
    : `self-directed optionality with mixed signals${anchorSuffix}`;
}

function deriveUncertainty(
  rawInput: string,
  riskProfile: RiskProfile,
  currentWorldPressure: string | undefined,
): string {
  const prefix =
    riskProfile === "high"
      ? "Whether the bold custom move can be executed cleanly"
      : riskProfile === "low"
        ? "Whether the careful custom move can still create momentum"
        : "Whether the custom compromise will be read as strategy rather than hesitation";

  const excerpt = rawInput.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!excerpt) {
    return currentWorldPressure ? `${prefix} under ${currentWorldPressure}` : prefix;
  }

  return currentWorldPressure
    ? `${prefix}: ${excerpt} | pressure: ${currentWorldPressure}`
    : `${prefix}: ${excerpt}`;
}

function communityAgentsForRisk(
  riskProfile: RiskProfile,
  anchorRoles: string[] | undefined,
) {
  const [primaryRole, secondaryRole, tertiaryRole] = anchorRoles ?? [];

  if (riskProfile === "high") {
    return [
      {
        role: primaryRole ?? "Current Stakeholder",
        stance: "uncertain" as const,
        motivation: "Wants to understand whether the sudden move is credible.",
        influence: 0.8,
        reaction: "Feels the energy of the move but questions whether it can hold up.",
      },
      {
        role: secondaryRole ?? "Trusted Confidant",
        stance: "supportive" as const,
        motivation: "Values initiative and personal agency.",
        influence: 0.7,
        reaction: "Encourages the move if the user is ready to absorb volatility.",
      },
      {
        role: tertiaryRole ?? "External Observer",
        stance: "neutral" as const,
        motivation: "Judges the move by visible execution, not by intent alone.",
        influence: 0.5,
        reaction: "Watches to see whether the custom path becomes legible in practice.",
      },
    ];
  }

  if (riskProfile === "low") {
    return [
      {
        role: primaryRole ?? "Current Stakeholder",
        stance: "supportive" as const,
        motivation: "Values continuity and stability.",
        influence: 0.8,
        reaction: "Sees the custom action as thoughtful if it protects trust and pacing.",
      },
      {
        role: secondaryRole ?? "Ambitious Peer",
        stance: "resistant" as const,
        motivation: "Worries caution may reduce future upside.",
        influence: 0.5,
        reaction: "Questions whether the move is too careful to change the trajectory.",
      },
      {
        role: tertiaryRole ?? "Close Supporter",
        stance: "supportive" as const,
        motivation: "Wants the user to avoid unnecessary regret.",
        influence: 0.6,
        reaction: "Approves of taking control in a way that still feels sustainable.",
      },
    ];
  }

  return [
    {
      role: primaryRole ?? "Current Stakeholder",
      stance: "uncertain" as const,
      motivation: "Needs the custom move to become legible quickly.",
      influence: 0.7,
      reaction: "Accepts the move in principle but wants clarity on what it really means.",
    },
    {
      role: secondaryRole ?? "Opportunity Sponsor",
      stance: "supportive" as const,
      motivation: "Sees value in a user-defined hybrid move.",
      influence: 0.75,
      reaction: "Supports experimentation if it still leads to visible forward motion.",
    },
    {
      role: tertiaryRole ?? "Personal Support System",
      stance: "supportive" as const,
      motivation: "Wants the user to retain agency without creating chaos.",
      influence: 0.65,
      reaction: "Feels the custom move is smart, but worries that ambiguity may linger.",
    },
  ];
}

function deriveConstraints(
  riskProfile: RiskProfile,
  anchorConstraints: string[] | undefined,
  worldConstraints: string[] | undefined,
): string[] {
  const inherited = [...(anchorConstraints ?? []), ...(worldConstraints ?? [])].slice(0, 2);

  const authoredConstraint =
    riskProfile === "high"
      ? "A self-authored leap raises the cost of unclear execution."
      : riskProfile === "low"
        ? "A self-authored careful move can preserve safety but may slow visible momentum."
        : "A self-authored hybrid move can create ambiguity if others cannot classify it quickly.";

  return dedupe([authoredConstraint, ...inherited]).slice(0, 3);
}

function deriveOpportunities(
  riskProfile: RiskProfile,
  anchorOpportunities: string[] | undefined,
  worldOpportunities: string[] | undefined,
): string[] {
  const inherited = [...(anchorOpportunities ?? []), ...(worldOpportunities ?? [])].slice(0, 2);

  const authoredOpportunity =
    riskProfile === "high"
      ? "A custom move can reveal conviction that pre-generated options could not fully show."
      : riskProfile === "low"
        ? "A custom move can protect trust while still preserving strategic choice."
        : "A custom move can unlock a bridge path between safety and momentum.";

  return dedupe([authoredOpportunity, ...inherited]).slice(0, 3);
}

function derivePressureShift(
  rawInput: string,
  riskProfile: RiskProfile,
  currentWorldPressure: string | undefined,
): string {
  const excerpt = rawInput.replace(/\s+/g, " ").trim().slice(0, 56);
  const priorPressure = currentWorldPressure
    ? ` Previous pressure: ${currentWorldPressure}`
    : "";

  if (riskProfile === "high") {
    return `The field now tests whether the user's self-authored conviction can survive execution scrutiny.${priorPressure}`;
  }

  if (riskProfile === "low") {
    return `The field now tests whether the user's self-authored stabilizing move can still produce forward motion.${priorPressure}`;
  }

  return excerpt
    ? `The field reorganizes around a user-authored hybrid move: ${excerpt}.${priorPressure}`
    : `The field reorganizes around a user-authored move that does not fully match the original menu.${priorPressure}`;
}

function deriveSocialDynamics(
  riskProfile: RiskProfile,
  anchorSocialDynamics: string | undefined,
): string {
  if (anchorSocialDynamics) {
    return `The authored move inherits some prior tension, but people now react to the user's explicit agency. ${anchorSocialDynamics}`;
  }

  if (riskProfile === "high") {
    return "Observers split between admiration for initiative and concern about overreach.";
  }

  if (riskProfile === "low") {
    return "Observers appreciate intentional control, but some question whether the move is bold enough.";
  }

  return "Observers see a custom compromise and begin testing whether it is strategic or indecisive.";
}

function deriveDominantNarrative(
  rawInput: string,
  riskProfile: RiskProfile,
  anchorDominantNarrative: string | undefined,
): string {
  const excerpt = rawInput.replace(/\s+/g, " ").trim().slice(0, 48);

  if (anchorDominantNarrative) {
    return excerpt
      ? `People around you see ${excerpt.toLowerCase()} as the user rewriting the offered script.`
      : `People around you see this as the user rewriting the offered script. ${anchorDominantNarrative}`;
  }

  if (riskProfile === "high") {
    return "People around you read this as a self-authored leap rather than a system-guided choice.";
  }

  if (riskProfile === "low") {
    return "People around you read this as a user-defined stabilizing move.";
  }

  return "People around you read this as the user rewriting the rules instead of accepting the offered branches.";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
