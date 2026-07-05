import { writeFile } from "node:fs/promises";

import { buildAgentEvalCases, type AgentEvalCase } from "../../domain/agent-eval";
import type { SessionAnalyticsEvent, SessionState } from "../../domain/types";
import {
  createSessionRepository,
  createTurnRunRepository,
} from "../../infrastructure/runtime/create-runtime";

type ExportPayload = {
  exportedAt: string;
  caseCount: number;
  cases: AgentEvalCase[];
};

async function main(): Promise<void> {
  const sessions = await createSessionRepository().list();
  const turnRunRepository = createTurnRunRepository();
  const cases: AgentEvalCase[] = [];

  for (const session of sessions) {
    const turnRuns = await turnRunRepository.listForSession(session.sessionId);
    if (turnRuns.length === 0) continue;
    cases.push(
      ...buildAgentEvalCases({
        session,
        turnRuns,
        userFeedback: feedbackFromSession(session),
      }),
    );
  }

  const payload: ExportPayload = {
    exportedAt: new Date().toISOString(),
    caseCount: cases.length,
    cases,
  };
  const outputPath = process.argv[2];
  const format = process.env.XMOCHA_EVAL_EXPORT_FORMAT === "json"
    ? "json"
    : "jsonl";
  const output = format === "json"
    ? `${JSON.stringify(payload, null, 2)}\n`
    : cases.map((item) => JSON.stringify(item)).join("\n") + (cases.length ? "\n" : "");

  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
    console.log(`Exported ${cases.length} agent eval cases to ${outputPath}`);
  } else {
    process.stdout.write(output);
  }
}

function feedbackFromSession(session: SessionState): AgentEvalCase["userFeedback"] | undefined {
  const feedback = [...session.analyticsEvents]
    .reverse()
    .find((event): event is SessionAnalyticsEvent & {
      metadata: { helpful?: boolean; recommendationScore?: number };
    } => event.name === "feedback_submitted");
  if (!feedback) return undefined;

  return {
    completed: session.status === "complete",
    helpful: typeof feedback.metadata?.helpful === "boolean"
      ? feedback.metadata.helpful
      : undefined,
    rating: typeof feedback.metadata?.recommendationScore === "number"
      ? feedback.metadata.recommendationScore
      : undefined,
  };
}

await main();
