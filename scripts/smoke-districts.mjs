#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const SMOKE_DISTRICTS = [
  "kampala",
  "jinja",
  "mbarara",
  "gulu",
  "entebbe",
  "wakiso",
  "kalangala",
  "moroto",
  "arua",
  "mbale",
  "masaka",
  "fort-portal-city",
  "lira",
  "hoima",
  "kasese",
  "soroti",
  "mukono",
  "tororo-city",
  "bughendera",
  "mubende",
  "kitgum",
  "kabale",
];

async function checkDistrict(slug) {
  const url = `${BASE_URL}/api/v1/weather/current?district=${encodeURIComponent(slug)}`;
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const snippet = (await response.text()).slice(0, 80);
    throw new Error(`${slug}: HTTP ${response.status}, expected JSON (${snippet})`);
  }

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${slug}: HTTP ${response.status} ${body?.error?.message ?? ""}`.trim());
  }

  const data = body.data;
  if (!data?.district?.slug || !data?.temperature?.celsius) {
    throw new Error(`${slug}: missing bundle fields`);
  }

  if (data.district.slug !== slug) {
    throw new Error(`${slug}: district slug mismatch (${data.district.slug})`);
  }

  const hours = (data.hourly ?? []).filter((point) => point.kind === "hour");
  if (hours.length < 8) {
    throw new Error(`${slug}: expected at least 8 hourly points, got ${hours.length}`);
  }

  for (const [index, hour] of hours.entries()) {
    if (!Number.isFinite(hour.temp)) {
      throw new Error(`${slug}: hourly[${index}] missing temperature`);
    }
    if (!hour.icon && !hour.theme) {
      throw new Error(`${slug}: hourly[${index}] missing icon and theme`);
    }
  }

  return {
    slug,
    name: data.district.name,
    temp: data.temperature.celsius,
    source: data.source,
    updatedAt: data.updatedAt,
    localTime: data.localTime,
  };
}

function parseUgandaLocalTime(value) {
  const normalized = value.trim().replace(" ", "T");
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  return new Date(`${normalized}+03:00`);
}

function ugandaNowMs() {
  return Date.now();
}

async function checkUgandaClockSanity() {
  const result = await checkDistrict("kampala");
  if (!result.localTime) {
    throw new Error("kampala: missing localTime");
  }

  if (!/^\d{4}-\d{2}-\d{2}T/.test(result.updatedAt ?? "")) {
    throw new Error(`kampala: updatedAt should be ISO, got ${result.updatedAt}`);
  }

  const apiMs = parseUgandaLocalTime(result.localTime).getTime();
  const driftMinutes = Math.abs(apiMs - ugandaNowMs()) / 60_000;
  if (driftMinutes > 20) {
    throw new Error(
      `kampala: localTime ${result.localTime} is ${Math.round(driftMinutes)} min from Uganda now`,
    );
  }
}

async function checkDistinctRegions() {
  const kampala = await checkDistrict("kampala");
  const gulu = await checkDistrict("gulu");
  if (kampala.temp === gulu.temp && kampala.source === gulu.source) {
    console.warn(
      `Warning: kampala and gulu returned the same temperature (${kampala.temp}°). This can happen, but verify provider data.`,
    );
  }
}

async function main() {
  console.log(`Smoke testing ${SMOKE_DISTRICTS.length} districts against ${BASE_URL}`);

  const health = await fetch(`${BASE_URL}/api/health`);
  if (!health.ok) {
    console.warn(`Warning: /api/health returned ${health.status}`);
  } else {
    const info = await health.json();
    console.log(`Health: ${info.status}, districts=${info.districts}, weatherapi=${info.providers?.weatherapi}`);
    if ((info.districts ?? 0) < 150) {
      throw new Error(`expected at least 150 districts, got ${info.districts}`);
    }
  }

  const results = [];
  const failures = [];

  for (const slug of SMOKE_DISTRICTS) {
    try {
      const result = await checkDistrict(slug);
      results.push(result);
      console.log(`  ok  ${result.name} (${result.temp}°, ${result.source})`);
    } catch (error) {
      failures.push({ slug, error: error instanceof Error ? error.message : String(error) });
      console.error(`  fail ${slug}: ${failures.at(-1).error}`);
    }
  }

  console.log(`\nPassed ${results.length}/${SMOKE_DISTRICTS.length}`);

  try {
    await checkDistinctRegions();
    console.log("  ok  regional sanity check");
  } catch (error) {
    failures.push({
      slug: "regions",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`  fail regions: ${failures.at(-1).error}`);
  }

  try {
    await checkUgandaClockSanity();
    console.log("  ok  Uganda clock sanity");
  } catch (error) {
    failures.push({
      slug: "uganda-clock",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`  fail uganda-clock: ${failures.at(-1).error}`);
  }

  try {
    const searchResponse = await fetch(`${BASE_URL}/api/v1/locations/search?q=${encodeURIComponent("kyaziiza")}`);
    if (!searchResponse.ok) {
      throw new Error(`locations search HTTP ${searchResponse.status}`);
    }
    const searchBody = await searchResponse.json();
    const hits = searchBody.data?.results ?? [];
    const placeHits = hits.filter((hit) => hit.kind === "place");
    if (placeHits.length < 1) {
      throw new Error("expected Kyaziiza place results");
    }
    const bukomansimbi = placeHits.find(
      (hit) =>
        hit.label?.toLowerCase().includes("bukomansimbi") ||
        hit.parentDistrictSlug === "bukomansimbi",
    );
    if (!bukomansimbi) {
      throw new Error("expected Kyaziiza in Bukomansimbi from official locality data");
    }
    console.log(`  ok  place search (Kyaziiza, Bukomansimbi verified)`);
  } catch (error) {
    failures.push({
      slug: "place-search",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`  fail place-search: ${failures.at(-1).error}`);
  }

  try {
    const districtResponse = await fetch(`${BASE_URL}/api/v1/districts/kampala`);
    if (!districtResponse.ok) throw new Error(`district detail HTTP ${districtResponse.status}`);
    const districtBody = await districtResponse.json();
    if (districtBody.data?.district?.slug !== "kampala") {
      throw new Error("district detail missing kampala slug");
    }

    const forecastResponse = await fetch(`${BASE_URL}/api/v1/weather/forecast?district=kampala&days=5`);
    if (!forecastResponse.ok) throw new Error(`forecast HTTP ${forecastResponse.status}`);
    const forecastBody = await forecastResponse.json();
    if ((forecastBody.data?.dailyForecast?.length ?? 0) < 1) {
      throw new Error("forecast missing dailyForecast");
    }

    const airResponse = await fetch(`${BASE_URL}/api/v1/air-quality?district=kampala`);
    if (!airResponse.ok) throw new Error(`air-quality HTTP ${airResponse.status}`);
    const airBody = await airResponse.json();
    if (!airBody.data?.airQuality?.category) {
      throw new Error("air-quality missing category");
    }
    if (typeof airBody.data?.uvIndex !== "number") {
      throw new Error("air-quality missing uvIndex");
    }

    const agResponse = await fetch(`${BASE_URL}/api/v1/agriculture/advisory?district=kampala`);
    if (!agResponse.ok) throw new Error(`agriculture advisory HTTP ${agResponse.status}`);
    const agBody = await agResponse.json();
    if (!agBody.data?.season?.label || !agBody.data?.cropAdvisories?.length) {
      throw new Error("agriculture advisory missing season or crop advisories");
    }

    const marineResponse = await fetch(`${BASE_URL}/api/v1/marine/lake-victoria?shore=jinja`);
    if (!marineResponse.ok) throw new Error(`marine lake HTTP ${marineResponse.status}`);
    const marineBody = await marineResponse.json();
    if (!marineBody.data?.fishingSafety?.label) {
      throw new Error("marine lake missing fishingSafety");
    }

    console.log("  ok  district detail, forecast, air-quality, agriculture, and marine routes");

    const reverseResponse = await fetch(
      `${BASE_URL}/api/v1/locations/reverse?lat=0.3136&lon=32.5811`,
    );
    if (!reverseResponse.ok) throw new Error(`reverse HTTP ${reverseResponse.status}`);
    const reverseBody = await reverseResponse.json();
    if (!reverseBody.data?.place?.lat || !reverseBody.data?.place?.parentDistrictSlug) {
      throw new Error("reverse missing place fields");
    }
    console.log("  ok  reverse location lookup");
  } catch (error) {
    failures.push({
      slug: "api-contract",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`  fail api-contract: ${failures.at(-1).error}`);
  }

  try {
    const smokeToken = "smoke-test-token-placeholder-01";
    const pushResponse = await fetch(`${BASE_URL}/api/v1/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
      body: JSON.stringify({
        token: smokeToken,
        platform: "ios",
        districtSlug: "kampala",
      }),
    });
    if (!pushResponse.ok) {
      throw new Error(`push register HTTP ${pushResponse.status}`);
    }
    const pushBody = await pushResponse.json();
    if (!pushBody.data?.accepted) {
      throw new Error("push register did not accept payload");
    }

    const dispatchResponse = await fetch(`${BASE_URL}/api/v1/push/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        districtSlug: "kampala",
        title: "Storm watch",
        body: "Smoke test alert for Kampala.",
        dryRun: true,
      }),
    });
    if (!dispatchResponse.ok) {
      throw new Error(`push dispatch HTTP ${dispatchResponse.status}`);
    }
    const dispatchBody = await dispatchResponse.json();
    if (!dispatchBody.data?.dryRun || (dispatchBody.data?.targeted ?? 0) < 1) {
      throw new Error("push dispatch dry-run did not target registered token");
    }

    const unregisterResponse = await fetch(`${BASE_URL}/api/v1/push/register`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
      body: JSON.stringify({ token: smokeToken }),
    });
    if (!unregisterResponse.ok) {
      throw new Error(`push unregister HTTP ${unregisterResponse.status}`);
    }
    const unregisterBody = await unregisterResponse.json();
    if (!unregisterBody.data?.removed) {
      throw new Error("push unregister did not remove token");
    }

    console.log("  ok  push register endpoint");

    const alertsPrefetchResponse = await fetch(`${BASE_URL}/api/v1/cron/prefetch-alerts`, {
      headers: process.env.CRON_SECRET
        ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {},
    });
    if (!alertsPrefetchResponse.ok) {
      throw new Error(`prefetch-alerts HTTP ${alertsPrefetchResponse.status}`);
    }
    const alertsPrefetchBody = await alertsPrefetchResponse.json();
    if (typeof alertsPrefetchBody.data?.requested !== "number") {
      throw new Error("prefetch-alerts missing requested count");
    }
    console.log("  ok  alerts prefetch cron");

    const dispatchCronResponse = await fetch(`${BASE_URL}/api/v1/cron/dispatch-alerts`, {
      headers: process.env.CRON_SECRET
        ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {},
    });
    if (!dispatchCronResponse.ok) {
      throw new Error(`dispatch-alerts HTTP ${dispatchCronResponse.status}`);
    }
    const dispatchCronBody = await dispatchCronResponse.json();
    if (dispatchCronBody.data?.dryRun !== true) {
      throw new Error("dispatch-alerts should dry-run when PUSH_DISPATCH_LIVE is not set");
    }
    console.log("  ok  alert dispatch cron (dry-run)");

    const agriculturePrefetchResponse = await fetch(`${BASE_URL}/api/v1/cron/prefetch-agriculture`, {
      headers: process.env.CRON_SECRET
        ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {},
    });
    if (!agriculturePrefetchResponse.ok) {
      throw new Error(`prefetch-agriculture HTTP ${agriculturePrefetchResponse.status}`);
    }
    const agriculturePrefetchBody = await agriculturePrefetchResponse.json();
    if (typeof agriculturePrefetchBody.data?.requested !== "number") {
      throw new Error("prefetch-agriculture missing requested count");
    }
    console.log("  ok  agriculture prefetch cron");

    const airQualityPrefetchResponse = await fetch(`${BASE_URL}/api/v1/cron/prefetch-air-quality`, {
      headers: process.env.CRON_SECRET
        ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
        : {},
    });
    if (!airQualityPrefetchResponse.ok) {
      throw new Error(`prefetch-air-quality HTTP ${airQualityPrefetchResponse.status}`);
    }
    const airQualityPrefetchBody = await airQualityPrefetchResponse.json();
    if (typeof airQualityPrefetchBody.data?.requested !== "number") {
      throw new Error("prefetch-air-quality missing requested count");
    }
    console.log("  ok  air quality prefetch cron");
  } catch (error) {
    failures.push({
      slug: "push-register",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`  fail push-register: ${failures.at(-1).error}`);
  }

  try {
    const alertsApiResponse = await fetch(`${BASE_URL}/api/v1/alerts?district=kampala`);
    if (!alertsApiResponse.ok) throw new Error(`alerts API HTTP ${alertsApiResponse.status}`);
    const alertsApiBody = await alertsApiResponse.json();
    if (!Array.isArray(alertsApiBody.data?.alerts)) {
      throw new Error("alerts API missing alerts array");
    }

    const radarResponse = await fetch(`${BASE_URL}/api/v1/radar/frames`);
    if (!radarResponse.ok) throw new Error(`radar frames HTTP ${radarResponse.status}`);
    const radarBody = await radarResponse.json();
    if (!radarBody.data?.radar) {
      throw new Error("radar frames missing radar payload");
    }

    const manifestResponse = await fetch(`${BASE_URL}/manifest.webmanifest`);
    if (!manifestResponse.ok) throw new Error(`manifest HTTP ${manifestResponse.status}`);
    const manifestBody = await manifestResponse.json();
    if (!manifestBody.name || !manifestBody.icons?.length) {
      throw new Error("manifest missing name or icons");
    }

    const districtPageResponse = await fetch(`${BASE_URL}/district/kampala`);
    if (!districtPageResponse.ok) throw new Error(`district page HTTP ${districtPageResponse.status}`);
    const districtHtml = await districtPageResponse.text();
    if (!districtHtml.includes("Kampala")) {
      throw new Error("district page missing Kampala in HTML");
    }

    for (const path of ["/search", "/terms", "/cookies", "/privacy"]) {
      const pageResponse = await fetch(`${BASE_URL}${path}`);
      if (!pageResponse.ok) throw new Error(`${path} HTTP ${pageResponse.status}`);
    }

    const weatherPrefetchResponse = await fetch(
      `${BASE_URL}/api/v1/cron/prefetch-weather?mode=priority`,
      {
        headers: process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {},
      },
    );
    if (!weatherPrefetchResponse.ok) {
      throw new Error(`prefetch-weather HTTP ${weatherPrefetchResponse.status}`);
    }
    const weatherPrefetchBody = await weatherPrefetchResponse.json();
    if (typeof weatherPrefetchBody.data?.requested !== "number") {
      throw new Error("prefetch-weather missing requested count");
    }

    console.log("  ok  alerts API, radar, manifest, district page, static routes, weather prefetch");
  } catch (error) {
    failures.push({
      slug: "production-paths",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`  fail production-paths: ${failures.at(-1).error}`);
  }

  try {
    await import("node:child_process").then(({ execSync }) => {
      execSync("node scripts/verify-unma-feed.mjs", {
        stdio: "inherit",
        env: { ...process.env, BASE_URL },
      });
    });
  } catch {
    failures.push({ slug: "unma-feed", error: "UNMA CAP feed verification failed" });
  }

  try {
    await import("node:child_process").then(({ execSync }) => {
      execSync("node scripts/verify-styles.mjs", {
        stdio: "inherit",
        env: { ...process.env, BASE_URL },
      });
    });
  } catch {
    failures.push({ slug: "styles", error: "Style verification failed" });
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
