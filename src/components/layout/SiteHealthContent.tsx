"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { formatUgandaClock } from "@/lib/time/uganda";
import { getWeatherProvider, getWeatherProviderInfo } from "@/lib/weather/source";
import type { WeatherBundle } from "@/types/weather";

interface ConnectivityProvider {
  key: string;
  configured: boolean;
  reachable: boolean;
}

interface ConnectivityResponse {
  checkedAt: string;
  stale: boolean;
  providers: ConnectivityProvider[];
}

async function fetchConnectivity(): Promise<ConnectivityResponse> {
  const response = await fetch("/api/health/connectivity");
  if (!response.ok) throw new Error("Connectivity check failed");
  return response.json();
}

const WEATHER_CHAIN: Array<{ provider: ReturnType<typeof getWeatherProvider>; key: string; label: string }> = [
  { provider: "weatherapi", key: "weatherapi", label: "WeatherAPI.com" },
  { provider: "open-meteo", key: "openMeteo", label: "Open-Meteo" },
  { provider: "pirateweather", key: "pirateWeather", label: "Pirate Weather" },
];

const OTHER_SERVICES = [
  { key: "rainViewer", label: "RainViewer" },
  { key: "mapTiler", label: "MapTiler" },
  { key: "stadiaMaps", label: "Stadia Maps" },
  { key: "openWeatherMap", label: "OpenWeatherMap" },
  { key: "visualCrossing", label: "Visual Crossing" },
  { key: "unmaCap", label: "UNMA CAP feed" },
];

function StatusDot({ tone }: { tone: "active" | "reachable" | "unreachable" | "off" }) {
  const color =
    tone === "active"
      ? "bg-[#1B8A7A]"
      : tone === "reachable"
        ? "bg-[#5ac8fa]"
        : tone === "unreachable"
          ? "bg-[#E07A5F]"
          : "bg-white/15";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

/** Opened from the footer's status dot. Shows which weather provider is
    actually serving the current bundle (a real signal — the bundle
    already carries its own source), plus a live reachability probe
    against every other configured service's own host, refreshed from
    /api/health/connectivity (cached ~60s server-side so repeat opens
    don't re-probe every provider). The probes are plain GETs to each
    provider's domain root, never a metered/billed endpoint, so checking
    status here never costs quota. */
export function SiteHealthContent({ weather }: { weather?: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const labels = dict.sheets.siteHealth;

  function statusLabel(provider: ConnectivityProvider | undefined, isActive: boolean) {
    if (isActive) return labels.statusActive;
    if (!provider) return labels.statusChecking;
    if (!provider.configured) return labels.statusNotConfigured;
    return provider.reachable ? labels.statusReachable : labels.statusUnreachable;
  }

  // The sheet this lives in fully unmounts on close and remounts fresh on
  // every open (it isn't kept alive in the background), so a mount-time
  // fetch here already means "fetch fresh each time you open Site
  // Health" — staleTime 0 just makes that explicit rather than relying on
  // an unstated default. The short-lived server cache in the route itself
  // is the only thing standing between this and a live probe every time.
  const { data, isPending, isError, dataUpdatedAt } = useQuery({
    queryKey: ["site-health-connectivity"],
    queryFn: fetchConnectivity,
    staleTime: 0,
  });

  const activeProvider = weather ? getWeatherProvider(weather.source) : undefined;
  const activeInfo = weather ? getWeatherProviderInfo(weather.source, uiLanguage) : undefined;
  const byKey = new Map(data?.providers.map((provider) => [provider.key, provider]));

  return (
    <div>
      {weather && activeInfo && (
        <div className="mb-4">
          <p className="text-[13px] text-white/50">{labels.showingLabel}</p>
          <p className="mt-1 text-[20px] font-medium text-white">{activeInfo.description}</p>
        </div>
      )}

      <div className="space-y-1">
        <p
          className={
            uiLanguage === "lg"
              ? "text-[13px] font-semibold text-white/60"
              : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
          }
        >
          {labels.weatherChainTitle}
        </p>
        {isPending && <p className="mt-2 text-[14px] text-white/50">{labels.checkingConnectivity}</p>}
        {isError && <p className="mt-2 text-[14px] text-white/50">{labels.checkFailed}</p>}
        {data &&
          WEATHER_CHAIN.map((tier) => {
            const isActive = activeProvider === tier.provider;
            const provider = byKey.get(tier.key);
            const tone = isActive ? "active" : !provider?.configured ? "off" : provider.reachable ? "reachable" : "unreachable";
            return (
              <div key={tier.provider} className="flex items-center justify-between py-2 text-[14px]">
                <span className="flex items-center gap-2 text-white/85">
                  <StatusDot tone={tone} />
                  {tier.label}
                </span>
                <span className="text-[13px] text-white/50">{statusLabel(provider, isActive)}</span>
              </div>
            );
          })}
      </div>

      <div className="mt-4 space-y-1 pt-3">
        <p
          className={
            uiLanguage === "lg"
              ? "text-[13px] font-semibold text-white/60"
              : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
          }
        >
          {labels.otherServicesTitle}
        </p>
        {data &&
          OTHER_SERVICES.map((service) => {
            const provider = byKey.get(service.key);
            const tone = !provider?.configured ? "off" : provider.reachable ? "reachable" : "unreachable";
            return (
              <div key={service.key} className="flex items-center justify-between py-2 text-[14px]">
                <span className="flex items-center gap-2 text-white/85">
                  <StatusDot tone={tone} />
                  <span>
                    {service.label}
                    <span className="ml-1.5 text-[13px] text-white/45">
                      {labels.serviceRoles[service.key] ?? service.key}
                    </span>
                  </span>
                </span>
                <span className="text-[13px] text-white/50">{statusLabel(provider, false)}</span>
              </div>
            );
          })}
      </div>

      {data && (
        <p className="mt-4 pt-3 text-[12px] text-white/40">
          {labels.checkedAt.replace("{time}", formatUgandaClock(new Date(dataUpdatedAt), true, uiLanguage))}
          {data.stale ? labels.briefCache : ""}.
        </p>
      )}
    </div>
  );
}
