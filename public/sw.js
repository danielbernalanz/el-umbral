const CACHE = "umbral-v15-0";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./engine.js",
  "./fx.js",
  "./ui.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./img/sprites.svg",
  "./img/sprites-map.js",
  "./img/creditos.js",
  "./img/CREDITOS.txt"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res && res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
