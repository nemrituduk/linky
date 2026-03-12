// Linky Service Worker v3
// シンプルで堅牢なキャッシュ戦略

const CACHE_VERSION = 'linky-v3';

// インストール時
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// アクティベート時
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// フェッチ時：ネットワークファースト、フォールバックでキャッシュ
self.addEventListener('fetch', (event) => {
  // POST, PUT, DELETE等は処理しない
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // ローカルリソース（/linky/）の場合
  if (url.pathname.startsWith('/linky/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 正常なレスポンスの場合、キャッシュに保存
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // ネットワークエラーの場合、キャッシュから取得
          return caches.match(event.request).then((cached) => {
            if (cached) {
              return cached;
            }
            // キャッシュもない場合、ドキュメント要求なら起動ページを返す
            if (event.request.destination === 'document') {
              return caches.match('/linky/linky.html');
            }
            return new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // 外部リソース（fonts.googleapis.com等）の場合
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // 外部リソースのキャッシュを試みる
        return caches.match(event.request).catch(() => {
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
