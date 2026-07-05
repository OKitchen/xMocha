import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { SessionState } from "./types";

export class SessionAccessError extends Error {
  constructor(message = "This session requires its owner token.") {
    super(message);
    this.name = "SessionAccessError";
  }
}

export function createSessionAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSessionAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifySessionAccessToken(
  token: string | undefined,
  expectedHash: string | undefined,
): boolean {
  if (!expectedHash) return true;
  if (!token) return false;
  const actual = Buffer.from(hashSessionAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hasSessionOwnerAccess(
  session: SessionState,
  token: string | undefined,
): boolean {
  if (!session.sessionAccessTokenHash && !session.worldAccessTokenHash) {
    return true;
  }

  return Boolean(
    (session.sessionAccessTokenHash &&
      verifySessionAccessToken(token, session.sessionAccessTokenHash)) ||
      (session.worldAccessTokenHash &&
        verifySessionAccessToken(token, session.worldAccessTokenHash)),
  );
}

export function assertSessionOwnerAccess(
  session: SessionState,
  token: string | undefined,
): void {
  if (!hasSessionOwnerAccess(session, token)) {
    throw new SessionAccessError();
  }
}

export function assertSessionReadAccess(
  session: SessionState,
  token: string | undefined,
): void {
  if (hasSessionOwnerAccess(session, token)) return;
  if (session.status === "complete" && !session.privateWorld) return;
  throw new SessionAccessError();
}

export function isSessionAccessError(error: unknown): boolean {
  return error instanceof SessionAccessError ||
    (error instanceof Error && error.message.includes("session requires its owner token"));
}
