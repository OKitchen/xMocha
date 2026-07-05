import { NextResponse } from "next/server";

import {
  extractAccessToken,
  isWorldAccessError,
} from "../../../../../src/interfaces/web/api-utils";
import { getWebAblationReport } from "../../../../../src/interfaces/web/session-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../../src/interfaces/web/rate-limit-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.ablationRead,
    );
    if (limited) return limited;

    const { id } = await context.params;
    const report = await getWebAblationReport(
      id,
      extractAccessToken(request),
    );

    if (!report) {
      return NextResponse.json(
        { error: `Session "${id}" was not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("ablation_report_failed", error);
    if (isWorldAccessError(error)) {
      return NextResponse.json(
        { error: "This private World session requires its owner token." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "生成消融报告失败。" },
      { status: 500 },
    );
  }
}
