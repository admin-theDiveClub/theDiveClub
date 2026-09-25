const CACHE_NAME = 'dive-club-v2.6';
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
	const req = event.request;

	if (req.mode === 'navigate') {
		// Page loads: always try the network first, so visitors get the
		// current version. Fall back to cache only when offline.
		// cache: 'no-cache' makes the browser check with the server every time instead of reusing
		// its own stored copy (GitHub Pages allows 10 minutes), so a deploy shows up on the next page load.
		event.respondWith(
			fetch(req, { cache: 'no-cache' })
				.then((res) => {
					const resClone = res.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
					return res;
				})
				.catch(() => caches.match(req))
		);
		return;
	}

	// Everything else (CSS, images, etc.): cache-first is fine, these
	// change rarely and benefit from instant loading.
	event.respondWith(
		caches.match(req).then((cached) => cached || fetch(req))
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
        icon: data.icon || '/resources/icons/icon-192.png',
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