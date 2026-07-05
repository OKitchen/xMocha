import { describe, expect, it } from "vitest";

import { normalizeModelConfig } from "./model-config";

describe("normalizeModelConfig", () => {
  it("normalizes catalog-supported providers and trims model names", () => {
    expect(
      normalizeModelConfig({
        provider: "huggingface",
        model: "  zai-org/GLM-5.2:zai-org  ",
      }),
    ).toEqual({
      provider: "huggingface",
      model: "zai-org/GLM-5.2:zai-org",
      turnSimulator: "legacy",
    });
  });

  it("uses the catalog default simulator for local Gemma", () => {
    expect(normalizeModelConfig({ provider: "gemma" })).toEqual({
      provider: "gemma",
      turnSimulator: "unified",
    });
  });

  it("normalizes OpenAI with the catalog simulator default", () => {
    expect(normalizeModelConfig({ provider: "openai" })).toEqual({
      provider: "openai",
      turnSimulator: "legacy",
    });
  });

  it("rejects unsupported providers", () => {
    expect(normalizeModelConfig({ provider: "unknown", model: "x" })).toBeUndefined();
  });

  it("caps custom model names", () => {
    const normalized = normalizeModelConfig({
      provider: "deepseek",
      model: "x".repeat(220),
    });

    expect(normalized?.model).toHaveLength(160);
  });
});
