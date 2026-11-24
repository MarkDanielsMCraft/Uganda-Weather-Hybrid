import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InferenceMode, InferenceSource } from "firebase/ai";
import { resetAdvisorRateLimitForTests } from "@/lib/ai/advisor-guard";
import {
  detectOnDeviceAvailability,
  generateHybridWeatherBriefing,
  resolveHybridReadiness,
} from "@/lib/ai/hybrid-advisor";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn<
  (...args: unknown[]) => { generateContent: typeof mockGenerateContent }
>(() => ({
  generateContent: mockGenerateContent,
}));
const mockGetFirebaseAiClient = vi.fn();
const mockIsFirebaseAiConfigured = vi.fn();

vi.mock("firebase/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/ai")>();
  return {
    ...actual,
    getGenerativeModel: (...args: unknown[]) => mockGetGenerativeModel(...args),
  };
});

vi.mock("@/lib/ai/firebase-client", () => ({
  DEFAULT_CLOUD_MODEL: "gemini-3.5-flash-lite",
  getConfiguredCloudModel: () => "gemini-3.5-flash-lite",
  getFirebaseAiClient: () => mockGetFirebaseAiClient(),
  isFirebaseAiConfigured: () => mockIsFirebaseAiConfigured(),
}));

describe("hybrid-advisor", () => {
  const originalLanguageModel = (globalThis as Record<string, unknown>).LanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAdvisorRateLimitForTests();
    mockGetFirebaseAiClient.mockReturnValue({ app: {} });
    mockIsFirebaseAiConfigured.mockReturnValue(true);
    delete (globalThis as Record<string, unknown>).LanguageModel;
  });

  afterEach(() => {
    if (originalLanguageModel !== undefined) {
      (globalThis as Record<string, unknown>).LanguageModel = originalLanguageModel;
    } else {
      delete (globalThis as Record<string, unknown>).LanguageModel;
    }
  });

  it("resolves honest hybrid readiness states", () => {
    expect(
      resolveHybridReadiness({
        isOnline: false,
        onDeviceAvailability: "available",
        cloudConfigured: false,
      }),
    ).toBe("on_device_ready");

    expect(
      resolveHybridReadiness({
        isOnline: true,
        onDeviceAvailability: "unavailable",
        cloudConfigured: true,
      }),
    ).toBe("cloud_ready");

    expect(
      resolveHybridReadiness({
        isOnline: false,
        onDeviceAvailability: "unavailable",
        cloudConfigured: true,
      }),
    ).toBe("offline_unavailable");

    expect(
      resolveHybridReadiness({
        isOnline: true,
        onDeviceAvailability: "unavailable",
        cloudConfigured: false,
      }),
    ).toBe("unconfigured");
  });

  it("detects browser on-device availability when LanguageModel API is present", async () => {
    expect(await detectOnDeviceAvailability()).toBe("unavailable");

    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn().mockResolvedValue("available"),
    };
    expect(await detectOnDeviceAvailability()).toBe("available");
  });

  it("uses PREFER_ON_DEVICE when online and reports cloud inference source honestly", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Clear morning in Kampala. Good conditions for field work.",
        inferenceSource: InferenceSource.IN_CLOUD,
      },
    });

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle(),
      audience: "farmer",
      language: "en",
      isOnline: true,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.source).toBe("cloud");
      expect(outcome.data.model).toBe("gemini-3.5-flash-lite");
      expect(outcome.data.usedCachedWeather).toBe(false);
    }

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mode: InferenceMode.PREFER_ON_DEVICE,
      }),
    );
  });

  it("uses ONLY_ON_DEVICE when offline and on-device model is available", async () => {
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn().mockResolvedValue("available"),
    };
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Using cached forecast for Kampala. Winds stay light today.",
        inferenceSource: InferenceSource.ON_DEVICE,
      },
    });

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle({ stale: true }),
      audience: "fisher",
      language: "en",
      isOnline: false,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.source).toBe("on_device");
      expect(outcome.data.model).toBe("on-device");
      expect(outcome.data.usedCachedWeather).toBe(true);
    }

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mode: InferenceMode.ONLY_ON_DEVICE,
      }),
    );
  });

  it("answers from the saved forecast when offline without an on-device model", async () => {
    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle({ stale: true }),
      audience: "general",
      language: "en",
      customQuestion: "Will it rain later?",
      isOnline: false,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.source).toBe("saved_forecast");
      expect(outcome.data.usedCachedWeather).toBe(true);
      expect(outcome.data.verdict?.level).toBe("go");
      expect(outcome.data.text).toContain("without AI");
      expect(outcome.data.text).toContain("cannot run the AI advisor without internet");
    }
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it("uses the saved forecast for Luganda offline because Gemini Nano writes English only", async () => {
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn().mockResolvedValue("available"),
    };

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle({ stale: true }),
      audience: "farmer",
      language: "lg",
      isOnline: false,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.source).toBe("saved_forecast");
      expect(outcome.data.text).toContain("tebukozesezza AI");
    }
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it("falls back to the saved forecast when the on-device model fails offline", async () => {
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: vi.fn().mockResolvedValue("available"),
    };
    mockGenerateContent.mockRejectedValue(new Error("on-device session failed"));

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle({ stale: true }),
      audience: "fisher",
      language: "en",
      isOnline: false,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.source).toBe("saved_forecast");
    }
  });

  it("streams chunks and emits thinking then writing phase callbacks", async () => {
    const phases: string[] = [];
    const chunks: string[] = [];

    async function* fakeStream() {
      yield {
        text: () => "Warm morning in Kampala. ",
        inferenceSource: InferenceSource.IN_CLOUD,
      };
      yield {
        text: () => "Rain risk rises after 3 PM.",
        inferenceSource: InferenceSource.IN_CLOUD,
      };
    }

    mockGetGenerativeModel.mockReturnValueOnce({
      generateContent: mockGenerateContent,
      generateContentStream: vi.fn().mockResolvedValue({
        stream: fakeStream(),
        response: Promise.resolve({
          text: () => "Warm morning in Kampala. Rain risk rises after 3 PM.",
          inferenceSource: InferenceSource.IN_CLOUD,
        }),
      }),
    } as unknown as { generateContent: typeof mockGenerateContent });

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle(),
      audience: "farmer",
      language: "en",
      isOnline: true,
      onPhaseChange: (p) => phases.push(p),
      onChunk: (c) => chunks.push(c),
    });

    expect(outcome.ok).toBe(true);
    expect(phases).toEqual(["thinking", "writing"]);
    expect(chunks).toEqual([
      "Warm morning in Kampala.",
      "Warm morning in Kampala. Rain risk rises after 3 PM.",
    ]);
    if (outcome.ok) {
      expect(outcome.data.text).toBe("Warm morning in Kampala. Rain risk rises after 3 PM.");
      expect(outcome.data.source).toBe("cloud");
    }
  });

  it("falls back to generateContent if generateContentStream fails with AI/parse-failed", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => "Fallback reply succeeded cleanly.",
        inferenceSource: InferenceSource.IN_CLOUD,
      },
    });

    mockGetGenerativeModel.mockReturnValueOnce({
      generateContent: mockGenerateContent,
      generateContentStream: vi
        .fn()
        .mockRejectedValue(new Error("AI: Failed to parse stream (AI/parse-failed)")),
    } as unknown as { generateContent: typeof mockGenerateContent });

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle(),
      audience: "general",
      language: "en",
      isOnline: true,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.text).toBe("Fallback reply succeeded cleanly.");
      expect(outcome.data.source).toBe("cloud");
    }
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("returns not_configured when Firebase AI client is absent", async () => {
    mockGetFirebaseAiClient.mockReturnValue(null);
    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle(),
      audience: "general",
      language: "en",
      isOnline: true,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("not_configured");
    }
  });

  it("normalizes missing degree symbols and spelled out metric units in replies", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          "It is 10C, feels like 6C, overnight low -2C, wind 9 kilometers per hour, visibility 12 kilometers, rain 5 millimeters.",
        inferenceSource: InferenceSource.IN_CLOUD,
      },
    });

    const outcome = await generateHybridWeatherBriefing({
      weather: makeWeatherBundle(),
      audience: "mountain_park",
      language: "en",
      isOnline: true,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.text).toBe(
        "It is 10°C, feels like 6°C, overnight low -2°C, wind 9 km/h, visibility 12 km, rain 5 mm.",
      );
    }
  });
});
