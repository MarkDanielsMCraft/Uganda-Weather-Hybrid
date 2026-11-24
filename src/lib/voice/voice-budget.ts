import { errorResponse } from "@/lib/cache";
import { reserveQuota } from "@/lib/quota/monthly-budget";

/** Paid voice calls allowed per route per month. The cross site check stops
    other websites, but a script can fake browser headers, so this ceiling
    keeps the voice bill from running away. Cached clips do not count. */
const DEFAULT_VOICE_MONTHLY_BUDGET = 20_000;

export function readVoiceMonthlyBudget(): number {
  const parsed = Number(process.env.VOICE_MONTHLY_BUDGET);
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 1_000_000
    ? parsed
    : DEFAULT_VOICE_MONTHLY_BUDGET;
}

export type VoiceCallKind = "speak" | "translate" | "transcribe";

/** Reserves one paid call. Returns a 503 response when this month's ceiling
    is reached, so the app falls back to the browser voice, or null to go on. */
export async function reserveVoiceCall(kind: VoiceCallKind): Promise<Response | null> {
  if (await reserveQuota(`voice-${kind}`, readVoiceMonthlyBudget())) return null;
  console.warn(`[voice] action blocked action=${kind} code=MONTHLY_BUDGET_REACHED`);
  return errorResponse("VOICE_BUDGET_REACHED", "The natural voice is resting for now.", 503);
}
