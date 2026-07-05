import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isWorldAccessError,
} from "../../../../../src/interfaces/web/api-utils";
import { createTurnRunRepository } from "../../../../../src/infrastructure/runtime/create-runtime";
import { getWebSession } from "../../../../../src/interfaces/web/session-service";
import { assertWorldAccess } from "../../../../../src/interfaces/web/world-session-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../../src/interfaces/web/rate-limit-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (process.env.NODE_ENV === "production" && process.env.XMOCHA_EXPOSE_WORLD_TRACE !== "1") {
      return NextResponse.json({ error: "World trace API is disabled." }, { status: 404 });
    }

    const limited = await rateLimitResponse(request, publicRateLimits.worldTrace);
    if (limited) return limited;

    const { id } = await context.params;
    const session = await getWebSession(id);
    if (!session) {
      return NextResponse.json({ error: `Session "${id}" was not found.` }, { status: 404 });
    }
    assertWorldAccess(session, extractAccessToken(request));

    const runs = await createTurnRunRepository().listForSession(id);
    return NextResponse.json({
      runs: runs
        .sort((left, right) => left.turn - right.turn || left.attempt - right.attempt)
        .map((run) => ({
          traceId: run.traceId,
          turn: run.turn,
          attempt: run.attempt,
          provider: run.provider,
          model: run.model,
          promptStyle: run.promptStyle,
          status: run.status,
          fallbackUsed: run.fallbackUsed,
          retryReason: run.retryReason,
          selectedCandidateId: run.selectedCandidateId,
          validationIssueCodes: run.validationIssueCodes,
          nodes: run.nodes ?? [],
          candidateStatePreviews: run.candidateStatePreviews ?? [],
        })),
    });
  } catch (error) {
    console.error("world_trace_load_failed", error);
    if (isWorldAccessError(error)) {
      return NextResponse.json(
        { error: "This private World session requires its owner token." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "暂时无法加载 World trace，请重试。" },
      { status: 500 },
    );
  }
}
