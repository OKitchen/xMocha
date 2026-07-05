import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isSessionAccessError,
  isWorldAccessError,
} from "../../../../src/interfaces/web/api-utils";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";
import { submitWebFeedback } from "../../../../src/interfaces/web/session-service";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.feedback,
    );
    if (limited) return limited;

    const body = (await request.json()) as {
      sessionId?: string;
      helpful?: unknown;
      recommendationScore?: unknown;
    };
    const recommendationScore = Number(body.recommendationScore);

    if (
      !body.sessionId ||
      typeof body.helpful !== "boolean" ||
      !Number.isInteger(recommendationScore) ||
      recommendationScore < 0 ||
      recommendationScore > 10
    ) {
      return NextResponse.json(
        { error: "请回答两个反馈问题后再提交。" },
        { status: 400 },
      );
    }

    await submitWebFeedback({
      sessionId: body.sessionId,
      helpful: body.helpful,
      recommendationScore,
      accessToken: extractAccessToken(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("feedback_submission_failed", error);
    if (isSessionAccessError(error)) {
      return NextResponse.json(
        { error: "This session requires its owner token." },
        { status: 403 },
      );
    }
    if (isWorldAccessError(error)) {
      return NextResponse.json(
        { error: "This private World session requires its owner token." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "反馈提交失败，请重试。" },
      { status: 500 },
    );
  }
}
