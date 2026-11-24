import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapInBatches } from "@/lib/push/batches";
import { dispatchStormAlert, resetCachedFcmToken } from "@/lib/push/dispatch";
import * as store from "@/lib/push/store";

function androidEntry(token: string) {
  return {
    token,
    record: {
      tokenHash: `hash-${token}`,
      platform: "android" as const,
      districtSlug: "jinja",
      registeredAt: "2026-11-01",
      updatedAt: "2026-11-01",
    },
  };
}

describe("push alerts under load", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetCachedFcmToken();
    store.resetPushStoreForTests();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("never runs more than one group of sends at the same time", async () => {
    let running = 0;
    let most = 0;
    await mapInBatches(Array.from({ length: 130 }, (_, i) => i), 50, async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });
    expect(most).toBe(50);
  });

  it("forgets phones that Android says no longer exist, and keeps the rest", async () => {
    process.env.FIREBASE_PROJECT_ID = "uganda-weather-test";
    process.env.FIREBASE_ACCESS_TOKEN = "test-access-token";
    vi.spyOn(store, "listPushTokensForDistrict").mockResolvedValue([
      androidEntry("live-phone-token-0001"),
      androidEntry("gone-phone-token-0002"),
    ]);
    const removed = vi.spyOn(store, "removePushToken").mockResolvedValue({ removed: true, persisted: false });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = String(init?.body ?? "");
        return new Response("{}", { status: body.includes("gone-phone") ? 404 : 200 });
      }),
    );

    const result = await dispatchStormAlert(
      { districtSlug: "jinja", title: "Storm watch", body: "Strong wind on the lake." },
      { dryRun: false },
    );

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith("gone-phone-token-0002");
  });

  it("stops taking new tokens once the store is full, but still lets a known phone update", async () => {
    for (let i = 0; i < store.MAX_STORED_PUSH_TOKENS; i += 1) {
      await store.savePushToken({
        token: `filler-token-${i.toString().padStart(8, "0")}`,
        platform: "android",
        districtSlug: "kampala",
        language: "en",
      });
    }
    expect(await store.isPushStoreFull("brand-new-token-000001")).toBe(true);
    expect(await store.isPushStoreFull("filler-token-00000007")).toBe(false);
  }, 60_000);
});

describe("push sign up route", () => {
  beforeEach(async () => {
    const { resetRateLimitsForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    store.resetPushStoreForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function signUp(token: string, ip = "198.51.100.23") {
    return new Request("https://hybrid.uganda-weather.com/api/v1/push/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ token, platform: "android", districtSlug: "kampala" }),
    });
  }

  it("refuses the 11th sign up in an hour from one address", async () => {
    const { POST } = await import("@/app/api/v1/push/register/route");
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await POST(signUp(`junk-token-from-script-${i.toString().padStart(4, "0")}`))).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("refuses tokens with characters no real phone token has", async () => {
    const { POST } = await import("@/app/api/v1/push/register/route");
    for (const token of ["<script>alert(1)</script>xx", "token with spaces in it 123", "token/with/slashes/0000001"]) {
      expect((await POST(signUp(token))).status).toBe(400);
    }
  });
});

describe("push dispatch route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses a wrong secret before looking at the body, even a broken one", async () => {
    vi.stubEnv("PUSH_DISPATCH_SECRET", "real-dispatch-secret-value-0001");
    const { POST } = await import("@/app/api/v1/push/dispatch/route");
    const response = await POST(
      new Request("https://hybrid.uganda-weather.com/api/v1/push/dispatch", {
        method: "POST",
        headers: { authorization: "Bearer wrong", "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(401);
  });
});
