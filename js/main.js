/**
 * main.js â€” Arranque, router de pantallas y controlador de partida.
 *
 * Todos los eventos de juego (los que llegan por red al guest y los que el
 * host se emite a sÃ­ mismo) pasan por una Ãºnica cola serie (`enqueue`), de modo
 * que ambos clientes procesan exactamente la misma secuencia y cada animaciÃ³n
 * termina antes de pintar el siguiente evento.
 */
import {
  state, DECK_OPTIONS, MAX_NICK, otherRole, toPerspective,
  resetMatchState, resetSession, sanitizeName,
} from './state.js';
import { HostEngine } from './rules.js';
import { net, normalizeCode, CODE_LENGTH } from './net.js';
import * as ui from './ui.js';
import * as fx from './animations.js';

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

/** El motor del host emite aquÃ­: al host localmente, al guest por red. */
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
      ui.showToast('Se perdiÃ³ la conexiÃ³n con el servidor. IntÃ©ntalo de nuevo.');
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
    showJoinError('La sala ya estÃ¡ completa.');
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
  ui.showDisconnect(state.role === 'host' ? 'Tu rival se ha desconectado.' : 'El anfitriÃ³n se ha desconectado o cerrÃ³ la sala.');
}

/** Cierra la conexiÃ³n y vuelve al menÃº. */
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
  state.deckSize = msg.deckSize;
  state.totalRounds = msg.rounds;
  if (state.role === 'guest') state.rivalName = sanitizeName(msg.hostName) || 'AnfitriÃ³n';
  resetMatchState();
  prepareBoard();
  ui.showScreen('game');
  ui.setStatus('Barajando el mazoâ€¦', 'wait');
  await fx.wait(500);
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
    ui.setStatus(state.tiebreakNumber > 1 ? 'Desempate nulo: Â¡se repite!' : 'Empate en puntos: Â¡desempate!', 'info');
    await fx.showBanner($('tiebreak-banner'));
  } else {
    ui.setTiebreakBanner(false);
    ui.setStatus('Repartiendo cartasâ€¦', 'info');
  }

  ui.renderHand(true);
  await fx.wait(650);
  enableTurn();
}

function enableTurn() {
  state.canPlay = true;
  selectedIndex = null;
  ui.updateHand(null);
  ui.setStatus(state.rivalPlay ? 'El rival ya eligiÃ³. Â¡Tu turno!' : 'Tu turno: elige una carta', 'turn');
}

function remainingRivalCards() {
  return 3 - state.roundHistory.length - (state.rivalPlay ? 1 : 0);
}

function onRivalPlayed(msg) {
  if (msg.round !== state.currentRound || msg.attempt !== state.currentAttempt) return;
  state.rivalPlay = 'hidden';
  ui.setFaceDown('rival');
  ui.renderRivalHand(remainingRivalCards());
  if (state.canPlay) ui.setStatus('El rival ya eligiÃ³. Â¡Tu turno!', 'turn');
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
  ui.renderRivalHand(remainingRivalCards());
  ui.setStatus('Â¡Revelando!', 'info');

  await fx.revealAttempt(
    { me: ui.slotParts('me'), rival: ui.slotParts('rival') },
    outcome,
    ui.setArenaResult,
  );
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
    ui.setStatus(msg.isTiebreak ? 'Desempate nulo: se repetirÃ¡' : 'Ronda nula: nadie suma', 'info');
    await fx.nulaRound($('overlay-nula'));
    state.scores = scores;
    await fx.wait(300);
    return;
  }
  const iWon = msg.winner === state.role;
  state.scores = scores;
  ui.renderScoreboard();
  fx.bumpScore($(iWon ? 'score-me' : 'score-rival'));
  if (msg.isTiebreak) ui.setStatus(iWon ? 'Â¡Ganas el desempate!' : 'El rival gana el desempate', 'info');
  else ui.setStatus(iWon ? 'Â¡Ganas la ronda! +1 punto' : 'El rival gana la ronda', 'info');
  await fx.wait(1500);
}

async function onGameOver(msg) {
  state.scores = toPerspective(msg.scores);
  state.matchWinner = msg.winner;
  state.canPlay = false;
  state.rematch = { requested: false, offered: false, ready: false };
  const won = msg.winner === state.role;
  ui.setTiebreakBanner(false);
  ui.renderGameOver({ won, tiebreaks: msg.tiebreaks || 0 });
  ui.setRematchUI({
    label: 'Revancha',
    disabled: false,
    note: state.role === 'host' ? 'Misma configuraciÃ³n de mazo.' : 'La revancha la inicia el anfitriÃ³n.',
  });
  ui.showScreen('gameover');
  if (won) fx.launchConfetti();
}

function onRematchRequest() {
  if (state.role !== 'guest' || state.screen !== 'gameover') return;
  state.rematch.offered = true;
  if (state.rematch.ready) {
    net.send({ type: 'rematch-accept' });
    ui.setRematchUI({ label: 'Preparandoâ€¦', disabled: true, note: 'Â¡Revancha aceptada!' });
  } else {
    ui.setRematchUI({ label: 'Aceptar revancha', disabled: false, note: `Â¡${state.rivalName} quiere la revancha!` });
  }
}

/* ===================================================== Acciones del jugador */

function selectCard(index) {
  if (!state.canPlay) return;
  const card = state.myHand[index];
  if (!card || card.played) return;
  selectedIndex = selectedIndex === index ? null : index;
  ui.updateHand(selectedIndex);
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
  ui.setStatus(state.rivalPlay ? 'Revelandoâ€¦' : 'Esperando jugada del rivalâ€¦', 'wait');
  fx.vibrate(20);

  const play = { type: 'play', card: card.type, attempt: state.currentAttempt, round: state.currentRound };
  if (state.role === 'host') engine?.play('host', play.card, play.attempt, play.round);
  else net.send(play);
}

function requestRematch() {
  fx.vibrate(15);
  if (state.role === 'host') {
    if (!net.connected) return;
    state.rematch.requested = true;
    net.send({ type: 'rematch-request' });
    ui.setRematchUI({ label: 'Esperandoâ€¦', disabled: true, note: `Esperando a que ${state.rivalName} acepteâ€¦` });
    return;
  }
  if (state.rematch.offered) {
    net.send({ type: 'rematch-accept' });
    ui.setRematchUI({ label: 'Preparandoâ€¦', disabled: true, note: 'Â¡Revancha aceptada!' });
  } else {
    state.rematch.ready = true;
    ui.setRematchUI({ label: 'Listo', disabled: true, note: 'Esperando a que el anfitriÃ³n inicie la revanchaâ€¦' });
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
      $('login-error').textContent = 'Escribe un nickname para continuar.';
      input.focus();
      return;
    }
    $('login-error').textContent = '';
    state.nickname = name;
    try { localStorage.setItem(NICK_KEY, name); } catch { /* sin persistencia */ }
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
    fx.vibrate(10);
    ui.showScreen('config');
  });

  $('btn-join').addEventListener('click', () => {
    const form = $('join-form');
    form.hidden = !form.hidden;
    $('btn-join').setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) $('code-input').focus();
  });

  $('btn-rename').addEventListener('click', () => {
    $('nickname-input').value = state.nickname;
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
      showJoinError(`El cÃ³digo tiene ${CODE_LENGTH} caracteres.`);
      return;
    }
    const btn = $('btn-join-go');
    ui.setButtonBusy(btn, true, 'Conectandoâ€¦');
    codeInput.disabled = true;
    showJoinError('');
    fx.vibrate(10);
    try {
      resetSession();
      state.role = 'guest';
      state.roomCode = code;
      await net.join(code);
      net.send({ type: 'join', name: state.nickname });
      $('join-error').textContent = 'Conectado. Esperando al anfitriÃ³nâ€¦';
    } catch (err) {
      resetSession();
      const msg = err?.type === 'no-peerjs'
        ? 'No se pudo cargar PeerJS. Revisa tu conexiÃ³n.'
        : ['network', 'server-error', 'socket-error', 'socket-closed'].includes(err?.type)
          ? 'No se pudo contactar con el servidor. Revisa tu conexiÃ³n.'
          : 'CÃ³digo invÃ¡lido o sala cerrada.';
      showJoinError(msg);
    } finally {
      ui.setButtonBusy(btn, false);
      codeInput.disabled = false;
    }
  });
}

function initConfig() {
  const list = $('deck-options');
  DECK_OPTIONS.forEach((opt, i) => {
    const label = document.createElement('label');
    label.className = 'deck-option';
    label.innerHTML = `
      <input type="radio" name="deck" value="${opt.size}" ${i === 0 ? 'checked' : ''}>
      <span class="deck-option-body">
        <span class="deck-option-size">${opt.size}</span>
        <span class="deck-option-unit">cartas</span>
        <span class="deck-option-rounds">${opt.rounds} rondas</span>
      </span>`;
    list.append(label);
  });

  $('btn-config-back').addEventListener('click', () => ui.showScreen('menu'));

  $('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const size = Number(new FormData(e.target).get('deck'));
    const opt = DECK_OPTIONS.find((o) => o.size === size) || DECK_OPTIONS[0];
    const btn = $('btn-config-create');
    ui.setButtonBusy(btn, true, 'Creando salaâ€¦');
    fx.vibrate(10);
    try {
      resetSession();
      state.role = 'host';
      state.deckSize = opt.size;
      state.totalRounds = opt.rounds;
      const code = await net.host();
      state.roomCode = code;
      engine = new HostEngine(opt.size, engineEmit);
      $('room-code').textContent = code;
      $('waiting-info').textContent = `Mazo de ${opt.size} cartas Â· ${opt.rounds} rondas`;
      $('btn-copy-label').textContent = 'Copiar cÃ³digo';
      ui.showScreen('waiting');
    } catch (err) {
      net.destroy();
      resetSession();
      ui.showToast(err?.type === 'no-peerjs'
        ? 'No se pudo cargar PeerJS. Revisa tu conexiÃ³n.'
        : 'No se pudo crear la sala. Revisa tu conexiÃ³n e intÃ©ntalo de nuevo.');
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
    label.textContent = ok ? 'Â¡Copiado!' : 'CÃ³pialo a mano';
    $('btn-copy').classList.toggle('is-copied', ok);
    fx.vibrate(15);
    clearTimeout(initWaiting.timer);
    initWaiting.timer = setTimeout(() => {
      label.textContent = 'Copiar cÃ³digo';
      $('btn-copy').classList.remove('is-copied');
    }, 1800);
  });
  $('btn-cancel-room').addEventListener('click', leaveSession);
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
  $('btn-leave-game').addEventListener('click', () => {
    if (window.confirm('Â¿Seguro que quieres abandonar la partida?')) leaveSession();
  });
}

function initGameOver() {
  $('btn-rematch').addEventListener('click', requestRematch);
  $('btn-gameover-menu').addEventListener('click', leaveSession);
  $('btn-disconnect-menu').addEventListener('click', leaveSession);
}

/* ===================================================== Arranque */

function boot() {
  ui.preloadCards();
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
