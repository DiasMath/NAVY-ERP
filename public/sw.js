const OFFLINE_CACHE = "navy-offline-v1";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.addAll(["/offline.html", "/icons/navy-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("navy-offline-") && key !== OFFLINE_CACHE).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()));
});
