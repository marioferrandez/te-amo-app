// service-worker.js
const CACHE = "te-amo-v5-2025-09-02";
const ASSETS = [
  "./manifest.json",
  // añade aquí tus assets estáticos inmutables si quieres (css/js con hash)
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Sólo GET y mismo origen
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // messages.json: siempre red (no-store). Fallback a caché si offline.
  if (url.pathname.endsWith("/messages.json") || url.pathname.endsWith("messages.json")) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || new Response("[]", {
          headers: { "Content-Type": "application/json" }
        });
      }
    })());
    return;
  }

  // HTML: Network-First con no-store
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Otros assets: Stale-While-Revalidate
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const fetching = fetch(req).then(res => {
      if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || fetching || fetch(req);
  })());
});



