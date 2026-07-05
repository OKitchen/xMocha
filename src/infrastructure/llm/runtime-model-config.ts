import { AsyncLocalStorage } from "node:async_hooks";

export type RuntimeModelProvider =
  | "anthropic"
  | "deepseek"
  | "gemma"
  | "google"
  | "huggingface"
  | "openai";

export type RuntimeTurnSimulator = "legacy" | "unified";

export type RuntimeModelConfig = {
  provider?: RuntimeModelProvider;
  model?: string;
  turnSimulator?: RuntimeTurnSimulator;
};

const runtimeModelConfigStore = new AsyncLocalStorage<RuntimeModelConfig>();

export function getRuntimeModelConfig(): RuntimeModelConfig | undefined {
  return runtimeModelConfigStore.getStore();
}

export async function withRuntimeModelConfig<T>(
  config: RuntimeModelConfig | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!config?.provider && !config?.model && !config?.turnSimulator) {
    return fn();
  }

  return runtimeModelConfigStore.run(config, fn);
}
