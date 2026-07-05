import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isWorldAccessError,
} from "../../../../src/interfaces/web/api-utils";
import { retryWebTurnGeneration } from "../../../../src/interfaces/web/session-service";
import { projectSessionForClient } from "../../../../src/interfaces/web/world-session-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.sessionRetry,
    );
    if (limited) return limited;

    const body = (await request.json()) as {
      sessionId?: string;
    };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "sessionId 是必填项。" },
        { status: 400 },
      );
    }

    const session = await retryWebTurnGeneration({
      sessionId: body.sessionId,
      accessToken: extractAccessToken(request),
    });

    return NextResponse.json(projectSessionForClient(session));
  } catch (error) {
    console.error("generate_next_turn_failed", error);
    if (isWorldAccessError(error)) {
      return NextResponse.json(
        { error: "This private World session requires its owner token." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "生成失败，请重试。" },
      { status: 500 },
    );
  }
}
