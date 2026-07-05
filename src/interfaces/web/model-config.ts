import type { SessionModelConfig } from "../../domain/types";
import {
  getDefaultTurnSimulatorForProvider,
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

  const model =
    typeof candidate.model === "string" && candidate.model.trim()
      ? candidate.model.trim().slice(0, 160)
      : undefined;
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
