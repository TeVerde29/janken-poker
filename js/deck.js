/**
 * deck.js — Creación, barajado y reparto del mazo.
 */
import { CARD_TYPES } from './state.js';

/** Entero aleatorio uniforme en [0, max) usando crypto (sin sesgo de módulo). */
function randomInt(max) {
  if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * max);
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Baraja in-place con Fisher-Yates y devuelve el mismo array. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Mazo ordenado con tercios exactos de piedra, papel y tijera. */
export function createDeck(size) {
  if (!Number.isInteger(size) || size <= 0 || size % 6 !== 0) {
    throw new Error(`Tamaño de mazo inválido: ${size}`);
  }
  const perType = size / 3;
  return CARD_TYPES.flatMap((type) => Array(perType).fill(type));
}

/** Mazo listo para jugar: tercios exactos y barajado UNA vez. */
export function buildDeck(size) {
  return shuffle(createDeck(size));
}

/** Saca `n` cartas de la cima del mazo (las cartas se consumen). */
export function dealHand(deck, n = 3) {
  if (deck.length < n) throw new Error('No quedan cartas suficientes en el mazo');
  return deck.splice(0, n);
}

/** Mano fija de la ronda de desempate. */
export function tiebreakHand() {
  return ['piedra', 'papel', 'tijera'];
}
