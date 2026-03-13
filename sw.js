// Service Worker for Linky PWA
// Share Target API を有効にするために必要

const CACHE_NAME = 'linky-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Share Target: GETリクエストをアプリにルーティングする
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Share Target のリクエストを処理
  // manifest の "action": "." に対応するパスへのGETリクエスト
  if (event.request.method === 'GET' && url.searchParams.has('url')) {
    event.respondWith(
      (async () => {
        // メインページを開いているクライアントを探す
        const allClients = await self.clients.matchAll({ type: 'window' });

        if (allClients.length > 0) {
          // 既存のウィンドウがあればそこにメッセージを送ってリダイレクト
          const client = allClients[0];
          client.postMessage({
            type: 'SHARE_TARGET',
            url: url.searchParams.get('url') || url.searchParams.get('text') || '',
            title: url.searchParams.get('title') || '',
          });
          client.focus();
          return Response.redirect(url.origin + url.pathname, 303);
        } else {
          // ウィンドウが存在しない場合: クエリパラメータ付きでリダイレクト
          return Response.redirect(event.request.url, 303);
        }
      })()
    );
    return;
  }

  // その他のリクエストはネットワークに通す（キャッシュなし運用でもOK）
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
