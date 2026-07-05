import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres persistence.");
  }

  return drizzle(connectionString, { schema });
}

export type XMochaDatabase = ReturnType<typeof getDatabase>;
