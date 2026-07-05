/**
 * Shared utilities for Next.js API route handlers.
 */

import { NextResponse } from "next/server";

import type { IpRateLimitRule } from "../../infrastructure/security/ip-rate-limiter";
import { rateLimitResponse } from "./rate-limit-response";

export function extractAccessToken(request: Request): string | undefined {
  return request.headers.get("x-xmocha-world-token") ?? undefined;
}

export function normalizeLanguage(language: unknown): "en" | "zh-CN" {
  if (language === "en" || language === "zh-CN") {
    return language;
  }

  return "en";
}

export function normalizeRiskProfile(
  riskProfile: unknown,
): "low" | "medium" | "high" | undefined {
  if (
    riskProfile === "low" ||
    riskProfile === "medium" ||
    riskProfile === "high"
  ) {
    return riskProfile;
  }

  return undefined;
}

export function isWorldAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("private World session requires its owner token") ||
    message.includes("Private WorldPack owner token is invalid");
}

export function isWorldRevisionConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("World state revision conflict");
}

export async function withRateLimitedHandler<T>(
  request: Request,
  rule: IpRateLimitRule,
  handler: () => Promise<T>,
  options: {
    errorLabel: string;
    fallbackError: string;
    useErrorMessage?: boolean;
  },
): Promise<NextResponse> {
  try {
    const limited = await rateLimitResponse(request, rule);
    if (limited) return limited;

    const result = await handler();
    return NextResponse.json(result);
  } catch (error) {
    if (options.errorLabel) {
      console.error(options.errorLabel, error);
    }

    const message = options.useErrorMessage && error instanceof Error
      ? error.message
      : options.fallbackError;

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
