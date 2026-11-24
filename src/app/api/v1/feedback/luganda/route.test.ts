import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/feedback/luganda/route";
import {
  listStoredLugandaFeedbackForTests,
  resetLugandaFeedbackStoreForTests,
} from "@/lib/feedback/luganda-feedback";

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      results.push(full);
    }
  }
  return results;
}


/** Production sends each report by email. Tests give the route a working
    email setup so "accepted" means the report really went somewhere. */
function stubWorkingEmail() {
  vi.stubEnv("RESEND_API_KEY", "re_test_secret_key");
  vi.stubEnv("RESEND_FROM_EMAIL", "Uganda Weather <noreply@example.com>");
  vi.stubEnv("LUGANDA_FEEDBACK_TO_EMAIL", "feedback-inbox@example.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: "email-1", success: true }), { status: 200 })),
  );
}

describe("POST /api/v1/feedback/luganda", () => {
  beforeEach(async () => {
    const { resetRateLimitsForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    resetLugandaFeedbackStoreForTests();
    vi.restoreAllMocks();
    stubWorkingEmail();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a valid Luganda feedback report, persists it, and never leaks the recipient address in the response", async () => {
    const request = new Request("http://localhost/api/v1/feedback/luganda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "sec-fetch-site": "same-origin",
        "x-forwarded-for": "196.43.100.12",
      },
      body: JSON.stringify({
        category: "grammar",
        currentText: "Ebyekyama",
        suggestedText: "Eby'ekyama",
        details: "Akasalako tekaliimu mu kigambo Eby'ekyama.",
        pageOrSection: "/ (kampala)",
        contactEmail: "tester@example.com",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const rawText = await response.text();
    expect(rawText).not.toContain("feedback-inbox@example.com");

    const payload = JSON.parse(rawText) as {
      data: { accepted: boolean; reportId: string };
    };
    expect(payload.data.accepted).toBe(true);
    expect(payload.data.reportId).toBeTruthy();

    const stored = await listStoredLugandaFeedbackForTests();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.category).toBe("grammar");
    expect(stored[0]?.currentText).toBe("Ebyekyama");
    expect(stored[0]?.suggestedText).toBe("Eby'ekyama");
    expect(stored[0]?.hasContactEmail).toBe(true);
  });

  it("dispatches email via Resend when RESEND_API_KEY, RESEND_FROM_EMAIL, and LUGANDA_FEEDBACK_TO_EMAIL are configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_secret_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Uganda Weather <noreply@example.com>");
    vi.stubEnv("LUGANDA_FEEDBACK_TO_EMAIL", "feedback-inbox@example.com");
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const request = new Request("http://localhost/api/v1/feedback/luganda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "sec-fetch-site": "same-origin",
        "x-forwarded-for": "196.43.100.13",
      },
      body: JSON.stringify({
        category: "translation",
        details: "Ekigambo kino kyetaaga okutangaazibwa mu Luganda.",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const sentBody = JSON.parse(String(init.body)) as { to: string[]; subject: string };
    expect(sentBody.to).toEqual(["feedback-inbox@example.com"]);
    expect(sentBody.subject).toContain("[Uganda Weather Luganda Beta]");
  });

  it("rejects invalid payloads with 400", async () => {
    const request = new Request("http://localhost/api/v1/feedback/luganda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "sec-fetch-site": "same-origin",
        "x-forwarded-for": "196.43.100.14",
      },
      body: JSON.stringify({
        category: "grammar",
        details: "ab",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const stored = await listStoredLugandaFeedbackForTests();
    expect(stored).toHaveLength(0);
  });

  it("silently traps honeypot submissions without storing or emailing", async () => {
    const request = new Request("http://localhost/api/v1/feedback/luganda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "sec-fetch-site": "same-origin",
        "x-forwarded-for": "196.43.100.15",
      },
      body: JSON.stringify({
        category: "other",
        details: "Automated spam submission text",
        website: "https://spam.example.com",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { reportId: string } };
    expect(body.data.reportId).toBe("ignored");
    const stored = await listStoredLugandaFeedbackForTests();
    expect(stored).toHaveLength(0);
  });

  it("takes 5 reports a day from one address and refuses the 6th", async () => {
    for (let i = 0; i < 5; i += 1) {
      const okRes = await POST(
        new Request("http://localhost/api/v1/feedback/luganda", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", "sec-fetch-site": "same-origin",
            "x-forwarded-for": "196.43.100.99",
          },
          body: JSON.stringify({
            category: "layout",
            details: `Test feedback submission number ${i}`,
          }),
        }),
      );
      expect(okRes.status).toBe(201);
    }

    const blockedRes = await POST(
      new Request("http://localhost/api/v1/feedback/luganda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "sec-fetch-site": "same-origin",
          "x-forwarded-for": "196.43.100.99",
        },
        body: JSON.stringify({
          category: "layout",
          details: "Sixth submission should be refused today",
        }),
      }),
    );
    expect(blockedRes.status).toBe(429);
  });

  it("enforces Turnstile verification when TURNSTILE_SECRET_KEY is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");

    // Missing token -> 403
    const missingTokenRes = await POST(
      new Request("http://localhost/api/v1/feedback/luganda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "sec-fetch-site": "same-origin",
          "x-forwarded-for": "196.43.100.55",
        },
        body: JSON.stringify({
          category: "grammar",
          details: "Turnstile check without token",
        }),
      }),
    );
    expect(missingTokenRes.status).toBe(403);

    // Valid token verified against siteverify -> 201
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const validTokenRes = await POST(
      new Request("http://localhost/api/v1/feedback/luganda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "sec-fetch-site": "same-origin",
          "x-forwarded-for": "196.43.100.55",
        },
        body: JSON.stringify({
          category: "grammar",
          details: "Turnstile check with valid token",
          turnstileToken: "valid_turnstile_response_token",
        }),
      }),
    );
    expect(validTokenRes.status).toBe(201);
    // The human check runs first, then the report is emailed.
    const calledUrls = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(calledUrls[0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(calledUrls).toContain("https://api.resend.com/emails");
  });

  it("keeps internal email addresses strictly out of all source code (server and client)", () => {
    const projectRoot = process.cwd();
    const srcDir = path.join(projectRoot, "src");

    for (const filePath of collectSourceFiles(srcDir)) {
      const content = readFileSync(filePath, "utf8");
      expect(content, `Internal email leaked in ${filePath}`).not.toMatch(
        /[a-z0-9._%+-]+@mcraftportfolio\.dev/i,
      );
    }
  });
});

describe("feedback flood limits", () => {
  beforeEach(async () => {
    const { resetRateLimitsForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    resetLugandaFeedbackStoreForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    stubWorkingEmail();
  });

  afterEach(async () => {
    const { resetRateLimitsForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function report(i: number) {
    return new Request("http://localhost/api/v1/feedback/luganda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sec-fetch-site": "same-origin",
        // A new address each time, like a script spread over many phones.
        "x-forwarded-for": `10.1.${Math.floor(i / 250)}.${i % 250}`,
      },
      body: JSON.stringify({ category: "grammar", details: `Report number ${i} about a word.` }),
    });
  }

  it("takes at most 200 reports a day across the whole app", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 201; i += 1) statuses.push((await POST(report(i))).status);
    expect(statuses.slice(0, 200).every((status) => status === 201)).toBe(true);
    expect(statuses[200]).toBe(429);
  });

  it("keeps only the newest 500 reports in server memory", async () => {
    const { submitLugandaFeedback, MAX_MEMORY_FEEDBACK_REPORTS } = await import("@/lib/feedback/luganda-feedback");
    for (let i = 0; i < MAX_MEMORY_FEEDBACK_REPORTS + 20; i += 1) {
      await submitLugandaFeedback({ category: "grammar", details: `Stored report ${i} text.` });
    }
    expect((await listStoredLugandaFeedbackForTests()).length).toBe(MAX_MEMORY_FEEDBACK_REPORTS);
  });
});

describe("feedback with nowhere to go", () => {
  beforeEach(async () => {
    const { resetRateLimitsForTests } = await import("@/lib/rate-limit");
    resetRateLimitsForTests();
    resetLugandaFeedbackStoreForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("RESEND_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not say thank you when the report can be neither emailed nor saved", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/feedback/luganda", {
        method: "POST",
        headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify({ category: "grammar", details: "A report with no inbox set up." }),
      }),
    );
    expect(response.status).toBe(503);
  });
});
