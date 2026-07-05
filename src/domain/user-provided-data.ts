import type {
  DerivedUserBrief,
  OutputLanguage,
  UserFactItem,
  UserFactItemInput,
  UserFactType,
  UserProvidedDataInput,
  UserProvidedDataPack,
  UserProvidedDataSource,
} from "./types";

export function normalizeUserProvidedDataInput(
  input: UserProvidedDataInput | undefined,
  context: {
    dilemma?: string;
    language?: OutputLanguage;
    userContextPack?: {
      availableOptions?: string[];
      keyStakeholders?: string[];
      personalConstraints?: string[];
    };
  } = {},
): UserProvidedDataPack | undefined {
  if (!input) {
    return undefined;
  }

  const sources = normalizeSources(input);
  const factItems =
    input.facts && input.facts.length > 0
      ? normalizeFactInputs(input.facts, sources)
      : deriveFactItemsFromSources(sources);

  if (sources.length === 0 && factItems.length === 0) {
    return undefined;
  }

  return {
    sources,
    factItems,
    derivedBrief: buildDerivedUserBrief(factItems, context),
  };
}

function normalizeSources(input: UserProvidedDataInput): UserProvidedDataSource[] {
  const normalizedSources: UserProvidedDataSource[] = [];
  let sourceIndex = 0;

  if (input.rawText?.trim()) {
    sourceIndex += 1;
    normalizedSources.push({
      id: `source-${sourceIndex}`,
      kind: "note",
      title: "Pasted user note",
      content: input.rawText.trim(),
    });
  }

  for (const source of input.sources ?? []) {
    const content = source.content.trim();

    if (!content) {
      continue;
    }

    sourceIndex += 1;
    normalizedSources.push({
      id: `source-${sourceIndex}`,
      kind: source.kind ?? "text",
      title: source.title?.trim() || `User source ${sourceIndex}`,
      content,
    });
  }

  return normalizedSources;
}

function normalizeFactInputs(
  facts: UserFactItemInput[],
  sources: UserProvidedDataSource[],
): UserFactItem[] {
  const fallbackSourceIds = sources.map((source) => source.id);
  const normalizedFacts: UserFactItem[] = [];

  for (const [index, fact] of facts.entries()) {
    const summary = fact.summary.trim();

    if (!summary) {
      continue;
    }

    normalizedFacts.push({
      id: `fact-${index + 1}`,
      type: fact.type ?? classifyFactType(summary),
      label: fact.label?.trim() || undefined,
      value: fact.value?.trim() || undefined,
      summary,
      tags: cleanList(fact.tags),
      timeScope: fact.timeScope?.trim() || undefined,
      confidence: 0.85,
      sourceRefIds:
        fact.sourceRefIds?.filter((sourceId) =>
          sources.some((source) => source.id === sourceId),
        ) ?? fallbackSourceIds,
      userConfirmed: fact.userConfirmed ?? true,
    });
  }

  return normalizedFacts;
}

function deriveFactItemsFromSources(sources: UserProvidedDataSource[]): UserFactItem[] {
  const factItems: UserFactItem[] = [];

  for (const source of sources) {
    const candidateLines = rankCandidateFacts(
      extractCandidateFactLines(source.content)
        .map(cleanCandidateLine)
        .filter(isUsefulCandidateFact),
    );

    for (const line of candidateLines.slice(0, 16)) {
      factItems.push({
        id: `fact-${factItems.length + 1}`,
        type: classifyFactType(line),
        summary: line,
        tags: inferTags(line),
        confidence: 0.65,
        sourceRefIds: [source.id],
        userConfirmed: false,
      });
    }
  }

  return factItems;
}

function protectAbbreviations(content: string): string {
  return content
    .replace(/\bvs\./gi, "vs")
    .replace(/\be\.g\./gi, "e.g")
    .replace(/\bi\.e\./gi, "i.e");
}

function extractCandidateFactLines(content: string): string[] {
  const paragraphs: string[] = [];
  let current = "";

  for (const rawLine of protectAbbreviations(content).split("\n")) {
    const line = rawLine.trim();

    if (!line || /^--- Page \d+ of \d+ ---$/i.test(line)) {
      if (current) {
        paragraphs.push(current);
        current = "";
      }
      continue;
    }

    if (!current) {
      current = line;
      continue;
    }

    if (shouldMergePdfLine(current, line)) {
      current = `${current} ${line}`;
    } else {
      paragraphs.push(current);
      current = line;
    }
  }

  if (current) {
    paragraphs.push(current);
  }

  return paragraphs.flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/));
}

function shouldMergePdfLine(previous: string, next: string): boolean {
  if (/^[•*-]\s+/.test(next)) return false;
  if (/^\d+[\).]\s+/.test(next)) return false;
  if (/^[A-Z][A-Z\s]{8,}$/.test(next)) return false;
  if (/[.!?。！？]$/.test(previous) && /^[A-Z]/.test(next)) return false;
  return true;
}

function buildDerivedUserBrief(
  facts: UserFactItem[],
  context: {
    dilemma?: string;
    language?: OutputLanguage;
    userContextPack?: {
      availableOptions?: string[];
      keyStakeholders?: string[];
      personalConstraints?: string[];
    };
  },
): DerivedUserBrief {
  const activeOptions = uniqueStrings([
    ...cleanList(context.userContextPack?.availableOptions),
    ...inferOptionsFromDilemma(context.dilemma, context.language),
    ...collectFactSummaries(facts, "option", 4),
  ]).slice(0, 5);
  const keyStakeholders = uniqueStrings([
    ...cleanList(context.userContextPack?.keyStakeholders),
    ...inferStakeholdersFromDilemma(context.dilemma, context.language),
    ...collectStakeholderFactSummaries(facts, 4),
  ]).slice(0, 5);
  const keyConstraints = uniqueStrings([
    ...cleanList(context.userContextPack?.personalConstraints),
    ...collectFactSummaries(facts, "constraint", 3),
    ...facts
      .filter((fact) => fact.type === "timeline" || fact.type === "risk")
      .slice(0, 3)
      .map((fact) => fact.summary),
  ]).slice(0, 5);
  const decisionPressures = uniqueStrings([
    ...collectFactSummaries(facts, "pressure", 4),
    ...collectFactSummaries(facts, "risk", 4),
    ...facts
      .filter((fact) => fact.tags.includes("pressure"))
      .slice(0, 3)
      .map((fact) => fact.summary),
  ]).slice(0, 6);

  return {
    userIntentSummary: facts.find((fact) => fact.type === "goal")?.summary
      ?? context.dilemma?.trim(),
    keyConstraints,
    keyStakeholders,
    activeOptions,
    decisionPressures,
    openQuestions: facts
      .filter((fact) => fact.summary.includes("?"))
      .slice(0, 3)
      .map((fact) => fact.summary),
  };
}

function cleanCandidateLine(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulCandidateFact(line: string): boolean {
  if (line.length < 24) return false;
  if (/^(introduction|discussion|appendix|key findings|figure \d+|table \d+)$/i.test(line)) {
    return false;
  }
  if (/^[“"]?\s*interviews with:|how much ai labor displacement\??$/i.test(line)) {
    return false;
  }
  if (/^figure \d+[:\s]/i.test(line) && line.length < 80) return false;
  return true;
}

function rankCandidateFacts(lines: string[]): string[] {
  return uniqueStrings(lines)
    .map((line, index) => ({ line, score: factRelevanceScore(line, index) }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.line);
}

function factRelevanceScore(line: string, index: number): number {
  const lower = line.toLowerCase();
  let score = Math.max(0, 16 - index * 0.08);

  if (/\d/.test(line)) score += 8;
  if (/%|percentage point|percent|2034|2024|2025|2022/.test(lower)) score += 6;
  if (/(ai|artificial intelligence|automation|generative ai|large language model|llm)/.test(lower)) {
    score += 12;
  }
  if (/(job|jobs|labor|labour|worker|workers|employment|unemployment|hiring|occupation|occupational|wage|workforce)/.test(lower)) {
    score += 10;
  }
  if (/(displacement|job loss|large-scale job losses|apocalypse|automate|automated|exposure|affected|adoption)/.test(lower)) {
    score += 10;
  }
  if (/(find|finding|evidence|project|growth|unemployment|hiring|job finding|slow|drop|coverage|exposure|automated|work-related)/.test(lower)) {
    score += 7;
  }
  if (/(programmer|customer service|data entry|young worker|22-25|founder|employer|team|stakeholder)/.test(lower)) {
    score += 5;
  }
  if (/(gdp|consumer spending|sequential|qoq|tariff|real income|euro area|ea gdp|investors should consider|disclosure appendix)/.test(lower)) {
    score -= 12;
  }
  if (/(introduction|track record|humility|figure|appendix)/.test(lower)) score -= 4;
  if (line.length > 320) score -= 2;

  return score;
}

function collectFactSummaries(
  facts: UserFactItem[],
  type: UserFactType,
  limit: number,
): string[] {
  return facts
    .filter((fact) => fact.type === type)
    .slice(0, limit)
    .map((fact) => fact.summary);
}

function collectStakeholderFactSummaries(
  facts: UserFactItem[],
  limit: number,
): string[] {
  return facts
    .filter((fact) => fact.type === "stakeholder")
    .filter((fact) =>
      /(manager|team|stakeholder|partner|family|founder|executive|employer|boss|cofounder|创始|团队|老板|经理|雇主|合伙|家人)/i.test(
        fact.summary,
      ),
    )
    .filter((fact) => !/(customer agent|customer service|chatbot|vehicle|salesforce)/i.test(fact.summary))
    .slice(0, limit)
    .map((fact) => fact.summary);
}

function cleanList(values: string[] | undefined): string[] {
  return values?.map((value) => value.trim()).filter(Boolean) ?? [];
}

function inferTags(line: string): string[] {
  const lowerLine = line.toLowerCase();
  const tags: string[] = [];

  if (/(ai|llm|automation|model)/.test(lowerLine)) {
    tags.push("ai");
  }

  if (/(manager|team|stakeholder|partner|family|founder|executive)/.test(lowerLine)) {
    tags.push("people");
  }

  if (/(risk|salary|income|runway|pressure|deadline)/.test(lowerLine)) {
    tags.push("pressure");
  }

  return tags;
}

function classifyFactType(text: string): UserFactType {
  const lowerText = text.toLowerCase();

  if (/(goal|want to|aim to|trying to|hope to|looking to)/.test(lowerText)) {
    return "goal";
  }

  if (/(constraint|cannot|can't|must|need to|limited|responsibility|family)/.test(lowerText)) {
    return "constraint";
  }

  if (/\b(offer|option|path|stay|leave|pivot|move|join|switch|startup)\b|stable role|current role|创业|岗位/.test(lowerText)) {
    return "option";
  }

  if (/(risk|uncertain|downside|afraid|fear|exposure|unemployment|hiring|slowdown|drop|coverage|automated|displacement)/.test(lowerText)) {
    return "risk";
  }

  if (/(manager|team|stakeholder|partner|family|founder|executive|employer)/.test(lowerText)) {
    return "stakeholder";
  }

  if (/(timeline|month|quarter|year|deadline|urgent|soon)/.test(lowerText)) {
    return "timeline";
  }

  if (/(salary|income|mortgage|runway|pressure|cost|financial)/.test(lowerText)) {
    return "pressure";
  }

  if (/(prefer|bias|comfortable|style)/.test(lowerText)) {
    return "preference";
  }

  if (/(experience|background|currently|worked|role|position)/.test(lowerText)) {
    return "background";
  }

  if (/(resource|network|capital|time|skill|advantage|support)/.test(lowerText)) {
    return "resource";
  }

  return "other";
}

function inferOptionsFromDilemma(
  dilemma: string | undefined,
  language: OutputLanguage | undefined,
): string[] {
  const value = dilemma?.trim() ?? "";
  if (!value) return [];

  const useEnglish = language !== "zh-CN";
  const options: string[] = [];
  const zhMatch = value.match(/应该(.+?)(?:，|,|\?|？|$)/);
  const core = zhMatch?.[1] ?? value;

  if (/接受.*offer|accept/i.test(value)) {
    options.push(useEnglish ? "Accept the startup offer" : "接受创业公司 offer");
  }
  if (/留在|稳定|current|stay/i.test(value)) {
    options.push(useEnglish ? "Stay in the current stable role" : "留在目前稳定岗位");
  }
  if (/创业公司|startup/i.test(value) && !options.some((item) => /创业/.test(item))) {
    options.push(useEnglish ? "Join the startup" : "加入创业公司");
  }
  if (/还是| or /i.test(core)) {
    for (const part of core.split(/还是| or /i).map((item) => item.trim())) {
      if (part.length >= 4 && part.length <= 40) options.push(part);
    }
  }

  return uniqueStrings(options);
}

function inferStakeholdersFromDilemma(
  dilemma: string | undefined,
  language: OutputLanguage | undefined,
): string[] {
  const value = dilemma ?? "";
  const useEnglish = language !== "zh-CN";
  const stakeholders: string[] = [];

  if (/创业公司|startup/i.test(value)) {
    stakeholders.push(useEnglish ? "Startup founding team" : "创业公司创始团队");
  }
  if (/目前|当前|稳定|坚守|岗位|current employer|current role|stay/i.test(value)) {
    stakeholders.push(useEnglish ? "Current employer and team" : "当前雇主和团队");
  }
  if (/offer|岗位|career|职业|工作/i.test(value)) {
    stakeholders.push(
      useEnglish ? "Professional network and future employers" : "职业网络与未来招聘方",
    );
  }

  return stakeholders;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}
