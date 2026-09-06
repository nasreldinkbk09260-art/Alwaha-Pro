/* ====================================================================
 * واحة المحترفين - Alwaha Pro 2.7.0 Service Worker
 * الملف: sw.js
 * ==================================================================== */

const CACHE_NAME = 'alwaha-pro-cache-v2.7.0';

// قائمة الأصول والمكتبات الأساسية للعمل بدون إنترنت
const ASSETS_TO_CACHE = [
  './',
  './index_2.html',
  './icon.png',
  './capacitor.js',
  // المكتبات الخارجية المستخدمة في الكود (FontAwesome, Cairo Font, Supabase)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

/* --------------------------------------------------------------------
 * 1. مرحلة التثبيت (Install): تخزين الأصول الأساسية
 * -------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching core app shell and assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting(); // التفعيل الفوري دون الانتظار
    })
  );
});

/* --------------------------------------------------------------------
 * 2. مرحلة التفعيل (Activate): تنظيف الـ Cache القديم
 * -------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // التحكم في كل العملاء المفتوحين فوراً
    })
  );
});

/* --------------------------------------------------------------------
 * 3. مرحلة جلب البيانات (Fetch): إدارة طلبات الشبكة والكاش
 * -------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // استثناء طلبات API السحابية (Supabase REST API) لضمان جلب البيانات الحية أولاً
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // في حال عدم وجود إنترنت عند استدعاء Supabase API
        return new Response(
          JSON.stringify({ error: 'Network unavailable. Operating in offline mode.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // استراتيجية Cache First مع Fallback للشبكة بالنسبة للملفات والأصول الأُخرى
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // إرجاع النسخة المخزنة مؤقتاً، مع تحديث الكاش في الخلفية
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* التجاهل عند عدم الاتصال */});

        return cachedResponse;
      }

      // إذا لم تكن الأصول في الكاش، جلبها من الشبكة وتخزينها
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // صفحة الاحتياط عند انقطاع الإنترنت الكامل لطلبات HTML
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index_2.html');
        }
      });
    })
  );
});

/* --------------------------------------------------------------------
 * 4. استقبال الإشعارات (Push Notifications)
 * -------------------------------------------------------------------- */
self.addEventListener('push', (event) => {
  let data = { title: 'واحة المحترفين', body: 'لديك تنبيه جديد في التطبيق!' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* --------------------------------------------------------------------
 * 5. التفاعل عند النقر على الإشعار
 * -------------------------------------------------------------------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // فتح التطبيق إذا كان مفتوحاً أو فتح نافذة جديدة
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || './');
      }
    })
  );
});
