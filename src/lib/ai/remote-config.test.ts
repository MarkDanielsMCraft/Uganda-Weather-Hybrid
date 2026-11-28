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
      ttsEnabled: true,
      ttsModel: "gemini-3.8-flash-tts",
      ttsVoiceName: "Kore",
      ttsFirstChunkTimeoutMs: 4500,
      ttsFirstChunkMaxChars: 90,
      ttsChunkMaxChars: 165,
      voiceSlowRttMs: 800,
      voiceSlowDownlinkMbps: 0.4,
      promptTemplateId: "",
      source: "default",
    });
  });

  it("fetches, validates, and activates Firebase Remote Config values", async () => {
    getFirebaseAppMock.mockReturnValue({ name: "[DEFAULT]" });
    isSupportedMock.mockResolvedValue(true);
    getRemoteConfigMock.mockReturnValue({ settings: {}, defaultConfig: {} });
    fetchAndActivateMock.mockResolvedValue(true);
    getBooleanMock.mockImplementation((_rc: unknown, key: string) =>
      key === "advisor_enabled" || key === "advisor_tts_enabled",
    );
    getStringMock.mockImplementation((_rc: unknown, key: string) => {
      if (key === "advisor_cloud_model") return "gemini-3.8-flash";
      if (key === "advisor_tts_model") return "gemini-3.1-flash-tts-preview";
      if (key === "advisor_tts_voice") return "Aoede";
      if (key === "advisor_prompt_template_id") return "uganda-weather-advisor-v1";
      return "";
    });
    getNumberMock.mockImplementation((_rc: unknown, key: string) => {
      if (key === "advisor_max_output_tokens") return 768;
      if (key === "advisor_tts_first_chunk_timeout_ms") return 3800;
      if (key === "advisor_tts_first_chunk_max_chars") return 85;
      if (key === "advisor_tts_chunk_max_chars") return 170;
      if (key === "advisor_voice_slow_rtt_ms") return 750;
      if (key === "advisor_voice_slow_downlink_mbps") return 0.5;
      return 0;
    });

    const snapshot = await syncAdvisorRemoteConfig();
    expect(snapshot).toEqual({
      enabled: true,
      cloudModel: "gemini-3.8-flash",
      maxOutputTokens: 768,
      preferOnDevice: false,
      ttsEnabled: true,
      ttsModel: "gemini-3.1-flash-tts-preview",
      ttsVoiceName: "Aoede",
      ttsFirstChunkTimeoutMs: 3800,
      ttsFirstChunkMaxChars: 85,
      ttsChunkMaxChars: 170,
      voiceSlowRttMs: 750,
      voiceSlowDownlinkMbps: 0.5,
      promptTemplateId: "uganda-weather-advisor-v1",
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
