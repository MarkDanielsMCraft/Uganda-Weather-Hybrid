import { WeatherDataStatus } from "@/components/weather/WeatherDataStatus";
import type { ApiMeta, WeatherBundle } from "@/types/weather";

export function WeatherStatusFooter({
  weather,
  meta,
  className = "",
}: {
  weather: WeatherBundle;
  meta?: ApiMeta;
  className?: string;
}) {
  return (
    <WeatherDataStatus
      weather={weather}
      metaStale={meta?.stale}
      compact
      className={className}
    />
  );
}
