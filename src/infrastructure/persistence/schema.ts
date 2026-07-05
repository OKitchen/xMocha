import {
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type {
  SessionAnalyticsEvent,
  SessionState,
} from "../../domain/types";
import type { TurnRun, WorldPack } from "../../domain/world-types";

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    dilemma: text("dilemma").notNull(),
    status: text("status").notNull(),
    language: text("language").notNull(),
    turn: integer("turn").notNull(),
    maxTurns: integer("max_turns").notNull(),
    stateJson: jsonb("state_json").$type<SessionState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("sessions_status_idx").on(table.status),
    index("sessions_updated_at_idx").on(table.updatedAt),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    eventName: text("event_name").notNull(),
    turn: integer("turn").notNull(),
    metadata: jsonb("metadata").$type<SessionAnalyticsEvent["metadata"]>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_events_name_idx").on(table.eventName),
    index("analytics_events_session_idx").on(table.sessionId),
    index("analytics_events_occurred_at_idx").on(table.occurredAt),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    contact: text("contact").notNull(),
    intent: text("intent").notNull(),
    message: text("message"),
    sessionId: text("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("contacts_intent_idx").on(table.intent),
    index("contacts_created_at_idx").on(table.createdAt),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(),
    clientHash: text("client_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull(),
    requestCount: integer("request_count").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rate_limits_scope_idx").on(table.scope),
    index("rate_limits_updated_at_idx").on(table.updatedAt),
  ],
);

export const worldPacks = pgTable(
  "world_packs",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    visibility: text("visibility").notNull(),
    sourceType: text("source_type").notNull(),
    ownerTokenHash: text("owner_token_hash"),
    packJson: jsonb("pack_json").$type<WorldPack>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.version] }),
    index("world_packs_id_version_idx").on(table.id, table.version),
    index("world_packs_visibility_idx").on(table.visibility),
  ],
);

export const turnRuns = pgTable(
  "turn_runs",
  {
    traceId: text("trace_id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull(),
    attempt: integer("attempt").notNull(),
    status: text("status").notNull(),
    runJson: jsonb("run_json").$type<TurnRun>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("turn_runs_session_idx").on(table.sessionId),
    index("turn_runs_status_idx").on(table.status),
  ],
);
