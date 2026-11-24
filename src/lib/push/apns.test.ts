import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock("node:http2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:http2")>();
  return { ...actual, connect: connectMock };
});

import {
  getApnsProviderToken,
  resetCachedApnsTokenForTests,
  sendApnsNotifications,
} from "./apns";

describe("APNs provider token", () => {
  let privateKey: string;

  beforeEach(() => {
    connectMock.mockReset();
    delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID;
    delete process.env.APNS_PRIVATE_KEY;
    delete process.env.APNS_TOPIC;
    resetCachedApnsTokenForTests();
    privateKey = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    }).privateKey;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns no token until all provider credentials are supplied", () => {
    process.env.APNS_KEY_ID = "key-id";
    process.env.APNS_TEAM_ID = "team-id";

    expect(getApnsProviderToken()).toBeNull();
  });

  it("signs and caches a provider token using the configured key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));
    process.env.APNS_KEY_ID = "key-id";
    process.env.APNS_TEAM_ID = "team-id";
    process.env.APNS_PRIVATE_KEY = privateKey;

    const token = getApnsProviderToken();
    expect(token).not.toBeNull();
    const [headerSegment, claimsSegment, signatureSegment] = token!.split(".");
    expect(JSON.parse(Buffer.from(headerSegment!, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "key-id",
    });
    expect(JSON.parse(Buffer.from(claimsSegment!, "base64url").toString())).toEqual({
      iss: "team-id",
      iat: Math.floor(Date.now() / 1000),
    });
    expect(Buffer.from(signatureSegment!, "base64url")).toHaveLength(64);
    expect(getApnsProviderToken()).toBe(token);
  });

  it("retries development device tokens against the sandbox provider", async () => {
    process.env.APNS_KEY_ID = "key-id";
    process.env.APNS_TEAM_ID = "team-id";
    process.env.APNS_PRIVATE_KEY = privateKey;
    process.env.APNS_TOPIC = "com.ugandaweather.app";

    connectMock.mockImplementation((url: string) => {
      const session = new EventEmitter() as EventEmitter & {
        request: () => EventEmitter & {
          setTimeout: (milliseconds: number, callback: () => void) => void;
          close: (code: number) => void;
          end: (body: string) => void;
        };
        close: () => void;
      };
      session.close = vi.fn();
      session.request = () => {
        const request = new EventEmitter() as EventEmitter & {
          setTimeout: (milliseconds: number, callback: () => void) => void;
          close: (code: number) => void;
          end: (body: string) => void;
        };
        request.setTimeout = vi.fn();
        request.close = vi.fn();
        request.end = vi.fn(() => {
          const isSandbox = url === "https://api.sandbox.push.apple.com";
          request.emit("response", { ":status": isSandbox ? 200 : 400 });
          if (!isSandbox) {
            request.emit("data", Buffer.from(JSON.stringify({ reason: "BadDeviceToken" })));
          }
          request.emit("end");
        });
        return request;
      };
      queueMicrotask(() => session.emit("connect"));
      return session;
    });

    await expect(
      sendApnsNotifications(["device-token"], {
        title: "Alert",
        body: "Heavy rain",
        districtSlug: "kampala",
        route: "/alerts",
      }),
    ).resolves.toEqual({ sent: 1, failed: 0, goneTokens: [] });
    expect(connectMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.push.apple.com",
      "https://api.sandbox.push.apple.com",
    ]);
  });
});
