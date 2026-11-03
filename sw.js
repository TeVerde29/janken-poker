/**
 * sw.js — Service Worker para instalación de PWA y soporte offline de assets estáticos.
 */

const CACHE_NAME = 'janken-cards-v14';

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
  './assets/icons/logo-emblem.svg',
  './assets/icons/deck-3d-stack.svg',
  './assets/icons/fx-card-selected.svg',
  './assets/icons/fx-card-locked.svg',
  './assets/icons/fx-card-reveal.svg',
  './assets/icons/fx-victory.svg',
  './assets/icons/fx-draw.svg',
  './assets/icons/fx-defeat.svg',
  './assets/icons/fx-gold-particles.svg',
  './assets/icons/bg-game-table.svg',
  './assets/icons/waiting-room-elements.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/og-image.png',
  './assets/renders/01-logo-emblem.png',
  './assets/renders/02-card-back.png',
  './assets/renders/03-card-piedra.png',
  './assets/renders/04-card-papel.png',
  './assets/renders/05-card-tijera.png',
  './assets/renders/06-deck-3d-stack.png',
  './assets/renders/08-fx-card-locked.png',
  './assets/renders/10-fx-victory-crest.png',
  './assets/renders/13-fx-gold-particles.png',
  './assets/renders/14-bg-game-table.png',
  './assets/renders/15-waiting-room-arena-disc.png'
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
