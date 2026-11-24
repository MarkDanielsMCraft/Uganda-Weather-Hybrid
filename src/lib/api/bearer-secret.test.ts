import { describe, expect, it } from "vitest";
import { bearerTokenMatches } from "@/lib/api/bearer-secret";

describe("bearerTokenMatches", () => {
  it("accepts the exact secret", () => {
    expect(bearerTokenMatches("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects a different secret, a prefix, and an empty token", () => {
    expect(bearerTokenMatches("s3cret-valuf", "s3cret-value")).toBe(false);
    expect(bearerTokenMatches("s3cret", "s3cret-value")).toBe(false);
    expect(bearerTokenMatches("", "s3cret-value")).toBe(false);
  });
});
