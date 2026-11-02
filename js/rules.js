/**
 * rules.js — Reglas puras de RPS y motor autoritativo del host.
 *
 * Las funciones puras (resolve, resolveRound, isRoundNull) no tocan estado.
 * HostEngine es la única fuente de verdad de la partida: baraja, reparte,
 * valida jugadas, resuelve intentos/rondas y decide el desempate.
 */
import { CARD_TYPES, MAX_ATTEMPTS } from './state.js';
import { buildDeck, dealHand, tiebreakHand } from './deck.js';

export { buildDeck };

/** Qué carta vence cada tipo. */
const BEATS = { piedra: 'tijera', tijera: 'papel', papel: 'piedra' };

/** Resultado desde la perspectiva de `a`: 'win' | 'lose' | 'tie'. */
export function resolve(a, b) {
  if (a === b) return 'tie';
  return BEATS[a] === b ? 'win' : 'lose';
}

/** Ganador de un intento: 'host' | 'guest' | 'tie'. */
export function resolveRound(hostPlay, guestPlay) {
  const r = resolve(hostPlay, guestPlay);
  if (r === 'tie') return 'tie';
  return r === 'win' ? 'host' : 'guest';
}

/** La ronda es nula si se jugaron los 3 intentos y todos fueron empate. */
export function isRoundNull(attempts) {
  return attempts.length === MAX_ATTEMPTS && attempts.every((a) => a.winner === 'tie');
}

/** Rondas que da un tamaño de mazo (6 cartas por ronda). */
export const roundsForDeck = (size) => size / 6;

/**
 * Motor de partida del host.
 * @param {number} deckSize 18 | 30 | 54
 * @param {(role: 'host'|'guest', msg: object) => void} emit envía un mensaje a un jugador
 */
export class HostEngine {
  constructor(deckSize, emit) {
    this.deckSize = deckSize;
    this.totalRounds = roundsForDeck(deckSize);
    this.emit = emit;
    this.reset();
  }

  reset() {
    this.deck = [];
    this.round = 0;
    this.scores = { host: 0, guest: 0 };
    this.isTiebreak = false;
    this.tiebreakNumber = 0;
    this.hands = { host: [], guest: [] };
    this.attempt = 1;
    this.attempts = [];
    this.plays = { host: null, guest: null };
    this.finished = false;
  }

  emitBoth(msg) {
    this.emit('host', msg);
    this.emit('guest', msg);
  }

  /** Nueva partida con la misma configuración (también sirve para revancha). */
  startMatch() {
    this.reset();
    this.deck = buildDeck(this.deckSize);
    this.round = 1;
    this.startRound();
  }

  startRound() {
    if (this.isTiebreak) {
      this.tiebreakNumber += 1;
      this.hands = { host: tiebreakHand(), guest: tiebreakHand() };
    } else {
      this.hands = { host: dealHand(this.deck), guest: dealHand(this.deck) };
    }
    this.attempt = 1;
    this.attempts = [];
    this.plays = { host: null, guest: null };

    for (const role of ['host', 'guest']) {
      this.emit(role, {
        type: 'deal',
        round: this.round,
        totalRounds: this.totalRounds,
        hand: [...this.hands[role]],
        isTiebreak: this.isTiebreak,
        tiebreakNumber: this.tiebreakNumber,
        scores: { ...this.scores },
        deckRemaining: this.deck.length,
      });
    }
  }

  /**
   * Registra una jugada. Devuelve false si es inválida (se ignora).
   * Valida ronda, intento, que no haya jugado ya y que la carta esté en su mano.
   */
  play(role, card, attempt, round) {
    if (this.finished || (role !== 'host' && role !== 'guest')) return false;
    if (!CARD_TYPES.includes(card)) return false;
    if (round !== this.round || attempt !== this.attempt) return false;
    if (this.plays[role]) return false;

    const idx = this.hands[role].indexOf(card);
    if (idx === -1) return false;

    this.hands[role].splice(idx, 1);
    this.plays[role] = card;

    const other = role === 'host' ? 'guest' : 'host';
    if (!this.plays[other]) {
      this.emit(other, { type: 'rival-played', round: this.round, attempt: this.attempt });
      return true;
    }
    this.resolveAttempt();
    return true;
  }

  resolveAttempt() {
    const { host, guest } = this.plays;
    const winner = resolveRound(host, guest);
    this.attempts.push({ attempt: this.attempt, host, guest, winner });

    const roundOver = winner !== 'tie' || this.attempt >= MAX_ATTEMPTS;
    this.emitBoth({
      type: 'attempt-result',
      round: this.round,
      attempt: this.attempt,
      host,
      guest,
      winner,
      roundOver,
    });

    if (!roundOver) {
      this.attempt += 1;
      this.plays = { host: null, guest: null };
      return;
    }

    const nula = isRoundNull(this.attempts);
    if (!nula) this.scores[winner] += 1;

    this.emitBoth({
      type: 'round-result',
      round: this.round,
      intentos: this.attempts.map((a) => ({ host: a.host, guest: a.guest, winner: a.winner })),
      scores: { ...this.scores },
      nula,
      isTiebreak: this.isTiebreak,
      winner: nula ? null : winner,
    });

    this.advance(nula, winner);
  }

  advance(nula, winner) {
    if (this.isTiebreak) {
      // Desempate nulo: se repite con manos fijas nuevas hasta que haya ganador.
      if (nula) this.startRound();
      else this.finish(winner);
      return;
    }
    if (this.round < this.totalRounds) {
      this.round += 1;
      this.startRound();
      return;
    }
    if (this.scores.host === this.scores.guest) {
      this.isTiebreak = true;
      this.round += 1;
      this.startRound();
      return;
    }
    this.finish(this.scores.host > this.scores.guest ? 'host' : 'guest');
  }

  finish(winner) {
    this.finished = true;
    this.emitBoth({
      type: 'game-over',
      scores: { ...this.scores },
      winner,
      tiebreaks: this.tiebreakNumber,
    });
  }
}
