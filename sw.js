// Service worker de Mineros TV.
// Estrategia: siempre se intenta la red primero (así cada deploy se ve de inmediato)
// y la copia guardada solo se usa cuando no hay conexión.
// Cambia CACHE_VERSION si cambias la lista de archivos base.
const CACHE_VERSION = "mineros-v2";
const FONT_CACHE = "mineros-fuentes-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/calendario.html",
  "/roster.html",
  "/noticias.html",
  "/noticia.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/css/main.css",
  "/assets/js/app.js",
  "/assets/js/calendar.js",
  "/assets/js/components.js",
  "/assets/js/demo-data.js",
  "/assets/js/firebase-config.js",
  "/assets/js/firebase-service.js",
  "/assets/js/news-list.js",
  "/assets/js/news-page.js",
  "/assets/js/roster.js",
  "/assets/js/shell.js",
  "/assets/js/utils.js",
  "/assets/icons/escudo.png",
  "/assets/icons/icon-192.png",
  "/assets/img/news-1.svg",
  "/assets/img/player-1.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => ![CACHE_VERSION, FONT_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Fuentes de Google: rara vez cambian, se sirven desde la copia guardada
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Firebase, YouTube y analytics van directo a la red; Firestore maneja su propio modo sin conexión
  if (url.origin !== self.location.origin) return;
  // El panel admin y la pizarra del estadio nunca se sirven desde caché
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/pizarra")) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(stripVersion(request), response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(stripVersion(request), { ignoreSearch: request.mode !== "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const page = await cache.match(new URL(request.url).pathname, { ignoreSearch: true });
      return page || cache.match("/offline.html");
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

// Los archivos llevan ?v=... para el navegador; en la caché se guardan sin él
function stripVersion(request) {
  const url = new URL(request.url);
  if (!url.searchParams.has("v")) return request;
  url.searchParams.delete("v");
  return url.toString();
}
