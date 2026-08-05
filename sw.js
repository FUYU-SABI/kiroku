/* ひとこと — Service Worker
   アプリ本体をキャッシュして、圏外でも起動できるようにする。
   ファイルを更新したら CACHE の数字を上げること（これが更新の合図になる）。 */

const CACHE = "hitokoto-v2";

/* オフラインでも必要な最低限のファイル */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      /* addAll は1つでも 404 だと全体が失敗するので、1件ずつ入れて失敗は握りつぶす。
         こうしておくと、ファイルが1つ欠けても SW 自体は生き残る。 */
      Promise.all(SHELL.map(url =>
        cache.add(url).catch(err => {
          console.warn("[sw] キャッシュできませんでした:", url, err);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;

  /* 画面遷移はネット優先・失敗したらキャッシュ（更新をすぐ反映させるため） */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (req.method !== "GET") return;

  /* それ以外はキャッシュ優先。取得できたものは静かに貯めておく */
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});
