import type {
  BranchGenerator,
  ContactRepository,
  SessionRepository,
  SocietySimulator,
  SummaryGenerator,
  TurnSimulator,
  TurnRunRepository,
  WorldPackRepository,
} from "../../application/ports";
import { TurnOrchestrator } from "../../application/turn-orchestrator";
import { MockBranchGenerator } from "../branch/mock-branch-generator";
import { StructuredBranchGenerator } from "../branch/structured-branch-generator";
import {
  createJsonGenerationClient,
  getActiveModelName,
  getActiveProviderLabel,
} from "../llm/provider-factory";
import {
  getConfiguredProvider,
  getDefaultTurnSimulatorForProvider,
} from "../llm/model-catalog";
import { getRuntimeModelConfig } from "../llm/runtime-model-config";
import { FileSessionRepository } from "../persistence/file-session-repository";
import {
  FileContactRepository,
  PostgresContactRepository,
} from "../persistence/contact-repositories";
import { PostgresSessionRepository } from "../persistence/postgres-session-repository";
import {
  FileWorldPackRepository,
  PostgresWorldPackRepository,
} from "../persistence/world-pack-repositories";
import {
  FileTurnRunRepository,
  PostgresTurnRunRepository,
} from "../persistence/turn-run-repositories";
import { StructuredSocietySimulator } from "../society/structured-society-simulator";
import { TemplateSocietySimulator } from "../society/template-society-simulator";
import { MockSummaryGenerator } from "../summary/mock-summary-generator";
import { StructuredSummaryGenerator } from "../summary/structured-summary-generator";
import { StructuredTurnSimulator } from "../turn/structured-turn-simulator";
import { NarrativeWorldModelProvider } from "../world-model/narrative-world-model-provider";

export function createWorldModelProvider(): NarrativeWorldModelProvider {
  return new NarrativeWorldModelProvider();
}

export function createBranchGenerator(): BranchGenerator {
  if (process.env.XMOCHA_BRANCH_GENERATOR === "mock") {
    return new MockBranchGenerator();
  }

  const { client, providerLabel } = createJsonGenerationClient();
  return new StructuredBranchGenerator(client, providerLabel);
}

export function createSummaryGenerator(): SummaryGenerator {
  if (process.env.XMOCHA_BRANCH_GENERATOR === "mock") {
    return new MockSummaryGenerator();
  }

  const { client, providerLabel } = createJsonGenerationClient();
  return new StructuredSummaryGenerator(client, providerLabel);
}

export function createSocietySimulator(): SocietySimulator {
  const runtimeModelConfig = getRuntimeModelConfig();
  const provider =
    runtimeModelConfig?.provider ?? getConfiguredProvider();
  const strategy =
    process.env.XMOCHA_SOCIETY_SIMULATOR ??
    (provider === "google" || provider === "huggingface" || provider === "openai"
      ? "template"
      : "structured");

  if (process.env.XMOCHA_BRANCH_GENERATOR === "mock" || strategy === "template") {
    return new TemplateSocietySimulator();
  }

  if (strategy === "structured") {
    const { client, providerLabel } = createJsonGenerationClient();
    return new StructuredSocietySimulator(client, providerLabel);
  }

  throw new Error(
    `Unsupported XMOCHA_SOCIETY_SIMULATOR "${strategy}". Use "structured" or "template".`,
  );
}

export function createTurnSimulator(): TurnSimulator | undefined {
  if (process.env.XMOCHA_BRANCH_GENERATOR === "mock") {
    return undefined;
  }

  const runtimeModelConfig = getRuntimeModelConfig();
  const provider =
    runtimeModelConfig?.provider ?? getConfiguredProvider();
  const strategy =
    runtimeModelConfig?.turnSimulator ??
    process.env.XMOCHA_TURN_SIMULATOR ??
    getDefaultTurnSimulatorForProvider(provider) ??
    "legacy";

  if (strategy === "legacy") {
    return undefined;
  }

  if (strategy === "unified") {
    const { client, providerLabel } = createJsonGenerationClient();
    return new StructuredTurnSimulator(client, providerLabel);
  }

  throw new Error(
    `Unsupported XMOCHA_TURN_SIMULATOR "${strategy}". Use "unified" or "legacy".`,
  );
}

export function createTurnOrchestrator(): TurnOrchestrator {
  return new TurnOrchestrator(
    createWorldModelProvider(),
    createBranchGenerator(),
    createSocietySimulator(),
    getActiveProviderLabel(),
    getActiveModelName(),
    createTurnSimulator(),
  );
}

export function createFallbackTurnOrchestrator(): TurnOrchestrator {
  return new TurnOrchestrator(
    createWorldModelProvider(),
    new MockBranchGenerator(),
    new TemplateSocietySimulator(),
    "deterministic fallback",
    "none",
  );
}

export function createFallbackSummaryGenerator(): SummaryGenerator {
  return new MockSummaryGenerator();
}

function usePostgresPersistence(): boolean {
  const configuredStorage = process.env.XMOCHA_SESSION_STORAGE;

  if (configuredStorage === "file") {
    return false;
  }

  if (configuredStorage === "postgres") {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "XMOCHA_SESSION_STORAGE=postgres requires DATABASE_URL.",
      );
    }

    return true;
  }

  return Boolean(process.env.DATABASE_URL);
}

export function createSessionRepository(): SessionRepository {
  return usePostgresPersistence()
    ? new PostgresSessionRepository()
    : new FileSessionRepository();
}

export function createContactRepository(): ContactRepository {
  return usePostgresPersistence()
    ? new PostgresContactRepository()
    : new FileContactRepository();
}

export function createWorldPackRepository(): WorldPackRepository {
  return usePostgresPersistence()
    ? new PostgresWorldPackRepository()
    : new FileWorldPackRepository();
}

export function createTurnRunRepository(): TurnRunRepository {
  return usePostgresPersistence()
    ? new PostgresTurnRunRepository()
    : new FileTurnRunRepository();
}
