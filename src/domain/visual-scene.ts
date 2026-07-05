import { inferDilemmaKind } from "./dilemma-kind";
import type {
  Branch,
  BranchVisualCue,
  RoomObjectCue,
  StakeholderVisualCue,
  TurnGenerationInput,
  TurnSimulationResult,
  TurnVisualScene,
  VisualHistoryEntry,
  VisualPosition,
} from "./types";

const PORTAL_POSITIONS: VisualPosition[] = ["left", "center", "right", "upper-right"];
const STAKEHOLDER_POSITIONS: VisualPosition[] = [
  "upper-left",
  "upper-right",
  "lower-left",
  "lower-right",
  "left",
  "right",
];

const STYLE_PALETTES = {
  "career-studio": ["#0f172a", "#38bdf8", "#5eead4", "#f8fafc"],
  "city-apartment": ["#172033", "#f59e0b", "#60a5fa", "#f8fafc"],
  "night-cafe": ["#15111f", "#c084fc", "#fb7185", "#f8fafc"],
} as const;

export function ensureTurnVisualScene<T extends TurnSimulationResult>(
  input: TurnGenerationInput,
  result: T,
): T & { visualScene: TurnVisualScene } {
  const fallback = buildFallbackTurnVisualScene(input, result);
  const provided = result.visualScene;

  if (!provided) {
    return {
      ...result,
      visualScene: fallback,
    };
  }

  const visualScene: TurnVisualScene = {
      ...fallback,
      ...provided,
      avatar: {
        ...fallback.avatar,
        ...provided.avatar,
        energy: clamp(provided.avatar.energy),
      },
      room: {
        ...fallback.room,
        ...provided.room,
        colorPalette:
          provided.room.colorPalette.length >= 3
            ? provided.room.colorPalette.slice(0, 5)
            : fallback.room.colorPalette,
        objects:
          provided.room.objects.length > 0
            ? provided.room.objects
            : fallback.room.objects,
        pressureIndicators:
          provided.room.pressureIndicators.length > 0
            ? provided.room.pressureIndicators
            : fallback.room.pressureIndicators,
      },
      branchPortals: reconcileBranchPortals(
        result.branches,
        provided.branchPortals,
        fallback.branchPortals,
      ),
      stakeholders:
        provided.stakeholders.length > 0
          ? provided.stakeholders.map((stakeholder) => ({
              ...stakeholder,
              influence: clamp(stakeholder.influence),
            }))
          : fallback.stakeholders,
  };

  return {
    ...result,
    visualScene: localizeVisualScene(input.session.language, visualScene),
  };
}

export function buildVisualHistoryEntry(params: {
  turnResult: TurnSimulationResult;
  selectedBranchId: string;
}): VisualHistoryEntry | undefined {
  const selectedBranch = params.turnResult.branches.find(
    (branch) => branch.id === params.selectedBranchId,
  );

  if (!selectedBranch || !params.turnResult.visualScene) {
    return undefined;
  }

  const shadowLabels = params.turnResult.branches
    .filter((branch) => branch.id !== params.selectedBranchId)
    .map((branch) => branch.title);

  return {
    turn: params.turnResult.turnNumber,
    selectedBranchId: selectedBranch.id,
    selectedBranchTitle: selectedBranch.title,
    memoryLabel: `${selectedBranch.title} -> ${selectedBranch.consequence}`,
    shadowLabels,
    scene: params.turnResult.visualScene,
  };
}

function buildFallbackTurnVisualScene(
  input: TurnGenerationInput,
  result: TurnSimulationResult,
): TurnVisualScene {
  const { session, worldContext } = input;
  const state = session.simulationState;
  const style = session.visualStyle ?? "career-studio";
  const palette = STYLE_PALETTES[style];
  const confidence = state.individual.confidence;
  const stress = state.individual.stress;
  const adaptation = state.individual.skills.adaptation ?? 0.5;
  const pressure = state.environmentMetrics.pressure ?? 0.45;
  const opportunity = state.environmentMetrics.opportunity ?? 0.5;
  const useChinese = session.language !== "en";
  const dilemmaKind = inferDilemmaKind(session);

  return {
    mode: "avatar-room",
    style,
    turnNumber: result.turnNumber,
    avatar: {
      posture:
        useChinese
          ? stress > 0.68
            ? "身体前倾，承受压力"
            : confidence > 0.62
              ? "站直，准备行动"
              : "安静观察，正在评估"
          : stress > 0.68
            ? "forward-leaning under pressure"
            : confidence > 0.62
              ? "upright and ready to act"
              : "still, watchful, and evaluating",
      expression:
        useChinese
          ? stress > 0.68
            ? "紧绷专注"
            : opportunity > 0.6
              ? "警觉的好奇"
              : "克制而集中"
          : stress > 0.68
            ? "tense focus"
            : opportunity > 0.6
              ? "alert curiosity"
              : "measured concentration",
      energy: clamp((confidence + adaptation + (1 - stress)) / 3),
      stressSignal:
        useChinese
          ? stress > 0.68
            ? "肩部周围出现尖锐脉冲线"
            : stress > 0.45
              ? "桌面附近出现淡淡压力环"
              : "低频环境嗡鸣"
          : stress > 0.68
            ? "sharp pulse lines around the shoulders"
            : stress > 0.45
              ? "faint pressure ring near the desk"
              : "low ambient hum",
      focusAura:
        useChinese
          ? adaptation > 0.65
            ? "青绿色适应光"
            : confidence > 0.6
              ? "蓝色信心场"
              : "柔和银色不确定感"
          : adaptation > 0.65
            ? "teal adaptive glow"
            : confidence > 0.6
              ? "blue confidence field"
              : "soft silver uncertainty",
    },
    room: {
      atmosphere:
        dilemmaKind === "food"
          ? useChinese
            ? pressure > 0.65
              ? "菜单和时间一起变得有点拥挤"
              : opportunity > 0.6
                ? "带着节日气味的明亮餐桌"
                : "安静等你决定吃什么的餐桌"
            : pressure > 0.65
              ? "menu choices and timing feel a little crowded"
              : opportunity > 0.6
                ? "bright table with a festival feeling"
                : "quiet table waiting for a meal choice"
          : useChinese
          ? pressure > 0.65
            ? "被决策压力压缩的房间"
            : opportunity > 0.6
              ? "出现多条未来信号的开放房间"
              : "安静等待观察的房间"
          : pressure > 0.65
            ? "compressed room with visible decision pressure"
            : opportunity > 0.6
              ? "open room with several future-facing signals"
              : "quiet room waiting for observation",
      lighting:
        dilemmaKind === "food"
          ? useChinese
            ? style === "night-cafe"
              ? "带暖边的餐桌灯光"
              : style === "city-apartment"
                ? "厨房和窗边的自然光"
                : "柔和但清楚的餐桌灯"
            : style === "night-cafe"
              ? "warm-edged table light"
              : style === "city-apartment"
                ? "kitchen and window daylight"
                : "soft clear table light"
          : useChinese
          ? style === "night-cafe"
            ? "带暖边的紫色桌灯"
            : style === "city-apartment"
              ? "城市傍晚窗光"
              : "带仪表反光的冷色工作室灯"
          : style === "night-cafe"
            ? "violet table light with warm edges"
            : style === "city-apartment"
              ? "late-city window light"
              : "cool studio light with dashboard reflections",
      colorPalette: [...palette],
      objects: buildRoomObjects(input, pressure, opportunity),
      pressureIndicators: [
        worldContext.currentWorldPressure,
        ...worldContext.constraints.slice(0, 2),
      ],
    },
    branchPortals: result.branches.map((branch, index) =>
      branchPortalForBranch(branch, index, useChinese),
    ),
    stakeholders: buildStakeholderVisuals(input),
    collapseCue:
      pressure > 0.65
        ? "pressure-rise"
        : result.branches.some((branch) => branch.riskProfile === "high")
          ? "split"
          : "echo",
    caption:
      session.language === "en"
        ? "The room rearranges itself around the next observable futures."
        : "房间正在围绕下一组可观测未来重新排列。",
  };
}

function buildRoomObjects(
  input: TurnGenerationInput,
  pressure: number,
  opportunity: number,
): RoomObjectCue[] {
  const style = input.session.visualStyle ?? "career-studio";
  const useChinese = input.session.language !== "en";
  const dilemmaKind = inferDilemmaKind(input.session);

  if (dilemmaKind === "food") {
    return [
      {
        id: "meal-table",
        label: useChinese ? "今天的餐桌" : "today's table",
        type: "desk",
        position: "center",
        state: useChinese
          ? pressure > 0.6
            ? "摆着太多候选菜单"
            : "留着一个空位等待选择"
          : pressure > 0.6
            ? "covered with too many menu options"
            : "one empty place waiting for a choice",
        description: useChinese
          ? "这顿饭真正会发生的地方。"
          : "Where the meal will actually happen.",
      },
      {
        id: "festival-window",
        label: useChinese ? "节日窗口" : "festival window",
        type: "window",
        position: "upper-right",
        state: useChinese
          ? opportunity > 0.6
            ? "透进一点热闹气"
            : "安静但提醒今天不太一样"
          : opportunity > 0.6
            ? "letting in a little bustle"
            : "quiet but marking the day as different",
        description: input.worldContext.externalConditions,
      },
      {
        id: "taste-map",
        label: useChinese ? "口味地图" : "taste map",
        type: "map",
        position: "left",
        state:
          useChinese
            ? input.session.quantumTrace.length > 0
              ? "被刚才的偏好标记"
              : "空白，等待真实胃口"
            : input.session.quantumTrace.length > 0
              ? "marked by recent preferences"
              : "blank and waiting for appetite",
        description: useChinese
          ? "把节日感、方便、胃口和陪伴放到同一张图上。"
          : "Maps ritual, convenience, appetite, and company together.",
      },
    ];
  }

  const mainSurface =
    useChinese
      ? style === "night-cafe"
        ? "夜间桌面"
        : style === "city-apartment"
          ? "城市书桌"
          : "决策控制台"
      : style === "night-cafe"
        ? "table"
        : style === "city-apartment"
          ? "desk"
          : "console";

  return [
    {
      id: "decision-surface",
      label: mainSurface,
      type: "desk",
      position: "center",
      state: useChinese
        ? pressure > 0.6
          ? "铺满互相竞争的信号"
          : "有序但正在运行"
        : pressure > 0.6
          ? "covered with competing signals"
          : "organized but active",
      description: useChinese
        ? "观察者在坍缩前比较未来的地方。"
        : "The place where the observer compares futures before collapse.",
    },
    {
      id: "world-window",
      label: useChinese ? "世界窗口" : "world window",
      type: "window",
      position: "upper-right",
      state: useChinese
        ? opportunity > 0.6
          ? "被机会照亮"
          : "部分被云层遮住"
        : opportunity > 0.6
          ? "bright with openings"
          : "partly clouded",
      description: input.worldContext.externalConditions,
    },
    {
      id: "trace-map",
      label: useChinese ? "痕迹地图" : "trace map",
      type: "map",
      position: "left",
      state:
        useChinese
          ? input.session.quantumTrace.length > 0
            ? "被过往选择标记"
            : "空白，等待记录"
          : input.session.quantumTrace.length > 0
            ? "marked by prior choices"
            : "blank and waiting",
      description: useChinese
        ? "canonical path 和影子时间线的视觉记忆。"
        : "A visual memory of the canonical path and shadow timelines.",
    },
  ];
}

function buildStakeholderVisuals(input: TurnGenerationInput): StakeholderVisualCue[] {
  const useChinese = input.session.language !== "en";

  return input.session.simulationState.stakeholders
    .slice(0, 6)
    .map((stakeholder, index) => ({
      stakeholderId: stakeholder.id,
      label: stakeholder.role,
      stance: stakeholder.stance,
      position: STAKEHOLDER_POSITIONS[index] ?? "right",
      influence: clamp(stakeholder.influence),
      mood:
        useChinese
          ? stakeholder.stance === "supportive"
            ? "温暖信号"
            : stakeholder.stance === "resistant"
              ? "红色摩擦"
              : stakeholder.stance === "neutral"
                ? "稳定观察"
                : "不确定闪烁"
          : stakeholder.stance === "supportive"
            ? "warm signal"
            : stakeholder.stance === "resistant"
              ? "red friction"
              : stakeholder.stance === "neutral"
                ? "steady watch"
                : "uncertain flicker",
    }));
}

function branchPortalForBranch(
  branch: Branch,
  index: number,
  useChinese: boolean,
): BranchVisualCue {
  return {
    branchId: branch.id,
    portalLabel: branch.title,
    position: PORTAL_POSITIONS[index] ?? "right",
    color:
      branch.riskProfile === "high"
        ? "#fb7185"
        : branch.riskProfile === "low"
          ? "#5eead4"
          : "#fbbf24",
    symbol:
      useChinese
        ? branch.riskProfile === "high"
          ? "跃迁"
          : branch.riskProfile === "low"
            ? "锚点"
            : "桥接"
        : branch.riskProfile === "high"
          ? "surge"
          : branch.riskProfile === "low"
            ? "anchor"
            : "bridge",
    motion:
      useChinese
        ? branch.riskProfile === "high"
          ? "快速脉冲"
          : branch.riskProfile === "low"
            ? "缓慢环绕"
            : "左右微光摆动"
        : branch.riskProfile === "high"
          ? "fast pulse"
          : branch.riskProfile === "low"
            ? "slow orbit"
            : "side-to-side shimmer",
    roomEffect:
      useChinese
        ? branch.riskProfile === "high"
          ? "提高曝光与可见度"
          : branch.riskProfile === "low"
            ? "稳定房间但降低紧迫感"
            : "同时点亮两条路径"
        : branch.riskProfile === "high"
          ? "raises exposure and visibility"
          : branch.riskProfile === "low"
            ? "stabilizes the room but reduces urgency"
            : "keeps two paths lit at once",
  };
}

function reconcileBranchPortals(
  branches: Branch[],
  provided: BranchVisualCue[],
  fallback: BranchVisualCue[],
): BranchVisualCue[] {
  const providedByBranchId = new Map(
    provided.map((portal) => [portal.branchId, portal]),
  );
  const fallbackByBranchId = new Map(
    fallback.map((portal) => [portal.branchId, portal]),
  );

  return branches.map((branch) => ({
    ...fallbackByBranchId.get(branch.id)!,
    ...providedByBranchId.get(branch.id),
    branchId: branch.id,
  }));
}

function localizeVisualScene(
  language: TurnGenerationInput["session"]["language"],
  scene: TurnVisualScene,
): TurnVisualScene {
  if (language === "en") {
    return scene;
  }

  return {
    ...scene,
    avatar: {
      ...scene.avatar,
      posture: translateKnownVisualText(scene.avatar.posture),
      expression: translateKnownVisualText(scene.avatar.expression),
      stressSignal: translateKnownVisualText(scene.avatar.stressSignal),
      focusAura: translateKnownVisualText(scene.avatar.focusAura),
    },
    room: {
      ...scene.room,
      atmosphere: translateKnownVisualText(scene.room.atmosphere),
      lighting: translateKnownVisualText(scene.room.lighting),
      objects: scene.room.objects.map((object) => ({
        ...object,
        label: translateKnownVisualText(object.label),
        state: translateKnownVisualText(object.state),
        description: translateKnownVisualText(object.description),
      })),
      pressureIndicators: scene.room.pressureIndicators.map(translateKnownVisualText),
    },
    branchPortals: scene.branchPortals.map((portal) => ({
      ...portal,
      symbol: translateKnownVisualText(portal.symbol),
      motion: translateKnownVisualText(portal.motion),
      roomEffect: translateKnownVisualText(portal.roomEffect),
    })),
    stakeholders: scene.stakeholders.map((stakeholder) => ({
      ...stakeholder,
      label: translateKnownVisualText(stakeholder.label),
      mood: translateKnownVisualText(stakeholder.mood),
    })),
    caption: translateKnownVisualText(scene.caption),
  };
}

function translateKnownVisualText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const labels: Record<string, string> = {
    anchor: "锚点",
    bridge: "桥接",
    surge: "跃迁",
    console: "决策控制台",
    desk: "书桌",
    table: "桌面",
    "world window": "世界窗口",
    "trace map": "痕迹地图",
    "primary stakeholder": "关键利益相关者",
    "peer observer": "同行观察者",
    "personal support system": "个人支持系统",
    "quiet room waiting for observation": "安静等待观察的房间",
    "compressed room with visible decision pressure": "被决策压力压缩的房间",
    "open room with several future-facing signals": "出现多条未来信号的开放房间",
    "fast pulse": "快速脉冲",
    "slow orbit": "缓慢环绕",
    "side-to-side shimmer": "左右微光摆动",
    "warm signal": "温暖信号",
    "red friction": "红色摩擦",
    "steady watch": "稳定观察",
    "uncertain flicker": "不确定闪烁",
  };

  return labels[normalized] ?? text;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Number(Math.min(1, Math.max(0, value)).toFixed(3));
}
