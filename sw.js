/**
 * sw.js — Service Worker para instalación de PWA y soporte offline de assets estáticos.
 */

const CACHE_NAME = 'janken-cards-v8';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './privacidad.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/screens.css',
  './css/game.css',
  './css/animations.css',
  './js/main.js',
  './js/ui.js',
  './js/state.js',
  './js/rules.js',
  './js/deck.js',
  './js/net.js',
  './js/audio.js',
  './js/animations.js',
  './js/pwa.js',
  './assets/icons/piedra.svg',
  './assets/icons/papel.svg',
  './assets/icons/tijera.svg',
  './assets/icons/jc.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/og-image.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No interceptar peticiones directas de señalización de PeerJS (WebSocket / 0.peerjs.com)
  if (url.hostname.includes('peerjs.com') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Para peticiones de navegación HTML (como abrir la app o recargar la página):
  // Usar Network-First con fallback a caché. Garantiza que la app siempre tome la última versión si hay red.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
