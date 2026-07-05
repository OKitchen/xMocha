import type {
  InterpretedWorldAction,
  WorldPack,
  WorldRuntimeState,
} from "./world-types";

type Intent = InterpretedWorldAction["intent"];

const intentRules: Array<{
  intent: Intent;
  pattern: RegExp;
  capabilityHints: string[];
  risk: InterpretedWorldAction["riskLabel"];
}> = [
  {
    intent: "investigate",
    pattern: /查|核对|调查|询问|打听|观察|名册|账|问|audit|investigate|inspect|compare/i,
    capabilityHints: ["整理信息", "观察下人反应", "核对礼单", "熟悉名册漏洞"],
    risk: "low",
  },
  {
    intent: "negotiate",
    pattern: /谈|商量|说服|协调|交换|承诺|negotiate|align|trade|persuade/i,
    capabilityHints: ["处理人情关系", "私下沟通", "传递消息"],
    risk: "medium",
  },
  {
    intent: "command",
    pattern: /命令|安排|调度|规定|规矩|分派|派人|command|assign|order/i,
    capabilityHints: ["调度下人", "制定规则", "传达宁府主人的意思"],
    risk: "medium",
  },
  {
    intent: "comfort",
    pattern: /安抚|缓和|照顾|慰问|体面|留面子|comfort|soften|mediate|face/i,
    capabilityHints: ["处理人情关系", "私下沟通", "观察下人反应"],
    risk: "low",
  },
  {
    intent: "threaten",
    pattern: /威胁|警告|惩罚|罚|杀|杖|公开责|threat|punish|warn/i,
    capabilityHints: ["赏罚执行", "制定规则"],
    risk: "high",
  },
  {
    intent: "deceive",
    pattern: /骗|假装|隐瞒|设局|诱导|deceive|trick|hide|pretend/i,
    capabilityHints: ["处理人情关系", "私下沟通"],
    risk: "high",
  },
  {
    intent: "withdraw",
    pattern: /暂缓|回避|离开|不管|观望|withdraw|wait|avoid/i,
    capabilityHints: [],
    risk: "low",
  },
];

const impossibleModernPattern =
  /手机|微信|电话|互联网|上网|报警|法院|律师|合同|公司|摄像|相机|电脑|email|e-mail|internet|police|court|lawyer|contract|camera|phone/i;

export function interpretWorldAction(params: {
  rawInput: string;
  runtime: WorldRuntimeState;
  pack: WorldPack;
  fallbackRisk?: InterpretedWorldAction["riskLabel"];
}): InterpretedWorldAction {
  const raw = params.rawInput.trim();
  const matchedRule = intentRules.find((rule) => rule.pattern.test(raw)) ?? intentRules[1]!;
  const playerCapabilities = params.runtime.playerCharacter.capabilities;
  const requiredCapabilities = playerCapabilities.filter((capability) =>
    raw.includes(capability) ||
    matchedRule.capabilityHints.some((hint) => capability.includes(hint) || hint.includes(capability)),
  );
  if (
    requiredCapabilities.length === 0 &&
    /让|派|吩咐|安排|ask|send|assign/i.test(raw) &&
    playerCapabilities.includes("调度下人")
  ) {
    requiredCapabilities.push("调度下人");
  }
  const targetCharacterIds = findTargetCharacters({
    raw,
    pack: params.pack,
    activeCharacterIds: params.runtime.activeCharacterIds,
    playerCharacterId: params.runtime.playerCharacter.characterId,
  });
  const violatesLimitations = [
    ...params.runtime.playerCharacter.limitations.filter((limitation) =>
      isLimitationTriggered(raw, limitation),
    ),
    ...(impossibleModernPattern.test(raw) ? ["越过时代边界：现代技术、现代制度或现代职业工具"] : []),
  ];
  const capabilityRequired = matchedRule.capabilityHints.length > 0;
  const feasible =
    violatesLimitations.length === 0 &&
    (!capabilityRequired || requiredCapabilities.length > 0 || matchedRule.intent === "negotiate");
  const useChinese = params.pack.language !== "en";

  return {
    intent: matchedRule.intent,
    targetCharacterIds,
    requiredCapabilities,
    violatesLimitations,
    riskLabel: params.fallbackRisk ?? matchedRule.risk,
    feasible,
    explanation: useChinese
      ? buildChineseExplanation({
          intent: matchedRule.intent,
          feasible,
          requiredCapabilities,
          violatesLimitations,
        })
      : buildEnglishExplanation({
          intent: matchedRule.intent,
          feasible,
          requiredCapabilities,
          violatesLimitations,
        }),
  };
}

function findTargetCharacters(params: {
  raw: string;
  pack: WorldPack;
  activeCharacterIds: string[];
  playerCharacterId: string;
}): string[] {
  const explicit = params.pack.characters
    .filter((character) =>
      character.id !== params.playerCharacterId &&
      (params.raw.includes(character.name) || params.raw.includes(character.id)),
    )
    .map((character) => character.id);
  return [...new Set(explicit.length > 0 ? explicit : params.activeCharacterIds)].slice(0, 3);
}

function isLimitationTriggered(raw: string, limitation: string): boolean {
  if (!limitation) return false;
  if (/现代|法律|技术|时代/.test(limitation)) return impossibleModernPattern.test(raw);
  if (/不能|无法|不/.test(limitation) && raw.includes(limitation.replace(/不能|无法|不/g, "").slice(0, 4))) {
    return true;
  }
  return false;
}

function buildChineseExplanation(params: {
  intent: Intent;
  feasible: boolean;
  requiredCapabilities: string[];
  violatesLimitations: string[];
}): string {
  const capability = params.requiredCapabilities.length
    ? `匹配能力：${params.requiredCapabilities.join("、")}。`
    : "未匹配明确能力。";
  const limits = params.violatesLimitations.length
    ? `触发边界：${params.violatesLimitations.join("；")}。`
    : "未触发硬边界。";
  return `动作意图判定为 ${params.intent}。${capability}${limits}${
    params.feasible ? "可转为世界内行动。" : "只能转为受阻或被 NPC 反制的行动。"
  }`;
}

function buildEnglishExplanation(params: {
  intent: Intent;
  feasible: boolean;
  requiredCapabilities: string[];
  violatesLimitations: string[];
}): string {
  const capability = params.requiredCapabilities.length
    ? `Matched capabilities: ${params.requiredCapabilities.join(", ")}.`
    : "No explicit capability matched.";
  const limits = params.violatesLimitations.length
    ? `Limits triggered: ${params.violatesLimitations.join("; ")}.`
    : "No hard boundary triggered.";
  return `Intent: ${params.intent}. ${capability} ${limits} ${
    params.feasible ? "This can become an in-world action." : "This becomes a blocked or resisted action."
  }`;
}
