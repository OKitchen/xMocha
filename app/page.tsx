"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  ModelSelector,
  modelConfigFromSelection,
  type ModelSelection,
} from "./components/model-selector";

type UserProvidedSourceKind = "text" | "markdown" | "json" | "pdf" | "note";
type OutputLanguage = "zh-CN" | "en";

type UploadedSource = {
  title: string;
  kind: UserProvidedSourceKind;
  content: string;
  size: number;
  pageCount?: number;
  extractedCharacters?: number;
};

type ExtractDocumentResponse =
  | UploadedSource
  | {
      error: string;
    };

const defaultDilemmaZh =
  "我应该接受创业公司的 offer，还是留在目前稳定的岗位？";
const defaultDilemmaEn =
  "Should I accept the startup offer, or stay in my current stable role?";

const maxUploadBytes = 5 * 1024 * 1024;

const presetScenarioOptions = [
  {
    id: "none",
    label: {
      "zh-CN": "自由输入",
      en: "Free input",
    },
    description: {
      "zh-CN": "从一个自定义困境开始。",
      en: "Start from a custom dilemma.",
    },
    dilemma: {
      "zh-CN": defaultDilemmaZh,
      en: defaultDilemmaEn,
    },
    theme: "sci-fi",
  },
  {
    id: "ai_future_of_work",
    label: {
      "zh-CN": "AI 工作未来",
      en: "AI Future of Work",
    },
    description: {
      "zh-CN":
        "一个围绕 AI 改变岗位期待、团队动态和长期职业杠杆的 grounded demo。",
      en: "A grounded demo around AI changing role expectations, team dynamics, and long-term career leverage.",
    },
    dilemma: {
      "zh-CN":
        "AI 正在快速改变我的领域。我应该继续强化当前岗位，转向 AI-native 工作方式，还是在市场定义我之前主动重塑自己的角色？",
      en: "AI is rapidly changing my field. Should I deepen my current role, move toward AI-native work, or proactively reshape my role before the market defines it for me?",
    },
    theme: "sci-fi",
  },
] as const;

type PresetScenarioId = (typeof presetScenarioOptions)[number]["id"];

const defaultAiContext: Record<
  OutputLanguage,
  {
    userGoal: string;
    currentPosition: string;
    timeHorizon: string;
    personalConstraints: string;
    keyStakeholders: string;
  }
> = {
  "zh-CN": {
    userGoal: "在保持专业可信度的同时，提高长期职业杠杆。",
    currentPosition: "一个能力稳定、但所在领域正在被 AI 重塑的从业者。",
    timeHorizon: "6-12 个月",
    personalConstraints:
      "当前职责留给实验的时间有限。\n不能承受长时间公开表现出方向混乱。",
    keyStakeholders: "直属经理\n同组工程师\nAI-forward 推动者\n个人支持系统",
  },
  en: {
    userGoal: "Increase long-term career leverage while keeping professional credibility.",
    currentPosition:
      "A capable professional whose field is being reshaped by AI.",
    timeHorizon: "6-12 months",
    personalConstraints:
      "Current responsibilities leave limited time for experiments.\nI cannot afford to look publicly unfocused for a long time.",
    keyStakeholders:
      "Direct manager\nTeammate engineers\nAI-forward advocates\nPersonal support system",
  },
};

const homeCopy: Record<
  OutputLanguage,
  {
    eyebrow: string;
    headline: string;
    intro: string;
    inputLabel: string;
    inputPlaceholder: string;
    inputHelp: string;
    inputExampleCta: string;
    examplesTitle: string;
    examples: string[];
    presetTitle: string;
    cta: string;
    ctaHint: string;
    worldDemoCta: string;
    worldDemoHint: string;
    visualTitle: string;
    previewSteps: string[];
    previewCards: Array<{ title: string; body: string }>;
    advancedTitle: string;
    advancedHint: string;
    modelSettingsTitle: string;
    modelSettingsHint: string;
    theme: string;
    roomStyle: string;
    turns: string;
    upload: string;
    uploadHelp: string;
    supplementalContext: string;
    supplementalPlaceholder: string;
    supplementalHelp: string;
    userGoal: string;
    currentPosition: string;
    riskPreference: string;
    timeHorizon: string;
    personalConstraints: string;
    keyStakeholders: string;
    safetyLabel: string;
    safety: string;
    privacyLabel: string;
    privacy: string;
    modelProvider: string;
    modelName: string;
    modelHelp: string;
    generating: string;
    retry: string;
    remove: string;
    uploadExtracting: string;
    uploadAdded: (count: number) => string;
    uploadTooLarge: (name: string) => string;
    uploadEmpty: string;
    uploadReadFailed: string;
    uploadMeta: (source: UploadedSource) => string;
    inputRequired: string;
    startFailed: string;
    unknownStartError: string;
    themeOptions: Record<string, string>;
    visualStyleOptions: Record<string, string>;
    riskOptions: Record<string, string>;
  }
> = {
  "zh-CN": {
    eyebrow: "xMocha",
    headline: "在做决定前，先看看几条可能的未来。",
    intro:
      "输入一个真实困境，xMocha 会生成多条未来分支。你选择其中一条后，它会继续展开成一段完整的决策旅程。",
    inputLabel: "你正在面对什么决定？",
    inputPlaceholder: "例如：我应该换工作，还是继续留在现在的岗位？",
    inputHelp: "灰色文字只是示例。你可以手动输入，也可以点击下方示例快速测试。",
    inputExampleCta: "使用这个示例测试",
    examplesTitle: "示例困境",
    examples: [
      "换工作还是留下？",
      "要不要搬去新城市？",
      "要不要开始自己的项目？",
    ],
    presetTitle: "预设",
    cta: "生成我的未来分支",
    ctaHint: "第一次模拟不需要注册。",
    worldDemoCta: "体验世界模式示例",
    worldDemoHint: "用《红楼梦》《山海经》或《奥德赛》五轮角色章节快速理解观察、选择和影子路径。",
    visualTitle: "现实预览",
    previewSteps: ["你的困境", "未来分支", "选择一条路径", "决策旅程"],
    previewCards: [
      {
        title: "安全路径",
        body: "保留稳定性，降低短期冲击。",
      },
      {
        title: "大胆路径",
        body: "提高上限，也暴露更多不确定性。",
      },
      {
        title: "意外路径",
        body: "系统发现你没有主动考虑的第三种展开。",
      },
    ],
    advancedTitle: "高级背景",
    advancedHint: "可选：加入背景资料、文件和模拟风格。",
    modelSettingsTitle: "模型设置",
    modelSettingsHint: "默认使用服务器配置；开发者可以在这里切换提供方和模型。",
    theme: "主题风格",
    roomStyle: "房间风格",
    turns: "轮数",
    upload: "上传报告/背景文件",
    uploadHelp:
      "支持 PDF、TXT、Markdown、JSON、CSV 和日志文件。每个文件最多 5MB；PDF 会先在后台抽取文字，再作为 grounding source 参与分支生成。",
    supplementalContext: "补充背景资料",
    supplementalPlaceholder:
      "粘贴你希望模拟时参考的真实背景。\n例如：我的经理希望本季度看到明确的 AI 采用成果；我有房贷压力；我正在比较内部平台岗和创业公司 offer。",
    supplementalHelp:
      "这些资料会作为 grounding source 保存，并转化为可复用的事实，影响后续分支生成。",
    userGoal: "用户目标",
    currentPosition: "当前处境",
    riskPreference: "风险偏好",
    timeHorizon: "时间范围",
    personalConstraints: "个人约束",
    keyStakeholders: "关键利益相关者",
    safetyLabel: "使用边界",
    safety:
      "xMocha 用于反思和情景模拟，不提供医疗、法律、金融或心理治疗建议。",
    privacyLabel: "隐私提示",
    privacy:
      "你的输入会发送给所选 AI 模型并用于生成模拟结果；联系方式仅用于后续联系。请勿输入身份证件、账户密码、完整财务或健康记录等高度敏感信息。",
    modelProvider: "模型提供方",
    modelName: "模型名称",
    modelHelp:
      "默认使用服务器环境配置；仅在本地开发或模型对比时切换提供方和模型。",
    generating: "正在生成...",
    retry: "生成失败，请重试",
    remove: "移除",
    uploadExtracting: "正在读取文件...",
    uploadAdded: (count) => `已加入 ${count} 个背景文件。`,
    uploadTooLarge: (name) => `"${name}" 超过 5MB。请先压缩或摘取关键内容。`,
    uploadEmpty: "上传文件没有可读取的文字内容。",
    uploadReadFailed: "读取文件失败。请上传可复制文字的 PDF、UTF-8 文本、Markdown、JSON、CSV 或日志文件。",
    uploadMeta: (source) =>
      [
        source.kind.toUpperCase(),
        formatBytes(source.size),
        source.pageCount ? `${source.pageCount} 页` : null,
        `${source.extractedCharacters ?? source.content.length} 字`,
      ].filter(Boolean).join(" · "),
    inputRequired: "请输入一个决定，或点击下方示例开始测试。",
    startFailed: "启动 session 失败。",
    unknownStartError: "启动 session 时出现未知错误。",
    themeOptions: {
      adventure: "冒险",
      "sci-fi": "科幻",
      dream: "梦境",
      hell: "高压",
      humorous: "幽默",
    },
    visualStyleOptions: {
      "career-studio": "职业工作室",
      "city-apartment": "城市公寓",
      "night-cafe": "夜间咖啡馆",
    },
    riskOptions: {
      low: "低",
      medium: "中",
      high: "高",
    },
  },
  en: {
    eyebrow: "xMocha",
    headline: "Simulate possible futures before you decide.",
    intro:
      "Enter a real-life decision. xMocha unfolds several possible futures, lets you collapse one path, and shows how that choice may evolve.",
    inputLabel: "What decision are you facing?",
    inputPlaceholder: "Example: Should I leave my stable job for a startup?",
    inputHelp: "Grey text is only an example. Type your own decision, or click an example below to test.",
    inputExampleCta: "Use this example to test",
    examplesTitle: "Example dilemmas",
    examples: [
      "Should I leave my stable job for a startup?",
      "Should I move to another city?",
      "Should I start my own project?",
    ],
    presetTitle: "Preset",
    cta: "Generate my futures",
    ctaHint: "No account needed for the first simulation.",
    worldDemoCta: "Try the World Mode examples",
    worldDemoHint: "Red Chamber, Shanhai Jing, and Odyssey chapters quickly show observe, collapse, and shadow paths.",
    visualTitle: "Reality preview",
    previewSteps: ["Your dilemma", "Possible futures", "Collapse one path", "Decision journey"],
    previewCards: [
      {
        title: "Safe path",
        body: "Protects stability and lowers near-term shock.",
      },
      {
        title: "Bold path",
        body: "Raises upside while exposing more uncertainty.",
      },
      {
        title: "Unexpected path",
        body: "Surfaces a third option you may not be considering.",
      },
    ],
    advancedTitle: "Advanced context",
    advancedHint: "Optional: add background, files, and simulation style.",
    modelSettingsTitle: "Model settings",
    modelSettingsHint: "Uses the server default unless a developer overrides provider/model here.",
    theme: "Theme",
    roomStyle: "Room style",
    turns: "Turns",
    upload: "Upload report / background file",
    uploadHelp:
      "Supports PDF, TXT, Markdown, JSON, CSV, and log files. Each file can be up to 5MB; PDFs are converted to text on the backend before grounding branch generation.",
    supplementalContext: "Supplemental context",
    supplementalPlaceholder:
      "Paste real background that the simulation should consider.\nExample: My manager expects visible AI adoption this quarter; I have mortgage pressure; I am comparing an internal platform role with a startup offer.",
    supplementalHelp:
      "These materials are saved as grounding sources and converted into reusable facts that influence later branch generation.",
    userGoal: "User goal",
    currentPosition: "Current position",
    riskPreference: "Risk preference",
    timeHorizon: "Time horizon",
    personalConstraints: "Personal constraints",
    keyStakeholders: "Key stakeholders",
    safetyLabel: "Use boundary",
    safety:
      "xMocha is for reflection and scenario simulation. It does not provide medical, legal, financial, or mental health advice.",
    privacyLabel: "Privacy reminder",
    privacy:
      "Your input is sent to the selected AI model to generate the simulation. Contact details are only used for follow-up. Do not enter passwords, identity documents, or detailed financial or health records.",
    modelProvider: "LLM provider",
    modelName: "Model name",
    modelHelp:
      "Server default uses environment config. Override provider/model only for local development or model comparison.",
    generating: "Generating...",
    retry: "Generation failed. Retry",
    remove: "Remove",
    uploadExtracting: "Reading file...",
    uploadAdded: (count) => `Added ${count} background file${count === 1 ? "" : "s"}.`,
    uploadTooLarge: (name) =>
      `"${name}" is larger than 5MB. Please compress it or extract the key parts first.`,
    uploadEmpty: "The uploaded file did not contain readable text.",
    uploadReadFailed:
      "Failed to read the file. Please upload a text-based PDF, UTF-8 text, Markdown, JSON, CSV, or log file.",
    uploadMeta: (source) =>
      [
        source.kind.toUpperCase(),
        formatBytes(source.size),
        source.pageCount ? `${source.pageCount} pages` : null,
        `${source.extractedCharacters ?? source.content.length} chars extracted`,
      ].filter(Boolean).join(" · "),
    inputRequired: "Enter a decision, or click one of the examples below to test.",
    startFailed: "Failed to start session.",
    unknownStartError: "Unknown error while starting the session.",
    themeOptions: {
      adventure: "Adventure",
      "sci-fi": "Sci-fi",
      dream: "Dream",
      hell: "High pressure",
      humorous: "Humorous",
    },
    visualStyleOptions: {
      "career-studio": "Career studio",
      "city-apartment": "City apartment",
      "night-cafe": "Night cafe",
    },
    riskOptions: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
  },
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#08111f",
  color: "#eef4ff",
};

const shellStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "28px 20px 72px",
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 18,
  alignItems: "start",
};

const panelStyle: CSSProperties = {
  background: "#121a31",
  border: "1px solid #24304f",
  borderRadius: 10,
  padding: 20,
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #314265",
  background: "#0f172a",
  color: "#f3f4f6",
  padding: "12px 14px",
  marginTop: 8,
};

const buttonStyle: CSSProperties = {
  borderRadius: 10,
  border: 0,
  background: "#60a5fa",
  color: "#08111f",
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#17243a",
  border: "1px solid #314d75",
  color: "#dbeafe",
};

const chipStyle: CSSProperties = {
  ...secondaryButtonStyle,
  padding: "8px 10px",
  borderRadius: 999,
  fontSize: 13,
};

const mutedStyle: CSSProperties = {
  color: "#a9bddb",
};

async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const text = await response.text();

  if (!text) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function storeSessionAccessToken(sessionId: string, accessToken?: string): void {
  if (typeof window === "undefined" || !accessToken?.trim()) return;
  window.sessionStorage.setItem(
    `xmocha-session-token:${sessionId}`,
    accessToken.trim(),
  );
}

export default function HomePage() {
  const router = useRouter();
  const [presetScenarioId, setPresetScenarioId] =
    useState<PresetScenarioId>("none");
  const [dilemma, setDilemma] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>("en");
  const [theme, setTheme] = useState("sci-fi");
  const [visualStyle, setVisualStyle] = useState("career-studio");
  const [maxTurns, setMaxTurns] = useState(3);
  const [modelSelection, setModelSelection] = useState<ModelSelection>({
    provider: "default",
    model: "",
  });
  const [userGoal, setUserGoal] = useState(defaultAiContext.en.userGoal);
  const [currentPosition, setCurrentPosition] = useState(
    defaultAiContext.en.currentPosition,
  );
  const [riskPreference, setRiskPreference] = useState("medium");
  const [timeHorizon, setTimeHorizon] = useState(
    defaultAiContext.en.timeHorizon,
  );
  const [personalConstraints, setPersonalConstraints] = useState(
    defaultAiContext.en.personalConstraints,
  );
  const [keyStakeholders, setKeyStakeholders] = useState(
    defaultAiContext.en.keyStakeholders,
  );
  const [userProvidedRawText, setUserProvidedRawText] = useState("");
  const [uploadedSources, setUploadedSources] = useState<UploadedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const copy = homeCopy[language];

  function handleLanguageChange(nextLanguage: OutputLanguage) {
    if (nextLanguage === language) {
      return;
    }

    const previousLanguage = language;
    const currentPreset = getPresetOption(presetScenarioId);
    const previousContext = defaultAiContext[previousLanguage];
    const nextContext = defaultAiContext[nextLanguage];

    setLanguage(nextLanguage);
    setUploadMessage(null);
    setDilemma((current) =>
      current.trim() === currentPreset.dilemma[previousLanguage]
        ? currentPreset.dilemma[nextLanguage]
        : current,
    );

    if (presetScenarioId === "ai_future_of_work") {
      setUserGoal((current) =>
        current === previousContext.userGoal ? nextContext.userGoal : current,
      );
      setCurrentPosition((current) =>
        current === previousContext.currentPosition
          ? nextContext.currentPosition
          : current,
      );
      setTimeHorizon((current) =>
        current === previousContext.timeHorizon ? nextContext.timeHorizon : current,
      );
      setPersonalConstraints((current) =>
        current === previousContext.personalConstraints
          ? nextContext.personalConstraints
          : current,
      );
      setKeyStakeholders((current) =>
        current === previousContext.keyStakeholders
          ? nextContext.keyStakeholders
          : current,
      );
    }
  }

  function applyPreset(nextId: PresetScenarioId) {
    const option = getPresetOption(nextId);
    setPresetScenarioId(nextId);
    setDilemma(nextId === "none" ? "" : option.dilemma[language]);
    setTheme(option.theme);
    setError(null);

    if (nextId === "ai_future_of_work") {
      setUserGoal(defaultAiContext[language].userGoal);
      setCurrentPosition(defaultAiContext[language].currentPosition);
      setRiskPreference("medium");
      setTimeHorizon(defaultAiContext[language].timeHorizon);
      setPersonalConstraints(defaultAiContext[language].personalConstraints);
      setKeyStakeholders(defaultAiContext[language].keyStakeholders);
    }
  }

  function useExampleDilemma(example: string) {
    setPresetScenarioId("none");
    setDilemma(example);
    setError(null);
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setError(null);
    setUploadMessage(null);

    const oversized = files.find((file) => file.size > maxUploadBytes);
    if (oversized) {
      setError(copy.uploadTooLarge(oversized.name));
      return;
    }

    setIsUploading(true);
    setUploadMessage(copy.uploadExtracting);

    try {
      const nextSources = await Promise.all(
        files.map((file) => extractUploadedSource(file, language, copy.uploadReadFailed)),
      );
      const usableSources = nextSources.filter((source) => source.content.trim());

      if (usableSources.length === 0) {
        setError(copy.uploadEmpty);
        return;
      }

      setUploadedSources((current) => [...current, ...usableSources]);
      setUploadMessage(copy.uploadAdded(usableSources.length));

      const firstDilemma = extractDilemmaCandidate(usableSources[0].content);
      const currentPreset = getPresetOption(presetScenarioId);
      if (
        firstDilemma &&
        (!dilemma.trim() || dilemma.trim() === currentPreset.dilemma[language])
      ) {
        setDilemma(firstDilemma);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : copy.uploadReadFailed,
      );
      setUploadMessage(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedDilemma = dilemma.trim();
    if (!trimmedDilemma) {
      setError(copy.inputRequired);
      return;
    }

    if (isUploading) {
      setError(copy.uploadExtracting);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dilemma: trimmedDilemma,
          theme,
          language,
          visualMode: "avatar-room",
          visualStyle,
          modelConfig: modelConfigFromSelection(modelSelection),
          maxTurns,
          presetScenarioId: presetScenarioId === "none" ? undefined : presetScenarioId,
          userContextPack:
            presetScenarioId === "ai_future_of_work"
              ? {
                  userGoal,
                  currentPosition,
                  riskPreference,
                  timeHorizon,
                  personalConstraints: splitLines(personalConstraints),
                  keyStakeholders: splitLines(keyStakeholders),
                }
              : undefined,
          userProvidedData:
            userProvidedRawText.trim() || uploadedSources.length > 0
              ? {
                  rawText: userProvidedRawText.trim() || undefined,
                  sources: uploadedSources.map((source) => ({
                    title: source.title,
                    kind: source.kind,
                    content: source.content,
                  })),
                }
              : undefined,
        }),
      });

      const data = await readJsonResponse<
        | { sessionId: string; accessToken?: string }
        | { error: string }
      >(response, copy.startFailed);

      if (!response.ok || !("sessionId" in data)) {
        throw new Error("error" in data ? data.error : copy.startFailed);
      }

      storeSessionAccessToken(data.sessionId, data.accessToken);
      router.push(`/session/${data.sessionId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : copy.unknownStartError,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <strong style={{ color: "#f8fafc", fontSize: 18 }}>{copy.eyebrow}</strong>
            <Link href="/world" style={{ color: "#5eead4", textDecoration: "none", fontWeight: 800 }}>
              {language === "zh-CN" ? "世界模式" : "World Mode"}
            </Link>
          </div>
          <div
            aria-label="Language switch"
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              border: "1px solid #314265",
              borderRadius: 12,
              background: "#0f172a",
            }}
          >
            {[
              { value: "zh-CN", label: "中文" },
              { value: "en", label: "EN" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleLanguageChange(option.value as OutputLanguage)}
                style={{
                  ...secondaryButtonStyle,
                  padding: "8px 11px",
                  background: language === option.value ? "#60a5fa" : "transparent",
                  border: 0,
                  color: language === option.value ? "#08111f" : "#dbeafe",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <section
          aria-label={language === "zh-CN" ? "选择体验模式" : "Choose experience mode"}
          style={{
            ...panelStyle,
            marginBottom: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            background: "linear-gradient(135deg, #111d35, #0d2633)",
          }}
        >
          <div style={{ padding: 4 }}>
            <p style={{ margin: "0 0 6px", color: "#93c5fd", fontWeight: 900 }}>
              DECISION MODE
            </p>
            <strong>
              {language === "zh-CN" ? "模拟现实决策" : "Simulate a real decision"}
            </strong>
            <p style={{ ...mutedStyle, marginBottom: 0, lineHeight: 1.5 }}>
              {language === "zh-CN"
                ? "输入现实困境，比较不同选择的未来影响。"
                : "Enter a real dilemma and compare possible futures."}
            </p>
          </div>
          <Link
            href="/world"
            style={{
              display: "block",
              padding: 16,
              border: "1px solid rgba(94, 234, 212, 0.55)",
              borderRadius: 10,
              background: "rgba(20, 184, 166, 0.1)",
              color: "#ecfeff",
              textDecoration: "none",
            }}
          >
            <p style={{ margin: "0 0 6px", color: "#5eead4", fontWeight: 900 }}>
              WORLD MODE · BETA →
            </p>
            <strong>
              {language === "zh-CN" ? "进入故事世界" : "Enter a story world"}
            </strong>
            <p style={{ color: "#b8cae4", marginBottom: 0, lineHeight: 1.5 }}>
              {language === "zh-CN"
                ? "体验《红楼梦》《山海经》或《奥德赛》示例，或用原创/公版短文本创建世界。"
                : "Play Red Chamber, Shanhai Jing, or Odyssey, or compile original/public-domain text."}
            </p>
          </Link>
        </section>

        <div style={heroGridStyle}>
          <section style={{ ...panelStyle, padding: 22 }}>
            <p style={{ margin: "0 0 8px", color: "#5eead4", fontWeight: 900 }}>
              {copy.eyebrow}
            </p>
            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(30px, 4.8vw, 52px)",
                lineHeight: 1.04,
                letterSpacing: 0,
              }}
            >
              {copy.headline}
            </h1>
            <p style={{ ...mutedStyle, margin: "0 0 16px", lineHeight: 1.5 }}>
              {copy.intro}
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="decision-input" style={{ fontWeight: 800 }}>
                {copy.inputLabel}
              </label>
              <textarea
                id="decision-input"
                aria-describedby="decision-input-help"
                rows={4}
                style={{
                  ...inputStyle,
                  marginTop: 10,
                  fontSize: 16,
                  lineHeight: 1.45,
                  minHeight: 150,
                  maxHeight: 190,
                  resize: "vertical",
                }}
                value={dilemma}
                onChange={(event) => setDilemma(event.target.value)}
                placeholder={copy.inputPlaceholder}
              />
              <p
                id="decision-input-help"
                style={{
                  ...mutedStyle,
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.45,
                  margin: "8px 0 0",
                }}
              >
                {copy.inputHelp}
              </p>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  useExampleDilemma(copy.examples[0]);
                }}
                onClick={() => useExampleDilemma(copy.examples[0])}
                style={{
                  ...chipStyle,
                  marginTop: 8,
                  background: "#17243a",
                }}
              >
                {copy.inputExampleCta}
              </button>

              <div
                role="note"
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  border: "1px solid rgba(94, 234, 212, 0.34)",
                  borderLeft: "3px solid #5eead4",
                  borderRadius: 6,
                  background: "rgba(20, 184, 166, 0.08)",
                  color: "#d5faf4",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <strong>{copy.privacyLabel}{language === "zh-CN" ? "：" : ":"}</strong> {copy.privacy}
              </div>

              {error ? (
                <p style={{ color: "#fda4af", margin: "10px 0 0" }}>{error}</p>
              ) : null}

              <div style={{ marginTop: 14 }}>
                <button
                  style={{
                    ...buttonStyle,
                    width: "100%",
                    fontSize: 16,
                    padding: "13px 16px",
                  }}
                  type="submit"
                  disabled={isLoading || isUploading}
                >
                  {isUploading ? copy.uploadExtracting : isLoading ? copy.generating : error ? copy.retry : copy.cta}
                </button>
                <p style={{ ...mutedStyle, margin: "8px 0 0", textAlign: "center" }}>
                  {copy.ctaHint}
                </p>
                <Link
                  href="/world"
                  style={{
                    ...secondaryButtonStyle,
                    display: "block",
                    marginTop: 10,
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  {copy.worldDemoCta}
                </Link>
                <p style={{ ...mutedStyle, margin: "8px 0 0", textAlign: "center", fontSize: 13 }}>
                  {copy.worldDemoHint}
                </p>
                <div
                  role="note"
                  style={{
                    margin: "10px 0 0",
                    padding: "10px 12px",
                    border: "1px solid rgba(251, 191, 36, 0.34)",
                    borderLeft: "3px solid #fbbf24",
                    borderRadius: 6,
                    background: "rgba(245, 158, 11, 0.08)",
                    color: "#fef3c7",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <strong>{copy.safetyLabel}{language === "zh-CN" ? "：" : ":"}</strong> {copy.safety}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <p style={{ ...mutedStyle, margin: "0 0 8px", fontSize: 13 }}>
                  {copy.examplesTitle}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {copy.examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        useExampleDilemma(example);
                      }}
                      onClick={() => useExampleDilemma(example)}
                      style={chipStyle}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <p style={{ ...mutedStyle, margin: "0 0 8px", fontSize: 13 }}>
                  {copy.presetTitle}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {presetScenarioOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => applyPreset(option.id)}
                      style={{
                        ...chipStyle,
                        background:
                          presetScenarioId === option.id ? "#5eead4" : "#17243a",
                        color:
                          presetScenarioId === option.id ? "#062423" : "#dbeafe",
                      }}
                    >
                      {option.label[language]}
                    </button>
                  ))}
                </div>
                <p style={{ ...mutedStyle, margin: "8px 0 0", fontSize: 13 }}>
                  {getPresetOption(presetScenarioId).description[language]}
                </p>
              </div>

              <details
                style={{
                  marginTop: 20,
                  border: "1px solid #314265",
                  borderRadius: 10,
                  background: "#0f172a",
                  padding: 14,
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                  {copy.advancedTitle}
                  <span style={{ ...mutedStyle, marginLeft: 8, fontWeight: 500 }}>
                    {copy.advancedHint}
                  </span>
                </summary>

                <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
                  <div
                    style={{
                      border: "1px solid #314265",
                      borderRadius: 10,
                      background: "#091324",
                      padding: 12,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <ModelSelector
                      language={language}
                      mode="decision"
                      value={modelSelection}
                      onChange={setModelSelection}
                      title={copy.modelSettingsTitle}
                      hint={copy.modelSettingsHint}
                      providerLabel={copy.modelProvider}
                      modelLabel={copy.modelName}
                      help={copy.modelHelp}
                      inputStyle={inputStyle}
                      mutedStyle={mutedStyle}
                      buttonStyle={secondaryButtonStyle}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 16,
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    }}
                  >
                    <label>
                      {copy.theme}
                      <select
                        style={inputStyle}
                        value={theme}
                        onChange={(event) => setTheme(event.target.value)}
                      >
                        <option value="adventure">
                          {copy.themeOptions.adventure}
                        </option>
                        <option value="sci-fi">{copy.themeOptions["sci-fi"]}</option>
                        <option value="dream">{copy.themeOptions.dream}</option>
                        <option value="hell">{copy.themeOptions.hell}</option>
                        <option value="humorous">{copy.themeOptions.humorous}</option>
                      </select>
                    </label>

                    <label>
                      {copy.roomStyle}
                      <select
                        style={inputStyle}
                        value={visualStyle}
                        onChange={(event) => setVisualStyle(event.target.value)}
                      >
                        <option value="career-studio">
                          {copy.visualStyleOptions["career-studio"]}
                        </option>
                        <option value="city-apartment">
                          {copy.visualStyleOptions["city-apartment"]}
                        </option>
                        <option value="night-cafe">
                          {copy.visualStyleOptions["night-cafe"]}
                        </option>
                      </select>
                    </label>

                    <label>
                      {copy.turns}
                      <input
                        style={inputStyle}
                        type="number"
                        min={1}
                        max={5}
                        value={maxTurns}
                        onChange={(event) => setMaxTurns(Number(event.target.value) || 3)}
                      />
                    </label>
                  </div>

                  {presetScenarioId === "ai_future_of_work" ? (
                    <div style={{ display: "grid", gap: 14 }}>
                      <label>
                        {copy.userGoal}
                        <input
                          style={inputStyle}
                          value={userGoal}
                          onChange={(event) => setUserGoal(event.target.value)}
                        />
                      </label>

                      <label>
                        {copy.currentPosition}
                        <input
                          style={inputStyle}
                          value={currentPosition}
                          onChange={(event) => setCurrentPosition(event.target.value)}
                        />
                      </label>

                      <div
                        style={{
                          display: "grid",
                          gap: 16,
                          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        }}
                      >
                        <label>
                          {copy.riskPreference}
                          <select
                            style={inputStyle}
                            value={riskPreference}
                            onChange={(event) => setRiskPreference(event.target.value)}
                          >
                            <option value="low">{copy.riskOptions.low}</option>
                            <option value="medium">{copy.riskOptions.medium}</option>
                            <option value="high">{copy.riskOptions.high}</option>
                          </select>
                        </label>

                        <label>
                          {copy.timeHorizon}
                          <input
                            style={inputStyle}
                            value={timeHorizon}
                            onChange={(event) => setTimeHorizon(event.target.value)}
                          />
                        </label>
                      </div>

                      <label>
                        {copy.personalConstraints}
                        <textarea
                          rows={3}
                          style={inputStyle}
                          value={personalConstraints}
                          onChange={(event) =>
                            setPersonalConstraints(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        {copy.keyStakeholders}
                        <textarea
                          rows={3}
                          style={inputStyle}
                          value={keyStakeholders}
                          onChange={(event) => setKeyStakeholders(event.target.value)}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div
                    style={{
                      border: "1px solid #314265",
                      borderRadius: 10,
                      padding: 14,
                      background: "#091324",
                    }}
                  >
                    <label htmlFor="dilemma-file">
                      {copy.upload}
                      <input
                        id="dilemma-file"
                        type="file"
                        multiple
                        accept=".pdf,.txt,.md,.markdown,.json,.csv,.log,application/pdf,text/plain,text/markdown,application/json,text/csv"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        style={{ ...inputStyle, background: "#121a31" }}
                      />
                    </label>
                    <p style={{ ...mutedStyle, margin: "8px 0 0", fontSize: 13 }}>
                      {copy.uploadHelp}
                    </p>
                    {uploadMessage ? (
                      <p style={{ color: "#5eead4", margin: "8px 0 0" }}>
                        {uploadMessage}
                      </p>
                    ) : null}
                    {uploadedSources.length > 0 ? (
                      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                        {uploadedSources.map((source, index) => (
                          <div
                            key={`${source.title}-${index}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "center",
                              border: "1px solid #24304f",
                              borderRadius: 8,
                              padding: "8px 10px",
                              color: "#cbd5e1",
                            }}
                          >
                            <span style={{ minWidth: 0 }}>
                              <strong>{source.title}</strong>
                              <br />
                              <span style={{ ...mutedStyle, fontSize: 12 }}>
                                {copy.uploadMeta(source)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedSources((current) =>
                                  current.filter(
                                    (_, currentIndex) => currentIndex !== index,
                                  ),
                                )
                              }
                              style={{
                                ...secondaryButtonStyle,
                                padding: "6px 9px",
                                borderRadius: 8,
                              }}
                            >
                              {copy.remove}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <label>
                    {copy.supplementalContext}
                    <textarea
                      rows={5}
                      style={inputStyle}
                      value={userProvidedRawText}
                      onChange={(event) => setUserProvidedRawText(event.target.value)}
                      placeholder={copy.supplementalPlaceholder}
                    />
                  </label>
                  <p style={{ ...mutedStyle, margin: 0, fontSize: 13 }}>
                    {copy.supplementalHelp}
                  </p>
                </div>
              </details>
            </form>
          </section>

          <aside style={panelStyle}>
            <p style={{ margin: "0 0 12px", color: "#93c5fd", fontWeight: 900 }}>
              {copy.visualTitle}
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {copy.previewSteps.map((step, index) => (
                <div key={step} style={{ display: "grid", gap: 8 }}>
                  <div
                    style={{
                      border: "1px solid #314d75",
                      borderRadius: 8,
                      background: index === 1 ? "#10243b" : "#091324",
                      padding: "10px 12px",
                      fontWeight: 800,
                    }}
                  >
                    {step}
                  </div>
                  {index < copy.previewSteps.length - 1 ? (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 2,
                        height: 18,
                        background: "#5eead4",
                        opacity: 0.65,
                        marginLeft: 18,
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
                marginTop: 18,
              }}
            >
              {copy.previewCards.map((card, index) => (
                <div
                  key={card.title}
                  style={{
                    border: "1px solid #314d75",
                    borderRadius: 8,
                    background:
                      index === 0
                        ? "#0d2330"
                        : index === 1
                          ? "#2b1824"
                          : "#271f0f",
                    padding: 12,
                    minHeight: 126,
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 8 }}>
                    {card.title}
                  </strong>
                  <span style={{ ...mutedStyle, fontSize: 13, lineHeight: 1.45 }}>
                    {card.body}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

async function extractUploadedSource(
  file: File,
  language: OutputLanguage,
  fallbackMessage: string,
): Promise<UploadedSource> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", language);

  const response = await fetch("/api/session/extract-document", {
    method: "POST",
    body: formData,
  });
  const payload = await readJsonResponse<ExtractDocumentResponse>(
    response,
    fallbackMessage,
  );

  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : fallbackMessage);
  }

  return payload;
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPresetOption(id: PresetScenarioId) {
  return (
    presetScenarioOptions.find((option) => option.id === id) ??
    presetScenarioOptions[0]
  );
}

function detectSourceKind(file: File): UserProvidedSourceKind {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    return "pdf";
  }

  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    return "markdown";
  }

  if (lowerName.endsWith(".json") || file.type === "application/json") {
    return "json";
  }

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".log")) {
    return "text";
  }

  return "note";
}

function extractDilemmaCandidate(content: string): string | null {
  const candidate = content
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find((line) => line.length >= 12);

  if (!candidate) {
    return null;
  }

  return candidate.slice(0, 260);
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
