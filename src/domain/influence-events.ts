import type {
  Branch,
  BranchCommunity,
  BranchWorldDelta,
  InfluenceEvent,
} from "./types";

function riskIntensity(branch: Branch): number {
  if (branch.riskProfile === "high") return 0.82;
  if (branch.riskProfile === "low") return 0.42;
  return 0.62;
}

function riskDirection(branch: Branch): InfluenceEvent["direction"] {
  if (branch.riskProfile === "low") return "decrease";
  return branch.riskProfile === "high" ? "increase" : "redirect";
}

function normalizeEventId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFallbackInfluenceEvents(params: {
  branches: Branch[];
  branchCommunities: BranchCommunity[];
  branchWorldDeltas: BranchWorldDelta[];
  turnNumber: number;
}): InfluenceEvent[] {
  const useChinese = params.branches.some((branch) => /[\u4e00-\u9fff]/.test(
    `${branch.title}${branch.summary}${branch.consequence}`,
  ));

  return params.branches.flatMap((branch) => {
    const community = params.branchCommunities.find(
      (item) => item.branchId === branch.id,
    );
    const delta = params.branchWorldDeltas.find(
      (item) => item.branchId === branch.id,
    );
    const primaryAgent = community?.agents[0];
    const targetId = primaryAgent
      ? normalizeEventId(primaryAgent.role) || "primary-stakeholder"
      : "primary-stakeholder";
    const intensity = riskIntensity(branch);

    return [
      {
        id: `ie-${params.turnNumber}-${branch.id}-individual-to-society`,
        turn: params.turnNumber,
        branchId: branch.id,
        sourceType: "individual" as const,
        sourceId: "observer",
        targetType: "society" as const,
        targetId,
        dimension:
          branch.riskProfile === "high"
            ? ("pressure" as const)
            : branch.riskProfile === "low"
              ? ("trust" as const)
              : ("opportunity" as const),
        direction: riskDirection(branch),
        intensity,
        explanation: useChinese
          ? `选择「${branch.title}」会改变周围力量对你的理解：${community?.dominantNarrative ?? branch.consequence}`
          : `Choosing "${branch.title}" changes how surrounding stakeholders interpret the observer: ${community?.dominantNarrative ?? branch.consequence}`,
      },
      {
        id: `ie-${params.turnNumber}-${branch.id}-society-to-individual`,
        turn: params.turnNumber,
        branchId: branch.id,
        sourceType: community ? ("society" as const) : ("environment" as const),
        sourceId: targetId,
        targetType: "individual" as const,
        targetId: "observer",
        dimension:
          branch.riskProfile === "high"
            ? ("risk" as const)
            : branch.riskProfile === "low"
              ? ("trust" as const)
              : ("behavior" as const),
        direction: riskDirection(branch),
        intensity: Number(Math.max(0.25, intensity - 0.12).toFixed(2)),
        explanation: delta?.pressureShift
          ? useChinese
            ? `外部条件通过这一变化反馈到你身上：${delta.pressureShift}`
            : `The world feeds back into the observer through this pressure shift: ${delta.pressureShift}`
          : useChinese
            ? `相关反馈会让你重新面对这个不确定性：${branch.keyUncertainty}`
            : `Stakeholder reaction feeds back into the observer through ${branch.keyUncertainty}`,
      },
    ];
  });
}

export function reconcileInfluenceEvents(params: {
  branches: Branch[];
  branchCommunities: BranchCommunity[];
  branchWorldDeltas: BranchWorldDelta[];
  influenceEvents: InfluenceEvent[];
  turnNumber: number;
}): InfluenceEvent[] {
  const branchIds = new Set(params.branches.map((branch) => branch.id));
  const existingEvents = params.influenceEvents.filter((event) =>
    branchIds.has(event.branchId),
  );
  const existingBranchIds = new Set(
    existingEvents.map((event) => event.branchId),
  );
  const missingBranches = params.branches.filter(
    (branch) => !existingBranchIds.has(branch.id),
  );

  if (missingBranches.length === 0) {
    return existingEvents;
  }

  return [
    ...existingEvents,
    ...buildFallbackInfluenceEvents({
      branches: missingBranches,
      branchCommunities: params.branchCommunities,
      branchWorldDeltas: params.branchWorldDeltas,
      turnNumber: params.turnNumber,
    }),
  ];
}

export function influenceEventsForBranch(
  events: InfluenceEvent[],
  branchId: string,
): InfluenceEvent[] {
  return events.filter((event) => event.branchId === branchId);
}
