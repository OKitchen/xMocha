import { NextResponse } from "next/server";

import {
  createJsonGenerationClient,
  getActiveModelName,
  getActiveProviderLabel,
} from "../../../../src/infrastructure/llm/provider-factory";
import { withRuntimeModelConfig } from "../../../../src/infrastructure/llm/runtime-model-config";
import { normalizeModelConfig } from "../../../../src/interfaces/web/model-config";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

const testTimeoutMs = 20_000;

export type ModelTestDiagnostic = {
  code: "google_project_denied" | "ollama_unavailable" | "ollama_model_missing";
  message: {
    "zh-CN": string;
    en: string;
  };
};

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const secretValues = [
    process.env.HF_TOKEN,
    process.env.HUGGINGFACE_API_KEY,
    process.env.HF_API_TOKEN,
    process.env.OPENAI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.DEEPSEEK_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GEMMA_API_KEY,
  ].filter((value): value is string => Boolean(value && value.length > 3));

  return secretValues
    .reduce((message, secret) => message.split(secret).join("[redacted]"), raw)
    .slice(0, 500);
}

export function diagnoseModelTestError(message: string): ModelTestDiagnostic | undefined {
  if (/Google GenAI|Google Gemini API/i.test(message) && /PERMISSION_DENIED|dunning|403/i.test(message)) {
    return {
      code: "google_project_denied",
      message: {
        "zh-CN":
          "Google API key 已被读取，但 Google 项目拒绝了请求。请检查该项目是否启用 Gemini/Generative Language API、结算/权限是否正常，以及 API key 是否属于可用项目。",
        en:
          "Google API key was read, but the Google project rejected the request. Check that the Gemini/Generative Language API is enabled, billing/project permissions are healthy, and the API key belongs to that usable project.",
      },
    };
  }

  if (/Gemma Ollama/i.test(message) && /model .*not found|pull model|not found/i.test(message)) {
    return {
      code: "ollama_model_missing",
      message: {
        "zh-CN":
          "Ollama 服务可用，但找不到所选模型。请运行 `ollama pull gemma4`，或把模型名改成 `ollama list` 中已有的模型。",
        en:
          "Ollama responded, but the selected model was not found. Run `ollama pull gemma4`, or change the model name to one listed by `ollama list`.",
      },
    };
  }

  if (/Gemma Ollama/i.test(message) && /fetch failed|ECONNREFUSED|UND_ERR_SOCKET|other side closed|terminated|socket/i.test(message)) {
    return {
      code: "ollama_unavailable",
      message: {
        "zh-CN":
          "xMocha 无法从 Ollama 获得有效响应。请确认 Ollama 正在运行，`OLLAMA_BASE_URL` 指向正确地址，并且 `gemma4` 已安装。",
        en:
          "xMocha could not get a valid response from Ollama. Confirm Ollama is running, `OLLAMA_BASE_URL` points to the right host, and `gemma4` is installed.",
      },
    };
  }

  return undefined;
}

export async function POST(request: Request) {
  const limited = await rateLimitResponse(request, publicRateLimits.modelTest);
  if (limited) return limited;

  try {
    const body = (await request.json()) as { modelConfig?: unknown };
    const modelConfig = normalizeModelConfig(body.modelConfig);
    const startedAt = Date.now();

    return await withRuntimeModelConfig(modelConfig, async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), testTimeoutMs);

      try {
        const { client, providerLabel } = createJsonGenerationClient();
        const model = getActiveModelName();
        const raw = await client.generateJson(
          'Return exactly this strict JSON object with no Markdown: {"ok":true,"service":"xmocha-model-test"}',
          { signal: controller.signal },
        );
        const parsed = JSON.parse(raw) as { ok?: unknown };

        if (parsed.ok !== true) {
          throw new Error("Model responded, but did not return the expected JSON shape.");
        }

        return NextResponse.json({
          ok: true,
          provider: providerLabel,
          model,
          latencyMs: Date.now() - startedAt,
        });
      } catch (error) {
        const errorMessage = sanitizeError(error);
        return NextResponse.json({
          ok: false,
          provider: getActiveProviderLabel(),
          model: getActiveModelName(),
          error: errorMessage,
          diagnostic: diagnoseModelTestError(errorMessage),
          latencyMs: Date.now() - startedAt,
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    });
  } catch (error) {
    const errorMessage = sanitizeError(error);
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        diagnostic: diagnoseModelTestError(errorMessage),
      },
      { status: 400 },
    );
  }
}
