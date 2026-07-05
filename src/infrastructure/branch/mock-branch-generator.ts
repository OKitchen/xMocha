import type { BranchGenerator } from "../../application/ports";
import { inferDilemmaKind } from "../../domain/dilemma-kind";
import { turnDraftSchema } from "../../domain/schemas";
import type {
  Branch,
  BranchWorldDelta,
  RiskProfile,
  TurnDraft,
  TurnGenerationInput,
} from "../../domain/types";

function buildBranch(
  id: string,
  title: string,
  summary: string,
  consequence: string,
  score: number,
  timeHorizon: string,
  riskProfile: RiskProfile,
  keyUncertainty: string,
): Branch {
  return {
    id,
    title,
    summary,
    consequence,
    score,
    timeHorizon,
    riskProfile,
    keyUncertainty,
  };
}

function useChinese(input: TurnGenerationInput): boolean {
  return input.session.language !== "en";
}

function previousChoiceText(input: TurnGenerationInput): string {
  const previousChoice = input.session.canonicalPath.at(-1);

  return [
    previousChoice?.title,
    previousChoice?.summary,
    previousChoice?.consequence,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function zhProjectBranches(input: TurnGenerationInput): Branch[] {
  const previousChoice = previousChoiceText(input);

  if (input.session.turn === 0) {
    return [
      buildBranch(
        "b1",
        "先做小规模验证",
        "你保留当前稳定节奏，用两周时间做访谈、原型或落地页，先确认真实需求和愿意付费的人。",
        "风险可控，但进展会更慢",
        0.39,
        "2-4 周",
        "low",
        "真实用户是否愿意投入时间、钱或明确承诺。",
      ),
      buildBranch(
        "b2",
        "把它变成正式项目",
        "你为这个项目划出固定时间和公开承诺，快速做出 MVP，让外部反馈迫使方向变清楚。",
        "推进更快，但时间和声誉压力上升",
        0.34,
        "1-3 个月",
        "high",
        "你的精力和现金流能否支撑早期不确定性。",
      ),
      buildBranch(
        "b3",
        "寻找合伙人或首批用户",
        "你先测试人和需求的匹配度，约谈潜在合伙人、第一批用户或愿意试用的客户。",
        "更快看清协作与需求风险",
        0.27,
        "3-6 周",
        "medium",
        "对方的兴趣是否会转化成实际参与。",
      ),
    ];
  }

  if (input.session.turn >= 2) {
    return [
      buildBranch(
        "b1",
        "公开发布第一个版本",
        "你把最小版本推给真实用户，用公开反馈替代内部猜测，开始建立项目的外部节奏。",
        "获得真实信号，也暴露产品粗糙处",
        0.36,
        "2-6 周",
        "high",
        "早期反馈是否足够清晰，能支撑继续投入。",
      ),
      buildBranch(
        "b2",
        "暂停并复盘信号",
        "你先停下扩张，把访谈、试用、成本和个人压力放在一起复盘，判断它是否值得继续。",
        "降低消耗，但可能错过窗口",
        0.32,
        "1-2 周",
        "low",
        "复盘会带来清晰结论，还是只是在推迟决定。",
      ),
      buildBranch(
        "b3",
        "把项目并入现有生活节奏",
        "你把项目设计成可持续的固定节奏，而不是靠短期冲刺，让工作、生活和实验彼此不互相吞噬。",
        "稳定推进，但爆发速度有限",
        0.32,
        "2-3 个月",
        "medium",
        "稳定节奏能否保持足够的学习速度。",
      ),
    ];
  }

  if (/小规模|验证|访谈|prototype|validate|validation|side/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "扩大验证样本",
        "你把验证从熟人圈扩展到陌生潜在用户，确认需求不是只存在于友好反馈里。",
        "信号更可靠，但被拒绝的概率上升",
        0.35,
        "2-4 周",
        "medium",
        "陌生用户是否会表达同样强度的需求。",
      ),
      buildBranch(
        "b2",
        "砍掉弱需求",
        "你主动删掉反馈模糊、无法付费或实现成本过高的方向，把项目缩到一个最尖锐的问题。",
        "范围更清楚，但会放弃一些想象空间",
        0.33,
        "1-2 周",
        "low",
        "留下的问题是否足够痛，值得继续做。",
      ),
      buildBranch(
        "b3",
        "转向付费试点",
        "你不再只问对方想不想要，而是设计一个低价试点或预售，测试承诺强度。",
        "最快验证价值，也最容易暴露产品不足",
        0.32,
        "2-6 周",
        "high",
        "用户是否愿意用钱或资源证明需求真实。",
      ),
    ];
  }

  if (/正式|全职|公开|mvp|commit|full/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "锁定 MVP 范围",
        "你拒绝继续加功能，只保留能验证核心价值的最小版本，避免项目在复杂度里失控。",
        "执行更聚焦，但必须忍受不完美",
        0.34,
        "2-4 周",
        "medium",
        "最小版本是否真的能展示核心价值。",
      ),
      buildBranch(
        "b2",
        "设置止损线",
        "你提前定义投入上限、现金缓冲和停止条件，让大胆投入不变成无边界消耗。",
        "压力下降，但热情会被现实约束",
        0.33,
        "1 周",
        "low",
        "止损线能否在情绪高涨时仍被执行。",
      ),
      buildBranch(
        "b3",
        "寻找早期资金或合伙人",
        "你把个人项目推向外部资源，尝试用资金、合伙或渠道放大速度。",
        "上限提高，但控制权和关系复杂度上升",
        0.33,
        "1-3 个月",
        "high",
        "外部资源是否会带来真正杠杆，而不是额外噪音。",
      ),
    ];
  }

  return [
    buildBranch(
      "b1",
      "约谈 10 个潜在用户",
      "你把注意力从构想转向真实对话，用固定数量的访谈逼自己看清需求强度。",
      "理解更具体，但可能推翻原始想法",
      0.36,
      "2 周",
      "medium",
      "访谈是否能揭示足够一致的痛点。",
    ),
    buildBranch(
      "b2",
      "筛选合伙人",
      "你先验证协作方式、投入预期和价值观是否匹配，避免项目刚开始就被关系成本拖住。",
      "组织风险下降，但启动速度变慢",
      0.31,
      "3-6 周",
      "medium",
      "合伙关系能否在压力下保持清晰分工。",
    ),
    buildBranch(
      "b3",
      "做付费承诺测试",
      "你设计一个预售、押金或企业试点，把兴趣转化成可衡量承诺。",
      "信号最硬，也最容易被市场拒绝",
      0.33,
      "2-4 周",
      "high",
      "市场是否愿意用行动证明这个项目有价值。",
    ),
  ];
}

function enProjectBranches(input: TurnGenerationInput): Branch[] {
  const previousChoice = previousChoiceText(input);

  if (input.session.turn === 0) {
    return [
      buildBranch(
        "b1",
        "Validate Small First",
        "You keep your current base stable and run a two-week validation sprint with interviews, a prototype, or a landing page.",
        "lower risk with slower visible progress",
        0.39,
        "2-4 weeks",
        "low",
        "Whether real users will spend time, money, or clear commitment on the idea.",
      ),
      buildBranch(
        "b2",
        "Turn It Into A Real Project",
        "You reserve serious time, define an MVP, and let external feedback force the project into a clearer shape.",
        "faster progress with higher time and reputation pressure",
        0.34,
        "1-3 months",
        "high",
        "Whether your energy and runway can handle early uncertainty.",
      ),
      buildBranch(
        "b3",
        "Find A Cofounder Or First Customer",
        "You test the people side first by speaking with possible collaborators, early users, or customers willing to try it.",
        "clearer demand and collaboration signals",
        0.27,
        "3-6 weeks",
        "medium",
        "Whether interest turns into practical involvement.",
      ),
    ];
  }

  if (input.session.turn >= 2) {
    return [
      buildBranch(
        "b1",
        "Launch The First Version",
        "You put the smallest usable version in front of real users and let public feedback replace private guessing.",
        "real signal with exposed product roughness",
        0.36,
        "2-6 weeks",
        "high",
        "Whether early feedback is clear enough to justify more commitment.",
      ),
      buildBranch(
        "b2",
        "Pause And Read The Signals",
        "You stop expanding, review interviews, usage, costs, and personal pressure, then decide whether the project still deserves fuel.",
        "lower burn with a possible missed window",
        0.32,
        "1-2 weeks",
        "low",
        "Whether the review creates clarity or simply delays the decision.",
      ),
      buildBranch(
        "b3",
        "Fit The Project Into A Sustainable Rhythm",
        "You design a repeatable weekly cadence so work, life, and experimentation do not consume one another.",
        "sustainable progress with limited breakout speed",
        0.32,
        "2-3 months",
        "medium",
        "Whether a stable rhythm still learns quickly enough.",
      ),
    ];
  }

  if (/small|validat|interview|prototype|side/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "Expand The Validation Sample",
        "You move beyond friendly feedback and test the idea with strangers who resemble the target user.",
        "stronger signal with more rejection risk",
        0.35,
        "2-4 weeks",
        "medium",
        "Whether strangers show the same strength of need.",
      ),
      buildBranch(
        "b2",
        "Cut Weak Demand",
        "You remove vague, low-commitment, or expensive directions until the project is about one sharp problem.",
        "clearer scope with less fantasy upside",
        0.33,
        "1-2 weeks",
        "low",
        "Whether the remaining problem is painful enough to keep building.",
      ),
      buildBranch(
        "b3",
        "Run A Paid Pilot",
        "You stop asking whether people like the idea and test whether they will pay, pre-order, or commit resources.",
        "fastest value signal with visible product gaps",
        0.32,
        "2-6 weeks",
        "high",
        "Whether users prove demand through action.",
      ),
    ];
  }

  if (/real project|formal|mvp|commit|full/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "Lock The MVP Scope",
        "You refuse extra features and keep only what proves the core value before complexity takes over.",
        "focused execution that tolerates imperfection",
        0.34,
        "2-4 weeks",
        "medium",
        "Whether the smallest version can still show the core value.",
      ),
      buildBranch(
        "b2",
        "Set A Stop-Loss Line",
        "You define a time budget, runway buffer, and stop conditions before enthusiasm creates open-ended burn.",
        "lower pressure with stricter constraints",
        0.33,
        "1 week",
        "low",
        "Whether the boundary still holds when momentum feels exciting.",
      ),
      buildBranch(
        "b3",
        "Seek Early Capital Or A Cofounder",
        "You push the project toward outside leverage through funding, partnership, or distribution.",
        "higher ceiling with more control and relationship complexity",
        0.33,
        "1-3 months",
        "high",
        "Whether outside resources create leverage instead of noise.",
      ),
    ];
  }

  return [
    buildBranch(
      "b1",
      "Interview 10 Potential Users",
      "You move from idea to evidence by forcing a fixed number of real conversations.",
      "more concrete understanding that may overturn the original idea",
      0.36,
      "2 weeks",
      "medium",
      "Whether the interviews reveal a consistent pain point.",
    ),
    buildBranch(
      "b2",
      "Screen A Cofounder",
      "You test working style, commitment level, and values before the project carries relationship debt.",
      "lower team risk with slower launch speed",
      0.31,
      "3-6 weeks",
      "medium",
      "Whether collaboration stays clear under pressure.",
    ),
    buildBranch(
      "b3",
      "Test Paid Commitment",
      "You design a pre-sale, deposit, or pilot so interest becomes a measurable commitment.",
      "harder signal with higher rejection risk",
      0.33,
      "2-4 weeks",
      "high",
      "Whether the market will prove value through action.",
    ),
  ];
}

function zhFoodBranches(input: TurnGenerationInput): Branch[] {
  const previousChoice = previousChoiceText(input);

  if (input.session.turn === 0) {
    return [
      buildBranch(
        "b1",
        "吃点应景的",
        "既然是端午，就把这顿饭做得有节日感：粽子、咸鸭蛋、清爽小菜，简单但有记忆点。",
        "仪式感更强，但选择空间会窄一点",
        0.36,
        "今天这顿",
        "low",
        "你现在是真的想应景，还是只是觉得节日应该这样吃。",
      ),
      buildBranch(
        "b2",
        "约人一起吃",
        "先问问家人或朋友有没有空，把“吃什么”变成一次轻松见面，而不是只解决填饱肚子。",
        "陪伴感更强，但需要协调时间和口味",
        0.32,
        "今天中午或今晚",
        "medium",
        "对方是否有空，以及大家的口味能不能凑到一起。",
      ),
      buildBranch(
        "b3",
        "选自己最想吃的",
        "不强行追求节日标准，直接从此刻的胃口出发：想热闹就吃火锅，想省心就点熟悉的外卖。",
        "满足感来得最快，但节日感可能少一点",
        0.32,
        "30-60 分钟",
        "medium",
        "你最想要的是舒服、方便，还是一点新鲜感。",
      ),
    ];
  }

  if (/应景|粽子|节日|传统/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "甜咸各来一点",
        "别再纠结甜粽还是咸粽，各买一小份，再配一杯茶或清爽饮料，满足好奇也不容易腻。",
        "选择更丰富，但可能吃得有点撑",
        0.34,
        "今天这顿",
        "medium",
        "份量能不能控制住，不让仪式感变成负担。",
      ),
      buildBranch(
        "b2",
        "配一顿清淡正餐",
        "把粽子当主角之一，再加汤、青菜或简单蛋白质，让这顿饭更舒服，也更适合节日后的身体状态。",
        "更稳妥舒服，但惊喜感较低",
        0.35,
        "今天这顿",
        "low",
        "你现在更需要满足口腹之欲，还是吃完之后的轻松感。",
      ),
      buildBranch(
        "b3",
        "找一家节日限定",
        "去附近店里看看端午套餐或限定口味，把吃饭变成一次小探索。",
        "可能更有趣，也可能排队或踩雷",
        0.31,
        "1-2 小时",
        "high",
        "限定款是真的好吃，还是只是被节日氛围包装出来。",
      ),
    ];
  }

  if (/约人|一起|家人|朋友|聚/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "迁就大家的安全口味",
        "选一家不太会出错的家常菜、茶餐厅或火锅，让每个人都能吃到东西，重点放在见面。",
        "气氛更稳，但菜品不一定惊艳",
        0.36,
        "今天中午或今晚",
        "low",
        "大家是否接受把陪伴放在味道惊喜前面。",
      ),
      buildBranch(
        "b2",
        "让一个人来拍板",
        "别让群聊一直投票，指定一个人按预算和距离直接定店，其他人只负责准时出现。",
        "效率更高，但可能有人口味被牺牲",
        0.32,
        "30 分钟内定下来",
        "medium",
        "被牺牲的小偏好会不会影响这顿饭的心情。",
      ),
      buildBranch(
        "b3",
        "临时做一桌简单的",
        "如果外面人多，就买点熟食、小菜、饮料和粽子，在家里或办公室拼一顿轻松的节日饭。",
        "更像自己的节日，但需要一点准备",
        0.32,
        "1-2 小时",
        "medium",
        "临时准备会带来温暖，还是变成额外麻烦。",
      ),
    ];
  }

  if (input.session.turn >= 2) {
    return [
      buildBranch(
        "b1",
        "现在就下单",
        "把前面已经想清楚的口味和预算固定下来，直接下单或出门，停止继续消耗注意力。",
        "很快吃上饭，但放弃继续比较",
        0.38,
        "现在",
        "low",
        "你是否已经有足够信息，不需要再刷菜单。",
      ),
      buildBranch(
        "b2",
        "加一点节日小仪式",
        "在已经选好的基础上加一个小动作：分一只粽子、拍张照、给家里发一句节日问候。",
        "这顿饭更有记忆点，但会多花一点心思",
        0.31,
        "吃饭前后 10 分钟",
        "medium",
        "这个小仪式会让你开心，还是只是形式感。",
      ),
      buildBranch(
        "b3",
        "换成最省心方案",
        "如果你已经饿了或累了，就选最近、最快、最熟悉的一家，把身体状态放在体验设计前面。",
        "压力最低，但新鲜感最少",
        0.31,
        "30 分钟内",
        "low",
        "你现在是否更需要被照顾，而不是做一个完美选择。",
      ),
    ];
  }

  return [
    buildBranch(
      "b1",
      "按胃口缩小范围",
      "先问自己想吃热的、清淡的、重口的还是甜的，再从三家以内做选择。",
      "纠结变少，但可能错过临时灵感",
      0.36,
      "10 分钟",
      "low",
      "你能不能诚实分辨现在的胃口，而不是被推荐牵着走。",
    ),
    buildBranch(
      "b2",
      "看距离和排队",
      "把口味暂时放到第二位，先筛掉太远、太挤、太慢的选项，让这顿饭更顺。",
      "落地更容易，但惊喜感下降",
      0.33,
      "15 分钟",
      "low",
      "方便会不会比好吃更影响你今天的满意度。",
    ),
    buildBranch(
      "b3",
      "试一个新口味",
      "选一家平时没吃过、但评价稳定的店，给节日留一点新鲜感。",
      "可能收获惊喜，也可能踩雷",
      0.31,
      "30-60 分钟",
      "high",
      "你今天愿不愿意用一点不确定性换新鲜感。",
    ),
  ];
}

function enFoodBranches(input: TurnGenerationInput): Branch[] {
  const previousChoice = previousChoiceText(input);

  if (input.session.turn === 0) {
    return [
      buildBranch(
        "b1",
        "Eat Something Seasonal",
        "Make the meal feel tied to the festival: zongzi, salted duck egg, and a few fresh sides.",
        "more ritual and memory, with fewer options",
        0.36,
        "this meal",
        "low",
        "Whether you truly want the seasonal feeling or only feel you should.",
      ),
      buildBranch(
        "b2",
        "Eat With Someone",
        "Ask family or friends whether they are free, and turn the question into a small moment together.",
        "more connection, with more coordination",
        0.32,
        "lunch or dinner today",
        "medium",
        "Whether schedules and tastes can line up without too much friction.",
      ),
      buildBranch(
        "b3",
        "Follow Your Real Craving",
        "Skip the perfect festival answer and choose what your body actually wants right now.",
        "fast satisfaction, with less festival atmosphere",
        0.32,
        "30-60 minutes",
        "medium",
        "Whether you want comfort, convenience, or novelty most.",
      ),
    ];
  }

  if (/seasonal|zongzi|festival|traditional/.test(previousChoice)) {
    return [
      buildBranch(
        "b1",
        "Try Both Sweet And Savory",
        "Get small portions of both styles, add tea or a fresh drink, and let curiosity win without overcommitting.",
        "more variety, with a chance of eating too much",
        0.34,
        "this meal",
        "medium",
        "Whether you can keep the portion small enough to stay enjoyable.",
      ),
      buildBranch(
        "b2",
        "Pair It With A Light Meal",
        "Let zongzi be one part of the meal, then add soup, greens, or protein so you feel good afterward.",
        "more comfortable and balanced, with less surprise",
        0.35,
        "this meal",
        "low",
        "Whether you need indulgence or ease after eating.",
      ),
      buildBranch(
        "b3",
        "Find A Festival Special",
        "Look for a nearby restaurant or bakery doing a limited festival item and make it a small outing.",
        "more fun, with queue or disappointment risk",
        0.31,
        "1-2 hours",
        "high",
        "Whether the limited item is genuinely good or just well-packaged.",
      ),
    ];
  }

  if (input.session.turn >= 2) {
    return [
      buildBranch(
        "b1",
        "Order Now",
        "Use what you already learned about craving, budget, and distance, then stop scrolling menus.",
        "food arrives faster, with less comparison",
        0.38,
        "now",
        "low",
        "Whether you already have enough information to decide.",
      ),
      buildBranch(
        "b2",
        "Add A Tiny Ritual",
        "Add one small gesture: share zongzi, take a photo, or send a festival greeting to someone.",
        "more memory, with a little extra effort",
        0.31,
        "10 minutes around the meal",
        "medium",
        "Whether the ritual feels warm or merely performative.",
      ),
      buildBranch(
        "b3",
        "Choose The Easiest Option",
        "If you are tired or hungry, pick the nearest familiar option and let your body matter more than novelty.",
        "lowest pressure, with least novelty",
        0.31,
        "within 30 minutes",
        "low",
        "Whether you need care more than a perfect choice.",
      ),
    ];
  }

  return [
    buildBranch(
      "b1",
      "Narrow By Craving",
      "Decide whether you want hot, light, rich, or sweet food, then choose from no more than three options.",
      "less indecision, with less room for impulse",
      0.36,
      "10 minutes",
      "low",
      "Whether you can hear your real appetite through all the options.",
    ),
    buildBranch(
      "b2",
      "Filter By Distance And Wait",
      "Remove anything too far, crowded, or slow, then choose from the practical shortlist.",
      "easier execution, with less surprise",
      0.33,
      "15 minutes",
      "low",
      "Whether convenience matters more to your satisfaction today.",
    ),
    buildBranch(
      "b3",
      "Try A New Flavor",
      "Pick a well-reviewed place you have not tried before and give the day a little novelty.",
      "possible delight, with some disappointment risk",
      0.31,
      "30-60 minutes",
      "high",
      "Whether you want freshness enough to accept uncertainty.",
    ),
  ];
}

function zhGeneralBranches(input: TurnGenerationInput): Branch[] {
  const previousChoice = input.session.canonicalPath.at(-1)?.title ?? "上一轮选择";

  if (input.session.turn === 0) {
    return [
      buildBranch(
        "b1",
        "先选最省心的方案",
        "你不把这个决定复杂化，优先选择成本低、容易执行、今天就能落地的做法。",
        "压力最小，但可能少一点惊喜",
        0.36,
        "今天或本周",
        "low",
        "省心会带来轻松，还是让你觉得有点敷衍。",
      ),
      buildBranch(
        "b2",
        "选更有体验感的方案",
        "你允许自己多花一点时间、钱或精力，换一个更有记忆点的结果。",
        "满足感可能更强，但不确定性也更高",
        0.34,
        "今天或本周",
        "high",
        "这份体验感是否真的值得额外成本。",
      ),
      buildBranch(
        "b3",
        "先问清关键条件",
        "你先确认预算、时间、对方偏好或限制条件，再做一个不容易后悔的选择。",
        "更稳妥，但会慢一点",
        0.3,
        "10-30 分钟",
        "medium",
        "多问一步会带来清楚，还是让简单问题变复杂。",
      ),
    ];
  }

  if (input.session.turn >= 2) {
    return [
      buildBranch(
        "b1",
        "直接执行当前选择",
        `你沿着“${previousChoice}”往前走，不再继续比较，把注意力放到体验和结果上。`,
        "更快得到结果，但会放弃继续优化",
        0.34,
        "现在",
        "medium",
        "现在是否已经足够清楚，可以停止纠结。",
      ),
      buildBranch(
        "b2",
        "保留一个简单后备方案",
        "你先推进当前选择，同时留一个如果不顺利就能马上切换的备选项。",
        "更安心，但会多一点准备成本",
        0.33,
        "今天",
        "low",
        "后备方案会让你放松，还是继续分散注意力。",
      ),
      buildBranch(
        "b3",
        "给它加一点个人偏好",
        "你在当前选择上加一个让自己更舒服的小调整，而不是追求客观最优。",
        "更像自己的选择，但不一定最理性",
        0.33,
        "今天",
        "high",
        "这个小偏好会提升满足感，还是只是临时冲动。",
      ),
    ];
  }

  return [
    buildBranch(
      "b1",
      "照这个方向做小一点",
      `你保留“${previousChoice}”的核心想法，但把范围缩小，让它更容易马上发生。`,
      "更容易落地，但满足感可能打折",
      0.35,
      "今天",
      "low",
      "缩小范围会带来轻松，还是让你觉得不够尽兴。",
    ),
    buildBranch(
      "b2",
      "换成更有趣的版本",
      "你不完全推翻上一轮，而是给它加一点新鲜感，让这个选择更值得记住。",
      "体验更丰富，但可能更费事",
      0.33,
      "今天或本周",
      "high",
      "额外的趣味是否值得额外的麻烦。",
    ),
    buildBranch(
      "b3",
      "先听一个外部意见",
      "你找一个了解你口味或处境的人给建议，用外部视角打破原地比较。",
      "更容易破局，但可能被别人偏好带跑",
      0.32,
      "10-20 分钟",
      "medium",
      "别人的建议是在帮你清楚，还是把问题变得更吵。",
    ),
  ];
}

function enGeneralBranches(input: TurnGenerationInput): Branch[] {
  const previousChoice = input.session.canonicalPath.at(-1)?.title ?? "the last move";

  if (input.session.turn === 0) {
    return [
      buildBranch(
        "b1",
        "Choose The Easiest Good Option",
        "You avoid overcomplicating the decision and choose something low-cost, executable, and good enough for now.",
        "lowest pressure, with less surprise",
        0.36,
        "today or this week",
        "low",
        "Whether ease will feel kind or a little too casual.",
      ),
      buildBranch(
        "b2",
        "Choose The More Memorable Option",
        "You spend a little more time, money, or energy in exchange for an outcome that feels more alive.",
        "more satisfaction, with more uncertainty",
        0.34,
        "today or this week",
        "high",
        "Whether the experience is worth the extra cost.",
      ),
      buildBranch(
        "b3",
        "Ask For The Missing Constraint",
        "You first check budget, timing, preferences, or constraints so the decision becomes easier to trust.",
        "more grounded, but slower",
        0.3,
        "10-30 minutes",
        "medium",
        "Whether one more question creates clarity or unnecessary complexity.",
      ),
    ];
  }

  if (input.session.turn >= 2) {
    return [
      buildBranch(
        "b1",
        "Execute The Current Choice",
        `You continue from ${previousChoice}, stop comparing, and put attention into the actual experience.`,
        "faster result, with less optimization",
        0.34,
        "now",
        "medium",
        "Whether the choice is already clear enough to stop searching.",
      ),
      buildBranch(
        "b2",
        "Keep A Simple Backup",
        "You move forward while keeping one easy fallback if the current option becomes inconvenient.",
        "more peace of mind, with a little preparation cost",
        0.33,
        "today",
        "low",
        "Whether the backup helps you relax or keeps attention split.",
      ),
      buildBranch(
        "b3",
        "Add A Personal Preference",
        "You adjust the choice toward what feels good to you instead of chasing an abstract best answer.",
        "more personal fit, with less pure rationality",
        0.33,
        "today",
        "high",
        "Whether the preference improves satisfaction or is just an impulse.",
      ),
    ];
  }

  return [
    buildBranch(
      "b1",
      "Make It Smaller",
      `You keep the core of ${previousChoice}, but reduce the scope so it can happen without much friction.`,
      "easier execution, with less fullness",
      0.35,
      "today",
      "low",
      "Whether reducing scope feels relieving or underwhelming.",
    ),
    buildBranch(
      "b2",
      "Make It More Interesting",
      "You keep the direction but add a little novelty so the choice feels worth remembering.",
      "richer experience, with more effort",
      0.33,
      "today or this week",
      "high",
      "Whether the extra interest is worth the extra trouble.",
    ),
    buildBranch(
      "b3",
      "Ask One Outside Opinion",
      "You ask someone who understands your taste or situation and use that view to break the loop.",
      "easier momentum, with borrowed bias",
      0.32,
      "10-20 minutes",
      "medium",
      "Whether the advice clarifies the decision or makes it noisier.",
    ),
  ];
}

function branchSetForTurn(input: TurnGenerationInput): Branch[] {
  const dilemmaKind = inferDilemmaKind(input.session);

  if (useChinese(input)) {
    if (dilemmaKind === "food") return zhFoodBranches(input);
    if (dilemmaKind === "project") return zhProjectBranches(input);
    return zhGeneralBranches(input);
  }

  if (dilemmaKind === "food") return enFoodBranches(input);
  if (dilemmaKind === "project") return enProjectBranches(input);
  return enGeneralBranches(input);
}

function worldDeltaForBranch(
  branch: Branch,
  input: TurnGenerationInput,
): BranchWorldDelta {
  const dilemmaKind = inferDilemmaKind(input.session);

  if (useChinese(input)) {
    if (dilemmaKind === "food") {
      return {
        branchId: branch.id,
        activatedConstraints:
          branch.riskProfile === "high"
            ? ["可能排队、踩雷，或多花一点预算。"]
            : branch.riskProfile === "low"
              ? ["选择更稳，但节日感或新鲜感会少一点。"]
              : ["需要协调口味、距离、时间和当下胃口。"],
        activatedOpportunities:
          branch.riskProfile === "high"
            ? ["这顿饭更可能变成有记忆点的小体验。"]
            : branch.riskProfile === "low"
              ? ["能更快吃上舒服、可靠的一顿。"]
              : ["可以在方便和体验之间找到一个平衡。"],
        pressureShift:
          branch.riskProfile === "high"
            ? "这顿饭会测试你今天愿不愿意用一点不确定性换新鲜感。"
            : branch.riskProfile === "low"
              ? "这顿饭会测试你是否更需要安稳、熟悉和省心。"
              : "这顿饭会测试你如何平衡仪式感、口味和现实条件。",
      };
    }

    return {
      branchId: branch.id,
      activatedConstraints:
        branch.riskProfile === "high"
          ? ["额外成本、时间或不确定性会上升。"]
          : branch.riskProfile === "low"
            ? ["省心路径可能少一点新鲜感。"]
            : ["需要同时管理现实条件和个人偏好。"],
      activatedOpportunities:
        branch.riskProfile === "high"
          ? ["更有机会获得一次难忘体验。"]
          : branch.riskProfile === "low"
            ? ["能更快得到一个稳定、可执行的结果。"]
            : ["可以在稳妥和体验之间保留转向空间。"],
      pressureShift:
        branch.riskProfile === "high"
          ? "现实条件会提醒你：更有体验感的选择通常也更费事。"
          : branch.riskProfile === "low"
            ? "现实条件会奖励省心，但也可能让这次选择显得普通。"
            : "现实条件会观察你能不能在偏好和方便之间做取舍。",
    };
  }

  if (dilemmaKind === "food") {
    return {
      branchId: branch.id,
      activatedConstraints:
        branch.riskProfile === "high"
          ? ["There may be queues, disappointment, or extra cost."]
          : branch.riskProfile === "low"
            ? ["The choice is reliable, but less novel or festive."]
            : ["Taste, distance, timing, and appetite need coordination."],
      activatedOpportunities:
        branch.riskProfile === "high"
          ? ["The meal can become a memorable small experience."]
          : branch.riskProfile === "low"
            ? ["You can eat something comfortable and reliable quickly."]
            : ["You can balance convenience with a little ritual."],
      pressureShift:
        branch.riskProfile === "high"
          ? "The meal tests whether novelty is worth uncertainty today."
          : branch.riskProfile === "low"
            ? "The meal tests whether comfort and ease matter most today."
            : "The meal tests how you balance ritual, taste, and practical constraints.",
    };
  }

  return {
    branchId: branch.id,
    activatedConstraints:
      branch.riskProfile === "high"
        ? ["Extra cost, time, or uncertainty rises."]
        : branch.riskProfile === "low"
          ? ["The easiest path may feel less fresh."]
          : ["You must manage practical constraints and personal preference."],
    activatedOpportunities:
      branch.riskProfile === "high"
        ? ["The choice may become more memorable."]
        : branch.riskProfile === "low"
          ? ["You can reach a stable, executable result faster."]
          : ["You can keep room to adjust between safety and experience."],
    pressureShift:
      branch.riskProfile === "high"
        ? "Reality reminds you that richer experiences usually take more effort."
        : branch.riskProfile === "low"
          ? "Reality rewards ease, but may make the choice feel ordinary."
          : "Reality asks you to trade off preference and convenience.",
  };
}

export class MockBranchGenerator implements BranchGenerator {
  async generate(input: TurnGenerationInput): Promise<TurnDraft> {
    const branches = branchSetForTurn(input);
    const branchWorldDeltas = branches.map((branch) =>
      worldDeltaForBranch(branch, input),
    );

    return turnDraftSchema.parse({
      turnNumber: input.session.turn + 1,
      branches,
      branchWorldDeltas,
    });
  }
}
