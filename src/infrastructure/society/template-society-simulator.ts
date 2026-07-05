import type { SocietySimulator } from "../../application/ports";
import { inferDilemmaKind } from "../../domain/dilemma-kind";
import { getPresetScenarioPack } from "../../domain/preset-scenarios";
import { branchCommunitiesSchema } from "../../domain/schemas";
import type {
  Branch,
  BranchCommunity,
  SocietySimulationInput,
} from "../../domain/types";

function communityForBranch(
  branch: Branch,
  input: SocietySimulationInput,
): BranchCommunity {
  const presetScenario = getPresetScenarioPack(input.session.presetScenarioId);
  const useChinese = input.session.language !== "en";
  const dilemmaKind = inferDilemmaKind(input.session);

  if (presetScenario) {
    const agents = presetScenario.roleCast.slice(0, 3).map((role) => ({
      role: useChinese ? localizePresetRole(role.role) : role.role,
      stance:
        branch.riskProfile === "high"
          ? role.baselineStance === "resistant"
            ? "resistant"
            : "uncertain"
          : branch.riskProfile === "low"
            ? role.baselineStance === "uncertain"
              ? "supportive"
              : role.baselineStance
            : role.baselineStance,
      motivation: useChinese
        ? localizePresetMotivation(role.role)
        : role.motivation,
      influence: role.influence,
      reaction: buildScenarioReaction(role.role, branch, input),
    }));

    return {
      branchId: branch.id,
      agents,
      socialDynamics:
        useChinese
          ? "周围的人正在判断这一步是真正适应、表演式转型，还是过度反应。"
          : presetScenario.socialTensions[1] ??
            "Observers are trying to decide whether this move is adaptation, theater, or overcorrection.",
      dominantNarrative:
        useChinese
          ? branch.riskProfile === "high"
            ? "周围的人会把它看成一次高可见度的角色重塑尝试。"
            : branch.riskProfile === "low"
              ? "周围的人会把它看成在领域变化中维持可信度的谨慎选择。"
              : "周围的人会把它看成一种有节制的适应，而不是失去信任的冒进。"
          : branch.riskProfile === "high"
            ? "People around you read this as a high-visibility attempt to redefine your role before the field does it for you."
            : branch.riskProfile === "low"
              ? "People around you read this as a cautious attempt to stay credible while the field shifts."
              : "People around you read this as a measured attempt to become AI-native without losing trust.",
    };
  }

  if (dilemmaKind === "food") {
    const agents = useChinese
      ? chineseFoodAgentsForBranch(branch)
      : englishFoodAgentsForBranch(branch);

    return {
      branchId: branch.id,
      agents,
      socialDynamics:
        useChinese
          ? branch.riskProfile === "high"
            ? "新鲜感和踩雷风险同时出现，关键是别让一顿饭变成负担。"
            : branch.riskProfile === "low"
              ? "省心和舒服占上风，但节日感或惊喜感会变弱。"
              : "口味、距离、时间和陪伴正在彼此拉扯。"
          : branch.riskProfile === "high"
            ? "Novelty and disappointment risk rise together, so the meal should not become a burden."
            : branch.riskProfile === "low"
              ? "Ease and comfort dominate, while ritual or surprise becomes smaller."
              : "Taste, distance, timing, and companionship pull against one another.",
      dominantNarrative:
        useChinese
          ? branch.riskProfile === "high"
            ? "这一步像是在给今天留一点新鲜记忆。"
            : branch.riskProfile === "low"
              ? "这一步像是在照顾身体和当下状态。"
              : "这一步像是在节日感、胃口和现实条件之间找平衡。"
          : branch.riskProfile === "high"
            ? "This move gives the day a small fresh memory."
            : branch.riskProfile === "low"
              ? "This move takes care of the body and the current mood."
              : "This move balances ritual, appetite, and practical constraints.",
    };
  }

  if (dilemmaKind !== "career" && dilemmaKind !== "project") {
    const agents = useChinese
      ? chineseEverydayAgentsForBranch(branch)
      : englishEverydayAgentsForBranch(branch);

    return {
      branchId: branch.id,
      agents,
      socialDynamics:
        useChinese
          ? branch.riskProfile === "high"
            ? "更有体验感的选择会带来期待，也会带来一点麻烦。"
            : branch.riskProfile === "low"
              ? "省心方案会降低压力，但可能让选择显得普通。"
              : "现实条件和个人偏好正在寻找一个舒服的中间点。"
          : branch.riskProfile === "high"
            ? "The richer option creates anticipation and a little friction."
            : branch.riskProfile === "low"
              ? "The easy option lowers pressure, but can feel ordinary."
              : "Practical constraints and personal preference are looking for a comfortable middle.",
      dominantNarrative:
        useChinese
          ? branch.riskProfile === "high"
            ? "这一步像是在选择更有记忆点的体验。"
            : branch.riskProfile === "low"
              ? "这一步像是在选择更轻、更容易落地的安排。"
              : "这一步像是在把模糊问题变成清楚条件。"
          : branch.riskProfile === "high"
            ? "This move chooses a more memorable experience."
            : branch.riskProfile === "low"
              ? "This move chooses a lighter and easier arrangement."
              : "This move turns a vague question into clearer conditions.",
    };
  }

  const agents = useChinese
    ? chineseAgentsForBranch(branch)
    : englishAgentsForBranch(branch, input);

  return {
    branchId: branch.id,
    agents,
    socialDynamics:
      useChinese
        ? branch.riskProfile === "high"
          ? "支持会伴随对可见承诺和快速执行的压力。"
          : branch.riskProfile === "low"
            ? "稳定会创造信任，但也有人担心它会缩小未来空间。"
            : "安全感和动能之间形成一场持续的平衡。"
        : branch.riskProfile === "high"
          ? "Support comes with pressure for visible commitment and rapid execution."
          : branch.riskProfile === "low"
            ? "Stability creates trust, but some observers worry it may narrow the field."
            : "Mixed loyalties create a balancing act between safety and momentum.",
    dominantNarrative:
      useChinese
        ? branch.riskProfile === "high"
          ? "周围的人会把它看成优先追求动能的下注。"
          : branch.riskProfile === "low"
            ? "周围的人会把它看成优先保持可持续性的选择。"
            : "周围的人会把它看成一种保留选择权的桥接策略。"
        : branch.riskProfile === "high"
          ? "People around you read this as a momentum-first bet."
          : branch.riskProfile === "low"
            ? "People around you read this as a durability-first move."
            : "People around you read this as a bridge strategy that preserves optionality.",
  };
}

function englishFoodAgentsForBranch(branch: Branch): BranchCommunity["agents"] {
  if (branch.riskProfile === "high") {
    return [
      {
        role: "Curiosity",
        stance: "supportive" as const,
        motivation: "Wants the festival meal to feel a little different.",
        influence: 0.72,
        reaction: "Pushes toward a limited item, new flavor, or small outing.",
      },
      {
        role: "Budget And Time",
        stance: "uncertain" as const,
        motivation: "Wants the meal to stay worth the effort.",
        influence: 0.66,
        reaction: "Checks whether queues, delivery time, or price are still acceptable.",
      },
      {
        role: "Appetite",
        stance: "neutral" as const,
        motivation: "Wants the food to feel good after eating, not only before ordering.",
        influence: 0.84,
        reaction: "Asks whether the exciting option will still feel comfortable.",
      },
    ];
  }

  if (branch.riskProfile === "low") {
    return [
      {
        role: "Appetite",
        stance: "supportive" as const,
        motivation: "Wants something reliable and comfortable soon.",
        influence: 0.86,
        reaction: "Rewards the option that gets good food in front of you quickly.",
      },
      {
        role: "Energy Level",
        stance: "supportive" as const,
        motivation: "Does not want the meal decision to become more work.",
        influence: 0.7,
        reaction: "Favors familiar food, short distance, and low coordination.",
      },
      {
        role: "Festival Mood",
        stance: "neutral" as const,
        motivation: "Still wants a small sign that today is special.",
        influence: 0.48,
        reaction: "Accepts a simple meal if it keeps one small ritual.",
      },
    ];
  }

  return [
    {
      role: "Dining Companion",
      stance: "uncertain" as const,
      motivation: "Wants the choice to work for more than one person.",
      influence: 0.68,
      reaction: "Supports the plan if timing and taste can line up.",
    },
    {
      role: "Appetite",
      stance: "supportive" as const,
      motivation: "Wants the meal to match the body, not the idea of a perfect meal.",
      influence: 0.82,
      reaction: "Keeps pulling the choice back toward what sounds good now.",
    },
    {
      role: "Convenience",
      stance: "neutral" as const,
      motivation: "Wants the plan to be easy enough to actually happen.",
      influence: 0.64,
      reaction: "Accepts some novelty as long as it does not add too much friction.",
    },
  ];
}

function chineseFoodAgentsForBranch(branch: Branch): BranchCommunity["agents"] {
  if (branch.riskProfile === "high") {
    return [
      {
        role: "好奇心",
        stance: "supportive" as const,
        motivation: "希望这顿节日饭有一点不一样的记忆。",
        influence: 0.72,
        reaction: "会把你推向限定款、新口味或一次小出门。",
      },
      {
        role: "预算和时间",
        stance: "uncertain" as const,
        motivation: "希望这顿饭不要为了新鲜感付出太多代价。",
        influence: 0.66,
        reaction: "会检查排队、配送时间和价格是否仍然划算。",
      },
      {
        role: "真实胃口",
        stance: "neutral" as const,
        motivation: "希望吃完之后舒服，而不只是点单前兴奋。",
        influence: 0.84,
        reaction: "会提醒你，刺激的选择不一定最适合现在的身体。",
      },
    ];
  }

  if (branch.riskProfile === "low") {
    return [
      {
        role: "真实胃口",
        stance: "supportive" as const,
        motivation: "希望尽快吃到可靠、舒服的一顿。",
        influence: 0.86,
        reaction: "会奖励熟悉、稳定、不容易出错的选择。",
      },
      {
        role: "当前精力",
        stance: "supportive" as const,
        motivation: "不希望吃什么这件事继续消耗脑力。",
        influence: 0.7,
        reaction: "更偏向近一点、快一点、少协调的方案。",
      },
      {
        role: "节日气氛",
        stance: "neutral" as const,
        motivation: "仍然希望今天有一点应景的小标记。",
        influence: 0.48,
        reaction: "只要保留一点仪式感，也能接受简单吃法。",
      },
    ];
  }

  return [
    {
      role: "一起吃的人",
      stance: "uncertain" as const,
      motivation: "希望这个选择不只适合一个人的口味。",
      influence: 0.68,
      reaction: "如果时间和口味能对上，就会支持这个安排。",
    },
    {
      role: "真实胃口",
      stance: "supportive" as const,
      motivation: "希望选择符合身体，而不是符合完美答案。",
      influence: 0.82,
      reaction: "会不断把选择拉回到此刻真正想吃什么。",
    },
    {
      role: "方便程度",
      stance: "neutral" as const,
      motivation: "希望计划足够容易发生。",
      influence: 0.64,
      reaction: "可以接受一点新鲜感，但不希望流程太麻烦。",
    },
  ];
}

function englishEverydayAgentsForBranch(branch: Branch): BranchCommunity["agents"] {
  if (branch.riskProfile === "high") {
    return [
      {
        role: "Personal Preference",
        stance: "supportive" as const,
        motivation: "Wants the choice to feel alive, not merely efficient.",
        influence: 0.75,
        reaction: "Pushes for the option with more texture or memory.",
      },
      {
        role: "Practical Constraints",
        stance: "uncertain" as const,
        motivation: "Wants the extra effort to remain reasonable.",
        influence: 0.7,
        reaction: "Checks time, money, and energy before the plan expands.",
      },
      {
        role: "Close Person",
        stance: "neutral" as const,
        motivation: "Wants the choice to leave you feeling good afterward.",
        influence: 0.55,
        reaction: "Supports the richer option if it does not create avoidable stress.",
      },
    ];
  }

  if (branch.riskProfile === "low") {
    return [
      {
        role: "Energy Level",
        stance: "supportive" as const,
        motivation: "Wants the decision to stop consuming attention.",
        influence: 0.78,
        reaction: "Rewards the option that is easy and immediate.",
      },
      {
        role: "Practical Constraints",
        stance: "supportive" as const,
        motivation: "Prefers a plan that can actually happen.",
        influence: 0.74,
        reaction: "Favors low-friction execution over a perfect idea.",
      },
      {
        role: "Personal Preference",
        stance: "neutral" as const,
        motivation: "Still wants the choice to feel like yours.",
        influence: 0.52,
        reaction: "Accepts the easy path if it keeps one small personal touch.",
      },
    ];
  }

  return [
    {
      role: "Practical Constraints",
      stance: "neutral" as const,
      motivation: "Wants clear conditions before commitment.",
      influence: 0.7,
      reaction: "Supports asking one more useful question.",
    },
    {
      role: "Personal Preference",
      stance: "supportive" as const,
      motivation: "Wants the decision to match your real feeling.",
      influence: 0.68,
      reaction: "Keeps the choice from becoming purely mechanical.",
    },
    {
      role: "Close Person",
      stance: "uncertain" as const,
      motivation: "May be affected by the final arrangement.",
      influence: 0.56,
      reaction: "Responds better when the trade-off is named clearly.",
    },
  ];
}

function chineseEverydayAgentsForBranch(branch: Branch): BranchCommunity["agents"] {
  if (branch.riskProfile === "high") {
    return [
      {
        role: "个人偏好",
        stance: "supportive" as const,
        motivation: "希望这个选择不只是有效率，也有一点值得记住。",
        influence: 0.75,
        reaction: "会推动你选更有体验感的一边。",
      },
      {
        role: "现实条件",
        stance: "uncertain" as const,
        motivation: "希望额外投入仍然合理。",
        influence: 0.7,
        reaction: "会检查时间、金钱和精力是否撑得住。",
      },
      {
        role: "亲近的人",
        stance: "neutral" as const,
        motivation: "希望你做完选择之后感觉舒服。",
        influence: 0.55,
        reaction: "如果不会制造额外压力，会支持更丰富的选择。",
      },
    ];
  }

  if (branch.riskProfile === "low") {
    return [
      {
        role: "当前精力",
        stance: "supportive" as const,
        motivation: "希望这个决定尽快停止消耗注意力。",
        influence: 0.78,
        reaction: "会奖励容易、直接、马上能做的选项。",
      },
      {
        role: "现实条件",
        stance: "supportive" as const,
        motivation: "更偏好真正能发生的安排。",
        influence: 0.74,
        reaction: "会把低摩擦执行放在完美方案前面。",
      },
      {
        role: "个人偏好",
        stance: "neutral" as const,
        motivation: "仍然希望选择有一点像你自己。",
        influence: 0.52,
        reaction: "只要保留一点个人小偏好，也能接受省心路径。",
      },
    ];
  }

  return [
    {
      role: "现实条件",
      stance: "neutral" as const,
      motivation: "希望先把关键限制说清楚。",
      influence: 0.7,
      reaction: "会支持多问一个真正有用的问题。",
    },
    {
      role: "个人偏好",
      stance: "supportive" as const,
      motivation: "希望决定符合你的真实感受。",
      influence: 0.68,
      reaction: "会避免选择变成纯粹机械的最优解。",
    },
    {
      role: "亲近的人",
      stance: "uncertain" as const,
      motivation: "可能会被最终安排影响。",
      influence: 0.56,
      reaction: "如果你说清取舍，会更容易理解这个选择。",
    },
  ];
}

function englishAgentsForBranch(
  branch: Branch,
  input: SocietySimulationInput,
): BranchCommunity["agents"] {
  if (branch.riskProfile === "high") {
    return [
      {
        role: "Potential Customer",
        stance: "supportive" as const,
        motivation: "Needs a visible reason to believe the project is real.",
        influence: 0.9,
        reaction: `Pushes for speed and ownership inside ${input.worldContext.setting.toLowerCase()}.`,
      },
      {
        role: "Family",
        stance: "uncertain" as const,
        motivation: "Wants upside without chaos.",
        influence: 0.7,
        reaction:
          "Supports the move but worries about sustainability and emotional spillover.",
      },
      {
        role: "Peer Mentor",
        stance: "neutral" as const,
        motivation: "Wants the choice to be legible and strategic.",
        influence: 0.5,
        reaction: `Encourages clarity about what success must look like under ${input.worldContext.currentWorldPressure.toLowerCase()}.`,
      },
    ];
  }

  if (branch.riskProfile === "low") {
    return [
      {
        role: "Current Manager",
        stance: "supportive" as const,
        motivation: "Values continuity and trust.",
        influence: 0.8,
        reaction: "Rewards steadiness if it still signals ambition and growth.",
      },
      {
        role: "Potential User",
        stance: "uncertain" as const,
        motivation: "Wants proof before investing attention.",
        influence: 0.55,
        reaction: "Treats caution as sensible if it creates sharper evidence.",
      },
      {
        role: "Close Friend",
        stance: "supportive" as const,
        motivation: "Wants you to avoid regret.",
        influence: 0.6,
        reaction: "Pushes you to preserve optionality even while staying grounded.",
      },
    ];
  }

  return [
    {
      role: "Current Manager",
      stance: "uncertain" as const,
      motivation: "Needs predictability without losing your contribution.",
      influence: 0.7,
      reaction: "Accepts a phased path but watches for signs of split commitment.",
    },
    {
      role: "Cofounder Candidate",
      stance: "supportive" as const,
      motivation: "Wants evidence you are serious without forcing a full leap yet.",
      influence: 0.8,
      reaction: "Welcomes momentum if the arrangement still moves fast enough.",
    },
    {
      role: "Partner or Family",
      stance: "supportive" as const,
      motivation: "Reduce downside while keeping growth alive.",
      influence: 0.75,
      reaction: "Sees the compromise as smart, but worries complexity will linger.",
    },
  ];
}

function chineseAgentsForBranch(branch: Branch): BranchCommunity["agents"] {
  if (branch.riskProfile === "high") {
    return [
      {
        role: "潜在客户",
        stance: "supportive" as const,
        motivation: "需要看到这个项目真的会被推进。",
        influence: 0.9,
        reaction: "会推动你更快拿出原型、报价或可试用版本。",
      },
      {
        role: "家人或亲近的人",
        stance: "uncertain" as const,
        motivation: "希望你有上升空间，但不要把生活拖进混乱。",
        influence: 0.7,
        reaction: "情感上支持，但会担心持续性、现金流和压力外溢。",
      },
      {
        role: "同行导师",
        stance: "neutral" as const,
        motivation: "希望这个选择在策略上说得通。",
        influence: 0.5,
        reaction: "会要求你定义什么叫成功，以及什么时候该停止。",
      },
    ];
  }

  if (branch.riskProfile === "low") {
    return [
      {
        role: "现任经理",
        stance: "supportive" as const,
        motivation: "重视连续性、可信度和稳定交付。",
        influence: 0.8,
        reaction: "只要你仍然表现出成长意愿，就会奖励你的稳定。",
      },
      {
        role: "潜在用户",
        stance: "uncertain" as const,
        motivation: "在投入注意力前需要看到更清楚的证据。",
        influence: 0.55,
        reaction: "会把谨慎理解为合理，但也会等待更具体的价值。",
      },
      {
        role: "亲近朋友",
        stance: "supportive" as const,
        motivation: "希望你减少遗憾，同时不要失去现实感。",
        influence: 0.6,
        reaction: "鼓励你保留选择权，但不要一直只停留在想象里。",
      },
    ];
  }

  return [
    {
      role: "现任经理",
      stance: "uncertain" as const,
      motivation: "希望保持可预测性，同时不失去你的贡献。",
      influence: 0.7,
      reaction: "可以接受阶段性安排，但会观察你是否分心。",
    },
    {
      role: "合伙人候选人",
      stance: "supportive" as const,
      motivation: "想确认你认真投入，但不一定要求你立刻全职。",
      influence: 0.8,
      reaction: "如果节奏足够快，会欢迎你用真实行动建立信任。",
    },
    {
      role: "个人支持系统",
      stance: "supportive" as const,
      motivation: "希望降低下行风险，同时保留成长机会。",
      influence: 0.75,
      reaction: "认为折中方案聪明，但会担心复杂度持续累积。",
    },
  ];
}

function localizePresetRole(role: string): string {
  const lowerRole = role.toLowerCase();

  if (lowerRole.includes("manager")) {
    return "直属经理";
  }

  if (lowerRole.includes("peer")) {
    return "同行同事";
  }

  if (lowerRole.includes("ai-forward")) {
    return "AI 推动者";
  }

  if (lowerRole.includes("support")) {
    return "个人支持系统";
  }

  return role;
}

function localizePresetMotivation(role: string): string {
  const lowerRole = role.toLowerCase();

  if (lowerRole.includes("manager")) {
    return "希望看到更高产出，但不想让团队节奏失控。";
  }

  if (lowerRole.includes("peer")) {
    return "关注公平、相关性，以及自己是否会被落下。";
  }

  if (lowerRole.includes("ai-forward")) {
    return "希望看到新工作流真的产生杠杆，而不是停留在口号。";
  }

  if (lowerRole.includes("support")) {
    return "希望你持续成长，而不是被焦虑驱动着重塑自己。";
  }

  return "希望这个选择既有成长性，也能保持现实稳定。";
}

function buildScenarioReaction(
  role: string,
  branch: Branch,
  input: SocietySimulationInput,
): string {
  const useChinese = input.session.language !== "en";
  const pressure = input.worldContext.currentWorldPressure.toLowerCase();

  if (useChinese) {
    if (role.toLowerCase().includes("manager")) {
      return branch.riskProfile === "high"
        ? "要求你证明这次大胆重塑会改善真实产出，而不是增加噪音。"
        : "希望这一步在当前压力下仍然清晰、可信、可执行。";
    }

    if (role.toLowerCase().includes("peer")) {
      return branch.riskProfile === "high"
        ? "会先把这一步看成地位信号，除非执行质量很快变得明显。"
        : "会观察这是真正适应，还是低风险的自我保护。";
    }

    if (role.toLowerCase().includes("ai-forward")) {
      return "支持实验，但期待看到具体杠杆，而不是抽象热情。";
    }

    return "支持成长，但担心持续性、身份漂移和二阶压力。";
  }

  if (role.toLowerCase().includes("manager")) {
    return branch.riskProfile === "high"
      ? `Pushes for proof that the bold repositioning will improve outcomes under ${pressure}.`
      : `Wants the move to stay legible, credible, and operational under ${pressure}.`;
  }

  if (role.toLowerCase().includes("peer")) {
    return branch.riskProfile === "high"
      ? "Reads the move as status-signaling unless the execution quality becomes obvious fast."
      : "Watches closely to see whether this is practical adaptation or just low-risk self-protection.";
  }

  if (role.toLowerCase().includes("ai-forward")) {
    return "Supports experimentation, but expects visible leverage rather than abstract enthusiasm.";
  }

  return "Supports growth, but worries about sustainability, identity drift, and second-order stress.";
}

export class TemplateSocietySimulator implements SocietySimulator {
  async simulate(input: SocietySimulationInput): Promise<BranchCommunity[]> {
    return branchCommunitiesSchema.parse(
      input.branches.map((branch) => communityForBranch(branch, input)),
    );
  }
}
