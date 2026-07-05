import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

const managedEnvKeys = [
  "XMOCHA_MODEL_PROVIDER",
  "HF_TOKEN",
  "HUGGINGFACE_API_KEY",
  "HF_API_TOKEN",
  "HUGGINGFACE_MODEL",
  "HF_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
] as const;

const previousEnv = new Map<string, string | undefined>();

afterEach(() => {
  for (const key of managedEnvKeys) {
    const previous = previousEnv.get(key);
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
  previousEnv.clear();
});

function setManagedEnv(values: Record<string, string | undefined>) {
  for (const key of managedEnvKeys) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("GET /api/models", () => {
  it("returns safe public model metadata without secrets", async () => {
    setManagedEnv({
      XMOCHA_MODEL_PROVIDER: "huggingface",
      HF_TOKEN: "route-secret-token",
    });

    const response = await GET();
    const text = await response.text();
    const payload = JSON.parse(text) as {
      defaultProvider: string;
      providers: Array<{ id: string; configured: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(payload.defaultProvider).toBe("huggingface");
    expect(
      payload.providers.find((provider) => provider.id === "huggingface")
        ?.configured,
    ).toBe(true);
    expect(text).not.toContain("route-secret-token");
  });
});
