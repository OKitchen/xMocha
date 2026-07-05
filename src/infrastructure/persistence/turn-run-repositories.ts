import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { asc, eq } from "drizzle-orm";

import type { TurnRunRepository } from "../../application/ports";
import type { TurnRun } from "../../domain/world-types";
import { getDatabase, type XMochaDatabase } from "./database";
import { turnRuns } from "./schema";

export class FileTurnRunRepository implements TurnRunRepository {
  constructor(
    private readonly baseDir = path.join(process.cwd(), ".xmocha-data", "turn-runs"),
  ) {}

  async saveMany(runs: TurnRun[]): Promise<void> {
    if (runs.length === 0) return;
    await mkdir(this.baseDir, { recursive: true });
    for (const run of runs) {
      await writeFile(
        path.join(this.baseDir, `${run.traceId}.json`),
        `${JSON.stringify(run, null, 2)}\n`,
        "utf8",
      );
    }
  }

  async listForSession(sessionId: string): Promise<TurnRun[]> {
    try {
      const files = (await readdir(this.baseDir)).filter((file) => file.endsWith(".json"));
      const runs = await Promise.all(
        files.map(async (file) =>
          JSON.parse(await readFile(path.join(this.baseDir, file), "utf8")) as TurnRun,
        ),
      );
      return runs
        .filter((run) => run.sessionId === sessionId)
        .sort((left, right) => left.turn - right.turn || left.attempt - right.attempt);
    } catch {
      return [];
    }
  }
}

export class PostgresTurnRunRepository implements TurnRunRepository {
  constructor(private readonly database: XMochaDatabase = getDatabase()) {}

  async saveMany(runs: TurnRun[]): Promise<void> {
    if (runs.length === 0) return;
    for (const run of runs) {
      await this.database
        .insert(turnRuns)
        .values({
          traceId: run.traceId,
          sessionId: run.sessionId,
          turn: run.turn,
          attempt: run.attempt,
          status: run.status,
          runJson: run,
          createdAt: new Date(run.startedAt),
        })
        .onConflictDoUpdate({
          target: turnRuns.traceId,
          set: {
            status: run.status,
            runJson: run,
          },
        });
    }
  }

  async listForSession(sessionId: string): Promise<TurnRun[]> {
    const rows = await this.database
      .select({ runJson: turnRuns.runJson })
      .from(turnRuns)
      .where(eq(turnRuns.sessionId, sessionId))
      .orderBy(asc(turnRuns.turn), asc(turnRuns.attempt));
    return rows.map((row) => row.runJson);
  }
}
