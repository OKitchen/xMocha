import { NextResponse } from "next/server";

import type { SessionAnalyticsEventName } from "../../../../src/domain/types";
import {
  extractAccessToken,
  isSessionAccessError,
  isWorldAccessError,
} from "../../../../src/interfaces/web/api-utils";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";
import { trackWebAnalyticsEvent } from "../../../../src/interfaces/web/session-service";

function normalizeEventName(value: unknown): SessionAnalyticsEventName | undefined {
  if (
    value === "session_started" ||
    value === "first_turn_generated" ||
    value === "branch_selected" ||
    value === "next_turn_generated" ||
    value === "session_completed" ||
    value === "generation_failed" ||
    value === "share_clicked" ||
    value === "contact_submitted"
  ) {
    return value;
  }

  return undefined;
}

function normalizeMetadata(
  value: unknown,
): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string | number | boolean] =>
      typeof entry[1] === "string" ||
      typeof entry[1] === "number" ||
      typeof entry[1] === "boolean",
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export async function POST(request: Request) {
  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.analytics,
    );
    if (limited) return limited;

    const body = (await request.json()) as {
      sessionId?: string;
      eventName?: string;
      metadata?: unknown;
    };
    const eventName = normalizeEventName(body.eventName);

    if (!body.sessionId || !eventName) {
      return NextResponse.json(
        { error: "sessionId 和有效 eventName 是必填项。" },
        { status: 400 },
      );
    }

    const session = await trackWebAnalyticsEvent({
      sessionId: body.sessionId,
      eventName,
      metadata: normalizeMetadata(body.metadata),
      accessToken: extractAccessToken(request),
    });

    return NextResponse.json({ ok: true, analyticsEvents: session.analyticsEvents });
  } catch (error) {
    console.error("analytics_event_failed", error);
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
      { error: "记录 analytics 失败。" },
      { status: 500 },
    );
  }
}
