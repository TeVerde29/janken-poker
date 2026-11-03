/**
 * sw.js — Service Worker para instalación de PWA y soporte offline de assets estáticos.
 */

const CACHE_NAME = 'janken-cards-v12';

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
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch {
            // Ignorar fallos individuales en precarga offline
          }
        })
      );
    }).then(() => self.skipWaiting())
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

  // No interceptar peticiones externas ni señalización de PeerJS
  if (url.origin !== self.location.origin || url.hostname.includes('peerjs.com') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Estrategia Network-First para todos los recursos propios (HTML, JS, CSS, SVG):
  // garantiza que ambos dispositivos ejecuten siempre el código más reciente cuando hay conexión,
  // usando la caché únicamente como respaldo si no hay red.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
