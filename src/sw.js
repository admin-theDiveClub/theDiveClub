// The cache name carries the build stamp, handed over by the registration in
// layout.html as /sw.js?v=<stamp>. Every deploy is therefore a new cache, and
// the activate handler below deletes the previous one — so a changed logo or
// icon reaches a device that already has the old one cached. Without this the
// fetch handler below (cache-first for images) would serve the old artwork
// forever. 'dev' is the fallback for a hand-opened /sw.js.
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `dive-club-${BUILD}`;
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/resources/branding/logo-primary-dark.svg',
  '/resources/branding/logo-primary-light.svg',
  '/favicon.ico',
  '/resources/icons/apple-touch-icon.png',
  '/resources/icons/icon-192.png',
  '/resources/icons/icon-512.png'
];

// A short link opened with no connection (docs/design/short-links.md). 404.html
// cannot do this: its scripts and styles are not in the cache. Anything else
// with no cached copy stays the browser's own offline page.
function offlineShortLink(req) {
  if (!/^\/(\d{1,15}|[tl]-[a-z0-9]{2,8}(-\d{1,9})?)\/?$/i.test(new URL(req.url).pathname)) return undefined;
  return new Response(
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1"><title>You are offline</title></head>'
    + '<body style="background:#202020;color:#f4e8d2;font-family:sans-serif;padding:2rem;text-align:center">'
    + '<h1>You are offline</h1><p>This link needs a connection. Try again when you are back online.</p></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

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
					// Only a page that loaded: a short link's 404 must be looked up afresh.
					if (res.ok) {
						const resClone = res.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
					}
					return res;
				})
				.catch(() => caches.match(req).then((cached) => cached || offlineShortLink(req)))
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