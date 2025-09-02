// service-worker.js
const CACHE = "te-amo";
const ASSETS = ["./manifest.json"];

const toScopeURL = (url) => new URL(url, self.registration.scope).toString();

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map(toScopeURL))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Elimina cualquier copia previa de messages.json del caché del SW
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

  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Bypass completo para messages.json (nada de SW cache)
  if (url.pathname.endsWith("/messages.json") || url.pathname.endsWith("messages.json")) {
    e.respondWith(fetch(req, { cache: "reload" }));
    return;
  }

  // HTML: Network-First con no-store
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

  // Otros assets: Stale-While-Revalidate
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

