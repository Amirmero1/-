// ✙ مارجرجس - Service Worker للعمل بدون نت
const CACHE_NAME = 'margirgis-v1';

// كل الصفحات والملفات اللي هتتحفظ
const PAGES = [
  'index.html',
  'Home.html',
  'Home2.html',
  'courses.html',
  'Coral.html',
  'CoralH.html',
  'hadana.html',
  'mohoob.html',
  'mohoob1.html',
  'mohoob3.html',
  'melodies_level1.html',
  'melodies_mohoob.html',
  'level1-5_6.html',
  'manifest.json',
];

// ── Install: حفظ الصفحات في الكاش ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // نحفظ الصفحات الأساسية، لو فيه ملف مش موجود نكمل
      return Promise.allSettled(
        PAGES.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: مسح الكاشات القديمة ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: كل طلب يمر هنا ──
self.addEventListener('fetch', event => {
  // بس الطلبات من نفس الأوريجن
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // موجود في الكاش → رجعه فوراً وحدّث الكاش في الخلفية
        updateCache(event.request);
        return cached;
      }

      // مش في الكاش → اجيب من النت واحفظه
      return fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // فصل النت ومش في الكاش
          if (event.request.destination === 'document') {
            return caches.match('index.html');
          }
        });
    })
  );
});

function updateCache(request) {
  fetch(request).then(response => {
    if (response && response.status === 200) {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response));
    }
  }).catch(() => {});
}
