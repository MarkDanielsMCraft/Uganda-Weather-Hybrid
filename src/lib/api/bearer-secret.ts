import { createHash, timingSafeEqual } from "node:crypto";

/** Compares a bearer token with the expected secret in constant time. Both
    sides are hashed first so the comparison never leaks the secret length or
    how many leading characters matched. */
export function bearerTokenMatches(token: string, secret: string): boolean {
  const given = createHash("sha256").update(token).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}
