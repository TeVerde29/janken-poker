/**
 * ui.js — Renderizado de pantallas, cartas, marcador, arena e historial.
 * No contiene lógica de red ni reglas: solo pinta lo que hay en `state`.
 */
import { state, MAX_ATTEMPTS } from './state.js';
import { restartClass } from './animations.js';

const ICONS = 'assets/icons/';
export const CARD_LABEL = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' };

export const $ = (id) => document.getElementById(id);

/** Precarga las imágenes de las cartas para que el volteo no muestre huecos. */
export function preloadCards() {
  ['piedra', 'papel', 'tijera', 'jc'].forEach((n) => {
    const img = new Image();
    img.src = `${ICONS}${n}.svg`;
  });
}

export function cardImg(type) {
  const img = document.createElement('img');
  img.src = `${ICONS}${type}.svg`;
  img.alt = type === 'jc' ? 'Carta boca abajo' : CARD_LABEL[type];
  img.draggable = false;
  img.decoding = 'async';
  return img;
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
    b.append(cardImg(card.type));
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

/** Estructura: fx (win/lose) > clash (shake) > flip (perspectiva) > inner (rotación) > caras. */
function buildSlotCard() {
  const fx = document.createElement('div');
  fx.className = 'slot-fx';
  fx.innerHTML = `
    <div class="slot-clash">
      <div class="flip">
        <div class="flip-inner">
          <div class="face face--front"></div>
          <div class="face face--back"></div>
        </div>
      </div>
    </div>`;
  fx.querySelector('.face--back').append(cardImg('jc'));
  return fx;
}

export function clearArena() {
  for (const who of ['me', 'rival']) {
    const holder = slotHolder(who);
    const ph = document.createElement('div');
    ph.className = 'slot-empty';
    ph.innerHTML = '<span class="slot-empty-icon" aria-hidden="true">🎴</span>';
    holder.replaceChildren(ph);
  }
  $('arena').classList.remove('is-meeting');
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

/** Coloca las caras reales (aún ocultas por el dorso) antes del volteo. */
export function setFaces(mine, theirs) {
  setFaceDown('me');
  setFaceDown('rival');
  for (const [who, type] of [['me', mine], ['rival', theirs]]) {
    const front = slotHolder(who).querySelector('.face--front');
    front.className = `face face--front card--${type}`;
    front.replaceChildren(cardImg(type));
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
const OUTCOME_ICON = { win: '✓', lose: '✕', tie: '=' };

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
    badge.textContent = OUTCOME_ICON[h.outcome];

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
