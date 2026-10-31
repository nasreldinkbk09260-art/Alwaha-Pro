const CACHE_NAME = 'alwaha-pro-v3.0.1-compatibility-20261030';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './games.js',
  './production-polish.js',
  './compatibility.js',
  './alwaha-native-back-handler.js',
  './assets/chess.min.js',
  './assets/backgrounds/bg-nebula.webp',
  './assets/backgrounds/bg-aurora.webp',
  './assets/backgrounds/bg-underwater.webp',
  './assets/backgrounds/bg-moonlit.webp',
  './assets/vendor/fontawesome/css/all.min.css',
  './assets/vendor/supabase/supabase.js',
  './assets/vendor/cairo/300.css',
  './assets/vendor/cairo/400.css',
  './assets/vendor/cairo/600.css',
  './assets/vendor/cairo/700.css',
  './assets/vendor/cairo/900.css',
  './assets/vendor/cairo/files/cairo-arabic-300-normal.woff',
  './assets/vendor/cairo/files/cairo-arabic-300-normal.woff2',
  './assets/vendor/cairo/files/cairo-arabic-400-normal.woff',
  './assets/vendor/cairo/files/cairo-arabic-400-normal.woff2',
  './assets/vendor/cairo/files/cairo-arabic-600-normal.woff',
  './assets/vendor/cairo/files/cairo-arabic-600-normal.woff2',
  './assets/vendor/cairo/files/cairo-arabic-700-normal.woff',
  './assets/vendor/cairo/files/cairo-arabic-700-normal.woff2',
  './assets/vendor/cairo/files/cairo-arabic-900-normal.woff',
  './assets/vendor/cairo/files/cairo-arabic-900-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-300-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-300-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-400-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-400-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-600-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-600-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-700-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-700-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-900-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-900-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-ext-300-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-ext-300-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-ext-400-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-ext-400-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-ext-600-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-ext-600-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-ext-700-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-ext-700-normal.woff2',
  './assets/vendor/cairo/files/cairo-latin-ext-900-normal.woff',
  './assets/vendor/cairo/files/cairo-latin-ext-900-normal.woff2',
  './assets/vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './assets/vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './assets/vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
  './assets/vendor/precache-list.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('alwaha-pro-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cache public Supabase images only; never cache signed URLs, API results, or private objects.
  const publicStorageOrigin = 'https://kjuixjdtqwcsnxefftrt.supabase.co';
  const isPublicStorageImage = url.origin === publicStorageOrigin &&
    url.pathname.startsWith('/storage/v1/object/public/') &&
    /\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname) &&
    !/[?&](?:token|access_token|refresh_token|signature|sig|expires|x-amz-credential)=/i.test(url.search);
  if (isPublicStorageImage) {
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const cached=await cache.match(request);
      const network=fetch(request).then(async response=>{
        const type=response.headers.get('content-type')||'';
        const size=Number(response.headers.get('content-length')||0);
        if(response.ok && /^image\//i.test(type) && (size>0 && size<=8*1024*1024)) {
          try { await cache.put(request,response.clone()); const keys=await cache.keys(); const media=keys.filter(k=>new URL(k.url).origin===publicStorageOrigin&&new URL(k.url).pathname.startsWith('/storage/v1/object/public/')); for(const old of media.slice(0,Math.max(0,media.length-160)))await cache.delete(old); } catch(e) {}
        }
        return response;
      }).catch(()=>cached);
      return cached||network;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('Authorization')) return;
  if (/[?&](?:token|access_token|refresh_token|signature|sig|expires|x-amz-credential)=/i.test(url.search)) return;
  if (/\/(?:auth|rest\/v1|storage\/v1|functions\/v1)(?:\/|$)/i.test(url.pathname)) return;

  const staticPath = /\.(?:css|js|mjs|json|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm)$/i.test(url.pathname);
  if (request.mode !== 'navigate' && !staticPath) return;
  const cacheable = (response) => {
    if (!response || !response.ok) return false;
    const policy = response.headers.get('Cache-Control') || '';
    return !/(?:^|,)\s*(?:private|no-store)\b/i.test(policy);
  };

  // HTML/navigation: network first, fallback to cached app shell while offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkPromise = fetch(request)
        .then((response) => {
          if (cacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cachedResponse);
      return cachedResponse || networkPromise;
    })
  );
});
