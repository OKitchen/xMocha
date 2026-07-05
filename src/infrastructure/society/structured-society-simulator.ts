import type { SocietySimulator } from "../../application/ports";
import { inferDilemmaKind, type DilemmaKind } from "../../domain/dilemma-kind";
import { findOutputLanguageIssues } from "../../domain/output-language";
import { branchCommunitiesSchema } from "../../domain/schemas";
import type {
  Branch,
  BranchCommunity,
  SocietySimulationInput,
} from "../../domain/types";
import type { JsonGenerationClient } from "../llm/anthropic-client";
import { AnthropicJsonClient } from "../llm/anthropic-client";
import { buildStructuredSocietyPrompt } from "./structured-society-prompts";

function looksLikeCommunity(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    agents?: unknown;
    branchId?: unknown;
  };

  return typeof candidate.branchId === "string" && Array.isArray(candidate.agents);
}

function findCommunitiesArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) {
    return payload.some(looksLikeCommunity) ? payload : undefined;
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const values = Object.values(payload);

  if (values.length > 0 && values.every(looksLikeCommunity)) {
    return values;
  }

  for (const value of values) {
    const nested = findCommunitiesArray(value);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function unwrapCommunitiesPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const candidate = payload as {
    branchCommunities?: unknown;
    communities?: unknown;
    data?: unknown;
    result?: unknown;
  };

  return (
    findCommunitiesArray(payload) ??
    candidate.branchCommunities ??
    candidate.communities ??
    candidate.data ??
    candidate.result ??
    payload
  );
}

function assertBranchLinkage(
  communities: BranchCommunity[],
  input: SocietySimulationInput,
): void {
  const branchIds = new Set(input.branches.map((branch) => branch.id));

  if (communities.length !== input.branches.length) {
    throw new Error(
      `Society simulator returned ${communities.length} communities for ${input.branches.length} branches.`,
    );
  }

  for (const community of communities) {
    if (!branchIds.has(community.branchId)) {
      throw new Error(
        `Society simulator referenced unknown branch id "${community.branchId}".`,
      );
    }
  }
}

function assertOutputLanguage(
  communities: BranchCommunity[],
  input: SocietySimulationInput,
): void {
  const issues = findOutputLanguageIssues({
    language: input.session.language,
    fields: communities.flatMap((community) => [
      { label: `${community.branchId}.socialDynamics`, text: community.socialDynamics },
      { label: `${community.branchId}.dominantNarrative`, text: community.dominantNarrative },
      ...community.agents.flatMap((agent, index) => [
        { label: `${community.branchId}.agent.${index + 1}.role`, text: agent.role },
        { label: `${community.branchId}.agent.${index + 1}.motivation`, text: agent.motivation },
        { label: `${community.branchId}.agent.${index + 1}.reaction`, text: agent.reaction },
      ]),
    ]),
  });

  if (issues.length > 0) {
    throw new Error(`Output language mismatch. ${issues.slice(0, 4).join(" | ")}`);
  }
}

export function fallbackCommunityForBranch(
  branch: Branch,
  language?: SocietySimulationInput["session"]["language"],
  dilemmaKind: DilemmaKind = "career",
): BranchCommunity {
  const useChinese = language !== "en";

  if (dilemmaKind === "food") {
    return {
      branchId: branch.id,
      agents: [
        {
          role: useChinese ? "真实胃口" : "Appetite",
          stance: branch.riskProfile === "high" ? "neutral" : "supportive",
          motivation: useChinese
            ? "希望吃完之后舒服，而不是只在点单前兴奋。"
            : "Wants the meal to feel good after eating, not only before ordering.",
          influence: 0.84,
          reaction: useChinese
            ? "会把选择拉回到此刻身体真正想要什么。"
            : "Pulls the choice back toward what the body actually wants now.",
        },
        {
          role: useChinese ? "预算和时间" : "Budget And Time",
          stance: branch.riskProfile === "high" ? "uncertain" : "supportive",
          motivation: useChinese
            ? "希望这顿饭不要为了新鲜感付出太多代价。"
            : "Wants the meal to stay worth the effort.",
          influence: 0.66,
          reaction: useChinese
            ? "会检查排队、配送时间和价格是否仍然划算。"
            : "Checks whether queues, delivery time, or price are still acceptable.",
        },
        {
          role: useChinese ? "节日气氛" : "Festival Mood",
          stance: "neutral",
          motivation: useChinese
            ? "希望今天有一点应景的小标记。"
            : "Wants a small sign that today is special.",
          influence: 0.48,
          reaction: useChinese
            ? "只要保留一点仪式感，也能接受简单吃法。"
            : "Accepts a simple meal if it keeps one small ritual.",
        },
      ],
      socialDynamics: useChinese
        ? "口味、距离、时间和节日感正在互相拉扯。"
        : "Taste, distance, timing, and festival feeling pull against one another.",
      dominantNarrative: useChinese
        ? "这一步像是在节日感、胃口和现实条件之间找平衡。"
        : "This move balances ritual, appetite, and practical constraints.",
    };
  }

  if (dilemmaKind !== "career" && dilemmaKind !== "project") {
    return {
      branchId: branch.id,
      agents: [
        {
          role: useChinese ? "现实条件" : "Practical Constraints",
          stance: branch.riskProfile === "high" ? "uncertain" : "supportive",
          motivation: useChinese
            ? "希望这个选择真的能发生。"
            : "Wants the choice to actually happen.",
          influence: 0.72,
          reaction: useChinese
            ? "会检查时间、精力和成本是否撑得住。"
            : "Checks whether time, energy, and cost can support it.",
        },
        {
          role: useChinese ? "个人偏好" : "Personal Preference",
          stance: "supportive",
          motivation: useChinese
            ? "希望选择有一点像你自己。"
            : "Wants the choice to feel like yours.",
          influence: 0.68,
          reaction: useChinese
            ? "会避免选择变成纯粹机械的最优解。"
            : "Keeps the choice from becoming purely mechanical.",
        },
        {
          role: useChinese ? "当前精力" : "Energy Level",
          stance: branch.riskProfile === "low" ? "supportive" : "neutral",
          motivation: useChinese
            ? "希望决定尽快停止消耗注意力。"
            : "Wants the decision to stop consuming attention.",
          influence: 0.64,
          reaction: useChinese
            ? "会奖励容易、直接、马上能做的选项。"
            : "Rewards the option that is easy and immediate.",
        },
      ],
      socialDynamics: useChinese
        ? "现实条件和个人偏好正在寻找一个舒服的中间点。"
        : "Practical constraints and personal preference are looking for a comfortable middle.",
      dominantNarrative: useChinese
        ? "这一步像是在把模糊问题变成清楚条件。"
        : "This move turns a vague question into clearer conditions.",
    };
  }

  return {
    branchId: branch.id,
    agents: [
      {
        role: useChinese ? "关键利益相关者" : "Primary Stakeholder",
        stance: branch.riskProfile === "high" ? "uncertain" : "supportive",
        motivation: useChinese
          ? "希望用户的决定保持可信且可持续。"
          : "Wants the user's decision to remain credible and sustainable.",
        influence: 0.75,
        reaction:
          useChinese
            ? branch.riskProfile === "high"
              ? "看到了上限，但担心执行压力和波动。"
              : "如果仍能产生可见进展，会更容易支持这条路径。"
            : branch.riskProfile === "high"
              ? "Sees the upside, but worries about execution pressure and volatility."
              : "Sees the path as easier to support if it still creates visible progress.",
      },
      {
        role: useChinese ? "同行观察者" : "Peer Observer",
        stance: branch.riskProfile === "low" ? "resistant" : "neutral",
        motivation: useChinese
          ? "会用这一步是否改变用户轨迹来判断它。"
          : "Judges the move by whether it changes the user's trajectory.",
        influence: 0.55,
        reaction:
          useChinese
            ? branch.riskProfile === "low"
              ? "质疑更安全的选择是否能创造足够动能。"
              : "等待观察这一步会变成真实杠杆，还是只停留在意图。"
            : branch.riskProfile === "low"
              ? "Questions whether the safer move will create enough momentum."
              : "Waits to see whether the move becomes real leverage or just intention.",
      },
      {
        role: useChinese ? "个人支持系统" : "Personal Support System",
        stance: "supportive",
        motivation: useChinese
          ? "希望你成长，同时避免不必要的遗憾。"
          : "Wants growth without avoidable regret.",
        influence: 0.65,
        reaction: useChinese
          ? "支持这个决定，同时观察二阶压力。"
          : "Supports the decision while watching for second-order stress.",
      },
    ],
    socialDynamics:
      useChinese
        ? branch.riskProfile === "high"
          ? "这条分支同时制造兴奋和审视。"
          : branch.riskProfile === "low"
            ? "这条分支创造稳定，也引发对野心的疑问。"
            : "这条分支创造选择权，但要求他人忍受模糊。"
        : branch.riskProfile === "high"
          ? "The branch creates excitement and scrutiny at the same time."
          : branch.riskProfile === "low"
            ? "The branch creates stability, but also questions about ambition."
            : "The branch creates optionality, but asks others to tolerate ambiguity.",
    dominantNarrative:
      useChinese
        ? branch.riskProfile === "high"
          ? "人们会把它看成优先追求动能、需要快速证明自己的下注。"
          : branch.riskProfile === "low"
            ? "人们会把它看成优先保持稳定、但仍需要可见进展的选择。"
            : "人们会把它看成在不确定中保留主动权的桥接策略。"
        : branch.riskProfile === "high"
          ? "People read this as a momentum-first bet that must quickly prove itself."
          : branch.riskProfile === "low"
            ? "People read this as a stability-first move that still needs visible progress."
            : "People read this as a bridge strategy that preserves agency under uncertainty.",
  };
}

export function reconcileCommunities(
  communities: BranchCommunity[],
  input: SocietySimulationInput,
): BranchCommunity[] {
  return reconcileCommunitiesForBranches(
    communities,
    input.branches,
    input.session.language,
    inferDilemmaKind(input.session),
  );
}

export function reconcileCommunitiesForBranches(
  communities: BranchCommunity[],
  branches: Branch[],
  language?: SocietySimulationInput["session"]["language"],
  dilemmaKind: DilemmaKind = "career",
): BranchCommunity[] {
  const communitiesByBranchId = new Map(
    communities.map((community) => [community.branchId, community]),
  );

  return branches.map(
    (branch) =>
      communitiesByBranchId.get(branch.id) ??
      fallbackCommunityForBranch(branch, language, dilemmaKind),
  );
}

export class StructuredSocietySimulator implements SocietySimulator {
  constructor(
    private readonly client: JsonGenerationClient = new AnthropicJsonClient(),
    private readonly providerLabel = "LLM",
  ) {}

  async simulate(input: SocietySimulationInput): Promise<BranchCommunity[]> {
    const basePrompt = buildStructuredSocietyPrompt(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const prompt = attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nYour previous answer was invalid: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }\nReturn only strict JSON matching the required shape. If output language is zh-CN, rewrite every user-visible natural-language value in Simplified Chinese. Do not include Markdown, code fences, or commentary.`;
      try {
        const responseText = await this.client.generateJson(prompt);
        const parsedJson = JSON.parse(responseText);
        const parsed = branchCommunitiesSchema.parse(
          unwrapCommunitiesPayload(parsedJson),
        );
        const reconciled = reconcileCommunities(parsed, input);
        assertBranchLinkage(reconciled, input);
        assertOutputLanguage(reconciled, input);
        return reconciled;
      } catch (error) {
        console.warn("society_simulation_attempt_failed", {
          provider: this.providerLabel,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        });
        lastError = error;
      }
    }

    throw new Error(
      `${this.providerLabel} society simulation failed after retry: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
