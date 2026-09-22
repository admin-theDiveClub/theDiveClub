const CACHE_NAME = 'dive-club-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/resources/branding/logo-primary-dark.svg',
  '/favicon.ico',
  '/resources/icons/apple-touch-icon.png',
  '/resources/icons/icon-192.png',
  '/resources/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch (err) {
		console.error('[SW] Push payload was not valid JSON:', err);
		data = {};
	}

	const title = data.title || 'TDC (No Title)';
	const body = data.body || 'TDC (No Body)';

	console.log('[SW] Push received:', { title, body, raw: data });

	const options = {
		body: body,
		icon: '/resources/icons/icon-192.png',
		badge: '/resources/icons/icon-192.png',
		data: { url: data.url || '/' }
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	console.log('[SW] Notification clicked:', event.notification);
	event.notification.close();
	event.waitUntil(
		clients.openWindow(event.notification.data.url || '/')
	);
});