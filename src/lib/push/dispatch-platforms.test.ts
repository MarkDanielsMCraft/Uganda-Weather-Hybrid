import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendApnsNotificationsMock } = vi.hoisted(() => ({
  sendApnsNotificationsMock: vi.fn(),
}));

vi.mock("./apns", () => ({
  sendApnsNotifications: sendApnsNotificationsMock,
}));

import { dispatchStormAlert } from "./dispatch";
import * as store from "./store";

describe("push provider routing", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of [
      "FIREBASE_ACCESS_TOKEN",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_SERVER_KEY",
      "APNS_KEY_ID",
      "APNS_TEAM_ID",
      "APNS_PRIVATE_KEY",
      "APNS_TOPIC",
    ]) {
      delete process.env[key];
    }
    sendApnsNotificationsMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends APNs tokens through APNs without attempting Android delivery", async () => {
    process.env.APNS_KEY_ID = "key-id";
    process.env.APNS_TEAM_ID = "team-id";
    process.env.APNS_PRIVATE_KEY = "private-key";
    process.env.APNS_TOPIC = "com.ugandaweather.app";
    sendApnsNotificationsMock.mockResolvedValue({ sent: 1, failed: 0 });
    vi.spyOn(store, "listPushTokensForDistrict").mockResolvedValue([
      {
        token: "ios-token",
        record: {
          tokenHash: "ios-hash",
          platform: "ios",
          districtSlug: "jinja",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
    ]);

    const result = await dispatchStormAlert({
      districtSlug: "jinja",
      title: "Storm alert",
      body: "Heavy rain expected.",
    });

    expect(sendApnsNotificationsMock).toHaveBeenCalledWith(
      ["ios-token"],
      expect.objectContaining({ districtSlug: "jinja" }),
    );
    expect(result).toMatchObject({
      provider: "apns",
      dryRun: false,
      targeted: 1,
      sent: 1,
      failed: 0,
    });
  });

  it("routes FCM and APNs tokens separately and combines their results", async () => {
    process.env.FIREBASE_ACCESS_TOKEN = "access-token";
    process.env.FIREBASE_PROJECT_ID = "project-id";
    process.env.APNS_KEY_ID = "key-id";
    process.env.APNS_TEAM_ID = "team-id";
    process.env.APNS_PRIVATE_KEY = "private-key";
    process.env.APNS_TOPIC = "com.ugandaweather.app";
    sendApnsNotificationsMock.mockResolvedValue({ sent: 1, failed: 0 });
    vi.spyOn(store, "listPushTokensForDistrict").mockResolvedValue([
      {
        token: "android-token",
        record: {
          tokenHash: "android-hash",
          platform: "android",
          districtSlug: "jinja",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
      {
        token: "ios-token",
        record: {
          tokenHash: "ios-hash",
          platform: "ios",
          districtSlug: "jinja",
          registeredAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const result = await dispatchStormAlert({
      districtSlug: "jinja",
      title: "Storm alert",
      body: "Heavy rain expected.",
    });

    expect(sendApnsNotificationsMock).toHaveBeenCalledWith(
      ["ios-token"],
      expect.any(Object),
    );
    expect(result).toMatchObject({
      provider: "mixed",
      dryRun: false,
      targeted: 2,
      sent: 2,
      failed: 0,
    });
  });
});
