import { describe, expect, it } from "vitest";

import {
  assertSessionReadAccess,
  createSessionAccessToken,
  hashSessionAccessToken,
  hasSessionOwnerAccess,
  verifySessionAccessToken,
} from "./session-access";
import type { SessionState } from "./types";

const baseSession = {
  sessionId: "session-1",
  dilemma: "Test decision",
  status: "active",
  privateWorld: false,
} as SessionState;

describe("session access tokens", () => {
  it("creates verifiable bearer tokens", () => {
    const token = createSessionAccessToken();
    const hash = hashSessionAccessToken(token);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toHaveLength(64);
    expect(verifySessionAccessToken(token, hash)).toBe(true);
    expect(verifySessionAccessToken(`${token}x`, hash)).toBe(false);
  });

  it("requires owner access when a session hash exists", () => {
    const token = createSessionAccessToken();
    const session = {
      ...baseSession,
      sessionAccessTokenHash: hashSessionAccessToken(token),
    };

    expect(hasSessionOwnerAccess(session, token)).toBe(true);
    expect(hasSessionOwnerAccess(session, undefined)).toBe(false);
  });

  it("allows public read for completed non-private sessions only", () => {
    const session: SessionState = {
      ...baseSession,
      status: "complete",
      sessionAccessTokenHash: hashSessionAccessToken("owner-token"),
    };

    expect(() => assertSessionReadAccess(session, undefined)).not.toThrow();
    expect(() =>
      assertSessionReadAccess({ ...session, privateWorld: true }, undefined),
    ).toThrow(/owner token/);
  });
});
