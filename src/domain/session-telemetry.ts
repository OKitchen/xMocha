import type {
  GenerationFailureStage,
  SessionAnalyticsEventName,
  SessionState,
} from "./types";

type TelemetryMetadata = Record<string, string | number | boolean | undefined>;

function cleanMetadata(
  metadata: TelemetryMetadata | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function appendAnalyticsEvent(
  session: SessionState,
  name: SessionAnalyticsEventName,
  metadata?: TelemetryMetadata,
): SessionState {
  return {
    ...session,
    analyticsEvents: [
      ...(session.analyticsEvents ?? []),
      {
        timestamp: new Date().toISOString(),
        name,
        turn: session.turn,
        metadata: cleanMetadata(metadata),
      },
    ],
  };
}

export function appendGenerationFailure(
  session: SessionState,
  params: {
    stage: GenerationFailureStage;
    error: unknown;
    recoverable: boolean;
    fallbackUsed: boolean;
    selectedBranchTitle?: string;
  },
): SessionState {
  const message =
    params.error instanceof Error ? params.error.message : String(params.error);

  logGenerationFailure(session, params.stage, message, params.fallbackUsed);

  const withFailure: SessionState = {
    ...session,
    generationFailures: [
      ...(session.generationFailures ?? []),
      {
        timestamp: new Date().toISOString(),
        stage: params.stage,
        turn: session.turn,
        message,
        recoverable: params.recoverable,
        fallbackUsed: params.fallbackUsed,
        selectedBranchTitle: params.selectedBranchTitle,
      },
    ],
  };

  return appendAnalyticsEvent(withFailure, "generation_failed", {
    stage: params.stage,
    recoverable: params.recoverable,
    fallbackUsed: params.fallbackUsed,
    selectedBranchTitle: params.selectedBranchTitle,
  });
}

function logGenerationFailure(
  session: SessionState,
  stage: GenerationFailureStage,
  message: string,
  fallbackUsed: boolean,
) {
  console.error(
    JSON.stringify({
      event: "generation_failed",
      sessionId: session.sessionId,
      stage,
      turn: session.turn,
      fallbackUsed,
      message,
    }),
  );
}
