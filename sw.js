const CACHE_NAME = "deadgood-quote-engine-v3-29";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./assets/styles.css",
  "./assets/styles.css?v=rc24",
  "./assets/app.js",
  "./assets/app.js?v=rc17",
  "./assets/config.js",
  "./assets/config.js?v=rc15",
  "./assets/storage.js",
  "./assets/storage.js?v=rc15",
  "./assets/calculations.js",
  "./assets/calculations.js?v=rc15",
  "./assets/utils.js",
  "./assets/utils.js?v=rc15",
  "./manifest.webmanifest",
  "./manifest.webmanifest?v=brand-5",
  "./favicon.ico",
  "./favicon-32x32.png",
  "./favicon-16x16.png",
  "./apple-touch-icon.png",
  "./assets/icons/deadgood-logo.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }

        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          throw new Error(`No cached response for ${event.request.url}`);
        }),
      ),
  );
});
