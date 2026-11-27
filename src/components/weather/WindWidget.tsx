import { WidgetTile } from "@/components/glass/WidgetTile";
import { WindCompass } from "@/components/weather/WindCompass";
import { WindDetailContent } from "@/components/weather/WindDetailContent";
import { degreesToCompass } from "@/lib/weather/wmo";
import { useTranslation } from "@/lib/i18n";
import { formatWindFooterLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export { WindCompass };

export function WindWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const speed = Number.isFinite(weather?.wind?.speedKph) ? Math.round(weather.wind.speedKph) : 0;
  const gusts = Number.isFinite(weather?.wind?.gustKph) ? Math.round(weather.wind.gustKph) : 0;
  const degree = Number.isFinite(weather?.wind?.degree) ? Math.round(weather.wind.degree) : 0;
  const direction = weather?.wind?.direction || degreesToCompass(degree);

  const footer = uiLanguage === "lg"
    ? formatWindFooterLg(direction, degree)
    : `From the ${direction} at ${degree}°.`;

  const gustsText = uiLanguage === "lg"
    ? `Etuuka ku km/h ${gusts}`
    : `Up to ${gusts} km/h`;

  return (
    <WidgetTile
      title={dict.metrics.wind}
      footer={footer}
      className="min-h-[176px]"
      theme={weather.condition.theme}
      detail={<WindDetailContent weather={weather} />}
    >
      <div className="flex flex-1 items-center justify-between gap-3">
        <div>
          <p className="text-[34px] font-semibold leading-none tabular-nums text-white">
            {uiLanguage === "lg" ? (
              <>
                <span className="text-[17px] font-medium text-white/90">km/h</span>{" "}
                {speed}
              </>
            ) : (
              <>
                {speed}{" "}
                <span className="text-[17px] font-medium text-white/90">km/h</span>
              </>
            )}
          </p>
          <p className="mt-2 text-[14px] font-medium tabular-nums text-white/88">
            {gustsText}
          </p>
        </div>
        <WindCompass degree={degree} />
      </div>
    </WidgetTile>
  );
}
