import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isSessionAccessError,
  isWorldAccessError,
} from "../../../src/interfaces/web/api-utils";
import {
  getOwnedWebSession,
  trackWebAnalyticsEvent,
} from "../../../src/interfaces/web/session-service";
import { assertWorldAccess } from "../../../src/interfaces/web/world-session-service";
import { createContactRepository } from "../../../src/infrastructure/runtime/create-runtime";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../src/interfaces/web/rate-limit-response";

type ContactIntent = "beta" | "partner" | "invest" | "resource";

function normalizeIntent(value: unknown): ContactIntent {
  if (
    value === "beta" ||
    value === "partner" ||
    value === "invest" ||
    value === "resource"
  ) {
    return value;
  }

  return "beta";
}

export async function POST(request: Request) {
  try {
    const limited = await rateLimitResponse(request, publicRateLimits.contact);
    if (limited) return limited;

    const body = (await request.json()) as {
      contact?: string;
      intent?: string;
      message?: string;
      sessionId?: string;
    };
    const contact = body.contact?.trim().slice(0, 500);
    const intent = normalizeIntent(body.intent);
    const message = body.message?.trim().slice(0, 2000);
    const sessionId = body.sessionId?.trim().slice(0, 200);
    const accessToken = extractAccessToken(request);

    if (!contact) {
      return NextResponse.json(
        { error: "请填写邮箱、微信或其他联系方式。" },
        { status: 400 },
      );
    }

    if (sessionId) {
      const session = await getOwnedWebSession(sessionId, accessToken);
      if (!session) {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }
      assertWorldAccess(session, accessToken);
    }

    await createContactRepository().save({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      contact,
      intent,
      message,
      sessionId,
    });

    if (sessionId) {
      await trackWebAnalyticsEvent({
        sessionId,
        eventName: "contact_submitted",
        metadata: {
          intent,
        },
        accessToken,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("contact_submission_failed", error);
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
      { error: "提交失败，请重试。" },
      { status: 500 },
    );
  }
}
