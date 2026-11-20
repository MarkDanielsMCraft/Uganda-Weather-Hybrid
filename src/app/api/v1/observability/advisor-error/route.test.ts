import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/v1/observability/advisor-error", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a sanitized structured error line and returns 202 for valid payloads", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = new Request("http://localhost:3000/api/v1/observability/advisor-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        code: "appCheck/throttled",
        district: "kafunjo",
        online: true,
        appCheckActive: true,
        model: "gemini-3.5-flash-lite",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);
    expect(errorSpy).toHaveBeenCalledWith(
      "[ai-advisor] client failure action=generate code=appCheck/throttled district=kafunjo online=true appCheck=true model=gemini-3.5-flash-lite",
    );
  });

  it("rejects payloads containing whitespace or log-injection characters", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = new Request("http://localhost:3000/api/v1/observability/advisor-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.0.1.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify({
        code: "bad\ncode",
        district: "kampala",
        online: true,
        appCheckActive: true,
        model: "gemini-3.5-flash-lite",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(warnSpy).toHaveBeenCalled();
  });
});
