const CACHE_NAME = "lawh-warsh-shell-v5";
const RUNTIME_CACHE = "lawh-warsh-runtime-v2";
const SHELL_FILES = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./quran-data.json"
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
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// كيفاش نعرفو نوع الطلب الخارجي باش نختارو له الاستراتيجية المناسبة
function isAudioRequest(url) {
  // ملفات الصوت (mp3quran.net وسيرفراتها الفرعية server8.mp3quran.net إلخ)
  return /\.mp3$/i.test(url.pathname) || url.hostname.endsWith("mp3quran.net");
}
function isTafsirRequest(url) {
  // ملفات JSON ثابتة على jsDelivr — نادر ما تتبدل، بحال الملفات المحلية
  return url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("tafsir_api");
}
function isPrayerTimesRequest(url) {
  // مواقيت الصلاة — كتتبدل كل يوم، خاصها آخر نسخة من النت أولا
  return url.hostname === "api.aladhan.com";
}
function isFontRequest(url) {
  // خطوط Google Fonts (ورقة الـ CSS من fonts.googleapis.com + ملفات .woff2 من fonts.gstatic.com)
  // ثابتة بزاف، نادر ما تتبدل — كيفاش الآيكونات المحلية
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

// index.html (والتنقلات بشكل عام): Network-first — ديما كيجرب يجيب آخر نسخة من الشبكة أولا،
// وما يرجعش للكاش غير إلا تعطل الاتصال (offline). هكا كل تحديث كنديرو فـ index.html
// كيبان للمستخدم مباشرة، بلا ما يبقى عالق فنسخة قديمة مخزنة.
//
// باقي الملفات الثابتة (icons, manifest, الخطوط): Cache-first، لأنها نادر ما تتبدل.
//
// المصادر الخارجية (صوت، تفسير، مواقيت الصلاة): كل وحدة عندها استراتيجية خاصة تحت،
// باش يخدم أوفلاين جزئيا (آخر ورد سمعتيه، آخر تفسير شفتيه، آخر مواقيت جبتيهم).
//
// ملاحظة: quran-data.json (نص القرآن كامل) متخزن فـ SHELL_FILES فوق —
// كيتحمل ويتخزن مباشرة وقت تثبيت الـ service worker (أول زيارة بالنت)،
// هكا التطبيق كيقدر يقرا منو مباشرة أوفلاين من أول استعمال تاني، بلا
// حاجة لأي نداء حي لـ Supabase. Supabase (bookmarks، الختمة، الإعدادات)
// كيبقى غير للمزامنة الاختيارية عبر الأجهزة — ماشي مغطى هنا قصدا.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (event.request.method !== "GET") return;

  // ---- مصادر خارجية (صوت / تفسير / مواقيت الصلاة / خطوط) ----
  if (!isSameOrigin) {
    if (isAudioRequest(url) || isTafsirRequest(url) || isFontRequest(url)) {
      // Cache-first: المحتوى ثابت (نفس الآية = نفس التلاوة/نفس التفسير، ونفس الخط ديما نفسه)،
      // أول مرة كتنسمع/كتنقرا/كتتحمل، من بعد كتخدم أوفلاين مباشرة
      event.respondWith(
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res && res.ok) {
              const resClone = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, resClone));
            }
            return res;
          }).catch(() => cached);
        })
      );
      return;
    }
    if (isPrayerTimesRequest(url)) {
      // Network-first: كتتبدل كل يوم، خاصها آخر نسخة، وإلا تعطل الاتصال كترجع لآخر مواقيت محفوظة
      event.respondWith(
        fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const resClone = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, resClone));
            }
            return res;
          })
          .catch(() => caches.match(event.request))
      );
      return;
    }
    return; // باقي المصادر الخارجية (Supabase...) — بلا تدخل، بحال قبل
  }

  // ---- ملفات محلية (نفس الأصل) ----
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
