// ملف sw.js - Service Worker للواحة برو لضمان العمل دون إنترنت كلياً للألعاب والشات المحلي
const CACHE_NAME = 'alwaha-pro-cache-v1'; 
const urlsToCache = [ 
  './', 
  './index.html', 
  './style.css', 
  './app.js', 
  './manifest.json', 
  './icon-192.png', // تم التعديل للاسم الحقيقي المعتمد لضمان ظهور اللوغو
  './icon-512.png'  // تم التعديل للاسم الحقيقي المعتمد لضمان ظهور اللوغو
]; 

self.addEventListener('install', event => { 
  event.waitUntil( 
    caches.open(CACHE_NAME) 
      .then(cache => { 
        console.log('تم فتح الكاش المحلي وتخزين الألعاب أوفلاين بنجاح'); 
        return cache.addAll(urlsToCache); 
      }) 
  ); 
}); 

self.addEventListener('fetch', event => { 
  event.respondWith( 
    caches.match(event.request) 
      .then(response => { 
        if (response) { 
          return response; // إرجاع النسخة المخزنة محلياً الفورية عند انقطاع الإنترنت
        } 
        return fetch(event.request); 
      }) 
  ); 
});