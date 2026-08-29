// قم بتغيير الرقم (v1.0.1 -> v1.0.2) مع كل تحديث جديد للأكواد
const CACHE_NAME = 'alwaha-pro-v1.0.2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// التثبيت وجلب الملفات الجديدة
self.addEventListener('install', (event) => {
  self.skipWaiting(); // التجاوز الفوري للإصدار القديم
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// تفعيل الإصدار الجديد ومسح الكاش القديم تماماً
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('حذف الكاش القديم:', cache);
            return caches.delete(cache); // مسح الملفات القديمة
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// استراتيجية النتوورك أولاً (Network First) لضمان جلب أحدث كود دائماً
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // إذا وجد إنترنت يجلب الأكواد الجديدة ويحدث الكاش
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // في حال عدم وجود إنترنت يفتح المخبأ سابقاً
        return caches.match(event.request);
      })
  );
});
