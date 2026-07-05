export type DemoMetric = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  tone: "individual" | "opportunity" | "risk" | "society";
};

export type DemoBranch = {
  id: string;
  title: string;
  summary: string;
  consequence: string;
  riskProfile: "low" | "medium" | "high";
};

export type DemoStep = {
  turn: number;
  selected: DemoBranch;
  alternatives: DemoBranch[];
  collapseInsight: string;
};

export type DemoInfluenceEvent = {
  id: string;
  turn: number;
  sourceLabel: string;
  targetLabel: string;
  dimension: string;
  direction: string;
  intensity: number;
  explanation: string;
  tone: "individual" | "society";
};

export type DemoStakeholder = {
  id: string;
  role: string;
  stance: string;
  trust: number;
  resistance: number;
  influence: number;
  note: string;
};

export type DemoAblationRun = {
  mode: string;
  label: string;
  includedEvents: number;
  confidence: number;
  stress: number;
  societyTrust: number;
  resistance: number;
  distance: number;
  takeaway: string;
};

export type DemoReplay = {
  title: string;
  subtitle: string;
  dilemma: string;
  sessionId: string;
  model: string;
  thesis: string;
  steps: DemoStep[];
  individualMetrics: DemoMetric[];
  environmentMetrics: DemoMetric[];
  stakeholders: DemoStakeholder[];
  influenceEvents: DemoInfluenceEvent[];
  ablationRuns: DemoAblationRun[];
  summary: {
    headline: string;
    narrative: string;
    decisionArc: string[];
  };
};

export function buildDemoReplayFromSession(
  session: SessionState,
  ablationReport: AblationReport,
): DemoReplay {
  const isEnglish = session.language === "en";
  const finalStep = session.canonicalPath.at(-1);
  const individual = session.simulationState.individual;
  const environment = session.simulationState.environmentMetrics;
  const adaptation =
    individual.skills.adaptation ?? average(Object.values(individual.skills));
  const actorLabels = buildActorLabels(session, isEnglish);

  const steps: DemoStep[] = session.canonicalPath.map((step) => ({
    turn: step.turn,
    selected: {
      id: step.id,
      title: localizeReplayText(step.title, isEnglish),
      summary: localizeReplayText(step.summary, isEnglish),
      consequence: localizeReplayText(step.consequence, isEnglish),
      riskProfile: step.riskProfile,
    },
    alternatives: (session.shadowTimelines[step.turn - 1] ?? []).map(
      (branch) => ({
        id: branch.id,
        title: localizeReplayText(branch.title, isEnglish),
        summary: localizeReplayText(branch.summary, isEnglish),
        consequence: localizeReplayText(branch.consequence, isEnglish),
        riskProfile: branch.riskProfile,
      }),
    ),
    collapseInsight:
      localizeReplayText(
        session.visualHistory.find((entry) => entry.turn === step.turn)
          ?.memoryLabel ??
          (isEnglish
            ? `Turn ${step.turn} collapsed into “${step.title}”.`
            : `第 ${step.turn} 轮现实坍缩到“${step.title}”。`),
        isEnglish,
      ),
  }));

  const influenceEvents: DemoInfluenceEvent[] = session.influenceEvents.map(
    (event) => ({
      id: event.id,
      turn: event.turn,
      sourceLabel: actorLabel(event.sourceType, event.sourceId, isEnglish, actorLabels),
      targetLabel: actorLabel(event.targetType, event.targetId, isEnglish, actorLabels),
      dimension: dimensionLabel(event.dimension, isEnglish),
      direction: directionLabel(event.direction, isEnglish),
      intensity: event.intensity,
      explanation: localizeReplayText(event.explanation, isEnglish),
      tone: event.sourceType === "individual" ? "individual" : "society",
    }),
  );

  return {
    title: isEnglish ? "Your xMocha reality replay" : "你的 xMocha 现实回放",
    subtitle: isEnglish
      ? "A replay built from your collapsed choices, shadow paths, and simulated world response."
      : "基于你实际坍缩的选择、影子路径和世界反馈生成。",
    dilemma: localizeReplayText(session.dilemma, isEnglish),
    sessionId: session.sessionId,
    model: formatReplayModel(session, isEnglish),
    thesis:
      localizeReplayText(
        session.summary?.alternateHint ??
          session.summary?.narrative ??
          finalStep?.consequence ??
          (isEnglish
            ? "Complete the simulation to generate a final reflection."
            : "完成模拟后生成最终反思。"),
        isEnglish,
      ),
    steps,
    individualMetrics: [
      metric("confidence", isEnglish ? "Confidence" : "信心", individual.confidence, "individual"),
      metric("stress", isEnglish ? "Stress" : "压力", individual.stress, "risk"),
      metric("adaptation", isEnglish ? "Adaptation" : "适应力", adaptation, "opportunity"),
      metric("riskTolerance", isEnglish ? "Risk tolerance" : "风险承受度", individual.riskTolerance, "individual"),
    ],
    environmentMetrics: environmentMetrics(environment, isEnglish),
    stakeholders: session.simulationState.stakeholders.map((stakeholder) => ({
      id: stakeholder.id,
      role: localizeReplayText(actorLabels[stakeholder.id] ?? stakeholder.role, isEnglish),
      stance: stakeholder.stance,
      trust: stakeholder.trust,
      resistance: stakeholder.resistance,
      influence: stakeholder.influence,
      note: localizeReplayText(stakeholder.currentGoal, isEnglish),
    })),
    influenceEvents,
    ablationRuns: ablationReport.runs.map((run) => ({
      mode: run.mode,
      label: run.label,
      includedEvents: run.includedEventCount,
      confidence: run.metrics.individual.confidence ?? 0,
      stress: run.metrics.individual.stress ?? 0,
      societyTrust: run.metrics.society.averageTrust ?? 0,
      resistance: run.metrics.society.averageResistance ?? 0,
      distance: run.deltaFromFull?.totalDistance ?? 0,
      takeaway: isEnglish
        ? `${run.includedEventCount} influence events retained; distance from the full simulation is ${(run.deltaFromFull?.totalDistance ?? 0).toFixed(2)}.`
        : `保留 ${run.includedEventCount} 条影响事件；与完整模拟的距离为 ${(run.deltaFromFull?.totalDistance ?? 0).toFixed(2)}。`,
    })),
    summary: {
      headline: finalStep
        ? isEnglish
          ? `Final path: ${finalStep.title}`
          : `最终路径：${localizeReplayText(finalStep.title, isEnglish)}`
        : isEnglish
          ? "Simulation in progress"
          : "模拟进行中",
      narrative:
        localizeReplayText(
          session.summary?.narrative ??
            finalStep?.consequence ??
            (isEnglish ? "No final summary yet." : "尚未生成最终总结。"),
          isEnglish,
        ),
      decisionArc:
        session.summary?.decisionArc.length
          ? session.summary.decisionArc.map((item) => localizeReplayText(item, isEnglish))
          : session.canonicalPath.map((step) => localizeReplayText(step.title, isEnglish)),
    },
  };
}

function metric(
  id: string,
  label: string,
  value: number,
  tone: DemoMetric["tone"],
): DemoMetric {
  return { id, label, value, tone };
}

function environmentMetrics(
  values: Record<string, number>,
  isEnglish: boolean,
): DemoMetric[] {
  const labels: Record<string, { en: string; zh: string; tone: DemoMetric["tone"] }> = {
    momentum: { en: "Momentum", zh: "推进动能", tone: "opportunity" },
    pressure: { en: "Pressure", zh: "环境压力", tone: "risk" },
    opportunity: { en: "Opportunity", zh: "机会", tone: "opportunity" },
    trust: { en: "Trust", zh: "环境信任", tone: "society" },
    risk: { en: "Risk", zh: "环境风险", tone: "risk" },
    behavior: { en: "Behavior", zh: "行为倾向", tone: "individual" },
  };
  const entries = Object.entries(values).slice(0, 4);

  return entries.map(([id, value]) => {
    const definition = labels[id] ?? {
      en: id,
      zh: id,
      tone: "society" as const,
    };
    return metric(
      id,
      isEnglish ? definition.en : definition.zh,
      value,
      definition.tone,
    );
  });
}

function actorLabel(
  type: string,
  id: string,
  isEnglish: boolean,
  actorLabels: Record<string, string>,
): string {
  if (type === "individual") {
    return isEnglish ? "User" : "个人行动";
  }

  if (type === "environment") {
    return isEnglish ? "Environment" : "环境";
  }

  return actorLabels[id] ?? localizeReplayText(id, isEnglish);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildActorLabels(
  session: SessionState,
  isEnglish: boolean,
): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const stakeholder of session.simulationState.stakeholders) {
    labels[stakeholder.id] = localizeReplayText(stakeholder.role, isEnglish);
  }

  const runtime = session.worldRuntimeState;
  if (runtime?.playerCharacter) {
    labels[runtime.playerCharacter.characterId] = localizeReplayText(
      runtime.playerCharacter.name,
      isEnglish,
    );
  }

  for (const state of runtime?.characterStates ?? []) {
    labels[state.characterId] =
      labels[state.characterId] ??
      localizeReplayText(state.characterId, isEnglish);
  }

  return labels;
}

function formatReplayModel(session: SessionState, isEnglish: boolean): string {
  const provider = providerLabel(session.modelConfig?.provider, isEnglish);
  const model = session.modelConfig?.model;
  const suffix = session.generationFailures.some((failure) => failure.fallbackUsed)
    ? isEnglish
      ? "deterministic fallback"
      : "确定性备用生成"
    : isEnglish
      ? "xMocha simulation"
      : "xMocha 模拟";

  return [provider, model, suffix].filter(Boolean).join(" / ");
}

function providerLabel(provider: string | undefined, isEnglish: boolean): string {
  if (!provider) return isEnglish ? "Server default model" : "服务器默认模型";
  if (provider === "huggingface") return "Hugging Face Router";
  if (provider === "google") return "Google GenAI";
  if (provider === "gemma") return "Gemma / Ollama";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  return provider;
}

function dimensionLabel(value: string, isEnglish: boolean): string {
  if (isEnglish) return value;
  const labels: Record<string, string> = {
    trust: "信任",
    risk: "风险",
    behavior: "行为",
    opportunity: "机会",
    pressure: "压力",
  };
  return labels[value] ?? value;
}

function directionLabel(value: string, isEnglish: boolean): string {
  if (isEnglish) return value;
  const labels: Record<string, string> = {
    increase: "上升",
    decrease: "下降",
    redirect: "转向",
  };
  return labels[value] ?? value;
}

function localizeReplayText(value: string | undefined, isEnglish: boolean): string {
  if (!value) return "";
  if (isEnglish) return localizeChineseReplayText(value);

  const replacements: Array<[RegExp, string]> = [
    [/\bPrimary Stakeholder\b/g, "关键利益相关者"],
    [/\bRespond to the observer's choices\./g, "回应观察者的选择。"],
    [/《The Odyssey: The Cyclops' Cave》/g, "《奥德赛：独眼巨人洞穴》"],
    [/\bThe Odyssey: The Cyclops' Cave\b/g, "奥德赛：独眼巨人洞穴"],
    [/\bAchaean Sailor\b/g, "阿开亚船员"],
    [/\bkeep the ship ready\b/g, "让船保持待命"],
    [/\bmake the Cyclops misunderstand the attack\b/g, "让独眼巨人误解攻击来源"],
    [/\banswer Polyphemus' curse\b/g, "回应波吕斐摩斯的诅咒"],
    [/\banswer Poseidon's curse\b/g, "回应波塞冬的诅咒"],
    [/\bkeep the law of hospitality meaningful\b/g, "维护待客法则的意义"],
    [/\bOdysseus\b/g, "奥德修斯"],
    [/\bodysseus\b/g, "奥德修斯"],
    [/\bPolyphemus\b/g, "波吕斐摩斯"],
    [/\bpolyphemus\b/g, "波吕斐摩斯"],
    [/\bNoman\b/g, "无人"],
    [/\bnoman\b/g, "无人"],
    [/\bShip Lookout\b/g, "船上瞭望员"],
    [/\bship-lookout\b/g, "船上瞭望员"],
    [/\bOld Ram\b/g, "老公羊"],
    [/\bold-ram\b/g, "老公羊"],
    [/\bCyclops Neighbors\b/g, "邻近独眼巨人"],
    [/\bcyclops-neighbors\b/g, "邻近独眼巨人"],
    [/\bPoseidon\b/g, "波塞冬"],
    [/\bposeidon\b/g, "波塞冬"],
    [/\bZeus Xenios\b/g, "客护宙斯"],
    [/\bzeus-xenios\b/g, "客护宙斯"],
    [/\bMaronaean Wine\b/g, "马罗涅亚酒"],
    [/\bmaronaean-wine\b/g, "马罗涅亚酒"],
    [/\bachaean-sailor\b/g, "阿开亚船员"],
    [/\bCyclops\b/g, "独眼巨人"],
    [/\bship\b/g, "船"],
    [/\bmilestone\b/g, "关键节点"],
    [/\bsave surviving crew members\b/g, "救出幸存船员"],
    [/\bget back to the ship alive\b/g, "活着回到船上"],
    [/\bmake the 独眼巨人 misunderstand the attack\b/g, "让独眼巨人误解攻击来源"],
    [/\beat the intruders\b/g, "吃掉闯入者"],
    [/\bleave the cave with the flock\b/g, "随羊群离开洞穴"],
    [/\banswer 波吕斐摩斯' curse\b/g, "回应波吕斐摩斯的诅咒"],
    [/\banswer 波塞冬' curse\b/g, "回应波吕斐摩斯的诅咒"],
  ];

  return replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  ).replace(/《《([^》]+)》》/g, "《$1》");
}

function localizeChineseReplayText(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/创业公司创始团队/g, "Startup founding team"],
    [/当前雇主和团队/g, "Current employer and team"],
    [/职业网络与未来招聘方/g, "Professional network and future employers"],
    [/关键利益相关者/g, "Primary stakeholder"],
    [/接受创业公司 offer/g, "Accept the startup offer"],
    [/留在目前稳定岗位/g, "Stay in the current stable role"],
    [/加入创业公司/g, "Join the startup"],
    [
      /围绕这个决定评估风险、可信度和下一步行动。/g,
      "Evaluate the decision's risk, credibility, and next move.",
    ],
  ];

  return replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

export const hackathonDemoReplay: DemoReplay = {
  title: "xMocha: 多现实决策模拟",
  subtitle: "Gemma 4 生成现实分支，xMocha 坍缩路径并量化个人与社会的双向影响。",
  dilemma:
    "AI 正在快速改变我的领域。我应该继续强化当前岗位，转向 AI-native 工作方式，还是在市场定义我之前主动重塑自己的角色？",
  sessionId: "dc7a1eb3-71f6-4fe2-a33f-f0ea1181bec0",
  model: "Gemma 4 26B A4B / Ollama",
  thesis:
    "同一个选择路径下，社会反馈会显著改变个人压力与行动方式；个人行动也会重新塑造组织对角色价值的判断。",
  steps: [
    {
      turn: 1,
      selected: {
        id: "b2",
        title: "巩固现有岗位，用 AI 提升可靠交付",
        summary:
          "继续在当前擅长领域内工作，把 AI 作为提效工具，先降低焦虑并维持专业可信度。",
        consequence:
          "短期安全感更高，但如果行业转型速度超出预期，角色天花板会变低。",
        riskProfile: "low",
      },
      alternatives: [
        {
          id: "b1",
          title: "跨领域 AI PoC",
          summary: "主导一个可展示的小型 AI 概念验证，建立知识桥梁身份。",
          consequence: "获得创新者形象，但短期工作量和协调成本上升。",
          riskProfile: "medium",
        },
        {
          id: "b3",
          title: "暂停业务系统性重塑",
          summary: "主动降低当前交付投入，集中学习和构建外部 AI portfolio。",
          consequence: "前瞻性增强，但管理层信任和可见度可能下降。",
          riskProfile: "high",
        },
      ],
      collapseInsight: "第一轮选择低风险稳定路径，把现实坍缩到“先守住可信度”。",
    },
    {
      turn: 2,
      selected: {
        id: "b2",
        title: "小范围试点：定义跨职能 AI 工作流",
        summary:
          "在非核心但可见的侧翼项目中引入 AI-native 工作流，把变革过程变成试验田。",
        consequence:
          "成功可获得创新者与架构师标签；失败则会带来投入产出比质疑。",
        riskProfile: "medium",
      },
      alternatives: [
        {
          id: "b1",
          title: "AI 工具局部优化",
          summary: "只解决眼前最痛的交付问题，保持角色定义不变。",
          consequence: "短期绩效反馈好，但可能固化高级执行者身份。",
          riskProfile: "low",
        },
        {
          id: "b3",
          title: "外部咨询/副业探索",
          summary: "把 AI 能力带到外部市场，寻找新的职业资产。",
          consequence: "身份扩展最大，但财务和心理不确定性显著上升。",
          riskProfile: "high",
        },
      ],
      collapseInsight: "第二轮从防守转向试点，现实开始向“角色重塑”移动。",
    },
    {
      turn: 3,
      selected: {
        id: "ua-3-1",
        title: "内部推进 + 外部验证的双线策略",
        summary:
          "公司内部推动 AI 流程会遇到阻力，因此同步保留外部机会，用真实项目补足背景和经验要求。",
        consequence:
          "这条路径保留稳定收入和组织影响力，同时用外部市场验证新身份，最大化职业可选性。",
        riskProfile: "medium",
      },
      alternatives: [
        {
          id: "b1",
          title: "深入现有领域继续巩固",
          summary: "锁定当前业务痛点，用 AI 工具提升可量化交付。",
          consequence: "短期团队信任提升，但长期更依赖现有流程。",
          riskProfile: "low",
        },
        {
          id: "b2",
          title: "主导跨职能 AI 流程试点",
          summary: "超越团队边界，建立架构师与赋能者身份。",
          consequence: "职业杠杆显著提升，但资源分散和政治阻力更高。",
          riskProfile: "medium",
        },
        {
          id: "b3",
          title: "观望并积累 AI 知识",
          summary: "暂时不展示成果，等待更明确的行业信号。",
          consequence: "心理安全感更高，但可能失去主动权。",
          riskProfile: "low",
        },
      ],
      collapseInsight: "第三轮用户主动写入现实：内部组织变革和外部市场验证同步发生。",
    },
  ],
  individualMetrics: [
    { id: "confidence", label: "信心", value: 0.476, tone: "individual" },
    { id: "stress", label: "压力", value: 0.44, tone: "risk" },
    { id: "adaptation", label: "适应力", value: 0.698, tone: "opportunity" },
    { id: "riskTolerance", label: "风险承受度", value: 0.55, tone: "individual" },
  ],
  environmentMetrics: [
    { id: "momentum", label: "转型动能", value: 0.58, tone: "opportunity" },
    { id: "pressure", label: "组织压力", value: 0.62, tone: "risk" },
    { id: "opportunity", label: "外部机会", value: 0.66, tone: "opportunity" },
    { id: "trust", label: "环境信任", value: 0.52, tone: "society" },
  ],
  stakeholders: [
    {
      id: "manager",
      role: "直属经理",
      stance: "neutral",
      trust: 0.46,
      resistance: 0.505,
      influence: 0.891,
      note: "需要看到 AI 试点能转化为可量化业务收益。",
    },
    {
      id: "peer-engineers",
      role: "同组工程师",
      stance: "uncertain",
      trust: 0.45,
      resistance: 0.55,
      influence: 0.64,
      note: "担心 AI adoption 改变团队绩效标准。",
    },
    {
      id: "ai-forward-operator",
      role: "AI-forward 推动者",
      stance: "supportive",
      trust: 0.72,
      resistance: 0.25,
      influence: 0.72,
      note: "支持可见实验，希望看到工作流被真正重构。",
    },
    {
      id: "support-system",
      role: "个人支持系统",
      stance: "supportive",
      trust: 0.72,
      resistance: 0.25,
      influence: 0.58,
      note: "支持持续成长，但希望避免恐慌式重塑。",
    },
  ],
  influenceEvents: [
    {
      id: "ie-1",
      turn: 1,
      sourceLabel: "个人行动",
      targetLabel: "直属经理",
      dimension: "behavior",
      direction: "increase",
      intensity: 0.5,
      explanation: "稳定交付让管理者继续相信用户的专业可靠性。",
      tone: "individual",
    },
    {
      id: "ie-2",
      turn: 1,
      sourceLabel: "组织环境",
      targetLabel: "个人状态",
      dimension: "pressure",
      direction: "increase",
      intensity: 0.5,
      explanation: "未主动进入前沿议题，使用户对行业变化的压力感上升。",
      tone: "society",
    },
    {
      id: "ie-3",
      turn: 2,
      sourceLabel: "个人试点",
      targetLabel: "管理层认知",
      dimension: "opportunity",
      direction: "increase",
      intensity: 0.7,
      explanation: "跨职能试点把用户从执行者重新定位为流程革新推动者。",
      tone: "individual",
    },
    {
      id: "ie-4",
      turn: 2,
      sourceLabel: "试点反馈",
      targetLabel: "个人身份",
      dimension: "behavior",
      direction: "redirect",
      intensity: 0.6,
      explanation: "社会反馈迫使用户从单纯执行转向流程设计。",
      tone: "society",
    },
    {
      id: "ie-5",
      turn: 3,
      sourceLabel: "双线策略",
      targetLabel: "组织期待",
      dimension: "opportunity",
      direction: "redirect",
      intensity: 0.62,
      explanation: "内部推进与外部验证让组织重新评估用户的战略价值。",
      tone: "individual",
    },
    {
      id: "ie-6",
      turn: 3,
      sourceLabel: "组织阻力",
      targetLabel: "个人行动",
      dimension: "behavior",
      direction: "redirect",
      intensity: 0.5,
      explanation: "内部阻力反过来促使用户保留外部机会，避免把未来押在单一组织上。",
      tone: "society",
    },
  ],
  ablationRuns: [
    {
      mode: "full-coupled",
      label: "完整耦合",
      includedEvents: 6,
      confidence: 0.476,
      stress: 0.44,
      societyTrust: 0.544,
      resistance: 0.419,
      distance: 0,
      takeaway: "个人和社会双向影响都保留，呈现最真实的高压混合路径。",
    },
    {
      mode: "no-individual-influence",
      label: "关闭个人影响",
      includedEvents: 3,
      confidence: 0.476,
      stress: 0.44,
      societyTrust: 0.542,
      resistance: 0.425,
      distance: 0.012,
      takeaway: "社会状态变化很小，说明当前样本里组织反馈更强。",
    },
    {
      mode: "no-society-influence",
      label: "关闭社会影响",
      includedEvents: 3,
      confidence: 0.5,
      stress: 0.35,
      societyTrust: 0.544,
      resistance: 0.419,
      distance: 0.312,
      takeaway: "没有社会压力反馈时，个人压力明显降低。",
    },
    {
      mode: "isolated-baseline",
      label: "隔离基线",
      includedEvents: 0,
      confidence: 0.5,
      stress: 0.35,
      societyTrust: 0.542,
      resistance: 0.425,
      distance: 0.324,
      takeaway: "关闭双向影响后，路径失去社会现实感。",
    },
  ],
  summary: {
    headline: "最终角色：连接 AI 技术与业务痛点的知识桥梁",
    narrative:
      "用户没有选择单纯保守或彻底跳出，而是形成内部巩固、外部扩张的混合策略。它保留当前组织中的可信度，同时用外部机会验证 AI-native 身份。",
    decisionArc: [
      "先用 AI 提效守住可信度。",
      "再通过小范围试点改变组织对角色的期待。",
      "最后用内部推进和外部验证同步提高职业可选性。",
    ],
  },
};
import type { AblationReport, SessionState } from "./types";
