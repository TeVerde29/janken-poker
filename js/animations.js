/**
 * animations.js — Control de animaciones de juego.
 * Solo añade/quita clases definidas en css/animations.css y espera a que terminen.
 * Respeta prefers-reduced-motion acortando esperas y omitiendo efectos no esenciales.
 */

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => motionQuery.matches;

/** Espera `ms` (más corta con movimiento reducido). */
export function wait(ms) {
  const t = prefersReducedMotion() ? Math.round(ms * 0.35) : ms;
  return new Promise((resolve) => setTimeout(resolve, t));
}

/** Quita y vuelve a poner una clase para reiniciar su animación. */
export function restartClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // fuerza reflow
  el.classList.add(cls);
}

/**
 * Aplica una clase animada y resuelve al terminar (animationend propio)
 * o tras un tiempo de seguridad (p. ej. si la animación está desactivada).
 */
export function playClass(el, cls, fallbackMs) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('animationend', onEnd);
      resolve();
    };
    const onEnd = (e) => { if (e.target === el) finish(); };
    el.addEventListener('animationend', onEnd);
    restartClass(el, cls);
    setTimeout(finish, prefersReducedMotion() ? 60 : fallbackMs + 120);
  });
}

/** Vibración corta en móvil (solo tras interacción del usuario). */
export function vibrate(pattern = 12) {
  if (!('vibrate' in navigator)) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate(pattern); } catch { /* no soportado */ }
}

/** Banner de desempate: entra deslizando y luego pulsa. */
export async function showBanner(el) {
  el.hidden = false;
  el.classList.remove('banner-pulse');
  await playClass(el, 'banner-slide-in', 400);
  el.classList.remove('banner-slide-in');
  if (!prefersReducedMotion()) el.classList.add('banner-pulse');
}

/** Rebote del marcador. */
export function bumpScore(el) {
  return playClass(el, 'score-bump', 400);
}

/**
 * Secuencia completa de revelación de un intento:
 * volteo simultáneo → acercamiento → choque → victoria/derrota o empate.
 * @param {{me: object, rival: object}} parts piezas devueltas por ui.slotParts
 * @param {'win'|'lose'|'tie'} outcome desde la perspectiva local
 * @param {(text: string, kind: string) => void} setResult pinta el texto central
 */
export async function revealAttempt(parts, outcome, setResult) {
  const arena = document.getElementById('arena');
  const { me, rival } = parts;

  // 1. Volteo 3D simultáneo (la clase se queda: fija la cara visible).
  await Promise.all([playClass(me.inner, 'card-flip', 600), playClass(rival.inner, 'card-flip', 600)]);

  // 2. Las cartas se desplazan al centro y chocan.
  arena.classList.add('is-meeting');
  await wait(260);
  await Promise.all([playClass(me.clash, 'card-clash', 300), playClass(rival.clash, 'card-clash', 300)]);
  me.clash.classList.remove('card-clash');
  rival.clash.classList.remove('card-clash');

  // 3. Resultado.
  if (outcome === 'tie') {
    setResult('EMPATE', 'tie');
    await Promise.all([playClass(me.clash, 'tie-shake', 400), playClass(rival.clash, 'tie-shake', 400)]);
    await wait(700);
    return;
  }
  const [winner, loser] = outcome === 'win' ? [me, rival] : [rival, me];
  winner.fx.classList.add('card-win');
  loser.fx.classList.add('card-lose');
  setResult(outcome === 'win' ? '¡GANAS!' : 'PIERDES', outcome);
  await wait(1300);
}

/** Overlay "RONDA NULA" y desvanecimiento de las cartas de la arena. */
export async function nulaRound(overlay) {
  document.querySelectorAll('#arena .slot-fx').forEach((el) => el.classList.add('card-fade-out'));
  await playClass(overlay, 'nula-overlay-fade', 1500);
  overlay.classList.remove('nula-overlay-fade');
}

/** Confeti de CSS puro: partículas generadas y eliminadas al terminar. */
export function launchConfetti(count = 90) {
  if (prefersReducedMotion()) return;
  const layer = document.getElementById('confetti-layer');
  layer.replaceChildren();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'confetti confetti-fall';
    const size = 6 + Math.random() * 8;
    c.style.left = `${Math.random() * 100}vw`;
    c.style.width = `${size}px`;
    c.style.height = `${size * 1.7}px`;
    c.style.animationDuration = `${2.4 + Math.random() * 1.8}s`;
    c.style.animationDelay = `${Math.random() * 0.9}s`;
    if (i % 3 === 0) c.style.borderRadius = '50%';
    frag.append(c);
  }
  layer.append(frag);
  clearTimeout(launchConfetti.timer);
  launchConfetti.timer = setTimeout(() => layer.replaceChildren(), 5200);
}

export function clearConfetti() {
  clearTimeout(launchConfetti.timer);
  document.getElementById('confetti-layer').replaceChildren();
}
