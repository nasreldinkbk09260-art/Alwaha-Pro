const CACHE_NAME = 'alwaha-pro-v2'; // تم التحديث لنسخة جديدة لضرب الكاش القديم
const urlsToCache = [
  './',
  './index.html',
  './privacy.html', // تمت إضافة صفحة الخصوصية للتوافق
  './icon.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // إجبار المتصفح على استخدام النسخة الجديدة فوراً
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// هذا الكود يضمن مسح أي ملفات قديمة من الذاكرة (مثل v1)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // إرجاع النسخة المخبأة إذا لم يتوفر إنترنت
        }
        return fetch(event.request);
      })
  );
});
