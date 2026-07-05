import { describe, expect, it, vi } from "vitest";

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

  it("drops custom model names in production unless explicitly allowed", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("XMOCHA_ALLOW_CUSTOM_MODEL_NAMES", "");

    try {
      expect(
        normalizeModelConfig({
          provider: "openai",
          model: "not-in-the-public-catalog",
        }),
      ).toEqual({
        provider: "openai",
        turnSimulator: "legacy",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
