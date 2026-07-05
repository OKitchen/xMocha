import { describe, it, expect } from "vitest";

import {
  createWorldAccessToken,
  hashWorldAccessToken,
  verifyWorldAccessToken,
} from "./world-access";

describe("createWorldAccessToken", () => {
  it("returns a non-empty base64url string", () => {
    const token = createWorldAccessToken();
    expect(token.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("returns unique tokens on each call", () => {
    const a = createWorldAccessToken();
    const b = createWorldAccessToken();
    expect(a).not.toBe(b);
  });
});

describe("hashWorldAccessToken", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashWorldAccessToken("test-token");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    const a = hashWorldAccessToken("same-token");
    const b = hashWorldAccessToken("same-token");
    expect(a).toBe(b);
  });

  it("produces different hashes for different tokens", () => {
    const a = hashWorldAccessToken("token-a");
    const b = hashWorldAccessToken("token-b");
    expect(a).not.toBe(b);
  });
});

describe("verifyWorldAccessToken", () => {
  it("returns true when no expectedHash (public access)", () => {
    expect(verifyWorldAccessToken("any-token", undefined)).toBe(true);
    expect(verifyWorldAccessToken(undefined, undefined)).toBe(true);
  });

  it("returns false when token is missing but hash is expected", () => {
    const hash = hashWorldAccessToken("real-token");
    expect(verifyWorldAccessToken(undefined, hash)).toBe(false);
  });

  it("returns true for a valid token+hash pair", () => {
    const token = createWorldAccessToken();
    const hash = hashWorldAccessToken(token);
    expect(verifyWorldAccessToken(token, hash)).toBe(true);
  });

  it("returns false for an invalid token", () => {
    const token = createWorldAccessToken();
    const hash = hashWorldAccessToken(token);
    expect(verifyWorldAccessToken("wrong-token", hash)).toBe(false);
  });

  it("is timing-safe (uses timingSafeEqual internally)", () => {
    const token = createWorldAccessToken();
    const hash = hashWorldAccessToken(token);
    expect(verifyWorldAccessToken(token, hash)).toBe(true);
    expect(verifyWorldAccessToken(token + "x", hash)).toBe(false);
  });
});
