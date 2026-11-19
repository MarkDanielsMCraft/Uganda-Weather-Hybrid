// Bump CACHE whenever anything in SHELL changes. activate() deletes every
// cache whose name is not the current one, so a stale shell only clears if
// this string moves. It did not move when the mark was redrawn, which is
// why returning visitors kept being served the old icons from here.
const CACHE = "uganda-weather-v7";
const API_CACHE = "uganda-weather-api-v1";

const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE && key !== API_CACHE).map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/v1/weather/current")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (
    url.pathname.startsWith("/api/v1/alerts") ||
    url.pathname.startsWith("/api/v1/air-quality") ||
    url.pathname.startsWith("/api/v1/weather/forecast") ||
    url.pathname.startsWith("/api/v1/agriculture/advisory")
  ) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (url.pathname.startsWith("/api/v1/locations/search")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (request.mode === "navigate" || SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
  }
});

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Offline");
  }
}
