const CACHE_NAME = "lawh-warsh-shell-v2";
const SHELL_FILES = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// index.html (والتنقلات بشكل عام): Network-first — ديما كيجرب يجيب آخر نسخة من الشبكة أولا،
// وما يرجعش للكاش غير إلا تعطل الاتصال (offline). هكا كل تحديث كنديرو فـ index.html
// كيبان للمستخدم مباشرة، بلا ما يبقى عالق فنسخة قديمة مخزنة.
//
// باقي الملفات الثابتة (icons, manifest): Cache-first، لأنها نادر ما تتبدل.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin || event.request.method !== "GET") return;

  const isNavigation = event.request.mode === "navigate" || url.pathname.endsWith(".html");

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
