const CACHE_NAME = 'nextap-v1';
const urlsToCache = [
  '/',
  '/assets/logo.png',
  '/assets/script.js',
  '/assets/manifest.json',
  '/login'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Nextap: تم فتح الذاكرة المؤقتة');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Nextap: خطأ في تثبيت الذاكرة المؤقتة', err);
      })
  );
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Nextap: حذف الذاكرة المؤقتة القديمة');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// التعامل مع الطلبات
self.addEventListener('fetch', event => {
  // تخطي الطلبات غير الـ GET
  if (event.request.method !== 'GET') {
    return;
  }

  // استراتيجية: محاولة الشبكة أولاً، ثم الذاكرة المؤقتة
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // إذا كان الرد ناجحاً، قم بحفظه في الذاكرة المؤقتة
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // إذا فشل الاتصال، استخدم الذاكرة المؤقتة
        return caches.match(event.request)
          .then(response => {
            return response || new Response('غير متاح بدون اتصال', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// معالجة الرسائل من الصفحة
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
