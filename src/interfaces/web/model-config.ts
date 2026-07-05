import type { SessionModelConfig } from "../../domain/types";
import {
  getConfiguredModelForProvider,
  getDefaultTurnSimulatorForProvider,
  getModelCatalogProvider,
  isModelProvider,
} from "../../infrastructure/llm/model-catalog";

export function normalizeModelConfig(config: unknown): SessionModelConfig | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const candidate = config as {
    model?: unknown;
    provider?: unknown;
    turnSimulator?: unknown;
  };
  const provider = candidate.provider;

  if (!isModelProvider(provider)) {
    return undefined;
  }

  const model = normalizeRequestedModel(provider, candidate.model);
  const turnSimulator =
    candidate.turnSimulator === "legacy" || candidate.turnSimulator === "unified"
      ? candidate.turnSimulator
      : getDefaultTurnSimulatorForProvider(provider);

  return {
    provider,
    ...(model ? { model } : {}),
    ...(turnSimulator ? { turnSimulator } : {}),
  };
}

function normalizeRequestedModel(
  provider: SessionModelConfig["provider"],
  value: unknown,
): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const model = value.trim().slice(0, 160);

  if (allowsCustomModelNames()) {
    return model;
  }

  const allowedModels = new Set([
    getConfiguredModelForProvider(provider),
    ...getModelCatalogProvider(provider).modelPresets.map((preset) => preset.model),
  ]);
  return allowedModels.has(model) ? model : undefined;
}

function allowsCustomModelNames(): boolean {
  return process.env.NODE_ENV !== "production" ||
    process.env.XMOCHA_ALLOW_CUSTOM_MODEL_NAMES === "1";
}
