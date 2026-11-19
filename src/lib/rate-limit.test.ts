import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIpFromRequest, rateLimitHeaders } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the limit and counts down `remaining`", () => {
    const key = `test-${Math.random()}`;
    const first = checkRateLimit(key, 3, 60_000);
    expect(first).toMatchObject({ allowed: true, remaining: 2 });
    const second = checkRateLimit(key, 3, 60_000);
    expect(second).toMatchObject({ allowed: true, remaining: 1 });
    const third = checkRateLimit(key, 3, 60_000);
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("blocks once the limit is exceeded within the window", () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const blocked = checkRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets the count once the window has elapsed", () => {
    const key = `test-${Math.random()}`;
    // A window of 0ms means the bucket is already expired on the next call.
    const first = checkRateLimit(key, 1, 0);
    expect(first.allowed).toBe(true);
    const afterExpiry = checkRateLimit(key, 1, 0);
    expect(afterExpiry.allowed).toBe(true);
  });

  it("tracks separate buckets per key", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);
    const blockedA = checkRateLimit(keyA, 1, 60_000);
    const allowedB = checkRateLimit(keyB, 1, 60_000);
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});

describe("clientIpFromRequest", () => {
  it("prefers the first address in a comma-separated x-forwarded-for", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(clientIpFromRequest(request)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(clientIpFromRequest(request)).toBe("198.51.100.7");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const request = new Request("http://localhost/");
    expect(clientIpFromRequest(request)).toBe("unknown");
  });
});

describe("rateLimitHeaders", () => {
  it("formats the result as string header values", () => {
    const headers = rateLimitHeaders({ allowed: true, limit: 60, remaining: 59, resetAt: 1_700_000_000_000 });
    expect(headers).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "59",
      "X-RateLimit-Reset": "1700000000",
    });
  });
});
