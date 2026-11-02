/**
 * audio.js — Síntesis de efectos de sonido con Web Audio API.
 * Sin dependencias de archivos externos ni descargas: funciona 100% offline,
 * genera sonidos sutiles de juego de mesa (madera, cartas, volteo y victoria)
 * y respeta las políticas de audio del navegador sin lanzar errores.
 */

let ctx = null;
let enabled = true;

function getContext() {
  if (!enabled) return null;
  if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function toggleAudio() {
  enabled = !enabled;
  return enabled;
}

export function isAudioEnabled() {
  return enabled;
}

/** Táctil suave al seleccionar una carta (chasquido de cartón). */
export function sfxCardSelect() {
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(now);
  osc.stop(now + 0.045);
}

/** Deslizamiento de carta hacia el centro. */
export function sfxCardSlide() {
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;

  // Ruido filtrado que simula el roce de una carta
  const bufferSize = c.sampleRate * 0.08;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }

  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, now);
  filter.Q.setValueAtTime(2, now);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);

  noise.start(now);
}

/** Volteo 3D de revelación. */
export function sfxCardFlip() {
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.07);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(now);
  osc.stop(now + 0.085);
}

/** Choque de cartas en la arena. */
export function sfxClash() {
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;

  // Golpe grave con cuerpo
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.14);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(now);
  osc.stop(now + 0.16);
}

/** Acorde elegante de victoria de intento o partida. */
export function sfxVictory() {
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;

  // Tríada mayor en latón (Re mayor / Fa# / La)
  const freqs = [293.66, 369.99, 440.0, 587.33];
  freqs.forEach((freq, idx) => {
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.06);

    gain.gain.setValueAtTime(0.08, now + idx * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now + idx * 0.06);
    osc.stop(now + idx * 0.06 + 0.5);
  });
}

/** Sonido sutil de empate. */
export function sfxTie() {
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.setValueAtTime(320, now + 0.08);

  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(now);
  osc.stop(now + 0.19);
}
