import { NextResponse } from "next/server";

import { isPresetScenarioId } from "../../../../src/domain/preset-scenarios";
import {
  isWorldAccessError,
  normalizeLanguage,
} from "../../../../src/interfaces/web/api-utils";
import { normalizeModelConfig } from "../../../../src/interfaces/web/model-config";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";
import { startWebSession } from "../../../../src/interfaces/web/session-service";
import {
  projectSessionForClient,
  startWorldSession,
} from "../../../../src/interfaces/web/world-session-service";

function normalizeTheme(theme: unknown):
  | "adventure"
  | "sci-fi"
  | "dream"
  | "hell"
  | "humorous" {
  if (
    theme === "adventure" ||
    theme === "sci-fi" ||
    theme === "dream" ||
    theme === "hell" ||
    theme === "humorous"
  ) {
    return theme;
  }

  return "sci-fi";
}

function normalizeVisualMode(visualMode: unknown): "avatar-room" {
  return visualMode === "avatar-room" ? visualMode : "avatar-room";
}

function normalizeVisualStyle(
  visualStyle: unknown,
): "career-studio" | "city-apartment" | "night-cafe" {
  if (
    visualStyle === "career-studio" ||
    visualStyle === "city-apartment" ||
    visualStyle === "night-cafe"
  ) {
    return visualStyle;
  }

  return "career-studio";
}

function normalizeUserSourceKind(kind: unknown): "text" | "markdown" | "json" | "pdf" | "note" {
  if (
    kind === "text" ||
    kind === "markdown" ||
    kind === "json" ||
    kind === "pdf" ||
    kind === "note"
  ) {
    return kind;
  }

  return "text";
}

const maxUserProvidedTextCharacters = 150_000;

export async function POST(request: Request) {
  let responseLanguage: "en" | "zh-CN" = "en";

  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.sessionStart,
    );
    if (limited) return limited;

    const body = (await request.json()) as {
      dilemma?: string;
      theme?: string;
      language?: string;
      visualMode?: string;
      visualStyle?: string;
      maxTurns?: number;
      presetScenarioId?: string;
      userContextPack?: {
        userGoal?: string;
        currentPosition?: string;
        riskPreference?: string;
        timeHorizon?: string;
        availableOptions?: string[];
        personalConstraints?: string[];
        keyStakeholders?: string[];
        successCriteria?: string[];
      };
      userProvidedData?: {
        rawText?: string;
        sources?: Array<{
          kind?: string;
          title?: string;
          content?: string;
        }>;
      };
      modelConfig?: unknown;
      mode?: string;
      worldPackId?: string;
      worldPackVersion?: number;
      ownerToken?: string;
      player?: {
        characterId?: string;
        customCharacter?: {
          name?: string;
          identity?: string;
          goal?: string;
          strength?: string;
          weakness?: string;
        };
      };
      primaryGoal?: string;
    };

    const dilemma = body.dilemma?.trim().slice(0, 2000);
    responseLanguage = normalizeLanguage(body.language);
    const modelConfig = normalizeModelConfig(body.modelConfig);
    const presetScenarioId = isPresetScenarioId(body.presetScenarioId)
      ? body.presetScenarioId
      : undefined;

    if (body.mode === "world") {
      if (!body.worldPackId?.trim() || !body.primaryGoal?.trim()) {
        return NextResponse.json(
          {
            error: responseLanguage === "en"
              ? "worldPackId and primaryGoal are required."
              : "worldPackId 和 primaryGoal 是必填项。",
          },
          { status: 400 },
        );
      }
      const custom = body.player?.customCharacter;
      const session = await startWorldSession({
        worldPackId: body.worldPackId.trim().slice(0, 200),
        worldPackVersion: Number.isFinite(body.worldPackVersion)
          ? body.worldPackVersion
          : undefined,
        ownerToken: body.ownerToken?.trim().slice(0, 200) || undefined,
        playerCharacterId: body.player?.characterId?.trim().slice(0, 200) || undefined,
        customCharacter: custom
          ? {
              name: custom.name?.trim().slice(0, 100) ?? "",
              identity: custom.identity?.trim().slice(0, 500) ?? "",
              goal: custom.goal?.trim().slice(0, 500) ?? "",
              strength: custom.strength?.trim().slice(0, 500) ?? "",
              weakness: custom.weakness?.trim().slice(0, 500) ?? "",
            }
          : undefined,
        primaryGoal: body.primaryGoal.trim().slice(0, 1000),
        language: responseLanguage,
        modelConfig,
      });
      return NextResponse.json(projectSessionForClient(session));
    }

    if (!dilemma && !presetScenarioId) {
      return NextResponse.json(
        {
          error: responseLanguage === "en"
            ? "Enter a dilemma or choose a preset scenario."
            : "必须填写困境或选择预设场景。",
        },
        { status: 400 },
      );
    }

    const session = await startWebSession({
      dilemma,
      theme: normalizeTheme(body.theme),
      language: responseLanguage,
      visualMode: normalizeVisualMode(body.visualMode),
      visualStyle: normalizeVisualStyle(body.visualStyle),
      modelConfig,
      maxTurns: Math.min(Math.max(Number(body.maxTurns) || 3, 1), 5),
      presetScenarioId,
      userContextPack: body.userContextPack
        ? {
            userGoal: body.userContextPack.userGoal?.trim().slice(0, 1000) || undefined,
            currentPosition: body.userContextPack.currentPosition?.trim().slice(0, 1000) || undefined,
            riskPreference:
              body.userContextPack.riskPreference === "low" ||
              body.userContextPack.riskPreference === "medium" ||
              body.userContextPack.riskPreference === "high"
                ? body.userContextPack.riskPreference
                : undefined,
            timeHorizon: body.userContextPack.timeHorizon?.trim().slice(0, 200) || undefined,
            availableOptions:
              body.userContextPack.availableOptions?.slice(0, 20).map((item) => item.trim().slice(0, 500)).filter(Boolean) ??
              undefined,
            personalConstraints:
              body.userContextPack.personalConstraints
                ?.slice(0, 20).map((item) => item.trim().slice(0, 500))
                .filter(Boolean) ?? undefined,
            keyStakeholders:
              body.userContextPack.keyStakeholders
                ?.slice(0, 20).map((item) => item.trim().slice(0, 200))
                .filter(Boolean) ?? undefined,
            successCriteria:
              body.userContextPack.successCriteria
                ?.slice(0, 20).map((item) => item.trim().slice(0, 500))
                .filter(Boolean) ?? undefined,
          }
        : undefined,
      userProvidedData: body.userProvidedData?.rawText?.trim()
        || body.userProvidedData?.sources?.some((source) => source.content?.trim())
        ? {
            rawText: body.userProvidedData?.rawText?.trim().slice(0, maxUserProvidedTextCharacters) || undefined,
            sources: body.userProvidedData?.sources
              ?.slice(0, 10)
              .map((source) => ({
                kind: normalizeUserSourceKind(source.kind),
                title: source.title?.trim().slice(0, 200) || undefined,
                content: source.content?.trim().slice(0, maxUserProvidedTextCharacters) ?? "",
              }))
              .filter((source) => source.content),
          }
        : undefined,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("session_start_failed", error);
    if (isWorldAccessError(error)) {
      return NextResponse.json(
        {
          error: responseLanguage === "en"
            ? "This private WorldPack requires its owner token."
            : "这个私人 WorldPack 需要 owner token。",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error:
          responseLanguage === "en"
            ? "Generation failed. Please retry."
            : "生成失败，请重试。",
      },
      { status: 500 },
    );
  }
}
