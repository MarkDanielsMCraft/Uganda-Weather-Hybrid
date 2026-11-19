export { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export function weatherFetchTimeoutMs(kind: "primary" | "fallback"): number {
  const primary = Number(process.env.WEATHER_PRIMARY_TIMEOUT_MS ?? 5_000);
  const fallback = Number(process.env.WEATHER_FALLBACK_TIMEOUT_MS ?? 8_000);
  return kind === "primary" ? primary : fallback;
}
