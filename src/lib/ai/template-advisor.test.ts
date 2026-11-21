import { describe, expect, it, vi } from "vitest";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { getTemplateGenerativeModelMock } = vi.hoisted(() => ({
  getTemplateGenerativeModelMock: vi.fn(),
}));

vi.mock("firebase/ai", () => ({
  getTemplateGenerativeModel: getTemplateGenerativeModelMock,
}));

import {
  buildServerTemplateVariables,
  generateWithServerPromptTemplate,
} from "@/lib/ai/template-advisor";

describe("template-advisor (Firebase AI Logic Server Prompt Templates)", () => {
  it("extracts minimal non-PII weather variables for Server Prompt Templates", () => {
    const bundle = makeWeatherBundle();
    const vars = buildServerTemplateVariables({
      weather: bundle,
      audience: "farmer",
      language: "en",
      question: "Can I dry maize today?",
      history: [{ role: "user", text: "Hello" }],
    });

    expect(vars.district).toBe(bundle.district.name);
    expect(vars.audience).toBe("farmer");
    expect(vars.language).toBe("en");
    expect(vars.question).toBe("Can I dry maize today?");
    expect(vars.historySummary).toContain("User: Hello");
  });

  it("streams replies from getTemplateGenerativeModel and notifies phase/chunks", async () => {
    const onPhaseChange = vi.fn();
    const onRawChunk = vi.fn();
    async function* mockStream() {
      yield { text: () => "Dry conditions " };
      yield { text: () => "until 4 pm." };
    }
    getTemplateGenerativeModelMock.mockReturnValue({
      generateContentStream: vi.fn().mockResolvedValue({
        stream: mockStream(),
        response: Promise.resolve({ text: () => "Dry conditions until 4 pm." }),
      }),
    });

    const bundle = makeWeatherBundle();
    const vars = buildServerTemplateVariables({
      weather: bundle,
      audience: "general",
      language: "en",
      question: "Any rain today?",
    });

    const text = await generateWithServerPromptTemplate({
      ai: {} as never,
      templateId: "uganda-weather-advisor-v1",
      variables: vars,
      onPhaseChange,
      onRawChunk,
    });

    expect(text).toBe("Dry conditions until 4 pm.");
    expect(onPhaseChange).toHaveBeenCalledWith("writing");
    expect(onRawChunk).toHaveBeenLastCalledWith("Dry conditions until 4 pm.");
  });

  it("falls back to unary generateContent if streaming fails, and returns null if template is missing", async () => {
    getTemplateGenerativeModelMock.mockReturnValue({
      generateContentStream: vi.fn().mockRejectedValue(new Error("stream parse error")),
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => "Calm evening skies." },
      }),
    });

    const bundle = makeWeatherBundle();
    const vars = buildServerTemplateVariables({
      weather: bundle,
      audience: "general",
      language: "en",
      question: "Evening outlook?",
    });

    const text = await generateWithServerPromptTemplate({
      ai: {} as never,
      templateId: "uganda-weather-advisor-v1",
      variables: vars,
    });
    expect(text).toBe("Calm evening skies.");

    getTemplateGenerativeModelMock.mockReturnValue({
      generateContentStream: vi.fn().mockRejectedValue(new Error("404 not found")),
      generateContent: vi.fn().mockRejectedValue(new Error("404 not found")),
    });
    const missing = await generateWithServerPromptTemplate({
      ai: {} as never,
      templateId: "missing-template",
      variables: vars,
    });
    expect(missing).toBeNull();
  });
});
