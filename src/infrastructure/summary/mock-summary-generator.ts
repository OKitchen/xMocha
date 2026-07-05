import type { SummaryGenerator } from "../../application/ports";
import { inferDilemmaKind } from "../../domain/dilemma-kind";
import type { SessionState, SessionSummary } from "../../domain/types";

export class MockSummaryGenerator implements SummaryGenerator {
  async generate(session: SessionState): Promise<SessionSummary> {
    const useChinese = session.language !== "en";
    const dilemmaKind = inferDilemmaKind(session);
    const finalStep = session.canonicalPath.at(-1);
    const shadowByTurn = session.shadowTimelines
      .map((branches, index) => {
        const branch = branches[0];
        return branch
          ? useChinese
            ? `第 ${index + 1} 轮：${branch.title} 原本可能带来「${branch.consequence}」`
            : `turn ${index + 1}: ${branch.title} could have led to ${branch.consequence}`
          : undefined;
      })
      .filter(Boolean)
      .join("; ");

    if (useChinese) {
      if (dilemmaKind === "food") {
        return {
          narrative: `这次模拟把「${session.dilemma}」从一句模糊的纠结，拆成了几种真实的吃饭取舍：节日感、方便程度、当下胃口、陪伴和一点新鲜感。最后路径停在「${
            finalStep?.title ?? "还没拍板"
          }」，它的核心不是完美答案，而是让今天这顿饭更贴近你现在的状态。`,
          decisionArc: [
            "这条路径反复在问：你今天更想被照顾，还是更想留下节日记忆。",
            `最终选择偏向「${finalStep?.consequence ?? "让这顿饭更容易发生"}」。`,
            "这类小决定的价值，是减少消耗，而不是证明选择能力。",
          ],
          alternateHint: shadowByTurn
            ? `没选的吃法也不是错，只是会把这顿饭带向另一种心情：${shadowByTurn}。`
            : undefined,
        };
      }

      if (dilemmaKind !== "career" && dilemmaKind !== "project") {
        return {
          narrative: `这次模拟没有把「${session.dilemma}」拔高成宏大命题，而是把它拆成更容易行动的日常取舍。最后路径停在「${
            finalStep?.title ?? "还没拍板"
          }」，重点是让选择更轻、更具体，也更符合你当下的真实感受。`,
          decisionArc: [
            "这条路径反复测试的是舒服、方便、体验感和现实条件之间的平衡。",
            `最终结果偏向「${finalStep?.consequence ?? "一个更可执行的安排"}」。`,
            "不是每个选择都需要改变人生；有些选择只需要让今天顺一点。",
          ],
          alternateHint: shadowByTurn
            ? `未选择的方案仍然有参考价值：${shadowByTurn}。`
            : undefined,
        };
      }

      return {
        narrative: `你穿过了 ${session.turn} 轮不确定性，逐渐看清自己愿意承担哪一种现实。旅程最后停在「${
          finalStep?.title ?? "尚未解决的十字路口"
        }」，此时「${finalStep?.consequence ?? "变化"}」不再只是抽象想象，而变成了需要面对的具体取舍。`,
        decisionArc: [
          `这条路径反复测试了你对「${translatePrimaryValue(session.userPersona.primaryValue)}」的重视。`,
          `风险偏好最终停在「${translateRiskTolerance(session.userPersona.riskTolerance)}」。`,
          `旅程留下的情绪底色是「${translateEmotionalState(session.userPersona.emotionalState)}」。`,
        ],
        alternateHint: shadowByTurn
          ? `未选择的道路仍然留下影子：${shadowByTurn}。`
          : undefined,
      };
    }

    if (dilemmaKind === "food") {
      return {
        narrative: `This simulation turned "${session.dilemma}" from a vague food question into a few real trade-offs: ritual, convenience, appetite, companionship, and novelty. The path ended at ${
          finalStep?.title ?? "an unresolved choice"
        }, where the goal was not a perfect answer, but a meal that fits your actual state today.`,
        decisionArc: [
          "The path kept asking whether you needed comfort, festival memory, or less decision fatigue.",
          `The final choice leaned toward ${finalStep?.consequence ?? "a meal that can actually happen"}.`,
          "For small decisions, usefulness often means reducing friction, not maximizing everything.",
        ],
        alternateHint:
          shadowByTurn
            ? `The meals not chosen still point to other moods: ${shadowByTurn}.`
            : undefined,
      };
    }

    if (dilemmaKind !== "career" && dilemmaKind !== "project") {
      return {
        narrative: `This simulation kept "${session.dilemma}" close to ordinary life instead of turning it into a grand strategy. The path ended at ${
          finalStep?.title ?? "an unresolved choice"
        }, with the focus on making the choice lighter, more concrete, and more honest to the current situation.`,
        decisionArc: [
          "The path tested comfort, convenience, experience, and practical constraints.",
          `The final result leaned toward ${finalStep?.consequence ?? "a more actionable arrangement"}.`,
          "Not every decision has to change a life; some just need to make today easier.",
        ],
        alternateHint:
          shadowByTurn
            ? `Roads not taken still remain useful references: ${shadowByTurn}.`
            : undefined,
      };
    }

    return {
      narrative: `You moved through ${session.turn} turns of uncertainty and gradually clarified what kind of path you were willing to own. The journey ended at ${
        finalStep?.title ?? "an unresolved crossroads"
      }, where the trade-off of ${finalStep?.consequence ?? "change"} became concrete instead of abstract.`,
      decisionArc: [
        `The path repeatedly tested ${session.userPersona.primaryValue}.`,
        `Risk tolerance settled at ${session.userPersona.riskTolerance}.`,
        `The journey left a residue of ${session.userPersona.emotionalState}.`,
      ],
      alternateHint:
        shadowByTurn
          ? `Roads not taken remained visible: ${shadowByTurn}.`
          : undefined,
    };
  }
}

function translateRiskTolerance(value: string): string {
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };

  return labels[value] ?? value;
}

function translatePrimaryValue(value: string): string {
  const labels: Record<string, string> = {
    ambition: "成长上限",
    adaptability: "适应能力",
    clarity: "清晰感",
    freedom: "自主性",
    stability: "稳定性",
  };

  return labels[value] ?? value;
}

function translateEmotionalState(value: string): string {
  const labels: Record<string, string> = {
    charged: "高能但紧绷",
    curious: "好奇",
    grounded: "稳定",
    restless: "不安",
    watchful: "审慎观察",
  };

  return labels[value] ?? value;
}
