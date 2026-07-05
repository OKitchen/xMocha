import type { SessionState } from "./types";

export type DilemmaKind =
  | "food"
  | "project"
  | "career"
  | "relationship"
  | "relocation"
  | "general";

export function collectSessionDecisionText(session: SessionState): string {
  return [
    session.dilemma,
    session.userProvidedData?.derivedBrief.userIntentSummary,
    ...(session.userProvidedData?.derivedBrief.activeOptions ?? []),
    ...(session.userProvidedData?.derivedBrief.decisionPressures ?? []),
    ...(session.userProvidedData?.factItems.map((fact) => fact.summary) ?? []),
    ...session.canonicalPath.flatMap((step) => [
      step.title,
      step.summary ?? "",
      step.consequence,
    ]),
    ...session.userAuthoredActions.flatMap((action) => [
      action.title,
      action.rawInput,
      action.summary,
      action.consequence,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function inferDilemmaKind(session: SessionState): DilemmaKind {
  const directKind = inferDilemmaKindFromText(session.dilemma);

  if (directKind !== "general") {
    return directKind;
  }

  return inferDilemmaKindFromText(collectSessionDecisionText(session));
}

export function inferDilemmaKindFromText(text: string): DilemmaKind {
  const normalizedText = text.toLowerCase();

  if (hasCareerSignal(normalizedText)) return "career";

  if (hasProjectSignal(normalizedText)) return "project";

  if (
    /分手|复合|关系|恋爱|结婚|伴侣|朋友|家人|\brelationship\b|\bpartner\b|\bbreak up\b|\bmarry\b|\bfriendship\b|\bfamily\b/.test(
      normalizedText,
    )
  ) {
    return "relationship";
  }

  if (/搬家|搬去|换城市|城市|移居|\bmove city\b|\brelocat|\bnew city\b/.test(normalizedText)) {
    return "relocation";
  }

  if (hasFoodSignal(normalizedText)) return "food";

  return "general";
}

function hasCareerSignal(text: string): boolean {
  return /岗位|工作|职业|职位|公司|老板|经理|同事|薪水|升职|跳槽|转型|坚守|留下|雇主|招聘|全职|离职|all\s*in\s*ai|\bai\b|\bllm\b|\bautomation\b|\boffer\b|\bcareer\b|\bjob\b|\brole\b|\bmanager\b|\bsalary\b|\bpromotion\b|\bworkplace\b|\bhiring\b|\bemployer\b|\bcurrent role\b|\bstable role\b|\bstay\b|\bleave\b/.test(
    text,
  );
}

function hasProjectSignal(text: string): boolean {
  return /项目|创业|副业|产品|客户|合伙|开始自己的|独立开发|\bstart my own\b|\bown project\b|\bside project\b|\bstartup\b|\bfounder\b|\bmvp\b|\bbusiness\b|\bpaid pilot\b|\bcofounder\b/.test(
    text,
  );
}

function hasFoodSignal(text: string): boolean {
  return /吃什么|吃啥|吃饭|午饭|晚饭|早餐|宵夜|端午|粽子|外卖|餐厅|火锅|奶茶|点菜|做饭|聚餐|食物|面条|煮面|便当|\bfood\b|\beat\b|\bmeal\b|\blunch\b|\bdinner\b|\bbreakfast\b|\brestaurant\b|\btakeout\b/.test(
    text,
  );
}
