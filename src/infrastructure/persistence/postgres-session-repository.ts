import { desc, eq, sql } from "drizzle-orm";

import type { SessionRepository } from "../../application/ports";
import type { SessionState } from "../../domain/types";
import { getDatabase, type XMochaDatabase } from "./database";
import { analyticsEvents, sessions } from "./schema";

function analyticsEventId(
  sessionId: string,
  timestamp: string,
  name: string,
  index: number,
): string {
  return `${sessionId}:${timestamp}:${name}:${index}`;
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly database: XMochaDatabase = getDatabase()) {}

  async save(session: SessionState): Promise<void> {
    const now = new Date();

    await this.database
      .insert(sessions)
      .values({
        id: session.sessionId,
        dilemma: session.dilemma,
        status: session.status,
        language: session.language,
        turn: session.turn,
        maxTurns: session.maxTurns,
        stateJson: session,
        updatedAt: now,
        completedAt: session.status === "complete" ? now : null,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          dilemma: session.dilemma,
          status: session.status,
          language: session.language,
          turn: session.turn,
          maxTurns: session.maxTurns,
          stateJson: session,
          updatedAt: now,
          completedAt:
            session.status === "complete"
              ? sql`coalesce(${sessions.completedAt}, ${now})`
              : null,
        },
      });

    if (session.analyticsEvents.length === 0) {
      return;
    }

    try {
      await this.database
        .insert(analyticsEvents)
        .values(
          session.analyticsEvents.map((event, index) => ({
            id: analyticsEventId(
              session.sessionId,
              event.timestamp,
              event.name,
              index,
            ),
            sessionId: session.sessionId,
            eventName: event.name,
            turn: event.turn,
            metadata: event.metadata,
            occurredAt: new Date(event.timestamp),
          })),
        )
        .onConflictDoNothing({ target: analyticsEvents.id });
    } catch (error) {
      console.error("analytics_events_persist_failed", {
        sessionId: session.sessionId,
        eventCount: session.analyticsEvents.length,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async load(sessionId: string): Promise<SessionState | null> {
    const rows = await this.database
      .select({ stateJson: sessions.stateJson })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return rows[0]?.stateJson ?? null;
  }

  async list(): Promise<SessionState[]> {
    const rows = await this.database
      .select({ stateJson: sessions.stateJson })
      .from(sessions)
      .orderBy(desc(sessions.updatedAt));

    return rows.map((row) => row.stateJson);
  }
}
