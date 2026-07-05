import { randomUUID } from "node:crypto";

import { createWorldAccessToken, hashWorldAccessToken } from "../../domain/world-access";
import { validateWorldPackQuality } from "../../domain/world-quality";
import { worldPackDraftSchema } from "../../domain/world-schemas";
import { validateWorldPack } from "../../domain/world-validation";
import type { SessionModelConfig } from "../../domain/types";
import type { WorldPack, WorldPackDraft, WorldSourceType } from "../../domain/world-types";
import { createJsonGenerationClient } from "../../infrastructure/llm/provider-factory";
import { withRuntimeModelConfig } from "../../infrastructure/llm/runtime-model-config";
import { createWorldPackRepository } from "../../infrastructure/runtime/create-runtime";
import {
  WorldCompiler,
  type CompileWorldSourceResult,
} from "../../infrastructure/world/world-compiler";

export async function compileWorldSource(params: {
  title: string;
  language: "zh-CN" | "en";
  sourceType: "auto" | WorldSourceType;
  content: string;
  rightsConfirmed: boolean;
  modelConfig?: SessionModelConfig;
}): Promise<CompileWorldSourceResult> {
  let compiler: WorldCompiler;
  try {
    if (process.env.XMOCHA_WORLD_GENERATOR === "fallback") {
      throw new Error("World deterministic fallback requested.");
    }
    const { client } = await withRuntimeModelConfig(
      params.modelConfig,
      async () => createJsonGenerationClient(),
    );
    compiler = new WorldCompiler(client);
  } catch (error) {
    compiler = new WorldCompiler(
      undefined,
      error instanceof Error ? error.message : String(error),
    );
  }
  return compiler.compile(params);
}

export async function confirmWorldPackDraft(draftInput: WorldPackDraft): Promise<{
  pack: WorldPack;
  ownerToken: string;
}> {
  const draft = worldPackDraftSchema.parse(draftInput);
  const now = new Date().toISOString();
  const pack: WorldPack = {
    ...draft,
    schemaVersion: "world-pack-v1",
    worldPackId: `world-${randomUUID()}`,
    version: 1,
    visibility: "private",
    sourceAttribution: {
      ...draft.sourceAttribution,
      rightsBasis: "user-confirmed-private-use",
    },
  };
  const issues = [
    ...validateWorldPack(pack),
    ...validateWorldPackQuality(pack),
  ];
  if (issues.length > 0) {
    throw new Error(
      `WorldPack validation failed: ${issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ")}`,
    );
  }

  const ownerToken = createWorldAccessToken();
  await createWorldPackRepository().save({
    pack,
    ownerTokenHash: hashWorldAccessToken(ownerToken),
    createdAt: now,
    updatedAt: now,
  });
  return { pack, ownerToken };
}

export async function listPublicWorldPacks(): Promise<WorldPack[]> {
  return createWorldPackRepository().listCurated();
}
