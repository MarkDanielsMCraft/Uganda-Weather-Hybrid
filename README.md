<p align="center">
  <img src="public/icons/icon-192.svg" alt="Uganda Weather logo" width="96" height="96" />
</p>

# Uganda Weather (Hybrid AI Edition)

Accurate, fast weather for every part of Uganda, paired with a hybrid offline and cloud Weather Safety Advisor in English and Luganda.

This repository is the standalone **Hybrid AI** edition built for [hybrid.uganda-weather.com](https://hybrid.uganda-weather.com), separate from the main `uganda-weather.com` site.

## Why I built this

In Uganda, weather is not small talk. It decides whether a family keeps their harvest, whether a fisher comes home safe, and whether a hillside road stays passable:

- **Farming depends on rain:** Over 80% of farming households in Uganda rely on rainfall instead of irrigation. Knowing the exact hours to plant, spray, or dry crops protects food and income.
- **Lake storms cost lives:** Sudden nighttime thunderstorms and strong wind gusts on Lake Victoria kill an estimated 3,000 to 5,000 fishers every year. Clear wind, gust, and storm timing across Lake Victoria, Lake Kyoga, Lake Albert, and Lake Edward helps fishers choose safe hours on the water.
- **Highland rain brings landslides and lightning:** Heavy rain around Mount Elgon and western highland trails brings recurring landslides, fog, and lightning risks.
- **Mobile data drops where help is needed most:** Regular internet access is much lower in rural districts, fishing landing sites, and mountain trails, and mobile data is expensive. A cloud only assistant stops working the moment signal disappears.

I built the **Hybrid Weather Safety Advisor** so people can load their local forecast once while they have signal, and still ask practical safety questions offline on their device in plain English or Luganda, while getting live cloud replies whenever they are online.

## How Hybrid AI works here

I used **Firebase AI Logic**, **Firebase Remote Config**, and **Firebase App Check** directly in the app:

- **Hybrid inference (`src/lib/ai/hybrid-advisor.ts`):** Calls Firebase AI Logic at runtime (`getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens })` and `getGenerativeModel(...)`) using `InferenceMode.PREFER_ON_DEVICE` online and `InferenceMode.ONLY_ON_DEVICE` offline. Replies stream live with instant stop (`AbortSignal`) and fall back cleanly to standard generation if a stream drops.
- **Firebase Remote Config (`src/lib/ai/remote-config.ts`, `remoteconfig.template.json`):** Lets me change `advisor_enabled`, `advisor_cloud_model`, `advisor_max_output_tokens`, and `advisor_prefer_on_device` live without shipping a new build, with safe offline defaults.
- **Firebase App Check (`src/lib/ai/firebase-client.ts`):** Protects requests using `ReCaptchaEnterpriseProvider`, single use replay protected tokens (`useLimitedUseAppCheckTokens`), and debug token support for local testing.
- **Grounded, guarded, and bilingual (`src/lib/ai/advisor-prompt.ts`, `src/lib/ai/advisor-guard.ts`):**
  - Grounds every answer in live or locally saved weather (`src/lib/offline/weather-cache.ts`) and states exact Uganda local time (`EAT`) when using cached data.
  - Identifies the exact location type before calling the model (National Park, Mountain peak, Airport, Exact GPS location, Village or town, City, or District) so places like Mount Elgon or a village are never called a district.
  - Supports cross district questions and spelling fixes (for example matching `"What of Bukoma"` to Bukomansimbi).
  - Handles English and Luganda, including switching languages mid chat.
  - Blocks prompt injection, exploit payloads, phishing links, spam floods, and internal prompt leakage, backed by explicit model `safetySettings` and a sliding window rate limiter.

## What existed before vs. what I built for this submission

Because Uganda Weather already existed before Nov 11, 2026, here is a clear split of what was already built and what I created specifically during the submission period (Nov 11 to Nov 30, 2026).

| Area | What existed before (prior to Nov 11, 2026) | What I built for this submission (Nov 11 to Nov 30, 2026) |
|---|---|---|
| **AI and Firebase** | None. The app had no AI assistant, no Firebase AI Logic, no Firebase Remote Config, and no Firebase App Check. | Full **Hybrid Weather Safety Advisor** powered by Firebase AI Logic (`PREFER_ON_DEVICE` online, `ONLY_ON_DEVICE` offline), Firebase Remote Config (`advisor_enabled`, `advisor_cloud_model`, `advisor_max_output_tokens`, `advisor_prefer_on_device`), and Firebase App Check with single use replay protected tokens (`useLimitedUseAppCheckTokens`). |
| **Chat UI and Runtime Inspector** | None. | Floating brand green glass chat launcher and panel (`src/components/advisor/HybridWeatherAdvisor.tsx`) with geography aware quick actions, streaming replies with instant stop, post reply model attribution, and an expandable status panel with an `Online` / `Offline` switch. |
| **Grounding and Safety** | District weather API, three tier fallback chain, and local district cache (`src/lib/offline/weather-cache.ts`). | Context grounding in live and cached forecasts with exact Uganda local times (`EAT`), 7 way location type detection (National Park, Mountain peak, Airport, Exact GPS location, Village or town, City, District), cross district lookup with spelling correction (`"What of Bukoma"` to Bukomansimbi), mid chat English and Luganda switching, explicit model `safetySettings`, prompt injection and exploit blocking, output leakage filter, and sliding window rate limiting (`src/lib/ai/advisor-prompt.ts`, `src/lib/ai/advisor-guard.ts`). |
| **Core Weather Platform** | Forecasts for all 152 districts plus villages and towns, four lake fishing safety modules, agriculture calendars, national parks, mountain summits, airport METAR, English and Luganda UI, and Capacitor 7 mobile shells. | Site wide usability and visual upgrades: uniform card typography, divider free glass cards and sheets, floating bold red severe weather warning pill, stronger text contrast over bright skies, accessible glass dropdown (`GlassSelect`), and clickable parks, mountains, airports, lake shorelines, and nearby districts. |
| **Tests** | Existing unit and E2E tests for core weather routes and tiles. | Full unit and component test suites for the hybrid AI engine, Remote Config, security guards, location classifier, unit formatting, and advisor UI (`src/lib/ai/*.test.ts`, `src/components/advisor/HybridWeatherAdvisor.test.tsx`). |

**Core value the existing platform brings:** Instead of a generic chatbot guessing weather from training data, the existing Uganda Weather platform supplies live and locally cached forecasts for all 152 districts and villages, known district hazard lists, lake safety data, and bilingual English and Luganda labels that ground every hybrid AI answer in real local facts.

## Try it locally

```bash
pnpm install
cp .env.example .env.local
```

Add your Firebase Web SDK keys to `.env.local`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- Optional: `NEXT_PUBLIC_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY` or `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=true` for App Check, and `NEXT_PUBLIC_FIREBASE_AI_MODEL` for the default cloud fallback model.
- Optional: `WEATHERAPI_KEY` for primary weather data (without it, the app falls back to Open-Meteo, which needs no key).

Start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), tap the green chat bubble at the bottom right, and tap the status pill (`Cloud` or `On device`) in the chat header to switch between `Online` and `Offline` mode directly, or switch your browser to Offline in DevTools to test on device Gemini Nano against your locally saved forecast.

## Quality checks

Run the full check suite locally before opening a pull request:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm guards
```

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, Framer Motion
- **Hybrid AI:** Firebase AI Logic (`firebase/ai`), Firebase Remote Config (`firebase/remote-config`), Firebase App Check (`firebase/app-check`)
- **Backend and caching:** Next.js API routes with Upstash Redis (in memory fallback in development)
- **Weather and place data:** WeatherAPI.com, Open-Meteo, Pirate Weather, OpenWeatherMap (air quality), Visual Crossing (historical averages), NOAA Aviation Weather Center (airport METAR), OpenData Uganda v1 (villages and towns), RainViewer (radar), MapTiler and Stadia Maps
- **Mobile shells:** Capacitor 7 for Android and iOS with six home screen widgets
- **API contract:** [`openapi.yaml`](./openapi.yaml)

## Native mobile builds

The mobile shells load the hosted web app over HTTPS:

```bash
CAPACITOR_SERVER_URL=https://hybrid.uganda-weather.com pnpm cap:prepare
CAPACITOR_SERVER_URL=https://hybrid.uganda-weather.com pnpm cap:add:android
CAPACITOR_SERVER_URL=https://hybrid.uganda-weather.com pnpm cap:add:ios
```

Device signing, push credentials, and platform service config are supplied by the release environment and are never committed to this repo.

## Project structure

```
uganda-weather/
├── data/districts/     # Uganda district dataset and centroid cache
├── scripts/            # Dataset build and guard scripts
├── openapi.yaml        # API contract
└── src/                # Next.js app and Hybrid AI Weather Safety Advisor
```

## Contributing, Security, and License

- Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Security: [`SECURITY.md`](./SECURITY.md)
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
- License: [MIT](./LICENSE)

Built by [MCraft](https://www.mcraftportfolio.dev/).
