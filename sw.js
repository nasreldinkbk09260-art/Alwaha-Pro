// sw.js - خدمة التخزين المؤقت والتشغيل بدون إنترنت (Service Worker)
const CACHE_NAME = 'alwaha-pro-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request).catch(() => {
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
