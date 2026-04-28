const CACHE_NAME = "meal-planner-summer-v4";
/** オフライン用にキャッシュする静的アセット（index.html は除外 — 常に最新の献立を取得するため） */
const APP_SHELL = ["./manifest.webmanifest", "./icon-192.svg", "./icon-512.svg"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const req = event.request;
    const accept = req.headers.get("accept") || "";
    const isHtml =
        req.mode === "navigate" ||
        req.destination === "document" ||
        accept.includes("text/html");

    // HTML（献立データを含む index）はネットワーク優先 — キャッシュのみだと全リセットしても古いままになる
    if (isHtml) {
        event.respondWith(
            fetch(req)
                .then((response) => {
                    if (response && response.status === 200 && response.type === "basic") {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    }
                    return response;
                })
                .catch(() =>
                    caches.match(req).then((c) => c || caches.match("./index.html"))
                )
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((response) => {
                if (!response || response.status !== 200 || response.type !== "basic") {
                    return response;
                }
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                return response;
            });
        })
    );
});
