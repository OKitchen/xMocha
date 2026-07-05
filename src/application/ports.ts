import type {
  BranchCommunity,
  SessionSummary,
  SocietySimulationInput,
  SessionState,
  TurnDraft,
  TurnGenerationInput,
  TurnSimulationResult,
  WorldContext,
} from "../domain/types";
import type { StoredWorldPack, TurnRun, WorldPack } from "../domain/world-types";

export interface WorldModelProvider {
  getContext(session: SessionState): Promise<WorldContext>;
}

export interface BranchGenerator {
  generate(input: TurnGenerationInput): Promise<TurnDraft>;
}

export interface SocietySimulator {
  simulate(input: SocietySimulationInput): Promise<BranchCommunity[]>;
}

export interface TurnSimulator {
  simulate(input: TurnGenerationInput): Promise<TurnSimulationResult>;
}

export interface SummaryGenerator {
  generate(session: SessionState): Promise<SessionSummary>;
}

export interface SessionRepository {
  save(session: SessionState): Promise<void>;
  load(sessionId: string): Promise<SessionState | null>;
  list(): Promise<SessionState[]>;
}

export interface WorldPackRepository {
  save(record: StoredWorldPack): Promise<void>;
  load(worldPackId: string, version?: number): Promise<StoredWorldPack | null>;
  listCurated(): Promise<WorldPack[]>;
}

export interface TurnRunRepository {
  saveMany(runs: TurnRun[]): Promise<void>;
  listForSession(sessionId: string): Promise<TurnRun[]>;
}

export type ContactSubmission = {
  id: string;
  contact: string;
  intent: "beta" | "partner" | "invest" | "resource";
  message?: string;
  sessionId?: string;
  createdAt: string;
};

export interface ContactRepository {
  save(submission: ContactSubmission): Promise<void>;
}
