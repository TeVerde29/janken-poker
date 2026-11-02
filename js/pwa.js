/**
 * pwa.js — Gestión de instalación como Progressive Web App (acceso directo / app nativa).
 */

import { showToast } from './ui.js';

let deferredPrompt = null;
const DISMISSED_KEY = 'janken.pwa.dismissed';

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

export function isIos() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

export function initPWA() {
  // 1. Registro del Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('[PWA] Service Worker no se pudo registrar:', err);
      });
    });
  }

  // Si ya se está ejecutando instalada en pantalla completa, no mostrar avisos
  if (isStandalone()) {
    return;
  }

  const banner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-pwa-install');
  const btnDismiss = document.getElementById('btn-pwa-dismiss');
  const btnLobbyInstall = document.getElementById('btn-install-app');

  const showInstallUI = () => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISSED_KEY) === 'true';
    } catch { /* sin acceso a storage */ }

    if (btnLobbyInstall) btnLobbyInstall.hidden = false;
    if (banner && !dismissed) {
      banner.hidden = false;
    }
  };

  // 2. Evento para navegadores compatibles con instalación directa (Chrome, Edge, Android)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallUI();
  });

  // 3. Soporte para iOS Safari (mostrar botón en el lobby)
  if (isIos() && !isStandalone()) {
    showInstallUI();
  }

  // Acción al pulsar el botón de instalación
  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        if (banner) banner.hidden = true;
        if (btnLobbyInstall) btnLobbyInstall.hidden = true;
      }
      deferredPrompt = null;
    } else if (isIos()) {
      showToast('En Safari: toca el botón Compartir y elige «Añadir a pantalla de inicio».', 4500);
    } else {
      showToast('Usa el menú de tu navegador para añadir esta página a tu pantalla de inicio.', 4000);
    }
  };

  if (btnInstall) btnInstall.addEventListener('click', triggerInstall);
  if (btnLobbyInstall) btnLobbyInstall.addEventListener('click', triggerInstall);

  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      if (banner) banner.hidden = true;
      try {
        sessionStorage.setItem(DISMISSED_KEY, 'true');
      } catch { /* storage bloqueado */ }
    });
  }

  // 4. Se instaló la aplicación
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (banner) banner.hidden = true;
    if (btnLobbyInstall) btnLobbyInstall.hidden = true;
    showToast('¡Acceso directo instalado correctamente!');
  });
}
