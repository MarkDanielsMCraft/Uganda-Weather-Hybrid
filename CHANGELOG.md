# Changelog

All notable changes to Uganda Weather are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- Place names looked up from the map now also refuse number words, contact words (phone, hotline, M-Pesa), and "evil/com" style addresses, while real names such as SOS, Zoo, Ring Road, Solo, and Bolo are accepted. A slow name lookup can no longer rename a different place opened just after it, and the server import test now follows re-exports.
- A place name typed into someone else's link is never shown. The place opens as "Shared place" near its district and its name is looked up on our own server from the point on the map. Places a person chose in the app keep their names. The AI is told that the place name is a name, never an instruction. Short scam words are matched as whole words, and words made of digit lookalike letters (such as "OOO") are refused.
- Place names and labels from links and saved settings now go through an allow list: Latin letters (including ŋ), spaces, apostrophes, hyphens, commas, full stops, and brackets, with at most two digits. Hidden characters are removed first, joined up and spaced out scam words in English and Luganda are caught, and web address shapes are refused. This closes the hidden character, other alphabet, and lookalike digit tricks found in the third attack pass.
- Farming advice for a shared place is built for each visitor from their own place, so it can no longer carry the name another visitor sent. Place labels are no longer sent to the AI advisor.
- Alert routes with encoded characters are refused, broken map service replies count as busy, and identical searches during a busy spell share one unsaved list.
- A shared link can no longer plant scam text in someone's saved place, their SMS shares, or the AI advisor. Place names from links and from saved settings are folded to plain characters and checked for links, web addresses, phone numbers, calls to act, and length, and anything that fails shows as "Shared place". Saved places are checked again when the app loads.
- Made up place names can no longer skip the weather cache to spend paid weather calls. Weather for a place is saved by its point (rounded to about 1 km) and the requested name is added back afterwards. The memory cache now drops the least used entries first.
- Map service refusals, errors, and timeouts are no longer saved as rough answers, and village lists with rough points made while the map service was busy are not saved.
- The push dispatch route checks its secret before reading the request, and alert routes with `.` or `..` parts open the alerts page.
- A storm alert can only open pages inside the app. Routes such as `//other.site` now open the alerts page instead.
- The Luganda feedback form takes at most 200 reports a day across the whole app, and server memory keeps only the newest 500, so a flood cannot fill the inbox or the server.
- The HTTPS only header now also covers subdomains.
- Nobody can make a real looking Uganda Weather link preview image with their own words, such as a fake evacuation order. The `/api/og` route that drew any title and subtitle from the address is gone.
- Storm alert sign ups can no longer be flooded with made up tokens. One address can sign up 10 times an hour, tokens must look like real phone tokens, the store stops taking new tokens at 100,000, alerts go out in groups of 50, and phones that Android or Apple report as gone are removed.
- The public health page now only says the app is up, its version, and the number of districts. It no longer lists which services are set up, whether Redis is on, or how many phones signed up for alerts.
- Village search can no longer get the app blocked by the free map service. All map lookups wait in one queue that lets one through about every second, a full queue answers at once with the district's location (and that rough answer is not saved), each village takes at most two lookups, and the place search routes allow 60 requests a minute from one address.
- Nobody can plant a fake place name, wrong location, or scam phone number in the saved forecast that other people see. The saved copy for a place is now tied to every detail in the request, place names and labels with phone numbers, links, emails, or markup are refused, and place text is cleaned again before it reaches the AI advisor. The server keeps at most 5,000 saved copies in memory.
- Rate limits can no longer be dodged by changing the district name in the address: all district detail pages share one count, only the first four path parts form the key, at most 20,000 keys are kept, and the memory sweep runs at most every 10 seconds.
- Paid voice calls have a monthly ceiling per route (`VOICE_MONTHLY_BUDGET`, 20,000 by default; cached clips do not count). A script that fakes browser headers can no longer run up an unlimited voice bill; once the ceiling is reached the app falls back to the browser voice.
- The same site check trusts the real Host header before X-Forwarded-Host, which a client can forge.
- Paid voice routes and data writing routes (`/api/v1/voice/speak`, `/voice/translate`, `/voice/transcribe`, `/feedback/luganda`, `/observability/advisor-error`, `/push/register`) refuse requests that the browser marks as coming from another website (`rejectCrossSiteRequest` in `src/lib/api/route-utils.ts`), so other sites cannot spend this app's voice and AI quota.
- The speak route only sends English to the Luganda voice service when `VOICE_ENGLISH_CLOUD_ENABLED=true`, closing a path that let anyone use that paid key for English.
- Cron and push dispatch secrets are compared in constant time (`src/lib/api/bearer-secret.ts`).
- National ID redaction before cloud calls now also catches lowercase ID numbers.
- Android widget data now arrives through the `WidgetData` Capacitor plugin, which Capacitor only accepts from the main page of the app's allowed sites. The old `WidgetBridge` JavaScript interface, which also accepted calls from embedded frames, is removed from the app. The website still calls it as a fallback for app builds already installed on phones.
- Added a CodeQL workflow that scans the web app and the Android source on pushes, pull requests, and weekly.
- Added automatic dependency updates (`.github/dependabot.yml`) for the web packages (daily), Android build tooling, and workflow actions (weekly), all aimed at `dev`.

### Added

- When the cloud model fails or returns nothing while online, the Weather Advisor answers with the same forecast based summary instead of an error, with a short note that the AI could not answer just then (`src/lib/ai/hybrid-advisor.ts`, `src/lib/ai/offline-briefing.ts`). Failures are still logged and reported.
- Browser tests for the offline saved forecast answer (`e2e/advisor-offline.spec.ts`) and for full words on `/lite` at 240x320 in English and Luganda (`e2e/lite-small-screen.spec.ts`).
- Every phone now gets an offline answer. When there is no internet and no on device model, or someone asks in Luganda while offline, the Weather Advisor answers with a safety summary built only from the saved forecast, clearly labelled `Saved forecast` / `Obudde obuterekeddwa` (`src/lib/ai/offline-briefing.ts`).
- `WEATHER_PRIMARY_PROVIDER` setting (`weatherapi` by default, or `open-meteo`) to choose which forecast provider is asked first; the other becomes the backup, then Pirate Weather (`src/lib/weather/provider.ts`).
- `API_RATE_LIMIT_PER_MINUTE` setting for the per route, per address request limit.
- The floating advisor button steps aside while people scroll down to read and returns when they scroll up (`src/hooks/useHideOnScrollDown.ts`).
- Browser tests for SMS sharing on phones and computers (`e2e/share-sms.spec.ts`) and unit tests for the offline summary, voice routing, rate limits, scene capability, and the speak route.
- Accessibility display controls (`AccessibilityControls.tsx` in `src/components/settings/`) adding persistent `Large text` and `High contrast` toggles across the home settings tile, search page, and `/lite` without resizing cards or shifting brand colours.
- Community safety advisories (`src/lib/weather/community-safety.ts`) derived from existing forecast data: daytime High UV sun protection (covering outdoor workers, children, and persons with albinism), Karamoja and cattle corridor pastoralist livestock heat and water watch, and a 72 hour mountain slope landslide watch across mountain and landslide hazard districts.
- Plain text SMS and WhatsApp forecast sharing (`src/lib/places/sms-share.ts` and `src/components/settings/VillageShareBar.tsx`) on `/lite` and completed Advisor replies so smartphone and feature phone users can forward daily forecasts and safety verdicts to neighbours on 2G basic phones with zero paid messaging APIs.
- Offline parish and village search cache plus a bundled directory of major Ugandan towns and trading centres (`src/lib/places/offline-place-cache.ts`) wired into both top bar and search page autocomplete.
- Pipelined sentence chunked neural voice playback (`src/lib/voice/narrator.ts`, `src/lib/ai/advisor-voice.ts`, `src/lib/voice/sunbird.ts`) reducing spoken playback startup latency while preventing overlapping voices and enforcing standard Luganda orthography (`Empandiika y'Oluganda Entongole`).
- Privacy Shield for the Hybrid Weather Advisor (`redactPiiForCloud` in `src/lib/ai/advisor-guard.ts` and verified canvas EXIF APP1 stripping in `src/lib/ai/advisor-image.ts`) that redacts accidental phone numbers, emails, and national IDs before cloud calls and strips GPS/camera metadata from photos on device.
- Native client side Firebase AI Logic Neural TTS (`src/lib/ai/firebase-tts.ts` using `gemini-3.1-flash-tts-preview` and `ResponseModality.AUDIO`), Firebase AI Logic Server Prompt Templates (`src/lib/ai/template-advisor.ts` via `getTemplateGenerativeModel`), and native `Schema.object` structured output definitions (`ADVISOR_STRUCTURED_OUTPUT_SCHEMA` in `src/lib/ai/advisor-tools.ts`), all dynamically controlled through Firebase Remote Config (`remoteconfig.template.json`).
- Hands free Voice Companion Mode (`voiceMode` in `src/stores/preferencesStore.ts`) and Universal Page and Sheet Narrator (`src/lib/voice/narrator.ts`) delivering natural spoken briefings in English and standard Luganda across the home screen, Lite mode (`src/components/settings/LiteListenButton.tsx`), all detail sheets (`src/components/sheet/DetailSheet.tsx`), and automatic spoken replies in the Weather Safety Advisor.
- Agent driven dynamic safety verdicts (`[VERDICT: ...]`), contextual follow up questions (`[FOLLOWUPS: ...]`), live data source attribution, and a live camera viewfinder modal (`getUserMedia`) differentiated from photo file uploads in the Weather Safety Advisor (`src/components/advisor/HybridWeatherAdvisor.tsx`, `src/lib/ai/advisor-prompt.ts`, `src/lib/ai/advisor-tools.ts`).
- Six hour agricultural work windows (`computeFarmWorkWindows` in `src/lib/agriculture/advisory.ts`) for post harvest sun drying (`okwanika`) and crop spraying (`okufuuyira`), plus a six hour lake squall lookahead (`computeFishingSafety` in `src/lib/marine/lake-conditions.ts`) across Lake Victoria, Lake Kyoga, Lake Albert, and Lake Edward.
- One tap Lite mode button (`src/components/settings/LiteHeaderButton.tsx`) in the mobile and desktop top bars with bidirectional language and mode synchronization (`src/components/layout/DistrictQuerySync.tsx`).
- Hybrid offline and cloud Weather Safety Advisor (`src/lib/ai/` and `src/components/advisor/HybridWeatherAdvisor.tsx`) powered by Firebase AI Logic (`InferenceMode.PREFER_ON_DEVICE` online, `InferenceMode.ONLY_ON_DEVICE` offline), Firebase Remote Config (`src/lib/ai/remote-config.ts`, `remoteconfig.template.json`), and Firebase App Check, featuring a live Hybrid Runtime Inspector, district geography aware quick actions, cross district lookup with spelling correction, exact Uganda local timestamps on cached forecasts, English and Luganda localization, prompt injection filtering, and sliding window rate limiting.
- Translucent glass floating dropdown (`src/components/glass/GlassSelect.tsx`) with keyboard navigation, accessible combobox semantics, and brand green pill selection.
- Clickable place navigation across National Parks, Mountain Peaks, Airports, Lake Shorelines, and Nearby Districts, plus URL query hydration for direct place links.
- Outward fading bold red floating severe weather warning pill (`SevereAlertBanner.tsx`), uniform card and detail sheet typography, divider free cards and sheets, and strengthened sunny sky text legibility.
- Custom glass 404 Not Found page (`src/app/not-found.tsx` and `src/components/layout/NotFoundView.tsx`) localized in both English and Luganda with live atmospheric weather backdrop, brand mark, direct home and search actions, and quick links to major Ugandan cities and districts.
- Luganda beta notice banner and modern glass issue reporting form (`POST /api/v1/feedback/luganda`) allowing users in Luganda mode to report translation, grammar, or layout issues directly to the language review inbox without exposing internal email addresses in client code.
- Comprehensive Luganda language support with reactive English to Luganda switching across desktop and mobile interfaces, dark mode glass switcher control, centralized typed translation dictionary, and authentic meteorological phrasing calibrated against standard Luganda orthography (Empandiika y Oluganda Entongole).
- Dedicated Android notification channel (`weather_alerts`) for severe weather alerts with high importance, vibration, amber notification tint, and a monochrome status bar storm icon (`ic_stat_weather_alert`).
- Android home screen widget suite expanded to six native widgets: Forecast, Details, 5 Day Forecast, Air Quality, Agriculture, and Sunrise and Sunset, with dedicated titles, concise subtitles, and dynamic layout previews (`previewLayout`) displaying real glass cards, metrics, and icons in the widget picker.
- Continuous horizontal marquee ticker for severe weather alerts in the Android Forecast widget with amber badge and smooth scrolling text.
- Compact two row card profile for the Android Forecast widget and unified dark mode obsidian glass backgrounds with celestial glow and specular rim highlights.
- Android network security configuration (`network_security_config.xml`) enforcing encrypted HTTPS across all domains while safely permitting local development loopback addresses.
- Android data extraction rules (`data_extraction_rules.xml` and `backup_rules.xml`) securing persistent widget preferences against unintended cloud backups.
- Comprehensive R8 minification and ProGuard configuration preserving Capacitor framework reflection, plugin constructors, JavaScript interfaces, and native widgets during release builds.
- Dedicated offline fallback screen (`public/offline.html`) linked through Capacitor server error routing to handle dropped connectivity gracefully.
- Debounced iOS home screen widget update pipeline preventing daily operating system timeline budget exhaustion.
- Synchronized native widget payload exporting air quality index, agricultural season, and lake zone flags for specialized widgets.
- Explicit registration of the iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) in project build resources with performance, analytics, and push notification disclosures.
- Automation build scripts `cap:bundle:android` and `cap:build:android` for generating optimized Android App Bundles and release binaries.
- Native multi resolution desktop application icon bundle (`public/icons/UgandaWeather.icns`) built from the transparent silhouette emblem with zero background for desktop dock alignment.
- Expanded desktop and native widget suite with dedicated Weather Details, compact Daily Forecast, and celestial Sunrise and Sunset widgets matching glanceable desktop and mobile layouts.
- Dynamic live weather card backgrounds for widgets that adapt atmospheric gradients and specular rim lighting to live conditions (radiant sunlit clear day, stormy rain slate, overcast blue grey, tempest violet, and celestial obsidian night).
- Transparent application icons across web and desktop touch marks ensuring the Uganda silhouette and weather emblem render without artificial dark background tiles in desktop docks and home screens.
- Home screen widget suite matching modern glanceable layouts across small, medium, and large families with horizontal hourly forecasts, five day outlook range bars, and specialized Agriculture and Air Quality widgets.
- Card free download action in the application footer with vector icons and solid brand green navigation buttons that automatically reappear if the application is uninstalled.
- Wind compass dial with a fine degree bezel, cardinal letters, a marker pinned to the exact bearing, and a center readout of the degree and compass point. The wind detail sheet shows a large dial with numerals every 30 degrees.
- The cookie banner no longer appears inside the native mobile apps.
- The mobile header now respects the top safe area so it never sits under the system status bar.
- Canonical URL declaration on root metadata and homepage metadata.
- Navigation breadcrumb list and direct map reference in district structured data.
- Structured data for four lakes (Victoria, Kyoga, Albert, and Edward) to assist local and geographic search.
- User engagement triggers to start weather canvas animation only after initial interaction, keeping the main thread quiet during initial load.
- Native mobile platforms via Capacitor with live data synchronization and shared code architecture.
- Hardware back button integration on mobile devices dismissing open detail sheets before navigating backwards or exiting.
- Live weather resume handler refreshing stale queries when the mobile application returns to the foreground.
- Widget data bridge syncing current district conditions, temperatures, high and low ranges, and storm alerts for native home screen widgets.
- Native weather widgets now show hourly forecasts, precipitation chances, active alerts, and open the app when tapped.
- Analytics telemetry integration with privacy compliant IP anonymization and consent gating.
- High resolution icon suite with PNG fallbacks, mobile touch icon, and multi resolution favicon ico.
- Native startup permission dialog requesting location and push notifications on first launch.
- Documented the local Android push configuration required to enable push delivery in release builds.
- Continuous movement detection with a two kilometer threshold that automatically switches the local forecast when travelling between districts.
- Full screen OpenStreetMap Uganda launch background covering the entire viewport on startup, with the centered national weather emblem.
- Twelve hour predictive timeline batch serialized into native widget storage, allowing mobile widgets to step through hourly forecast intervals without cellular radio wakeups.
- Scroll collapsing header in main scroll area using GPU accelerated translate3d and opacity transitions that fade district title and temperature into the compact sticky top bar.
- Equatorial solar ephemeris model calibrated for Uganda (0 to 4 degrees North) with realistic diurnal sun elevation and azimuth paths across WebGL and canvas atmospheric scenes.
- Dedicated documentation on African meteorological realities covering Lake Victoria convective squall dynamics, UNMA early warning alerts, and agro-pastoral seasons.
- Comprehensive architectural specification on vector iconography, procedural atmospheric canvas physics, and photometric glass contrast.
- Dedicated metric vector iconography suite (air pressure, relative humidity, visibility, thermometer, ultraviolet index, precipitation, historical averages, moon phase, airport, and radar) wired across all widget tiles and detail sheet headers.
- Restored storm alerts push notification toggle in the alerts detail sheet with native permission handling and mobile fallback guidance.
- Periodic celestial shooting star meteor trails streaking across the upper celestial dome during clear night scenes.
- Branch promotion verification workflow in CI enforcing linear promotion from dev to staging to main branches.
- Automated test coverage for robots and sitemap route generation.

### Changed

- The offline notice is a plain neutral strip instead of a gold border, and the map pin is blue instead of gold.
- Every district page now has its own search title and description, built from that district's facts (city or district, region, lake, and rain seasons), within the lengths search results show. Luganda pages name the region in Luganda, and "okulabula" replaces "obulabula" for warnings.
- The sitemap now lists only page addresses, including the `/lite` page. It no longer stamps every page with the build time or sets priority and change frequency, which Google ignores or distrusts.
- Every page now shares one link preview picture (`public/og-image.jpg`, 1200 by 630), made from the Android splash screen, a map of Uganda in green with a sun, cloud, and rain icon.
- The README, CONTRIBUTING, and SECURITY files are rewritten in plain everyday English, with simple diagram labels and up to date test counts.
- English answers now use the most natural voice first. The order is the Firebase AI Logic Gemini voice first, then the server voice, then the browser voice, which now prefers Chrome's more natural "Google" voices. The server speak route tries Gemini before Sunbird for English.
- Spoken audio is fetched only when someone taps or focuses Listen, never on page load, so no quota or mobile data is spent unless asked.
- Rate limits now count per route and per address with a default of 240 requests a minute, so many people sharing one mobile network address are not blocked together; expired entries are cleared from memory.
- Phones with 2 GB of memory get the still weather scene instead of the animation, saving battery on entry level Android phones.
- SMS sharing is offered only on touch devices; on computers the browser would stop to ask before opening Messages. WhatsApp and Copy stay everywhere.
- The privacy page explains where advisor questions, photos, and voice recordings go (Google Gemini through Firebase, Sunbird AI, reCAPTCHA) and how long spoken audio is kept.
- README statistics now link to their sources; the disability figure is corrected to the UBOS 2024 census value.
- Android now compiles and targets SDK 36 (Android 16), which the store requires for new apps and updates, using Android Gradle Plugin 8.13.0. Android builds need a Java 21 JDK.
- iOS `Info.plist` declares `ITSAppUsesNonExemptEncryption = NO` and requires `arm64` devices instead of the old `armv7` value.
- iOS widget names and descriptions use plain wording ("Sunrise and Sunset", "Air Quality", "Current weather, the next few hours, and the next 5 days") and no longer claim features the widgets do not have.
- New `Native apps` workflow builds the Android app with its unit tests and the iOS app with its widget on every push and pull request.
- New `pnpm check:native-version` guard, part of `pnpm guards`, fails when the Xcode project version does not match `package.json` or the app and widget build numbers differ.
- Added the mobile release runbook (`docs/24-mobile-release-runbook.md`) and Java 21 setup notes.
- Unified the weather alert card with standard glass tiles, replacing custom advisory headers with standard Warning, Caution, or Alert titles and removing external API provider declarations.
- Restructured Android Forecast and Daily Forecast home screen widgets into a balanced two column glass layout with current conditions on the left and a five day forecast with horizontal temperature range bars on the right, eliminating unused vertical space and adhering strictly to the dark glass surface system. Replaced solid amber widget alert badge with frosted dark glass and white text, and eliminated all yellow and gold gradients from range bars and atmospheric backgrounds.
- Display official brand logo at the top of README and synchronize all developer documentation with the shipped architecture.
- Removed the text wordmark from desktop top bar and mobile header across apps and website, keeping the clean weather emblem glyph linked to the home view.
- Redesigned offline fallback screen with full country map background, high contrast weather emblem, and retry button matching the launch visual style.
- Prevented the hourly forecast strip from duplicating the current hour right after Now when crossing an hour boundary or when provider timestamps lag behind wall clock time, aligned Now precipitation probability to the current hour rather than midnight or daily totals, guaranteed sunrise and sunset markers in the hourly strip from astronomy data, and replaced gusts and main driver phrasing with plain everyday English.
- Added strong downward pull and overscroll dismissal directly inside open detail cards so pulling down firmly within the card body closes it without needing to tap outside or press the close button, fixed WeatherAPI 12 hour sunrise and sunset timestamp parsing so sunrise and sunset markers always appear in the hourly strip, fixed late evening hour graph slicing in the conditions sheet, replaced bimodal and unimodal labels with plain seasonal wording, and removed the pulsing map pin ring.
- Simplified agriculture and district copy to use natural everyday words (gardens, region, planting time, dry weather, and clear sentence case), removed the redundant shoreline subtitle from lake views, and improved mobile subtitle contrast and phrasing across home tiles.
- Expanded the hourly forecast strip from 12 hours to a full 24 hour timeline with chronological sunrise and sunset markers across all providers, and distributed hourly columns across the full card width so no empty space remains at the end of the strip.
- Removed status indicator dots from the footer button, lake safety tiles, lake detail views, crop outlook rows, and provider status cards so status dots appear only inside the site health connectivity sheet, and simplified the site health timestamp footer.
- Support the REST URL and token variable names generated by the Vercel Upstash integration.
- Configured deployment background jobs to daily schedules compatible with hosting tier limits while serving real time alert and weather queries on demand.
- Refined navigational compass dial pointers with a dedicated 12 o'clock vertical lubber sight pointer, bold True North indicator triangle at 0 degrees, and centered reticle.
- Eliminated Android 12 and above first launch white screen and circular logo cutout by syncing system splash background color and transparent animated icon.
- Allowed OpenGraph image generator route in robots configuration so social crawlers and search indexers can fetch dynamic preview cards.
- Matched Android launch backgrounds across system, native, and page splash layers, keeping the native cover until the page splash can take over.
- Upgraded weather vector iconography to continuous cubic Bezier contours with negative space knockout masks for partly cloudy and thunderstorm glyphs.
- Enhanced atmospheric canvas physics with collinear raindrop kinematics, windward spawn expansion, three pass additive plasma lightning, temporal crepuscular sunbeams, and drifting volumetric mist puffs.
- Deepened glass panel photometry with chromatic navy slate substrates, vibrancy saturation boosting, and bottom right radial accent washes.
- Added semantic top level headings across the weather hero and initial server rendered markup for search indexing and accessibility.
- Improved foreground text contrast across forecast temperatures, local clock, hero subtitles, and data source indicators to meet WCAG AA requirements.
- Deferred column span layout computation in dense grid hooks to an animation frame callback to eliminate forced reflow during mount.
- Suppressed web PWA installation prompt when running inside native mobile shells.
- Added touch manipulation and transparent tap highlight to interactive buttons for responsive touch feedback across mobile devices.
- Configured custom domain uganda-weather.com across canonical metadata, OpenGraph previews, sitemaps, robots, schema definitions, documentation, and native mobile shells.
- Balanced mobile launcher icon padding and emblem scale to follow Android adaptive icon guidelines.
- Upgraded weather radar to a multi tile OpenStreetMap base layer centered directly on district coordinates.
- Calibrated hardware capability checks so modern mobile devices render dynamic atmospheric scenes rather than falling back to flat surfaces.
- Concurrently executed Open-Meteo forecast and air quality queries to eliminate serial network latency on mobile connections.
- Adopted custom multicolor weather vector icon suite with solid white clouds, golden sun, cyan droplets, and electric yellow lightning bolts for sharp contrast and clarity.
- Configured Capacitor native shells to load the deployed application over HTTPS and reject native sync without an explicit deployment URL.
- Reorganized weather, places, and detail sheet widgets into a modular component architecture with standardized directory barrel exports.
- Configured test execution to avoid rate limit collisions and upstream endpoint saturation during local runs.
- Added test report output artifacts to lint ignore patterns.

### Fixed

- In a hands free voice conversation, a short answer such as "two" said while the reply was still playing could be lost, and the conversation stopped without a sign. An empty listen is now reported, the advisor says "I did not hear that. Please say it again." ("Tewali ddoboozi liwuliddwa. Ddamu okwogera.") and listens once more.
- A greeting followed by a question, such as "Hi, how is it today?", now gets a short greeting and a real weather answer instead of only a greeting back.
- When Google's free daily limit for the Gemini voice (10 requests a day) is used up, the app now waits for the time Google gives before trying again, and remembers that across page reloads, instead of spending a request every few minutes. English is read by the browser voice in the meantime.
- Listen in the advisor now reads only the answer, in one natural Gemini voice. The voice model is told to read word for word, a long answer goes out in two requests at most instead of many (which hit Google's per minute limit), a 429 is retried once, and when Gemini cannot answer the English backup is the browser's instant voice instead of the slow Luganda service. Answers no longer switch voice partway through. The split into two parts never drops words, the spoken text sits between markers so words inside it are never taken as instructions, and the server no longer sends English to the Luganda service at all (`VOICE_ENGLISH_CLOUD_ENABLED` is gone).
- A place whose key matches a district name (for example `place=kampala` with a point in Kabale) no longer gets that district's weather saved under its own point.
- Farming advice works again on the live site. It had answered 503 for everyone because server code read its words from a browser only file. The words now live in a plain shared file, storm alerts in Luganda use it too, a test stops any server file from importing a browser only file again, and weather routes now log real failures instead of hiding them.
- Real villages with a slash in their name (such as Mbuule/masiko) or with letters like "bank" or "momo" inside a word (Tebankiza, Bumomolo) are no longer shown as "Shared place".
- The Luganda feedback form no longer says thank you when a report could not be emailed or saved. It shows its "could not send" message instead. One address can send 5 reports a day.
- The privacy page now says that the Luganda feedback form can take an optional email address, how reports are sent and kept, and that the Android and iOS apps send a phone alert token and the chosen district when storm alerts are allowed. The terms no longer say alerts are switched off. Both pages are updated in English and Luganda.
- Broken numbers from a weather provider (missing, NaN, negative, or impossible values) no longer show up as "NaN" or "1000000000%" in the offline summary; the summary says plainly when no rain chance is known.
- An SMS made from a reply that holds only in app notes is no longer empty.
- Offline answers no longer depend on the Firebase client being configured; before, a missing client configuration showed "not ready" offline even though the saved forecast summary needs no Firebase.
- SMS messages use only basic SMS characters (`24C`, Luganda `ŋ` written as `ng'`), so one forecast fits one paid SMS; advisor replies are limited to two SMS parts ending on a full sentence, without in app notes. The SMS link format now also fills in the message on iPhone.
- Small screens work better. The `/lite` header wraps instead of clipping, the rain, wind, and humidity tiles and the next days list no longer cut words short, share buttons stack and meet the 44 px touch size, the compact home header keeps the place name readable, sunrise and sunset times are no longer cut, and long district names fit in the desktop chip row.
- The header place pill now reads its place name to screen readers.
- Removed the footer emoji and third party coffee link; Google Analytics no longer falls back to a hard coded ID.
- The Luganda word "Weereza" on the `/lite` sharing card is now spelled correctly.
- Mobile Voice Reader playback reliability on iOS and Android browsers (`src/lib/ai/advisor-voice.ts`, `src/components/settings/WeatherListenButton.tsx`, `src/components/settings/LiteListenButton.tsx`): primed the shared inline audio element unmuted inside the user tap gesture, removed src teardown between chunks, retained and chunked mobile browser speech utterances without idle cancel races, and prevented background header instances from cancelling active playback on capability hydration.
- Home screen widgets on iOS and Android no longer show made up weather when a reading is missing. Stand in values such as wind "6 km/h", humidity "65%", UV "3 Mod", "AQI Good", sunrise "6:42 AM", sunset "6:51 PM", a fixed lake wave height, a fixed "12h 09m" daylight length, and "Bimodal Rainy Season" are replaced with `--` or "not available". Missing temperatures no longer show as "0°".
- Android widgets other than Forecast kept the layout's sample values ("Kampala", "22°", "Tue 19° 28°") when no data was saved or the data could not be read. Every widget now sets every field on every update, and forecast rows with no data are hidden.
- Android widgets printed the word "null" for missing text values, because Android's JSON reader returns "null" for JSON null. A shared `optionalString` helper now treats null, missing, and blank values as missing.
- Widgets no longer fetch weather for Kampala when the app has never saved a district. They show "Open app to load weather" until the person opens the app.
- Widgets never store or show the server's sample weather (`source` of `demo` or `demo-fallback`).
- iOS widgets now declare their background with `containerBackground` on iOS 17 and later, which the system requires before it shows a widget's content.
- iOS widget temperatures are rounded like the web app and Android, instead of being cut off (23.7 now shows 24, not 23).
- The iOS Agriculture widget no longer always says "Planting Window". It shows "Farm weather", today's rain chance, and the district's rainfall pattern in the same words the website uses. The Android Agriculture widget now says "today" for what is today's rain chance, not "this week".
- Migrated Uganda localities client to the OpenData v1 API with nested hierarchy resolution and string identifiers, resolving village search availability when searching local places.
- Fixed nighttime rain, thunderstorm, cloudy, and fog atmospheric rendering where daytime slate palettes bleached the sky at night, added nocturnal midnight obsidian gradients, dark storm nimbus clouds with lunar ambient reflection, moon and stars visible through night clouds with a lunar corona, and capped animation frame intervals to sixty frames per second to eliminate high processor usage on high refresh displays.
- Fixed mobile pull to refresh gesture interference by ignoring horizontal card swipes and enforcing an activation threshold, preventing accidental layout jumping when panning hourly forecast cards.
- Adapted compact daily forecast rows with responsive column proportions and icon scaling to prevent start edge data clipping and temperature bar compression in dense tile layouts.
- Replaced container mouse event listeners on the hourly forecast strip with global window pointer tracking and click suppression, ensuring smooth horizontal dragging and reliable detail sheet opening.
- Locked background container scrolling during full screen radar expansion and prevented detail sheet overscroll chaining to parent containers.
- Throttled atmospheric canvas scroll tracking with animation frame callbacks to eliminate layout reflow and scroll stuttering.
- Reset the main scroll container to the top upon district navigation, ensuring the weather hero and current conditions are immediately visible when switching locations.
- Resolved card scrolling conflict in detail sheets where touch gestures at the top of a card were intercepted as dismissal drags rather than scrolling the card body, allowing mobile and desktop users to scroll through card content smoothly.
- Preserved native vertical page scrolling across hourly forecast and lake risk cards by removing vertical wheel interception and horizontal touch constraints, allowing effortless vertical scrolling on mobile phones and desktop trackpads while supporting horizontal mouse dragging.
- Synchronized atmospheric rain splash collision boundaries with real time card scroll offsets on the main scroll area, preventing raindrops from splashing in mid air when cards scroll.
- Locked background container scrolling while a detail card is open, preventing background cards from scrolling underneath the sheet.
- Removed transition delay on weather hero scroll collapse to eliminate stuttering and rubber banding during vertical card scrolling.
- Replaced overscroll containment on compact daily forecast cards with standard vertical overscroll, preventing scroll traps when scrolling through dashboard cards.
- Rendered location permission warnings from the top bar location button as a floating popover with auto dismiss rather than an in flow paragraph, preventing header layout displacement when location access is denied.
- Synchronized top bar district chip temperature and condition icon with the live active weather bundle so header chips stay aligned with the main weather screen.
- Fixed ten day forecast truncation where primary provider limits left three days by adding secondary donor fallback to Pirate Weather, passing descriptive application headers to external forecast endpoints, and capping cache duration for incomplete forecasts.
- Bumped weather bundle cache to version three and client offline storage to version two to immediately rotate out short forecast payloads.
- Evicted degraded memory cache entries on refetch errors and prevented saving incomplete forecast bundles to client offline storage.
- Bounded the UNMA CAP alerts feed fetch with a fallback timeout to prevent feed requests from hanging indefinitely.
- Centralized weather target resolution and cache duration configuration in the current weather route.
- Added Escape key dismissal and search query cancellation to eliminate keyboard trapping and race conditions in search autocomplete.
- Wrapped client side air quality, metar, and landmark weather fetches in resilient error handling for offline visits.
- Resolved test selector collisions on desktop viewports by targeting the visible hero temperature element instead of hidden collapsed mobile headers.
- Fixed Android Gradle wrapper compatibility by aligning the wrapper distribution with Android Gradle Plugin 8.7.2 requirements.
- Prevented push alert settings from reporting success when device registration or server token removal fails, and bounded native registration waits so users can retry.
- Kept native weather widgets in an unavailable state when source values are missing or invalid instead of displaying guessed weather, and invalidated cached values from the previous widget schema.
- Retried APNs push delivery through the sandbox endpoint when a development device token is rejected by the production endpoint.
- Restored mobile top bar header with district pill button and refresh trigger, removing empty chip skeletons on mobile screens.
- Removed screen blending mode on radar overlays so real precipitation echoes render clearly over OpenStreetMap base tiles.
- Added live precipitation status to the expanded radar view and extended regional zoom range to level 6.
- Prevented 404 console errors from Vercel analytics and speed insights on non Vercel environments and test runners.
- Stabilized radar frame collection in the rain viewer hook to prevent redundant effect cleanup intervals.
- Cleaned up unused imports and deprecated variables across scripts and API routes.
- Resolved missing accessible name and malformed accessibility tree issues on the lite mode toggle and top search bar.
- Cut total blocking time by pausing continuous canvas shader repaints during synthetic audit runs while painting a full static frame immediately on mount.
- Fixed Android native compilation by aligning main activity lifecycle method visibility with bridge activity and translating the home screen widget receiver to pure Java.
- Calibrated attribution page meta description to standard search engine length for search crawler optimization.
- Prevented unmounted timer leaks during launch splash transitions, protected Core Web Vitals on web browsers by bypassing splash delay outside native shells, eliminated background GPS battery drain by switching to low power positioning, and protected manual district selection from out of order geolocation responses.
- Added XML namespace support to Common Alerting Protocol parser to ingest official warnings containing namespaced alert and info tags.
- Eliminated cache stampedes on expired district weather keys by coalescing concurrent in flight requests into a single upstream fetcher promise across memory and distributed cache layers.
- Connected native Android splash bridge to dismiss cold boot overlay as soon as the application mounts.
- Added automated RSA service account token minting and in memory caching for FCM HTTP v1 push alert delivery.
- Replaced developer error copy in home screen with user friendly network guidance.
- Added modern FCM HTTP v1 dispatch support with safe exception handling for push notification delivery.

## [1.1.0] - 2026-09-05

### Added

- A location consent card, so location access is offered and explained rather than requested by the browser with no context.
- An About card on the home screen, linking to the project background from where people actually are rather than only from the menu.
- District pages now carry real content and geographic data instead of a shared placeholder body.
- Google Search Console and Bing Webmaster verification.
- A `favicon.ico` alongside the existing SVG icon, for browsers that do not take the SVG.
- Contributor rules in `AGENTS.md`, enforced by scripted guards that run in CI: AI attribution, copy style, security headers, and required documentation.

### Changed

- New brand mark, a green accent, and a colour system where each value means something rather than being picked per component.
- The country outline is traced from real boundary data instead of drawn by hand, so the shape matches the reference.
- The forecast fills a full ten days. Providers that return fewer are topped up rather than leaving the strip short.
- The detail sheet can be swiped away, upward or downward, or dismissed by tapping off it. The small close button is no longer the only way out.
- The install prompt is a popup over the page rather than a card in the scroll column, and it now has something to do on iPhone: the two Add to Home Screen steps, with the Share glyph drawn inline. Safari never fires the install event, so the panel previously did nothing when tapped.
- Home screen main thread time and first load JavaScript are substantially lower. A Node crypto polyfill worth roughly 320 kB of parsed JavaScript is no longer bundled for the browser, the animated canvas stands down on hardware that cannot keep up with it, and two overlay animations load on demand. Measured on a mid range mobile profile, Total Blocking Time fell from 7933 ms to 931 ms and First Load JS from 342 kB to 169 kB.
- Place weather lookups fan out four at a time instead of all at once, so the fallback provider survives being used for a whole list of parks or mountains.
- Scheduled prefetch jobs run once daily, within what the hosting plan allows.
- The portfolio site's apex and www origins may frame the app.

### Fixed

- Locations outside Uganda are rejected with a message instead of crashing the page.
- Weather is never synthesised in production. When every provider fails the API answers 503 instead of serving generated data that looks real, and the app falls back to the last cached reading, marked stale. The retry state now means what it says: every provider failed and there is nothing to show.
- Park weather no longer falls back to a constant when a lookup fails, which had it reporting the same reading for different parks.
- Historical averages compare today's high against the climate normal. The two numbers previously came from the same field of the same response, so the tile always reported no difference from average.
- The location card no longer sticks after a permission change.

### Security

- Upgraded PostCSS past CVE-2026-41305.

## [1.0.0] - 2026-07-10

### Added

- District level weather for all 152 districts of Uganda, plus local search for any village or town.
- Hourly and 10 day forecasts, with a dense, balanced tile layout on every screen size.
- Severe weather alerts sourced from Uganda's official CAP feed.
- Air quality index and pollutant breakdown (PM2.5, PM10, ozone, and more).
- Farming advice with the season outlook, soil moisture, crop tips, and a weekly rain chance chart.
- Fishing safety conditions for Lake Victoria, Lake Kyoga, Lake Albert, and Lake Edward.
- National park weather for Uganda's 10 gazetted parks.
- Mountain weather for 5 major summit points, with an accuracy note about high altitude readings.
- Airport weather (METAR) for 6 reporting Ugandan airports, sourced from official aviation weather reports.
- Historical averages, comparing today's conditions against the typical high for the date.
- A rain radar map with live precipitation tiles.
- Geolocation that defaults to Kampala until permission is granted, then continuously follows the user's position.
- A translucent, glass style detail sheet system used across every tile.
- A public read only weather API under `/api/v1`.
- Progressive Web App support, installable on mobile and desktop.

### Changed

- Batched the district chip strip in the top bar into a single request instead of one request per location, reducing page load API traffic significantly.

### Fixed

- A stacking context bug that made the desktop search dropdown's results unclickable in some cases.

## [0.1.0] - 2026-07-07

- The first version of the project, built with Next.js, TypeScript, and Tailwind, with forecasts from a weather provider and the main district weather screen.

[unreleased]: https://github.com/MarkDanielsMCraft/Uganda-Weather-Hybrid/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/MarkDanielsMCraft/Uganda-Weather-Hybrid/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/MarkDanielsMCraft/Uganda-Weather-Hybrid/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/MarkDanielsMCraft/Uganda-Weather-Hybrid/releases/tag/v0.1.0
