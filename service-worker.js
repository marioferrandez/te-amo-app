// service-worker.js
// Caché estable (no tendrás que versionar)
const CACHE = "te-amo";
const ASSETS = [
  "./manifest.json",
  // añade aquí assets inmutables si quieres (iconos, css/js con hash)
];

const toScopeURL = (url) => new URL(url, self.registration.scope).toString();

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map(toScopeURL)))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Limpia cualquier copia vieja de messages.json que hubiera quedado cacheada
    try {
      const cache = await caches.open(CACHE);
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter(req => req.url.endsWith("/messages.json") || req.url.endsWith("messages.json"))
          .map(req => cache.delete(req))
      );
    } catch {}
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Sólo GET y mismo origen
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // 1) messages.json -> BYPASS TOTAL DEL SW (sin cachear, sin fallback)
  if (url.pathname.endsWith("/messages.json") || url.pathname.endsWith("messages.json")) {
    e.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // 2) HTML (navegación): Network-First con no-store
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        if (fresh && fresh.status === 200 && (fresh.type === "basic" || fresh.type === "default")) {
          await cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match(toScopeURL("./"))) || Response.error();
      }
    })());
    return;
  }

  // 3) Otros assets: Stale-While-Revalidate
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const fetching = fetch(req).then(res => {
      if (res && res.status === 200 && (res.type === "basic" || res.type === "default")) {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);
    return cached || fetching || fetch(req);
  })());
});



