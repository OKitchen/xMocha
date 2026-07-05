import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createWorldAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashWorldAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyWorldAccessToken(
  token: string | undefined,
  expectedHash: string | undefined,
): boolean {
  if (!expectedHash) return true;
  if (!token) return false;
  const actual = Buffer.from(hashWorldAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

