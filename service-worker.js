// sw.js
const CACHE = "te-amo-v4-2025-09-02";
const ASSETS = [
  "./manifest.json",
  // añade aquí assets estáticos inmutables (css/js/imágenes) si quieres precachearlos
];

// Helper: normaliza rutas respecto al scope (útil en Project Pages)
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

  // Sólo GET y mismo origen
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Navegación/HTML: Network-First con no-store para recoger la última versión
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith(networkFirstHTML(req));
    return;
  }

  // Otros assets: Stale-While-Revalidate
  e.respondWith(staleWhileRevalidate(req));
});

async function networkFirstHTML(req) {
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    // Guarda sólo si es válido
    if (fresh && fresh.status === 200 && fresh.type === "basic") {
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    // Respaldo: lo que haya en caché para esa ruta (si existe)
    const cached = await caches.match(req);
    if (cached) return cached;

    // Último recurso: intenta servir la raíz del scope si está en caché
    return caches.match(toScopeURL("./")) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200 && res.type === "basic") {
      cache.put(req, res.clone());
    }
    return res;
  }).catch(() => null);

  return cached || fetchPromise || fetch(req);
}



