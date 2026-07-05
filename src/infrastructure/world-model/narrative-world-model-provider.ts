import { getPresetScenarioPack } from "../../domain/preset-scenarios";
import type { WorldModelProvider } from "../../application/ports";
import type { SessionState, WorldContext } from "../../domain/types";
import { inferDilemmaKind } from "../../domain/dilemma-kind";

function inferCareerConstraints(dilemma: string): string[] {
  const text = dilemma.toLowerCase();
  const constraints = ["Career moves take time to compound."];

  if (text.includes("startup")) constraints.push("Early-stage companies amplify uncertainty.");
  if (text.includes("city") || text.includes("relocat")) {
    constraints.push("Relocation creates social and logistical switching costs.");
  }
  if (text.includes("offer")) constraints.push("Negotiation windows are short and reputationally sensitive.");

  return constraints;
}

function inferCareerOpportunities(dilemma: string): string[] {
  const text = dilemma.toLowerCase();
  const opportunities = ["A single visible decision can change future positioning."];

  if (text.includes("startup")) opportunities.push("Smaller teams can create faster learning loops.");
  if (text.includes("manager") || text.includes("promotion")) {
    opportunities.push("Internal reputation can open compounding leadership opportunities.");
  }
  if (text.includes("offer")) opportunities.push("Competing paths can improve leverage and clarity.");

  return opportunities;
}

export class NarrativeWorldModelProvider implements WorldModelProvider {
  async getContext(session: SessionState): Promise<WorldContext> {
    const dilemmaKind = inferDilemmaKind(session);
    const constraints = inferCareerConstraints(session.dilemma);
    const opportunities = inferCareerOpportunities(session.dilemma);
    const latestAuthoredAction = session.userAuthoredActions.at(-1);
    const presetScenario = getPresetScenarioPack(session.presetScenarioId);

    if (presetScenario) {
      constraints.push(...presetScenario.constraints);
      opportunities.push(...presetScenario.opportunities);
    }

    if (latestAuthoredAction?.turn === session.turn) {
      constraints.push(
        session.language === "en"
          ? "A user-authored move creates interpretation risk until others understand what it means in practice."
          : "用户自己写下的行动需要先变成清楚、可执行的一步。",
      );
      opportunities.push(
        session.language === "en"
          ? "A user-authored move can expose higher-agency paths than the default branch menu revealed."
          : "用户自己写下的行动可能比默认选项更贴近真实需求。",
      );
    }

    if (!presetScenario && dilemmaKind === "food") {
      return {
        domain: session.domain,
        setting:
          session.language === "en"
            ? "A small everyday food decision where appetite, festival ritual, convenience, cost, and companionship all matter."
            : "一个关于今天吃什么的日常小决定：胃口、节日感、方便程度、预算和陪伴都会影响满意度。",
        externalConditions:
          session.language === "en"
            ? "The best answer should feel concrete and human, not strategic or career-like."
            : "最好的答案应该具体、有人味，不要变成职业规划或抽象战略。",
        constraints:
          session.language === "en"
            ? [
                "The decision happens today.",
                "Hunger, distance, wait time, budget, and current energy matter.",
                "Festival choices may sell out, require queues, or feel heavier than expected.",
              ]
            : [
                "这个决定今天就要落地。",
                "饥饿程度、距离、排队时间、预算和当前精力都很重要。",
                "节日相关食物可能排队、售罄，或吃完比想象中更有负担。",
              ],
        opportunities:
          session.language === "en"
            ? [
                "The meal can create comfort, ritual, or a small shared memory.",
                "A simple choice can reduce decision fatigue quickly.",
                "A small novelty can make an ordinary day feel more alive.",
              ]
            : [
                "这顿饭可以带来舒服、仪式感，或一次小小的共同记忆。",
                "一个简单选择可以快速减少纠结。",
                "一点新鲜感能让普通的一天更有存在感。",
              ],
        stableRules:
          session.language === "en"
            ? [
                "A good food decision respects appetite before abstraction.",
                "Convenience matters more when the body is already tired or hungry.",
                "Festival ritual works best when it still feels pleasant after eating.",
              ]
            : [
                "好的吃饭决定先尊重真实胃口，而不是抽象最优。",
                "身体已经累或饿时，方便比惊喜更重要。",
                "节日仪式感最好不要牺牲吃完之后的舒服。",
              ],
        currentWorldPressure:
          session.language === "en"
            ? "The next move should turn a vague craving into one practical meal choice."
            : "下一步要把模糊的“吃什么”变成一个今天真的能吃上的选择。",
      };
    }

    if (!presetScenario && dilemmaKind !== "career" && dilemmaKind !== "project") {
      return {
        domain: session.domain,
        setting:
          session.language === "en"
            ? "A general life decision where practical constraints, feelings, and nearby people matter more than career positioning."
            : "一个普通生活决策：现实条件、当下感受和身边人的影响，比职业定位更重要。",
        externalConditions:
          session.language === "en"
            ? "The answer should be concrete, emotionally legible, and easy to act on."
            : "回答应该具体、能理解人的感受，并且容易执行。",
        constraints:
          session.language === "en"
            ? [
                "The choice should stay close to the user's actual situation.",
                "Avoid career, startup, hiring, or market metaphors unless the user mentions them.",
                "Small decisions still deserve clear trade-offs.",
              ]
            : [
                "选择必须贴近用户真实问题，不要强行拔高。",
                "除非用户提到，否则不要使用职业、创业、招聘或市场隐喻。",
                "小决定也需要清楚说出取舍。",
              ],
        opportunities:
          session.language === "en"
            ? [
                "A plain answer can reduce mental load.",
                "Naming the trade-off can make the user feel understood.",
                "A small next step can be more useful than a dramatic transformation.",
              ]
            : [
                "一个朴素答案就能减少心理负担。",
                "说清取舍会让用户觉得被理解。",
                "一个小的下一步通常比宏大的转变更有用。",
              ],
        stableRules:
          session.language === "en"
            ? [
                "Do not overfit casual dilemmas to career logic.",
                "Human context beats abstract optimization.",
                "The next branch should be a practical action, not a slogan.",
              ]
            : [
                "不要把日常困境硬套进职业逻辑。",
                "人的处境比抽象最优更重要。",
                "下一条分支应该是实际行动，不是口号。",
              ],
        currentWorldPressure:
          session.language === "en"
            ? "The next move should make the decision feel lighter and more actionable."
            : "下一步要让这个决定变得更轻、更能行动。",
      };
    }

    const setting =
      latestAuthoredAction?.turn === session.turn
        ? `A continuing career journey reshaped by a self-authored move: ${latestAuthoredAction.title.toLowerCase()}.`
        : presetScenario
          ? `${presetScenario.summary} ${presetScenario.worldFacts[0]}`
        : session.canonicalPath.length === 0
        ? "A current-career decision point with limited information and real reputational stakes."
        : `A continuing career journey shaped by ${session.canonicalPath.at(-1)?.title.toLowerCase()}.`;

    const externalConditions =
      latestAuthoredAction?.turn === session.turn
        ? "The environment reacts not only to the decision itself, but to the fact that you authored your own path."
        : presetScenario
          ? presetScenario.seedNarratives[0] ??
            "The surrounding field is changing fast enough that static roles are becoming unstable."
        : session.userPersona.riskTolerance === "high"
        ? "The market rewards bold moves but punishes sloppy execution."
        : "The market favors deliberate positioning and credible follow-through.";

    return {
      domain: session.domain,
      setting,
      externalConditions,
      constraints,
      opportunities,
      stableRules: [
        "Trust changes slower than excitement.",
        "Career upside is usually paired with visible trade-offs.",
        "Social support affects whether hard choices remain sustainable.",
        "Self-authored moves increase agency, but also increase legibility pressure.",
        ...(presetScenario?.worldFacts ?? []).slice(0, 2),
      ],
      currentWorldPressure:
        latestAuthoredAction?.turn === session.turn
          ? `The world is now testing whether ${latestAuthoredAction.title.toLowerCase()} can become legible and sustainable.`
          : presetScenario
            ? presetScenario.socialTensions[0] ??
              "The next move will signal whether you are adapting early or reacting late."
          : session.quantumTrace.at(-1) ??
            "The next move will signal what kind of career story is becoming real.",
    };
  }
}
