/**
 * main.js — Arranque, router de pantallas y controlador de partida.
 *
 * Todos los eventos de juego (los que llegan por red al guest y los que el
 * host se emite a sí mismo) pasan por una única cola serie (`enqueue`), de modo
 * que ambos clientes procesan exactamente la misma secuencia y cada animación
 * termina antes de pintar el siguiente evento.
 */
import {
  state, GAME_MODES, ROUND_PRESETS, DECK_OPTIONS, MAX_NICK, otherRole, toPerspective,
  resetMatchState, resetSession, sanitizeName,
} from './state.js';
import { HostEngine } from './rules.js';
import { net, normalizeCode, CODE_LENGTH } from './net.js';
import * as ui from './ui.js';
import * as fx from './animations.js';
import * as audio from './audio.js';
import { initPWA } from './pwa.js';

const { $ } = ui;
const NICK_KEY = 'jankencards.nickname';

let engine = null;          // solo host
let selectedIndex = null;   // carta seleccionada en la mano
let queue = Promise.resolve();
let sessionId = 0;          // invalida eventos encolados al abandonar la sala

/* ===================================================== Cola de eventos */

function enqueue(msg) {
  const sid = sessionId;
  queue = queue
    .then(() => (sid === sessionId ? handleEvent(msg) : undefined))
    .catch((err) => console.error('[janken] error procesando evento', msg?.type, err));
}

/** El motor del host emite aquí: al host localmente, al guest por red. */
function engineEmit(role, msg) {
  if (role === 'host') enqueue(msg);
  else net.send(msg);
}

async function handleEvent(msg) {
  switch (msg.type) {
    case 'room-config': return onRoomConfig(msg);
    case 'deal': return onDeal(msg);
    case 'rival-played': return onRivalPlayed(msg);
    case 'attempt-result': return onAttemptResult(msg);
    case 'round-result': return onRoundResult(msg);
    case 'game-over': return onGameOver(msg);
    case 'rematch-request': return onRematchRequest();
    default: return undefined;
  }
}

/* ===================================================== Red */

net.setHandlers({
  onData: onNetData,
  onClose: onConnectionClosed,
  onFatal: () => {
    if (state.screen === 'waiting') {
      leaveSession();
      ui.showToast('Se perdió la conexión con el servidor. Inténtalo de nuevo.');
    }
  },
});

const GUEST_EVENTS = ['room-config', 'deal', 'rival-played', 'attempt-result', 'round-result', 'game-over', 'rematch-request'];

function onNetData(msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

  if (state.role === 'host') {
    switch (msg.type) {
      case 'join': {
        if (state.rivalName || !engine) return;
        state.rivalName = sanitizeName(msg.name) || 'Rival';
        const config = {
          type: 'room-config',
          mode: state.gameMode,
          deckSize: state.deckSize,
          rounds: state.totalRounds,
          hostName: state.nickname,
        };
        net.send(config);
        enqueue(config);
        engine.startMatch();
        break;
      }
      case 'play':
        engine?.play('guest', msg.card, msg.attempt, msg.round);
        break;
      case 'rematch-accept':
        if (state.rematch.requested && engine) {
          state.rematch.requested = false;
          engine.startMatch();
        }
        break;
      default:
        break;
    }
    return;
  }

  // Guest
  if (msg.type === 'room-full') {
    leaveSession();
    showJoinError('La sala ya está completa.');
    return;
  }
  if (GUEST_EVENTS.includes(msg.type)) enqueue(msg);
}

function onConnectionClosed() {
  const inMatch = state.screen === 'game' || state.screen === 'gameover';
  if (state.role === 'host' && !inMatch) {
    // El guest se fue antes de empezar: la sala sigue esperando a otro.
    state.rivalName = '';
    return;
  }
  sessionId++;
  engine = null;
  state.canPlay = false;
  ui.showDisconnect(state.role === 'host' ? 'Tu rival se ha desconectado.' : 'El anfitrión se ha desconectado o cerró la sala.');
}

/** Cierra la conexión y vuelve al menú. */
function leaveSession() {
  sessionId++;
  queue = Promise.resolve();
  net.destroy();
  engine = null;
  selectedIndex = null;
  resetSession();
  fx.clearConfetti();
  ui.hideDisconnect();
  ui.setTiebreakBanner(false);
  goMenu();
}

/* ===================================================== Eventos de juego */

async function onRoomConfig(msg) {
  state.gameMode = msg.mode || 'classic';
  state.deckSize = msg.deckSize || (msg.rounds * 6);
  state.totalRounds = msg.rounds;
  if (state.role === 'guest') state.rivalName = sanitizeName(msg.hostName) || 'Anfitrión';
  resetMatchState();
  prepareBoard();
  ui.showScreen('game');
  ui.setStatus(state.gameMode === 'classic' ? 'Preparando duelo clásico…' : 'Barajando el mazo…', 'wait');
  await fx.wait(400);
}

function prepareBoard() {
  ui.renderScoreboard();
  ui.clearArena();
  ui.renderHistory([]);
  ui.renderRivalHand(3);
  ui.renderAttemptLabel(1);
  ui.setTiebreakBanner(false);
  $('hand').replaceChildren();
  $('btn-play').disabled = true;
}

async function onDeal(msg) {
  if (state.screen !== 'game') {
    // Revancha: venimos de la pantalla final.
    fx.clearConfetti();
    resetMatchState();
    prepareBoard();
    ui.showScreen('game');
  }
  if (msg.mode) state.gameMode = msg.mode;
  state.currentRound = msg.round;
  state.totalRounds = msg.totalRounds;
  state.isTiebreak = Boolean(msg.isTiebreak);
  state.tiebreakNumber = msg.tiebreakNumber || 0;
  state.scores = toPerspective(msg.scores);
  state.myHand = msg.hand.map((type) => ({ type, played: false }));
  state.currentAttempt = 1;
  state.roundHistory = [];
  state.myPlay = null;
  state.rivalPlay = null;
  state.canPlay = false;
  selectedIndex = null;

  ui.renderScoreboard();
  ui.clearArena();
  ui.renderHistory([]);
  ui.renderAttemptLabel(1);
  ui.renderRivalHand(3);

  if (state.isTiebreak) {
    ui.setStatus(state.tiebreakNumber > 1 ? 'Desempate nulo: ¡se repite!' : 'Empate en puntos: ¡desempate!', 'info');
    await fx.showBanner($('tiebreak-banner'));
  } else {
    ui.setTiebreakBanner(false);
    ui.setStatus('Repartiendo cartas…', 'info');
  }

  ui.renderHand(true);
  await fx.wait(550);
  enableTurn();
}

function enableTurn() {
  state.canPlay = true;
  selectedIndex = null;
  ui.updateHand(null);
  ui.setStatus(state.rivalPlay ? 'El rival ya eligió. ¡Tu turno!' : 'Tu turno: elige una carta', 'turn');
}

function remainingRivalCards() {
  return 3 - state.roundHistory.length - (state.rivalPlay ? 1 : 0);
}

function onRivalPlayed(msg) {
  if (msg.round !== state.currentRound || msg.attempt !== state.currentAttempt) return;
  state.rivalPlay = 'hidden';
  ui.setFaceDown('rival');
  ui.renderRivalHand(remainingRivalCards());
  audio.sfxCardSlide();
  if (state.canPlay) ui.setStatus('El rival ya eligió. ¡Tu turno!', 'turn');
}

async function onAttemptResult(msg) {
  const mine = msg[state.role];
  const theirs = msg[otherRole(state.role)];
  const outcome = msg.winner === 'tie' ? 'tie' : msg.winner === state.role ? 'win' : 'lose';

  state.canPlay = false;
  ui.updateHand(null);
  ui.setFaces(mine, theirs);
  state.rivalPlay = null;
  state.roundHistory.push({ mine, theirs, outcome });
  state.lastDuelSummary = { mine, theirs, outcome };
  ui.renderRivalHand(remainingRivalCards());
  ui.setStatus('¡Revelando!', 'info');

  audio.sfxCardFlip();
  setTimeout(() => audio.sfxClash(), 260);

  await fx.revealAttempt(
    { me: ui.slotParts('me'), rival: ui.slotParts('rival') },
    outcome,
    ui.setArenaResult,
  );

  if (outcome === 'win') audio.sfxVictory();
  else if (outcome === 'tie') audio.sfxTie();

  ui.renderHistory(state.roundHistory);

  if (!msg.roundOver) {
    // Empate con cartas restantes: siguiente intento.
    state.currentAttempt = msg.attempt + 1;
    state.myPlay = null;
    ui.clearArena();
    ui.renderAttemptLabel(state.currentAttempt);
    enableTurn();
    if (!state.rivalPlay) ui.setStatus('Empate: juega otra carta', 'turn');
  }
}

async function onRoundResult(msg) {
  const scores = toPerspective(msg.scores);
  if (msg.nula) {
    ui.setStatus(msg.isTiebreak ? 'Desempate nulo: se repetirá' : 'Ronda nula: nadie suma', 'info');
    await fx.nulaRound($('overlay-nula'));
    state.scores = scores;
    await fx.wait(300);
    return;
  }
  const iWon = msg.winner === state.role;
  state.scores = scores;
  ui.renderScoreboard();
  fx.bumpScore($(iWon ? 'score-me' : 'score-rival'));
  if (iWon) audio.sfxVictory();

  if (msg.isTiebreak) ui.setStatus(iWon ? '¡Ganas el desempate!' : 'El rival gana el desempate', 'info');
  else ui.setStatus(iWon ? '¡Ganas la ronda! +1 punto' : 'El rival gana la ronda', 'info');
  await fx.wait(1400);
}

async function onGameOver(msg) {
  state.scores = toPerspective(msg.scores);
  state.matchWinner = msg.winner;
  state.canPlay = false;
  state.rematch = { requested: false, offered: false, ready: false };
  const won = msg.winner === state.role;
  ui.setTiebreakBanner(false);

  ui.renderGameOver({
    won,
    tiebreaks: msg.tiebreaks || 0,
    lastDuel: state.lastDuelSummary,
  });

  ui.setRematchUI({
    label: 'Solicitar revancha',
    disabled: false,
    note: state.role === 'host' ? 'Misma configuración de mazo.' : 'La revancha la inicia el anfitrión.',
  });
  ui.showScreen('gameover');
  if (won) {
    audio.sfxVictory();
    fx.launchConfetti();
  }
}

function onRematchRequest() {
  if (state.role !== 'guest' || state.screen !== 'gameover') return;
  state.rematch.offered = true;
  if (state.rematch.ready) {
    net.send({ type: 'rematch-accept' });
    ui.setRematchUI({ label: 'Preparando…', disabled: true, note: '¡Revancha aceptada!' });
  } else {
    ui.setRematchUI({ label: 'Aceptar revancha', disabled: false, note: `¡${state.rivalName} quiere la revancha!` });
  }
}

/* ===================================================== Acciones del jugador */

function selectCard(index) {
  if (!state.canPlay) return;
  const card = state.myHand[index];
  if (!card || card.played) return;
  selectedIndex = selectedIndex === index ? null : index;
  ui.updateHand(selectedIndex);
  audio.sfxCardSelect();
  fx.vibrate(10);
}

function confirmPlay() {
  if (!state.canPlay || selectedIndex === null) return;
  const card = state.myHand[selectedIndex];
  if (!card || card.played) return;

  card.played = true;
  state.myPlay = card.type;
  state.canPlay = false;
  selectedIndex = null;
  ui.updateHand(null);
  ui.setFaceDown('me');
  ui.setStatus(state.rivalPlay ? 'Revelando…' : 'Esperando jugada del rival…', 'wait');
  audio.sfxCardSlide();
  fx.vibrate(18);

  const play = { type: 'play', card: card.type, attempt: state.currentAttempt, round: state.currentRound };
  if (state.role === 'host') engine?.play('host', play.card, play.attempt, play.round);
  else net.send(play);
}

function requestRematch() {
  fx.vibrate(15);
  audio.sfxCardSelect();
  if (state.role === 'host') {
    if (!net.connected) return;
    state.rematch.requested = true;
    net.send({ type: 'rematch-request' });
    ui.setRematchUI({ label: 'Esperando…', disabled: true, note: `Esperando a que ${state.rivalName} acepte…` });
    return;
  }
  if (state.rematch.offered) {
    net.send({ type: 'rematch-accept' });
    ui.setRematchUI({ label: 'Preparando…', disabled: true, note: '¡Revancha aceptada!' });
  } else {
    state.rematch.ready = true;
    ui.setRematchUI({ label: 'Listo', disabled: true, note: 'Esperando a que el anfitrión inicie la revancha…' });
  }
}

/* ===================================================== Pantallas */

function initLogin() {
  const input = $('nickname-input');
  input.maxLength = MAX_NICK;
  let saved = '';
  try { saved = localStorage.getItem(NICK_KEY) || ''; } catch { /* almacenamiento bloqueado */ }
  input.value = sanitizeName(saved);

  $('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = sanitizeName(input.value);
    if (!name) {
      $('login-error').textContent = 'Escribe un nombre para continuar.';
      input.focus();
      return;
    }
    $('login-error').textContent = '';
    state.nickname = name;
    try { localStorage.setItem(NICK_KEY, name); } catch { /* sin persistencia */ }
    audio.sfxCardSelect();
    fx.vibrate(10);
    goMenu();
  });
}

function goMenu() {
  $('menu-name').textContent = state.nickname;
  $('join-form').hidden = true;
  $('btn-join').setAttribute('aria-expanded', 'false');
  showJoinError('');
  ui.showScreen('menu');
}

function showJoinError(text) {
  $('join-error').textContent = text;
  if (text) {
    $('join-form').hidden = false;
    $('btn-join').setAttribute('aria-expanded', 'true');
  }
}

function initMenu() {
  $('btn-create').addEventListener('click', () => {
    audio.sfxCardSelect();
    fx.vibrate(10);
    ui.showScreen('config');
  });

  $('btn-join').addEventListener('click', () => {
    const form = $('join-form');
    form.hidden = !form.hidden;
    $('btn-join').setAttribute('aria-expanded', String(!form.hidden));
    audio.sfxCardSelect();
    if (!form.hidden) $('code-input').focus();
  });

  $('btn-rename').addEventListener('click', () => {
    $('nickname-input').value = state.nickname;
    audio.sfxCardSelect();
    ui.showScreen('login');
  });

  const codeInput = $('code-input');
  codeInput.maxLength = CODE_LENGTH;
  codeInput.addEventListener('input', () => {
    codeInput.value = normalizeCode(codeInput.value);
    showJoinError('');
  });

  $('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = normalizeCode(codeInput.value);
    if (code.length !== CODE_LENGTH) {
      showJoinError(`El código tiene ${CODE_LENGTH} caracteres.`);
      return;
    }
    const btn = $('btn-join-go');
    ui.setButtonBusy(btn, true, 'Conectando…');
    codeInput.disabled = true;
    showJoinError('');
    audio.sfxCardSelect();
    fx.vibrate(10);
    try {
      resetSession();
      state.role = 'guest';
      state.roomCode = code;
      await net.join(code);
      net.send({ type: 'join', name: state.nickname });
      $('join-error').textContent = 'Conectado. Esperando al anfitrión…';
    } catch (err) {
      resetSession();
      const msg = err?.type === 'no-peerjs'
        ? 'No se pudo cargar PeerJS. Revisa tu conexión.'
        : ['network', 'server-error', 'socket-error', 'socket-closed'].includes(err?.type)
          ? 'No se pudo contactar con el servidor. Revisa tu conexión.'
          : 'Código inválido o sala cerrada.';
      showJoinError(msg);
    } finally {
      ui.setButtonBusy(btn, false);
      codeInput.disabled = false;
    }
  });
}

function initConfig() {
  const list = $('deck-options');
  const tabClassic = $('tab-mode-classic');
  const tabStrategic = $('tab-mode-strategic');
  const modeSummary = $('mode-summary');
  const btnCreate = $('btn-config-create');

  function renderPresets(mode) {
    state.gameMode = mode;
    const isClassic = mode === 'classic';

    if (tabClassic) {
      tabClassic.classList.toggle('is-active', isClassic);
      tabClassic.setAttribute('aria-selected', String(isClassic));
    }
    if (tabStrategic) {
      tabStrategic.classList.toggle('is-active', !isClassic);
      tabStrategic.setAttribute('aria-selected', String(!isClassic));
    }

    if (modeSummary) {
      modeSummary.textContent = isClassic
        ? 'En cada ronda ambos duelistas juegan con 1 Piedra, 1 Papel y 1 Tijera. Duelo psicológico puro.'
        : 'Mazo cerrado barajado al inicio con tercios exactos. Las cartas jugadas se consumen y no regresan.';
    }

    if (btnCreate) {
      btnCreate.textContent = isClassic ? 'Crear sala clásica' : 'Crear sala y barajar';
    }

    list.replaceChildren();

    ROUND_PRESETS.forEach((opt) => {
      const label = document.createElement('label');
      label.className = 'mode-card';
      if (opt.recommended) label.classList.add('is-recommended');

      const desc = isClassic ? opt.classicDesc : opt.strategicDesc;
      const badge = isClassic ? `${opt.rounds} rondas` : `${opt.size} cartas (${opt.rounds} rondas)`;
      const visualTitle = isClassic
        ? '1 Piedra, 1 Papel y 1 Tijera'
        : `${opt.perType} Piedras, ${opt.perType} Papeles, ${opt.perType} Tijeras`;

      label.innerHTML = `
        <input type="radio" name="rounds" value="${opt.rounds}" ${opt.recommended ? 'checked' : ''}>
        <div class="mode-card-content">
          <div class="mode-visual" aria-hidden="true">
            <div class="archetype-icons">
              <img src="assets/icons/piedra.svg" alt="" title="${visualTitle}">
              <img src="assets/icons/papel.svg" alt="" title="${visualTitle}">
              <img src="assets/icons/tijera.svg" alt="" title="${visualTitle}">
            </div>
          </div>
          <div class="mode-info">
            <div class="mode-header">
              <span class="mode-title">${opt.title}</span>
              <span class="mode-badge">${badge}</span>
            </div>
            <p class="mode-desc">${desc}</p>
          </div>
          <div class="mode-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>`;

      label.addEventListener('click', () => audio.sfxCardSelect());
      list.append(label);
    });
  }

  if (tabClassic) {
    tabClassic.addEventListener('click', () => {
      if (state.gameMode !== 'classic') {
        audio.sfxCardSelect();
        renderPresets('classic');
      }
    });
  }

  if (tabStrategic) {
    tabStrategic.addEventListener('click', () => {
      if (state.gameMode !== 'strategic') {
        audio.sfxCardSelect();
        renderPresets('strategic');
      }
    });
  }

  renderPresets(state.gameMode || 'classic');

  $('btn-config-back').addEventListener('click', () => {
    audio.sfxCardSelect();
    ui.showScreen('menu');
  });

  $('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rounds = Number(new FormData(e.target).get('rounds') || new FormData(e.target).get('deck'));
    const opt = ROUND_PRESETS.find((o) => o.rounds === rounds || o.size === rounds) || ROUND_PRESETS[1];
    const btn = $('btn-config-create');
    ui.setButtonBusy(btn, true, 'Creando sala…');
    audio.sfxCardSlide();
    fx.vibrate(10);
    try {
      resetSession();
      state.role = 'host';
      state.totalRounds = opt.rounds;
      state.deckSize = opt.size;
      const code = await net.host();
      state.roomCode = code;
      engine = new HostEngine({ mode: state.gameMode, rounds: opt.rounds, deckSize: opt.size }, engineEmit);
      if (state.gameMode === 'classic') {
        $('waiting-info').textContent = `Modo Clásico · ${opt.rounds} rondas (1 Piedra, 1 Papel, 1 Tijera cada ronda)`;
      } else {
        $('waiting-info').textContent = `Mazo Estratégico · Mazo de ${opt.size} cartas (${opt.rounds} rondas)`;
      }
      $('btn-copy-label').textContent = 'Copiar';
      ui.renderWaitingFaceoff();
      ui.showScreen('waiting');
    } catch (err) {
      net.destroy();
      resetSession();
      ui.showToast(err?.type === 'no-peerjs'
        ? 'No se pudo cargar PeerJS. Revisa tu conexión.'
        : 'No se pudo crear la sala. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      ui.setButtonBusy(btn, false);
    }
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function initWaiting() {
  $('btn-copy').addEventListener('click', async () => {
    const ok = await copyText(state.roomCode || '');
    const label = $('btn-copy-label');
    label.textContent = ok ? '¡Copiado!' : 'Error';
    $('btn-copy').classList.toggle('is-copied', ok);
    audio.sfxCardSelect();
    fx.vibrate(15);
    clearTimeout(initWaiting.timer);
    initWaiting.timer = setTimeout(() => {
      label.textContent = 'Copiar';
      $('btn-copy').classList.remove('is-copied');
    }, 1800);
  });
  $('btn-cancel-room').addEventListener('click', () => {
    audio.sfxCardSelect();
    leaveSession();
  });
}

function initGame() {
  const hand = $('hand');
  hand.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) selectCard(Number(card.dataset.index));
  });
  hand.addEventListener('dblclick', (e) => {
    const card = e.target.closest('.card');
    if (!card || !state.canPlay) return;
    selectedIndex = Number(card.dataset.index);
    confirmPlay();
  });
  $('btn-play').addEventListener('click', confirmPlay);

  const soundBtn = $('btn-audio-toggle');
  soundBtn.addEventListener('click', () => {
    const active = audio.toggleAudio();
    soundBtn.classList.toggle('is-muted', !active);
    soundBtn.setAttribute('title', active ? 'Silenciar sonido' : 'Activar sonido');
    if (active) audio.sfxCardSelect();
  });

  $('btn-leave-game').addEventListener('click', () => {
    audio.sfxCardSelect();
    if (window.confirm('¿Seguro que quieres abandonar la partida?')) leaveSession();
  });
}

function initGameOver() {
  $('btn-rematch').addEventListener('click', requestRematch);
  $('btn-gameover-menu').addEventListener('click', () => {
    audio.sfxCardSelect();
    leaveSession();
  });
  $('btn-disconnect-menu').addEventListener('click', () => {
    audio.sfxCardSelect();
    leaveSession();
  });
}

/* ===================================================== Arranque */

function boot() {
  ui.preloadCards();
  initPWA();
  initLogin();
  initMenu();
  initConfig();
  initWaiting();
  initGame();
  initGameOver();
  window.addEventListener('pagehide', () => net.destroy());
  ui.showScreen('login');
}

boot();
