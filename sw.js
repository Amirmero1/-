// ✙ مارجرجس - Service Worker v2
const CACHE_NAME = 'margirgis-v2';

// الصفحات الأساسية اللي هتتحفظ في الـ install
const CORE_PAGES = [
  './',
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

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_PAGES.map(url => cache.add(url).catch(e => console.warn('cache miss:', url, e)))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts وأي خارجي - نجرب النت وبعدين الكاش
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 408 }));
      })
    );
    return;
  }

  const dest = event.request.destination;

  // ── الصور: Cache First ──
  if (dest === 'image') {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // ── الأوديو والفيديو: Range Request Handler ──
  if (dest === 'audio' || dest === 'video') {
    event.respondWith(handleMedia(event.request));
    return;
  }

  // ── الصفحات والباقي: Stale While Revalidate ──
  event.respondWith(staleWhileRevalidate(event.request));
});

// ── Cache First (للصور) ──
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── Media Handler (للأوديو والفيديو مع Range Requests) ──
async function handleMedia(request) {
  const rangeHeader = request.headers.get('range');

  // شوف لو في الكاش
  const cachedFull = await caches.match(new Request(request.url));
  if (cachedFull) {
    if (rangeHeader) {
      return handleRangeRequest(cachedFull, rangeHeader);
    }
    return cachedFull;
  }

  // مش في الكاش - اجيب من النت واحفظه كامل
  try {
    const fullResponse = await fetch(new Request(request.url));
    if (fullResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(new Request(request.url), fullResponse.clone());
    }
    // لو في range request، نعمل partial response
    if (rangeHeader && fullResponse.ok) {
      return handleRangeRequest(fullResponse, rangeHeader);
    }
    return fullResponse;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ── Range Request من الكاش ──
async function handleRangeRequest(response, rangeHeader) {
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const total = bytes.length;

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    return new Response(arrayBuffer, {
      status: 200,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' }
    });
  }

  const start = match[1] !== '' ? parseInt(match[1]) : 0;
  const end   = match[2] !== '' ? parseInt(match[2]) : total - 1;
  const chunk = bytes.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(chunk.length),
      'Accept-Ranges': 'bytes',
    },
  });
}

// ── Stale While Revalidate (للصفحات) ──
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}
