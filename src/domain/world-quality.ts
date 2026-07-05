import type {
  WorldPack,
  WorldPackDraft,
  WorldValidationIssue,
} from "./world-types";

const replacementCharacter = "\uFFFD";
const replacementPlaceholder = "□";

const lowConfidenceChineseNameFragments = [
  "有人",
  "不住",
  "猜疑",
  "否则",
  "回来",
  "回",
  "回去",
  "说道",
  "听后",
  "出来",
  "进去",
  "过来",
  "起来",
  "见有",
  "必须",
  "三人",
  "设法",
  "心中",
  "心里",
  "那里",
  "这里",
  "不知",
  "只得",
  "不得",
  "撒谎",
  "怎么",
  "什么",
  "炕上",
  "那人",
];

const lowConfidenceChineseNameStopwords = new Set([
  "一个",
  "一样",
  "一些",
  "于是",
  "他们",
  "她们",
  "你们",
  "我们",
  "众人",
  "主人",
  "主角",
  "人物",
  "资料",
  "文本",
  "世界",
  "用户",
  "这里",
  "那里",
  "这个",
  "那个",
  "什么",
  "没有",
  "已经",
  "正在",
  "可以",
  "不能",
  "后来",
  "突然",
  "只见",
  "此时",
  "现在",
  "自己",
  "大叔",
  "那人",
]);

const lowConfidenceEnglishNameStopwords = new Set([
  "A",
  "An",
  "The",
  "This",
  "That",
  "These",
  "Those",
  "Every",
  "Tonight",
  "Today",
  "Tomorrow",
  "Yesterday",
  "Morning",
  "Evening",
  "Night",
  "Dawn",
  "Dusk",
  "Opening",
  "Scene",
  "World",
  "Story",
  "Source",
  "Character",
  "Protagonist",
  "NPC",
  "He",
  "She",
  "They",
  "His",
  "Her",
  "Their",
  "Someone",
  "People",
  "Group",
  "Council",
  "Guild",
  "House",
]);

export function validateWorldPackQuality(
  draft: WorldPack | WorldPackDraft,
  sourceContent = "",
): WorldValidationIssue[] {
  const issues: WorldValidationIssue[] = [];
  const allText = [sourceContent, ...collectStrings(draft)].join("\n");
  if (allText.includes(replacementCharacter)) {
    issues.push({
      code: "REPLACEMENT_CHARACTER",
      message: "Source or WorldPack contains U+FFFD replacement characters; re-upload as valid UTF-8 text.",
    });
  }

  const lowConfidenceCharacters = draft.characters.filter((character) =>
    !isPlayableCharacterNameLikely({
      name: character.name,
      language: draft.language,
      sourceType: draft.sourceType,
    }),
  );
  for (const character of lowConfidenceCharacters) {
    issues.push({
      code: "LOW_CONFIDENCE_CHARACTER_NAME",
      message: `${character.id}: "${character.name}" does not look like a stable character or role name.`,
    });
  }

  const lowConfidenceIds = new Set(lowConfidenceCharacters.map((character) => character.id));
  for (const characterId of draft.openingScenario.activeCharacterIds) {
    if (lowConfidenceIds.has(characterId)) {
      issues.push({
        code: "LOW_CONFIDENCE_OPENING_CHARACTER",
        message: `Opening scenario uses low-confidence character "${characterId}".`,
      });
    }
  }

  const lowConfidenceNames = lowConfidenceCharacters.map((character) => character.name);
  const goalText = [
    draft.premise,
    draft.timeAnchor,
    draft.openingScenario.event,
    ...draft.openingScenario.suggestedGoals,
  ].join("\n");
  for (const name of lowConfidenceNames) {
    if (name && goalText.includes(name)) {
      issues.push({
        code: "LOW_CONFIDENCE_CHARACTER_IN_GOAL",
        message: `World summary or suggested goal references low-confidence character "${name}".`,
      });
      break;
    }
  }

  return issues;
}

export function getWorldPackQualityWarnings(
  draft: WorldPack | WorldPackDraft,
): WorldValidationIssue[] {
  const warnings: WorldValidationIssue[] = [];
  if (hasGenericRelationshipGraph(draft)) {
    warnings.push({
      code: "GENERIC_RELATIONSHIP_GRAPH",
      message: "Most relationships are compiler fallback links rather than extracted character relationships.",
    });
  }
  return warnings;
}

export function assertWorldSourceTextIsUsable(content: string): void {
  if (content.includes(replacementCharacter)) {
    throw new Error("上传文本包含 U+FFFD 替换字符，通常表示编码或截断损坏。请重新保存为 UTF-8 TXT/Markdown 后再上传。");
  }
}

function hasGenericRelationshipGraph(draft: WorldPack | WorldPackDraft): boolean {
  if (draft.characters.length <= 1) {
    return false;
  }
  const genericRelationships = draft.relationships.filter((relationship) =>
    /资料关联|source-linked|auto|自动|opening conflict|模板推断|template-inferred/i.test(
      `${relationship.kind} ${relationship.publicContext}`,
    ),
  );
  return (
    draft.relationships.length === 0 ||
    genericRelationships.length / Math.max(draft.relationships.length, 1) >= 0.7
  );
}

export function preprocessWorldSourceText(content: string): {
  content: string;
  warnings: WorldValidationIssue[];
} {
  const replacementCount = countReplacementCharacters(content);
  if (replacementCount === 0) {
    return { content, warnings: [] };
  }

  const maxAllowed = Math.max(8, Math.floor(content.length * 0.002));
  if (replacementCount > maxAllowed) {
    throw new Error(
      `上传文本包含 ${replacementCount} 个 U+FFFD 替换字符，损坏比例较高。请先重新保存为 UTF-8 或换一个更干净的文本来源。`,
    );
  }

  return {
    content: content.replace(/\uFFFD+/g, replacementPlaceholder),
    warnings: [
      {
        code: "SOURCE_REPLACEMENT_CHARACTERS_REPLACED",
        message: `Detected ${replacementCount} U+FFFD replacement character(s); replaced them with "${replacementPlaceholder}" placeholders before compilation.`,
      },
    ],
  };
}

function countReplacementCharacters(value: string): number {
  return [...value].filter((character) => character === replacementCharacter).length;
}

function isPlayableCharacterNameLikely(params: {
  name: string;
  language: WorldPack["language"];
  sourceType: WorldPack["sourceType"];
}): boolean {
  const name = normalizeCharacterName(params.name);
  if (!name) return false;
  if (params.sourceType === "lore") {
    if (params.language === "en") {
      return isLikelyEnglishNarrativeName(name, { allowGenericLoreNames: true });
    }
    return isLikelyChineseLoreRole(name);
  }
  if (params.language === "en") {
    return isLikelyEnglishNarrativeName(name);
  }
  return isLikelyChineseNarrativeName(name);
}

function normalizeCharacterName(value: string): string {
  return value
    .replace(/[「」『』“”"'.,，。；;：:\s]/g, "")
    .replace(/^(那|这|有|让|向|对|和|与)/, "")
    .trim();
}

function isLikelyChineseNarrativeName(name: string): boolean {
  if (!/^[\p{Script=Han}]{2,4}$/u.test(name)) return false;
  if (lowConfidenceChineseNameStopwords.has(name)) return false;
  if (lowConfidenceChineseNameFragments.some((fragment) => name.includes(fragment))) {
    return false;
  }
  if (name.length >= 3 && /[回说问听看见]$/u.test(name)) return false;
  if (/[的了是在和与及或但而又也都只便就却把被将从到]/u.test(name)) {
    return false;
  }
  return true;
}

function isLikelyEnglishNarrativeName(
  name: string,
  options: { allowGenericLoreNames?: boolean } = {},
): boolean {
  if (name.includes(replacementCharacter)) return false;
  if (/^(Source protagonist|World explorer)$/i.test(name)) return true;
  if (name.length < 2 || name.length > 32) return false;
  const words = name.split(/[ -]+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  if (words.some((word) => lowConfidenceEnglishNameStopwords.has(word))) {
    return false;
  }
  if (
    !options.allowGenericLoreNames &&
    /\b(Guild|Council|House|Court|Order|Army|Market|Village|City|Kingdom|Empire|Realm|Region|Mountain|Sea|River|Gate|Hall|Shrine|Road|Route|Island)\b/i.test(name)
  ) {
    return false;
  }
  return /^\p{Lu}[\p{L}'-]*(?:[ -]\p{Lu}[\p{L}'-]*){0,2}$/u.test(name);
}

function isLikelyChineseLoreRole(name: string): boolean {
  if (/^(世界探索者|探索者|向导|守护者|祭者|采药人)$/u.test(name)) return true;
  if (!/^[\p{Script=Han}]{2,8}$/u.test(name)) return false;
  if (lowConfidenceChineseNameStopwords.has(name)) return false;
  if (lowConfidenceChineseNameFragments.some((fragment) => name.includes(fragment))) {
    return false;
  }
  if (name.length >= 3 && /[回说问听看见会须]$/u.test(name)) return false;
  if (/[的了是在和与及或但而又也都只便就却把被将从到不]/u.test(name)) {
    return false;
  }
  return true;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}
