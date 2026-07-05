import { NextResponse } from "next/server";

import { normalizeLanguage } from "../../../../src/interfaces/web/api-utils";
import { normalizeModelConfig } from "../../../../src/interfaces/web/model-config";
import { compileWorldSource } from "../../../../src/interfaces/web/world-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

export async function POST(request: Request) {
  try {
    if (!isLocalWorldCompileRateLimitDisabled()) {
      const limited = await rateLimitResponse(request, publicRateLimits.worldCompile);
      if (limited) return limited;
    }

    const body = (await request.json()) as {
      title?: string;
      language?: string;
      sourceType?: string;
      content?: string;
      rightsConfirmed?: boolean;
      modelConfig?: unknown;
    };
    const sourceType =
      body.sourceType === "narrative" || body.sourceType === "lore"
        ? body.sourceType
        : "auto";
    const result = await compileWorldSource({
      title: body.title?.trim() ?? "",
      language: normalizeLanguage(body.language),
      sourceType,
      content: body.content ?? "",
      rightsConfirmed: body.rightsConfirmed === true,
      modelConfig: normalizeModelConfig(body.modelConfig),
    });
    return NextResponse.json(result);
  } catch (error) {
    const validationMessage = getWorldCompileValidationMessage(error);
    console.error("world_compile_failed", error);
    return NextResponse.json(
      { error: validationMessage ?? "World compilation failed." },
      { status: validationMessage ? 400 : 500 },
    );
  }
}

function getWorldCompileValidationMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const message = error.message;
  const normalized = message.toLowerCase();
  if (
    normalized.includes("required") ||
    normalized.includes("invalid") ||
    normalized.includes("too short") ||
    normalized.includes("too long") ||
    normalized.includes("exceeds") ||
    message.includes("损坏")
  ) {
    return message;
  }

  return undefined;
}

function isLocalWorldCompileRateLimitDisabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.XMOCHA_DISABLE_WORLD_COMPILE_RATE_LIMIT === "1"
  );
}
