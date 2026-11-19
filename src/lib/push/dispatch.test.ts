import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
const { sendApnsNotificationsMock } = vi.hoisted(() => ({
  sendApnsNotificationsMock: vi.fn(),
}));

vi.mock("./apns", () => ({
  sendApnsNotifications: sendApnsNotificationsMock,
}));

import {
  dispatchStormAlert,
  getFcmAccessToken,
  resetCachedFcmToken,
} from "./dispatch";
import * as store from "./store";

describe("dispatchStormAlert and FCM token minting", () => {
  const originalEnv = process.env;
  let testPrivateKey: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FIREBASE_ACCESS_TOKEN;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVER_KEY;
    delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID;
    delete process.env.APNS_PRIVATE_KEY;
    delete process.env.APNS_TOPIC;
    resetCachedFcmToken();
    sendApnsNotificationsMock.mockReset();

    // Generate a valid RSA key pair for testing token signing
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    testPrivateKey = privateKey;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("defaults to dryRun when no credentials exist", async () => {
    vi.spyOn(store, "listPushTokensForDistrict").mockResolvedValue([
      {
        token: "test-token-1",
        record: {
          tokenHash: "hash-1",
          platform: "android",
          districtSlug: "kampala",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
    ]);

    const result = await dispatchStormAlert({
      districtSlug: "kampala",
      title: "Severe Weather Warning",
      body: "High winds expected.",
    });

    expect(result.dryRun).toBe(true);
    expect(result.provider).toBe("log");
    expect(result.targeted).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("returns null when service account credentials are incomplete", async () => {
    process.env.FIREBASE_CLIENT_EMAIL = "service-account@example.iam.gserviceaccount.com";
    // Missing FIREBASE_PRIVATE_KEY
    const token = await getFcmAccessToken();
    expect(token).toBeNull();
  });

  it("mints an OAuth2 token using RSA service account credentials and caches it", async () => {
    process.env.FIREBASE_CLIENT_EMAIL = "test-service@example.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = testPrivateKey;

    let oauthRequestCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        oauthRequestCount += 1;
        return new Response(
          JSON.stringify({
            access_token: "minted-bearer-token-12345",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const token1 = await getFcmAccessToken();
    expect(token1).toBe("minted-bearer-token-12345");
    expect(oauthRequestCount).toBe(1);

    // Second call should use cache, avoiding duplicate network request
    const token2 = await getFcmAccessToken();
    expect(token2).toBe("minted-bearer-token-12345");
    expect(oauthRequestCount).toBe(1);

    // Resetting cache causes a re-minting
    resetCachedFcmToken();
    const token3 = await getFcmAccessToken();
    expect(token3).toBe("minted-bearer-token-12345");
    expect(oauthRequestCount).toBe(2);
  });

  it("coalesces concurrent token requests into a single in-flight OAuth2 fetch", async () => {
    process.env.FIREBASE_CLIENT_EMAIL = "test-service@example.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = testPrivateKey;

    let oauthCallCount = 0;
    let resolveOauth: ((res: Response) => void) | null = null;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        oauthCallCount += 1;
        return new Promise((resolve) => {
          resolveOauth = resolve;
        });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    // Launch 4 concurrent requests before the first finishes
    const p1 = getFcmAccessToken();
    const p2 = getFcmAccessToken();
    const p3 = getFcmAccessToken();
    const p4 = getFcmAccessToken();

    // Verify only 1 network call is in flight
    expect(oauthCallCount).toBe(1);

    resolveOauth!(
      new Response(
        JSON.stringify({
          access_token: "coalesced-token-999",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const [t1, t2, t3, t4] = await Promise.all([p1, p2, p3, p4]);
    expect(t1).toBe("coalesced-token-999");
    expect(t2).toBe("coalesced-token-999");
    expect(t3).toBe("coalesced-token-999");
    expect(t4).toBe("coalesced-token-999");
    expect(oauthCallCount).toBe(1);
  });

  it("dispatches FCM v1 notifications using minted token", async () => {
    process.env.FIREBASE_PROJECT_ID = "uganda-weather-prod";
    process.env.FIREBASE_CLIENT_EMAIL = "test-service@example.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = testPrivateKey;

    vi.spyOn(store, "listPushTokensForDistrict").mockResolvedValue([
      {
        token: "device-fcm-token-1",
        record: {
          tokenHash: "hash-device-1",
          platform: "android",
          districtSlug: "jinja",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
    ]);

    const sentRequests: { url: string; auth: string | null; body: string | null }[] = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(
          JSON.stringify({
            access_token: "mock-oauth-access-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("fcm.googleapis.com/v1/projects/uganda-weather-prod/messages:send")) {
        const headers = init?.headers as Record<string, string>;
        sentRequests.push({
          url,
          auth: headers?.Authorization ?? null,
          body: (init?.body as string) ?? null,
        });
        return new Response(JSON.stringify({ name: "projects/.../messages/msg-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchStormAlert(
      {
        districtSlug: "jinja",
        title: "Flood Alert",
        body: "Rising waters near Jinja piers.",
      },
      { dryRun: false },
    );

    expect(result.dryRun).toBe(false);
    expect(result.provider).toBe("fcm");
    expect(result.targeted).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(sentRequests.length).toBe(1);
    expect(sentRequests[0]?.auth).toBe("Bearer mock-oauth-access-token");
    const parsedBody = JSON.parse(sentRequests[0]?.body ?? "{}");
    expect(parsedBody.message.android.notification).toEqual({
      channel_id: "weather_alerts",
      icon: "ic_stat_weather_alert",
      color: "#E8A838",
    });
  });

  it("delivers Luganda localized notifications to Luganda-registered devices and English to English devices", async () => {
    process.env.FIREBASE_PROJECT_ID = "uganda-weather-prod";
    process.env.FIREBASE_CLIENT_EMAIL = "test-service@example.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = testPrivateKey;

    vi.spyOn(store, "listPushTokensForDistrict").mockResolvedValue([
      {
        token: "device-en-token",
        record: {
          tokenHash: "hash-en",
          platform: "android",
          districtSlug: "kampala",
          language: "en",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
      {
        token: "device-lg-token",
        record: {
          tokenHash: "hash-lg",
          platform: "android",
          districtSlug: "kampala",
          language: "lg",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
    ]);

    const sentPayloads: Array<{ token: string; title: string; body: string }> = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(
          JSON.stringify({ access_token: "mock-oauth-access-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("fcm.googleapis.com/v1/projects/uganda-weather-prod/messages:send")) {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as {
          message: { token: string; notification: { title: string; body: string } };
        };
        sentPayloads.push({
          token: parsed.message.token,
          title: parsed.message.notification.title,
          body: parsed.message.notification.body,
        });
        return new Response(JSON.stringify({ name: "projects/.../messages/msg-lg" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchStormAlert(
      {
        districtSlug: "kampala",
        title: "Severe Storm Warning",
        body: "Heavy rain expected across Kampala.",
        localized: {
          lg: {
            title: "Okulabula ku kibuyaga ow'amaanyi",
            body: "Enkuba nnyingi esuubirwa mu Kampala.",
          },
        },
      },
      { dryRun: false },
    );

    expect(result.targeted).toBe(2);
    expect(result.sent).toBe(2);
    expect(sentPayloads).toEqual(
      expect.arrayContaining([
        {
          token: "device-en-token",
          title: "Severe Storm Warning",
          body: "Heavy rain expected across Kampala.",
        },
        {
          token: "device-lg-token",
          title: "Okulabula ku kibuyaga ow'amaanyi",
          body: "Enkuba nnyingi esuubirwa mu Kampala.",
        },
      ]),
    );
  });
});
