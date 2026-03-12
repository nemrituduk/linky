// Linky Service Worker
// オフライン対応・キャッシュ管理

const CACHE_NAME = 'linky-v1';
const ASSETS_TO_CACHE = [
  '/linky/linky.html',
  '/linky/manifest.json',
  '/linky/sw.js',
  '/linky/icon-192.png',
  '/linky/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
];

// インストール時：必要なアセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Googleフォントは別途キャッシュ（CORSの関係でno-corsを使用）
      const localAssets = ASSETS_TO_CACHE.filter(url => !url.startsWith('https://fonts.'));
      const fontAssets  = ASSETS_TO_CACHE.filter(url =>  url.startsWith('https://fonts.'));

      const localPromise = cache.addAll(localAssets);
      const fontPromise  = Promise.all(
        fontAssets.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(res => cache.put(url, res))
            .catch(() => {/* フォント取得失敗は無視 */})
        )
      );
      return Promise.all([localPromise, fontPromise]);
    })
  );
  self.skipWaiting();
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// フェッチ時：キャッシュファースト戦略
self.addEventListener('fetch', (event) => {
  // POST リクエスト（Share Target）はキャッシュしない
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // バックグラウンドで更新（stale-while-revalidate）
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse;
      }
      // キャッシュにない場合はネットワークから取得してキャッシュに追加
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // オフライン時はメインページを返す
          if (event.request.destination === 'document') {
            return caches.match('/linky/linky.html');
          }
        });
    })
  );
});

// Share Target（Web Share Target API）対応
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === 'GET' &&
    url.pathname === '/linky/linky.html' &&
    (url.searchParams.has('url') || url.searchParams.has('text'))
  ) {
    // Share Target のリクエストはそのままページに渡す
    event.respondWith(
      caches.match('/linky/linky.html').then((cached) => cached || fetch(event.request))
    );
  }
});
