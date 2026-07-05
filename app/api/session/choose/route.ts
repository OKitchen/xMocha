import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isSessionAccessError,
  isWorldAccessError,
  isWorldRevisionConflictError,
  normalizeRiskProfile,
} from "../../../../src/interfaces/web/api-utils";
import { chooseWebTurnAction } from "../../../../src/interfaces/web/session-service";
import { projectSessionForClient } from "../../../../src/interfaces/web/world-session-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.sessionChoose,
    );
    if (limited) return limited;

    const body = (await request.json()) as {
      sessionId?: string;
      branchId?: string;
      authoredAction?: {
        rawInput?: string;
        riskProfile?: string;
        timeHorizon?: string;
        anchorBranchId?: string;
      };
      expectedRevision?: number;
    };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "sessionId 是必填项。" },
        { status: 400 },
      );
    }

    if (!body.branchId && !body.authoredAction?.rawInput?.trim()) {
      return NextResponse.json(
        { error: "branchId 或 authoredAction.rawInput 是必填项。" },
        { status: 400 },
      );
    }

    const session = await chooseWebTurnAction({
      sessionId: body.sessionId,
      branchId: body.branchId?.slice(0, 200),
      authoredAction: body.authoredAction?.rawInput?.trim()
        ? {
            rawInput: body.authoredAction.rawInput.trim().slice(0, 2000),
            riskProfile: normalizeRiskProfile(body.authoredAction.riskProfile),
            timeHorizon: body.authoredAction.timeHorizon?.trim().slice(0, 200) || undefined,
            anchorBranchId: body.authoredAction.anchorBranchId?.trim().slice(0, 200) || undefined,
          }
        : undefined,
      expectedRevision: Number.isInteger(body.expectedRevision)
        ? body.expectedRevision
        : undefined,
      accessToken: extractAccessToken(request),
    });

    return NextResponse.json(projectSessionForClient(session));
  } catch (error) {
    console.error("choose_branch_failed", error);
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
    if (isWorldRevisionConflictError(error)) {
      return NextResponse.json(
        { error: "This turn was already updated. Reload the latest session before choosing again." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "操作失败，请重试。页面会从最近已保存的进度恢复。" },
      { status: 500 },
    );
  }
}
