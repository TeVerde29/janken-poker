/**
 * net.js — Capa P2P híbrida con PeerJS (WebRTC DataChannel + WebSocket Relay en 0.peerjs.com).
 *
 * El host abre un Peer cuyo ID deriva del código de sala; el guest se conecta
 * a ese ID. Combina el canal WebRTC con retransmisión directa sobre el WebSocket
 * de señalización para garantizar conexión instantánea incluso entre redes
 * distintas con NAT simétrico, CGNAT móvil o routers sin NAT Loopback.
 */

/** Prefijo para no colisionar con otros IDs del servidor público de PeerJS. */
const PEER_PREFIX = 'jankencards-';

/** Alfabeto sin caracteres ambiguos (sin O/0, I/1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** Servidores ICE adicionales opcionales. */
const EXTRA_ICE_SERVERS = [];

const OPEN_TIMEOUT_MS = 12000;
const JOIN_TIMEOUT_MS = 15000;
const RELAY_CONN_ID = 'janken_ws';
const DUMMY_CANDIDATE = {
  candidate: 'candidate:1 1 udp 1 127.0.0.1 9 typ host',
  sdpMid: '0',
  sdpMLineIndex: 0,
};

/** Errores del Peer que impiden seguir usando la señalización. */
const FATAL_PEER_ERRORS = [
  'network',
  'server-error',
  'socket-error',
  'socket-closed',
  'browser-incompatible',
  'ssl-unavailable',
];

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
  const opts = { debug: 0, pingInterval: 5000 };
  if (EXTRA_ICE_SERVERS.length) {
    opts.config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...EXTRA_ICE_SERVERS] };
  }
  return opts;
}

/** Error tipado para que la UI muestre mensajes claros. */
export class NetError extends Error {
  constructor(type, message) {
    super(message || type);
    this.type = type;
  }
}

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.remotePeerId = null;
    this.wsConnected = false;
    this.isHost = false;
    this.openNotified = false;
    this.pendingJoin = null;
    this.joinTimers = [];
    this.outSeq = 0;
    this.seenIds = new Set();
    this.pendingAcks = new Map();
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
    return Boolean(
      this.conn?.open ||
      (this.wsConnected && this.remotePeerId && this.peer && !this.peer.destroyed)
    );
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
        try { peer.destroy(); } catch { /* ignorar */ }
        reject(err instanceof NetError ? err : new NetError(err?.type || 'unknown', err?.message));
      };

      peer.once('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.peer = peer;
        this.setupSocketRelay(peer);
        peer.on('error', (err) => this.onPeerError(err));
        peer.on('disconnected', () => {
          if (!peer.destroyed && this.peer === peer) {
            try { peer.reconnect(); } catch { /* se reintentará */ }
          }
        });
        resolve(peer);
      });
      peer.once('error', fail);
    });
  }

  onPeerError(err) {
    if (err?.type === 'peer-unavailable') {
      if (this.pendingJoin) {
        this.pendingJoin.reject(new NetError('invalid-room'));
      }
      return;
    }
    if (this.connected) return;
    if (this.pendingJoin) {
      this.pendingJoin.reject(new NetError(err?.type || 'unknown'));
      return;
    }
    if (FATAL_PEER_ERRORS.includes(err?.type)) this.handlers.onFatal?.(err);
  }

  /** Envía un paquete a través del WebSocket de señalización de PeerJS. */
  sendRelayPacket(dst, jankenPayload) {
    if (!this.peer || this.peer.destroyed || !dst) return false;
    const sock = this.peer.socket;
    if (!sock || typeof sock.send !== 'function') return false;
    try {
      sock.send({
        type: 'CANDIDATE',
        dst,
        payload: {
          candidate: DUMMY_CANDIDATE,
          type: 'data',
          connectionId: RELAY_CONN_ID,
          __janken: jankenPayload,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Configura la recepción de mensajes por el WebSocket de señalización. */
  setupSocketRelay(peer) {
    const sock = peer?.socket;
    if (!sock || typeof sock.on !== 'function') return;

    sock.on('message', (raw) => {
      if (this.peer !== peer || !raw || typeof raw !== 'object') return;

      // Evitar acumular mensajes en el buffer interno de PeerJS
      peer._lostMessages?.delete(RELAY_CONN_ID);

      if (raw.type === 'LEAVE' && raw.src && raw.src === this.remotePeerId) {
        this.handleRemoteDisconnect();
        return;
      }

      const relay = raw.payload?.__janken;
      const src = raw.src;
      if (!relay || !src) return;

      switch (relay.kind) {
        case 'syn': {
          if (this.isHost) {
            if (this.connected && this.remotePeerId && this.remotePeerId !== src) {
              this.sendRelayPacket(src, { kind: 'room-full' });
              return;
            }
            if (this.remotePeerId !== src) {
              this.seenIds.clear();
            }
            this.remotePeerId = src;
            this.wsConnected = true;
            this.sendRelayPacket(src, { kind: 'syn-ack' });
            this.notifyOpenOnce();
          }
          break;
        }
        case 'syn-ack': {
          if (this.pendingJoin && (!this.remotePeerId || this.remotePeerId === src)) {
            this.remotePeerId = src;
            this.wsConnected = true;
            this.pendingJoin.resolve();
            this.notifyOpenOnce();
          }
          break;
        }
        case 'room-full': {
          if (this.pendingJoin) {
            this.remotePeerId = src;
            this.wsConnected = true;
            this.pendingJoin.resolve();
          }
          this.handlers.onData?.({ type: 'room-full' });
          break;
        }
        case 'data': {
          if (relay.id) {
            this.sendRelayPacket(src, { kind: 'ack', id: relay.id });
          }
          if (this.isHost && !this.remotePeerId) {
            this.remotePeerId = src;
            this.wsConnected = true;
            this.notifyOpenOnce();
          }
          if (this.remotePeerId && src !== this.remotePeerId) return;
          this.deliverIncomingData(src, relay.data, relay.id);
          break;
        }
        case 'ack': {
          const entry = this.pendingAcks.get(relay.id);
          if (entry) {
            clearTimeout(entry.timer);
            this.pendingAcks.delete(relay.id);
          }
          break;
        }
        case 'bye': {
          if (src === this.remotePeerId) {
            this.handleRemoteDisconnect();
          }
          break;
        }
        default:
          break;
      }
    });
  }

  notifyOpenOnce() {
    if (this.openNotified) return;
    this.openNotified = true;
    this.handlers.onOpen?.();
  }

  deliverIncomingData(sourceId, data, explicitId = null) {
    if (!data || typeof data !== 'object') return;
    const msgId = explicitId ?? data._jid ?? null;
    if (msgId !== null) {
      const key = `${sourceId || 'peer'}:${msgId}`;
      if (this.seenIds.has(key)) return;
      this.seenIds.add(key);
    }
    this.handlers.onData?.(data);
  }

  handleRemoteDisconnect() {
    const hadConnection = this.wsConnected || Boolean(this.conn);
    this.wsConnected = false;
    this.remotePeerId = null;
    this.openNotified = false;
    this.clearPendingAcks();
    const c = this.conn;
    this.conn = null;
    try { c?.close(); } catch { /* ya cerrada */ }
    if (hadConnection) {
      this.handlers.onClose?.();
    }
  }

  /** Crea la sala. Reintenta con otro código si el ID ya está ocupado. */
  async host() {
    this.destroy();
    this.isHost = true;
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
    if (this.connected && this.remotePeerId && this.remotePeerId !== conn.peer) {
      // Sala ocupada por otro jugador: avisar y cerrar.
      conn.on('open', () => {
        conn.send({ type: 'room-full' });
        setTimeout(() => conn.close(), 400);
      });
      return;
    }
    if (!this.remotePeerId) {
      this.remotePeerId = conn.peer;
    }
    this.bindConnection(conn);
  }

  bindConnection(conn) {
    this.conn = conn;
    const closed = () => {
      if (this.conn !== conn) return;
      this.conn = null;
      // Si el canal WebSocket Relay sigue activo, no cerrar la partida
      if (this.wsConnected && this.remotePeerId) return;
      this.openNotified = false;
      this.handlers.onClose?.();
    };
    conn.on('open', () => {
      if (!this.remotePeerId) this.remotePeerId = conn.peer;
      this.notifyOpenOnce();
    });
    conn.on('data', (data) => {
      if (this.conn !== conn) return;
      this.deliverIncomingData(conn.peer, data);
    });
    conn.on('close', closed);
    conn.on('error', closed);
    conn.on('iceStateChanged', (s) => {
      if (s === 'failed' || s === 'closed') closed();
    });
  }

  clearJoinTimers() {
    for (const t of this.joinTimers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.joinTimers = [];
  }

  clearPendingAcks() {
    for (const entry of this.pendingAcks.values()) {
      clearTimeout(entry.timer);
    }
    this.pendingAcks.clear();
  }

  /** Se une a una sala existente. Resuelve cuando el canal (Relay o WebRTC) está abierto. */
  async join(code) {
    this.destroy();
    this.isHost = false;
    await this.openPeer(null);
    const targetPeerId = PEER_PREFIX + code;

    return new Promise((resolve, reject) => {
      const finish = (err) => {
        this.clearJoinTimers();
        this.pendingJoin = null;
        if (err) {
          this.destroy();
          reject(err);
        } else {
          resolve();
        }
      };

      const timeoutTimer = setTimeout(() => finish(new NetError('timeout')), JOIN_TIMEOUT_MS);
      this.joinTimers.push(timeoutTimer);

      this.pendingJoin = {
        resolve: () => finish(null),
        reject: (err) => finish(err),
      };

      // 1. Vía rápida: handshake por WebSocket Relay (conecta en ~100ms sin depender de NAT/ICE)
      this.sendRelayPacket(targetPeerId, { kind: 'syn' });
      const synRetry = setInterval(() => {
        if (this.pendingJoin) {
          this.sendRelayPacket(targetPeerId, { kind: 'syn' });
        }
      }, 600);
      this.joinTimers.push(synRetry);

      // 2. Vía compatible WebRTC DataChannel en paralelo (por si el host tiene versión previa o red LAN directa)
      const rtcTimer = setTimeout(() => {
        if (!this.pendingJoin || !this.peer || this.peer.destroyed) return;
        try {
          const conn = this.peer.connect(targetPeerId, { reliable: true, serialization: 'json' });
          this.bindConnection(conn);
          conn.on('open', () => {
            if (this.pendingJoin) finish(null);
          });
        } catch { /* ignorar si falla WebRTC, sigue activo el relay */ }
      }, 350);
      this.joinTimers.push(rtcTimer);
    });
  }

  send(msg) {
    if (!msg || typeof msg !== 'object') return;
    const id = ++this.outSeq;
    const packet = { ...msg, _jid: id };

    if (this.conn?.open) {
      try { this.conn.send(packet); } catch { /* respaldo por relay */ }
    }

    if (this.wsConnected && this.remotePeerId) {
      const target = this.remotePeerId;
      const sendAttempt = (attempt) => {
        if (!this.wsConnected || this.remotePeerId !== target) {
          this.pendingAcks.delete(id);
          return;
        }
        this.sendRelayPacket(target, { kind: 'data', id, data: packet });
        if (attempt < 5) {
          const timer = setTimeout(() => sendAttempt(attempt + 1), 700);
          this.pendingAcks.set(id, { timer });
        } else {
          this.pendingAcks.delete(id);
        }
      };
      sendAttempt(0);
    }
  }

  /** Cierra todo sin disparar onClose. */
  destroy() {
    this.clearJoinTimers();
    this.clearPendingAcks();
    const { conn, peer, remotePeerId, wsConnected } = this;
    if (wsConnected && remotePeerId) {
      this.sendRelayPacket(remotePeerId, { kind: 'bye' });
    }
    this.conn = null;
    this.peer = null;
    this.remotePeerId = null;
    this.wsConnected = false;
    this.openNotified = false;
    this.pendingJoin = null;
    this.seenIds.clear();
    try { conn?.close(); } catch { /* ya cerrada */ }
    try { if (peer && !peer.destroyed) peer.destroy(); } catch { /* ya destruido */ }
  }
}

export const net = new Net();
