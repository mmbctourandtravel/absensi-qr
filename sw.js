const CACHE_NAME = 'mmbc-absen-v4';
const urlsToCache = [
    './index.html',
    './manifest.json',
    './logo.png' // Sesuaikan jika menggunakan logo.jpeg
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate & Hapus Cache Lama (Auto-Update)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Menghapus cache lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Strategy (Optimized for Web App & API)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // JANGAN CACHE request ke Google Apps Script / API eksternal
    // Biarkan selalu murni dari jaringan agar data absen & rekap selalu real-time
    if (url.origin.includes('script.google.com') || url.origin.includes('ipify.org')) {
        return; 
    }

    // Strategi untuk file lokal (Network First, fallback to cache)
    event.respondWith(
        fetch(event.request)
            .then(response => {
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
