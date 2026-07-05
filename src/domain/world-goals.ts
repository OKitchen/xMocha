type GoalSuggestionCharacter = {
  id: string;
  name: string;
  goals?: string[];
};

type GoalSuggestionWorld = {
  worldPackId?: string;
  worldTemplate?: "generic" | "court_intrigue" | "mythic_exploration" | "anime_faction";
  openingScenario: {
    suggestedGoals: string[];
  };
  characters: GoalSuggestionCharacter[];
};

export function buildWorldChapterGoalSuggestions(params: {
  world: GoalSuggestionWorld;
  characterId?: string;
  customCharacterName?: string;
  actorNameOverride?: string;
  language?: "zh-CN" | "en";
  limit?: number;
}): string[] {
  const limit = params.limit ?? 3;
  const language = params.language ?? "en";
  const character = params.characterId
    ? params.world.characters.find((candidate) => candidate.id === params.characterId)
    : undefined;
  const actorName =
    cleanActorName(params.actorNameOverride) ??
    cleanActorName(params.customCharacterName) ??
    character?.name.trim() ??
    (language === "en" ? "this role" : "这个角色");
  const sourceGoals = [
    ...(character?.goals ?? []),
    ...params.world.openingScenario.suggestedGoals,
  ].filter((goal) => language === "en" ? !containsCjk(goal) : containsCjk(goal));
  const rawGoals = [
    ...sourceGoals,
    ...defaultChapterGoalTemplates(actorName, language, params.world.worldTemplate, params.world.worldPackId),
  ];

  const suggestions: string[] = [];
  for (const rawGoal of rawGoals) {
    const suggestion = normalizeGoalForActor(rawGoal, actorName, language);
    if (!suggestion || suggestions.includes(suggestion)) continue;
    suggestions.push(suggestion);
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

function cleanActorName(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function normalizeGoalForActor(goal: string, actorName: string, language: "zh-CN" | "en"): string {
  const cleaned = goal
    .trim()
    .replace(/^以[^，。；;、\s]{1,12}的身份/u, "")
    .replace(/^作为[^，。；;、\s]{1,12}/u, "")
    .replace(/^扮演[^，。；;、\s]{1,12}/u, "")
    .trim();
  if (!cleaned) return "";

  if (cleaned.includes(actorName)) return cleaned;
  if (language === "en") return `As ${actorName}, ${trimGoalPrefix(cleaned)}`;
  return `以${actorName}的身份${trimGoalPrefix(cleaned)}`;
}

function trimGoalPrefix(value: string): string {
  return value.replace(/^[，。；;、\s]+/u, "").trim();
}

function defaultChapterGoalTemplates(
  actorName: string,
  language: "zh-CN" | "en",
  worldTemplate?: GoalSuggestionWorld["worldTemplate"],
  worldPackId?: string,
): string[] {
  if (worldTemplate === "mythic_exploration" && worldPackId === "odyssey-cyclops-v1") {
    if (language === "en") {
      return [
        `As ${actorName}, escape Polyphemus' cave with the surviving crew`,
        `As ${actorName}, turn wine, the false name, and the flock into a route back to the ship`,
        `As ${actorName}, balance survival, glory, and the risk of Poseidon's curse`,
      ];
    }
    return [
      `以${actorName}的身份带幸存船员逃出波吕斐摩斯洞穴`,
      `以${actorName}的身份用烈酒、假名和羊群把陷阱变成归船路线`,
      `以${actorName}的身份在求生、荣耀和波塞冬诅咒之间作出取舍`,
    ];
  }

  if (worldTemplate === "mythic_exploration") {
    if (language === "en") {
      return [
        `As ${actorName}, make the East Sea acknowledge Nüwa's name without letting the vow become empty repetition`,
        `As ${actorName}, win mountain and witness support before casting wood and stone into the tide`,
        `As ${actorName}, resist the sea-depth voice and define what filling the sea means this turn`,
      ];
    }
    return [
      `以${actorName}的身份让东海承认女娃之名，同时避免誓愿变成空耗重复`,
      `以${actorName}的身份先争取山灵与见证者，再把木石投向海潮`,
      `以${actorName}的身份抵抗海渊之声，并定义本轮填海的意义`,
    ];
  }

  if (language === "en") {
    return [
      `As ${actorName}, stabilize the immediate situation and test the true attitude of key characters`,
      `As ${actorName}, win over one mediator and reduce the risk of public conflict`,
      `As ${actorName}, trace the source of rumors and learn where each side stands`,
    ];
  }
  return [
    `以${actorName}的身份稳住当前局势并试探关键人物真实态度`,
    `以${actorName}的身份争取一个中间人，降低公开冲突风险`,
    `以${actorName}的身份查清流言来源与各方站队`,
  ];
}
