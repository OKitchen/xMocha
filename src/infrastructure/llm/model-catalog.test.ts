import { describe, expect, it } from "vitest";

import {
  buildPublicModelCatalog,
  getConfiguredModelForProvider,
} from "./model-catalog";

function testEnv(values: Record<string, string>): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...values,
  } as NodeJS.ProcessEnv;
}

describe("buildPublicModelCatalog", () => {
  it("reports configured providers without leaking secret values", () => {
    const catalog = buildPublicModelCatalog(testEnv({
      XMOCHA_MODEL_PROVIDER: "huggingface",
      HF_TOKEN: "super-secret-hf-token",
    }));
    const huggingFace = catalog.providers.find(
      (provider) => provider.id === "huggingface",
    );

    expect(catalog.defaultProvider).toBe("huggingface");
    expect(catalog.defaultModel).toBe("zai-org/GLM-5.2:zai-org");
    expect(huggingFace?.configured).toBe(true);
    expect(huggingFace?.missingEnvVars).toEqual([]);
    expect(JSON.stringify(catalog)).not.toContain("super-secret-hf-token");
  });

  it("reports missing token status for providers that require env vars", () => {
    const catalog = buildPublicModelCatalog(testEnv({
      XMOCHA_MODEL_PROVIDER: "google",
    }));
    const google = catalog.providers.find((provider) => provider.id === "google");

    expect(google?.configured).toBe(false);
    expect(google?.status).toBe("missing_env");
    expect(google?.missingEnvVars).toEqual(["GOOGLE_API_KEY"]);
  });

  it("includes OpenAI with optional secret-free status metadata", () => {
    const catalog = buildPublicModelCatalog(testEnv({
      XMOCHA_MODEL_PROVIDER: "openai",
      OPENAI_API_KEY: "super-secret-openai-token",
    }));
    const openai = catalog.providers.find((provider) => provider.id === "openai");

    expect(catalog.defaultProvider).toBe("openai");
    expect(catalog.defaultModel).toBe("gpt-5.4-mini");
    expect(openai?.configured).toBe(true);
    expect(openai?.requiredEnvVars).toEqual(["OPENAI_API_KEY"]);
    expect(JSON.stringify(catalog)).not.toContain("super-secret-openai-token");
  });

  it("marks local Gemma as configured and exposes forced fallback warnings", () => {
    const catalog = buildPublicModelCatalog(testEnv({
      XMOCHA_MODEL_PROVIDER: "gemma",
      XMOCHA_BRANCH_GENERATOR: "mock",
      XMOCHA_WORLD_GENERATOR: "fallback",
    }));
    const gemma = catalog.providers.find((provider) => provider.id === "gemma");

    expect(gemma?.configured).toBe(true);
    expect(gemma?.status).toBe("local_runtime");
    expect(catalog.forcedFallback).toEqual({ decision: true, world: true });
    expect(catalog.warnings.map((warning) => warning.code)).toEqual([
      "DECISION_FORCED_MOCK",
      "WORLD_FORCED_FALLBACK",
    ]);
  });

  it("uses GEMMA_MODEL for non-Ollama Gemma runtimes", () => {
    expect(getConfiguredModelForProvider("gemma", testEnv({
      GEMMA_RUNTIME: "huggingface",
      GEMMA_MODEL: "google/gemma-4-26B-A4B-it:novita",
    }))).toBe("google/gemma-4-26B-A4B-it:novita");
  });

  it("reports Hugging Face-routed Gemma as a token-backed provider", () => {
    const catalog = buildPublicModelCatalog(testEnv({
      XMOCHA_MODEL_PROVIDER: "gemma",
      GEMMA_RUNTIME: "huggingface",
      GEMMA_MODEL: "google/gemma-4-26B-A4B-it:novita",
      HF_TOKEN: "super-secret-hf-token",
    }));
    const gemma = catalog.providers.find((provider) => provider.id === "gemma");

    expect(catalog.defaultModel).toBe("google/gemma-4-26B-A4B-it:novita");
    expect(gemma?.labels.en).toBe("Gemma / Hugging Face Router");
    expect(gemma?.configured).toBe(true);
    expect(gemma?.status).toBe("ready");
    expect(JSON.stringify(catalog)).not.toContain("super-secret-hf-token");
  });
});
