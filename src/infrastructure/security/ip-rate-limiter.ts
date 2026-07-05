import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDatabase } from "../persistence/database";
import { rateLimits } from "../persistence/schema";

export type IpRateLimitRule = {
  scope: string;
  limit: number;
  windowMs: number;
};

export type IpRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type MemoryWindow = {
  count: number;
  windowStartedAt: number;
};

const memoryWindows = new Map<string, MemoryWindow>();

function firstForwardedAddress(value: string | null): string | undefined {
  const address = value?.split(",", 1)[0]?.trim();
  return address && address.length <= 128 ? address : undefined;
}

export function getClientIp(request: Request): string {
  const providerAddress =
    firstForwardedAddress(request.headers.get("x-nf-client-connection-ip")) ??
    firstForwardedAddress(request.headers.get("cf-connecting-ip")) ??
    firstForwardedAddress(request.headers.get("x-vercel-forwarded-for"));

  if (providerAddress) {
    return providerAddress;
  }

  return (
    firstForwardedAddress(request.headers.get("x-forwarded-for")) ??
    firstForwardedAddress(request.headers.get("x-real-ip")) ??
    "unknown"
  );
}

function hashClientIp(ip: string): string {
  const salt = process.env.XMOCHA_RATE_LIMIT_SALT ?? "xmocha-rate-limit-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function currentWindowStartedAt(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

function toResult(
  count: number,
  windowStartedAt: number,
  now: number,
  rule: IpRateLimitRule,
): IpRateLimitResult {
  const allowed = count <= rule.limit;
  const retryAfterMs = Math.max(windowStartedAt + rule.windowMs - now, 1000);

  return {
    allowed,
    limit: rule.limit,
    remaining: Math.max(rule.limit - count, 0),
    retryAfterSeconds: allowed ? 0 : Math.ceil(retryAfterMs / 1000),
  };
}

function checkMemoryRateLimit(
  clientHash: string,
  rule: IpRateLimitRule,
  now: number,
): IpRateLimitResult {
  const key = `${rule.scope}:${clientHash}`;
  const windowStartedAt = currentWindowStartedAt(now, rule.windowMs);
  const previous = memoryWindows.get(key);
  const count =
    previous?.windowStartedAt === windowStartedAt ? previous.count + 1 : 1;

  memoryWindows.set(key, { count, windowStartedAt });
  return toResult(count, windowStartedAt, now, rule);
}

async function checkPostgresRateLimit(
  clientHash: string,
  rule: IpRateLimitRule,
  now: number,
): Promise<IpRateLimitResult> {
  const database = getDatabase();
  const key = `${rule.scope}:${clientHash}`;
  const windowStartedAt = new Date(
    currentWindowStartedAt(now, rule.windowMs),
  );
  const updatedAt = new Date(now);

  const rows = await database
    .insert(rateLimits)
    .values({
      key,
      scope: rule.scope,
      clientHash,
      windowStartedAt,
      requestCount: 1,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        requestCount: sql<number>`case
          when ${rateLimits.windowStartedAt} < ${windowStartedAt}
            then 1
          else ${rateLimits.requestCount} + 1
        end`,
        windowStartedAt: sql<Date>`case
          when ${rateLimits.windowStartedAt} < ${windowStartedAt}
            then ${windowStartedAt}
          else ${rateLimits.windowStartedAt}
        end`,
        updatedAt,
      },
    })
    .returning({
      requestCount: rateLimits.requestCount,
      windowStartedAt: rateLimits.windowStartedAt,
    });

  const row = rows[0];
  if (!row) {
    throw new Error("Rate-limit counter did not return a row.");
  }

  return toResult(
    row.requestCount,
    row.windowStartedAt.getTime(),
    now,
    rule,
  );
}

export async function checkIpRateLimit(
  request: Request,
  rule: IpRateLimitRule,
): Promise<IpRateLimitResult> {
  const now = Date.now();
  const clientHash = hashClientIp(getClientIp(request));
  const usePostgres =
    process.env.XMOCHA_SESSION_STORAGE !== "file" &&
    Boolean(process.env.DATABASE_URL);

  if (!usePostgres) {
    return checkMemoryRateLimit(clientHash, rule, now);
  }

  try {
    return await checkPostgresRateLimit(clientHash, rule, now);
  } catch (error) {
    console.error("rate_limit_storage_failed", {
      scope: rule.scope,
      message: error instanceof Error ? error.message : String(error),
    });
    return checkMemoryRateLimit(clientHash, rule, now);
  }
}
