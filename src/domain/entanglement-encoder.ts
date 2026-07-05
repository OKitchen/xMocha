import type {
  Branch,
  BranchCommunity,
  BranchWorldDelta,
  RiskProfile,
  SessionState,
  UserPersona,
} from "./types";

function personaValueFromRisk(riskProfile: RiskProfile, useChinese: boolean): string {
  if (useChinese) {
    if (riskProfile === "high") return "成长上限";
    if (riskProfile === "low") return "稳定性";
    return "选择权";
  }
  if (riskProfile === "high") return "ambition";
  if (riskProfile === "low") return "stability";
  return "optionality";
}

function emotionalStateFromRisk(riskProfile: RiskProfile, useChinese: boolean): string {
  if (useChinese) {
    if (riskProfile === "high") return "高能但紧绷";
    if (riskProfile === "low") return "稳定但谨慎";
    return "警觉并保留余地";
  }
  if (riskProfile === "high") return "charged";
  if (riskProfile === "low") return "steady";
  return "alert";
}

function buildTraceEntries(
  selectedBranch: Branch,
  branchWorldDelta?: BranchWorldDelta,
  branchCommunity?: BranchCommunity,
  useChinese = false,
): string[] {
  const entries: string[] = useChinese
    ? [
        `选择「${selectedBranch.title}」，推进到：${selectedBranch.consequence}`,
        `接受了一条${riskLabel(selectedBranch.riskProfile)}风险路径，时间跨度是${selectedBranch.timeHorizon}。`,
      ]
    : [
        `Chose ${selectedBranch.title.toLowerCase()} and moved toward ${selectedBranch.consequence.toLowerCase()}.`,
        `Accepted a ${selectedBranch.riskProfile}-risk path with a ${selectedBranch.timeHorizon.toLowerCase()} horizon.`,
      ];

  if (branchWorldDelta?.pressureShift) {
    entries.push(branchWorldDelta.pressureShift);
  }

  if (branchCommunity?.dominantNarrative) {
    entries.push(branchCommunity.dominantNarrative);
  }

  return entries;
}

function updatePersona(
  previousPersona: UserPersona,
  selectedBranch: Branch,
  useChinese: boolean,
): UserPersona {
  const nextValue = personaValueFromRisk(selectedBranch.riskProfile, useChinese);
  const nextEmotion = emotionalStateFromRisk(selectedBranch.riskProfile, useChinese);

  const recentWins = [...previousPersona.recentWins, selectedBranch.title].slice(-3);
  const openWounds =
    selectedBranch.riskProfile === "high"
      ? [...previousPersona.openWounds, selectedBranch.keyUncertainty].slice(-3)
      : previousPersona.openWounds.slice(-3);

  return {
    riskTolerance: selectedBranch.riskProfile,
    emotionalState: nextEmotion,
    primaryValue: nextValue,
    recentWins,
    openWounds,
  };
}

export function encodeEntanglement(params: {
  session: SessionState;
  selectedBranch: Branch;
  branchWorldDelta?: BranchWorldDelta;
  branchCommunity?: BranchCommunity;
}): SessionState {
  const newEntries = buildTraceEntries(
    params.selectedBranch,
    params.branchWorldDelta,
    params.branchCommunity,
    params.session.language !== "en",
  );

  const quantumTrace = [...params.session.quantumTrace, ...newEntries].slice(-5);

  return {
    ...params.session,
    quantumTrace,
    userPersona: updatePersona(
      params.session.userPersona,
      params.selectedBranch,
      params.session.language !== "en",
    ),
  };
}

function riskLabel(riskProfile: RiskProfile): string {
  if (riskProfile === "high") return "高";
  if (riskProfile === "low") return "低";
  return "中";
}
