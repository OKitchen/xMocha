import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isWorldAccessError,
} from "../../../../src/interfaces/web/api-utils";
import { getWebSession } from "../../../../src/interfaces/web/session-service";
import {
  assertWorldAccess,
  projectSessionForClient,
} from "../../../../src/interfaces/web/world-session-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.sessionRead,
    );
    if (limited) return limited;

    const { id } = await context.params;
    const session = await getWebSession(id);

    if (!session) {
      return NextResponse.json(
        { error: `Session "${id}" was not found.` },
        { status: 404 },
      );
    }

    assertWorldAccess(session, extractAccessToken(request));
    return NextResponse.json(projectSessionForClient(session));
  } catch (error) {
    console.error("session_load_failed", error);
    if (isWorldAccessError(error)) {
      return NextResponse.json(
        { error: "This private World session requires its owner token." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "暂时无法加载此结果，请重试。" },
      { status: 500 },
    );
  }
}
