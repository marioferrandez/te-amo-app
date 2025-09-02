// service-worker.js
const CACHE = "te-amo-v7-2025-09-02";
const ASSETS = [
  "./manifest.json",
  // añade aquí (si quieres) assets estáticos inmutables (css/js con hash, iconos, etc.)
];

// Convierte rutas relativas a absolutas dentro del scope del SW (útil en GitHub Pages)
const toScopeURL = (url) => new URL(url, self.registration.scope).toString();

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map(toScopeURL)))
  );
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

  // Sólo manejamos GET y mismo origen
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // --- 1) messages.json: siempre red con no-store, guardamos POR PATH (ignora ?ts=) ---
  if (url.pathname.endsWith("/messages.json") || url.pathname.endsWith("messages.json")) {
    e.respondWith((async () => {
      const pathKey = new Request(new URL(url.pathname, location.origin), { method: "GET" });
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        // guarda una copia offline por si luego no hay red
        if (fresh && fresh.status === 200) {
          const cache = await caches.open(CACHE);
          await cache.put(pathKey, fresh.clone());
        }
        return fresh;
      } catch {
        // si falla la red, devolvemos la última copia válida por PATH (ignora la query)
        const cached = await caches.match(pathKey);
        return cached || new Response("[]", { headers: { "Content-Type": "application/json" }});
      }
    })());
    return;
  }

  // --- 2) HTML (navegación): Network-First con no-store ---
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        // Guarda sólo respuestas válidas del propio origen
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

  // --- 3) Otros assets: Stale-While-Revalidate ---
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





