// Кэш для офлайн-работы: после первого открытия игры грузятся без интернета
const CACHE = 'games-v1';
const FILES = ['./', 'index.html', 'blockblast.html', 'watersort.html', 'icon.png'];

// Редиректный ответ нельзя отдавать как страницу — пересобираем его
async function clean(res) {
  if (!res.redirected) return res;
  const blob = await res.clone().blob();
  return new Response(blob, { status: 200, statusText: 'OK', headers: res.headers });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(FILES.map(async f => {
        try {
          const res = await fetch(f);
          if (res.ok) await cache.put(f, await clean(res));
        } catch (err) {}
      }))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала отдаём из кэша (мгновенно), а в фоне обновляем, если сайт доступен
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const network = fetch(req)
        .then(async res => {
          if (res && res.ok) {
            const copy = await clean(res.clone());
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
