import { expect, test } from "@playwright/test";

// A fake microphone and speaker let the test hold a real hands free
// conversation: ask by voice, hear the reply, and answer "two" while the
// reply is still being read, the way people talk to modern voice assistants.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Keep the paid cloud voice out of the test, so replies use the browser voice.
    localStorage.setItem("uw:gemini-voice-paused-until", String(Date.now() + 60 * 60 * 1000));

    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    let cancelled = 0;
    let current: SpeechSynthesisUtterance | null = null;
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      onvoiceschanged: null,
      pause: () => undefined,
      resume: () => undefined,
      speak(utterance: SpeechSynthesisUtterance) {
        spoken.push(utterance.text);
        current = utterance;
        synth.speaking = true;
        setTimeout(() => utterance.onstart?.(new Event("start") as SpeechSynthesisEvent), 0);
        // Each sentence takes 3 seconds, long enough to talk over it.
        setTimeout(() => {
          if (current !== utterance) return;
          synth.speaking = false;
          current = null;
          utterance.onend?.(new Event("end") as SpeechSynthesisEvent);
        }, 3000);
      },
      cancel() {
        cancelled += 1;
        const was = current;
        current = null;
        synth.speaking = false;
        was?.onend?.(new Event("end") as SpeechSynthesisEvent);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    w.SpeechSynthesisUtterance = class {
      text: string;
      lang = "";
      voice = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      onstart: ((e: Event) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };

    const listeners: Array<{
      onresult: ((e: unknown) => void) | null;
      onend: (() => void) | null;
      ended: boolean;
    }> = [];
    let starts = 0;
    let micOpens = 0;
    // Luganda records through getUserMedia instead of SpeechRecognition.
    if (navigator.mediaDevices) {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          micOpens += 1;
          throw new DOMException("No microphone in tests", "NotFoundError");
        },
      });
    }
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      ended = false;
      start() {
        listeners.push(this);
        starts += 1;
        // Simulates a busy or broken microphone that ends straight away.
        if ((window as unknown as { __instantEnd?: boolean }).__instantEnd) {
          setTimeout(() => this.finish(), 0);
        }
      }
      stop() {
        this.finish();
      }
      abort() {
        this.finish();
      }
      finish() {
        if (this.ended) return;
        this.ended = true;
        this.onend?.();
      }
    }
    w.webkitSpeechRecognition = FakeRecognition;
    w.SpeechRecognition = FakeRecognition;

    w.__say = (text: string) => {
      const live = [...listeners].reverse().find((l) => !l.ended);
      if (!live) return false;
      live.onresult?.({ results: [{ isFinal: true, 0: { transcript: text } }] });
      (live as unknown as FakeRecognition).finish();
      return true;
    };
    w.__voiceLog = () => ({ spoken, cancelled, starts, micOpens, listening: listeners.some((l) => !l.ended) });
  });
});

test("hands free voice hears 'two' said over the reply and ignores its own voice", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const essentialOnly = page.getByRole("button", { name: "Essential only" });
  if (await essentialOnly.isVisible().catch(() => false)) await essentialOnly.click();

  await page.getByRole("button", { name: /weather advisor/i }).click();
  await page.getByTestId("advisor-runtime-badge").click();
  await page.getByRole("button", { name: "Offline", exact: true }).click();

  await page.getByRole("button", { name: "Speak your question" }).click();
  await expect.poll(() => page.evaluate(() => (window as never as { __voiceLog: () => { listening: boolean } }).__voiceLog().listening)).toBe(true);
  await page.evaluate(() => (window as never as { __say: (t: string) => boolean }).__say("Is it safe to dry crops today"));

  // The reply starts being read out, and the microphone stays open.
  await expect.poll(() => page.evaluate(() => (window as never as { __voiceLog: () => { spoken: string[] } }).__voiceLog().spoken.length), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as never as { __voiceLog: () => { listening: boolean } }).__voiceLog().listening)).toBe(true);

  // The app's own words coming back through the mic must not stop the reply.
  const cancelCount = () => page.evaluate(() => (window as never as { __voiceLog: () => { cancelled: number } }).__voiceLog().cancelled);
  const firstSentence = await page.evaluate(() => (window as never as { __voiceLog: () => { spoken: string[] } }).__voiceLog().spoken[0]!);
  const cancelsBeforeEcho = await cancelCount();
  await page.evaluate((echo) => (window as never as { __say: (t: string) => boolean }).__say(echo), firstSentence);
  await page.waitForTimeout(500);
  expect(await cancelCount()).toBe(cancelsBeforeEcho);

  // Saying "two" over the reply stops it and asks the second suggestion.
  await expect.poll(() => page.evaluate(() => (window as never as { __voiceLog: () => { listening: boolean } }).__voiceLog().listening)).toBe(true);
  const userBubblesBefore = await page.getByTestId("advisor-user-message").count();
  const cancelsBeforeTwo = await cancelCount();
  await page.evaluate(() => (window as never as { __say: (t: string) => boolean }).__say("two"));
  await expect.poll(cancelCount).toBeGreaterThan(cancelsBeforeTwo);
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(userBubblesBefore + 1, { timeout: 10_000 });
  await expect(page.getByTestId("advisor-user-message").last()).not.toHaveText(/^two$/i);
});

type VoiceWindow = {
  __say: (text: string) => boolean;
  __voiceLog: () => { spoken: string[]; cancelled: number; starts: number; micOpens: number; listening: boolean };
  __instantEnd?: boolean;
};

async function startVoiceAnswer(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "load" });
  const essentialOnly = page.getByRole("button", { name: "Essential only" });
  if (await essentialOnly.isVisible().catch(() => false)) await essentialOnly.click();
  await page.getByRole("button", { name: /weather advisor/i }).click();
  await page.getByTestId("advisor-runtime-badge").click();
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  await page.getByRole("button", { name: "Speak your question" }).click();
  await expect.poll(() => page.evaluate(() => (window as never as VoiceWindow).__voiceLog().listening)).toBe(true);
  await page.evaluate(() => (window as never as VoiceWindow).__say("Is it safe to dry crops today"));
  await expect.poll(() => page.evaluate(() => (window as never as VoiceWindow).__voiceLog().spoken.length), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as never as VoiceWindow).__voiceLog().listening)).toBe(true);
}

test("words that only sound like the reply never cut in, but the digit 2 does", async ({ page }) => {
  await startVoiceAnswer(page);
  const cancels = () => page.evaluate(() => (window as never as VoiceWindow).__voiceLog().cancelled);
  const before = await cancels();
  await page.evaluate(() => (window as never as VoiceWindow).__say("twenty seven degrees celsius and some clouds later on"));
  await page.waitForTimeout(600);
  expect(await cancels()).toBe(before);
  const bubbles = await page.getByTestId("advisor-user-message").count();

  await expect.poll(() => page.evaluate(() => (window as never as VoiceWindow).__voiceLog().listening)).toBe(true);
  await page.evaluate(() => (window as never as VoiceWindow).__say("2"));
  await expect.poll(cancels).toBeGreaterThan(before);
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles + 1, { timeout: 10_000 });
});

test("switching language ends the voice conversation and no microphone opens", async ({ page }) => {
  await startVoiceAnswer(page);
  const before = await page.evaluate(() => (window as never as VoiceWindow).__voiceLog());
  await page.getByRole("button", { name: "Language" }).first().click();
  await page.getByRole("menuitemradio", { name: /luganda/i }).first().click();
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => (window as never as VoiceWindow).__voiceLog());
  expect(after.listening).toBe(false);
  expect(after.micOpens).toBe(before.micOpens);
  expect(after.starts).toBe(before.starts);
});

test("switching district ends the voice conversation and turns the mic off", async ({ page }) => {
  await startVoiceAnswer(page);
  // The chip row scrolls on its own, so the click is sent straight to the chip.
  await page.getByRole("button", { name: /^Gulu City/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Gulu", { timeout: 10_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as never as VoiceWindow).__voiceLog().listening)).toBe(false);
});

test("a microphone that keeps ending at once is restarted only a few times", async ({ page }) => {
  await startVoiceAnswer(page);
  const startsBefore = await page.evaluate(() => (window as never as VoiceWindow).__voiceLog().starts);
  await page.evaluate(() => {
    (window as never as VoiceWindow).__instantEnd = true;
    (window as never as VoiceWindow).__say("");
  });
  await page.waitForTimeout(4000);
  const starts = await page.evaluate(() => (window as never as VoiceWindow).__voiceLog().starts);
  expect(starts - startsBefore).toBeLessThanOrEqual(12);
});

