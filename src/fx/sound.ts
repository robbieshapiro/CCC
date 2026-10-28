// Synthesized sound effects (no audio files). Muted by default; the choice is remembered per device.
import { store } from '../storage';

const KEY = 'dt-sound';
let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

export const soundOn = () => store.get(KEY) === 'on';

export function setSound(on: boolean) {
  store.set(KEY, on ? 'on' : 'off');
  if (on) audio();
}

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

type Env = { at?: number; attack?: number; dur: number; peak: number };

function gainEnv(a: AudioContext, { at = 0, attack = 0.005, dur, peak }: Env): GainNode {
  const g = a.createGain();
  const t = a.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(a.destination);
  return g;
}

function tone(type: OscillatorType, f0: number, f1: number, env: Env) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const t = a.currentTime + (env.at ?? 0);
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + env.dur);
  o.connect(gainEnv(a, env));
  o.start(t);
  o.stop(t + env.dur + 0.05);
}

function hiss(filter: BiquadFilterType, freq: number, q: number, env: Env, sweepTo?: number) {
  const a = audio();
  if (!a) return;
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const f = a.createBiquadFilter();
  const t = a.currentTime + (env.at ?? 0);
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + env.dur);
  f.Q.value = q;
  src.connect(f).connect(gainEnv(a, env));
  src.start(t, Math.random());
  src.stop(t + env.dur + 0.05);
}

const SFX = {
  thump: () => {
    tone('sine', 140, 45, { dur: 0.18, peak: 0.6 });
    hiss('lowpass', 900, 0.7, { dur: 0.06, peak: 0.25 });
  },
  doink: () => {
    tone('sine', 1250, 1180, { dur: 0.9, peak: 0.25 });
    tone('sine', 1870, 1800, { dur: 0.6, peak: 0.12 });
    tone('triangle', 620, 600, { dur: 0.5, peak: 0.1 });
  },
  swish: () => hiss('bandpass', 3000, 1.2, { dur: 0.35, attack: 0.04, peak: 0.25 }, 1200),
  crack: () => {
    hiss('highpass', 2500, 0.8, { dur: 0.08, peak: 0.7 });
    tone('square', 900, 300, { dur: 0.05, peak: 0.2 });
  },
  // a bomb off the tee: a big crack, a low boom under it, the ball tearing away, and the gallery
  bomb: () => {
    hiss('highpass', 2200, 0.8, { dur: 0.12, peak: 0.9 });
    tone('square', 1100, 260, { dur: 0.07, peak: 0.25 });
    tone('sine', 80, 38, { dur: 0.7, peak: 0.55 });
    hiss('bandpass', 900, 0.9, { at: 0.08, dur: 1.2, attack: 0.05, peak: 0.3 }, 3800);
    hiss('bandpass', 500, 4, { at: 0.5, dur: 1.4, attack: 0.3, peak: 0.25 }, 330);
    hiss('bandpass', 900, 5, { at: 0.5, dur: 1.3, attack: 0.3, peak: 0.15 }, 600);
  },
  pop: () => hiss('lowpass', 600, 1, { dur: 0.09, peak: 0.6 }),
  whoosh: () => hiss('bandpass', 600, 0.8, { dur: 0.4, attack: 0.15, peak: 0.18 }, 2400),
  ooh: () => {
    hiss('bandpass', 500, 4, { dur: 1.1, attack: 0.25, peak: 0.22 }, 330);
    hiss('bandpass', 900, 5, { dur: 1.0, attack: 0.25, peak: 0.12 }, 600);
  },
  cheer: () => {
    for (let i = 0; i < 4; i++) hiss('bandpass', 1200 + i * 500, 1.5, { at: i * 0.05, dur: 1.4, attack: 0.1, peak: 0.12 }, 900);
    tone('sawtooth', 520, 780, { at: 0.05, dur: 0.25, peak: 0.05 });
  },
  buzzer: () => {
    tone('square', 110, 105, { dur: 0.55, peak: 0.18 });
    tone('square', 116, 110, { dur: 0.55, peak: 0.12 });
  },
  hum: () => {
    tone('sawtooth', 60, 60, { dur: 0.7, attack: 0.05, peak: 0.08 });
    tone('sine', 120, 120, { dur: 0.5, peak: 0.06 });
  },
  clank: () => {
    tone('triangle', 520, 470, { dur: 0.35, peak: 0.18 });
    tone('sine', 1040, 990, { dur: 0.25, peak: 0.08 });
  },
  board: () => {
    tone('sine', 110, 70, { dur: 0.18, peak: 0.4 });
    hiss('lowpass', 1200, 0.7, { dur: 0.05, peak: 0.2 });
  },
  bounce: () => tone('sine', 90, 50, { dur: 0.12, peak: 0.35 }),
  net: () => hiss('bandpass', 2600, 1.4, { dur: 0.3, attack: 0.02, peak: 0.3 }, 1500),
  tick: () => tone('square', 1800, 1700, { dur: 0.03, peak: 0.05 }),
  fire: () => {
    hiss('lowpass', 400, 0.5, { dur: 0.8, attack: 0.2, peak: 0.3 }, 1600);
    tone('sawtooth', 220, 440, { dur: 0.4, peak: 0.06 });
  },
  sad: () => {
    tone('triangle', 392, 370, { dur: 0.25, peak: 0.12 });
    tone('triangle', 370, 349, { at: 0.25, dur: 0.25, peak: 0.12 });
    tone('triangle', 349, 262, { at: 0.5, dur: 0.6, peak: 0.12 });
  },
};

export type SfxName = keyof typeof SFX;

export function sfx(name: SfxName) {
  if (!soundOn()) return;
  try {
    SFX[name]();
  } catch {
    /* audio is best-effort */
  }
}
