const CACHE = "te-amo-v2";
const ASSETS = ["./","./index.html","./manifest.json"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate", e=>{
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
      ),
      self.clients.claim()  // <- aquí añadido
    ])
  );
});
