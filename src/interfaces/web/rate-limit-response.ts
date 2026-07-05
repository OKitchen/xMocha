import { NextResponse } from "next/server";

import {
  checkIpRateLimit,
  type IpRateLimitRule,
} from "../../infrastructure/security/ip-rate-limiter";

const minute = 60_000;

export const publicRateLimits = {
  sessionStart: { scope: "session-start", limit: 4, windowMs: 10 * minute },
  documentExtract: { scope: "document-extract", limit: 12, windowMs: 10 * minute },
  sessionChoose: { scope: "session-choose", limit: 15, windowMs: 10 * minute },
  sessionRetry: { scope: "session-retry", limit: 6, windowMs: 10 * minute },
  sessionRead: { scope: "session-read", limit: 120, windowMs: minute },
  ablationRead: { scope: "ablation-read", limit: 20, windowMs: 10 * minute },
  contact: { scope: "contact", limit: 3, windowMs: 60 * minute },
  feedback: { scope: "feedback", limit: 5, windowMs: 60 * minute },
  analytics: { scope: "analytics", limit: 60, windowMs: minute },
  worldCompile: { scope: "world-compile", limit: 3, windowMs: 60 * minute },
  worldConfirm: { scope: "world-confirm", limit: 6, windowMs: 60 * minute },
  worldList: { scope: "world-list", limit: 60, windowMs: minute },
  worldTrace: { scope: "world-trace", limit: 30, windowMs: minute },
  modelTest: { scope: "model-test", limit: 8, windowMs: 10 * minute },
} satisfies Record<string, IpRateLimitRule>;

export async function rateLimitResponse(
  request: Request,
  rule: IpRateLimitRule,
): Promise<NextResponse | null> {
  const result = await checkIpRateLimit(request, rule);

  if (result.allowed) {
    return null;
  }

  const prefersChinese = /(^|,)\s*zh(?:-|;|,|$)/i.test(
    request.headers.get("accept-language") ?? "",
  );
  const error = prefersChinese
    ? `请求过于频繁，请在 ${result.retryAfterSeconds} 秒后再试。`
    : `Too many requests. Please retry in ${result.retryAfterSeconds} seconds.`;

  return NextResponse.json(
    {
      error,
      code: "RATE_LIMITED",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
