// SAN BENITO MIX 2026 — Senior Offline-First & Auto-Update Service Worker
const CACHE_NAME = 'sbm-cache-v10-ota';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/san-benito-logo.jpg',
  '/icon-192.png',
  '/icon-512.png',
];

// 1. Instalación inmediata sin esperas (Skip Waiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Aviso en pre-cache inicial:', err);
      });
    })
  );
});

// 2. Activación: Purga inmediata de todas las versiones antiguas y toma de control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[SW] 🗑️ Purgando caché obsoleta:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
      .then(() => {
        // Notificar a todas las ventanas abiertas que la nueva versión ya está activa
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'OTA_UPDATE_APPLIED', cacheName: CACHE_NAME });
          });
        });
      })
  );
});

// 3. Receptor de mensajes para Actualización Instantánea OTA
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    console.log('[SW] 🚀 Forzando activación inmediata de nueva versión...');
    self.skipWaiting();
  }
});

// 4. Estrategia de Fetch Inteligente: Network-First para código, Cache para Offline
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar peticiones que no sean GET o sean de APIs externas en vivo / WebSockets / SSE
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/sse') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('binance.com') ||
    url.hostname.includes('dolarapi.com') ||
    url.hostname.includes('pydolarve.org') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // En entorno Vite de desarrollo, omitir caché para scripts TSX/TS/Vite
  // para que cualquier cambio en caliente se refleje inmediatamente en el teléfono
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('vite') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // A. NAVEGACIÓN HTML (Network-First con respaldo Offline)
  // Si hay red o Wi-Fi, siempre trae el HTML más reciente. Si está sin señal, abre el caché.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html', { ignoreSearch: true });
          if (cached) return cached;
          const rootCached = await caches.match('/', { ignoreSearch: true });
          if (rootCached) return rootCached;
          return caches.match(req, { ignoreSearch: true });
        })
    );
    return;
  }

  // B. ASSETS ESTÁTICOS DE PRODUCCIÓN (JS compilados con hash, CSS, Imágenes, Fuentes)
  // Network-First para bundles JS/CSS para asegurar la última versión; Fallback a Caché instantáneo
  const isStaticBundle =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.includes('/assets/');

  if (isStaticBundle) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req, { ignoreSearch: true });
          return cached;
        })
    );
    return;
  }

  // C. DEMÁS RECURSOS (Imágenes de logo, manifest, etc.)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
