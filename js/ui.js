/**
 * ui.js — Renderizado de pantallas, cartas, marcador, arena e historial.
 * No contiene lógica de red ni reglas: solo pinta lo que hay en `state`.
 */
import { state, MAX_ATTEMPTS } from './state.js';
import { restartClass } from './animations.js';

const ICONS = 'assets/icons/';
const RENDERS = 'assets/renders/';

export const CARD_LABEL = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' };

export const CARD_RENDER_MAP = {
  jc: `${RENDERS}02-card-back.png`,
  piedra: `${RENDERS}03-card-piedra.png`,
  papel: `${RENDERS}04-card-papel.png`,
  tijera: `${RENDERS}05-card-tijera.png`,
};

export const $ = (id) => document.getElementById(id);

/** Precarga todos los recursos 3D (.PNG) y vectoriales (.SVG) para transiciones instantáneas. */
export function preloadCards() {
  const urls = [
    ...Object.values(CARD_RENDER_MAP),
    `${RENDERS}01-logo-emblem.png`,
    `${RENDERS}06-deck-3d-stack.png`,
    `${RENDERS}08-fx-card-locked.png`,
    `${RENDERS}10-fx-victory-crest.png`,
    `${RENDERS}13-fx-gold-particles.png`,
    `${RENDERS}14-bg-game-table.png`,
    `${RENDERS}15-waiting-room-arena-disc.png`,
    `${ICONS}piedra.svg`,
    `${ICONS}papel.svg`,
    `${ICONS}tijera.svg`,
    `${ICONS}jc.svg`,
    `${ICONS}logo-emblem.svg`,
    `${ICONS}deck-3d-stack.svg`,
    `${ICONS}fx-card-selected.svg`,
    `${ICONS}fx-card-locked.svg`,
    `${ICONS}fx-card-reveal.svg`,
    `${ICONS}fx-victory.svg`,
    `${ICONS}fx-draw.svg`,
    `${ICONS}fx-defeat.svg`,
    `${ICONS}fx-gold-particles.svg`,
    `${ICONS}bg-game-table.svg`,
    `${ICONS}waiting-room-elements.svg`,
  ];
  urls.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

/**
 * Crea la imagen principal de una carta usando el render 3D de estudio (.PNG).
 */
export function cardImg(type) {
  const img = document.createElement('img');
  img.className = 'card-render-photo';
  img.src = CARD_RENDER_MAP[type] || `${ICONS}${type}.svg`;
  img.alt = type === 'jc' ? 'Carta boca abajo' : CARD_LABEL[type];
  img.draggable = false;
  img.decoding = 'async';
  return img;
}

/**
 * Crea el glifo vectorial (.SVG) de esquina para acompañar al render 3D.
 */
export function cardVectorGlyph(type) {
  const badge = document.createElement('img');
  badge.className = 'card-vector-badge';
  badge.src = `${ICONS}${type}.svg`;
  badge.alt = '';
  badge.setAttribute('aria-hidden', 'true');
  badge.draggable = false;
  return badge;
}

/**
 * Conecta física táctil 1:1 estilo Apple HIG (inclinación 3D en tiempo real al mover el puntero).
 */
export function attachTactileCardPhysics(cardEl) {
  let rafId = null;
  const onPointerMove = (e) => {
    if (cardEl.disabled || cardEl.classList.contains('is-played')) return;
    const rect = cardEl.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateY = normX * 20;
    const rotateX = -normY * 20;
    const liftY = cardEl.classList.contains('card-select') ? -20 : -10;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      cardEl.style.transform = `translate3d(0, ${liftY}px, 34px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    });
  };
  const onPointerLeave = () => {
    if (rafId) cancelAnimationFrame(rafId);
    cardEl.style.transform = '';
  };
  cardEl.addEventListener('pointermove', onPointerMove);
  cardEl.addEventListener('pointerleave', onPointerLeave);
}

/* ---------------------------------------------------------------- Pantallas */

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => {
    const active = s.dataset.screen === name;
    s.hidden = !active;
    if (active) {
      restartClass(s, 'screen-fade-in');
      s.addEventListener('animationend', () => s.classList.remove('screen-fade-in'), { once: true });
    }
  });
  state.screen = name;
  const focusTarget = document.querySelector(`.screen[data-screen="${name}"] [data-autofocus]`);
  if (focusTarget && window.matchMedia('(hover: hover)').matches) focusTarget.focus({ preventScroll: true });
}

export function showToast(text, ms = 2800) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  restartClass(t, 'toast-in');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

export function setButtonBusy(btn, busy, busyText) {
  if (busy) {
    btn.dataset.label ??= btn.textContent;
    btn.textContent = busyText;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
  } else {
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
    delete btn.dataset.label;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}

/* ------------------------------------------------- Antesala de Espera (Face-off) */

export function renderWaitingFaceoff() {
  $('waiting-host-name').textContent = state.nickname || 'Tú';
  $('waiting-host-initial').textContent = (state.nickname || 'T').charAt(0).toUpperCase();
  $('room-code').textContent = state.roomCode || '------';
}

/* ----------------------------------------------------------------- Marcador */

export function renderScoreboard() {
  $('me-name').textContent = state.nickname;
  $('rival-name').textContent = state.rivalName || 'Rival';
  $('score-me').textContent = state.scores.me;
  $('score-rival').textContent = state.scores.rival;

  let label;
  if (state.isTiebreak) {
    label = state.tiebreakNumber > 1 ? `Desempate #${state.tiebreakNumber}` : 'Desempate';
  } else {
    label = `Ronda ${state.currentRound} de ${state.totalRounds}`;
  }
  $('round-label').textContent = label;

  const modeTag = $('board-mode-tag');
  if (modeTag) {
    modeTag.textContent = state.gameMode === 'strategic' ? 'Mazo Estratégico' : 'Modo Clásico';
  }
}

export function setTiebreakBanner(visible) {
  const b = $('tiebreak-banner');
  b.hidden = !visible;
  if (!visible) b.classList.remove('banner-slide-in', 'banner-pulse');
}

/* --------------------------------------------------------------------- Mano */

export function renderHand(animate) {
  const wrap = $('hand');
  wrap.replaceChildren();
  state.myHand.forEach((card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `card card--${card.type}`;
    b.dataset.index = String(i);
    b.setAttribute('aria-label', `Carta ${CARD_LABEL[card.type]}`);
    b.setAttribute('aria-pressed', 'false');

    // Superficie con Render 3D (.PNG), Glifo Vectorial (.SVG) y reflejo especular
    const surface = document.createElement('div');
    surface.className = 'card-surface';
    surface.append(cardImg(card.type), cardVectorGlyph(card.type));

    // Recurso 07: Efecto visual de carta seleccionada (.SVG)
    const fxSelected = document.createElement('img');
    fxSelected.className = 'card-fx-selected';
    fxSelected.src = `${ICONS}fx-card-selected.svg`;
    fxSelected.alt = '';
    fxSelected.setAttribute('aria-hidden', 'true');

    // Recurso 08: Efecto de carta bloqueada / jugada (Render 3D .PNG + Sello .SVG)
    const fxLocked = document.createElement('div');
    fxLocked.className = 'card-fx-locked';
    fxLocked.setAttribute('aria-hidden', 'true');
    fxLocked.innerHTML = `
      <img class="locked-render-bg" src="${RENDERS}08-fx-card-locked.png" alt="">
      <img class="locked-vector-seal" src="${ICONS}fx-card-locked.svg" alt="">
    `;

    b.append(surface, fxSelected, fxLocked);
    attachTactileCardPhysics(b);

    if (animate) {
      b.classList.add('card-deal');
      b.addEventListener('animationend', () => b.classList.remove('card-deal'), { once: true });
    }
    wrap.append(b);
  });
  updateHand(null);
}

/** Refresca selección, cartas jugadas, bloqueo y el botón de acción principal. */
export function updateHand(selectedIndex) {
  const wrap = $('hand');
  wrap.classList.toggle('is-locked', !state.canPlay);

  wrap.querySelectorAll('.card').forEach((el) => {
    const i = Number(el.dataset.index);
    const card = state.myHand[i];
    const selected = i === selectedIndex;
    el.classList.toggle('card-select', selected);
    el.classList.toggle('is-played', card.played);
    el.setAttribute('aria-pressed', String(selected));
    el.disabled = card.played;
    el.tabIndex = state.canPlay && !card.played ? 0 : -1;
  });

  const btnPlay = $('btn-play');
  if (selectedIndex !== null && state.myHand[selectedIndex]) {
    const card = state.myHand[selectedIndex];
    btnPlay.textContent = `Jugar ${CARD_LABEL[card.type]}`;
    btnPlay.disabled = !state.canPlay;
    btnPlay.classList.add('btn--ready');
  } else if (!state.canPlay && state.myPlay) {
    btnPlay.textContent = 'Esperando al rival…';
    btnPlay.disabled = true;
    btnPlay.classList.remove('btn--ready');
  } else {
    btnPlay.textContent = 'Selecciona una carta';
    btnPlay.disabled = true;
    btnPlay.classList.remove('btn--ready');
  }
}

/** Cartas boca abajo del rival (solo el conteo visual). */
export function renderRivalHand(count) {
  state.rivalHandCount = count;
  const wrap = $('rival-hand');
  wrap.replaceChildren();
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'mini-back' + (i >= count ? ' is-gone' : '');
    d.append(cardImg('jc'));
    wrap.append(d);
  }
  wrap.setAttribute('aria-label', `El rival tiene ${count} carta${count === 1 ? '' : 's'}`);
}

/* -------------------------------------------------------------------- Arena */

const slotHolder = (who) => $(`slot-${who}`).querySelector('.slot-card');

/** Estructura: fx (win/lose + overlays 10/12/13) > clash (shake) > flip (perspectiva) > inner (rotación) > caras. */
function buildSlotCard() {
  const fx = document.createElement('div');
  fx.className = 'slot-fx';
  fx.innerHTML = `
    <img class="slot-outcome-fx slot-outcome-fx--win jc-anim-e-victory" src="${ICONS}fx-victory.svg" alt="" aria-hidden="true">
    <img class="slot-outcome-fx slot-outcome-fx--win" src="${ICONS}fx-gold-particles.svg" alt="" aria-hidden="true">
    <img class="slot-outcome-fx slot-outcome-fx--lose" src="${ICONS}fx-defeat.svg" alt="" aria-hidden="true">
    <div class="slot-clash">
      <div class="flip">
        <div class="flip-inner">
          <div class="face face--front"></div>
          <div class="face face--back"></div>
        </div>
      </div>
    </div>`;
  const backFace = fx.querySelector('.face--back');
  backFace.append(cardImg('jc'), cardVectorGlyph('jc'));
  return fx;
}

export function clearArena() {
  for (const who of ['me', 'rival']) {
    const holder = slotHolder(who);
    const ph = document.createElement('div');
    ph.className = 'slot-empty';
    ph.innerHTML = '<svg class="slot-empty-icon" viewBox="0 0 24 32" aria-hidden="true"><rect x="2" y="2" width="20" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3"/></svg>';
    holder.replaceChildren(ph);
  }
  $('arena').classList.remove('is-meeting');
  const fxRev = $('arena-fx-reveal');
  const fxDraw = $('arena-fx-draw');
  if (fxRev) fxRev.hidden = true;
  if (fxDraw) fxDraw.hidden = true;
  setArenaResult('', null);
}

/** Muestra una carta boca abajo en el hueco indicado (si no la hay ya). */
export function setFaceDown(who) {
  const holder = slotHolder(who);
  if (holder.querySelector('.slot-fx')) return;
  const card = buildSlotCard();
  holder.replaceChildren(card);
  restartClass(card, 'slot-pop');
}

/** Coloca las caras reales (Render 3D + Glifo SVG aún ocultos por el dorso) antes del volteo. */
export function setFaces(mine, theirs) {
  setFaceDown('me');
  setFaceDown('rival');
  for (const [who, type] of [['me', mine], ['rival', theirs]]) {
    const front = slotHolder(who).querySelector('.face--front');
    front.className = `face face--front card--${type}`;
    front.replaceChildren(cardImg(type), cardVectorGlyph(type));
  }
}

/** Partes animables de un hueco de la arena. */
export function slotParts(who) {
  const holder = slotHolder(who);
  return {
    fx: holder.querySelector('.slot-fx'),
    clash: holder.querySelector('.slot-clash'),
    inner: holder.querySelector('.flip-inner'),
  };
}

export function setArenaResult(text, kind) {
  const el = $('arena-result');
  el.textContent = text;
  el.className = 'arena-result' + (kind ? ` arena-result--${kind}` : '');
  el.hidden = !text;
  if (text) restartClass(el, 'result-in');
}

export function renderAttemptLabel(attempt) {
  $('attempt-label').textContent = `Intento ${attempt} de ${MAX_ATTEMPTS}`;
}

/* ---------------------------------------------------------------- Historial */

const OUTCOME_TEXT = { win: 'Ganaste', lose: 'Perdiste', tie: 'Empate' };
const OUTCOME_ICON = {
  win: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  lose: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  tie: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>',
};

export function renderHistory(history) {
  const list = $('history');
  list.replaceChildren();
  history.forEach((h, i) => {
    const li = document.createElement('li');
    li.className = `history-item history-item--${h.outcome}`;
    li.setAttribute('aria-label', `Intento ${i + 1}: tu ${CARD_LABEL[h.mine]} contra ${CARD_LABEL[h.theirs]}. ${OUTCOME_TEXT[h.outcome]}`);

    const mine = document.createElement('span');
    mine.className = 'mini-card';
    mine.append(cardImg(h.mine));

    const badge = document.createElement('span');
    badge.className = 'history-badge';
    badge.innerHTML = OUTCOME_ICON[h.outcome];

    const theirs = document.createElement('span');
    theirs.className = 'mini-card';
    theirs.append(cardImg(h.theirs));

    li.append(mine, badge, theirs);
    list.append(li);
  });
  list.hidden = history.length === 0;
}

/* ------------------------------------------------------------------- Estado */

/** kind: 'turn' (tu turno), 'wait' (esperando, con pulso) o 'info'. */
export function setStatus(text, kind = 'info') {
  const el = $('game-status');
  el.textContent = text;
  el.className = `game-status game-status--${kind}` + (kind === 'wait' ? ' pulse-waiting' : '');
}

/* ----------------------------------------------------------- Fin de partida */

export function renderGameOver({ won, tiebreaks, lastDuel }) {
  const title = $('result-title');
  title.textContent = won ? '¡Victoria!' : 'Derrota';
  title.className = 'result-title ' + (won ? 'result-title--win' : 'result-title--lose');

  const crestImg = $('result-crest-img');
  const crestHalo = $('result-crest-halo');
  if (crestImg) {
    crestImg.src = won ? `${RENDERS}10-fx-victory-crest.png` : `${ICONS}fx-defeat.svg`;
    crestImg.classList.toggle('jc-anim-e-victory', won);
  }
  if (crestHalo) {
    crestHalo.src = won ? `${ICONS}fx-victory.svg` : `${ICONS}fx-defeat.svg`;
  }

  $('final-me-name').textContent = state.nickname;
  $('final-rival-name').textContent = state.rivalName || 'Rival';
  $('final-me').textContent = state.scores.me;
  $('final-rival').textContent = state.scores.rival;

  let sub = won
    ? `Has superado a ${state.rivalName || 'tu rival'} en el duelo.`
    : `${state.rivalName || 'Tu rival'} se lleva la victoria esta vez.`;

  if (tiebreaks > 0) {
    sub += tiebreaks > 1
      ? ` Resuelto tras ${tiebreaks} intensas rondas de desempate.`
      : ' Resuelto en la ronda de desempate.';
  }
  $('result-sub').textContent = sub;

  // Tira de cartas del último enfrentamiento si están disponibles
  const strip = $('last-duel-strip');
  const stripCards = $('last-duel-cards');
  if (lastDuel && lastDuel.mine && lastDuel.theirs) {
    strip.hidden = false;
    stripCards.replaceChildren();

    const myCard = document.createElement('div');
    myCard.className = `mini-card card--${lastDuel.mine}`;
    myCard.append(cardImg(lastDuel.mine));

    const vs = document.createElement('span');
    vs.className = 'history-badge';
    vs.textContent = 'VS';

    const rivalCard = document.createElement('div');
    rivalCard.className = `mini-card card--${lastDuel.theirs}`;
    rivalCard.append(cardImg(lastDuel.theirs));

    stripCards.append(myCard, vs, rivalCard);
  } else {
    strip.hidden = true;
  }
}

export function setRematchUI({ label, disabled, note }) {
  const btn = $('btn-rematch');
  btn.textContent = label;
  btn.disabled = disabled;
  $('rematch-note').textContent = note || '';
}

/* ----------------------------------------------------------------- Overlays */

export function showDisconnect(text) {
  $('disconnect-text').textContent = text;
  $('overlay-disconnect').hidden = false;
  $('btn-disconnect-menu').focus();
}

export function hideDisconnect() {
  $('overlay-disconnect').hidden = true;
}
