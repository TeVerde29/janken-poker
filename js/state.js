/**
 * state.js — Estado global del juego y constantes compartidas.
 *
 * El estado se guarda siempre desde la perspectiva del jugador local
 * (me / rival). Los mensajes de red usan host / guest y se traducen
 * con `toPerspective()`.
 */

/** Tipos de carta válidos. */
export const CARD_TYPES = ['piedra', 'papel', 'tijera'];

/** Modos de juego disponibles. */
export const GAME_MODES = {
  classic: {
    id: 'classic',
    title: 'Modo Clásico',
    tag: 'Mano Completa',
    eyebrow: '1 Piedra · 1 Papel · 1 Tijera',
    desc: 'En cada ronda ambos duelistas juegan con 1 Piedra, 1 Papel y 1 Tijera. Duelo psicológico puro.',
    badge: 'Clásico',
  },
  strategic: {
    id: 'strategic',
    title: 'Mazo Estratégico',
    tag: 'Cartas Finitas',
    eyebrow: 'Mazo Barajado',
    desc: 'Cartas aleatorias de un mazo cerrado. Cada carta jugada se consume y no regresa.',
    badge: 'Estratégico',
  },
};

/** Presets de rondas / mazo (3, 5 o 9 rondas). */
export const ROUND_PRESETS = [
  {
    rounds: 3,
    size: 18,
    title: 'Duelo Rápido',
    tag: '3 rondas',
    perType: 6,
    classicDesc: 'Duelo ágil al mejor de 3 rondas (mano completa en cada una).',
    strategicDesc: 'Mazo de 18 cartas (6 piedras, 6 papeles, 6 tijeras).',
    layers: 1,
  },
  {
    rounds: 5,
    size: 30,
    title: 'Partida Estándar',
    tag: '5 rondas',
    perType: 10,
    classicDesc: 'La experiencia equilibrada recomendada a 5 rondas.',
    strategicDesc: 'Mazo de 30 cartas (10 piedras, 10 papeles, 10 tijeras).',
    layers: 2,
    recommended: true,
  },
  {
    rounds: 9,
    size: 54,
    title: 'Gran Torneo',
    tag: '9 rondas',
    perType: 18,
    classicDesc: 'Duelo largo a 9 rondas de resistencia y lectura del rival.',
    strategicDesc: 'Mazo de 54 cartas (18 piedras, 18 papeles, 18 tijeras).',
    layers: 3,
  },
];

/** Opciones de mazo (alias compatible con versiones previas). */
export const DECK_OPTIONS = ROUND_PRESETS.map((p) => ({
  size: p.size,
  rounds: p.rounds,
  title: p.title,
  tag: p.tag,
  perType: p.perType,
  desc: p.strategicDesc,
  layers: p.layers,
  recommended: p.recommended,
}));

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
  gameMode: 'classic',      // 'classic' | 'strategic'
  deckSize: 30,
  totalRounds: 5,
  currentRound: 1,
  deck: [],                 // mazo restante (solo host; lo mantiene HostEngine)
  myHand: [],               // [{ type: 'piedra', played: false }, ...]
  rivalHandCount: 3,        // solo conteo, no las cartas
  currentAttempt: 1,
  roundHistory: [],         // intentos de la ronda actual: { mine, theirs, outcome }
  lastDuelSummary: [],      // cartas jugadas en el último duelo para la pantalla de victoria/derrota
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
  state.lastDuelSummary = [];
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
