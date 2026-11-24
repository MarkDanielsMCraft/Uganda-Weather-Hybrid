import { afterEach, describe, expect, it, vi } from "vitest";

const reserveQuota = vi.fn();
vi.mock("@/lib/quota/monthly-budget", () => ({
  reserveQuota: (...args: unknown[]) => reserveQuota(...args),
}));

import { readVoiceMonthlyBudget, reserveVoiceCall } from "@/lib/voice/voice-budget";

describe("voice monthly budget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    reserveQuota.mockReset();
  });

  it("uses 20000 a month by default and accepts a sensible override", () => {
    expect(readVoiceMonthlyBudget()).toBe(20_000);
    vi.stubEnv("VOICE_MONTHLY_BUDGET", "5000");
    expect(readVoiceMonthlyBudget()).toBe(5_000);
  });

  it("ignores broken or extreme settings", () => {
    for (const bad of ["abc", "-5", "0", "10", "99999999", "12.5"]) {
      vi.stubEnv("VOICE_MONTHLY_BUDGET", bad);
      expect(readVoiceMonthlyBudget()).toBe(20_000);
    }
  });

  it("lets a call through while the month still has budget", async () => {
    reserveQuota.mockResolvedValue(true);
    expect(await reserveVoiceCall("speak")).toBeNull();
    expect(reserveQuota).toHaveBeenCalledWith("voice-speak", 20_000);
  });

  it("refuses with 503 once the month's budget is used up", async () => {
    reserveQuota.mockResolvedValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await reserveVoiceCall("transcribe");
    expect(response?.status).toBe(503);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("MONTHLY_BUDGET_REACHED"));
    warn.mockRestore();
  });
});
