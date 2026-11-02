/**
 * state.js — Estado global del juego y constantes compartidas.
 *
 * El estado se guarda siempre desde la perspectiva del jugador local
 * (me / rival). Los mensajes de red usan host / guest y se traducen
 * con `toPerspective()`.
 */

/** Tipos de carta válidos. */
export const CARD_TYPES = ['piedra', 'papel', 'tijera'];

/** Opciones de mazo / modos de juego: 6 cartas consumidas por ronda (3 por jugador). */
export const DECK_OPTIONS = [
  {
    size: 18,
    rounds: 3,
    title: 'Duelo Rápido',
    tag: '3 rondas',
    desc: 'Partida ágil e intensa de 3 rondas.',
    layers: 1,
  },
  {
    size: 30,
    rounds: 5,
    title: 'Estándar',
    tag: '5 rondas',
    desc: 'La experiencia equilibrada y competitiva.',
    layers: 2,
    recommended: true,
  },
  {
    size: 54,
    rounds: 9,
    title: 'Gran Torneo',
    tag: '9 rondas',
    desc: 'Máxima prueba de estrategia y conteo de cartas.',
    layers: 3,
  },
];

/** Intentos máximos por ronda (una carta por intento). */
export const MAX_ATTEMPTS = 3;

/** Longitud máxima del nickname. */
export const MAX_NICK = 16;

export const state = {
  screen: 'login',          // login | menu | config | waiting | game | gameover
  nickname: '',
  rivalName: '',
  role: null,               // 'host' | 'guest'
  roomCode: null,
  peer: null,               // referencia informativa (la gestiona net.js)
  conn: null,               // referencia informativa (la gestiona net.js)
  deckSize: 30,
  totalRounds: 5,
  currentRound: 1,
  deck: [],                 // mazo restante (solo host; lo mantiene HostEngine)
  myHand: [],               // [{ type: 'piedra', played: false }, ...]
  rivalHandCount: 3,        // solo conteo, no las cartas
  currentAttempt: 1,
  roundHistory: [],         // intentos de la ronda actual: { mine, theirs, outcome }
  scores: { me: 0, rival: 0 },
  isTiebreak: false,
  tiebreakNumber: 0,
  myPlay: null,             // carta jugada en el intento actual
  rivalPlay: null,          // 'hidden' cuando el rival ya eligió (sin saber qué)
  canPlay: false,           // true mientras el jugador puede elegir carta
  matchWinner: null,        // 'host' | 'guest'
  rematch: { requested: false, offered: false, ready: false },
};

/** Rol contrario. */
export const otherRole = (role) => (role === 'host' ? 'guest' : 'host');

/** Convierte un objeto { host, guest } a { me, rival } según el rol local. */
export function toPerspective(obj) {
  return { me: obj[state.role], rival: obj[otherRole(state.role)] };
}

/** Limpia todo lo relativo a una partida (se conserva la sesión/conexión). */
export function resetMatchState() {
  state.currentRound = 1;
  state.myHand = [];
  state.rivalHandCount = 3;
  state.currentAttempt = 1;
  state.roundHistory = [];
  state.scores = { me: 0, rival: 0 };
  state.isTiebreak = false;
  state.tiebreakNumber = 0;
  state.myPlay = null;
  state.rivalPlay = null;
  state.canPlay = false;
  state.matchWinner = null;
  state.rematch = { requested: false, offered: false, ready: false };
}

/** Limpia la sesión completa (rol, sala, rival) y la partida. */
export function resetSession() {
  resetMatchState();
  state.role = null;
  state.roomCode = null;
  state.rivalName = '';
  state.peer = null;
  state.conn = null;
  state.deck = [];
}

/** Normaliza un nombre: recorta espacios y longitud. */
export function sanitizeName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NICK);
}
