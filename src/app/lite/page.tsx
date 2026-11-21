import Link from "next/link";
import { HybridWeatherAdvisor } from "@/components/advisor/HybridWeatherAdvisor";
import { WeatherGlyph } from "@/components/brand/BrandMark";
import { GlassPanel } from "@/components/glass/GlassCard";
import { AccessibilityControls } from "@/components/settings/AccessibilityControls";
import { LiteDistrictPicker } from "@/components/settings/LiteDistrictPicker";
import { LiteLanguageDropdown } from "@/components/settings/LiteLanguageDropdown";
import { LiteListenButton } from "@/components/settings/LiteListenButton";
import { VillageShareBar } from "@/components/settings/VillageShareBar";
import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { buildPlainTextWeatherSms } from "@/lib/places/sms-share";
import { buildCommunitySafetyAlerts } from "@/lib/weather/community-safety";
import { buildHomeWeatherNarration } from "@/lib/voice/narrator";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { formatConditionLg, formatDayLg } from "@/lib/weather/copy-lg";

export const metadata = {
  title: "Uganda Weather Lite",
  description: "Low data, fast district weather for Uganda built for feature phones and slow connections.",
};

const CACHE_TTL_CURRENT = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const WIND_CAUTION_KPH = Number(process.env.SAFETY_WIND_CAUTION_KPH ?? 25);
const DEFAULT_DISTRICT_SLUG = process.env.DEFAULT_DISTRICT_SLUG?.trim().toLowerCase() || "kampala";

function LiteConditionIcon({
  condition,
  rainChance,
  isDay,
}: {
  condition: string;
  rainChance: number;
  isDay: boolean;
}) {
  const lower = condition.toLowerCase();
  const isStorm = lower.includes("thunder") || lower.includes("storm");
  const isRain =
    rainChance >= 50 ||
    lower.includes("rain") ||
    lower.includes("shower") ||
    lower.includes("drizzle");
  const isCloud =
    lower.includes("cloud") ||
    lower.includes("overcast") ||
    lower.includes("mist") ||
    lower.includes("fog");

  if (isStorm) {
    return (
      <svg viewBox="0 0 32 32" fill="none" className="h-10 w-10 shrink-0 text-alert-red" aria-hidden="true">
        <path
          d="M9 19h14a5 5 0 0 0 .8-9.94A7 7 0 0 0 10.2 8.2 5.5 5.5 0 0 0 9 19Z"
          fill="currentColor"
          opacity="0.22"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M17 19l-3 5h3l-2 5 6-7h-3l2-3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (isRain) {
    return (
      <svg viewBox="0 0 32 32" fill="none" className="h-10 w-10 shrink-0 text-[#60a5fa]" aria-hidden="true">
        <path
          d="M9 19h14a5 5 0 0 0 .8-9.94A7 7 0 0 0 10.2 8.2 5.5 5.5 0 0 0 9 19Z"
          fill="currentColor"
          opacity="0.25"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M11 23l-1 4M16 23l-1 4M21 23l-1 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (isCloud) {
    return (
      <svg viewBox="0 0 32 32" fill="none" className="h-10 w-10 shrink-0 text-white/85" aria-hidden="true">
        <path
          d="M9 22h14a5 5 0 0 0 .8-9.94A7 7 0 0 0 10.2 11.2 5.5 5.5 0 0 0 9 22Z"
          fill="currentColor"
          opacity="0.22"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }
  if (!isDay) {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        data-testid="lite-night-moon-icon"
        className="h-10 w-10 shrink-0 text-white/90"
        aria-hidden="true"
      >
        <path
          d="M22.5 18.8A7.8 7.8 0 0 1 13.2 9.5c0-1.15.25-2.24.7-3.22A8 8 0 1 0 23.7 18.1c-.39.45-.79.62-1.2.7Z"
          fill="currentColor"
          opacity="0.26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23" cy="9" r="1.1" fill="currentColor" />
        <circle cx="19" cy="6.5" r="0.8" fill="currentColor" opacity="0.75" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      data-testid="lite-day-sun-icon"
      className="h-10 w-10 shrink-0 text-white/90"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.24" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2.2 2.2M22.3 22.3l2.2 2.2M24.5 7.5l-2.2 2.2M9.7 22.3l-2.2 2.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getUpcomingHourRainChance(bundle: {
  precipitation: { chance: number };
  hourly?: Array<{ kind: string; rainChance?: number }>;
}): number {
  const hourly = Array.isArray(bundle.hourly) ? bundle.hourly : [];
  const nextHours = hourly
    .filter((point) => point.kind === "hour" && typeof point.rainChance === "number")
    .slice(0, 6);
  if (nextHours.length > 0) {
    return Math.round(nextHours[0]!.rainChance ?? bundle.precipitation.chance);
  }
  return Math.round(bundle.precipitation.chance);
}

function getDailyGuidance(
  bundle: {
    isDay: boolean;
    precipitation: { chance: number };
    wind: { speedKph: number };
    hourly?: Array<{ kind: string; rainChance?: number }>;
  },
  isLg: boolean,
): { toneClass: string; text: string } {
  const upcomingHours = Array.isArray(bundle.hourly)
    ? bundle.hourly
        .filter((point) => point.kind === "hour" && typeof point.rainChance === "number")
        .slice(0, 6)
    : [];
  const windowMaxRain =
    upcomingHours.length > 0
      ? Math.max(...upcomingHours.map((h) => h.rainChance ?? 0))
      : bundle.precipitation.chance;
  const windKph = bundle.wind.speedKph;

  if (windowMaxRain >= 65 || windKph >= WIND_CAUTION_KPH) {
    return {
      toneClass: "text-alert-red",
      text: isLg
        ? "Enkuba oba empewo eyinza okuba ey'amaanyi. Tegeka ebikukuuma n'okubikka ebirime."
        : "High rain or wind risk. Protect crops and carry rain gear.",
    };
  }
  if (windowMaxRain >= 35) {
    return {
      toneClass: "text-caution",
      text: isLg
        ? bundle.isDay
          ? "Enkuba eyinza okutonnya olweggulo. Beera mwegendereza."
          : "Enkuba entonotono eyinza okutonnya ekiro kino. Beera mwegendereza."
        : bundle.isDay
          ? "Some rain is possible later. Keep covers nearby for drying crops."
          : "Light showers are possible tonight. Stay alert if traveling.",
    };
  }
  if (!bundle.isDay) {
    return {
      toneClass: "text-brand-green",
      text: isLg
        ? "Obudde bw'ekiro buteefu. Tewali bulabe bwa nkuba ya maanyi."
        : "Calm night conditions with low rain risk.",
    };
  }
  return {
    toneClass: "text-brand-green",
    text: isLg
      ? "Obudde bulungi nnyo okukola emirimu gy'ebweru n'okwanika ebirime."
      : "Good conditions for outdoor work, travel, and drying crops.",
  };
}

export default async function LiteWeatherPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; lang?: string }>;
}) {
  const allDistricts = getAllDistricts();
  const params = await searchParams;
  const requestedSlug = (params.district ?? DEFAULT_DISTRICT_SLUG).trim().toLowerCase();
  const district =
    getDistrictBySlug(requestedSlug) ??
    getDistrictBySlug(DEFAULT_DISTRICT_SLUG) ??
    allDistricts[0]!;
  const isLg = (params.lang ?? "").trim().toLowerCase() === "lg";
  const langParam = isLg ? "lg" : "en";

  const fullAppHref =
    district.slug === DEFAULT_DISTRICT_SLUG
      ? isLg
        ? "/lg?mode=full&lang=lg"
        : "/?mode=full&lang=en"
      : `/district/${encodeURIComponent(district.slug)}?mode=full&lang=${langParam}`;

  let bundle = null;
  try {
    const cached = await getCached(
      `weather:current:${district.slug}`,
      CACHE_TTL_CURRENT,
      () => getWeatherBundleForDistrict(district),
    );
    bundle = cached.data;
  } catch {
    bundle = null;
  }

  const conditionText = bundle
    ? isLg
      ? formatConditionLg(bundle.condition.text, bundle.isDay)
      : bundle.condition.text
    : "";

  const currentRainChance = bundle ? getUpcomingHourRainChance(bundle) : 0;
  const guidance = bundle ? getDailyGuidance(bundle, isLg) : null;
  const narration = bundle ? buildHomeWeatherNarration(bundle, district.name) : null;

  return (
    <div className="main-scroll h-dvh max-h-dvh w-full overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top,_rgba(13,144,59,0.18),_transparent_55%),linear-gradient(180deg,_#0f1422_0%,_#12101a_100%)] text-[#f7f4ef]">
      <main className="mx-auto max-w-md px-3 pt-4 pb-24">
        <header className="mb-3.5 flex items-center justify-between gap-1.5">
          <Link
            href={fullAppHref}
            className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label={isLg ? "Ddayo ku mukutu omujjuvu" : "Return to full Uganda Weather"}
          >
            <WeatherGlyph size={24} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="whitespace-nowrap text-[13.5px] font-semibold tracking-tight text-white">
                  Uganda Weather
                </span>
                <span className="hidden shrink-0 rounded-full bg-brand-green/80 px-2 py-0.5 text-[10px] font-semibold text-on-brand min-[390px]:inline-flex">
                  Lite
                </span>
              </div>
              <p className="hidden truncate text-[11px] text-white/65 sm:block">
                {isLg ? "Embeera y'obudde ey'amangu" : "Fast low data forecast"}
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1 text-[12px]">
            <LiteLanguageDropdown
              districtSlug={district.slug}
              lang={langParam}
            />
            {narration && (
              <LiteListenButton
                spokenTextEn={narration.en}
                spokenTextLg={narration.lg}
                language={langParam}
              />
            )}
            <Link
              href={fullAppHref}
              data-testid="lite-back-to-full"
              className="inline-flex h-9 items-center justify-center rounded-full bg-brand-green/75 px-2.5 py-1.5 font-medium whitespace-nowrap text-on-brand shadow-[0_6px_18px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl transition hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span>{isLg ? "Omukutu gwonna" : "Full app"}</span>
            </Link>
          </div>
        </header>

        <LiteDistrictPicker
          districts={allDistricts.map((item) => ({
            slug: item.slug,
            name: item.name,
          }))}
          selectedSlug={district.slug}
          lang={langParam}
        />

        <noscript>
          <form method="GET" action="/lite" className="mb-4 flex gap-2">
            <input type="hidden" name="lang" value={langParam} />
            <label htmlFor="lite-district" className="sr-only">
              {isLg ? "Londa disitulikiti" : "Select district"}
            </label>
            <select
              id="lite-district"
              name="district"
              defaultValue={district.slug}
              className="min-h-[42px] flex-1 rounded-full border border-white/[0.16] bg-[rgba(14,20,34,0.72)] px-4 py-2 text-[14px] text-white"
            >
              {allDistricts.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-[42px] rounded-full bg-brand-green px-4 py-2 text-[14px] font-semibold text-on-brand"
            >
              {isLg ? "Laba" : "Go"}
            </button>
          </form>
        </noscript>

        {bundle ? (
          <section className="space-y-3">
            <GlassPanel className="flex min-h-[212px] flex-col justify-between p-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-[22px] font-semibold leading-tight text-white">
                      {district.name}
                    </h1>
                    <p className="mt-1 text-[46px] font-light leading-none tracking-tight text-white">
                      {Math.round(bundle.temperature.celsius)}°C
                    </p>
                  </div>
                  <LiteConditionIcon
                    condition={bundle.condition.text}
                    rainChance={currentRainChance}
                    isDay={bundle.isDay}
                  />
                </div>
                <p className="mt-2 truncate text-[16px] text-white/95">{conditionText}</p>
                <p className="mt-1 text-[13px] text-white/75">
                  {isLg
                    ? `Waggulu ${Math.round(bundle.daily.high)}°C, Wansi ${Math.round(bundle.daily.low)}°C`
                    : `High ${Math.round(bundle.daily.high)}°C, Low ${Math.round(bundle.daily.low)}°C`}
                </p>
              </div>
              {guidance && (
                <p className={`mt-2.5 min-h-[38px] text-[13.5px] font-medium leading-snug ${guidance.toneClass}`}>
                  {guidance.text}
                </p>
              )}
            </GlassPanel>

            <div className="grid grid-cols-3 gap-2 text-center">
              <GlassPanel className="flex min-h-[72px] flex-col justify-center p-3">
                <p className="truncate text-[11px] font-medium text-white/70">
                  {isLg ? "Enkuba" : "Rain"}
                </p>
                <p className="mt-0.5 text-[17px] font-semibold text-white">
                  {currentRainChance}%
                </p>
              </GlassPanel>
              <GlassPanel className="flex min-h-[72px] flex-col justify-center p-3">
                <p className="truncate text-[11px] font-medium text-white/70">
                  {isLg ? "Empewo" : "Wind"}
                </p>
                <p className="mt-0.5 text-[17px] font-semibold text-white">
                  {Math.round(bundle.wind.speedKph)} km/h
                </p>
              </GlassPanel>
              <GlassPanel className="flex min-h-[72px] flex-col justify-center p-3">
                <p className="truncate text-[11px] font-medium text-white/70">
                  {isLg ? "Obunnyogovu" : "Humidity"}
                </p>
                <p className="mt-0.5 text-[17px] font-semibold text-white">
                  {Math.round(bundle.humidity)}%
                </p>
              </GlassPanel>
            </div>

            {(() => {
              const safetyAlerts = buildCommunitySafetyAlerts(bundle, isLg ? "lg" : "en");
              const topAlert = safetyAlerts[0];
              if (!topAlert) return null;
              return (
                <GlassPanel className="p-3.5">
                  <p
                    className={`text-[13px] font-semibold leading-snug ${
                      topAlert.level === "warning" ? "text-alert-red" : "text-caution"
                    }`}
                  >
                    {topAlert.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-white/85">
                    {topAlert.summary}
                  </p>
                </GlassPanel>
              );
            })()}

            {bundle.dailyForecast && bundle.dailyForecast.length > 0 && (
              <GlassPanel className="p-4">
                <h2 className="mb-2.5 text-[13px] font-semibold leading-snug text-white/75">
                  {isLg ? "Ennaku ezijja" : "Next days"}
                </h2>
                <ul className="space-y-2.5 text-[14px]">
                  {bundle.dailyForecast.slice(0, 3).map((day, idx) => {
                    const displayRainChance =
                      idx === 0 && !bundle.isDay
                        ? currentRainChance
                        : Math.round(day.rainChance ?? 0);
                    return (
                      <li
                        key={day.date ?? day.day}
                        className="grid grid-cols-[1fr_3.5rem_5.25rem] items-center gap-2"
                      >
                        <span className="truncate font-medium text-white">
                          {isLg ? formatDayLg(day.day) : day.day}
                        </span>
                        <span className="text-right tabular-nums text-white/75">
                          {displayRainChance}%
                        </span>
                        <span className="text-right font-semibold tabular-nums text-white">
                          {Math.round(day.low)}° / {Math.round(day.high)}°
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </GlassPanel>
            )}
            <GlassPanel className="space-y-3 p-4">
              <div>
                <h2 className="text-[13px] font-semibold leading-snug text-white/85">
                  {isLg ? "Gabanako obubaka bw'obudde" : "Share this forecast"}
                </h2>
                <p className="mt-0.5 text-[12.5px] leading-snug text-white/65">
                  {isLg
                    ? "Wereza obubaka bw'obudde bwa leero ku ssimu ya bulijjo oba WhatsApp."
                    : "Send today's forecast as plain text to family or neighbours."}
                </p>
              </div>
              <VillageShareBar
                message={buildPlainTextWeatherSms(bundle, isLg ? "lg" : "en")}
                language={isLg ? "lg" : "en"}
              />
            </GlassPanel>

            <GlassPanel className="space-y-3 p-4">
              <h2 className="text-[13px] font-semibold leading-snug text-white/85">
                {isLg ? "Okusoma n'endabika" : "Reading and display"}
              </h2>
              <AccessibilityControls bare language={isLg ? "lg" : "en"} />
            </GlassPanel>
          </section>
        ) : (
          <GlassPanel className="p-4">
            <p className="text-[14px] text-white/85">
              {isLg
                ? "Embeera y'obudde tesobose kufunika kati. Ddamu ogezeeko."
                : "Weather forecast is temporarily unavailable. Please try again."}
            </p>
          </GlassPanel>
        )}

        <footer className="mt-5 pt-2 text-center text-[12px] text-white/70">
          <p>
            {isLg
              ? "Uganda Weather ekozesa obubaka bw'obudde obuva mu nsibuko endala. Si mukutu mutongole ogwa UNMA."
              : "Uganda Weather uses third party forecast data. Not an official UNMA service."}
          </p>
        </footer>
      </main>
      <HybridWeatherAdvisor weather={bundle} districtName={district.name} />
    </div>
  );
}
