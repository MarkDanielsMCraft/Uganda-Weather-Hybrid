import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

const RAINVIEWER_TIMEOUT_MS = 4_000;

interface RainViewerPayload {
  host?: string;
  radar?: {
    past?: Array<{ time: number; path: string }>;
    nowcast?: Array<{ time: number; path: string }>;
  };
}

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  try {
    const { data, stale } = await getCached(
      "ug:radar:rainviewer:v1",
      300,
      async () => {
        const response = await fetchWithTimeout(
          (signal) =>
            fetch("https://api.rainviewer.com/public/weather-maps.json", {
              next: { revalidate: 300 },
              signal,
            }),
          RAINVIEWER_TIMEOUT_MS,
        );
        if (!response.ok) {
          throw new Error(`RainViewer error: ${response.status}`);
        }
        return response.json() as Promise<RainViewerPayload>;
      },
    );

    const meta = createMeta(stale);
    return jsonResponse(data, meta, mergeRateLimitHeaders({}, rateLimit.headers));
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Radar frames temporarily unavailable", 503);
  }
}
