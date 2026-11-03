/**
 * pwa.js — Gestión de instalación como Progressive Web App (acceso directo / app nativa).
 */

import { showToast } from './ui.js';

let deferredPrompt = null;
const DISMISSED_KEY = 'janken.pwa.dismissed';

// Capturar el evento en el módulo lo antes posible para no perderlo
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

export function isIos() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function renderGuideSteps(container, isApple) {
  if (isApple) {
    container.innerHTML = `
      <ol class="install-steps-list">
        <li class="install-step-item">
          <span class="step-num">1</span>
          <div class="step-content">
            <p>Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.</p>
            <span class="step-badge">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Compartir
            </span>
          </div>
        </li>
        <li class="install-step-item">
          <span class="step-num">2</span>
          <div class="step-content">
            <p>Desplaza hacia abajo en las opciones y selecciona <strong>«Añadir a pantalla de inicio»</strong>.</p>
            <span class="step-badge">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Añadir a pantalla de inicio
            </span>
          </div>
        </li>
        <li class="install-step-item">
          <span class="step-num">3</span>
          <div class="step-content">
            <p>Pulsa <strong>«Añadir»</strong> arriba a la derecha. El icono de JANKEN se creará en tu pantalla de inicio.</p>
          </div>
        </li>
      </ol>
    `;
  } else {
    container.innerHTML = `
      <ol class="install-steps-list">
        <li class="install-step-item">
          <span class="step-num">1</span>
          <div class="step-content">
            <p>Abre el menú de tu navegador pulsando en los tres puntos <strong>(⋮)</strong> o el icono de instalación en la barra de direcciones.</p>
          </div>
        </li>
        <li class="install-step-item">
          <span class="step-num">2</span>
          <div class="step-content">
            <p>Selecciona <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla principal»</strong>.</p>
          </div>
        </li>
        <li class="install-step-item">
          <span class="step-num">3</span>
          <div class="step-content">
            <p>Confirma para crear el acceso directo y jugar en pantalla completa sin barras de navegador.</p>
          </div>
        </li>
      </ol>
    `;
  }
}

export function initPWA() {
  // 1. Registro seguro del Service Worker con chequeo activo de actualizaciones
  if ('serviceWorker' in navigator) {
    const registerSW = () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.update().catch(() => {});
      }).catch((err) => {
        console.warn('[PWA] Service Worker no se pudo registrar:', err);
      });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // Solo refrescar si no está a mitad de una partida para evitar interrupciones
        const activeScreen = document.querySelector('.screen:not([hidden])')?.id;
        if (activeScreen === 'screen-menu' || activeScreen === 'screen-login') {
          window.location.reload();
        }
      }
    });
  }

  // Si ya se está ejecutando en pantalla completa standalone, no molestar al jugador
  if (isStandalone()) {
    return;
  }

  const banner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-pwa-install');
  const btnDismiss = document.getElementById('btn-pwa-dismiss');
  const btnLobbyInstall = document.getElementById('btn-install-app');
  const guideModal = document.getElementById('overlay-install-guide');
  const guideBody = document.getElementById('install-guide-body');
  const btnCloseGuide = document.getElementById('btn-close-install-guide');

  // Mostrar botón permanente en el menú/lobby
  if (btnLobbyInstall) {
    btnLobbyInstall.hidden = false;
  }

  // Mostrar banner flotante inferior con retardo sutil si no fue descartado en esta sesión
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem(DISMISSED_KEY) === 'true';
  } catch { /* storage bloqueado */ }

  if (banner && !dismissed) {
    setTimeout(() => {
      if (!isStandalone() && banner.hidden) {
        banner.hidden = false;
      }
    }, 700);
  }

  const openGuideModal = () => {
    if (guideModal && guideBody) {
      renderGuideSteps(guideBody, isIos());
      guideModal.hidden = false;
    }
  };

  const closeGuideModal = () => {
    if (guideModal) {
      guideModal.hidden = true;
    }
  };

  // Disparar proceso de instalación
  const triggerInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (banner) banner.hidden = true;
          if (btnLobbyInstall) btnLobbyInstall.hidden = true;
        }
        deferredPrompt = null;
      } catch (err) {
        console.warn('[PWA] Error durante prompt de instalación:', err);
        openGuideModal();
      }
    } else {
      // Si el navegador no soporta beforeinstallprompt (como iOS Safari o desktop manual)
      openGuideModal();
    }
  };

  if (btnInstall) btnInstall.addEventListener('click', triggerInstall);
  if (btnLobbyInstall) btnLobbyInstall.addEventListener('click', triggerInstall);

  if (btnDismiss && banner) {
    btnDismiss.addEventListener('click', () => {
      banner.hidden = true;
      try {
        sessionStorage.setItem(DISMISSED_KEY, 'true');
      } catch { /* storage bloqueado */ }
    });
  }

  if (btnCloseGuide) {
    btnCloseGuide.addEventListener('click', closeGuideModal);
  }

  if (guideModal) {
    guideModal.addEventListener('click', (e) => {
      if (e.target === guideModal) {
        closeGuideModal();
      }
    });
  }

  // Evento nativo cuando la app fue instalada exitosamente
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (banner) banner.hidden = true;
    if (btnLobbyInstall) btnLobbyInstall.hidden = true;
    closeGuideModal();
    showToast('¡Acceso directo instalado correctamente!');
  });
}
