/**
 * Shared utilities for LLM client implementations.
 */

export function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export function parseNumberEnv(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function describeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause as
    | {
        code?: string;
        message?: string;
        name?: string;
      }
    | undefined;
  const causeDetails = cause
    ? ` cause=${cause.name ?? "Error"} code=${cause.code ?? "unknown"} message=${cause.message ?? "unknown"}`
    : "";
  const networkHint =
    cause?.code === "ENOTFOUND"
      ? " DNS lookup failed. Check network/DNS access to Hugging Face."
      : cause?.code === "ECONNRESET"
        ? " The connection was reset before a response was received. This is usually a network, proxy, firewall, or remote routing issue."
        : "";

  return `${error.name}: ${error.message}.${causeDetails}${networkHint}`;
}

export type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};
