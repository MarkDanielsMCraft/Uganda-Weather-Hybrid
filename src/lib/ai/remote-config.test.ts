// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRemoteConfigMock,
  fetchAndActivateMock,
  getBooleanMock,
  getNumberMock,
  getStringMock,
  isSupportedMock,
  getFirebaseAppMock,
} = vi.hoisted(() => ({
  getRemoteConfigMock: vi.fn(),
  fetchAndActivateMock: vi.fn(),
  getBooleanMock: vi.fn(),
  getNumberMock: vi.fn(),
  getStringMock: vi.fn(),
  isSupportedMock: vi.fn(),
  getFirebaseAppMock: vi.fn(),
}));

vi.mock("firebase/remote-config", () => ({
  getRemoteConfig: getRemoteConfigMock,
  fetchAndActivate: fetchAndActivateMock,
  getBoolean: getBooleanMock,
  getNumber: getNumberMock,
  getString: getStringMock,
  isSupported: isSupportedMock,
}));

vi.mock("@/lib/ai/firebase-client", () => ({
  DEFAULT_CLOUD_MODEL: "gemini-3.5-flash-lite",
  getConfiguredCloudModel: () => "gemini-3.5-flash-lite",
  getFirebaseApp: getFirebaseAppMock,
}));

import {
  getAdvisorRemoteConfig,
  resetAdvisorRemoteConfigForTests,
  syncAdvisorRemoteConfig,
} from "@/lib/ai/remote-config";

describe("advisor remote-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAdvisorRemoteConfigForTests();
  });

  afterEach(() => {
    resetAdvisorRemoteConfigForTests();
  });

  it("returns safe defaults before remote fetch completes", () => {
    const snapshot = getAdvisorRemoteConfig();
    expect(snapshot).toEqual({
      enabled: true,
      cloudModel: "gemini-3.5-flash-lite",
      maxOutputTokens: 512,
      preferOnDevice: true,
      source: "default",
    });
  });

  it("fetches, validates, and activates Firebase Remote Config values", async () => {
    getFirebaseAppMock.mockReturnValue({ name: "[DEFAULT]" });
    isSupportedMock.mockResolvedValue(true);
    getRemoteConfigMock.mockReturnValue({ settings: {}, defaultConfig: {} });
    fetchAndActivateMock.mockResolvedValue(true);
    getBooleanMock.mockImplementation((_rc: unknown, key: string) =>
      key === "advisor_enabled" ? true : false,
    );
    getStringMock.mockReturnValue("gemini-3.8-flash");
    getNumberMock.mockReturnValue(768);

    const snapshot = await syncAdvisorRemoteConfig();
    expect(snapshot).toEqual({
      enabled: true,
      cloudModel: "gemini-3.8-flash",
      maxOutputTokens: 768,
      preferOnDevice: false,
      source: "remote",
    });
    expect(getAdvisorRemoteConfig()).toEqual(snapshot);
  });

  it("falls back to safe defaults when offline or fetch fails", async () => {
    getFirebaseAppMock.mockReturnValue({ name: "[DEFAULT]" });
    isSupportedMock.mockResolvedValue(true);
    getRemoteConfigMock.mockReturnValue({ settings: {}, defaultConfig: {} });
    fetchAndActivateMock.mockRejectedValue(new Error("Network offline"));

    const snapshot = await syncAdvisorRemoteConfig();
    expect(snapshot.source).toBe("default");
    expect(snapshot.cloudModel).toBe("gemini-3.5-flash-lite");
    expect(snapshot.enabled).toBe(true);
  });
});
