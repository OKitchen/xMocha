"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { inferDilemmaKindFromText } from "../../../src/domain/dilemma-kind";

type RiskProfile = "low" | "medium" | "high";
type Stance = "supportive" | "resistant" | "neutral" | "uncertain";
type VisualPosition =
  | "left"
  | "center"
  | "right"
  | "upper-left"
  | "upper-right"
  | "lower-left"
  | "lower-right";

type BranchData = {
  id: string;
  title: string;
  summary: string;
  consequence: string;
  riskProfile: RiskProfile;
  score?: number;
  timeHorizon?: string;
  keyUncertainty?: string;
};

type GenerationProgress = {
  selectedTitle: string;
  detail: string;
  tone: "loading" | "failed" | "success";
};

type WorldTraceRun = {
  traceId: string;
  turn: number;
  attempt: number;
  provider: string;
  model: string;
  promptStyle?: "full" | "lite";
  status: string;
  fallbackUsed: boolean;
  retryReason?: string;
  selectedCandidateId?: string;
  validationIssueCodes: string[];
  nodes: Array<{
    nodeId: string;
    parentNodeId?: string;
    kind: string;
    status: string;
    inputRefs: string[];
    outputRefs: string[];
    startedAt: string;
    durationMs: number;
    issueCodes: string[];
  }>;
  candidateStatePreviews: Array<{
    candidateId: string;
    parentRevision: number;
    previewRevision: number;
    activeCharacterIds: string[];
    worldFlags: string[];
    recentEvents: string[];
    pressureSnapshot?: Record<string, number>;
    eventQueueSnapshot?: Array<{
      id: string;
      dueTurn?: number;
      status: string;
      description: string;
    }>;
  }>;
};

type ContactIntent = "beta" | "partner" | "invest" | "resource";

type VisualScene = {
  mode: "avatar-room";
  style: "career-studio" | "city-apartment" | "night-cafe";
  turnNumber: number;
  avatar: {
    posture: string;
    expression: string;
    energy: number;
    stressSignal: string;
    focusAura: string;
  };
  room: {
    atmosphere: string;
    lighting: string;
    colorPalette: string[];
    objects: Array<{
      id: string;
      label: string;
      type: string;
      position: VisualPosition;
      state: string;
      description: string;
    }>;
    pressureIndicators: string[];
  };
  branchPortals: Array<{
    branchId: string;
    portalLabel: string;
    position: VisualPosition;
    color: string;
    symbol: string;
    motion: string;
    roomEffect: string;
  }>;
  stakeholders: Array<{
    stakeholderId: string;
    label: string;
    stance: Stance;
    position: VisualPosition;
    influence: number;
    mood: string;
  }>;
  collapseCue: "split" | "pull" | "echo" | "pressure-rise";
  caption: string;
};

type SessionPageData = {
  mode?: "decision" | "world";
  revision?: number;
  privateWorld?: boolean;
  sessionId: string;
  dilemma: string;
  language?: string;
  visualMode?: string;
  visualStyle?: string;
  theme: string;
  presetScenarioId?: string;
  modelConfig?: {
    provider: string;
    model?: string;
    turnSimulator?: string;
  };
  turn: number;
  maxTurns: number;
  status: string;
  worldExperiencePlan?: {
    primaryGoal: string;
    playerCharacterId: string;
    milestones: Array<{
      id: string;
      order: 1 | 2 | 3;
      description: string;
      status: "locked" | "active" | "achieved" | "failed";
      progressSignals: string[];
    }>;
  };
  worldRuntimeState?: {
    revision: number;
    checkpoint: string;
    currentLocationId: string;
    playerCharacter: {
      characterId: string;
      name: string;
      identity: string;
      currentGoal: string;
    };
    activeCharacterIds: string[];
    characterStates?: Array<{
      characterId: string;
      attitude: number;
      currentGoal: string;
      condition: string;
      lastInteraction?: string;
      knownFlags: string[];
    }>;
    recentEvents: string[];
    worldFlags: string[];
    worldPressure?: Record<string, number>;
    eventQueue?: Array<{
      id: string;
      dueTurn?: number;
      visibility: "public" | "private" | "rumor";
      severity: number;
      status: "scheduled" | "active" | "resolved" | "expired";
      description: string;
    }>;
    milestones: Array<{
      id: string;
      order: 1 | 2 | 3;
      description: string;
      status: "locked" | "active" | "achieved" | "failed";
      progressSignals: string[];
    }>;
  };
  pendingWorldTurn?: {
    turnNumber: number;
    stateRevision: number;
    visibleScene: string;
  };
  quantumTrace: string[];
  influenceEvents?: Array<{
    id: string;
    turn: number;
    branchId: string;
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    dimension: string;
    direction: string;
    intensity: number;
    explanation: string;
  }>;
  simulationState?: {
    scope: string;
    individual: {
      skills: Record<string, number>;
      confidence: number;
      reputation: number;
      trust: number;
      financialStability: number;
      stress: number;
      riskTolerance: number;
      identity: string[];
    };
    stakeholders: Array<{
      id: string;
      role: string;
      stance: Stance;
      trust: number;
      resistance: number;
      influence: number;
      currentGoal: string;
    }>;
    environmentMetrics: Record<string, number>;
    updatedAtTurn: number;
  };
  userAuthoredActions: Array<{
    turn: number;
    title: string;
    rawInput: string;
    riskProfile: string;
    anchorBranchId?: string;
  }>;
  visualHistory?: Array<{
    turn: number;
    selectedBranchId: string;
    selectedBranchTitle: string;
    memoryLabel: string;
    shadowLabels: string[];
    scene: VisualScene;
  }>;
  userContextPack?: {
    userGoal: string;
    currentPosition: string;
    riskPreference: string;
    timeHorizon: string;
    personalConstraints: string[];
    keyStakeholders: string[];
    successCriteria: string[];
  };
  userProvidedData?: {
    sources: Array<{
      id: string;
      kind: string;
      title: string;
      content: string;
    }>;
    factItems: Array<{
      id: string;
      type: string;
      summary: string;
      confidence: number;
      userConfirmed: boolean;
    }>;
    derivedBrief: {
      userIntentSummary?: string;
      keyConstraints: string[];
      keyStakeholders: string[];
      activeOptions: string[];
      decisionPressures: string[];
      openQuestions: string[];
    };
  };
  groundingLog: Array<{
    turn: number;
    selectedBranchId: string;
    selectedBranchTitle: string;
    groundingContext: {
      presetScenarioId?: string;
      scenarioTitle?: string;
      worldFactsUsed: string[];
      socialTensionsUsed: string[];
      roleCastUsed: Array<{
        role: string;
        relationship: string;
        baselineStance: string;
      }>;
      userContextSummary?: {
        userGoal: string;
        currentPosition: string;
        riskPreference: string;
        timeHorizon: string;
        personalConstraints: string[];
        keyStakeholders: string[];
        successCriteria: string[];
      };
      userProvidedDataSummary?: {
        sourceCount: number;
        factCount: number;
        topFacts: Array<{
          type: string;
          summary: string;
        }>;
        derivedBrief: {
          userIntentSummary?: string;
          keyConstraints: string[];
          keyStakeholders: string[];
          activeOptions: string[];
          decisionPressures: string[];
          openQuestions: string[];
        };
      };
      worldContextSummary: {
        setting: string;
        externalConditions: string;
        currentWorldPressure: string;
      };
    };
  }>;
  generationFailures?: Array<{
    timestamp: string;
    stage: string;
    turn: number;
    message: string;
    recoverable: boolean;
    fallbackUsed: boolean;
    selectedBranchTitle?: string;
  }>;
  analyticsEvents?: Array<{
    timestamp: string;
    name: string;
    turn: number;
    metadata?: Record<string, string | number | boolean>;
  }>;
  canonicalPath: Array<{
    id?: string;
    turn: number;
    title: string;
    summary?: string;
    consequence: string;
    keyUncertainty?: string;
    riskProfile?: RiskProfile;
  }>;
  shadowTimelines: Array<
    Array<{
      turn: number;
      title: string;
      consequence: string;
      riskProfile?: RiskProfile;
    }>
  >;
  pendingTurn?: {
    turnNumber: number;
    agentTrace?: {
      provider: string;
      model: string;
      observerState: string;
      environmentPressure: string;
      generativeSteps: string[];
      deterministicSteps: string[];
      humanMovement: string[];
      environmentDynamics: string[];
    };
    branches: BranchData[];
    branchWorldDeltas: Array<{
      branchId: string;
      activatedConstraints: string[];
      activatedOpportunities: string[];
      pressureShift: string;
    }>;
    branchCommunities: Array<{
      branchId: string;
      agents: Array<{
        role: string;
        stance: Stance;
        motivation: string;
        influence: number;
        reaction: string;
      }>;
      socialDynamics: string;
      dominantNarrative: string;
    }>;
    influenceEvents: NonNullable<SessionPageData["influenceEvents"]>;
    visualScene?: VisualScene;
    groundingContext?: {
      presetScenarioId?: string;
      scenarioTitle?: string;
      worldFactsUsed: string[];
      socialTensionsUsed: string[];
      roleCastUsed: Array<{
        role: string;
        relationship: string;
        baselineStance: string;
      }>;
      userContextSummary?: {
        userGoal: string;
        currentPosition: string;
        riskPreference: string;
        timeHorizon: string;
        personalConstraints: string[];
        keyStakeholders: string[];
        successCriteria: string[];
      };
      userProvidedDataSummary?: {
        sourceCount: number;
        factCount: number;
        topFacts: Array<{
          type: string;
          summary: string;
        }>;
      };
      worldContext: {
        setting: string;
        externalConditions: string;
        currentWorldPressure: string;
        constraints: string[];
        opportunities: string[];
        stableRules: string[];
      };
    };
  };
  summary?: {
    narrative: string;
    decisionArc: string[];
    alternateHint?: string;
  };
};

type AblationReportData = {
  reportVersion: string;
  sessionId: string;
  turns: number;
  influenceEventCount: number;
  headlineInsights: string[];
  runs: Array<{
    mode: string;
    label: string;
    includedEventCount: number;
    metrics: {
      individual: Record<string, number>;
      society: Record<string, number>;
      environment: Record<string, number>;
    };
    deltaFromFull?: {
      totalDistance: number;
    };
  }>;
};

type ActiveTab = "room" | "timeline" | "evidence" | "engine";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#08111f",
  color: "#eef4ff",
};

const shellStyle: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  padding: "26px 18px 80px",
};

const panelStyle: CSSProperties = {
  border: "1px solid #263b60",
  borderRadius: 8,
  background: "#0f1b31",
  padding: 16,
};

const buttonStyle: CSSProperties = {
  borderRadius: 8,
  border: 0,
  background: "#5eead4",
  color: "#062423",
  padding: "10px 13px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#17243a",
  border: "1px solid #314d75",
  color: "#dbeafe",
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid #314d75",
  background: "#091324",
  color: "#e2e8f0",
  padding: "10px 11px",
};

const mutedStyle: CSSProperties = {
  color: "#a9bddb",
};

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "room", label: "Room" },
  { id: "timeline", label: "Timeline" },
  { id: "evidence", label: "Evidence" },
  { id: "engine", label: "Engine" },
];

const sessionCopy = {
  "zh-CN": {
    downloadReport: "下载报告",
    replay: "结果回放",
    loading: "正在加载会话...",
    roomEyebrow: "多模态人生模拟房间",
    tabs: {
      room: "房间",
      timeline: "时间线",
      evidence: "证据",
      engine: "引擎",
    },
    statusTurn: "轮次",
    roomInitializing: "房间初始化中",
    roomPending: "下一组分支生成后，房间会在这里出现。",
    roomComplete: "这条现实已经完成。查看时间线或结果报告获取总结。",
    roomWaiting: "等待下一组分支生成 Avatar/Room 场景。",
    observer: "观察者",
    portal: "门户",
    showLess: "收起",
    showFullBranch: "查看完整信息",
    branchSummary: "摘要",
    branchConsequence: "结果",
    branchUncertainty: "关键不确定性",
    branchHorizon: "时间范围",
    collapsing: "坍缩中...",
    collapseFuture: "坍缩这条未来",
    selectedPrefix: "已选择",
    generatingNext: "正在生成下一轮未来...",
    modelTimeoutSaved: "模型响应超时。你的选择已保存，可以重试生成下一轮。",
    retryNext: "重试生成下一轮",
    retryingNext: "正在重新生成下一轮未来...",
    shadowShelf: "影子架",
    shadowEmpty: "未选路径会在第一次坍缩后出现在这里。",
    latestMemory: "最新视觉记忆",
    statsTitle: "生命状态",
    confidence: "信心",
    stress: "压力",
    adaptation: "适应",
    risk: "风险",
    world: "世界",
    pressure: "压力",
    opportunity: "机会",
    noSimulationState: "还没有模拟状态。",
    manualTitle: "手动行动",
    manualDescription: "当门户没有覆盖你的真实选择时，写下你自己的行动。",
    manualPlaceholder:
      "例如：和经理协商 3 个月过渡期，同时周末测试新的 AI-native 工作方向",
    riskProfile: "风险画像",
    anchorPortal: "关联门户",
    none: "无",
    submitting: "提交中...",
    commitManualAction: "提交手动行动",
    finalReport: "最终报告",
    summaryPending: "路径完成后会出现总结。",
    timelineTitle: "你的坍缩时间线",
    noCollapse: "还没有坍缩选择。请先选择一个房间门户。",
    turn: "第",
    turnSuffix: "轮",
    visualMemories: "视觉记忆",
    visualHistoryEmpty: "第一次坍缩后会开始记录视觉历史。",
    room: "房间",
    shadowTimelines: "影子时间线",
    noShadowsArchived: "还没有归档的影子路径。",
    shadows: "影子路径",
    finalReflection: "最终反思",
    resultActions: "结果操作",
    startAnotherDilemma: "开始另一个困境",
    shareResult: "复制分享图片",
    shareCopied: "分享图片已复制。",
    shareCopyFallback: "当前浏览器不支持复制图片，已下载分享图片。",
    shareCardTitle: "分享图片预览",
    shareCardPreview: "图片里包含冒险信息，发出去后不需要点链接也能读懂。",
    privateWorldShareNote: "这是私人上传世界。分享图片会展示本次章节结果；若图片内含链接，收到链接的人也可以查看这次结果。",
    privateWorldShareMissingToken: "缺少私人章节访问凭证，暂时无法生成公开分享链接。请从创建该章节的浏览器打开后再分享。",
    feedbackTitle: "帮助我们判断 xMocha 是否有价值",
    feedbackIntro: "只需要回答两个问题。",
    helpfulQuestion: "这个结果对你有帮助吗？",
    helpfulYes: "是",
    helpfulNo: "否",
    recommendationQuestion: "你愿意把它推荐给朋友吗？",
    recommendationLow: "完全不愿意",
    recommendationHigh: "非常愿意",
    feedbackSubmit: "提交反馈",
    feedbackSubmitting: "提交中...",
    feedbackSubmitted: "感谢反馈，已记录。",
    feedbackRequired: "请先选择这个结果是否有帮助。",
    feedbackFailed: "反馈提交失败，请重试。",
    feedbackPrivacy: "反馈仅用于改进产品，不会显示在分享结果中。",
    contactTitle: "想继续使用 xMocha？",
    contactPlaceholder: "留下邮箱、微信或其他联系方式",
    contactMessagePlaceholder: "可选：你希望我们如何联系你，或你想补充什么？",
    contactSubmit: "提交",
    contactSubmitting: "提交中...",
    contactSubmitted: "已收到，我们会尽快联系你。",
    contactRequired: "请先填写联系方式。",
    contactPrivacy: "联系方式仅用于内测、合作或资源对接，不会显示在分享结果中。",
    requestFailed: "服务暂时不可用，请重试。",
    operationFailed: "请求失败。刷新页面可从最近保存的进度恢复。",
    contactOptions: {
      beta: "我愿意参与内测",
      partner: "我想合作",
      invest: "我想投资",
      resource: "我可以提供资源",
    },
  },
  en: {
    downloadReport: "Download report",
    replay: "Result replay",
    loading: "Loading session...",
    roomEyebrow: "Multimodal Life Sim Room",
    tabs: {
      room: "Room",
      timeline: "Timeline",
      evidence: "Evidence",
      engine: "Engine",
    },
    statusTurn: "Turn",
    roomInitializing: "Room initializing",
    roomPending: "The next room appears after turn generation.",
    roomComplete: "This reality is complete. Check Timeline or Evidence for the summary.",
    roomWaiting: "Waiting for the next branches to generate an Avatar/Room scene.",
    observer: "Observer",
    portal: "portal",
    showLess: "Show less",
    showFullBranch: "Show full details",
    branchSummary: "Summary",
    branchConsequence: "Consequence",
    branchUncertainty: "Key uncertainty",
    branchHorizon: "Time horizon",
    collapsing: "Collapsing...",
    collapseFuture: "Collapse this future",
    selectedPrefix: "Selected",
    generatingNext: "Generating the next futures...",
    modelTimeoutSaved:
      "The model response timed out. Your choice is saved, and you can retry next-turn generation.",
    retryNext: "Retry next turn",
    retryingNext: "Regenerating the next futures...",
    shadowShelf: "Shadow shelf",
    shadowEmpty: "Unchosen paths appear here after the first collapse.",
    latestMemory: "Latest visual memory",
    statsTitle: "Life stats",
    confidence: "Confidence",
    stress: "Stress",
    adaptation: "Adaptation",
    risk: "Risk",
    world: "World",
    pressure: "Pressure",
    opportunity: "Opportunity",
    noSimulationState: "No simulation state yet.",
    manualTitle: "Manual action",
    manualDescription:
      "Write your own move when the portals miss what you would actually do.",
    manualPlaceholder:
      "Example: negotiate a 3-month transition while testing the new direction on weekends.",
    riskProfile: "Risk profile",
    anchorPortal: "Anchor portal",
    none: "None",
    submitting: "Submitting...",
    commitManualAction: "Commit manual action",
    finalReport: "Final report",
    summaryPending: "Summary will appear when the path completes.",
    timelineTitle: "Your collapsed timeline",
    noCollapse: "No collapse yet. Choose a room portal first.",
    turn: "Turn",
    turnSuffix: "",
    visualMemories: "Visual memories",
    visualHistoryEmpty: "Visual history begins after the first collapse.",
    room: "Room",
    shadowTimelines: "Shadow timelines",
    noShadowsArchived: "No shadows archived yet.",
    shadows: "shadows",
    finalReflection: "Final reflection",
    resultActions: "Result actions",
    startAnotherDilemma: "Start another dilemma",
    shareResult: "Copy share image",
    shareCopied: "Share image copied.",
    shareCopyFallback: "This browser cannot copy images, so the share image was downloaded.",
    shareCardTitle: "Share image preview",
    shareCardPreview: "The image contains the adventure summary, so people can read it without opening a link.",
    privateWorldShareNote: "This is a private uploaded world. The image shows this chapter result; if it includes a link, anyone with the link can view the result.",
    privateWorldShareMissingToken: "Missing the private chapter access token, so a public share link cannot be generated from this browser.",
    feedbackTitle: "Help us understand whether xMocha is useful",
    feedbackIntro: "Two quick questions only.",
    helpfulQuestion: "Was this result helpful?",
    helpfulYes: "Yes",
    helpfulNo: "No",
    recommendationQuestion: "How likely are you to recommend it to a friend?",
    recommendationLow: "Not likely",
    recommendationHigh: "Very likely",
    feedbackSubmit: "Submit feedback",
    feedbackSubmitting: "Submitting...",
    feedbackSubmitted: "Thank you. Your feedback was recorded.",
    feedbackRequired: "Please tell us whether the result was helpful.",
    feedbackFailed: "Failed to submit feedback. Please retry.",
    feedbackPrivacy: "Feedback is used to improve the product and is not shown in shared results.",
    contactTitle: "Want to keep using xMocha?",
    contactPlaceholder: "Leave your email, WeChat, or another contact",
    contactMessagePlaceholder: "Optional: how should we contact you, or what should we know?",
    contactSubmit: "Submit",
    contactSubmitting: "Submitting...",
    contactSubmitted: "Received. We will contact you soon.",
    contactRequired: "Please enter a contact first.",
    contactPrivacy:
      "Your contact is only used for beta, partnership, or resource follow-up and is never shown in shared results.",
    requestFailed: "The service is temporarily unavailable. Please retry.",
    operationFailed:
      "The request failed. Reload to resume from the latest saved progress.",
    contactOptions: {
      beta: "I want to join beta",
      partner: "I want to partner",
      invest: "I want to invest",
      resource: "I can provide resources",
    },
  },
} as const;

function getSessionCopy(language?: string) {
  return language === "zh-CN" ? sessionCopy["zh-CN"] : sessionCopy.en;
}

function worldTokenForSession(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(`xmocha-session-token:${sessionId}`) ??
    window.sessionStorage.getItem(`xmocha-world-token:${sessionId}`);
}

function storeWorldTokenForSession(sessionId: string, token: string): void {
  if (typeof window === "undefined" || !token.trim()) return;
  window.sessionStorage.setItem(`xmocha-session-token:${sessionId}`, token.trim());
  window.sessionStorage.setItem(`xmocha-world-token:${sessionId}`, token.trim());
}

function worldTokenFromCurrentUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("sessionToken")?.trim() ||
    params.get("worldToken")?.trim() ||
    null;
}

function sessionRequestHeaders(sessionId: string): HeadersInit {
  const token = worldTokenForSession(sessionId);
  return token
    ? {
        "x-xmocha-session-token": token,
        "x-xmocha-world-token": token,
      }
    : {};
}

function buildPublicSessionShareUrl(session: SessionPageData, sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(`/session/${encodeURIComponent(sessionId)}`, window.location.origin);
  if (session.privateWorld) {
    const token = worldTokenForSession(sessionId);
    if (!token) return null;
    url.searchParams.set("sessionToken", token);
  }
  return url.toString();
}

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

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [session, setSession] = useState<SessionPageData | null>(null);
  const [ablationReport, setAblationReport] =
    useState<AblationReportData | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("room");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingBranchId, setSubmittingBranchId] = useState<string | null>(null);
  const [customActionInput, setCustomActionInput] = useState("");
  const [customRiskProfile, setCustomRiskProfile] = useState<RiskProfile>("medium");
  const [customAnchorBranchId, setCustomAnchorBranchId] = useState("");
  const [generationProgress, setGenerationProgress] =
    useState<GenerationProgress | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareResultUrl, setShareResultUrl] = useState("");
  const [worldTraceRuns, setWorldTraceRuns] = useState<WorldTraceRun[] | null>(null);
  const [worldTraceError, setWorldTraceError] = useState<string | null>(null);
  const copy = getSessionCopy(session?.language);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setShareResultUrl(new URL(`/session/${encodeURIComponent(sessionId)}`, window.location.origin).toString());
  }, [sessionId]);

  useEffect(() => {
    async function loadSession() {
      setIsLoading(true);
      setError(null);

      try {
        const sharedWorldToken = worldTokenFromCurrentUrl();
        if (sharedWorldToken) {
          storeWorldTokenForSession(sessionId, sharedWorldToken);
        }
        const response = await fetch(`/api/session/${sessionId}`, {
          cache: "no-store",
          headers: sessionRequestHeaders(sessionId),
        });
        const data = await readJsonResponse<SessionPageData | { error: string }>(
          response,
          sessionCopy["zh-CN"].requestFailed,
        );

        if (!response.ok || !("sessionId" in data)) {
          throw new Error("error" in data ? data.error : "加载 session 失败。");
        }

        setSession(data);
        setShareResultUrl(buildPublicSessionShareUrl(data, sessionId) ?? "");
        if (data.status === "complete") {
          setActiveTab("timeline");
        }
        await loadAblationReport(data);
        if (data.mode === "world") {
          await loadWorldTrace();
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "加载 session 时出现未知错误。",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSession();
  }, [sessionId]);

  async function loadWorldTrace() {
    setWorldTraceError(null);
    try {
      const response = await fetch(`/api/session/${sessionId}/world-trace`, {
        cache: "no-store",
        headers: sessionRequestHeaders(sessionId),
      });
      const data = await readJsonResponse<{ runs: WorldTraceRun[] } | { error: string }>(
        response,
        "World trace load failed.",
      );
      if (!response.ok || !("runs" in data)) {
        throw new Error("error" in data ? data.error : "World trace load failed.");
      }
      setWorldTraceRuns(data.runs);
    } catch (traceError) {
      setWorldTraceRuns(null);
      setWorldTraceError(traceError instanceof Error ? traceError.message : "World trace load failed.");
    }
  }

  useEffect(() => {
    if (session?.status === "complete") {
      setActiveTab("timeline");
    }
  }, [session?.status]);

  async function loadAblationReport(currentSession: SessionPageData | null = session) {
    if (currentSession?.mode === "world") {
      setAblationReport(null);
      return;
    }
    try {
      const response = await fetch(`/api/session/${sessionId}/ablation`, {
        cache: "no-store",
        headers: sessionRequestHeaders(sessionId),
      });
      const data = await readJsonResponse<AblationReportData | { error: string }>(
        response,
        copy.requestFailed,
      );

      if (!response.ok || !("runs" in data)) {
        setAblationReport(null);
        return;
      }

      setAblationReport(data);
    } catch {
      setAblationReport(null);
    }
  }

  async function chooseBranch(branchId: string) {
    const selectedBranch = session?.pendingTurn?.branches.find(
      (branch) => branch.id === branchId,
    );
    setSubmittingBranchId(branchId);
    setError(null);
    setShareMessage(null);
    setGenerationProgress(
      selectedBranch
        ? {
            selectedTitle: selectedBranch.title,
            detail: copy.generatingNext,
            tone: "loading",
          }
        : null,
    );

    try {
      const response = await fetch("/api/session/choose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionRequestHeaders(sessionId),
        },
        body: JSON.stringify({
          sessionId,
          branchId,
          expectedRevision: session?.worldRuntimeState?.revision,
        }),
      });

      const data = await readJsonResponse<SessionPageData | { error: string }>(
        response,
        copy.requestFailed,
      );

      if (!response.ok || !("sessionId" in data)) {
        throw new Error(copy.operationFailed);
      }

      setSession(data);
      if (hasRecoverableGenerationGap(data)) {
        setGenerationProgress({
          selectedTitle:
            data.canonicalPath.at(-1)?.title ?? selectedBranch?.title ?? "",
          detail: getRecoverableGenerationMessage(data, copy.modelTimeoutSaved),
          tone: "failed",
        });
      } else {
        setGenerationProgress(null);
      }
      setActiveTab(data.status === "complete" ? "timeline" : "room");
      await loadAblationReport(data);
    } catch (chooseError) {
      setError(
        chooseError instanceof Error
          ? chooseError.message
          : "选择分支时出现未知错误。",
      );
      setGenerationProgress((current) =>
        current
          ? {
              ...current,
              detail: copy.operationFailed,
              tone: "failed",
            }
          : current,
      );
    } finally {
      setSubmittingBranchId(null);
    }
  }

  async function submitCustomAction() {
    const rawInput = customActionInput.trim();

    if (!rawInput) {
      setError("请输入自定义行动。");
      return;
    }

    setSubmittingBranchId("custom");
    setError(null);
    setShareMessage(null);
    setGenerationProgress({
      selectedTitle: rawInput,
      detail: copy.generatingNext,
      tone: "loading",
    });

    try {
      const response = await fetch("/api/session/choose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionRequestHeaders(sessionId),
        },
        body: JSON.stringify({
          sessionId,
          expectedRevision: session?.worldRuntimeState?.revision,
          authoredAction: {
            rawInput,
            riskProfile: customRiskProfile,
            anchorBranchId: customAnchorBranchId || undefined,
          },
        }),
      });

      const data = await readJsonResponse<SessionPageData | { error: string }>(
        response,
        copy.requestFailed,
      );

      if (!response.ok || !("sessionId" in data)) {
        throw new Error(copy.operationFailed);
      }

      setSession(data);
      setCustomActionInput("");
      setCustomRiskProfile("medium");
      setCustomAnchorBranchId("");
      if (hasRecoverableGenerationGap(data)) {
        setGenerationProgress({
          selectedTitle: data.canonicalPath.at(-1)?.title ?? rawInput,
          detail: getRecoverableGenerationMessage(data, copy.modelTimeoutSaved),
          tone: "failed",
        });
      } else {
        setGenerationProgress(null);
      }
      setActiveTab(data.status === "complete" ? "timeline" : "room");
      await loadAblationReport(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "提交自定义行动时出现未知错误。",
      );
      setGenerationProgress((current) =>
        current
          ? {
              ...current,
              detail: copy.operationFailed,
              tone: "failed",
            }
          : current,
      );
    } finally {
      setSubmittingBranchId(null);
    }
  }

  async function retryNextTurnGeneration() {
    const selectedTitle = session?.canonicalPath.at(-1)?.title ?? "";
    setSubmittingBranchId("retry");
    setError(null);
    setShareMessage(null);
    setGenerationProgress({
      selectedTitle,
      detail: copy.retryingNext,
      tone: "loading",
    });

    try {
      const response = await fetch("/api/session/generate-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionRequestHeaders(sessionId),
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await readJsonResponse<SessionPageData | { error: string }>(
        response,
        copy.requestFailed,
      );

      if (!response.ok || !("sessionId" in data)) {
        throw new Error(copy.requestFailed);
      }

      setSession(data);
      if (hasRecoverableGenerationGap(data)) {
        setGenerationProgress({
          selectedTitle: data.canonicalPath.at(-1)?.title ?? selectedTitle,
          detail: getRecoverableGenerationMessage(data, copy.modelTimeoutSaved),
          tone: "failed",
        });
      } else {
        setGenerationProgress(null);
      }
      setActiveTab(data.status === "complete" ? "timeline" : "room");
      await loadAblationReport(data);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "生成下一轮时出现未知错误。",
      );
      setGenerationProgress({
        selectedTitle,
        detail: copy.operationFailed,
        tone: "failed",
      });
    } finally {
      setSubmittingBranchId(null);
    }
  }

  async function shareResult() {
    if (!session) {
      return;
    }

    const shareUrl = buildPublicSessionShareUrl(session, sessionId) ?? shareResultUrl;
    setShareMessage(null);

    const imageBlob = await renderShareResultImageBlob(session, shareUrl);
    const copied = await copyImageToClipboard(imageBlob);
    if (copied) {
      setShareMessage(copy.shareCopied);
    } else {
      downloadBlob(
        `xmocha-share-${safeFilePart(session.sessionId)}.png`,
        imageBlob,
      );
      setShareMessage(copy.shareCopyFallback);
    }

    void fetch("/api/session/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionRequestHeaders(sessionId),
      },
      body: JSON.stringify({
        sessionId,
        eventName: "share_clicked",
        metadata: {
          shareFormat: "result_card_image",
          mode: session.mode ?? "decision",
          privateWorld: Boolean(session.privateWorld),
          status: session.status,
          turn: session.turn,
        },
      }),
    });
  }

  function downloadReport() {
    if (!session) {
      return;
    }

    downloadTextFile(
      `xmocha-report-${safeFilePart(session.sessionId)}.md`,
      buildSessionReportMarkdown(session, ablationReport),
    );
  }

  const statusLine = useMemo(() => {
    if (!session) return "";

    const labels = getSessionCopy(session.language);
    return [
      `${labels.statusTurn} ${session.turn}/${session.maxTurns}`,
      formatSessionStatus(session.status, session.language),
      formatThemeName(session.theme, session.language),
      formatVisualStyleName(session.visualStyle ?? "career-studio", session.language),
    ].join(" | ");
  }, [session]);

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <Link href="/" style={{ color: "#dbeafe", textDecoration: "none" }}>
            xMocha
          </Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={downloadReport}
              disabled={!session}
              style={{
                ...secondaryButtonStyle,
                opacity: session ? 1 : 0.55,
                cursor: session ? "pointer" : "not-allowed",
              }}
            >
              {copy.downloadReport}
            </button>
            {!session?.privateWorld ? (
              <Link
                href={`/demo?sessionId=${encodeURIComponent(sessionId)}`}
                style={{ ...secondaryButtonStyle, textDecoration: "none" }}
              >
                {copy.replay}
              </Link>
            ) : null}
          </div>
        </header>

        {isLoading ? <p>{copy.loading}</p> : null}
        {error ? <p style={{ color: "#fda4af" }}>{error}</p> : null}

        {session ? (
          <>
            <section
              style={{
                ...panelStyle,
                marginBottom: 14,
                background:
                  "linear-gradient(135deg, rgba(15,27,49,0.96), rgba(10,20,36,0.96))",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "#5eead4", fontWeight: 900 }}>
                {session.mode === "world"
                  ? session.language === "en" ? "WORLD MODE · LIFE CHAPTER" : "世界模式 · 人生章节"
                  : copy.roomEyebrow}
              </p>
              <h1 style={{ margin: "0 0 10px", lineHeight: 1.12 }}>
                {session.dilemma}
              </h1>
              <p style={{ ...mutedStyle, margin: 0 }}>
                {statusLine}
                {session.presetScenarioId ? ` | ${session.presetScenarioId}` : ""}
              </p>
            </section>

            {session.mode === "world" ? <WorldProgressPanel session={session} /> : null}

            <nav
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...secondaryButtonStyle,
                    background: activeTab === tab.id ? "#5eead4" : "#0f1b31",
                    color: activeTab === tab.id ? "#062423" : "#dbeafe",
                  }}
                >
                  {session.mode === "world" && tab.id === "room"
                    ? session.language === "en" ? "Scene" : "场景"
                    : copy.tabs[tab.id]}
                </button>
              ))}
            </nav>

            {activeTab === "room" ? (
              <RoomTab
                session={session}
                submittingBranchId={submittingBranchId}
                customActionInput={customActionInput}
                customRiskProfile={customRiskProfile}
                customAnchorBranchId={customAnchorBranchId}
                onChooseBranch={(branchId) => void chooseBranch(branchId)}
                onCustomActionInput={setCustomActionInput}
                onCustomRiskProfile={setCustomRiskProfile}
                onCustomAnchorBranchId={setCustomAnchorBranchId}
                onSubmitCustomAction={() => void submitCustomAction()}
                generationProgress={generationProgress}
                onRetryNextTurn={() => void retryNextTurnGeneration()}
              />
            ) : null}

            {activeTab === "timeline" ? (
              <TimelineTab
                session={session}
                shareUrl={shareResultUrl}
                shareMessage={shareMessage}
                onShareResult={() => void shareResult()}
              />
            ) : null}

            {activeTab === "evidence" ? (
              <EvidenceTab session={session} ablationReport={ablationReport} />
            ) : null}

            {activeTab === "engine" ? (
              <EngineTab
                session={session}
                worldTraceRuns={worldTraceRuns}
                worldTraceError={worldTraceError}
                onReloadWorldTrace={loadWorldTrace}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function RoomTab({
  session,
  submittingBranchId,
  customActionInput,
  customRiskProfile,
  customAnchorBranchId,
  generationProgress,
  onChooseBranch,
  onCustomActionInput,
  onCustomRiskProfile,
  onCustomAnchorBranchId,
  onSubmitCustomAction,
  onRetryNextTurn,
}: {
  session: SessionPageData;
  submittingBranchId: string | null;
  customActionInput: string;
  customRiskProfile: RiskProfile;
  customAnchorBranchId: string;
  generationProgress: GenerationProgress | null;
  onChooseBranch: (branchId: string) => void;
  onCustomActionInput: (value: string) => void;
  onCustomRiskProfile: (value: RiskProfile) => void;
  onCustomAnchorBranchId: (value: string) => void;
  onSubmitCustomAction: () => void;
  onRetryNextTurn: () => void;
}) {
  if (session.mode === "world") {
    return (
      <WorldRoomTab
        session={session}
        submittingBranchId={submittingBranchId}
        customActionInput={customActionInput}
        customRiskProfile={customRiskProfile}
        customAnchorBranchId={customAnchorBranchId}
        generationProgress={generationProgress}
        onChooseBranch={onChooseBranch}
        onCustomActionInput={onCustomActionInput}
        onCustomRiskProfile={onCustomRiskProfile}
        onCustomAnchorBranchId={onCustomAnchorBranchId}
        onSubmitCustomAction={onSubmitCustomAction}
        onRetryNextTurn={onRetryNextTurn}
      />
    );
  }

  const copy = getSessionCopy(session.language);
  const visualScene = session.pendingTurn?.visualScene;
  const palette = visualScene?.room.colorPalette ?? [
    "#0f172a",
    "#38bdf8",
    "#5eead4",
  ];
  const latestMemory = session.visualHistory?.at(-1);

  return (
    <div className="session-grid">
      <section
        className="room-stage"
        style={{
          ...panelStyle,
          position: "relative",
          overflow: "hidden",
          background: `radial-gradient(circle at 50% 34%, ${palette[1]}33, transparent 33%), linear-gradient(160deg, ${palette[0]}, #08111f 72%)`,
        }}
      >
        <RoomBackground scene={visualScene} />

        <div
          style={{
            position: "absolute",
            left: 18,
            top: 16,
            maxWidth: "min(520px, calc(100% - 36px))",
            zIndex: 5,
          }}
        >
          <p style={{ margin: "0 0 6px", color: "#93c5fd", fontWeight: 800 }}>
            {visualScene ? visualScene.room.atmosphere : copy.roomInitializing}
          </p>
          <p style={{ ...mutedStyle, margin: 0, lineHeight: 1.5 }}>
            {visualScene?.caption ?? copy.roomPending}
          </p>
        </div>

        {visualScene ? (
          <>
            <AvatarNode scene={visualScene} session={session} />
            <div className="room-object-layer">
              {visualScene.room.objects.map((object) => (
                <RoomObjectNode key={object.id} object={object} />
              ))}
            </div>
            <div className="stakeholder-layer">
              {visualScene.stakeholders.map((stakeholder) => (
                <StakeholderNode
                  key={stakeholder.stakeholderId}
                  cue={stakeholder}
                  language={session.language}
                />
              ))}
            </div>
            <div className="branch-portal-row">
              {session.pendingTurn?.branches.map((branch) => {
                const portal = visualScene.branchPortals.find(
                  (item) => item.branchId === branch.id,
                );

                return (
                  <BranchPortal
                    key={branch.id}
                    branch={branch}
                    portal={portal}
                    language={session.language}
                    disabled={submittingBranchId !== null}
                    isSubmitting={submittingBranchId === branch.id}
                    progress={generationProgress}
                    onChoose={() => onChooseBranch(branch.id)}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#a9bddb",
              textAlign: "center",
              padding: 28,
            }}
          >
            {session.status === "complete"
              ? copy.roomComplete
              : copy.roomWaiting}
          </div>
        )}

        <div
          style={{
            position: "relative",
            marginTop: 16,
            zIndex: 3,
          }}
        >
          <ShadowShelf
            shadowTimelines={session.shadowTimelines}
            latestMemory={latestMemory}
            language={session.language}
          />
        </div>
      </section>

      <aside style={{ display: "grid", gap: 14 }}>
        {generationProgress ? (
          <GenerationProgressPanel
            progress={generationProgress}
            language={session.language}
            canRetry={hasRecoverableGenerationGap(session)}
            isRetrying={submittingBranchId === "retry"}
            onRetry={onRetryNextTurn}
          />
        ) : null}
        {!generationProgress && hasRecoverableGenerationGap(session) ? (
          <GenerationProgressPanel
            progress={{
              selectedTitle: session.canonicalPath.at(-1)?.title ?? "",
              detail: getRecoverableGenerationMessage(
                session,
                copy.modelTimeoutSaved,
              ),
              tone: "failed",
            }}
            language={session.language}
            canRetry
            isRetrying={submittingBranchId === "retry"}
            onRetry={onRetryNextTurn}
          />
        ) : null}
        <StatsPanel session={session} />
        {session.pendingTurn ? (
          <CustomActionPanel
            branches={session.pendingTurn.branches}
            submittingBranchId={submittingBranchId}
            customActionInput={customActionInput}
            customRiskProfile={customRiskProfile}
            customAnchorBranchId={customAnchorBranchId}
            language={session.language}
            onCustomActionInput={onCustomActionInput}
            onCustomRiskProfile={onCustomRiskProfile}
            onCustomAnchorBranchId={onCustomAnchorBranchId}
            onSubmitCustomAction={onSubmitCustomAction}
          />
        ) : (
          <SummaryPanel session={session} />
        )}
      </aside>
    </div>
  );
}

function WorldRoomTab({
  session,
  submittingBranchId,
  customActionInput,
  customRiskProfile,
  customAnchorBranchId,
  generationProgress,
  onChooseBranch,
  onCustomActionInput,
  onCustomRiskProfile,
  onCustomAnchorBranchId,
  onSubmitCustomAction,
  onRetryNextTurn,
}: {
  session: SessionPageData;
  submittingBranchId: string | null;
  customActionInput: string;
  customRiskProfile: RiskProfile;
  customAnchorBranchId: string;
  generationProgress: GenerationProgress | null;
  onChooseBranch: (branchId: string) => void;
  onCustomActionInput: (value: string) => void;
  onCustomRiskProfile: (value: RiskProfile) => void;
  onCustomAnchorBranchId: (value: string) => void;
  onSubmitCustomAction: () => void;
  onRetryNextTurn: () => void;
}) {
  const copy = getSessionCopy(session.language);
  const pendingTurn = session.pendingTurn;
  const scene = session.pendingWorldTurn?.visibleScene
    ?? session.worldRuntimeState?.recentEvents.at(-1)
    ?? session.dilemma;

  return (
    <div className="session-grid">
      <section
        style={{
          ...panelStyle,
          background: "radial-gradient(circle at top right, #164e633d, transparent 38%), linear-gradient(155deg, #111d35, #08111f)",
        }}
      >
        <p style={{ margin: "0 0 6px", color: "#5eead4", fontWeight: 900 }}>
          {session.language === "en" ? "CURRENT SCENE" : "当前场景"}
        </p>
        <h2 style={{ margin: "0 0 10px", lineHeight: 1.3 }}>{scene}</h2>
        <p style={{ ...mutedStyle, margin: "0 0 18px" }}>
          {session.language === "en"
            ? "Choose one future. Only that future will update the canonical world state."
            : "选择一个未来；只有被选择的分支会写入正式世界状态。"}
        </p>

        {pendingTurn ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            {pendingTurn.branches.map((branch) => (
              <BranchPortal
                key={branch.id}
                branch={branch}
                language={session.language}
                disabled={submittingBranchId !== null}
                isSubmitting={submittingBranchId === branch.id}
                progress={generationProgress}
                onChoose={() => onChooseBranch(branch.id)}
              />
            ))}
          </div>
        ) : session.status === "complete" ? (
          <SummaryPanel session={session} />
        ) : (
          <p style={mutedStyle}>{copy.roomWaiting}</p>
        )}

        <div style={{ marginTop: 18 }}>
          <ShadowShelf
            shadowTimelines={session.shadowTimelines}
            language={session.language}
          />
        </div>
      </section>

      <aside style={{ display: "grid", gap: 14 }}>
        {generationProgress ? (
          <GenerationProgressPanel
            progress={generationProgress}
            language={session.language}
            canRetry={hasRecoverableGenerationGap(session)}
            isRetrying={submittingBranchId === "retry"}
            onRetry={onRetryNextTurn}
          />
        ) : null}
        <WorldStatePanel session={session} />
        {pendingTurn ? (
          <CustomActionPanel
            branches={pendingTurn.branches}
            submittingBranchId={submittingBranchId}
            customActionInput={customActionInput}
            customRiskProfile={customRiskProfile}
            customAnchorBranchId={customAnchorBranchId}
            language={session.language}
            worldMode
            onCustomActionInput={onCustomActionInput}
            onCustomRiskProfile={onCustomRiskProfile}
            onCustomAnchorBranchId={onCustomAnchorBranchId}
            onSubmitCustomAction={onSubmitCustomAction}
          />
        ) : null}
      </aside>
    </div>
  );
}

function WorldStatePanel({ session }: { session: SessionPageData }) {
  const runtime = session.worldRuntimeState;
  if (!runtime) return null;
  const isEnglish = session.language === "en";
  const stakeholderLabelById = new Map(
    (session.simulationState?.stakeholders ?? []).map((stakeholder) => [
      stakeholder.id,
      stakeholder.role,
    ]),
  );
  stakeholderLabelById.set(runtime.playerCharacter.characterId, runtime.playerCharacter.name);
  const activeCharacterStates = (runtime.characterStates ?? [])
    .filter((character) =>
      runtime.activeCharacterIds.includes(character.characterId) ||
      character.characterId === session.worldExperiencePlan?.playerCharacterId,
    )
    .slice(0, 4);
  const visibleEvents = prioritizeWorldEvents(runtime.eventQueue ?? [], session.turn).slice(0, 3);
  const activeEvent = visibleEvents.find((event) => event.status === "active") ?? visibleEvents[0];

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 12px" }}>
        {session.language === "en" ? "World state" : "世界状态"}
      </h2>
      <p style={{ margin: "0 0 6px" }}>
        <strong>{runtime.playerCharacter.name}</strong> · {runtime.playerCharacter.identity}
      </p>
      <p style={{ ...mutedStyle, margin: "0 0 10px" }}>
        {session.language === "en" ? "Location" : "位置"}: {runtime.currentLocationId}
      </p>
      {activeEvent ? (
        <>
          <p style={{ margin: "0 0 6px", fontWeight: 800 }}>
            {isEnglish ? "Active event" : "当前事件"}
          </p>
          <p style={{ ...mutedStyle, margin: "0 0 12px", lineHeight: 1.5 }}>
            {worldEventStatusLabel(activeEvent.status, session.language)} · {activeEvent.description}
          </p>
        </>
      ) : null}
      <p style={{ margin: "0 0 6px", fontWeight: 800 }}>
        {isEnglish ? "NPC attitudes" : "NPC 态度"}
      </p>
      {activeCharacterStates.length > 0 ? (
        <ul style={{ ...mutedStyle, marginTop: 0, paddingLeft: 18 }}>
          {activeCharacterStates.map((character) => (
            <li key={character.characterId}>
              {stakeholderLabelById.get(character.characterId) ?? character.characterId} · {worldAttitudeLabel(character.attitude, session.language)}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ ...mutedStyle, margin: "0 0 12px" }}>—</p>
      )}
      <p style={{ margin: "0 0 6px", fontWeight: 800 }}>
        {session.language === "en" ? "Recent event" : "最近事件"}
      </p>
      <p style={{ ...mutedStyle, margin: 0, lineHeight: 1.5 }}>
        {runtime.recentEvents.at(-1)}
      </p>
      {runtime.worldPressure ? (
        <p style={{ ...mutedStyle, margin: "10px 0 0", lineHeight: 1.5 }}>
          {isEnglish
            ? `Pressure: order ${runtime.worldPressure.householdOrder ?? "-"} · resentment ${runtime.worldPressure.hiddenResentment ?? "-"} · information ${runtime.worldPressure.informationClarity ?? "-"}`
            : `压力：秩序 ${runtime.worldPressure.householdOrder ?? "-"} · 暗怨 ${runtime.worldPressure.hiddenResentment ?? "-"} · 信息 ${runtime.worldPressure.informationClarity ?? "-"}`}
        </p>
      ) : null}
    </section>
  );
}

function RoomBackground({ scene }: { scene?: VisualScene }) {
  const cue = scene?.collapseCue ?? "echo";

  return (
    <div aria-hidden="true">
      <div
        style={{
          position: "absolute",
          inset: "100px 8% 86px",
          border: "1px solid #365579",
          borderRadius: 18,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          bottom: 92,
          height: 2,
          background:
            cue === "pressure-rise"
              ? "#fb7185"
              : cue === "split"
                ? "#fbbf24"
                : "#5eead4",
          opacity: 0.72,
          boxShadow: "0 0 28px currentColor",
        }}
      />
    </div>
  );
}

function AvatarNode({
  scene,
  session,
}: {
  scene: VisualScene;
  session: SessionPageData;
}) {
  const copy = getSessionCopy(session.language);
  const stress = session.simulationState?.individual.stress ?? 0.35;
  const confidence = session.simulationState?.individual.confidence ?? 0.5;

  return (
    <div
      className="avatar-node"
      style={{
        position: "absolute",
        left: "50%",
        top: "39%",
        width: 138,
        transform: "translate(-50%, -50%) scale(0.82)",
        textAlign: "center",
        zIndex: 2,
      }}
    >
      <div
        style={{
          width: 92,
          height: 92,
          margin: "0 auto",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 35%, #f8fafc, ${scene.room.colorPalette[2] ?? "#5eead4"} 44%, #0f172a 72%)`,
          border: `2px solid ${stress > 0.6 ? "#fb7185" : "#5eead4"}`,
          boxShadow: `0 0 ${Math.round(24 + scene.avatar.energy * 38)}px ${stress > 0.6 ? "#fb7185" : "#5eead4"}66`,
        }}
      />
      <div
        title={`${scene.avatar.expression} | ${scene.avatar.focusAura}`}
        style={{
          margin: "10px auto 0",
          width: 76,
          height: 58,
          borderRadius: "34px 34px 12px 12px",
          background: confidence > 0.58 ? "#1e3a5f" : "#24304f",
          border: "1px solid #5b7ea8",
        }}
      />
      <p style={{ margin: "10px 0 3px", fontWeight: 900 }}>{copy.observer}</p>
      <p
        title={`${scene.avatar.expression} | ${scene.avatar.focusAura}`}
        style={{
          ...mutedStyle,
          margin: 0,
          fontSize: 12,
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {scene.avatar.expression}
      </p>
    </div>
  );
}

function RoomObjectNode({
  object,
}: {
  object: VisualScene["room"]["objects"][number];
}) {
  return (
    <div
      className="room-object-node"
      title={object.description}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 60,
        maxHeight: 72,
        border: "1px solid #385374",
        borderRadius: 8,
        padding: 9,
        background: "#091324cc",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <strong style={{ display: "block", fontSize: 12 }}>{object.label}</strong>
      <span
        style={{
          ...mutedStyle,
          display: "-webkit-box",
          fontSize: 11,
          lineHeight: 1.3,
          marginTop: 4,
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {object.state}
      </span>
    </div>
  );
}

function StakeholderNode({
  cue,
  language,
}: {
  cue: VisualScene["stakeholders"][number];
  language?: string;
}) {
  const color = stanceColor(cue.stance);
  const stanceLabel = formatStance(cue.stance, language);

  return (
    <div
      className="stakeholder-node"
      style={{
        position: "relative",
        width: 112,
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: "8px 10px",
        background: "#08111fde",
        color: "#eef4ff",
        zIndex: 2,
      }}
      title={`${cue.label}: ${cue.mood}`}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          marginRight: 6,
        }}
      />
      <strong style={{ fontSize: 12 }}>{cue.label}</strong>
      <span style={{ ...mutedStyle, display: "block", fontSize: 11 }}>
        {stanceLabel} | {formatMetric(cue.influence)}
      </span>
    </div>
  );
}

function BranchPortal({
  branch,
  portal,
  language,
  disabled,
  isSubmitting,
  progress,
  onChoose,
}: {
  branch: BranchData;
  portal?: VisualScene["branchPortals"][number];
  language?: string;
  disabled: boolean;
  isSubmitting: boolean;
  progress: GenerationProgress | null;
  onChoose: () => void;
}) {
  const color = portal?.color ?? riskColor(branch.riskProfile);
  const copy = getSessionCopy(language);
  const selectedProgress = isSubmitting && progress;
  const [isCompact, setIsCompact] = useState(false);
  const title = portal?.portalLabel ?? branch.title;

  return (
    <article
      className="branch-portal-node"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 176,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: 12,
        color: "#f8fafc",
        background: `linear-gradient(180deg, ${color}26, #07101f 82%)`,
        boxShadow: `0 0 26px ${color}44`,
        textAlign: "left",
        zIndex: 4,
        overflowWrap: "anywhere",
        minWidth: 0,
      }}
    >
      <span style={{ color, fontSize: 12, fontWeight: 900 }}>
        {portal?.symbol ?? formatRiskProfile(branch.riskProfile, language)} {copy.portal}
      </span>
      <strong
        style={{
          display: "block",
          marginTop: 6,
          lineHeight: 1.25,
        }}
      >
        {title}
      </strong>

      <div
        style={{
          display: "grid",
          gap: 8,
          marginTop: 10,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {branch.summary ? (
          <BranchDetailLine
            label={copy.branchSummary}
            value={branch.summary}
            compact={isCompact}
          />
        ) : null}
        <BranchDetailLine
          label={copy.branchConsequence}
          value={branch.consequence}
          compact={isCompact}
        />
        {!isCompact && branch.keyUncertainty ? (
          <BranchDetailLine
            label={copy.branchUncertainty}
            value={branch.keyUncertainty}
          />
        ) : null}
        {!isCompact && branch.timeHorizon ? (
          <BranchDetailLine
            label={copy.branchHorizon}
            value={branch.timeHorizon}
          />
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginTop: "auto",
          paddingTop: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setIsCompact((current) => !current)}
          style={{
            ...secondaryButtonStyle,
            padding: "7px 9px",
            fontSize: 12,
            borderColor: color,
          }}
        >
          {isCompact ? copy.showFullBranch : copy.showLess}
        </button>
        <button
          type="button"
          onClick={onChoose}
          disabled={disabled}
          style={{
            ...buttonStyle,
            flex: "1 1 142px",
            minWidth: 0,
            padding: "8px 10px",
            color: "#07101f",
            background: color,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
        {selectedProgress
          ? `${copy.selectedPrefix}: ${selectedProgress.selectedTitle} · ${selectedProgress.detail}`
          : isSubmitting
            ? copy.collapsing
            : copy.collapseFuture}
        </button>
      </div>
    </article>
  );
}

function BranchDetailLine({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <p
      style={{
        ...mutedStyle,
        display: compact ? "-webkit-box" : "block",
        margin: 0,
        overflow: compact ? "hidden" : "visible",
        WebkitBoxOrient: compact ? "vertical" : undefined,
        WebkitLineClamp: compact ? 2 : undefined,
        minWidth: 0,
      }}
    >
      <strong style={{ color: "#dbeafe" }}>{label}: </strong>
      {value}
    </p>
  );
}

function GenerationProgressPanel({
  progress,
  language,
  canRetry,
  isRetrying,
  onRetry,
}: {
  progress: GenerationProgress;
  language?: string;
  canRetry: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const copy = getSessionCopy(language);
  const color = progress.tone === "failed" ? "#fbbf24" : "#5eead4";

  return (
    <section
      style={{
        ...panelStyle,
        borderColor: color,
        background: progress.tone === "failed" ? "#211a09" : "#09231f",
      }}
    >
      <p style={{ margin: "0 0 8px", color, fontWeight: 900 }}>
        {copy.selectedPrefix}: {progress.selectedTitle}
      </p>
      <p style={{ ...mutedStyle, margin: 0, lineHeight: 1.45 }}>{progress.detail}</p>
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          style={{ ...buttonStyle, width: "100%", marginTop: 12 }}
        >
          {isRetrying ? copy.retryingNext : copy.retryNext}
        </button>
      ) : null}
    </section>
  );
}

function ShadowShelf({
  shadowTimelines,
  latestMemory,
  language,
}: {
  shadowTimelines: SessionPageData["shadowTimelines"];
  latestMemory?: NonNullable<SessionPageData["visualHistory"]>[number];
  language?: string;
}) {
  const latestShadows = shadowTimelines.at(-1) ?? [];
  const copy = getSessionCopy(language);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 8,
        border: "1px solid #344766",
        borderRadius: 8,
        background: "#08111fde",
        padding: 10,
      }}
    >
      <strong>{copy.shadowShelf}</strong>
      {latestShadows.length === 0 ? (
        <span style={mutedStyle}>{copy.shadowEmpty}</span>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {latestShadows.map((branch) => (
            <span
              key={`${branch.turn}-${branch.title}`}
              style={{
                border: "1px solid #314d75",
                borderRadius: 999,
                padding: "6px 9px",
                color: "#cbd5e1",
                fontSize: 12,
              }}
            >
              T{branch.turn} {branch.title}
            </span>
          ))}
        </div>
      )}
      {latestMemory ? (
        <span style={{ ...mutedStyle, fontSize: 12 }}>
          {copy.latestMemory}: {latestMemory.memoryLabel}
        </span>
      ) : null}
    </div>
  );
}

function StatsPanel({ session }: { session: SessionPageData }) {
  const copy = getSessionCopy(session.language);
  const individual = session.simulationState?.individual;
  const environment = session.simulationState?.environmentMetrics ?? {};

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 12px" }}>{copy.statsTitle}</h2>
      {individual ? (
        <>
          <MetricBar label={copy.confidence} value={individual.confidence} color="#60a5fa" />
          <MetricBar label={copy.stress} value={individual.stress} color="#fb7185" />
          <MetricBar
            label={copy.adaptation}
            value={individual.skills.adaptation ?? 0.5}
            color="#5eead4"
          />
          <MetricBar
            label={copy.risk}
            value={individual.riskTolerance}
            color="#fbbf24"
          />
        </>
      ) : (
        <p style={mutedStyle}>{copy.noSimulationState}</p>
      )}
      <div style={{ borderTop: "1px solid #263b60", marginTop: 12, paddingTop: 12 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 800 }}>{copy.world}</p>
        <MetricBar
          label={copy.pressure}
          value={environment.pressure ?? 0.45}
          color="#fb7185"
        />
        <MetricBar
          label={copy.opportunity}
          value={environment.opportunity ?? 0.5}
          color="#5eead4"
        />
      </div>
    </section>
  );
}

function CustomActionPanel({
  branches,
  submittingBranchId,
  customActionInput,
  customRiskProfile,
  customAnchorBranchId,
  language,
  worldMode = false,
  onCustomActionInput,
  onCustomRiskProfile,
  onCustomAnchorBranchId,
  onSubmitCustomAction,
}: {
  branches: BranchData[];
  submittingBranchId: string | null;
  customActionInput: string;
  customRiskProfile: RiskProfile;
  customAnchorBranchId: string;
  language?: string;
  worldMode?: boolean;
  onCustomActionInput: (value: string) => void;
  onCustomRiskProfile: (value: RiskProfile) => void;
  onCustomAnchorBranchId: (value: string) => void;
  onSubmitCustomAction: () => void;
}) {
  const copy = getSessionCopy(language);

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: "0 0 8px" }}>{copy.manualTitle}</h2>
      <p style={{ ...mutedStyle, marginTop: 0 }}>
        {copy.manualDescription}
      </p>
      <textarea
        value={customActionInput}
        onChange={(event) => onCustomActionInput(event.target.value)}
        placeholder={worldMode
          ? language === "en"
            ? "Example: privately ask Ping'er to verify the duty roster before announcing a rule."
            : "例如：先让平儿私下核对名册，再决定是否公开立规矩。"
          : copy.manualPlaceholder}
        rows={5}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <label>
          <span style={{ display: "block", marginBottom: 5 }}>{copy.riskProfile}</span>
          <select
            value={customRiskProfile}
            onChange={(event) => onCustomRiskProfile(event.target.value as RiskProfile)}
            style={inputStyle}
          >
            <option value="low">{formatRiskProfile("low", language)}</option>
            <option value="medium">{formatRiskProfile("medium", language)}</option>
            <option value="high">{formatRiskProfile("high", language)}</option>
          </select>
        </label>
        <label>
          <span style={{ display: "block", marginBottom: 5 }}>{copy.anchorPortal}</span>
          <select
            value={customAnchorBranchId}
            onChange={(event) => onCustomAnchorBranchId(event.target.value)}
            style={inputStyle}
          >
            <option value="">{copy.none}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={onSubmitCustomAction}
        disabled={submittingBranchId !== null}
        style={{ ...buttonStyle, width: "100%", marginTop: 12 }}
      >
        {submittingBranchId === "custom" ? copy.submitting : copy.commitManualAction}
      </button>
    </section>
  );
}

function SummaryPanel({ session }: { session: SessionPageData }) {
  const copy = getSessionCopy(session.language);

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>
        {session.mode === "world"
          ? session.language === "en" ? "Chapter recap" : "人生章节回放"
          : copy.finalReport}
      </h2>
      {session.mode === "world" ? <WorldChapterRecap session={session} /> : null}
      {session.summary ? (
        <>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
            {session.summary.narrative}
          </p>
          <ul>
            {session.summary.decisionArc.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
          {session.summary.alternateHint ? (
            <p style={mutedStyle}>{session.summary.alternateHint}</p>
          ) : null}
        </>
      ) : (
        <p style={mutedStyle}>{copy.summaryPending}</p>
      )}
    </section>
  );
}

function TimelineTab({
  session,
  shareUrl,
  shareMessage,
  onShareResult,
}: {
  session: SessionPageData;
  shareUrl: string;
  shareMessage: string | null;
  onShareResult: () => void;
}) {
  const copy = getSessionCopy(session.language);

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>{copy.timelineTitle}</h2>
      {session.status === "complete" ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Link
            href={session.mode === "world" ? "/world" : "/"}
            style={{ ...secondaryButtonStyle, textDecoration: "none" }}
          >
            {session.mode === "world"
              ? session.language === "en" ? "Start another chapter" : "开始另一个人生章节"
              : copy.startAnotherDilemma}
          </Link>
          <button type="button" onClick={onShareResult} style={buttonStyle}>
            {copy.shareResult}
          </button>
          {shareMessage ? (
            <span style={{ ...mutedStyle, fontSize: 13 }}>{shareMessage}</span>
          ) : null}
        </div>
      ) : null}
      {session.status === "complete" ? (
        <ShareResultCard session={session} shareUrl={shareUrl} />
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        {session.canonicalPath.length === 0 ? (
          <p style={mutedStyle}>{copy.noCollapse}</p>
        ) : (
          session.canonicalPath.map((step) => (
            <div key={`${step.turn}-${step.title}`} style={timelineCardStyle}>
              <span style={{ color: "#5eead4", fontWeight: 900 }}>
                {copy.turn} {step.turn}{copy.turnSuffix}
              </span>
              <h3 style={{ margin: "8px 0" }}>{step.title}</h3>
              <p style={{ ...mutedStyle, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {step.summary}
              </p>
              <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {step.consequence}
              </p>
              {step.keyUncertainty ? (
                <p style={{ ...mutedStyle, margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {session.language === "en" ? "Key uncertainty: " : "关键不确定性："}
                  {step.keyUncertainty}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>

      {session.status === "complete" ? (
        <div style={{ marginTop: 18 }}>
          <h3>{copy.finalReflection}</h3>
          {session.mode === "world" ? (
            <WorldChapterRecap session={session} />
          ) : session.summary ? (
            <div style={timelineCardStyle}>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginTop: 0 }}>
                {session.summary.narrative}
              </p>
              <ul>
                {session.summary.decisionArc.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
              {session.summary.alternateHint ? (
                <p style={mutedStyle}>{session.summary.alternateHint}</p>
              ) : null}
            </div>
          ) : (
            <p style={mutedStyle}>{copy.summaryPending}</p>
          )}
        </div>
      ) : null}

      {session.mode !== "world" ? (
        <>
          <h3>{copy.visualMemories}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(session.visualHistory ?? []).length === 0 ? (
              <p style={mutedStyle}>{copy.visualHistoryEmpty}</p>
            ) : (
              (session.visualHistory ?? []).map((entry) => (
                <div key={`${entry.turn}-${entry.selectedBranchId}`} style={timelineCardStyle}>
                  <strong>{copy.turn} {entry.turn}{copy.turnSuffix}: {entry.selectedBranchTitle}</strong>
                  <p style={{ ...mutedStyle, marginBottom: 6 }}>{entry.memoryLabel}</p>
                  <span style={{ color: "#93c5fd" }}>
                    {copy.room}: {entry.scene.room.atmosphere}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}

      <h3>{copy.shadowTimelines}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {session.shadowTimelines.length === 0 ? (
          <p style={mutedStyle}>{copy.noShadowsArchived}</p>
        ) : (
          session.shadowTimelines.map((branches, index) => (
            <div key={`shadow-${index}`} style={timelineCardStyle}>
              <strong>{copy.turn} {index + 1}{copy.turnSuffix} {copy.shadows}</strong>
              <ul>
                {branches.map((branch) => (
                  <li key={`${branch.turn}-${branch.title}`}>
                    {branch.title} -&gt; {branch.consequence}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {session.status === "complete" ? (
        <>
          <FeedbackPanel session={session} />
          <ContactPanel session={session} />
        </>
      ) : null}
    </section>
  );
}

function ShareResultCard({
  session,
  shareUrl,
}: {
  session: SessionPageData;
  shareUrl: string;
}) {
  const copy = getSessionCopy(session.language);
  const preview = buildShareResultCardModel(session, shareUrl);

  return (
    <div
      style={{
        ...timelineCardStyle,
        marginBottom: 18,
        borderColor: "#5eead4",
        background:
          "linear-gradient(135deg, rgba(94,234,212,0.12), rgba(9,19,36,0.98))",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <strong>{copy.shareCardTitle}</strong>
        <span style={{ ...mutedStyle, fontSize: 12 }}>{copy.shareCardPreview}</span>
      </div>
      {session.privateWorld ? (
        <p
          style={{
            border: "1px solid #7c5d2a",
            borderRadius: 8,
            background: "rgba(124, 93, 42, 0.16)",
            color: "#fde68a",
            padding: "8px 10px",
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          {copy.privateWorldShareNote}
        </p>
      ) : null}
      <div
        style={{
          border: "1px solid rgba(94,234,212,0.72)",
          borderRadius: 18,
          padding: 18,
          background:
            "radial-gradient(circle at 20% 0%, rgba(94,234,212,0.2), transparent 34%), linear-gradient(135deg, #10213a, #07111f)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "#5eead4", fontWeight: 900, letterSpacing: 0.3 }}>
          {preview.kicker}
        </p>
        <h3 style={{ margin: "0 0 10px", fontSize: 26, lineHeight: 1.15 }}>
          {preview.title}
        </h3>
        <p style={{ ...mutedStyle, margin: "0 0 14px", lineHeight: 1.55 }}>
          {preview.subtitle}
        </p>
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {preview.stats.map((stat) => (
            <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#93c5fd" }}>{stat.label}</span>
              <strong style={{ textAlign: "right" }}>{stat.value}</strong>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {preview.pathLines.map((line, index) => (
            <div key={`${index}-${line}`} style={{ borderTop: "1px solid rgba(147,197,253,0.22)", paddingTop: 8 }}>
              <span style={{ color: "#5eead4", fontWeight: 900 }}>{index + 1}. </span>
              {line}
            </div>
          ))}
        </div>
        <p style={{ ...mutedStyle, margin: "14px 0 0", fontSize: 12 }}>
          {preview.footer}
        </p>
      </div>
    </div>
  );
}

function WorldChapterRecap({ session }: { session: SessionPageData }) {
  const runtime = session.worldRuntimeState;
  const plan = session.worldExperiencePlan;
  if (!runtime || !plan) {
    return (
      <div style={timelineCardStyle}>
        <p style={mutedStyle}>
          {session.language === "en"
            ? "World chapter state is not available yet."
            : "世界章节状态暂不可用。"}
        </p>
      </div>
    );
  }

  const milestones = runtime.milestones ?? plan.milestones;
  const counts = countWorldMilestones(milestones);
  const visibleEvents = prioritizeWorldEvents(runtime.eventQueue ?? [], session.turn);
  const resolvedEvents = visibleEvents.filter((event) => event.status === "resolved").slice(0, 4);
  const unresolvedEvents = visibleEvents
    .filter((event) => event.status === "active" || event.status === "scheduled" || event.status === "expired")
    .slice(0, 4);
  const stakeholderLabelById = new Map(
    (session.simulationState?.stakeholders ?? []).map((stakeholder) => [
      stakeholder.id,
      stakeholder.role,
    ]),
  );
  stakeholderLabelById.set(runtime.playerCharacter.characterId, runtime.playerCharacter.name);
  const attitudeLines = (runtime.characterStates ?? [])
    .filter((character) => runtime.activeCharacterIds.includes(character.characterId))
    .slice(0, 5)
    .map((character) =>
      `${stakeholderLabelById.get(character.characterId) ?? character.characterId}: ${worldAttitudeLabel(character.attitude, session.language)}`
    );
  const useChinese = session.language !== "en";

  return (
    <div style={timelineCardStyle}>
      <p style={{ marginTop: 0, lineHeight: 1.6 }}>
        {useChinese
          ? `你以「${runtime.playerCharacter.name}」进入这一章。章节节点：达成 ${counts.achieved} 个，失败 ${counts.failed} 个，仍未完成 ${counts.unresolved} 个。`
          : `You entered this chapter as ${runtime.playerCharacter.name}. Chapter nodes: ${counts.achieved} achieved, ${counts.failed} failed, and ${counts.unresolved} unresolved.`
        }
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {milestones.map((milestone) => (
          <span
            key={milestone.id}
            style={{
              border: `1px solid ${worldMilestoneStatusColor(milestone.status)}`,
              color: worldMilestoneStatusColor(milestone.status),
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            M{milestone.order} · {worldMilestoneStatusLabel(milestone.status, session.language)}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <div>
          <strong>{useChinese ? "选择轨迹" : "Chosen path"}</strong>
          <ol style={{ ...mutedStyle, paddingLeft: 18, lineHeight: 1.55 }}>
            {session.canonicalPath.map((step) => (
              <li key={`${step.turn}-${step.title}`}>{step.title}</li>
            ))}
          </ol>
        </div>
        <div>
          <strong>{useChinese ? "角色态度" : "NPC attitudes"}</strong>
          {attitudeLines.length ? (
            <ul style={{ ...mutedStyle, paddingLeft: 18, lineHeight: 1.55 }}>
              {attitudeLines.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p style={mutedStyle}>—</p>
          )}
        </div>
        <div>
          <strong>{useChinese ? "事件结果" : "Event outcomes"}</strong>
          <ul style={{ ...mutedStyle, paddingLeft: 18, lineHeight: 1.55 }}>
            {resolvedEvents.map((event) => (
              <li key={event.id}>{worldEventStatusLabel(event.status, session.language)} · {event.description}</li>
            ))}
            {unresolvedEvents.map((event) => (
              <li key={event.id}>{worldEventStatusLabel(event.status, session.language)} · {event.description}</li>
            ))}
            {resolvedEvents.length + unresolvedEvents.length === 0 ? <li>—</li> : null}
          </ul>
        </div>
      </div>
      {session.shadowTimelines.length ? (
        <p style={{ ...mutedStyle, marginBottom: 0 }}>
          {useChinese
            ? `影子结局：${session.shadowTimelines.flat().length} 条未选道路被保留，可用于重玩这一章。`
            : `Shadow endings: ${session.shadowTimelines.flat().length} unchosen roads were preserved for replay.`
          }
        </p>
      ) : null}
    </div>
  );
}

function WorldProgressPanel({ session }: { session: SessionPageData }) {
  const plan = session.worldExperiencePlan;
  const runtime = session.worldRuntimeState;
  if (!plan || !runtime) return null;
  const isEnglish = session.language === "en";
  const milestones = runtime.milestones ?? plan.milestones;
  const visibleEvents = prioritizeWorldEvents(runtime.eventQueue ?? [], session.turn).slice(0, 6);
  const stakeholderLabelById = new Map(
    (session.simulationState?.stakeholders ?? []).map((stakeholder) => [
      stakeholder.id,
      stakeholder.role,
    ]),
  );
  stakeholderLabelById.set(runtime.playerCharacter.characterId, runtime.playerCharacter.name);
  const activeCharacterStates = (runtime.characterStates ?? [])
    .filter((character) =>
      runtime.activeCharacterIds.includes(character.characterId) ||
      character.characterId === plan.playerCharacterId,
    )
    .slice(0, 4);
  const milestoneCounts = countWorldMilestones(milestones);

  return (
    <section style={{ ...panelStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "#5eead4", fontWeight: 900 }}>
            WORLD CHAPTER
          </p>
          <strong>{runtime.playerCharacter.name}</strong>
          <span style={{ ...mutedStyle, marginLeft: 8 }}>{runtime.playerCharacter.identity}</span>
        </div>
        <span style={mutedStyle}>revision {runtime.revision} · {runtime.checkpoint}</span>
      </div>
      <p style={{ marginBottom: 8 }}>{isEnglish ? "Goal" : "目标"}: {plan.primaryGoal}</p>
      <p style={{ ...mutedStyle, margin: "0 0 12px", lineHeight: 1.5 }}>
        {session.language === "en"
          ? `Milestones: ${milestoneCounts.achieved} achieved, ${milestoneCounts.failed} failed, ${milestoneCounts.unresolved} unresolved.`
          : `Milestone：已达成 ${milestoneCounts.achieved}，失败 ${milestoneCounts.failed}，仍未完成 ${milestoneCounts.unresolved}。`}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            style={{
              ...timelineCardStyle,
              borderColor: milestone.status === "active" ? "#5eead4" : worldMilestoneStatusColor(milestone.status),
              opacity: milestone.status === "locked" ? 0.62 : 1,
            }}
          >
            <span style={{ color: worldMilestoneStatusColor(milestone.status), fontWeight: 800 }}>
              Milestone {milestone.order} · {worldMilestoneStatusLabel(milestone.status, session.language)}
            </span>
            <p style={{ marginBottom: 0, lineHeight: 1.5 }}>{milestone.description}</p>
            {milestone.progressSignals.length > 0 ? (
              <ul style={{ ...mutedStyle, marginBottom: 0, paddingLeft: 18, lineHeight: 1.45 }}>
                {milestone.progressSignals.slice(-2).map((signal, index) => (
                  <li key={`${milestone.id}-signal-${index}`}>{signal}</li>
                ))}
              </ul>
            ) : (
              <p style={{ ...mutedStyle, marginBottom: 0, fontSize: 13 }}>
                {session.language === "en" ? "No concrete progress recorded yet." : "尚无明确进展记录。"}
              </p>
            )}
          </div>
        ))}
      </div>
      {runtime.recentEvents.at(-1) ? (
        <p style={{ ...mutedStyle, marginBottom: 0 }}>
          {isEnglish ? "Recent event" : "最近事件"}: {runtime.recentEvents.at(-1)}
        </p>
      ) : null}
      {runtime.worldPressure ? (
        <p style={{ ...mutedStyle, marginBottom: 0 }}>
          {isEnglish
            ? `World pressure: order ${runtime.worldPressure.householdOrder ?? "-"} · face ${runtime.worldPressure.publicFace ?? "-"} · resentment ${runtime.worldPressure.hiddenResentment ?? "-"} · information ${runtime.worldPressure.informationClarity ?? "-"}`
            : `世界压力：秩序 ${runtime.worldPressure.householdOrder ?? "-"} · 体面 ${runtime.worldPressure.publicFace ?? "-"} · 暗怨 ${runtime.worldPressure.hiddenResentment ?? "-"} · 信息 ${runtime.worldPressure.informationClarity ?? "-"}`}
        </p>
      ) : null}
      {activeCharacterStates.length ? (
        <div style={{ marginTop: 12 }}>
          <strong>{isEnglish ? "NPC attitudes" : "角色态度"}</strong>
          <ul style={{ marginBottom: 0 }}>
            {activeCharacterStates.map((character) => (
              <li key={character.characterId}>
                {stakeholderLabelById.get(character.characterId) ?? character.characterId} · {worldAttitudeLabel(character.attitude, session.language)}
                {character.lastInteraction ? ` · ${character.lastInteraction}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {visibleEvents.length ? (
        <div style={{ marginTop: 12 }}>
          <strong>{isEnglish ? "Event progress" : "事件推进"}</strong>
          <ul style={{ marginBottom: 0 }}>
            {visibleEvents.map((event) => (
              <li key={event.id}>
                T{event.dueTurn ?? "?"} · {worldEventStatusLabel(event.status, session.language)} · {worldEventVisibilityLabel(event.visibility, session.language)} · {event.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

type RuntimeWorldEvent = NonNullable<NonNullable<SessionPageData["worldRuntimeState"]>["eventQueue"]>[number];
type RuntimeWorldMilestone = NonNullable<NonNullable<SessionPageData["worldRuntimeState"]>["milestones"]>[number];

function prioritizeWorldEvents(events: RuntimeWorldEvent[], turn: number): RuntimeWorldEvent[] {
  return [...events]
    .filter((event) =>
      event.status === "active" ||
      event.status === "resolved" ||
      event.status === "expired" ||
      event.dueTurn === undefined ||
      event.dueTurn <= turn + 2,
    )
    .sort((a, b) => {
      const priority = (event: RuntimeWorldEvent): number => {
        if (event.status === "active") return 0;
        if (event.status === "scheduled" && (event.dueTurn ?? 99) <= turn + 1) return 1;
        if (event.status === "scheduled") return 2;
        if (event.status === "resolved") return 3;
        return 4;
      };
      return priority(a) - priority(b) || (a.dueTurn ?? 99) - (b.dueTurn ?? 99) || b.severity - a.severity;
    });
}

function worldEventStatusLabel(status: RuntimeWorldEvent["status"], language?: string): string {
  const english = language === "en";
  if (status === "active") return english ? "active" : "正在发酵";
  if (status === "scheduled") return english ? "upcoming" : "即将到来";
  if (status === "resolved") return english ? "resolved" : "已处理";
  return english ? "expired" : "已错过";
}

function worldEventVisibilityLabel(visibility: RuntimeWorldEvent["visibility"], language?: string): string {
  const english = language === "en";
  if (visibility === "public") return english ? "public" : "公开";
  if (visibility === "rumor") return english ? "rumor" : "传闻";
  return english ? "private" : "隐蔽";
}

function worldMilestoneStatusLabel(status: RuntimeWorldMilestone["status"], language?: string): string {
  const english = language === "en";
  if (status === "achieved") return english ? "achieved" : "已达成";
  if (status === "failed") return english ? "failed" : "失败";
  if (status === "active") return english ? "active" : "进行中";
  return english ? "locked" : "未解锁";
}

function worldMilestoneStatusColor(status: RuntimeWorldMilestone["status"]): string {
  if (status === "achieved") return "#86efac";
  if (status === "failed") return "#fda4af";
  if (status === "active") return "#5eead4";
  return "#93c5fd";
}

function countWorldMilestones(milestones: RuntimeWorldMilestone[]): {
  achieved: number;
  failed: number;
  unresolved: number;
} {
  const achieved = milestones.filter((milestone) => milestone.status === "achieved").length;
  const failed = milestones.filter((milestone) => milestone.status === "failed").length;
  const unresolved = milestones.length - achieved - failed;
  return { achieved, failed, unresolved };
}

type ShareResultCardModel = {
  kicker: string;
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
  pathHeading: string;
  pathLines: string[];
  footer: string;
};

function buildShareResultCardModel(session: SessionPageData, shareUrl: string): ShareResultCardModel {
  return session.mode === "world"
    ? buildWorldShareResultCardModel(session, shareUrl)
    : buildDecisionShareResultCardModel(session, shareUrl);
}

function buildDecisionShareResultCardModel(session: SessionPageData, shareUrl: string): ShareResultCardModel {
  const isEnglish = session.language === "en";
  const finalStep = session.canonicalPath.at(-1);
  const shadowCount = countShadowBranches(session);
  const pathLines = session.canonicalPath
    .slice(0, 5)
    .map((step) => step.title);

  return {
    kicker: isEnglish ? "xMocha · Decision Mode" : "xMocha · 决策模拟",
    title: finalStep?.title ?? (isEnglish ? "My simulated path" : "我的模拟路径"),
    subtitle: isEnglish
      ? `Decision: ${truncateShareText(session.dilemma, 128)}`
      : `决策：${truncateShareText(session.dilemma, 68)}`,
    stats: [
      { label: isEnglish ? "Turns" : "轮次", value: `${session.turn}/${session.maxTurns}` },
      { label: isEnglish ? "Shadows" : "影子", value: isEnglish ? `${shadowCount}` : `${shadowCount} 条` },
      { label: isEnglish ? "Mode" : "模式", value: isEnglish ? "Decision" : "决策" },
    ],
    pathHeading: isEnglish ? "Chosen path" : "选择路线",
    pathLines,
    footer: shareFooterLabel(shareUrl, isEnglish),
  };
}

function buildWorldShareResultCardModel(session: SessionPageData, shareUrl: string): ShareResultCardModel {
  const isEnglish = session.language === "en";
  const runtime = session.worldRuntimeState;
  const plan = session.worldExperiencePlan;
  const milestones = runtime?.milestones ?? plan?.milestones ?? [];
  const milestoneCounts = countWorldMilestones(milestones);
  const playerName = runtime?.playerCharacter.name ?? (isEnglish ? "Unknown role" : "未知角色");
  const shadowCount = countShadowBranches(session);
  const pathLines = session.canonicalPath
    .slice(0, 5)
    .map((step) => step.title);

  return {
    kicker: isEnglish ? "xMocha · World Mode" : "xMocha · 故事世界",
    title: isEnglish ? `${playerName}'s story chapter` : `${playerName}的世界章节`,
    subtitle: isEnglish
      ? `Goal: ${truncateShareText(session.dilemma, 128)}`
      : `目标：${truncateShareText(session.dilemma, 68)}`,
    stats: [
      {
        label: isEnglish ? "Result" : "结果",
        value: isEnglish
          ? `${milestoneCounts.achieved} done · ${milestoneCounts.failed} failed`
          : `${milestoneCounts.achieved} 达成 · ${milestoneCounts.failed} 失败`,
      },
      { label: isEnglish ? "Unresolved" : "未完成", value: `${milestoneCounts.unresolved}` },
      { label: isEnglish ? "Shadows" : "影子", value: isEnglish ? `${shadowCount}` : `${shadowCount} 条` },
    ],
    pathHeading: isEnglish ? "Adventure route" : "冒险路线",
    pathLines,
    footer: shareFooterLabel(shareUrl, isEnglish),
  };
}

function countShadowBranches(session: SessionPageData): number {
  return (session.shadowTimelines ?? []).reduce(
    (total, branches) => total + branches.length,
    0,
  );
}

function truncateShareText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function shareFooterLabel(shareUrl: string, isEnglish: boolean): string {
  let origin = "xMocha";
  try {
    origin = new URL(shareUrl).origin.replace(/^https?:\/\//, "");
  } catch {
    // Keep the brand fallback.
  }
  return isEnglish
    ? `xMocha · create your own branch · ${origin}`
    : `xMocha · 进入一个角色，体验不同人生章节 · ${origin}`;
}

async function renderShareResultImageBlob(
  session: SessionPageData,
  shareUrl: string,
): Promise<Blob> {
  const model = buildShareResultCardModel(session, shareUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }

  drawShareResultImage(context, model, session.language === "en");

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to render share image."));
      }
    }, "image/png", 0.94);
  });
}

function drawShareResultImage(
  context: CanvasRenderingContext2D,
  model: ShareResultCardModel,
  isEnglish: boolean,
): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#12335b");
  gradient.addColorStop(0.44, "#0b1b32");
  gradient.addColorStop(1, "#06101e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(180, 90, 0, 180, 90, 460);
  glow.addColorStop(0, "rgba(94,234,212,0.34)");
  glow.addColorStop(1, "rgba(94,234,212,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, 620);

  context.strokeStyle = "rgba(94,234,212,0.72)";
  context.lineWidth = 2;
  roundRect(context, 42, 42, width - 84, height - 84, 34);
  context.stroke();

  context.fillStyle = "#5eead4";
  context.font = `900 32px ${shareFontStack(isEnglish)}`;
  context.fillText("xMocha", 80, 102);

  context.fillStyle = "rgba(94,234,212,0.15)";
  roundRect(context, 80, 132, 360, 54, 27);
  context.fill();
  context.fillStyle = "#99f6e4";
  context.font = `800 24px ${shareFontStack(isEnglish)}`;
  context.fillText(model.kicker, 108, 167);

  let y = 254;
  context.fillStyle = "#eef4ff";
  context.font = `900 64px ${shareFontStack(isEnglish)}`;
  y = drawWrappedCanvasText(context, model.title, 80, y, width - 160, 74, 2);

  context.fillStyle = "#c9d8ee";
  context.font = `700 31px ${shareFontStack(isEnglish)}`;
  y = drawWrappedCanvasText(context, model.subtitle, 80, y + 18, width - 160, 43, 2);

  y += 34;
  const statWidth = (width - 180) / 3;
  model.stats.slice(0, 3).forEach((stat, index) => {
    const x = 80 + index * (statWidth + 10);
    context.fillStyle = "rgba(9,19,36,0.72)";
    roundRect(context, x, y, statWidth, 112, 22);
    context.fill();
    context.strokeStyle = "rgba(147,197,253,0.35)";
    context.stroke();
    context.fillStyle = "#93c5fd";
    context.font = `700 22px ${shareFontStack(isEnglish)}`;
    context.fillText(stat.label, x + 22, y + 38);
    context.fillStyle = "#eef4ff";
    context.font = `900 27px ${shareFontStack(isEnglish)}`;
    drawWrappedCanvasText(context, stat.value, x + 22, y + 78, statWidth - 44, 31, 1);
  });

  y += 160;
  context.fillStyle = "#5eead4";
  context.font = `900 31px ${shareFontStack(isEnglish)}`;
  context.fillText(model.pathHeading, 80, y);
  y += 36;

  const pathLines = model.pathLines.length
    ? model.pathLines
    : [isEnglish ? "The chapter is complete." : "这一章已经完成。"];
  context.font = `700 27px ${shareFontStack(isEnglish)}`;
  for (const [index, line] of pathLines.slice(0, 5).entries()) {
    const top = y + 4;
    context.fillStyle = "rgba(9,19,36,0.58)";
    roundRect(context, 80, top, width - 160, 82, 20);
    context.fill();
    context.fillStyle = "#5eead4";
    context.font = `900 24px ${shareFontStack(isEnglish)}`;
    context.fillText(`${index + 1}`, 108, top + 43);
    context.fillStyle = "#dbeafe";
    context.font = `800 29px ${shareFontStack(isEnglish)}`;
    drawWrappedCanvasText(context, line, 152, top + 48, width - 250, 36, 1);
    y += 96;
  }

  context.fillStyle = "rgba(147,197,253,0.78)";
  context.font = `700 23px ${shareFontStack(isEnglish)}`;
  drawWrappedCanvasText(context, model.footer, 80, height - 104, width - 160, 32, 2);
}

function shareFontStack(isEnglish: boolean): string {
  return isEnglish
    ? `Inter, Arial, sans-serif`
    : `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
}

function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrapCanvasText(context, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const useCharacterWrap = /[\u3400-\u9fff]/.test(normalized);
  const tokens = useCharacterWrap
    ? Array.from(normalized)
    : normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const next = useCharacterWrap
      ? `${current}${token}`
      : current ? `${current} ${token}` : token;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = token;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && context.measureText(lines[lines.length - 1] ?? "").width > maxWidth) {
    lines[lines.length - 1] = truncateCanvasLine(context, lines[lines.length - 1]!, maxWidth);
  }
  if (lines.length === maxLines && tokens.length > lines.join(useCharacterWrap ? "" : " ").length) {
    lines[lines.length - 1] = truncateCanvasLine(context, lines[lines.length - 1]!, maxWidth);
  }
  return lines.length ? lines : [normalized];
}

function truncateCanvasLine(
  context: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
): string {
  let next = line;
  while (next.length > 1 && context.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}…`;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function worldAttitudeLabel(attitude: number, language?: string): string {
  const english = language === "en";
  if (attitude >= 3) return `${english ? "strongly supportive" : "明显支持"} ↑↑ (${attitude})`;
  if (attitude >= 1) return `${english ? "leaning supportive" : "倾向支持"} ↑ (${attitude})`;
  if (attitude <= -3) return `${english ? "strongly wary" : "强烈警惕"} ↓↓ (${attitude})`;
  if (attitude <= -1) return `${english ? "turning wary" : "转为警惕"} ↓ (${attitude})`;
  return `${english ? "watching" : "观望"} (${attitude})`;
}

function FeedbackPanel({ session }: { session: SessionPageData }) {
  const copy = getSessionCopy(session.language);
  const existingFeedback = useMemo(
    () =>
      [...(session.analyticsEvents ?? [])]
        .reverse()
        .find((event) => event.name === "feedback_submitted"),
    [session.analyticsEvents],
  );
  const existingHelpful = existingFeedback?.metadata?.helpful;
  const existingScore = existingFeedback?.metadata?.recommendationScore;
  const [helpful, setHelpful] = useState<boolean | null>(
    typeof existingHelpful === "boolean" ? existingHelpful : null,
  );
  const [recommendationScore, setRecommendationScore] = useState(
    typeof existingScore === "number" ? existingScore : 5,
  );
  const [status, setStatus] = useState<string | null>(
    existingFeedback ? copy.feedbackSubmitted : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(Boolean(existingFeedback));

  async function submitFeedback() {
    if (helpful === null) {
      setStatus(copy.feedbackRequired);
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/session/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionRequestHeaders(session.sessionId),
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          helpful,
          recommendationScore,
        }),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(
        response,
        copy.feedbackFailed,
      );

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.feedbackFailed);
      }

      setIsSubmitted(true);
      setStatus(copy.feedbackSubmitted);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.feedbackFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid #314265",
      }}
    >
      <h3 style={{ margin: "0 0 6px" }}>{copy.feedbackTitle}</h3>
      <p style={{ ...mutedStyle, margin: "0 0 16px" }}>{copy.feedbackIntro}</p>

      <div role="group" aria-label={copy.helpfulQuestion}>
        <p style={{ margin: "0 0 8px", fontWeight: 800 }}>
          {copy.helpfulQuestion}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { value: true, label: copy.helpfulYes },
            { value: false, label: copy.helpfulNo },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={helpful === option.value}
              onClick={() => setHelpful(option.value)}
              disabled={isSubmitted}
              style={{
                ...secondaryButtonStyle,
                minWidth: 72,
                background:
                  helpful === option.value ? "#5eead4" : "#17243a",
                color: helpful === option.value ? "#062423" : "#dbeafe",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label style={{ display: "block", marginTop: 18, fontWeight: 800 }}>
        {copy.recommendationQuestion}
        <span
          style={{
            display: "inline-flex",
            justifyContent: "center",
            minWidth: 32,
            marginLeft: 10,
            color: "#5eead4",
          }}
        >
          {recommendationScore}/10
        </span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={recommendationScore}
          disabled={isSubmitted}
          onChange={(event) => setRecommendationScore(Number(event.target.value))}
          style={{ width: "100%", marginTop: 12, accentColor: "#5eead4" }}
        />
      </label>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#8fa6c8",
          fontSize: 12,
        }}
      >
        <span>0 - {copy.recommendationLow}</span>
        <span>10 - {copy.recommendationHigh}</span>
      </div>

      <button
        type="button"
        onClick={() => void submitFeedback()}
        disabled={isSubmitting || isSubmitted}
        style={{ ...buttonStyle, marginTop: 16 }}
      >
        {isSubmitting ? copy.feedbackSubmitting : copy.feedbackSubmit}
      </button>
      <p style={{ ...mutedStyle, margin: "10px 0 0", fontSize: 12 }}>
        {copy.feedbackPrivacy}
      </p>
      {status ? <p style={{ ...mutedStyle, marginBottom: 0 }}>{status}</p> : null}
    </div>
  );
}

function ContactPanel({ session }: { session: SessionPageData }) {
  const copy = getSessionCopy(session.language);
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [intent, setIntent] = useState<ContactIntent>("beta");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitContact() {
    const trimmedContact = contact.trim();

    if (!trimmedContact) {
      setStatus(copy.contactRequired);
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionRequestHeaders(session.sessionId),
        },
        body: JSON.stringify({
          contact: trimmedContact,
          intent,
          message: message.trim() || undefined,
          sessionId: session.sessionId,
        }),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(
        response,
        copy.requestFailed,
      );

      if (!response.ok || !data.ok) {
        throw new Error(copy.requestFailed);
      }

      setContact("");
      setMessage("");
      setStatus(copy.contactSubmitted);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ ...timelineCardStyle, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>{copy.contactTitle}</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {(["beta", "partner", "invest", "resource"] as ContactIntent[]).map(
          (option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIntent(option)}
              style={{
                ...secondaryButtonStyle,
                background: intent === option ? "#5eead4" : "#17243a",
                color: intent === option ? "#062423" : "#dbeafe",
              }}
            >
              {copy.contactOptions[option]}
            </button>
          ),
        )}
      </div>
      <input
        value={contact}
        onChange={(event) => setContact(event.target.value)}
        placeholder={copy.contactPlaceholder}
        style={inputStyle}
      />
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={copy.contactMessagePlaceholder}
        rows={3}
        style={{ ...inputStyle, marginTop: 10, resize: "vertical" }}
      />
      <button
        type="button"
        onClick={() => void submitContact()}
        disabled={isSubmitting}
        style={{ ...buttonStyle, marginTop: 10 }}
      >
        {isSubmitting ? copy.contactSubmitting : copy.contactSubmit}
      </button>
      <p style={{ ...mutedStyle, margin: "10px 0 0", fontSize: 12 }}>
        {copy.contactPrivacy}
      </p>
      {status ? <p style={{ ...mutedStyle, marginBottom: 0 }}>{status}</p> : null}
    </div>
  );
}

function EvidenceTab({
  session,
  ablationReport,
}: {
  session: SessionPageData;
  ablationReport: AblationReportData | null;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Simulation state</h2>
        {session.simulationState ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <h3>Individual</h3>
              <ul>
                <li>confidence: {formatMetric(session.simulationState.individual.confidence)}</li>
                <li>reputation: {formatMetric(session.simulationState.individual.reputation)}</li>
                <li>trust: {formatMetric(session.simulationState.individual.trust)}</li>
                <li>stress: {formatMetric(session.simulationState.individual.stress)}</li>
              </ul>
            </div>
            <div>
              <h3>Environment</h3>
              <ul>
                {Object.entries(session.simulationState.environmentMetrics).map(
                  ([name, value]) => (
                    <li key={name}>
                      {name}: {formatMetric(value)}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h3>Stakeholders</h3>
              <ul>
                {session.simulationState.stakeholders.slice(0, 6).map((stakeholder) => (
                  <li key={stakeholder.id}>
                    {stakeholder.role} ({stakeholder.stance}) trust{" "}
                    {formatMetric(stakeholder.trust)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p style={mutedStyle}>No simulation state.</p>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Ablation comparison</h2>
        {ablationReport ? (
          <>
            <p style={mutedStyle}>
              Influence events: {ablationReport.influenceEventCount}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 680,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {["Run", "Events", "Confidence", "Stress", "Society Trust", "Distance"].map(
                      (label) => (
                        <th key={label} style={tableHeaderStyle}>{label}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ablationReport.runs.map((run) => (
                    <tr key={run.mode}>
                      <td style={tableCellStyle}>{run.label}</td>
                      <td style={tableCellStyle}>
                        {run.includedEventCount}/{ablationReport.influenceEventCount}
                      </td>
                      <td style={tableCellStyle}>
                        {formatMetric(run.metrics.individual.confidence ?? 0)}
                      </td>
                      <td style={tableCellStyle}>
                        {formatMetric(run.metrics.individual.stress ?? 0)}
                      </td>
                      <td style={tableCellStyle}>
                        {formatMetric(run.metrics.society.averageTrust ?? 0)}
                      </td>
                      <td style={tableCellStyle}>
                        {(run.deltaFromFull?.totalDistance ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ablationReport.headlineInsights.length > 0 ? (
              <ul>
                {ablationReport.headlineInsights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p style={mutedStyle}>Choose a path to generate ablation evidence.</p>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Grounding and facts</h2>
        {session.pendingTurn?.groundingContext ? (
          <>
            <p style={mutedStyle}>
              {session.pendingTurn.groundingContext.scenarioTitle ?? "User grounding"} |{" "}
              {session.pendingTurn.groundingContext.worldContext.currentWorldPressure}
            </p>
            <ul>
              {session.pendingTurn.groundingContext.worldFactsUsed.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </>
        ) : (
          <p style={mutedStyle}>No preset grounding for this free-form session.</p>
        )}
        {session.userProvidedData ? (
          <>
            <p style={mutedStyle}>
              User sources: {session.userProvidedData.sources.length} | facts:{" "}
              {session.userProvidedData.factItems.length}
            </p>
            <ul>
              {session.userProvidedData.factItems.slice(0, 6).map((fact) => (
                <li key={fact.id}>
                  [{fact.type}] {fact.summary}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Influence events</h2>
        {(session.influenceEvents?.length ?? 0) === 0 ? (
          <p style={mutedStyle}>No collapsed influence events yet.</p>
        ) : (
          <ul>
            {session.influenceEvents?.map((event) => (
              <li key={event.id}>
                T{event.turn}: {event.sourceType}:{event.sourceId} -&gt;{" "}
                {event.targetType}:{event.targetId} | {event.dimension}{" "}
                {event.direction} {event.intensity.toFixed(2)} - {event.explanation}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatSelectedModel(session: SessionPageData): string {
  if (!session.modelConfig) {
    return "Server default";
  }

  return [
    session.modelConfig.provider,
    session.modelConfig.model ?? "provider default model",
    session.modelConfig.turnSimulator
      ? `simulator=${session.modelConfig.turnSimulator}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" / ");
}

function EngineTab({
  session,
  worldTraceRuns,
  worldTraceError,
  onReloadWorldTrace,
}: {
  session: SessionPageData;
  worldTraceRuns: WorldTraceRun[] | null;
  worldTraceError: string | null;
  onReloadWorldTrace: () => void;
}) {
  const trace = session.pendingTurn?.agentTrace;
  const latestGenerationFailure = session.generationFailures?.at(-1);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Working pipeline</h2>
        {trace ? (
          <>
            <p style={mutedStyle}>
              Selected: {formatSelectedModel(session)}
              <br />
              Actual: {trace.provider} / {trace.model}
              {latestGenerationFailure?.fallbackUsed ? (
                <>
                  <br />
                  Fallback: {latestGenerationFailure.message}
                </>
              ) : null}
              <br />
              Observer: {trace.observerState}
              <br />
              Pressure: {trace.environmentPressure}
            </p>
            <TraceList title="Human movement" items={trace.humanMovement} />
            <TraceList title="Environment dynamics" items={trace.environmentDynamics} />
            <TraceList title="Gemma / LLM steps" items={trace.generativeSteps} />
            <TraceList title="xMocha core steps" items={trace.deterministicSteps} />
          </>
        ) : (
          <p style={mutedStyle}>No pending engine trace. The session may be complete.</p>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Quantum trace</h2>
        {session.quantumTrace.length === 0 ? (
          <p style={mutedStyle}>No trace yet.</p>
        ) : (
          <ul>
            {session.quantumTrace.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        )}
      </section>

      {session.mode === "world" ? (
        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ marginTop: 0 }}>World runtime graph</h2>
            <button type="button" onClick={onReloadWorldTrace} className="secondary-button">
              Reload trace
            </button>
          </div>
          {worldTraceError ? (
            <p style={mutedStyle}>{worldTraceError}</p>
          ) : !worldTraceRuns || worldTraceRuns.length === 0 ? (
            <p style={mutedStyle}>No private World trace has been recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {worldTraceRuns.map((run) => (
                <div
                  key={`${run.traceId}-${run.attempt}`}
                  style={{
                    border: "1px solid #263b60",
                    borderRadius: 12,
                    padding: 12,
                    background: "rgba(8, 20, 40, 0.45)",
                  }}
                >
                  <p style={{ marginTop: 0 }}>
                    T{run.turn} · attempt {run.attempt} · {run.status}
                    {run.fallbackUsed ? " · fallback" : ""} · {run.provider} · {run.model}
                    {run.promptStyle ? ` · ${run.promptStyle} prompt` : ""}
                  </p>
                  {run.retryReason ? (
                    <p style={mutedStyle}>Fallback/retry reason: {run.retryReason}</p>
                  ) : null}
                  {run.validationIssueCodes.length > 0 ? (
                    <p style={mutedStyle}>
                      Issues: {run.validationIssueCodes.join(", ")}
                    </p>
                  ) : null}
                  <TraceList
                    title="Runtime nodes"
                    items={run.nodes.map((node) =>
                      `${node.kind}:${node.nodeId} · ${node.status} · ${node.durationMs}ms${
                        node.issueCodes.length ? ` · ${node.issueCodes.join(", ")}` : ""
                      }`,
                    )}
                  />
                  <TraceList
                    title="Candidate state previews"
                    items={run.candidateStatePreviews.map((preview) =>
                      `${preview.candidateId}: rev ${preview.parentRevision}->${preview.previewRevision}; active=${preview.activeCharacterIds.join(", ")}; events=${preview.eventQueueSnapshot?.filter((event) => event.status === "active").map((event) => event.id).join(", ") || "none"}; flags=${preview.worldFlags.slice(-3).join(", ")}; recent=${preview.recentEvents.at(-1) ?? ""}`,
                    )}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>User-authored actions</h2>
        {session.userAuthoredActions.length === 0 ? (
          <p style={mutedStyle}>No manual actions yet.</p>
        ) : (
          <ul>
            {session.userAuthoredActions.map((action) => (
              <li key={`${action.turn}-${action.title}-${action.rawInput}`}>
                T{action.turn}: {action.title} ({action.riskProfile}) -{" "}
                {action.rawInput}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TraceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ borderTop: "1px solid #263b60", paddingTop: 10, marginTop: 10 }}>
      <h3 style={{ margin: "0 0 6px" }}>{title}</h3>
      <ul style={{ marginTop: 0 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const percent = Math.round(clamp(value) * 100);

  return (
    <div style={{ marginBottom: 9 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 13,
          marginBottom: 5,
        }}
      >
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "#17243a",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
    </div>
  );
}

const timelineCardStyle: CSSProperties = {
  border: "1px solid #314d75",
  borderRadius: 8,
  background: "#091324",
  padding: 14,
  overflowWrap: "anywhere",
  minWidth: 0,
};

const tableHeaderStyle: CSSProperties = {
  borderBottom: "1px solid #314d75",
  padding: "9px 7px",
  textAlign: "left",
};

const tableCellStyle: CSSProperties = {
  borderBottom: "1px solid #263b60",
  padding: "9px 7px",
};

function riskColor(risk: RiskProfile): string {
  if (risk === "high") return "#fb7185";
  if (risk === "low") return "#5eead4";
  return "#fbbf24";
}

function stanceColor(stance: Stance): string {
  if (stance === "supportive") return "#5eead4";
  if (stance === "resistant") return "#fb7185";
  if (stance === "neutral") return "#93c5fd";
  return "#fbbf24";
}

function formatStance(stance: Stance, language?: string): string {
  if (language === "en") {
    return stance;
  }

  const labels: Record<Stance, string> = {
    supportive: "支持",
    resistant: "抗拒",
    neutral: "中立",
    uncertain: "不确定",
  };

  return labels[stance];
}

function formatRiskProfile(riskProfile: RiskProfile, language?: string): string {
  if (language === "en") {
    return riskProfile;
  }

  const labels: Record<RiskProfile, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };

  return labels[riskProfile];
}

function formatSessionStatus(status: string, language?: string): string {
  if (language === "en") return status;

  const labels: Record<string, string> = {
    active: "进行中",
    complete: "已完成",
    error: "出错",
  };

  return labels[status] ?? status;
}

function formatThemeName(theme: string, language?: string): string {
  if (language === "en") return theme;

  const labels: Record<string, string> = {
    adventure: "冒险",
    "sci-fi": "科幻",
    dream: "梦境",
    hell: "地狱",
    humorous: "幽默",
  };

  return labels[theme] ?? theme;
}

function formatVisualStyleName(style: string, language?: string): string {
  if (language === "en") return style;

  const labels: Record<string, string> = {
    "career-studio": "职业工作室",
    "city-apartment": "城市公寓",
    "night-cafe": "夜间咖啡馆",
  };

  return labels[style] ?? style;
}

function formatCollapseCue(cue: VisualScene["collapseCue"], language?: string): string {
  if (language === "en") {
    return cue;
  }

  const labels: Record<VisualScene["collapseCue"], string> = {
    split: "分叉收束",
    pull: "被选择拉近",
    echo: "回声沉淀",
    "pressure-rise": "压力上升",
  };

  return labels[cue];
}

function formatMetricName(name: string, language?: string): string {
  if (language === "en") {
    return name;
  }

  const labels: Record<string, string> = {
    behavior: "行为倾向",
    momentum: "推进感",
    opportunity: "机会感",
    pressure: "压力",
    risk: "风险",
    trust: "信任",
  };

  return labels[name] ?? name;
}

function formatEventActorType(type: string, language?: string): string {
  if (language === "en") {
    return type;
  }

  const labels: Record<string, string> = {
    individual: "个人",
    society: "关系",
    environment: "环境",
  };

  return labels[type] ?? type;
}

function formatEventDimension(dimension: string, language?: string): string {
  if (language === "en") {
    return dimension;
  }

  const labels: Record<string, string> = {
    trust: "信任",
    risk: "风险",
    behavior: "行为",
    opportunity: "机会",
    pressure: "压力",
  };

  return labels[dimension] ?? dimension;
}

function formatEventDirection(direction: string, language?: string): string {
  if (language === "en") {
    return direction;
  }

  const labels: Record<string, string> = {
    increase: "上升",
    decrease: "下降",
    redirect: "转向",
  };

  return labels[direction] ?? direction;
}

function inferSessionDecisionKind(session: SessionPageData): string {
  return inferDilemmaKindFromText(
    [
      session.dilemma,
      ...session.canonicalPath.flatMap((step) => [
        step.title,
        step.summary ?? "",
        step.consequence,
      ]),
      ...(session.shadowTimelines ?? []).flatMap((branches) =>
        branches.flatMap((branch) => [
          branch.title,
          branch.consequence,
        ]),
      ),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function chineseIndividualMetricLabels(decisionKind: string): {
  reputation: string;
  trust: string;
  financialStability: string;
} {
  if (decisionKind === "food") {
    return {
      reputation: "满意预期",
      trust: "安心感",
      financialStability: "资源余量",
    };
  }

  if (decisionKind !== "career" && decisionKind !== "project") {
    return {
      reputation: "外部反馈",
      trust: "安心感",
      financialStability: "资源余量",
    };
  }

  return {
    reputation: "声誉",
    trust: "信任",
    financialStability: "财务稳定性",
  };
}

function hasRecoverableGenerationGap(session: SessionPageData): boolean {
  return (
    session.status === "active" &&
    !session.pendingTurn &&
    session.canonicalPath.length > 0 &&
    (session.generationFailures?.some((failure) => failure.recoverable) ?? false)
  );
}

function getRecoverableGenerationMessage(
  session: SessionPageData,
  fallback: string,
): string {
  const latestFailure = session.generationFailures
    ?.filter((failure) => failure.recoverable)
    .at(-1);

  return latestFailure?.message ? `${fallback}` : fallback;
}

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof ClipboardItem === "undefined" ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== "function"
  ) {
    return false;
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || "image/png"]: blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  return `${Math.round(clamp(value) * 100)}%`;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function buildSessionReportMarkdown(
  session: SessionPageData,
  ablationReport: AblationReportData | null,
): string {
  if (session.language !== "en") {
    return buildChineseSessionReportMarkdown(session, ablationReport);
  }

  const lines: string[] = [
    "# xMocha Decision Simulation Report",
    "",
    `- Session: ${session.sessionId}`,
    `- Status: ${session.status}`,
    `- Turns: ${session.turn}/${session.maxTurns}`,
    `- Theme: ${session.theme}`,
    `- Visual style: ${session.visualStyle ?? "career-studio"}`,
    `- Exported at: ${new Date().toISOString()}`,
    "",
    "## Dilemma",
    "",
    session.dilemma,
    "",
  ];

  if (session.summary) {
    lines.push("## Final Summary", "", session.summary.narrative, "");
    appendList(lines, "Decision arc", session.summary.decisionArc);
    if (session.summary.alternateHint) {
      lines.push("Alternate hint:", "", session.summary.alternateHint, "");
    }
  } else {
    lines.push("## Current Summary", "", "Final summary is not available yet.", "");
  }

  lines.push("## Complete Procedure", "");

  if (session.canonicalPath.length === 0) {
    lines.push("No collapsed choices yet.", "");
  } else {
    for (const step of session.canonicalPath) {
      lines.push(`### Turn ${step.turn}: ${step.title}`, "");
      lines.push(`- Selected branch: ${step.id ?? "custom/user-authored"}`);
      lines.push(`- Risk profile: ${step.riskProfile ?? "n/a"}`);
      if (step.summary) {
        lines.push(`- Summary: ${step.summary}`);
      }
      lines.push(`- Consequence: ${step.consequence}`, "");

      const authoredAction = session.userAuthoredActions.find(
        (action) => action.turn === step.turn,
      );
      if (authoredAction) {
        lines.push("User-authored action:", "");
        lines.push(`- Title: ${authoredAction.title}`);
        lines.push(`- Risk profile: ${authoredAction.riskProfile}`);
        lines.push(`- Raw input: ${authoredAction.rawInput}`, "");
      }

      const shadows = session.shadowTimelines[step.turn - 1] ?? [];
      appendBranchList(lines, "Shadow futures", shadows);

      const visualMemory = session.visualHistory?.find(
        (entry) => entry.turn === step.turn,
      );
      if (visualMemory) {
        lines.push("Visual memory:", "");
        lines.push(`- Memory: ${visualMemory.memoryLabel}`);
        lines.push(`- Selected: ${visualMemory.selectedBranchTitle}`);
        lines.push(`- Room atmosphere: ${visualMemory.scene.room.atmosphere}`);
        lines.push(`- Collapse cue: ${visualMemory.scene.collapseCue}`);
        appendList(lines, "Shadow labels", visualMemory.shadowLabels);
      }

      const grounding = session.groundingLog.find((entry) => entry.turn === step.turn);
      if (grounding) {
        lines.push("Grounding used:", "");
        lines.push(
          `- World pressure: ${grounding.groundingContext.worldContextSummary.currentWorldPressure}`,
        );
        appendList(lines, "World facts", grounding.groundingContext.worldFactsUsed);
        appendList(
          lines,
          "Social tensions",
          grounding.groundingContext.socialTensionsUsed,
        );
        appendList(
          lines,
          "Role cast",
          grounding.groundingContext.roleCastUsed.map(
            (role) =>
              `${role.role} (${role.relationship}, ${role.baselineStance})`,
          ),
        );
      }
    }
  }

  if (session.pendingTurn) {
    lines.push("## Pending Turn", "", `Turn ${session.pendingTurn.turnNumber}`, "");
    appendBranchList(lines, "Available branches", session.pendingTurn.branches);
    appendList(
      lines,
      "World deltas",
      session.pendingTurn.branchWorldDeltas.map(
        (delta) =>
          `${delta.branchId}: ${delta.pressureShift}; constraints=${delta.activatedConstraints.join(", ") || "none"}; opportunities=${delta.activatedOpportunities.join(", ") || "none"}`,
      ),
    );
    appendList(
      lines,
      "Community dynamics",
      session.pendingTurn.branchCommunities.map(
        (community) =>
          `${community.branchId}: ${community.socialDynamics} | ${community.dominantNarrative}`,
      ),
    );
    if (session.pendingTurn.agentTrace) {
      lines.push("Engine trace:", "");
      appendList(lines, "Human movement", session.pendingTurn.agentTrace.humanMovement);
      appendList(
        lines,
        "Environment dynamics",
        session.pendingTurn.agentTrace.environmentDynamics,
      );
      appendList(lines, "Gemma / LLM steps", session.pendingTurn.agentTrace.generativeSteps);
      appendList(
        lines,
        "Deterministic steps",
        session.pendingTurn.agentTrace.deterministicSteps,
      );
    }
  }

  lines.push("## User Context And Evidence", "");

  if (session.userContextPack) {
    lines.push(`- Goal: ${session.userContextPack.userGoal}`);
    lines.push(`- Current position: ${session.userContextPack.currentPosition}`);
    lines.push(`- Risk preference: ${session.userContextPack.riskPreference}`);
    lines.push(`- Time horizon: ${session.userContextPack.timeHorizon}`, "");
    appendList(lines, "Personal constraints", session.userContextPack.personalConstraints);
    appendList(lines, "Key stakeholders", session.userContextPack.keyStakeholders);
    appendList(lines, "Success criteria", session.userContextPack.successCriteria);
  }

  if (session.userProvidedData) {
    appendList(
      lines,
      "Grounding sources",
      session.userProvidedData.sources.map(
        (source) => `${source.title} (${source.kind}, ${source.content.length} chars)`,
      ),
    );
    appendList(
      lines,
      "Derived user facts",
      session.userProvidedData.factItems.map(
        (fact) =>
          `[${fact.type}] ${fact.summary} (${Math.round(fact.confidence * 100)}% confidence)`,
      ),
    );
  }

  lines.push("## Final Simulation State", "");
  if (session.simulationState) {
    const individual = session.simulationState.individual;
    lines.push(`- Scope: ${session.simulationState.scope}`);
    lines.push(`- Confidence: ${formatMetric(individual.confidence)}`);
    lines.push(`- Stress: ${formatMetric(individual.stress)}`);
    lines.push(`- Reputation: ${formatMetric(individual.reputation)}`);
    lines.push(`- Trust: ${formatMetric(individual.trust)}`);
    lines.push(`- Financial stability: ${formatMetric(individual.financialStability)}`);
    appendList(
      lines,
      "Environment metrics",
      Object.entries(session.simulationState.environmentMetrics).map(
        ([name, value]) => `${name}: ${formatMetric(value)}`,
      ),
    );
    appendList(
      lines,
      "Stakeholders",
      session.simulationState.stakeholders.map(
        (stakeholder) =>
          `${stakeholder.role}: ${stakeholder.stance}, trust=${formatMetric(stakeholder.trust)}, influence=${formatMetric(stakeholder.influence)}, goal=${stakeholder.currentGoal}`,
      ),
    );
  }

  appendList(
    lines,
    "Influence events",
    (session.influenceEvents ?? []).map(
      (event) =>
        `T${event.turn} ${event.sourceType}:${event.sourceId} -> ${event.targetType}:${event.targetId}; ${event.dimension} ${event.direction} ${event.intensity.toFixed(2)}; ${event.explanation}`,
    ),
  );

  if (ablationReport) {
    lines.push("## Ablation Report", "");
    lines.push(`- Influence events: ${ablationReport.influenceEventCount}`);
    appendList(lines, "Headline insights", ablationReport.headlineInsights);
    appendList(
      lines,
      "Runs",
      ablationReport.runs.map(
        (run) =>
          `${run.label}: included ${run.includedEventCount}; confidence=${formatMetric(run.metrics.individual.confidence ?? 0)}; stress=${formatMetric(run.metrics.individual.stress ?? 0)}; distance=${(run.deltaFromFull?.totalDistance ?? 0).toFixed(2)}`,
      ),
    );
  }

  appendList(lines, "Quantum trace", session.quantumTrace);

  if (session.userProvidedData?.sources.length) {
    lines.push("## Full User Sources", "");
    for (const source of session.userProvidedData.sources) {
      lines.push(`### ${source.title}`, "");
      lines.push(`Kind: ${source.kind}`, "");
      lines.push("````text", source.content, "````", "");
    }
  }

  return lines.join("\n");
}

function buildChineseSessionReportMarkdown(
  session: SessionPageData,
  ablationReport: AblationReportData | null,
): string {
  const decisionKind = inferSessionDecisionKind(session);
  const individualLabels = chineseIndividualMetricLabels(decisionKind);
  const lines: string[] = [
    "# xMocha 决策模拟报告",
    "",
    `- 会话: ${session.sessionId}`,
    `- 状态: ${formatSessionStatus(session.status, session.language)}`,
    `- 轮次: ${session.turn}/${session.maxTurns}`,
    `- 主题: ${formatThemeName(session.theme, session.language)}`,
    `- 房间风格: ${formatVisualStyleName(session.visualStyle ?? "career-studio", session.language)}`,
    `- 导出时间: ${new Date().toISOString()}`,
    "",
    "## 困境",
    "",
    session.dilemma,
    "",
  ];

  if (session.summary) {
    lines.push("## 最终总结", "", session.summary.narrative, "");
    appendList(lines, "决策弧线", session.summary.decisionArc);
    if (session.summary.alternateHint) {
      lines.push("未选路径提示:", "", session.summary.alternateHint, "");
    }
  } else {
    lines.push("## 当前总结", "", "路径完成后会生成最终总结。", "");
  }

  lines.push("## 完整过程", "");

  if (session.canonicalPath.length === 0) {
    lines.push("还没有坍缩选择。", "");
  } else {
    for (const step of session.canonicalPath) {
      lines.push(`### 第 ${step.turn} 轮：${step.title}`, "");
      lines.push(`- 已选分支: ${step.id ?? "自定义行动"}`);
      lines.push(`- 风险画像: ${step.riskProfile ? formatRiskProfile(step.riskProfile) : "n/a"}`);
      if (step.summary) {
        lines.push(`- 摘要: ${step.summary}`);
      }
      lines.push(`- 结果: ${step.consequence}`, "");

      const authoredAction = session.userAuthoredActions.find(
        (action) => action.turn === step.turn,
      );
      if (authoredAction) {
        lines.push("用户手动行动:", "");
        lines.push(`- 标题: ${authoredAction.title}`);
        lines.push(`- 风险画像: ${formatRiskProfile(authoredAction.riskProfile as RiskProfile)}`);
        lines.push(`- 原始输入: ${authoredAction.rawInput}`, "");
      }

      const shadows = session.shadowTimelines[step.turn - 1] ?? [];
      appendBranchListLocalized(lines, "影子未来", shadows);

      const visualMemory = session.visualHistory?.find(
        (entry) => entry.turn === step.turn,
      );
      if (visualMemory) {
        lines.push("视觉记忆:", "");
        lines.push(`- 记忆: ${visualMemory.memoryLabel}`);
        lines.push(`- 已选: ${visualMemory.selectedBranchTitle}`);
        lines.push(`- 房间氛围: ${visualMemory.scene.room.atmosphere}`);
        lines.push(`- 坍缩提示: ${formatCollapseCue(visualMemory.scene.collapseCue)}`);
        appendList(lines, "影子标签", visualMemory.shadowLabels);
      }

      const grounding = session.groundingLog.find((entry) => entry.turn === step.turn);
      if (grounding) {
        lines.push("使用的依据:", "");
        lines.push(
          `- 世界压力: ${grounding.groundingContext.worldContextSummary.currentWorldPressure}`,
        );
        appendList(lines, "世界事实", grounding.groundingContext.worldFactsUsed);
        appendList(
          lines,
          "社会张力",
          grounding.groundingContext.socialTensionsUsed,
        );
        appendList(
          lines,
          "角色关系",
          grounding.groundingContext.roleCastUsed.map(
            (role) =>
              `${role.role} (${role.relationship}, ${role.baselineStance})`,
          ),
        );
      }
    }
  }

  if (session.pendingTurn) {
    lines.push(
      "## 当前待选轮次",
      "",
      `第 ${session.pendingTurn.turnNumber} 轮`,
      "",
    );
    appendBranchListLocalized(lines, "可选分支", session.pendingTurn.branches);
    appendList(
      lines,
      "世界变化",
      session.pendingTurn.branchWorldDeltas.map(
        (delta) =>
          `${delta.branchId}: ${delta.pressureShift}; 约束=${delta.activatedConstraints.join(", ") || "无"}; 机会=${delta.activatedOpportunities.join(", ") || "无"}`,
      ),
    );
    appendList(
      lines,
      "社群动态",
      session.pendingTurn.branchCommunities.map(
        (community) =>
          `${community.branchId}: ${community.socialDynamics} | ${community.dominantNarrative}`,
      ),
    );
    if (session.pendingTurn.agentTrace) {
      lines.push("引擎轨迹:", "");
      appendList(lines, "人的移动", session.pendingTurn.agentTrace.humanMovement);
      appendList(
        lines,
        "环境动态",
        session.pendingTurn.agentTrace.environmentDynamics,
      );
      appendList(lines, "Gemma / LLM 步骤", session.pendingTurn.agentTrace.generativeSteps);
      appendList(
        lines,
        "xMocha 确定性步骤",
        session.pendingTurn.agentTrace.deterministicSteps,
      );
    }
  }

  lines.push("## 用户背景与证据", "");

  if (session.userContextPack) {
    lines.push(`- 目标: ${session.userContextPack.userGoal}`);
    lines.push(`- 当前处境: ${session.userContextPack.currentPosition}`);
    lines.push(`- 风险偏好: ${session.userContextPack.riskPreference}`);
    lines.push(`- 时间范围: ${session.userContextPack.timeHorizon}`, "");
    appendList(lines, "个人约束", session.userContextPack.personalConstraints);
    appendList(lines, "关键利益相关者", session.userContextPack.keyStakeholders);
    appendList(lines, "成功标准", session.userContextPack.successCriteria);
  }

  if (session.userProvidedData) {
    appendList(
      lines,
      "用户上传/补充资料",
      session.userProvidedData.sources.map(
        (source) => `${source.title} (${source.kind}, ${source.content.length} 字符)`,
      ),
    );
    appendList(
      lines,
      "提取出的用户事实",
      session.userProvidedData.factItems.map(
        (fact) =>
          `[${fact.type}] ${fact.summary} (${Math.round(fact.confidence * 100)}% 置信度)`,
      ),
    );
  }

  lines.push("## 最终模拟状态", "");
  if (session.simulationState) {
    const individual = session.simulationState.individual;
    lines.push(`- 范围: ${session.simulationState.scope}`);
    lines.push(`- 信心: ${formatMetric(individual.confidence)}`);
    lines.push(`- 压力: ${formatMetric(individual.stress)}`);
    lines.push(`- ${individualLabels.reputation}: ${formatMetric(individual.reputation)}`);
    lines.push(`- ${individualLabels.trust}: ${formatMetric(individual.trust)}`);
    lines.push(`- ${individualLabels.financialStability}: ${formatMetric(individual.financialStability)}`);
    appendList(
      lines,
      "环境指标",
      Object.entries(session.simulationState.environmentMetrics).map(
        ([name, value]) => `${formatMetricName(name)}: ${formatMetric(value)}`,
      ),
    );
    appendList(
      lines,
      "利益相关者",
      session.simulationState.stakeholders.map(
        (stakeholder) =>
          `${stakeholder.role}: ${formatStance(stakeholder.stance)}, 信任=${formatMetric(stakeholder.trust)}, 影响力=${formatMetric(stakeholder.influence)}, 目标=${stakeholder.currentGoal}`,
      ),
    );
  }

  appendList(
    lines,
    "影响事件",
    (session.influenceEvents ?? []).map(
      (event) =>
        `第 ${event.turn} 轮 ${formatEventActorType(event.sourceType)}:${event.sourceId} -> ${formatEventActorType(event.targetType)}:${event.targetId}; ${formatEventDimension(event.dimension)} ${formatEventDirection(event.direction)} ${event.intensity.toFixed(2)}; ${event.explanation}`,
    ),
  );

  if (ablationReport) {
    lines.push("## Ablation 报告", "");
    lines.push(`- 影响事件: ${ablationReport.influenceEventCount}`);
    appendList(lines, "关键洞察", ablationReport.headlineInsights);
    appendList(
      lines,
      "运行结果",
      ablationReport.runs.map(
        (run) =>
          `${run.label}: 包含 ${run.includedEventCount}; 信心=${formatMetric(run.metrics.individual.confidence ?? 0)}; 压力=${formatMetric(run.metrics.individual.stress ?? 0)}; 距离=${(run.deltaFromFull?.totalDistance ?? 0).toFixed(2)}`,
      ),
    );
  }

  appendList(lines, "路径痕迹", session.quantumTrace);

  if (session.userProvidedData?.sources.length) {
    lines.push("## 用户原始资料", "");
    for (const source of session.userProvidedData.sources) {
      lines.push(`### ${source.title}`, "");
      lines.push(`类型: ${source.kind}`, "");
      lines.push("````text", source.content, "````", "");
    }
  }

  return lines.join("\n");
}

function appendList(lines: string[], title: string, items: string[] | undefined) {
  if (!items || items.length === 0) {
    return;
  }

  lines.push(`${title}:`, "");
  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push("");
}

function appendBranchList(
  lines: string[],
  title: string,
  branches: Array<{
    title: string;
    consequence: string;
    riskProfile?: RiskProfile;
    score?: number;
    timeHorizon?: string;
    keyUncertainty?: string;
  }>,
) {
  if (branches.length === 0) {
    return;
  }

  lines.push(`${title}:`, "");
  for (const branch of branches) {
    lines.push(`- ${branch.title}`);
    lines.push(`  - Consequence: ${branch.consequence}`);
    if (branch.riskProfile) {
      lines.push(`  - Risk: ${branch.riskProfile}`);
    }
    if (branch.timeHorizon) {
      lines.push(`  - Time horizon: ${branch.timeHorizon}`);
    }
    if (branch.keyUncertainty) {
      lines.push(`  - Key uncertainty: ${branch.keyUncertainty}`);
    }
    if (typeof branch.score === "number") {
      lines.push(`  - Score: ${branch.score.toFixed(2)}`);
    }
  }
  lines.push("");
}

function appendBranchListLocalized(
  lines: string[],
  title: string,
  branches: Array<{
    title: string;
    consequence: string;
    riskProfile?: RiskProfile;
    score?: number;
    timeHorizon?: string;
    keyUncertainty?: string;
  }>,
) {
  if (branches.length === 0) {
    return;
  }

  lines.push(`${title}:`, "");
  for (const branch of branches) {
    lines.push(`- ${branch.title}`);
    lines.push(`  - 结果: ${branch.consequence}`);
    if (branch.riskProfile) {
      lines.push(`  - 风险: ${formatRiskProfile(branch.riskProfile)}`);
    }
    if (branch.timeHorizon) {
      lines.push(`  - 时间范围: ${branch.timeHorizon}`);
    }
    if (branch.keyUncertainty) {
      lines.push(`  - 关键不确定性: ${branch.keyUncertainty}`);
    }
    if (typeof branch.score === "number") {
      lines.push(`  - 权重: ${branch.score.toFixed(2)}`);
    }
  }
  lines.push("");
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "session";
}
