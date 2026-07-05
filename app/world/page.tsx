"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from "react";

import {
  ModelSelector,
  modelConfigFromSelection,
  type ModelSelection,
} from "../components/model-selector";
import { getWorldPackQualityWarnings, validateWorldPackQuality } from "../../src/domain/world-quality";
import { buildWorldChapterGoalSuggestions } from "../../src/domain/world-goals";
import type { WorldTemplateId } from "../../src/domain/world-types";

type OutputLanguage = "zh-CN" | "en";

type WorldPack = {
  schemaVersion: "world-pack-v1";
  worldPackId: string;
  version: number;
  visibility: "curated" | "private";
  sourceType: "narrative" | "lore";
  worldTemplate?: WorldTemplateId;
  title: string;
  language: "zh-CN" | "en";
  premise: string;
  timeAnchor: string;
  sourceAttribution: { label: string; rightsBasis: "public-domain" | "user-confirmed-private-use" };
  canonFacts: Array<{ id: string; statement: string; tags: string[] }>;
  rules: Array<{ id: string; description: string; severity: "hard" | "soft" }>;
  openingScenario: {
    id: string;
    title: string;
    locationId: string;
    activeCharacterIds: string[];
    event: string;
    suggestedGoals: string[];
  };
  characters: Array<{
    id: string;
    name: string;
    playable: boolean;
    identity: string;
    personality: string[];
    goals: string[];
    capabilities: string[];
    limitations: string[];
    knownFactIds: string[];
    unknownFactIds: string[];
    hiddenAgenda?: string;
  }>;
  locations: Array<{ id: string; name: string; description: string; connectedLocationIds: string[] }>;
  relationships?: RelationshipEdge[];
  eventSeeds?: WorldEventSeed[];
};

type CharacterCardDraft = WorldPack["characters"][number] & {
  goals: string[];
  knownFactIds: string[];
  unknownFactIds: string[];
};

type RelationshipEdge = {
  sourceCharacterId: string;
  targetCharacterId: string;
  kind: string;
  affinity: number;
  tension: number;
  publicContext: string;
};

type WorldEventSeed = {
  id: string;
  turnCreated: number;
  dueTurn?: number;
  source: "player" | "npc" | "world";
  visibility: "public" | "private" | "rumor";
  severity: number;
  status: "scheduled" | "active" | "resolved" | "expired";
  description: string;
  linkedCharacterIds: string[];
  linkedFactionIds: string[];
};

type WorldPackDraft = Omit<WorldPack, "worldPackId" | "version"> & {
  worldPackId?: string;
  version?: number;
  characters: CharacterCardDraft[];
  relationships: RelationshipEdge[];
  eventSeeds?: WorldEventSeed[];
};

type WorldPackIssue = {
  code: string;
  message: string;
  candidateId?: string;
};

const worldExampleSources: Array<{
  id: string;
  label: Record<OutputLanguage, string>;
  title: Record<OutputLanguage, string>;
  sourceType: "auto" | "narrative" | "lore";
  content: Record<OutputLanguage, string>;
}> = [
  {
    id: "mythic-qingjingze",
    label: { "zh-CN": "加载神话探索示例", en: "Load mythic exploration sample" },
    title: { "zh-CN": "青镜泽异兽记", en: "Chronicle of Qingjing Marsh" },
    sourceType: "auto",
    content: {
      "zh-CN": `《青镜泽异兽记》

昆吾山以北有一片青镜泽，泽水夜里会映出未发生的事。青镜泽外有三处入口：南边的石门、东边的雾桥、西边的废祭台。村中老人说，日落之后不可从雾桥入泽，否则会听见亲人的声音，引人走入深水。

玄禾是年轻的采药人，熟悉山路，擅长辨认草木和兽迹，但不懂祭仪。青砚是守泽人的后代，知道青镜泽的禁忌，却不愿告诉外人全部真相。犀婆是村里的祭者，她相信青镜泽里的九尾白狐不是妖物，而是守住旧约的神兽。

最近三夜，青镜泽边出现白色兽毛，村里的铜铃无风自响。有人说九尾白狐正在寻找违背禁忌的人，也有人说废祭台下面埋着能治瘟疫的青玉根。玄禾想进入青镜泽寻找青玉根救人，但青砚警告他：如果没有祭者许可，带走泽中之物会让整座山失去方向。

开场时，玄禾、青砚和犀婆站在废祭台前。天快黑了，雾桥已经升起白雾，石门后的兽迹还很新。三人必须决定从哪里进入青镜泽，是否先举行祭仪，以及要不要相信九尾白狐留下的征兆。`,
      en: `Chronicle of Qingjing Marsh

North of Kunwu Mountain lies Qingjing Marsh, whose waters reflect events that have not yet happened. There are three entrances: the stone gate in the south, the fog bridge in the east, and the ruined altar in the west. Elders say no one should enter from the fog bridge after sunset, or the marsh will call with the voices of loved ones and lead travelers into deep water.

Xuanhe is a young herb gatherer who knows mountain trails, plants, and animal tracks, but does not understand ritual law. Qingyan is descended from the marsh keepers and knows the taboos of Qingjing Marsh, though he refuses to tell outsiders the whole truth. Grandmother Xi is the village ritualist. She believes the nine-tailed white fox in the marsh is not a monster, but a sacred beast guarding an old pact.

For three nights, white fur has appeared near the marsh, and bronze bells have rung without wind. Some say the fox is looking for the person who broke a taboo. Others say a jade root buried beneath the ruined altar can cure the village sickness. Xuanhe wants to enter the marsh to find the root, but Qingyan warns him that taking anything without ritual permission may cause the whole mountain to lose its direction.

At the opening, Xuanhe, Qingyan, and Grandmother Xi stand before the ruined altar. Dusk is falling, the fog bridge is already white with mist, and fresh tracks mark the stone gate. They must decide where to enter, whether to perform a ritual first, and whether to trust the signs left by the fox.`,
    },
  },
  {
    id: "anime-faction",
    label: { "zh-CN": "加载阵营能力示例", en: "Load faction ability sample" },
    title: { "zh-CN": "雾隐小队试炼", en: "Mist Squad Trial" },
    sourceType: "narrative",
    content: {
      "zh-CN": `《雾隐小队试炼》

岚是雾隐小队的新队长，擅长短距离潜行和风刃术，但连续使用会让听觉暂时迟钝。澪是医疗忍者，能稳定队友情绪，也能识别毒雾，但她不擅长正面战斗。赤牙是曾经的宿敌，如今被迫与小队合作，他熟悉敌方据点，却总在关键情报上保留一半。

木叶议会要求雾隐小队在天亮前找出敌方信标，否则边境会误判为开战。敌方阵营已经放出传闻，说赤牙故意把小队引入旧矿洞。岚必须决定是信任赤牙的路线、让澪先查毒雾，还是公开用风刃术突破封锁。

开场时，小队站在旧矿洞入口。洞内有查克拉残留，远处传来信标震动声。赤牙催促立刻进入，澪提醒毒雾浓度不正常，岚知道如果拖延，敌方会转移信标。`,
      en: `Mist Squad Trial

Arashi is the new leader of the Mist Squad. He is skilled at short-range stealth and wind blade techniques, but repeated use temporarily dulls his hearing. Mio is a medical ninja who can calm teammates and identify poison mist, but she is weak in direct combat. Akakiba was once an enemy rival. He is now forced to cooperate with the squad. He knows the enemy outpost, but always withholds half of the key information.

The village council orders the Mist Squad to find the enemy beacon before dawn, or the border patrol will mistake the situation for the start of a war. The opposing faction has already spread a rumor that Akakiba is leading the squad into the old mine on purpose. Arashi must decide whether to trust Akakiba's route, let Mio test the poison mist first, or openly break the blockade with wind blade techniques.

At the opening, the squad stands at the entrance to the old mine. Chakra residue clings to the tunnel, and the beacon trembles somewhere in the distance. Akakiba urges them to enter at once. Mio warns that the poison mist is abnormal. Arashi knows that if they delay, the enemy will move the beacon.`,
    },
  },
  {
    id: "court-intrigue",
    label: { "zh-CN": "加载府内权力示例", en: "Load household intrigue sample" },
    title: { "zh-CN": "春宴账册风波", en: "The Spring Banquet Ledger" },
    sourceType: "narrative",
    content: {
      "zh-CN": `《春宴账册风波》

沈夫人掌管府中春宴，必须在三日内交出账册。大管事周衡负责采买，却被传私下收了绸缎铺的好处。贴身侍女阿棠知道账册里少了一页，但她担心说出真相会牵连自己的兄长。

府中长辈要求春宴体面不能受损，外头客人已经听到风声。沈夫人若公开追责，会伤周衡脸面并激怒采买一系；若私下压下，流言会转向她包庇下人。阿棠想保护兄长，也想保住沈夫人的信任。

开场时，沈夫人、周衡和阿棠在偏厅对账。门外已有丫鬟窃窃私语，正厅的宾客快要入席。沈夫人必须决定先稳住体面、查账册缺页，还是当众立规矩。`,
      en: `The Spring Banquet Ledger

Madam Shen is responsible for the household spring banquet and must submit the ledgers within three days. Chief Steward Zhou Heng handles purchases, but rumors say he has privately accepted favors from a silk shop. Atang, Madam Shen's personal maid, knows that one ledger page is missing, but fears that telling the truth will implicate her own brother.

The household elders insist that the banquet must not lose face, while guests outside have already heard rumors. If Madam Shen investigates in public, she will humiliate Zhou Heng and anger the purchasing faction. If she buries the matter privately, the rumor will turn against her as someone who shields servants. Atang wants to protect her brother while keeping Madam Shen's trust.

At the opening, Madam Shen, Zhou Heng, and Atang compare accounts in a side hall. Maids are already whispering outside the door, and guests are about to enter the main hall. Madam Shen must decide whether to preserve public face, investigate the missing ledger page, or set rules in front of everyone.`,
    },
  },
];

const panel: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #2d4165",
  borderRadius: 16,
  padding: 20,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 7,
  borderRadius: 10,
  border: "1px solid #385077",
  background: "#091426",
  color: "#edf6ff",
  padding: "11px 12px",
};

const button: CSSProperties = {
  border: 0,
  borderRadius: 10,
  background: "#5eead4",
  color: "#06202a",
  padding: "11px 15px",
  fontWeight: 800,
  cursor: "pointer",
};

const mutedWorldStyle: CSSProperties = {
  color: "#b8cae4",
  fontSize: 13,
  lineHeight: 1.5,
};

const guideBox: CSSProperties = {
  border: "1px solid rgba(94, 234, 212, 0.36)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(20, 184, 166, 0.08)",
};

const smallBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 900,
  background: "#1e3352",
  color: "#bfdbfe",
};

const worldCopy = {
  "zh-CN": {
    modeLabel: "世界模式 · Beta",
    heroEyebrow: "体验世界",
    headline: "进入一个角色，体验一段不同的人生章节。",
    intro: "可以先用《红楼梦》《山海经》或《奥德赛》示例立即体验，也可以从 50,000 字符以内的原创/公版小说或设定资料创建私人世界。每章五轮，未选道路会成为影子结局。",
    stepChoose: "1. 使用内置示例，或创建你的世界",
    curatedSample: "内置快速体验示例",
    curatedBadge: "可替换",
    curatedHint: "这些只是快速体验示例，不是固定世界。你可以直接体验它们，也可以在下方上传或粘贴任何原创/公版世界资料。",
    curatedRights: "内置示例基于公版材料整理，仅作为世界模板和质量样例。",
    sampleButtonHint: "点击即可用这个内置样例进入右侧角色设置。",
    activeSampleBadge: "右侧正在使用",
    selectedSampleHint: "右侧当前预览/开局使用这个内置示例。私人文本只有编译并确认后才会替换它。",
    createPrivate: "或用原创/公版短文本创建私人世界",
    privateCreateHint: "私人世界会先编译成可编辑草稿；确认后右侧会切换到你的世界包。",
    privateFlow: ["粘贴或上传世界资料", "编译成可编辑世界包草稿", "在右侧确认后选择角色"],
    pendingPrivateTitle: (title: string) => `已载入待编译文本：${title || "未命名文本"}`,
    pendingPrivateHint: (activeWorld: string) => `还没有切换世界。右侧仍在使用「${activeWorld}」；点击“编译世界包”，审核并确认草稿后，才会进入这份私人世界。`,
    modelSettingsTitle: "模型设置",
    modelSettingsHint: "用于编译私人世界包和生成每一轮候选分支；默认跟随服务器环境配置。",
    modelProvider: "模型提供方",
    modelName: "模型名称",
    modelHelp: "开发或模型对比时可切换提供方和模型；如果服务器以 mock/fallback 模式启动，或缺少密钥、路由失败、模型输出不合格，仍会使用确定性备用生成。",
    title: "标题",
    pasteLabel: "粘贴文本测试 / 私人短文本",
    pastePlaceholder: "粘贴原创故事、公版文本片段或世界设定。MVP 支持 50,000 字符以内；确认世界包后不会保存原始文本。",
    pasteHelp: (count: number) => `${count.toLocaleString()} / 50,000 字符。短文本会先编译成可编辑世界包，再进入五轮人生章节。`,
    sourceType: "资料类型",
    sourceAuto: "自动识别",
    sourceNarrative: "叙事小说",
    sourceLore: "世界设定/神话资料",
    rights: "我确认该文本为原创、公版材料，或我拥有上传并用于私人体验的权利。",
    compile: "编译世界包",
    stepConfirm: "2. 预览或确认世界",
    confirmSampleTitle: "当前正在预览内置示例",
    confirmSampleHint: "右侧现在显示你选中的内置样例，方便你不上传资料也能立刻测试。创建私人世界后，这里会改为草稿确认和角色设置。",
    confirmPendingTitle: "私人文本已准备，等待编译",
    confirmPendingHint: "右侧暂时仍显示当前内置样例。点击左侧“编译世界包”，再在这里确认草稿，即可进入你的私人世界。",
    confirmDraftTitle: "正在确认你的私人世界草稿",
    confirmDraftHint: "这不再是内置示例。请检查人物、关系、开场和目标；确认后右侧角色设置会使用你的世界包。",
    confirmPrivateTitle: "当前正在使用你的私人世界",
    confirmPrivateHint: "这个世界来自你确认过的世界包。现在可以选择已有角色，或创建一个符合该世界的新角色。",
    worldBadgeCurated: "内置示例",
    worldBadgePrivate: "私人世界",
    draftTitle: "私人世界包草稿",
    draftIntro: "先修正人物、关系、开场和目标。MVP 暂不保存原始上传文本，只保存确认后的结构化世界包。",
    worldTemplate: "世界模板",
    characterQuality: "角色质量",
    noSuspiciousCharacters: "未发现明显截断角色名",
    suspiciousCharacters: (count: number) => `${count} 个可疑角色需确认`,
    relationshipQuality: "关系质量",
    genericRelationships: "多数关系仍像模板或备用规则推断",
    availableRelationships: (count: number) => `${count} 条关系可用`,
    templateAdvice: "模板编辑建议",
    worldTitle: "世界标题",
    premise: "世界前提",
    timeAnchor: "时间锚点",
    characterReview: "角色确认",
    relationshipReview: "关系确认",
    openingGoals: "开场与章节目标",
    eventSeeds: "事件种子",
    warningsTitle: "提示 / 质量提醒",
    fallbackWarningTitle: "低置信备用草稿",
    fallbackWarningBody: "模型编译没有完整完成，xMocha 已用确定性规则生成可编辑草稿。请重点检查角色是否正确、关系是否具体、开场事件是否符合文本，再确认进入。",
    issuesTitle: "需要修正后才能确认",
    confirmPrivate: "确认私人世界包",
    fixBeforeConfirm: "请先改名、删除可疑角色，或调整开场 NPC 后再确认。关系提醒不会阻止确认，但会影响游戏感。",
    chooseExisting: "选择已有角色",
    createCharacter: "创建新角色",
    character: "角色",
    goalRecomputed: (name: string) => `目标建议会按「${name}」的身份重新生成；你仍然可以手动改写目标。`,
    customCharacterHelp: "新角色需要填写姓名、身份、一项优势和一项限制；章节目标在下方单独填写。",
    name: "姓名",
    identity: "身份（须符合当前世界）",
    strength: "一项优势",
    weakness: "一项限制",
    chapterGoal: "这一章的目标",
    startChapter: "开始五轮人生章节",
    processing: "处理中…",
    noWorld: "请选择或创建一个世界。",
    selectedTimeAnchor: "时间锚点：",
    loadingWorldsFailed: "暂时无法加载精选世界。",
    tooLong: "文本超过 50,000 字符，请删减后再编译。",
    fileTooLarge: "请选择 50,000 字符以内的 UTF-8 TXT 或 Markdown。",
    fileRead: (count: number) => `已读取 ${count.toLocaleString()} 字符。`,
    fileReadWithReplacement: (count: number, replacementCount: number) => `已读取 ${count.toLocaleString()} 字符，检测到 ${replacementCount} 个缺字符号 �。编译时会尝试替换为 □。`,
    exampleLoaded: (title: string) => `已加载原创测试文本「${title}」。可以直接编译，或先编辑文本。`,
    compiling: "正在从文本生成可确认的世界包…",
    compileFailed: "编译失败。",
    compiledWithIssues: (template: string, sourceType: string, count: number) => `已生成 ${template} / ${sourceType} 世界包，但发现 ${count} 个质量问题。请修正后再确认。`,
    compiledOk: (template: string, sourceType: string, fallbackUsed: boolean, hasWarnings: boolean) => `已生成 ${template} / ${sourceType} 世界包${fallbackUsed ? "（备用草稿，需要重点检查）" : ""}${hasWarnings ? "，请查看提示。" : ""}。请确认后保存。`,
    draftEdited: "已编辑世界包草稿。保存时会再次运行服务器验证。",
    saveFailed: "保存世界包失败。",
    privateConfirmed: "私人世界包已确认。现在可以选择角色和目标。",
    confirmFailed: "确认失败。",
    chooseWorldFirst: "请先选择一个世界。",
    fillGoal: "请填写这一章的目标。",
    chooseCharacterFirst: "请选择一个已有角色。",
    missingCustomFields: (fields: string[]) => `请补全新角色字段：${fields.join("、")}。`,
    starting: "正在拆解目标并生成第一轮场景…",
    startFailed: "启动失败。",
  },
  en: {
    modeLabel: "World Mode · Beta",
    heroEyebrow: "PLAY A WORLD",
    headline: "Enter a role and play a short life chapter.",
    intro: "Try a Red Chamber, Shanhai Jing, or Odyssey sample immediately, or create a private world from up to 50,000 characters of original/public-domain story or lore text. Each chapter has five turns, and unchosen paths become shadow endings.",
    stepChoose: "1. Use a sample, or create your world",
    curatedSample: "Quick-start samples",
    curatedBadge: "Replaceable",
    curatedHint: "These are quick-start samples, not fixed worlds. You can try them immediately, or upload/paste any original or public-domain world text below.",
    curatedRights: "Built-in samples are based on public-domain material and included as template/quality examples.",
    sampleButtonHint: "Click to use this built-in sample in the role setup panel.",
    activeSampleBadge: "Active in preview",
    selectedSampleHint: "Step 2 is currently previewing this built-in sample. Private text replaces it only after compile and confirmation.",
    createPrivate: "Or create a private world from original/public-domain text",
    privateCreateHint: "Private worlds compile into an editable draft first; after confirmation, the right panel switches to your WorldPack.",
    privateFlow: ["Paste or upload world text", "Compile an editable WorldPack draft", "Confirm it on the right, then choose a role"],
    pendingPrivateTitle: (title: string) => `Pending private text: ${title || "Untitled text"}`,
    pendingPrivateHint: (activeWorld: string) => `Not active yet. Step 2 still uses “${activeWorld}”; compile the WorldPack, review it, then confirm the draft to switch into this private world.`,
    modelSettingsTitle: "Model settings",
    modelSettingsHint: "Used for private WorldPack compilation and every generated turn; server default follows environment config.",
    modelProvider: "LLM provider",
    modelName: "Model name",
    modelHelp: "Override provider/model for local development or model comparison. If credentials or local runtime are unavailable, xMocha falls back to deterministic generation.",
    title: "Title",
    pasteLabel: "Paste text / private short text",
    pastePlaceholder: "Paste original lore, public-domain source text, or your own world setting. MVP supports up to 50,000 characters; raw text is not saved after WorldPack confirmation.",
    pasteHelp: (count: number) => `${count.toLocaleString()} / 50,000 characters. Short text is compiled into an editable WorldPack before the five-turn chapter starts.`,
    sourceType: "Source type",
    sourceAuto: "Auto-detect",
    sourceNarrative: "Narrative fiction",
    sourceLore: "Lore / mythology notes",
    rights: "I confirm this text is original, public-domain, or I have the right to upload it for private play.",
    compile: "Compile WorldPack",
    stepConfirm: "2. Preview or confirm the world",
    confirmSampleTitle: "Currently previewing the built-in sample",
    confirmSampleHint: "The right panel shows the built-in sample you selected so you can test without uploading anything. Once you create a private world, this area becomes draft confirmation and role setup for your WorldPack.",
    confirmPendingTitle: "Private text is ready, waiting to compile",
    confirmPendingHint: "This panel still previews the current built-in sample for now. Click “Compile WorldPack” on the left, then confirm the draft here to enter your private world.",
    confirmDraftTitle: "Confirming your private world draft",
    confirmDraftHint: "This is no longer Red Chamber. Review characters, relationships, opening scene, and goals; after confirmation, role setup uses your WorldPack.",
    confirmPrivateTitle: "Currently using your private world",
    confirmPrivateHint: "This world comes from your confirmed WorldPack. Choose an existing role, or create a new role that belongs in this world.",
    worldBadgeCurated: "Built-in sample",
    worldBadgePrivate: "Private world",
    draftTitle: "Private WorldPack draft",
    draftIntro: "Review characters, relationships, opening scene, and goals first. MVP does not save the raw uploaded text; it only saves the confirmed structured WorldPack.",
    worldTemplate: "World template",
    characterQuality: "Character quality",
    noSuspiciousCharacters: "No obvious truncated character names",
    suspiciousCharacters: (count: number) => `${count} suspicious character${count === 1 ? "" : "s"} need review`,
    relationshipQuality: "Relationship quality",
    genericRelationships: "Most relationships still look like template/fallback guesses",
    availableRelationships: (count: number) => `${count} relationship${count === 1 ? "" : "s"} available`,
    templateAdvice: "Template editing advice",
    worldTitle: "World title",
    premise: "Premise",
    timeAnchor: "Time anchor",
    characterReview: "Character review",
    relationshipReview: "Relationship review",
    openingGoals: "Opening and chapter goals",
    eventSeeds: "Event seeds",
    warningsTitle: "Hints / quality warnings",
    fallbackWarningTitle: "Low-confidence fallback draft",
    fallbackWarningBody: "Model compilation did not fully complete, so xMocha generated an editable draft with deterministic rules. Review character names, concrete relationships, and opening events before confirming.",
    issuesTitle: "Fix before confirming",
    confirmPrivate: "Confirm private WorldPack",
    fixBeforeConfirm: "Rename or remove suspicious characters, or adjust opening NPCs before confirming. Relationship warnings will not block confirmation, but they affect the play experience.",
    chooseExisting: "Choose existing role",
    createCharacter: "Create new role",
    character: "Role",
    goalRecomputed: (name: string) => `Goal suggestions are regenerated for “${name}”; you can still edit the goal manually.`,
    customCharacterHelp: "A new role needs a name, identity, one strength, and one limitation. The chapter goal is filled below.",
    name: "Name",
    identity: "Identity within this world",
    strength: "One strength",
    weakness: "One limitation",
    chapterGoal: "Chapter goal",
    startChapter: "Start five-turn chapter",
    processing: "Processing…",
    noWorld: "Choose or create a world.",
    selectedTimeAnchor: "Time anchor: ",
    loadingWorldsFailed: "Could not load curated worlds.",
    tooLong: "Text is over 50,000 characters. Please shorten it before compiling.",
    fileTooLarge: "Please choose a UTF-8 TXT or Markdown file under 50,000 characters.",
    fileRead: (count: number) => `Read ${count.toLocaleString()} characters.`,
    fileReadWithReplacement: (count: number, replacementCount: number) => `Read ${count.toLocaleString()} characters and found ${replacementCount} replacement character(s) �. Compilation will try to replace them with □.`,
    exampleLoaded: (title: string) => `Loaded original sample “${title}”. You can compile it now or edit the text first.`,
    compiling: "Generating a confirmable WorldPack from the text…",
    compileFailed: "Compilation failed.",
    compiledWithIssues: (template: string, sourceType: string, count: number) => `Generated a ${template} / ${sourceType} WorldPack, but found ${count} quality issue${count === 1 ? "" : "s"}. Please fix before confirming.`,
    compiledOk: (template: string, sourceType: string, fallbackUsed: boolean, hasWarnings: boolean) => `Generated a ${template} / ${sourceType} WorldPack${fallbackUsed ? " (fallback draft; review carefully)" : ""}${hasWarnings ? ". Please review the hints." : "."}`,
    draftEdited: "Edited the WorldPack draft. Server validation will run again when saving.",
    saveFailed: "Failed to save WorldPack.",
    privateConfirmed: "Private WorldPack confirmed. You can now choose a role and goal.",
    confirmFailed: "Confirmation failed.",
    chooseWorldFirst: "Choose a world first.",
    fillGoal: "Fill in this chapter's goal.",
    chooseCharacterFirst: "Choose an existing role.",
    missingCustomFields: (fields: string[]) => `Please fill in: ${fields.join(", ")}.`,
    starting: "Planning the goal and generating the first scene…",
    startFailed: "Failed to start.",
  },
} as const;

export default function WorldModePage() {
  const router = useRouter();
  const [language, setLanguage] = useState<OutputLanguage>("en");
  const copy = worldCopy[language];
  const [worlds, setWorlds] = useState<WorldPack[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<WorldPack | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | undefined>();
  const [characterMode, setCharacterMode] = useState<"existing" | "custom">("existing");
  const [playerCharacterId, setPlayerCharacterId] = useState("");
  const [customCharacter, setCustomCharacter] = useState({
    name: "",
    identity: "",
    strength: "",
    weakness: "",
  });
  const [goal, setGoal] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceType, setSourceType] = useState<"auto" | "narrative" | "lore">("auto");
  const [sourceContent, setSourceContent] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [draft, setDraft] = useState<WorldPackDraft | null>(null);
  const [draftIssues, setDraftIssues] = useState<WorldPackIssue[]>([]);
  const [draftWarnings, setDraftWarnings] = useState<WorldPackIssue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modelSelection, setModelSelection] = useState<ModelSelection>({
    provider: "default",
    model: "",
  });

  useEffect(() => {
    void fetch("/api/world", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { worlds?: WorldPack[] }) => {
        const available = data.worlds ?? [];
        setWorlds(available);
        if (available[0]) selectWorld(available[0]);
      })
      .catch(() => setError(copy.loadingWorldsFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playableCharacters = useMemo(
    () => selectedWorld?.characters.filter((character) => character.playable) ?? [],
    [selectedWorld],
  );
  const selectedPlayerCharacter = useMemo(
    () => playableCharacters.find((character) => character.id === playerCharacterId),
    [playableCharacters, playerCharacterId],
  );
  const chapterGoalSuggestions = useMemo(
    () =>
      selectedWorld
        ? buildWorldChapterGoalSuggestions({
            world: selectedWorld,
            characterId: characterMode === "existing" ? playerCharacterId : undefined,
            customCharacterName: characterMode === "custom" ? customCharacter.name : undefined,
            actorNameOverride:
              characterMode === "existing" && selectedPlayerCharacter
                ? displayCharacterName(selectedWorld, selectedPlayerCharacter, language)
                : undefined,
            language,
          })
        : [],
    [characterMode, customCharacter.name, language, playerCharacterId, selectedPlayerCharacter, selectedWorld],
  );
  const liveDraftIssues = useMemo(
    () => draft ? validateWorldPackQuality(draft) : [],
    [draft],
  );
  const liveDraftWarnings = useMemo(
    () => draft ? getWorldPackQualityWarnings(draft) : [],
    [draft],
  );
  const combinedDraftIssues = useMemo(
    () => uniqueWorldIssues([...draftIssues, ...liveDraftIssues]),
    [draftIssues, liveDraftIssues],
  );
  const combinedDraftWarnings = useMemo(
    () => uniqueWorldIssues([...draftWarnings, ...liveDraftWarnings]),
    [draftWarnings, liveDraftWarnings],
  );
  const fallbackDraftWarning = useMemo(
    () => combinedDraftWarnings.find((warning) =>
      warning.code === "FALLBACK_DRAFT_NEEDS_REVIEW" ||
      warning.code === "COMPILER_MODEL_FALLBACK" ||
      warning.code === "COMPILER_DETERMINISTIC_FALLBACK",
    ),
    [combinedDraftWarnings],
  );
  const suspiciousCharacterIds = useMemo(
    () => new Set(
      combinedDraftIssues
        .filter((issue) =>
          issue.code === "LOW_CONFIDENCE_CHARACTER_NAME" ||
          issue.code === "LOW_CONFIDENCE_OPENING_CHARACTER",
        )
        .flatMap((issue) => extractCharacterIdsFromIssue(issue)),
    ),
    [combinedDraftIssues],
  );
  const draftQualitySummary = useMemo(
    () => draft ? summarizeDraftQuality(draft, suspiciousCharacterIds, combinedDraftWarnings) : null,
    [combinedDraftWarnings, draft, suspiciousCharacterIds],
  );
  const hasPrivateWorldInput = sourceContent.trim().length > 0;
  const activeWorldTitle = selectedWorld ? displayWorldTitle(selectedWorld, language) : "";
  const showPendingPrivateNotice = hasPrivateWorldInput && !draft && Boolean(selectedWorld);
  const confirmStatus = draft
    ? { title: copy.confirmDraftTitle, hint: copy.confirmDraftHint, tone: "#5eead4", background: "rgba(20, 184, 166, 0.08)" }
    : selectedWorld?.visibility === "private"
      ? { title: copy.confirmPrivateTitle, hint: copy.confirmPrivateHint, tone: "#5eead4", background: "rgba(20, 184, 166, 0.08)" }
      : hasPrivateWorldInput
        ? { title: copy.confirmPendingTitle, hint: copy.confirmPendingHint, tone: "#fbbf24", background: "rgba(245, 158, 11, 0.08)" }
        : { title: copy.confirmSampleTitle, hint: copy.confirmSampleHint, tone: "#93c5fd", background: "rgba(59, 130, 246, 0.08)" };

  function selectedModelConfig() {
    return modelConfigFromSelection(modelSelection);
  }

  function selectWorld(world: WorldPack, token?: string) {
    setSelectedWorld(world);
    setOwnerToken(token);
    const first = world.characters.find((character) => character.playable);
    setCharacterMode("existing");
    setPlayerCharacterId(first?.id ?? "");
    setGoal(
      buildWorldChapterGoalSuggestions({
        world,
        characterId: first?.id,
        actorNameOverride: first ? displayCharacterName(world, first, language) : undefined,
        language,
      })[0] ?? "",
    );
    setError(null);
  }

  function selectExistingCharacter(characterId: string) {
    setPlayerCharacterId(characterId);
    if (!selectedWorld) return;
    setGoal(
      buildWorldChapterGoalSuggestions({
        world: selectedWorld,
        characterId,
        actorNameOverride: displayCharacterName(
          selectedWorld,
          selectedWorld.characters.find((character) => character.id === characterId),
          language,
        ),
        language,
      })[0] ?? "",
    );
  }

  function selectCharacterMode(mode: "existing" | "custom") {
    setCharacterMode(mode);
    if (!selectedWorld) return;
    setGoal(
      buildWorldChapterGoalSuggestions({
        world: selectedWorld,
        characterId: mode === "existing" ? playerCharacterId : undefined,
        customCharacterName: mode === "custom" ? customCharacter.name : undefined,
        actorNameOverride:
          mode === "existing"
            ? displayCharacterName(
                selectedWorld,
                selectedWorld.characters.find((character) => character.id === playerCharacterId),
                language,
              )
            : undefined,
        language,
      })[0] ?? "",
    );
  }

  function changeLanguage(nextLanguage: OutputLanguage) {
    setLanguage(nextLanguage);
    if (!selectedWorld) return;
    const selectedCharacter = selectedWorld.characters.find((character) => character.id === playerCharacterId);
    setGoal(
      buildWorldChapterGoalSuggestions({
        world: selectedWorld,
        characterId: characterMode === "existing" ? playerCharacterId : undefined,
        customCharacterName: characterMode === "custom" ? customCharacter.name : undefined,
        actorNameOverride:
          characterMode === "existing"
            ? displayCharacterName(selectedWorld, selectedCharacter, nextLanguage)
            : undefined,
        language: nextLanguage,
      })[0] ?? "",
    );
  }

  function updateSourceContent(value: string) {
    setSourceContent(value);
    setDraft(null);
    setDraftIssues([]);
    setDraftWarnings([]);
    setError(null);
    if (value.length > 50_000) {
      setError(copy.tooLong);
    }
  }

  function loadWorldExample(exampleId: string) {
    const example = worldExampleSources.find((source) => source.id === exampleId);
    if (!example) return;
    setSourceTitle(example.title[language]);
    setSourceType(example.sourceType);
    setRightsConfirmed(true);
    updateSourceContent(example.content[language]);
    setMessage(copy.exampleLoaded(example.title[language]));
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    if (text.length > 50_000) {
      setError(copy.fileTooLarge);
      return;
    }
    setSourceTitle(file.name.replace(/\.(txt|md|markdown)$/i, ""));
    updateSourceContent(text);
    const replacementCount = [...text].filter((character) => character === "�").length;
    setMessage(
      replacementCount > 0
        ? copy.fileReadWithReplacement(text.length, replacementCount)
        : copy.fileRead(text.length),
    );
  }

  function updateDraft(mutator: (current: WorldPackDraft) => WorldPackDraft) {
    setDraft((current) => {
      if (!current) return current;
      return normalizeEditableDraft(mutator(structuredClone(current)), language);
    });
    if (draftIssues.length > 0) {
      setDraftIssues([]);
      setMessage(copy.draftEdited);
    }
  }

  function updateDraftText<K extends "title" | "premise" | "timeAnchor">(
    key: K,
    value: WorldPackDraft[K],
  ) {
    updateDraft((current) => ({ ...current, [key]: value }));
  }

  function updateOpeningScenario(
    patch: Partial<WorldPackDraft["openingScenario"]>,
  ) {
    updateDraft((current) => ({
      ...current,
      openingScenario: {
        ...current.openingScenario,
        ...patch,
      },
    }));
  }

  function addDraftCharacter() {
    updateDraft((current) => {
      const id = nextSequentialId("character", current.characters.map((character) => character.id));
      const firstFactId = current.canonFacts[0]?.id;
      const character: CharacterCardDraft = {
        id,
        name: language === "en" ? "New character" : "新角色",
        playable: true,
        identity: language === "en" ? "Identity to confirm" : "身份待确认",
        personality: [language === "en" ? "Personality to confirm" : "性格待确认"],
        goals: [language === "en" ? "Goal to confirm" : "目标待确认"],
        capabilities: [language === "en" ? "Observation and conversation" : "观察与交流"],
        limitations: [
          language === "en"
            ? "Cannot use abilities not defined by the source"
            : "不能使用资料未定义的能力",
        ],
        knownFactIds: firstFactId ? [firstFactId] : [],
        unknownFactIds: current.canonFacts
          .map((fact) => fact.id)
          .filter((factId) => factId !== firstFactId),
      };
      return {
        ...current,
        characters: [...current.characters, character].slice(0, 15),
        openingScenario: {
          ...current.openingScenario,
          activeCharacterIds: current.openingScenario.activeCharacterIds.length < 3
            ? [...current.openingScenario.activeCharacterIds, id]
            : current.openingScenario.activeCharacterIds,
        },
      };
    });
  }

  function updateDraftCharacter(
    characterId: string,
    patch: Partial<CharacterCardDraft>,
  ) {
    updateDraft((current) => ({
      ...current,
      characters: current.characters.map((character) => {
        if (character.id !== characterId) return character;
        const next = { ...character, ...patch };
        return {
          ...next,
          goals: next.goals ?? [],
          knownFactIds: next.knownFactIds ?? [],
          unknownFactIds: next.unknownFactIds ?? [],
        };
      }),
    }));
  }

  function removeDraftCharacter(characterId: string) {
    updateDraft((current) => {
      if (current.characters.length <= 1) return current;
      return {
        ...current,
        characters: current.characters.filter((character) => character.id !== characterId),
        relationships: current.relationships.filter((relationship) =>
          relationship.sourceCharacterId !== characterId &&
          relationship.targetCharacterId !== characterId,
        ),
        openingScenario: {
          ...current.openingScenario,
          activeCharacterIds: current.openingScenario.activeCharacterIds?.filter((id) => id !== characterId) ?? [],
        },
      };
    });
  }

  function markDraftCharacterNonPlayable(characterId: string) {
    updateDraft((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.id === characterId ? { ...character, playable: false } : character,
      ),
      openingScenario: {
        ...current.openingScenario,
        activeCharacterIds: current.openingScenario.activeCharacterIds?.filter((id) => id !== characterId) ?? [],
      },
    }));
  }

  function addDraftRelationship() {
    updateDraft((current) => {
      const [source, target] = current.characters;
      if (!source || !target) return current;
      return {
        ...current,
        relationships: [
          ...current.relationships,
          {
            sourceCharacterId: source.id,
            targetCharacterId: target.id,
            kind: language === "en" ? "Relationship to confirm" : "关系待确认",
            affinity: 0,
            tension: 1,
            publicContext: language === "en"
              ? "A relationship added during user review."
              : "用户确认时补充的人物关系。",
          },
        ],
      };
    });
  }

  function updateDraftRelationship(index: number, patch: Partial<RelationshipEdge>) {
    updateDraft((current) => ({
      ...current,
      relationships: current.relationships.map((relationship, relationshipIndex) =>
        relationshipIndex === index ? { ...relationship, ...patch } : relationship,
      ),
    }));
  }

  function removeDraftRelationship(index: number) {
    updateDraft((current) => ({
      ...current,
      relationships: current.relationships.filter((_, relationshipIndex) => relationshipIndex !== index),
    }));
  }

  function toggleOpeningCharacter(characterId: string, checked: boolean) {
    const currentIds = draft?.openingScenario.activeCharacterIds ?? [];
    const nextIds = checked
      ? [...currentIds, characterId]
      : currentIds.filter((id) => id !== characterId);
    updateOpeningScenario({ activeCharacterIds: [...new Set(nextIds)].slice(0, 3) });
  }

  function addDraftCanonFact() {
    updateDraft((current) => ({
      ...current,
      canonFacts: [
        ...current.canonFacts,
        {
          id: nextSequentialId("fact-manual", current.canonFacts.map((fact) => fact.id)),
          statement: language === "en" ? "Fact to confirm." : "事实待确认。",
          tags: ["manual"],
        },
      ],
    }));
  }

  function updateDraftCanonFact(
    index: number,
    patch: Partial<WorldPackDraft["canonFacts"][number]>,
  ) {
    updateDraft((current) => ({
      ...current,
      canonFacts: current.canonFacts.map((fact, factIndex) =>
        factIndex === index ? { ...fact, ...patch } : fact,
      ),
    }));
  }

  function removeDraftCanonFact(index: number) {
    updateDraft((current) => {
      if (current.canonFacts.length <= 1) return current;
      const removedId = current.canonFacts[index]?.id;
      return {
        ...current,
        canonFacts: current.canonFacts.filter((_, factIndex) => factIndex !== index),
        characters: current.characters.map((character) => ({
          ...character,
          knownFactIds: character.knownFactIds.filter((factId) => factId !== removedId),
          unknownFactIds: character.unknownFactIds.filter((factId) => factId !== removedId),
        })),
      };
    });
  }

  function addDraftRule() {
    updateDraft((current) => ({
      ...current,
      rules: [
        ...current.rules,
        {
          id: nextSequentialId("rule-manual", current.rules.map((rule) => rule.id)),
          description: language === "en" ? "World rule to confirm." : "世界规则待确认。",
          severity: "soft",
        },
      ],
    }));
  }

  function updateDraftRule(
    index: number,
    patch: Partial<WorldPackDraft["rules"][number]>,
  ) {
    updateDraft((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    }));
  }

  function removeDraftRule(index: number) {
    updateDraft((current) => {
      if (current.rules.length <= 1) return current;
      return {
        ...current,
        rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
      };
    });
  }

  function addDraftEventSeed() {
    updateDraft((current) => ({
      ...current,
      eventSeeds: [
        ...(current.eventSeeds ?? []),
        {
          id: nextSequentialId(
            "event-manual",
            (current.eventSeeds ?? []).map((eventSeed) => eventSeed.id),
          ),
          turnCreated: 0,
          dueTurn: 1,
          source: "world",
          visibility: "public",
          severity: 0.5,
          status: "scheduled",
          description: language === "en"
            ? "A world event to confirm will add pressure in the next turn."
            : "一个待确认的世界事件将在下一轮形成压力。",
          linkedCharacterIds: current.openingScenario.activeCharacterIds.slice(0, 3),
          linkedFactionIds: [],
        },
      ],
    }));
  }

  function updateDraftEventSeed(index: number, patch: Partial<WorldEventSeed>) {
    updateDraft((current) => ({
      ...current,
      eventSeeds: (current.eventSeeds ?? []).map((eventSeed, eventIndex) =>
        eventIndex === index ? { ...eventSeed, ...patch } : eventSeed,
      ),
    }));
  }

  function removeDraftEventSeed(index: number) {
    updateDraft((current) => ({
      ...current,
      eventSeeds: (current.eventSeeds ?? []).filter((_, eventIndex) => eventIndex !== index),
    }));
  }

  function toggleEventCharacter(eventIndex: number, characterId: string, checked: boolean) {
    const currentIds = draft?.eventSeeds?.[eventIndex]?.linkedCharacterIds ?? [];
    const nextIds = checked
      ? [...currentIds, characterId]
      : currentIds.filter((id) => id !== characterId);
    updateDraftEventSeed(eventIndex, { linkedCharacterIds: [...new Set(nextIds)].slice(0, 3) });
  }

  async function compileWorld() {
    setBusy(true);
    setError(null);
    setMessage(copy.compiling);
    try {
      const response = await fetch("/api/world/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sourceTitle,
          language,
          sourceType,
          content: sourceContent,
          rightsConfirmed,
          modelConfig: selectedModelConfig(),
        }),
      });
      const data = (await response.json()) as {
        draft?: WorldPackDraft;
        sourceType?: string;
        fallbackUsed?: boolean;
        validationIssues?: WorldPackIssue[];
        preprocessWarnings?: WorldPackIssue[];
        error?: string;
      };
      if (!response.ok || !data.draft) throw new Error(data.error ?? copy.compileFailed);
      setDraft(data.draft);
      setDraftIssues(data.validationIssues ?? []);
      setDraftWarnings(data.preprocessWarnings ?? []);
      setMessage(
        (data.validationIssues?.length ?? 0) > 0
          ? copy.compiledWithIssues(
              templateLabel(data.draft.worldTemplate, language),
              data.sourceType ?? sourceType,
              data.validationIssues!.length,
            )
          : copy.compiledOk(
              templateLabel(data.draft.worldTemplate, language),
              data.sourceType ?? sourceType,
              Boolean(data.fallbackUsed),
              (data.preprocessWarnings?.length ?? 0) > 0,
            ),
      );
    } catch (compileError) {
      setError(compileError instanceof Error ? compileError.message : copy.compileFailed);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/world/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = (await response.json()) as {
        pack?: WorldPack;
        ownerToken?: string;
        error?: string;
      };
      if (!response.ok || !data.pack || !data.ownerToken) {
        throw new Error(data.error ?? copy.saveFailed);
      }
      selectWorld(data.pack, data.ownerToken);
      setDraftIssues([]);
      setDraftWarnings([]);
      setMessage(copy.privateConfirmed);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : copy.confirmFailed);
    } finally {
      setBusy(false);
    }
  }

  async function startChapter() {
    if (!selectedWorld) {
      setError(copy.chooseWorldFirst);
      return;
    }
    if (!goal.trim()) {
      setError(copy.fillGoal);
      return;
    }
    if (characterMode === "existing" && !playerCharacterId) {
      setError(copy.chooseCharacterFirst);
      return;
    }
    if (characterMode === "custom") {
      const missingFields = [
        customCharacter.name.trim() ? null : copy.name,
        customCharacter.identity.trim() ? null : copy.identity,
        customCharacter.strength.trim() ? null : copy.strength,
        customCharacter.weakness.trim() ? null : copy.weakness,
      ].filter(Boolean);

      if (missingFields.length > 0) {
        setError(copy.missingCustomFields(missingFields as string[]));
        return;
      }
    }
    setBusy(true);
    setError(null);
    setMessage(copy.starting);
    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "world",
          worldPackId: selectedWorld.worldPackId,
          worldPackVersion: selectedWorld.version,
          ownerToken,
          player:
            characterMode === "custom"
              ? {
                  customCharacter: {
                    ...customCharacter,
                    goal: goal.trim(),
                  },
                }
              : { characterId: playerCharacterId },
          primaryGoal: goal.trim(),
          language,
          modelConfig: selectedModelConfig(),
        }),
      });
      const data = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) throw new Error(data.error ?? copy.startFailed);
      if (ownerToken) {
        window.sessionStorage.setItem(
          `xmocha-world-token:${data.sessionId}`,
          ownerToken,
        );
      }
      router.push(`/session/${data.sessionId}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : copy.startFailed);
      setMessage(null);
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #16304d 0, #07111f 52%, #050b14 100%)",
        color: "#edf6ff",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 72px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <Link href="/" style={{ color: "#dbeafe", textDecoration: "none", fontWeight: 800 }}>
            xMocha
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#5eead4" }}>{copy.modeLabel}</span>
            <div style={{ display: "flex", gap: 4, border: "1px solid #294167", borderRadius: 999, padding: 4 }}>
              {([
                { value: "zh-CN" as const, label: "中文" },
                { value: "en" as const, label: "EN" },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeLanguage(option.value)}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontWeight: 800,
                    cursor: "pointer",
                    background: language === option.value ? "#5eead4" : "transparent",
                    color: language === option.value ? "#06202a" : "#dbeafe",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section style={{ margin: "48px 0 24px", maxWidth: 820 }}>
          <p style={{ color: "#5eead4", fontWeight: 900 }}>{copy.heroEyebrow}</p>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", lineHeight: 1, margin: "8px 0 16px" }}>
            {copy.headline}
          </h1>
          <p style={{ color: "#b8cae4", lineHeight: 1.7 }}>
            {copy.intro}
          </p>
        </section>

        {error ? <p style={{ color: "#fda4af" }}>{error}</p> : null}
        {message ? <p style={{ color: "#99f6e4" }}>{message}</p> : null}

        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))" }}>
          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>{copy.stepChoose}</h2>
            <div style={guideBox}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <strong>{copy.curatedSample}</strong>
                <span style={{ ...smallBadge, background: "rgba(147, 197, 253, 0.16)" }}>
                  {copy.curatedBadge}
                </span>
              </div>
              <p style={{ ...mutedWorldStyle, margin: "0 0 8px" }}>
                {copy.curatedHint}
              </p>
              <p style={{ ...mutedWorldStyle, margin: 0 }}>
                {copy.curatedRights}
              </p>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {worlds.map((world) => {
                const isActiveSample = selectedWorld?.worldPackId === world.worldPackId;
                return (
                  <button
                    key={world.worldPackId}
                    type="button"
                    onClick={() => selectWorld(world)}
                    style={{
                      ...button,
                      textAlign: "left",
                      background: isActiveSample ? "#5eead4" : "#1e3352",
                      color: isActiveSample ? "#06202a" : "#dbeafe",
                    }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <span>{displayWorldTitle(world, language)}</span>
                      {isActiveSample ? (
                        <span
                          style={{
                            ...smallBadge,
                            flex: "0 0 auto",
                            background: "rgba(6, 32, 42, 0.14)",
                            color: "#06202a",
                          }}
                        >
                          {copy.activeSampleBadge}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontSize: 12, fontWeight: 600, opacity: 0.82 }}>
                      {isActiveSample ? copy.selectedSampleHint : copy.sampleButtonHint}
                    </span>
                  </button>
                );
              })}
            </div>
            <hr style={{ borderColor: "#2d4165", margin: "20px 0" }} />
            <h3>{copy.createPrivate}</h3>
            <p style={{ ...mutedWorldStyle, marginTop: -6 }}>
              {copy.privateCreateHint}
            </p>
            <ol style={{ color: "#b8cae4", lineHeight: 1.6, margin: "0 0 14px", paddingLeft: 20 }}>
              {copy.privateFlow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {showPendingPrivateNotice ? (
              <div
                style={{
                  border: "1px solid #fbbf24",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  background: "rgba(245, 158, 11, 0.08)",
                }}
              >
                <strong style={{ color: "#facc15" }}>{copy.pendingPrivateTitle(sourceTitle.trim())}</strong>
                <p style={{ ...mutedWorldStyle, margin: "6px 0 0" }}>
                  {copy.pendingPrivateHint(activeWorldTitle)}
                </p>
              </div>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {worldExampleSources.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  style={{ ...button, background: "#1e3352", color: "#dbeafe", padding: "8px 10px", fontSize: 12 }}
                  onClick={() => loadWorldExample(example.id)}
                >
                  {example.label[language]}
                </button>
              ))}
            </div>
            <label
              htmlFor="world-source-file"
              style={{
                ...button,
                display: "inline-flex",
                marginTop: 2,
                background: "#1e3352",
                color: "#dbeafe",
                padding: "8px 10px",
                fontSize: 12,
              }}
            >
              {language === "en" ? "Upload text file" : "上传文本文件"}
            </label>
            <input
              id="world-source-file"
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              onChange={handleFile}
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
                clipPath: "inset(50%)",
                whiteSpace: "nowrap",
              }}
            />
            <label style={{ display: "block", marginTop: 12 }}>
              {copy.title}
              <input style={input} value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              {copy.pasteLabel}
              <textarea
                rows={10}
                style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
                value={sourceContent}
                placeholder={copy.pastePlaceholder}
                onChange={(event) => updateSourceContent(event.target.value)}
              />
              <span style={{ ...mutedWorldStyle, display: "block", marginTop: 6 }}>
                {copy.pasteHelp(sourceContent.length)}
              </span>
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              {copy.sourceType}
              <select style={input} value={sourceType} onChange={(event) => setSourceType(event.target.value as typeof sourceType)}>
                <option value="auto">{copy.sourceAuto}</option>
                <option value="narrative">{copy.sourceNarrative}</option>
                <option value="lore">{copy.sourceLore}</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, margin: "14px 0" }}>
              <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
              {copy.rights}
            </label>
            <button type="button" style={button} disabled={busy || !sourceContent || sourceContent.length > 50_000} onClick={() => void compileWorld()}>
              {copy.compile}
            </button>
          </section>

          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>{copy.stepConfirm}</h2>
            <div
              style={{
                ...guideBox,
                borderColor: confirmStatus.tone,
                background: confirmStatus.background,
                marginBottom: 16,
              }}
            >
              <strong style={{ color: confirmStatus.tone }}>{confirmStatus.title}</strong>
              <p style={{ ...mutedWorldStyle, margin: "6px 0 0" }}>
                {confirmStatus.hint}
              </p>
            </div>
            <div
              style={{
                border: "1px solid #2d4165",
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                background: "rgba(8, 20, 40, 0.38)",
              }}
            >
              <ModelSelector
                language={language}
                mode="world"
                value={modelSelection}
                onChange={setModelSelection}
                title={copy.modelSettingsTitle}
                hint={copy.modelSettingsHint}
                providerLabel={copy.modelProvider}
                modelLabel={copy.modelName}
                help={copy.modelHelp}
                inputStyle={input}
                mutedStyle={mutedWorldStyle}
                buttonStyle={{
                  border: "1px solid #385077",
                  borderRadius: 10,
                  background: "#1d3558",
                  color: "#dbeafe",
                  padding: "9px 11px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              />
            </div>
            {draft ? (
              <div style={{ border: "1px solid #385077", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <strong>{copy.draftTitle}</strong>
                <p style={{ color: "#b8cae4", lineHeight: 1.5 }}>
                  {copy.draftIntro}
                </p>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", margin: "12px 0" }}>
                  <div style={{ border: "1px solid #2d4165", borderRadius: 10, padding: 10 }}>
                    <strong>{copy.worldTemplate}</strong>
                    <p style={{ ...mutedWorldStyle, margin: "6px 0 0" }}>
                      {templateLabel(draft.worldTemplate, language)} · {draft.sourceType}
                    </p>
                  </div>
                  {draftQualitySummary ? (
                    <>
                      <div style={{ border: `1px solid ${draftQualitySummary.suspiciousCharacters > 0 ? "#f97316" : "#2d4165"}`, borderRadius: 10, padding: 10 }}>
                        <strong>{copy.characterQuality}</strong>
                        <p style={{ ...mutedWorldStyle, margin: "6px 0 0" }}>
                          {draftQualitySummary.suspiciousCharacters > 0
                            ? copy.suspiciousCharacters(draftQualitySummary.suspiciousCharacters)
                            : copy.noSuspiciousCharacters}
                        </p>
                      </div>
                      <div style={{ border: `1px solid ${draftQualitySummary.genericRelationships ? "#facc15" : "#2d4165"}`, borderRadius: 10, padding: 10 }}>
                        <strong>{copy.relationshipQuality}</strong>
                        <p style={{ ...mutedWorldStyle, margin: "6px 0 0" }}>
                          {draftQualitySummary.genericRelationships
                            ? copy.genericRelationships
                            : copy.availableRelationships(draft.relationships.length)}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
                <div style={{ border: "1px solid #2d4165", borderRadius: 10, padding: 12, marginBottom: 12, background: "rgba(30,51,82,0.36)" }}>
                  <strong>{copy.templateAdvice}</strong>
                  <p style={{ ...mutedWorldStyle, margin: "6px 0 0" }}>
                    {templateDraftHint(draft.worldTemplate, language)}
                  </p>
                  <ul style={{ color: "#b8cae4", lineHeight: 1.6, margin: "8px 0 0", paddingLeft: 18 }}>
                    {templateDraftSuggestions(draft.worldTemplate, language).map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
                <label style={{ display: "block", marginTop: 12 }}>
                  {copy.worldTitle}
                  <input style={input} value={draft.title} onChange={(event) => updateDraftText("title", event.target.value)} />
                </label>
                <label style={{ display: "block", marginTop: 12 }}>
                  {copy.premise}
                  <textarea rows={3} style={{ ...input, resize: "vertical" }} value={draft.premise} onChange={(event) => updateDraftText("premise", event.target.value)} />
                </label>
                <label style={{ display: "block", marginTop: 12 }}>
                  {copy.timeAnchor}
                  <input style={input} value={draft.timeAnchor} onChange={(event) => updateDraftText("timeAnchor", event.target.value)} />
                </label>

                <details style={{ marginTop: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>{language === "en" ? "Canon facts and world rules" : "世界事实与规则"}</summary>
                  <p style={{ ...mutedWorldStyle, marginBottom: 10 }}>
                    {language === "en"
                      ? "Facts are stable truths characters can know; rules define abilities, timeline, taboos, and world boundaries. A few clear facts/rules work better than long text for MVP."
                      : "事实是角色可知道的稳定真相；规则定义能力、时间线、禁忌和世界边界。少量清楚的事实/规则比长文本更适合 MVP。"}
                  </p>
                  <div style={{ display: "grid", gap: 12 }}>
                    {draft.canonFacts.map((fact, index) => (
                      <div key={fact.id} style={{ border: "1px solid #2d4165", borderRadius: 12, padding: 12 }}>
                        <strong>{language === "en" ? `Fact ${index + 1}` : `事实 ${index + 1}`}</strong>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Fact" : "事实"}
                          <textarea rows={2} style={{ ...input, resize: "vertical" }} value={fact.statement} onChange={(event) => updateDraftCanonFact(index, { statement: event.target.value })} />
                        </label>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Tags" : "标签"}
                          <input style={input} value={formatList(fact.tags)} onChange={(event) => updateDraftCanonFact(index, { tags: parseList(event.target.value) })} />
                        </label>
                        <button type="button" style={{ ...button, background: "#7f1d1d", color: "#fecaca", marginTop: 10 }} disabled={draft.canonFacts.length <= 1} onClick={() => removeDraftCanonFact(index)}>
                          {language === "en" ? "Delete fact" : "删除事实"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" style={{ ...button, marginTop: 12, background: "#1e3352", color: "#dbeafe" }} onClick={addDraftCanonFact}>
                    {language === "en" ? "Add fact" : "添加事实"}
                  </button>

                  <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                    {draft.rules.map((rule, index) => (
                      <div key={rule.id} style={{ border: "1px solid #2d4165", borderRadius: 12, padding: 12 }}>
                        <strong>{language === "en" ? `Rule ${index + 1}` : `规则 ${index + 1}`}</strong>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Rule" : "规则"}
                          <textarea rows={2} style={{ ...input, resize: "vertical" }} value={rule.description} onChange={(event) => updateDraftRule(index, { description: event.target.value })} />
                        </label>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Severity" : "强度"}
                          <select style={input} value={rule.severity} onChange={(event) => updateDraftRule(index, { severity: event.target.value as "hard" | "soft" })}>
                            <option value="hard">{language === "en" ? "hard" : "硬性"} · {language === "en" ? "cannot be broken" : "不可违背"}</option>
                            <option value="soft">{language === "en" ? "soft" : "软性"} · {language === "en" ? "preference/cost" : "倾向/代价"}</option>
                          </select>
                        </label>
                        <button type="button" style={{ ...button, background: "#7f1d1d", color: "#fecaca", marginTop: 10 }} disabled={draft.rules.length <= 1} onClick={() => removeDraftRule(index)}>
                          {language === "en" ? "Delete rule" : "删除规则"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" style={{ ...button, marginTop: 12, background: "#1e3352", color: "#dbeafe" }} onClick={addDraftRule}>
                    {language === "en" ? "Add rule" : "添加规则"}
                  </button>
                </details>

                <details open style={{ marginTop: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>{copy.characterReview}</summary>
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    {draft.characters.map((character) => (
                      <div key={character.id} style={{ border: `1px solid ${suspiciousCharacterIds.has(character.id) ? "#f97316" : "#2d4165"}`, borderRadius: 12, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={character.playable}
                              onChange={(event) => updateDraftCharacter(character.id, { playable: event.target.checked })}
                            />
                            {language === "en" ? "Playable role" : "可选角色"}
                          </label>
                          <button
                            type="button"
                            style={{ ...button, background: "#7f1d1d", color: "#fecaca", padding: "8px 10px" }}
                            disabled={draft.characters.length <= 1}
                            onClick={() => removeDraftCharacter(character.id)}
                          >
                            {language === "en" ? "Delete" : "删除"}
                          </button>
                        </div>
                        {suspiciousCharacterIds.has(character.id) ? (
                          <div style={{ border: "1px solid #f97316", borderRadius: 10, padding: 10, marginTop: 10, background: "rgba(124,45,18,0.22)" }}>
                            <strong style={{ color: "#fed7aa" }}>{language === "en" ? "Suspicious character name" : "可疑角色名"}</strong>
                            <p style={{ ...mutedWorldStyle, margin: "6px 0 8px" }}>
                              {language === "en"
                                ? "This looks like a phrase cut from a sentence. Rename it, delete it, or mark it non-playable and remove it from the opening."
                                : "这个名字像从句子里截断出来的短语。建议改名、删除，或先设为不可选并移出开场。"}
                            </p>
                            <button
                              type="button"
                              style={{ ...button, background: "#1e3352", color: "#dbeafe", padding: "8px 10px" }}
                              onClick={() => markDraftCharacterNonPlayable(character.id)}
                            >
                              {language === "en" ? "Mark non-playable and remove from opening" : "设为不可选并移出开场"}
                            </button>
                          </div>
                        ) : null}
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Name" : "名字"}
                          <input style={input} value={character.name} onChange={(event) => updateDraftCharacter(character.id, { name: event.target.value })} />
                        </label>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Identity" : "身份"}
                          <input style={input} value={character.identity} onChange={(event) => updateDraftCharacter(character.id, { identity: event.target.value })} />
                        </label>
                        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 10 }}>
                          <label>
                            {language === "en" ? "Personality traits (one per line)" : "性格倾向（一行一个）"}
                            <textarea rows={3} style={{ ...input, resize: "vertical" }} value={formatList(character.personality)} onChange={(event) => updateDraftCharacter(character.id, { personality: parseList(event.target.value) })} />
                          </label>
                          <label>
                            {language === "en" ? "Goals (one per line)" : "目标（一行一个）"}
                            <textarea rows={3} style={{ ...input, resize: "vertical" }} value={formatList(character.goals)} onChange={(event) => updateDraftCharacter(character.id, { goals: parseList(event.target.value) })} />
                          </label>
                          <label>
                            {language === "en" ? "Capabilities (one per line)" : "能力（一行一个）"}
                            <textarea rows={3} style={{ ...input, resize: "vertical" }} value={formatList(character.capabilities)} onChange={(event) => updateDraftCharacter(character.id, { capabilities: parseList(event.target.value) })} />
                          </label>
                          <label>
                            {language === "en" ? "Limitations (one per line)" : "限制（一行一个）"}
                            <textarea rows={3} style={{ ...input, resize: "vertical" }} value={formatList(character.limitations)} onChange={(event) => updateDraftCharacter(character.id, { limitations: parseList(event.target.value) })} />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" style={{ ...button, marginTop: 12, background: "#1e3352", color: "#dbeafe" }} disabled={draft.characters.length >= 15} onClick={addDraftCharacter}>
                    {language === "en" ? "Add character" : "添加角色"}
                  </button>
                </details>

                <details open style={{ marginTop: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>{copy.relationshipReview}</summary>
                  <p style={{ ...mutedWorldStyle, marginBottom: 10 }}>
                    {language === "en"
                      ? "Affinity -5~5 means closeness; tension 0~5 means conflict pressure. A few non-generic relationships will make the chapter feel more alive."
                      : "affinity -5~5 表示亲近度，tension 0~5 表示冲突压力。至少补几条非“资料关联”的关系，会显著提升游戏感。"}
                  </p>
                  <div style={{ display: "grid", gap: 12 }}>
                    {draft.relationships.map((relationship, index) => (
                      <div key={`${relationship.sourceCharacterId}-${relationship.targetCharacterId}-${index}`} style={{ border: "1px solid #2d4165", borderRadius: 12, padding: 12 }}>
                        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))" }}>
                          <label>
                            {language === "en" ? "Character A" : "角色 A"}
                            <select style={input} value={relationship.sourceCharacterId} onChange={(event) => updateDraftRelationship(index, { sourceCharacterId: event.target.value })}>
                              {draft.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
                            </select>
                          </label>
                          <label>
                            {language === "en" ? "Character B" : "角色 B"}
                            <select style={input} value={relationship.targetCharacterId} onChange={(event) => updateDraftRelationship(index, { targetCharacterId: event.target.value })}>
                              {draft.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
                            </select>
                          </label>
                          <label>
                            {language === "en" ? "Relationship type" : "关系类型"}
                            <input style={input} value={relationship.kind} onChange={(event) => updateDraftRelationship(index, { kind: event.target.value })} />
                          </label>
                          <label>
                            affinity
                            <input type="number" min={-5} max={5} style={input} value={relationship.affinity} onChange={(event) => updateDraftRelationship(index, { affinity: Number(event.target.value) })} />
                          </label>
                          <label>
                            tension
                            <input type="number" min={0} max={5} style={input} value={relationship.tension} onChange={(event) => updateDraftRelationship(index, { tension: Number(event.target.value) })} />
                          </label>
                        </div>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Public relationship context" : "公开关系说明"}
                          <input style={input} value={relationship.publicContext} onChange={(event) => updateDraftRelationship(index, { publicContext: event.target.value })} />
                        </label>
                        <button type="button" style={{ ...button, background: "#7f1d1d", color: "#fecaca", marginTop: 10 }} onClick={() => removeDraftRelationship(index)}>
                          {language === "en" ? "Delete relationship" : "删除关系"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" style={{ ...button, marginTop: 12, background: "#1e3352", color: "#dbeafe" }} disabled={draft.characters.length < 2} onClick={addDraftRelationship}>
                    {language === "en" ? "Add relationship" : "添加关系"}
                  </button>
                </details>

                <details open style={{ marginTop: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>{copy.openingGoals}</summary>
                  <label style={{ display: "block", marginTop: 12 }}>
                    {language === "en" ? "Opening location" : "开场地点"}
                    <select style={input} value={draft.openingScenario.locationId ?? draft.locations[0]?.id ?? ""} onChange={(event) => updateOpeningScenario({ locationId: event.target.value })}>
                      {draft.locations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "block", marginTop: 12 }}>
                    {language === "en" ? "Opening event" : "开场事件"}
                    <textarea rows={3} style={{ ...input, resize: "vertical" }} value={draft.openingScenario.event} onChange={(event) => updateOpeningScenario({ event: event.target.value })} />
                  </label>
                  <div style={{ marginTop: 12 }}>
                    <strong>{language === "en" ? "Active NPCs (up to 3)" : "活跃非玩家角色（最多 3 个）"}</strong>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {draft.characters.map((character) => (
                        <label key={character.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={(draft.openingScenario.activeCharacterIds ?? []).includes(character.id)}
                            disabled={
                              !(draft.openingScenario.activeCharacterIds ?? []).includes(character.id) &&
                              (draft.openingScenario.activeCharacterIds?.length ?? 0) >= 3
                            }
                            onChange={(event) => toggleOpeningCharacter(character.id, event.target.checked)}
                          />
                          {character.name} · {character.identity}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: "block", marginTop: 12 }}>
                    {language === "en" ? "Suggested goals (one per line, up to 3)" : "建议目标（一行一个，最多 3 个）"}
                    <textarea rows={3} style={{ ...input, resize: "vertical" }} value={formatList(draft.openingScenario.suggestedGoals)} onChange={(event) => updateOpeningScenario({ suggestedGoals: parseList(event.target.value).slice(0, 3) })} />
                  </label>
                </details>

                <details style={{ marginTop: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>{copy.eventSeeds}</summary>
                  <p style={{ ...mutedWorldStyle, marginBottom: 10 }}>
                    {language === "en"
                      ? "Event seeds initialize the chapter eventQueue. They are not full plot scripts; they are traceable pressure states that can surface during turns 1–3."
                      : "事件种子会初始化章节里的 eventQueue。它们不是完整剧情脚本，而是让世界在第 1–3 轮产生压力的可追踪状态。"}
                  </p>
                  <div style={{ display: "grid", gap: 12 }}>
                    {(draft.eventSeeds ?? []).map((eventSeed, index) => (
                      <div key={eventSeed.id} style={{ border: "1px solid #2d4165", borderRadius: 12, padding: 12 }}>
                        <strong>{language === "en" ? `Event ${index + 1}` : `事件 ${index + 1}`}</strong>
                        <label style={{ display: "block", marginTop: 10 }}>
                          {language === "en" ? "Description" : "描述"}
                          <textarea rows={2} style={{ ...input, resize: "vertical" }} value={eventSeed.description} onChange={(event) => updateDraftEventSeed(index, { description: event.target.value })} />
                        </label>
                        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginTop: 10 }}>
                          <label>
                            {language === "en" ? "Due turn" : "触发轮次"}
                            <input type="number" min={1} max={5} style={input} value={eventSeed.dueTurn ?? 1} onChange={(event) => updateDraftEventSeed(index, { dueTurn: Number(event.target.value) })} />
                          </label>
                          <label>
                            {language === "en" ? "Visibility" : "可见性"}
                            <select style={input} value={eventSeed.visibility} onChange={(event) => updateDraftEventSeed(index, { visibility: event.target.value as WorldEventSeed["visibility"] })}>
                              <option value="public">{language === "en" ? "public" : "公开"}</option>
                              <option value="rumor">{language === "en" ? "rumor" : "流言"}</option>
                              <option value="private">{language === "en" ? "private" : "私密"}</option>
                            </select>
                          </label>
                          <label>
                            {language === "en" ? "Severity" : "严重度"}
                            <input type="number" min={0} max={1} step={0.05} style={input} value={eventSeed.severity} onChange={(event) => updateDraftEventSeed(index, { severity: Number(event.target.value) })} />
                          </label>
                          <label>
                            {language === "en" ? "Status" : "状态"}
                            <select style={input} value={eventSeed.status} onChange={(event) => updateDraftEventSeed(index, { status: event.target.value as WorldEventSeed["status"] })}>
                              <option value="scheduled">{language === "en" ? "scheduled" : "已安排"}</option>
                              <option value="active">{language === "en" ? "active" : "进行中"}</option>
                              <option value="resolved">{language === "en" ? "resolved" : "已解决"}</option>
                              <option value="expired">{language === "en" ? "expired" : "已过期"}</option>
                            </select>
                          </label>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <strong>{language === "en" ? "Linked characters" : "关联角色"}</strong>
                          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                            {draft.characters.map((character) => (
                              <label key={character.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={eventSeed.linkedCharacterIds.includes(character.id)}
                                  onChange={(event) => toggleEventCharacter(index, character.id, event.target.checked)}
                                />
                                {character.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        <button type="button" style={{ ...button, background: "#7f1d1d", color: "#fecaca", marginTop: 10 }} onClick={() => removeDraftEventSeed(index)}>
                          {language === "en" ? "Delete event" : "删除事件"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" style={{ ...button, marginTop: 12, background: "#1e3352", color: "#dbeafe" }} onClick={addDraftEventSeed}>
                    {language === "en" ? "Add event seed" : "添加事件种子"}
                  </button>
                </details>

                {fallbackDraftWarning ? (
                  <div style={{ border: "1px solid #fb923c", borderRadius: 10, padding: 12, margin: "12px 0", background: "rgba(124,45,18,0.28)" }}>
                    <strong style={{ color: "#fed7aa" }}>{copy.fallbackWarningTitle}</strong>
                    <p style={{ color: "#ffedd5", margin: "6px 0 0", lineHeight: 1.5 }}>
                      {copy.fallbackWarningBody}
                    </p>
                  </div>
                ) : null}

                {combinedDraftWarnings.length ? (
                  <div style={{ border: "1px solid #facc15", borderRadius: 10, padding: 12, margin: "12px 0", background: "rgba(113,63,18,0.22)" }}>
                    <strong style={{ color: "#fef08a" }}>{copy.warningsTitle}</strong>
                    <ul style={{ marginBottom: 0, color: "#fef9c3" }}>
                      {combinedDraftWarnings.map((warning, index) => (
                        <li key={`${warning.code}-${index}`}>
                          {warning.code}: {warning.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {combinedDraftIssues.length ? (
                  <div style={{ border: "1px solid #f97316", borderRadius: 10, padding: 12, margin: "12px 0", background: "rgba(124,45,18,0.25)" }}>
                    <strong style={{ color: "#fed7aa" }}>{copy.issuesTitle}</strong>
                    <ul style={{ marginBottom: 0, color: "#ffedd5" }}>
                      {combinedDraftIssues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`}>
                          {issue.code}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <button type="button" style={button} disabled={busy || combinedDraftIssues.length > 0} onClick={() => void confirmDraft()}>
                  {copy.confirmPrivate}
                </button>
                {combinedDraftIssues.length ? (
                  <p style={{ color: "#fed7aa", fontSize: 13, lineHeight: 1.5 }}>
                    {copy.fixBeforeConfirm}
                  </p>
                ) : null}
              </div>
            ) : null}

            {selectedWorld ? (
              <>
                <span
                  style={{
                    ...smallBadge,
                    background: selectedWorld.visibility === "private" ? "rgba(94, 234, 212, 0.16)" : "rgba(147, 197, 253, 0.16)",
                    color: selectedWorld.visibility === "private" ? "#99f6e4" : "#bfdbfe",
                  }}
                >
                  {selectedWorld.visibility === "private" ? copy.worldBadgePrivate : copy.worldBadgeCurated}
                </span>
                <h3>{displayWorldTitle(selectedWorld, language)}</h3>
                <p style={{ color: "#b8cae4", lineHeight: 1.6 }}>{displayWorldPremise(selectedWorld, language)}</p>
                <p style={{ color: "#93c5fd" }}>{copy.selectedTimeAnchor}{displayWorldTimeAnchor(selectedWorld, language)}</p>
                <p style={{ ...mutedWorldStyle, marginTop: -4 }}>
                  {language === "en" ? "Source: " : "来源："}
                  {displaySourceAttribution(selectedWorld, language)}
                  {" · "}
                  {displayRightsBasis(selectedWorld, language)}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    style={{ ...button, background: characterMode === "existing" ? "#5eead4" : "#1e3352", color: characterMode === "existing" ? "#06202a" : "#dbeafe" }}
                    onClick={() => selectCharacterMode("existing")}
                  >
                    {copy.chooseExisting}
                  </button>
                  <button
                    type="button"
                    style={{ ...button, background: characterMode === "custom" ? "#5eead4" : "#1e3352", color: characterMode === "custom" ? "#06202a" : "#dbeafe" }}
                    onClick={() => selectCharacterMode("custom")}
                  >
                    {copy.createCharacter}
                  </button>
                </div>
                {characterMode === "existing" ? (
                  <label style={{ display: "block", marginTop: 14 }}>
                    {copy.character}
                    <select style={input} value={playerCharacterId} onChange={(event) => selectExistingCharacter(event.target.value)}>
                      {playableCharacters.map((character) => (
                        <option key={character.id} value={character.id}>
                          {displayCharacterName(selectedWorld, character, language)} · {displayCharacterIdentity(selectedWorld, character, language)}
                        </option>
                      ))}
                    </select>
                    {selectedPlayerCharacter ? (
                      <span style={{ display: "block", marginTop: 8, ...mutedWorldStyle }}>
                        {copy.goalRecomputed(displayCharacterName(selectedWorld, selectedPlayerCharacter, language) ?? selectedPlayerCharacter.name)}
                      </span>
                    ) : null}
                  </label>
                ) : (
                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    <p style={{ margin: 0, color: "#93c5fd", fontSize: 13, lineHeight: 1.5 }}>
                      {copy.customCharacterHelp}
                    </p>
                    <label>
                      {copy.name}
                      <input aria-label={copy.name} style={input} value={customCharacter.name} onChange={(event) => setCustomCharacter((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label>
                      {copy.identity}
                      <input aria-label={copy.identity} style={input} value={customCharacter.identity} onChange={(event) => setCustomCharacter((current) => ({ ...current, identity: event.target.value }))} />
                    </label>
                    <label>
                      {copy.strength}
                      <input aria-label={copy.strength} style={input} value={customCharacter.strength} onChange={(event) => setCustomCharacter((current) => ({ ...current, strength: event.target.value }))} />
                    </label>
                    <label>
                      {copy.weakness}
                      <input aria-label={copy.weakness} style={input} value={customCharacter.weakness} onChange={(event) => setCustomCharacter((current) => ({ ...current, weakness: event.target.value }))} />
                    </label>
                  </div>
                )}
                <label style={{ display: "block", marginTop: 14 }}>
                  {copy.chapterGoal}
                  <textarea aria-label={copy.chapterGoal} rows={4} style={{ ...input, resize: "vertical" }} value={goal} onChange={(event) => setGoal(event.target.value)} />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 16px" }}>
                  {chapterGoalSuggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => setGoal(suggestion)} style={{ ...button, background: "#1e3352", color: "#dbeafe", fontSize: 12 }}>
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button type="button" style={button} disabled={busy} onClick={() => void startChapter()}>
                  {busy ? copy.processing : copy.startChapter}
                </button>
              </>
            ) : (
              <p style={{ color: "#b8cae4" }}>{copy.noWorld}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function parseList(value: string): string[] {
  return value
    .split(/\n|[、，,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

function uniqueWorldIssues(issues: WorldPackIssue[]): WorldPackIssue[] {
  const seen = new Set<string>();
  const result: WorldPackIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}:${issue.candidateId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result;
}

function extractCharacterIdsFromIssue(issue: WorldPackIssue): string[] {
  const ids: string[] = [];
  const direct = issue.message.match(/^([^:\s]+):/u)?.[1];
  if (direct) ids.push(direct);
  const opening = issue.message.match(/character "([^"]+)"/i)?.[1];
  if (opening) ids.push(opening);
  return ids;
}

function summarizeDraftQuality(
  draft: WorldPackDraft,
  suspiciousCharacterIds: Set<string>,
  warnings: WorldPackIssue[],
): {
  suspiciousCharacters: number;
  genericRelationships: boolean;
} {
  return {
    suspiciousCharacters: draft.characters.filter((character) =>
      suspiciousCharacterIds.has(character.id),
    ).length,
    genericRelationships: warnings.some((warning) =>
      warning.code === "GENERIC_RELATIONSHIP_GRAPH",
    ),
  };
}

function templateLabel(template: WorldTemplateId | undefined, language: OutputLanguage): string {
  if (language === "en") {
    if (template === "court_intrigue") return "Court / household intrigue";
    if (template === "mythic_exploration") return "Mythic exploration";
    if (template === "anime_faction") return "Faction abilities";
    return "Generic world";
  }
  if (template === "court_intrigue") return "宫斗/家族权力";
  if (template === "mythic_exploration") return "神话探索";
  if (template === "anime_faction") return "阵营能力";
  return "通用世界";
}

function templateDraftHint(template: WorldTemplateId | undefined, language: OutputLanguage): string {
  if (language === "en") {
    if (template === "court_intrigue") {
      return "Clarify status, delegated authority, servant/kinship ties, rumors, favors, and face-risk. Good events revolve around public loss of face, private mediation, or tests of household authority.";
    }
    if (template === "mythic_exploration") {
      return "Clarify regions, routes, creatures/guardians, taboos, rituals, objects, and ability boundaries. Good events revolve around omens, trespass, approaching tracks, or route choices.";
    }
    if (template === "anime_faction") {
      return "Clarify faction goals, rivals/allies, explicit abilities, ability costs, and mission pressure. Good events revolve around deadlines, enemy probes, or ability exposure.";
    }
    return "Clarify stable roles, concrete relationships, hard rules, and at least one event pressure that can advance during the first turn.";
  }
  if (template === "court_intrigue") {
    return "优先补清楚名分/权威、主仆/亲族、流言、人情债和体面风险；事件最好围绕公开失面、私下调停或管事权试探。";
  }
  if (template === "mythic_exploration") {
    return "优先补地区路线、异兽/守护者、禁忌、祭仪、器物和能力边界；事件最好围绕征兆、越界、踪迹逼近或路线选择。";
  }
  if (template === "anime_faction") {
    return "优先补阵营目标、宿敌/盟友、明确能力、能力代价和任务压力；事件最好围绕任务时限、对手试探或能力暴露。";
  }
  return "优先补稳定角色、具体关系、硬规则和第一轮会推进的事件压力。";
}

function templateDraftSuggestions(template: WorldTemplateId | undefined, language: OutputLanguage): string[] {
  if (language === "en") {
    if (template === "court_intrigue") {
      return [
        "Relationship advice: cover at least two types among kinship, servants, delegated authority, rumors, debts, or favors.",
        "Event advice: banquet/task deadlines, private messages, elder accountability, or rumors that damage public face.",
      ];
    }
    if (template === "mythic_exploration") {
      return [
        "Relationship advice: guide, ritualist, witness, or taboo guardian; avoid only writing “travel companions.”",
        "Event advice: omens appearing, taboos approaching, route divergence, or interpretable clues left by a creature/deity.",
      ];
    }
    if (template === "anime_faction") {
      return [
        "Relationship advice: distinguish teammate trust, rival testing, superior orders, and faction opposition.",
        "Event advice: mission deadlines, ability costs, enemy bait, or reversals around true/false intelligence.",
      ];
    }
    return [
      "Relationship advice: add at least 3 non-template links that explain who trusts whom and who suspects whom.",
      "Event advice: add at least 1 dueTurn event so the chapter has outside pressure midway.",
    ];
  }
  if (template === "court_intrigue") {
    return [
      "关系建议：亲族、主仆、权威委任、流言、债务/人情至少覆盖两类。",
      "事件建议：宴席/差事时限、私下传话、长辈问责、体面受损的 rumor。",
    ];
  }
  if (template === "mythic_exploration") {
    return [
      "关系建议：向导、祭者、见证者、禁忌守护者，不要只写“同行”。",
      "事件建议：征兆出现、禁忌临近、路线分歧、异兽/神灵留下可解释线索。",
    ];
  }
  if (template === "anime_faction") {
    return [
      "关系建议：队友信任、宿敌试探、上级命令、阵营对立要区分清楚。",
      "事件建议：任务时限、能力代价、敌方诱导、情报真假反转。",
    ];
  }
  return [
    "关系建议：至少写清 3 条非模板关系，说明谁信任谁、谁怀疑谁。",
    "事件建议：至少 1 个 dueTurn 事件，让章节中途有外部压力。",
  ];
}

function displayWorldTitle(world: WorldPack, language: OutputLanguage): string {
  if (language === "zh-CN" && world.worldPackId === "odyssey-cyclops-v1") {
    return "奥德赛：独眼巨人洞穴";
  }
  if (language === "en" && world.worldPackId === "red-chamber-ningguo-v1") {
    return "Dream of the Red Chamber: Managing Ningguo House";
  }
  if (language === "en" && world.worldPackId === "shanhaijing-jingwei-v1") {
    return "Classic of Mountains and Seas: Jingwei Fills the Sea";
  }
  return world.title;
}

function displayWorldPremise(world: WorldPack, language: OutputLanguage): string {
  if (language === "zh-CN" && world.worldPackId === "odyssey-cyclops-v1") {
    return "离开特洛伊之后，奥德修斯和少数船员进入波吕斐摩斯的洞穴，本以为能得到待客之礼，却被巨石封在洞内。这个章节围绕计谋、时机、船员信任、神圣客礼和报出真名的代价展开。";
  }
  if (language === "en" && world.worldPackId === "red-chamber-ningguo-v1") {
    return "During Qin Keqing's funeral, Ningguo House falls into disorder. Wang Xifeng is asked to manage the household affairs and must act between ritual law, personal ties, reputation, and execution order.";
  }
  if (language === "en" && world.worldPackId === "shanhaijing-jingwei-v1") {
    return "On Fajiu Mountain, Jingwei carries twigs and stones toward the East Sea. Enter a mythic node where vow, tide, mountain resources, divine memory, and witnesses all push back.";
  }
  return world.premise;
}

function displayWorldTimeAnchor(world: WorldPack, language: OutputLanguage): string {
  if (language === "zh-CN" && world.worldPackId === "odyssey-cyclops-v1") {
    return "《奥德赛》第九卷：奥德修斯回忆自己和船员被困波吕斐摩斯洞穴，用烈酒和“无人”之名刺瞎独眼巨人，并藏在羊腹下逃离。";
  }
  if (language === "en" && world.worldPackId === "red-chamber-ningguo-v1") {
    return "During Qin Keqing's funeral, Wang Xifeng is entrusted with managing Ningguo House.";
  }
  if (language === "en" && world.worldPackId === "shanhaijing-jingwei-v1") {
    return "The Shanhai Jing episode where Nüwa drowns in the East Sea, becomes Jingwei, and carries western mountain wood and stone to fill the sea.";
  }
  return world.timeAnchor;
}

function displaySourceAttribution(world: WorldPack, language: OutputLanguage): string {
  if (language === "zh-CN" && world.worldPackId === "odyssey-cyclops-v1") {
    return "荷马《奥德赛》第九卷，Samuel Butler 英译公版文本";
  }
  if (language === "en" && world.worldPackId === "red-chamber-ningguo-v1") {
    return "Public-domain Dream of the Red Chamber source material";
  }
  if (language === "en" && world.worldPackId === "shanhaijing-jingwei-v1") {
    return "Public-domain Shanhai Jing, Bei Shan Jing, Fajiu Mountain/Jingwei passage";
  }
  return world.sourceAttribution.label;
}

function displayRightsBasis(world: WorldPack, language: OutputLanguage): string {
  if (world.sourceAttribution.rightsBasis === "public-domain") {
    return language === "en" ? "public domain" : "公版材料";
  }
  return language === "en" ? "user-confirmed private use" : "用户确认私人使用权";
}

const redChamberCharacterDisplay: Record<string, { name: string; identity: string }> = {
  "wang-xifeng": {
    name: "Wang Xifeng",
    identity: "A young manager of Rongguo House, entrusted with Ningguo House affairs.",
  },
  "pinger": {
    name: "Ping'er",
    identity: "Wang Xifeng's trusted personal attendant.",
  },
  "jia-rong": {
    name: "Jia Rong",
    identity: "A young master of Ningguo House, caught between family affairs and elder demands.",
  },
  "jia-zhen": {
    name: "Jia Zhen",
    identity: "The head of Ningguo House, who asks Wang Xifeng to restore order.",
  },
  "lady-wang": {
    name: "Lady Wang",
    identity: "A senior figure of Rongguo House and a constraint on Wang Xifeng's actions.",
  },
  "lady-you": {
    name: "You Shi",
    identity: "The mistress of Ningguo House, limited by funeral and household pressure.",
  },
  "zhou-rui-wife": {
    name: "Zhou Rui's wife",
    identity: "A Rongguo House servant woman familiar with both households' social ties.",
  },
  "ning-steward": {
    name: "Old Ningguo steward",
    identity: "An old household steward who understands daily servant operations.",
  },
  "ritual-clerk": {
    name: "Ritual clerk",
    identity: "A clerk responsible for funeral documents and ritual arrangements.",
  },
  "senior-maid": {
    name: "Senior Ningguo maid",
    identity: "A senior inner-house maid who knows the servants' real mood.",
  },
  "gate-servant": {
    name: "Gate servant",
    identity: "A Ningguo servant responsible for greeting guests and messages.",
  },
  "guest-elder": {
    name: "Clan elder",
    identity: "A visiting elder who observes the reputation of both houses.",
  },
};

const shanhaijingCharacterDisplay: Record<string, { name: string; identity: string }> = {
  jingwei: {
    name: "Jingwei",
    identity: "The bird transformed from Yan Emperor's daughter Nüwa, carrying wood and stones to fill the East Sea.",
  },
  "nvwa-memory": {
    name: "Nüwa's memory",
    identity: "The memory of Nüwa suspended between Jingwei's cry and the sea tide.",
  },
  "fajiu-keeper": {
    name: "Mountain keeper",
    identity: "A guardian of Fajiu Mountain's wood, stone, routes, and omens.",
  },
  "west-gatherer": {
    name: "Wood gatherer",
    identity: "A mortal gatherer who travels between the western mountains and Fajiu Mountain.",
  },
  "east-sea-envoy": {
    name: "Tide envoy",
    identity: "An envoy of the East Sea's tide order.",
  },
  "yan-emperor-envoy": {
    name: "Yan Emperor's envoy",
    identity: "A lineage envoy sent to investigate how Nüwa's name should be remembered.",
  },
  "zhang-river-spirit": {
    name: "Zhang River spirit",
    identity: "The spirit of the river that rises from Fajiu Mountain.",
  },
  "zhe-wood-spirit": {
    name: "Zhe wood spirit",
    identity: "The tree spirit of Fajiu Mountain's zhe wood slope.",
  },
  "west-stone-spirit": {
    name: "Stone spirit",
    identity: "A western mountain spirit guarding the mountain's stone bones.",
  },
  "sea-depth-voice": {
    name: "Sea-depth voice",
    identity: "A voice from the deep sea that mixes tide sound with Nüwa's memory.",
  },
  "traveler-ritualist": {
    name: "Ritualist",
    identity: "A traveling ritualist who can explain omens to witnesses.",
  },
};

const odysseyCharacterDisplayZh: Record<string, { name: string; identity: string }> = {
  odysseus: {
    name: "奥德修斯",
    identity: "伊萨卡之王、特洛伊战场老兵，正试图用计谋带船员回家。",
  },
  "achaean-sailor": {
    name: "阿开亚船员",
    identity: "奥德修斯的幸存同伴，在服从、恐惧和实际逃生之间摇摆。",
  },
  noman: {
    name: "无人",
    identity: "奥德修斯用来误导波吕斐摩斯的假名，也是把语言变成陷阱的战术面具。",
  },
  "ship-lookout": {
    name: "船上瞭望者",
    identity: "留在船边的水手，观察洞穴道路、海浪和岸边危险。",
  },
  polyphemus: {
    name: "波吕斐摩斯",
    identity: "波塞冬之子、独眼巨人牧者，把奥德修斯的船员困在洞穴中。",
  },
  "old-ram": {
    name: "老公羊",
    identity: "波吕斐摩斯羊群中最大的公羊，之后会把奥德修斯藏在腹下带出洞口。",
  },
  "cyclops-neighbors": {
    name: "邻近独眼巨人",
    identity: "听得见波吕斐摩斯呼喊的其他独眼巨人，但需要明确理由才会介入。",
  },
  poseidon: {
    name: "波塞冬",
    identity: "海神、波吕斐摩斯之父，能够让奥德修斯的归途变得艰难。",
  },
  "zeus-xenios": {
    name: "护客的宙斯",
    identity: "守护待客之礼的神圣压力，也是奥德修斯提出道德控诉时援引的秩序。",
  },
  "maronaean-wine": {
    name: "马罗尼亚烈酒",
    identity: "奥德修斯从马戎处带来的烈酒，足以让独眼巨人的判断变得迟钝。",
  },
};

function displayCharacterName(
  world: WorldPack,
  character: WorldPack["characters"][number] | undefined,
  language: OutputLanguage,
): string | undefined {
  if (!character) return undefined;
  if (language === "zh-CN" && world.worldPackId === "odyssey-cyclops-v1") {
    return odysseyCharacterDisplayZh[character.id]?.name ?? character.name;
  }
  if (language === "en" && world.worldPackId === "red-chamber-ningguo-v1") {
    return redChamberCharacterDisplay[character.id]?.name ?? character.name;
  }
  if (language === "en" && world.worldPackId === "shanhaijing-jingwei-v1") {
    return shanhaijingCharacterDisplay[character.id]?.name ?? character.name;
  }
  return character.name;
}

function displayCharacterIdentity(
  world: WorldPack,
  character: WorldPack["characters"][number],
  language: OutputLanguage,
): string {
  if (language === "zh-CN" && world.worldPackId === "odyssey-cyclops-v1") {
    return odysseyCharacterDisplayZh[character.id]?.identity ?? character.identity;
  }
  if (language === "en" && world.worldPackId === "red-chamber-ningguo-v1") {
    return redChamberCharacterDisplay[character.id]?.identity ?? character.identity;
  }
  if (language === "en" && world.worldPackId === "shanhaijing-jingwei-v1") {
    return shanhaijingCharacterDisplay[character.id]?.identity ?? character.identity;
  }
  return character.identity;
}

function normalizeEditableDraft(draft: WorldPackDraft, language: OutputLanguage): WorldPackDraft {
  const fallbackText = {
    fact: language === "en" ? "Fact to confirm." : "事实待确认。",
    rule: language === "en" ? "World rule to confirm." : "世界规则待确认。",
    unnamedCharacter: language === "en" ? "Unnamed character" : "未命名角色",
    identity: language === "en" ? "Identity to confirm" : "身份待确认",
    personality: language === "en" ? "Personality to confirm" : "性格待确认",
    goal: language === "en" ? "Goal to confirm" : "目标待确认",
    locationName: language === "en" ? "Opening area" : "开场区域",
    locationDescription: language === "en" ? "Location description to confirm." : "地点说明待确认。",
    privateWorld: language === "en" ? "Private world" : "私人世界",
    premise: language === "en"
      ? "A private world built from user-provided text, with details that need human review."
      : "一个由用户资料构建、需要人工确认细节的私人世界。",
    timeAnchor: language === "en" ? "Opening time to confirm" : "开场时间待确认",
    relationship: language === "en" ? "Relationship to confirm" : "关系待确认",
    relationshipContext: language === "en" ? "Relationship context to confirm." : "人物关系说明待确认。",
    openingTitle: language === "en" ? "Opening event" : "开场事件",
    openingEvent: language === "en" ? "Opening event to confirm." : "开场事件待确认。",
    suggestedGoal: language === "en" ? "Stabilize the current situation" : "稳住当前局面",
    worldEvent: language === "en" ? "World event to confirm." : "世界事件待确认。",
  };
  const canonFacts = draft.canonFacts.length > 0
    ? draft.canonFacts.map((fact) => ({
        ...fact,
        statement: fact.statement.trim() || fallbackText.fact,
        tags: ensureList(fact.tags, "manual"),
      }))
    : [
        {
          id: "fact-manual-1",
          statement: fallbackText.fact,
          tags: ["manual"],
        },
      ];
  const factIds = new Set(canonFacts.map((fact) => fact.id));
  const rules = draft.rules.length > 0
    ? draft.rules.map((rule) => ({
        ...rule,
        description: rule.description.trim() || fallbackText.rule,
        severity: rule.severity,
      }))
    : [
        {
          id: "rule-manual-1",
          description: fallbackText.rule,
          severity: "soft" as const,
        },
      ];
  const characters = draft.characters.map((character) => ({
    ...character,
    name: character.name.trim() || fallbackText.unnamedCharacter,
    identity: character.identity.trim() || fallbackText.identity,
    personality: ensureList(character.personality, fallbackText.personality),
    goals: ensureList(character.goals, fallbackText.goal),
    capabilities: character.capabilities ?? [],
    limitations: character.limitations ?? [],
    knownFactIds: (character.knownFactIds ?? []).filter((factId) => factIds.has(factId)),
    unknownFactIds: (character.unknownFactIds ?? []).filter((factId) => factIds.has(factId)),
  }));
  if (characters.length > 0 && !characters.some((character) => character.playable)) {
    characters[0] = { ...characters[0]!, playable: true };
  }

  const characterIds = new Set(characters.map((character) => character.id));
  const locations = draft.locations.length > 0
    ? draft.locations.map((location) => ({
        ...location,
        name: location.name.trim() || fallbackText.locationName,
        description: location.description.trim() || fallbackText.locationDescription,
        connectedLocationIds: location.connectedLocationIds ?? [],
      }))
    : [
        {
          id: "opening-location",
          name: fallbackText.locationName,
          description: fallbackText.locationDescription,
          connectedLocationIds: [],
        },
      ];
  const locationIds = new Set(locations.map((location) => location.id));
  const openingLocationId = draft.openingScenario.locationId && locationIds.has(draft.openingScenario.locationId)
    ? draft.openingScenario.locationId
    : locations[0]!.id;
  const activeCharacterIds = (draft.openingScenario.activeCharacterIds ?? [])
    .filter((id) => characterIds.has(id))
    .slice(0, 3);
  if (activeCharacterIds.length === 0 && characters[0]) {
    activeCharacterIds.push(characters[0].id);
  }

  return {
    ...draft,
    worldTemplate: draft.worldTemplate ?? "generic",
    title: draft.title.trim() || fallbackText.privateWorld,
    premise: draft.premise.trim() || fallbackText.premise,
	    timeAnchor: draft.timeAnchor.trim() || fallbackText.timeAnchor,
	    canonFacts,
	    rules,
	    locations,
	    characters,
    relationships: draft.relationships
      .filter((relationship) =>
        characterIds.has(relationship.sourceCharacterId) &&
        characterIds.has(relationship.targetCharacterId),
      )
      .map((relationship) => ({
        ...relationship,
        kind: relationship.kind.trim() || fallbackText.relationship,
        affinity: clampNumber(relationship.affinity, -5, 5),
        tension: clampNumber(relationship.tension, 0, 5),
        publicContext: relationship.publicContext.trim() || fallbackText.relationshipContext,
      })),
	    openingScenario: {
	      ...draft.openingScenario,
      id: draft.openingScenario.id ?? "opening",
      title: draft.openingScenario.title?.trim() || fallbackText.openingTitle,
      locationId: openingLocationId,
      activeCharacterIds,
      event: draft.openingScenario.event.trim() || fallbackText.openingEvent,
	      suggestedGoals: ensureList(draft.openingScenario.suggestedGoals, fallbackText.suggestedGoal).slice(0, 3),
	    },
	    eventSeeds: (draft.eventSeeds ?? []).map((eventSeed) => ({
	      ...eventSeed,
	      turnCreated: Math.max(0, Math.floor(eventSeed.turnCreated ?? 0)),
	      dueTurn: eventSeed.dueTurn ? Math.max(1, Math.floor(eventSeed.dueTurn)) : undefined,
	      severity: clampNumber(eventSeed.severity, 0, 1),
	      description: eventSeed.description.trim() || fallbackText.worldEvent,
	      linkedCharacterIds: eventSeed.linkedCharacterIds
	        .filter((characterId) => characterIds.has(characterId))
	        .slice(0, 3),
	      linkedFactionIds: eventSeed.linkedFactionIds ?? [],
	    })),
	  };
}

function ensureList(values: string[] | undefined, fallback: string): string[] {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : [fallback];
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function nextSequentialId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let index = existingIds.length + 1;
  let candidate = `${prefix}-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
}
