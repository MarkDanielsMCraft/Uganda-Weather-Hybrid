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
        }, (window as unknown as { __sentenceMs?: number }).__sentenceMs ?? 3000);
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
    w.__sayInterim = (interim: string, full: string) => {
      const live = [...listeners].reverse().find((l) => !l.ended);
      if (!live) return false;
      live.onresult?.({ results: [{ isFinal: false, 0: { transcript: interim } }] });
      live.onresult?.({ results: [{ isFinal: true, 0: { transcript: full } }] });
      (live as unknown as FakeRecognition).finish();
      return true;
    };
    w.__fail = (code: string) => {
      const live = [...listeners].reverse().find((l) => !l.ended) as unknown as FakeRecognition | undefined;
      if (!live) return false;
      live.onerror?.({ error: code });
      live.finish();
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
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(1);
  const userBubblesBefore = await page.getByTestId("advisor-user-message").count();
  const cancelsBeforeTwo = await cancelCount();
  await page.evaluate(() => (window as never as { __say: (t: string) => boolean }).__say("two"));
  await expect.poll(cancelCount).toBeGreaterThan(cancelsBeforeTwo);
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(userBubblesBefore + 1, { timeout: 10_000 });
  await expect(page.getByTestId("advisor-user-message").last()).not.toHaveText(/^two$/i);
});

type VoiceWindow = {
  __say: (text: string) => boolean;
  __sayInterim: (interim: string, full: string) => boolean;
  __fail: (code: string) => boolean;
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
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(1);
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

const voiceLog = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as never as VoiceWindow).__voiceLog());
const say = (page: import("@playwright/test").Page, text: string) =>
  page.evaluate((spoken) => (window as never as VoiceWindow).__say(spoken), text);

test("every Stop control also turns the microphone off", async ({ page }) => {
  await startVoiceAnswer(page);
  const stop = page.getByRole("button", { name: "Stop", exact: true });
  const stopAudio = page.getByRole("button", { name: "Stop audio" });
  if (await stop.isVisible().catch(() => false)) await stop.click();
  else await stopAudio.last().click();
  await page.waitForTimeout(1500);
  expect((await voiceLog(page)).listening).toBe(false);
});

test("many quiet timeouts during a long reply do not end the conversation", async ({ page }) => {
  test.setTimeout(60_000);
  // Each sentence of the reply lasts a minute, so the whole test runs inside it.
  await page.addInitScript(() => {
    (window as unknown as { __sentenceMs?: number }).__sentenceMs = 60_000;
  });
  await startVoiceAnswer(page);
  for (let i = 0; i < 12; i += 1) {
    await expect.poll(async () => (await voiceLog(page)).listening).toBe(true);
    await page.waitForTimeout(1100);
    await page.evaluate(() => (window as never as VoiceWindow).__fail("no-speech"));
  }
  await expect.poll(async () => (await voiceLog(page)).listening).toBe(true);
  await expect(page.getByText(/could not hear that clearly/i)).toHaveCount(0);
  // The conversation is still alive: a choice still cuts in.
  const bubbles = await page.getByTestId("advisor-user-message").count();
  await say(page, "2");
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles + 1, { timeout: 10_000 });
});

test("a question asked over the reply is kept and asked when the reply ends", async ({ page }) => {
  test.setTimeout(60_000);
  await startVoiceAnswer(page);
  const bubbles = await page.getByTestId("advisor-user-message").count();
  await say(page, "is it safe to fish on Lake Victoria tomorrow morning");
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles + 1, { timeout: 40_000 });
  await expect(page.getByTestId("advisor-user-message").last()).toContainText("Lake Victoria");
});

test("a network error while the reply plays never records the reply", async ({ page }) => {
  await startVoiceAnswer(page);
  const before = (await voiceLog(page)).micOpens;
  await page.evaluate(() => (window as never as VoiceWindow).__fail("network"));
  await page.waitForTimeout(1500);
  expect((await voiceLog(page)).micOpens).toBe(before);
});

test("a held question gets an answer without ending the conversation", async ({ page }) => {
  test.setTimeout(60_000);
  await startVoiceAnswer(page);
  const bubbles = await page.getByTestId("advisor-user-message").count();
  await say(page, "is it safe to fish on Lake Victoria tomorrow morning");
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles + 1, { timeout: 40_000 });
  await page.waitForTimeout(4000);
  await expect(page.getByText(/could not hear that clearly/i)).toHaveCount(0);
});

test("a choice said after a held question wins, and the held question is dropped", async ({ page }) => {
  await startVoiceAnswer(page);
  const bubbles = await page.getByTestId("advisor-user-message").count();
  await say(page, "is it safe to fish on Lake Victoria tomorrow morning");
  await expect.poll(async () => (await voiceLog(page)).listening).toBe(true);
  await say(page, "2");
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles + 1, { timeout: 10_000 });
  await expect(page.getByTestId("advisor-user-message").last()).not.toContainText("Lake Victoria");
  await page.waitForTimeout(8000);
  await expect(page.getByTestId("advisor-user-message").filter({ hasText: "Lake Victoria" })).toHaveCount(0);
});

test("a network error during the reply waits quietly instead of showing an error", async ({ page }) => {
  await startVoiceAnswer(page);
  const startsBefore = (await voiceLog(page)).starts;
  await page.evaluate(() => (window as never as VoiceWindow).__fail("network"));
  await page.waitForTimeout(2500);
  expect((await voiceLog(page)).starts - startsBefore).toBeLessThanOrEqual(1);
  await expect(page.getByText(/could not hear that clearly|allow microphone/i)).toHaveCount(0);
});

test("echo of spoken follow up choices or interim 'To' never cuts in, and Stop listening stops speaker and mic", async ({ page }) => {
  await startVoiceAnswer(page);
  const bubbles = await page.getByTestId("advisor-user-message").count();
  const cancelsBefore = (await voiceLog(page)).cancelled;
  const fullSpoken = (await voiceLog(page)).spoken.join(" ");

  // A reply sentence starting with "To ..." sends an interim "To" first; it must not cut in.
  await page.evaluate(
    (echo) => (window as never as VoiceWindow).__sayInterim("To", `To ${echo}`),
    fullSpoken,
  );
  await page.waitForTimeout(500);
  expect((await voiceLog(page)).cancelled).toBe(cancelsBefore);
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles);

  // Echoing the spoken follow up prompt back into the mic must never trigger choice one.
  await expect.poll(async () => (await voiceLog(page)).listening).toBe(true);
  await say(page, "Next, you can say one for: Safe to farm or dry crops today, or say stop to end");
  await page.waitForTimeout(500);
  expect((await voiceLog(page)).cancelled).toBe(cancelsBefore);
  await expect(page.getByTestId("advisor-user-message")).toHaveCount(bubbles);

  await expect.poll(async () => (await voiceLog(page)).listening).toBe(true);
  await page.getByRole("button", { name: "Stop listening" }).click();
  await expect.poll(async () => (await voiceLog(page)).listening).toBe(false);
  expect((await voiceLog(page)).cancelled).toBeGreaterThan(cancelsBefore);
});

