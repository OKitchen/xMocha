import { NextResponse } from "next/server";

import type { WorldPackDraft } from "../../../../src/domain/world-types";
import { confirmWorldPackDraft } from "../../../../src/interfaces/web/world-service";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

export async function POST(request: Request) {
  try {
    const limited = await rateLimitResponse(request, publicRateLimits.worldConfirm);
    if (limited) return limited;
    const body = (await request.json()) as { draft?: WorldPackDraft };
    if (!body.draft) {
      return NextResponse.json({ error: "draft is required." }, { status: 400 });
    }
    const result = await confirmWorldPackDraft(body.draft);
    return NextResponse.json(result);
  } catch (error) {
    const validationMessage = getWorldConfirmValidationMessage(error);
    console.error("world_confirm_failed", error);
    return NextResponse.json(
      { error: validationMessage ?? "World confirmation failed." },
      { status: validationMessage ? 400 : 500 },
    );
  }
}

function getWorldConfirmValidationMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.message.startsWith("WorldPack validation failed:")) {
    return error.message;
  }
  if (error.name === "ZodError") {
    return "World draft is invalid.";
  }
  return undefined;
}
