/**
 * net.js — Capa P2P con PeerJS (señalización en la nube gratuita + WebRTC).
 *
 * El host abre un Peer cuyo ID deriva del código de sala; el guest se conecta
 * a ese ID. Solo se admite una conexión por sala.
 */

/** Prefijo para no colisionar con otros IDs del servidor público de PeerJS. */
const PEER_PREFIX = 'jankencards-';

/** Alfabeto sin caracteres ambiguos (sin O/0, I/1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/**
 * Servidores TURN opcionales (p. ej. Metered.ca) para redes con NAT simétrico.
 * Si se deja vacío se usan los ICE servers por defecto de PeerJS.
 * Ejemplo:
 *   { urls: 'turn:global.relay.metered.ca:80', username: '...', credential: '...' }
 */
const EXTRA_ICE_SERVERS = [];

const OPEN_TIMEOUT_MS = 12000;
const JOIN_TIMEOUT_MS = 15000;

/** Errores del Peer que impiden seguir usando la señalización. */
const FATAL_PEER_ERRORS = ['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable'];

export function generateRoomCode() {
  const buf = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}

/** Pasa a mayúsculas y elimina cualquier carácter fuera del alfabeto. */
export function normalizeCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

export const isValidCode = (code) => normalizeCode(code).length === CODE_LENGTH && normalizeCode(code) === code;

function peerOptions() {
  return {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: [
            'turn:eu-0.turn.peerjs.com:3478',
            'turn:us-0.turn.peerjs.com:3478',
          ],
          username: 'peerjs',
          credential: 'peerjsp',
        },
        ...EXTRA_ICE_SERVERS,
      ],
      sdpSemantics: 'unified-plan',
    },
  };
}

/** Error tipado para que la UI muestre mensajes claros. */
export class NetError extends Error {
  constructor(type, message) {
    super(message || type);
    this.type = type;
  }
}

class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.pendingJoin = null;
    /** Callbacks: onOpen, onData, onClose, onFatal */
    this.handlers = {};
  }

  setHandlers(handlers) {
    this.handlers = { ...handlers };
  }

  get available() {
    return typeof window.Peer === 'function';
  }

  get connected() {
    return Boolean(this.conn?.open);
  }

  /** Abre un Peer (con ID fijo o aleatorio) y resuelve cuando está registrado. */
  openPeer(id) {
    if (!this.available) return Promise.reject(new NetError('no-peerjs', 'No se pudo cargar PeerJS'));
    return new Promise((resolve, reject) => {
      const peer = id ? new window.Peer(id, peerOptions()) : new window.Peer(peerOptions());
      let settled = false;
      const timer = setTimeout(() => fail(new NetError('timeout')), OPEN_TIMEOUT_MS);

      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        reject(err instanceof NetError ? err : new NetError(err?.type || 'unknown', err?.message));
      };

      peer.once('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.peer = peer;
        peer.on('error', (err) => this.onPeerError(err));
        peer.on('disconnected', () => {
          // Se perdió la señalización; la conexión P2P existente sigue viva.
          if (!peer.destroyed && this.peer === peer && !this.connected) {
            try { peer.reconnect(); } catch { /* sin acción: se reintentará al crear otra sala */ }
          }
        });
        resolve(peer);
      });
      peer.once('error', fail);
    });
  }

  onPeerError(err) {
    if (err?.type === 'peer-unavailable' && this.pendingJoin) {
      this.pendingJoin.reject(new NetError('invalid-room'));
      return;
    }
    if (this.connected) return; // la partida va por P2P; la señalización ya no importa
    if (this.pendingJoin) {
      this.pendingJoin.reject(new NetError(err?.type || 'unknown'));
      return;
    }
    if (FATAL_PEER_ERRORS.includes(err?.type)) this.handlers.onFatal?.(err);
  }

  /** Crea la sala. Reintenta con otro código si el ID ya está ocupado. */
  async host() {
    this.destroy();
    for (let i = 0; i < 5; i++) {
      const code = generateRoomCode();
      try {
        const peer = await this.openPeer(PEER_PREFIX + code);
        peer.on('connection', (c) => this.acceptConnection(c));
        return code;
      } catch (err) {
        if (err.type !== 'unavailable-id') throw err;
      }
    }
    throw new NetError('unavailable-id');
  }

  acceptConnection(conn) {
    if (this.conn) {
      // Sala ocupada: avisar y cerrar.
      conn.on('open', () => {
        conn.send({ type: 'room-full' });
        setTimeout(() => conn.close(), 400);
      });
      return;
    }
    this.bindConnection(conn);
  }

  bindConnection(conn) {
    this.conn = conn;
    const closed = () => {
      if (this.conn !== conn) return; // conexión ya descartada a propósito
      this.conn = null;
      this.handlers.onClose?.();
    };
    conn.on('open', () => this.handlers.onOpen?.());
    conn.on('data', (data) => {
      if (this.conn === conn) this.handlers.onData?.(data);
    });
    conn.on('close', closed);
    conn.on('error', (err) => {
      if (this.pendingJoin) {
        this.pendingJoin.reject(new NetError(err?.type || 'conn-error', err?.message));
      }
      closed();
    });
    conn.on('iceStateChanged', (s) => {
      if (s === 'failed' || s === 'closed') {
        if (this.pendingJoin) {
          this.pendingJoin.reject(new NetError('ice-failed', 'Fallo al conectar con el rival.'));
        }
        closed();
      }
    });
  }

  /** Se une a una sala existente. Resuelve cuando el canal P2P está abierto. */
  async join(code) {
    this.destroy();
    await this.openPeer(null);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new NetError('timeout')), JOIN_TIMEOUT_MS);
      const finish = (err) => {
        clearTimeout(timer);
        this.pendingJoin = null;
        if (err) {
          this.destroy();
          reject(err);
        } else {
          resolve();
        }
      };
      this.pendingJoin = { reject: finish };

      const conn = this.peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      this.bindConnection(conn);
      conn.on('open', () => {
        if (this.pendingJoin) finish(null);
      });
    });
  }

  send(msg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  /** Cierra todo sin disparar onClose. */
  destroy() {
    const { conn, peer } = this;
    this.conn = null;
    this.peer = null;
    this.pendingJoin = null;
    try { conn?.close(); } catch { /* ya cerrada */ }
    try { if (peer && !peer.destroyed) peer.destroy(); } catch { /* ya destruido */ }
  }
}

export const net = new Net();
