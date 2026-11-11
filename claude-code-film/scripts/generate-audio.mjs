// Procedural sound design: cinematic music bed + SFX, synthesised from scratch.
// No samples, no external services. Run: `npm run audio`
// Output: public/audio/music.mp3 and public/audio/sfx/*.wav
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "audio");
const SR = 44100;
const TAU = Math.PI * 2;

const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

class Buf {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.l = new Float32Array(this.n);
    this.r = new Float32Array(this.n);
  }
  add(i, v, pan = 0) {
    if (i < 0 || i >= this.n) return;
    this.l[i] += v * Math.min(1, 1 - pan);
    this.r[i] += v * Math.min(1, 1 + pan);
  }
  mix(other, gain = 1) {
    const n = Math.min(this.n, other.n);
    for (let i = 0; i < n; i++) {
      this.l[i] += other.l[i] * gain;
      this.r[i] += other.r[i] * gain;
    }
  }
  each(fn) {
    for (let i = 0; i < this.n; i++) {
      const g = fn(i / SR, i);
      this.l[i] *= g;
      this.r[i] *= g;
    }
  }
  // one-pole low-pass with time-varying cutoff (Hz)
  lowpass(cutoffFn, poles = 2) {
    for (let p = 0; p < poles; p++) {
      let yl = 0;
      let yr = 0;
      for (let i = 0; i < this.n; i++) {
        const a = 1 - Math.exp((-TAU * cutoffFn(i / SR)) / SR);
        yl += a * (this.l[i] - yl);
        yr += a * (this.r[i] - yr);
        this.l[i] = yl;
        this.r[i] = yr;
      }
    }
  }
  highpass(cutoff) {
    const a = 1 - Math.exp((-TAU * cutoff) / SR);
    let yl = 0;
    let yr = 0;
    for (let i = 0; i < this.n; i++) {
      yl += a * (this.l[i] - yl);
      yr += a * (this.r[i] - yr);
      this.l[i] -= yl;
      this.r[i] -= yr;
    }
  }
  pingPong(delaySec, feedback, wet) {
    const d = Math.round(delaySec * SR);
    const ol = new Float32Array(this.n);
    const or = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const dl = i >= d ? or[i - d] : 0;
      const dr = i >= d ? ol[i - d] : 0;
      ol[i] = this.l[i] + dl * feedback;
      or[i] = this.r[i] * 0.6 + dr * feedback;
    }
    for (let i = 0; i < this.n; i++) {
      this.l[i] = this.l[i] * (1 - wet) + ol[i] * wet * 1.4;
      this.r[i] = this.r[i] * (1 - wet) + or[i] * wet * 1.4;
    }
  }
  // Schroeder reverb, returns a new wet buffer
  reverb(size = 1, damp = 0.35) {
    const wet = new Buf(this.n / SR);
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((x) => Math.round(x * size));
    const allp = [225, 556, 441];
    for (const ch of ["l", "r"]) {
      const src = this[ch];
      const acc = new Float32Array(this.n);
      combs.forEach((len0, k) => {
        const len = len0 + (ch === "r" ? 23 + k * 3 : 0);
        const line = new Float32Array(len);
        let idx = 0;
        let lp = 0;
        const fb = 0.86;
        for (let i = 0; i < this.n; i++) {
          const y = line[idx];
          lp = y * (1 - damp) + lp * damp;
          line[idx] = src[i] + lp * fb;
          idx = (idx + 1) % len;
          acc[i] += y;
        }
      });
      let sig = acc;
      for (const len of allp) {
        const line = new Float32Array(len);
        const out = new Float32Array(this.n);
        let idx = 0;
        for (let i = 0; i < this.n; i++) {
          const b = line[idx];
          const x = sig[i];
          out[i] = -x * 0.5 + b;
          line[idx] = x + b * 0.5;
          idx = (idx + 1) % len;
        }
        sig = out;
      }
      for (let i = 0; i < this.n; i++) wet[ch][i] = sig[i] * 0.16;
    }
    return wet;
  }
  normalize(peak = 0.9) {
    let m = 0;
    for (let i = 0; i < this.n; i++) m = Math.max(m, Math.abs(this.l[i]), Math.abs(this.r[i]));
    if (m > 0) this.each(() => peak / m);
    return this;
  }
  softClip(drive = 1) {
    for (let i = 0; i < this.n; i++) {
      this.l[i] = Math.tanh(this.l[i] * drive);
      this.r[i] = Math.tanh(this.r[i] * drive);
    }
  }
  wav(path) {
    const data = Buffer.alloc(44 + this.n * 4);
    data.write("RIFF", 0);
    data.writeUInt32LE(36 + this.n * 4, 4);
    data.write("WAVEfmt ", 8);
    data.writeUInt32LE(16, 16);
    data.writeUInt16LE(1, 20);
    data.writeUInt16LE(2, 22);
    data.writeUInt32LE(SR, 24);
    data.writeUInt32LE(SR * 4, 28);
    data.writeUInt16LE(4, 32);
    data.writeUInt16LE(16, 34);
    data.write("data", 36);
    data.writeUInt32LE(this.n * 4, 40);
    for (let i = 0; i < this.n; i++) {
      data.writeInt16LE(Math.round(clamp(this.l[i], -1, 1) * 32767), 44 + i * 4);
      data.writeInt16LE(Math.round(clamp(this.r[i], -1, 1) * 32767), 46 + i * 4);
    }
    writeFileSync(path, data);
  }
}

// ---------- voices ----------
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
const tri = (ph) => 2 * Math.abs(saw(ph)) - 1;

function tone(buf, { t, dur, freq, amp = 0.2, pan = 0, attack = 0.005, release = 0.1, wave = "sine", freqEnd, decay }) {
  const i0 = Math.round(t * SR);
  const n = Math.round(dur * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const s = i / SR;
    const f = freqEnd ? freq * Math.pow(freqEnd / freq, x) : freq;
    ph += f / SR;
    let env = Math.min(1, s / attack) * Math.min(1, (dur - s) / release);
    if (decay) env *= Math.exp(-s / decay);
    const v = wave === "saw" ? saw(ph) : wave === "tri" ? tri(ph) : Math.sin(ph * TAU);
    buf.add(i0 + i, v * env * amp, pan);
  }
}

function noise(buf, { t, dur, amp = 0.2, seed = 1, envFn, panFn, bpFn, q = 2 }) {
  const rand = rng(seed);
  const i0 = Math.round(t * SR);
  const n = Math.round(dur * SR);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    let v = rand() * 2 - 1;
    if (bpFn) {
      // Chamberlin state-variable band-pass
      const f = 2 * Math.sin((Math.PI * Math.min(bpFn(x), SR / 6.5)) / SR);
      low += f * band;
      const high = v - low - band / q;
      band += f * high;
      v = band;
    }
    buf.add(i0 + i, v * amp * (envFn ? envFn(x) : 1), panFn ? panFn(x) : 0);
  }
}

// ---------- MUSIC ----------
function music() {
  const LEN = 78;
  const BEAT = 0.5; // 120 BPM
  const master = new Buf(LEN);
  const pad = new Buf(LEN);
  const arp = new Buf(LEN);
  const bass = new Buf(LEN);
  const drums = new Buf(LEN);
  const bell = new Buf(LEN);
  const amb = new Buf(LEN);

  // A minor, hopeful-tech progression. One chord per 4 seconds.
  const CHORDS = [
    { root: 45, notes: [57, 60, 64, 71] }, // Am(add9)
    { root: 41, notes: [57, 60, 64, 65] }, // Fmaj7
    { root: 48, notes: [55, 60, 64, 67] }, // C
    { root: 43, notes: [55, 59, 62, 69] }, // G(add9)
  ];
  const chordAt = (t) => CHORDS[Math.floor(Math.max(0, t - 0) / 4) % 4];

  // section energy helpers (seconds) — mirrors src/config/timeline.ts
  const S = { hook: 0, claude: 8, flow: 18, magic: 32, tech: 47, montage: 60, outro: 70, end: 75 };
  const inRange = (t, a, b) => t >= a && t < b;

  // PAD — detuned saw stack through a moving low-pass
  for (let c = 0; c * 4 < 75; c++) {
    const t = c * 4;
    const ch = CHORDS[c % 4];
    const level = t < 4 ? 0.0 : t < 8 ? 0.5 : t >= 70 ? 0.9 : 1;
    [ch.root, ...ch.notes].forEach((note, k) => {
      for (const det of [-0.09, 0, 0.11]) {
        tone(pad, {
          t: t - 0.3,
          dur: t >= 70 ? 7 : 4.6,
          freq: midi(note + det),
          amp: 0.035 * level * (k === 0 ? 1.3 : 1),
          pan: (k - 2) * 0.22 + det * 2,
          attack: 1.1,
          release: t >= 70 ? 4.5 : 1.3,
          wave: "saw",
        });
      }
    });
  }
  pad.lowpass((t) => {
    if (t < S.claude) return 300 + 500 * smooth(t / 8);
    if (t < S.flow) return 900;
    if (t < S.magic) return 1200 + 500 * smooth((t - 18) / 14);
    if (t < S.tech) return 2600;
    if (t < S.montage) return 1100 + 1500 * smooth((t - 56) / 4);
    if (t < S.outro) return 3000;
    return 3000 - 2400 * smooth((t - 70) / 4);
  });

  // DRONE + ambience (always there, carries the black intro)
  tone(amb, { t: 0, dur: 76, freq: midi(33), amp: 0.11, attack: 2.5, release: 4 });
  tone(amb, { t: 0, dur: 76, freq: midi(33.08) * 2, amp: 0.035, attack: 3, release: 4, pan: 0.3 });
  noise(amb, {
    t: 0,
    dur: 76,
    amp: 0.05,
    seed: 11,
    bpFn: (x) => 1800 + 1200 * Math.sin(x * 40),
    q: 1.2,
    panFn: (x) => 0.5 * Math.sin(x * 55),
    envFn: (x) => Math.min(1, x * 30) * Math.min(1, (1 - x) * 20),
  });

  // ARP — plucked 8ths
  const arpPattern = [0, 2, 1, 3, 2, 1, 3, 2];
  for (let step = 0; step * (BEAT / 2) < 74; step++) {
    const t = step * (BEAT / 2);
    let lvl = 0;
    let oct = 12;
    if (inRange(t, 6, S.claude)) lvl = 0.25 * ((t - 6) / 2);
    else if (inRange(t, S.claude, S.flow)) lvl = step % 2 === 0 ? 0.5 : 0.18;
    else if (inRange(t, S.flow, S.magic)) lvl = 0.62;
    else if (inRange(t, S.magic, S.tech)) {
      lvl = 0.8;
      oct = step % 4 === 3 ? 24 : 12;
    } else if (inRange(t, S.tech, S.montage)) lvl = step % 2 === 0 ? 0.55 : 0.3;
    else if (inRange(t, S.montage, S.outro)) {
      lvl = 0.85;
      oct = step % 2 === 1 ? 24 : 12;
    } else if (inRange(t, S.outro, 73)) lvl = step % 4 === 0 ? 0.35 : 0;
    if (lvl <= 0) continue;
    const ch = chordAt(t);
    const note = ch.notes[arpPattern[step % 8]] + oct;
    for (const [w, a] of [["saw", 0.05], ["tri", 0.07]]) {
      tone(arp, {
        t,
        dur: 0.42,
        freq: midi(note),
        amp: a * lvl * (step % 4 === 0 ? 1.25 : 1),
        pan: ((step % 4) - 1.5) * 0.3,
        attack: 0.003,
        release: 0.05,
        decay: 0.12,
        wave: w,
      });
    }
  }
  arp.lowpass((t) => (inRange(t, S.magic, S.tech) || inRange(t, S.montage, S.outro) ? 5200 : 2600), 1);
  arp.pingPong(BEAT * 0.75, 0.42, 0.34);

  // BELL lead — sparse melody on the high-energy sections
  const melody = [
    [0, 76], [1.5, 79], [2, 76], [3, 72], [4, 77], [5.5, 76], [6, 72], [7, 69],
    [8, 79], [9.5, 84], [10, 79], [11, 76], [12, 74], [13.5, 79], [14, 83], [15, 81],
  ];
  const bellNote = (t, note, amp) => {
    for (const [mult, a, dec] of [[1, 1, 0.5], [2.01, 0.35, 0.3], [3.02, 0.15, 0.18], [5.4, 0.06, 0.08]]) {
      tone(bell, { t, dur: 1.6, freq: midi(note) * mult, amp: amp * a, decay: dec, attack: 0.002, release: 0.3, pan: Math.sin(t * 3) * 0.4 });
    }
  };
  for (const start of [S.magic, 40, S.montage, 68]) {
    for (const [off, note] of melody) {
      const t = start + off;
      if ((start === 40 && t >= S.tech - 0.2) || (start === 68 && t >= 70)) continue;
      if (start === S.montage && off >= 8) continue;
      bellNote(t, note, 0.06);
    }
  }
  for (const [t, note] of [[8, 76], [12, 77], [16, 79], [18, 76], [22, 72], [26, 79], [30, 83], [47, 76], [51, 77], [55, 79], [70, 81], [72, 76]]) {
    bellNote(t, note, 0.05);
  }

  // DRUMS
  const kickTimes = [];
  const kick = (t, amp = 1) => {
    kickTimes.push(t);
    tone(drums, { t, dur: 0.34, freq: 135, freqEnd: 42, amp: 0.55 * amp, decay: 0.13, attack: 0.001, release: 0.05 });
    noise(drums, { t, dur: 0.012, amp: 0.12 * amp, seed: 3, envFn: (x) => 1 - x });
  };
  const hat = (t, amp = 1, open = false) =>
    noise(drums, { t, dur: open ? 0.16 : 0.045, amp: 0.06 * amp, seed: Math.round(t * 1000) + 7, bpFn: () => 9000, q: 0.8, envFn: (x) => Math.pow(1 - x, 2), panFn: () => 0.25 });
  const clap = (t, amp = 1) => {
    for (const d of [0, 0.011, 0.023])
      noise(drums, { t: t + d, dur: 0.14, amp: 0.11 * amp, seed: Math.round(t * 977) + d * 1e4, bpFn: () => 1700, q: 1.4, envFn: (x) => Math.pow(1 - x, 3) });
  };
  for (let b = 0; b * BEAT < 70; b++) {
    const t = b * BEAT;
    if (inRange(t, 10, S.flow)) {
      if (b % 4 === 0) kick(t, 0.55); // heartbeat
    } else if (inRange(t, S.flow, S.magic)) {
      if (b % 2 === 0) kick(t, 0.75);
      hat(t + BEAT / 2, 0.6);
      if (t >= 26 && b % 4 === 2) clap(t, 0.5);
    } else if (inRange(t, S.magic, S.tech - 1)) {
      kick(t, 1);
      hat(t + BEAT / 2, 1, b % 8 === 7);
      hat(t + BEAT / 4, 0.4);
      hat(t + (BEAT * 3) / 4, 0.4);
      if (b % 2 === 1) clap(t, 0.9);
    } else if (inRange(t, S.tech, S.montage - 2)) {
      if (b % 4 === 2) kick(t, 0.7); // 47 is on beat 2 of the bar
      hat(t + BEAT / 2, 0.5);
    } else if (inRange(t, S.montage, S.outro)) {
      kick(t, 1.05);
      hat(t + BEAT / 2, 1, b % 4 === 3);
      hat(t + BEAT / 4, 0.45);
      hat(t + (BEAT * 3) / 4, 0.45);
      if (b % 2 === 1) clap(t, 1);
    }
  }
  // snare-ish roll into the montage
  for (let k = 0; k < 16; k++) clap(58 + k * 0.125, 0.25 + (k / 16) * 0.75);

  // BASS — 8ths on the root in the driving sections, long notes elsewhere
  for (let step = 0; step * (BEAT / 2) < 74; step++) {
    const t = step * (BEAT / 2);
    const ch = chordAt(t);
    const driving = inRange(t, S.magic, S.tech - 1) || inRange(t, S.montage, S.outro);
    const walking = inRange(t, S.flow, S.magic) || inRange(t, S.tech, S.montage);
    if (driving || (walking && step % 4 === 0) || (inRange(t, S.claude, S.flow) && step % 8 === 0)) {
      const dur = driving ? 0.22 : walking ? 0.9 : 1.8;
      const f = midi(ch.root - 12 + (driving && step % 8 === 6 ? 12 : 0));
      tone(bass, { t, dur, freq: f, amp: 0.26, attack: 0.006, release: 0.06, decay: driving ? 0.3 : 1.2 });
      tone(bass, { t, dur, freq: f * 2, amp: 0.05, attack: 0.006, release: 0.06, decay: 0.15, wave: "saw" });
    }
  }
  tone(bass, { t: 70, dur: 5, freq: midi(33), amp: 0.3, attack: 0.01, release: 3.5, decay: 2.2 });
  bass.lowpass(() => 420, 2);

  // sidechain pump on pad / bass / arp from the kicks
  const pump = new Float32Array(master.n).fill(1);
  for (const kt of kickTimes) {
    const i0 = Math.round(kt * SR);
    const n = Math.round(0.3 * SR);
    for (let i = 0; i < n && i0 + i < pump.length; i++) pump[i0 + i] = Math.min(pump[i0 + i], 0.42 + 0.58 * smooth(i / n));
  }
  pad.each((_, i) => pump[i]);
  bass.each((_, i) => 0.25 + 0.75 * pump[i]);

  // big hits baked into the bed so it breathes with the picture
  const boom = (t, amp = 1) => {
    tone(drums, { t, dur: 1.8, freq: 72, freqEnd: 30, amp: 0.6 * amp, decay: 0.55, attack: 0.002, release: 0.4 });
    noise(amb, { t, dur: 1.6, amp: 0.2 * amp, seed: Math.round(t * 31), bpFn: (x) => 3800 * (1 - x) + 250, q: 0.7, envFn: (x) => Math.pow(1 - x, 2.4) });
  };
  boom(S.claude, 0.8);
  boom(S.flow, 0.6);
  boom(S.magic, 1.1);
  boom(S.tech, 0.9);
  boom(S.montage, 1.2);
  boom(S.outro, 1.3);
  const swell = (t0, dur, amp = 1) =>
    noise(amb, { t: t0, dur, amp: 0.16 * amp, seed: Math.round(t0 * 13) + 1, bpFn: (x) => 300 + 6500 * x * x, q: 1.6, envFn: (x) => Math.pow(x, 2.2) * (x > 0.97 ? (1 - x) / 0.03 : 1), panFn: (x) => Math.sin(x * 9) * 0.5 });
  swell(5.6, 2.4, 0.8);
  swell(16.5, 1.5, 0.6);
  swell(29.5, 2.5, 1);
  swell(45.2, 1.8, 0.9);
  swell(57.6, 2.4, 1.1);
  swell(68.6, 1.4, 1);

  // send → reverb
  const send = new Buf(LEN);
  send.mix(pad, 0.7);
  send.mix(arp, 0.8);
  send.mix(bell, 1.2);
  send.mix(amb, 0.5);
  const wet = send.reverb(1.25, 0.3);

  master.mix(pad, 1.0);
  master.mix(arp, 0.95);
  master.mix(bell, 0.9);
  master.mix(bass, 0.95);
  master.mix(drums, 0.8);
  master.mix(amb, 0.9);
  master.mix(wet, 1.0);
  master.highpass(28);
  master.each((t) => Math.min(1, t / 0.4) * (t > 73.2 ? clamp((75 - t) / 1.8) : 1));
  master.normalize(1.25);
  master.softClip(1.05);
  master.normalize(0.89);

  const wavPath = join(OUT, "music.wav");
  master.wav(wavPath);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-t", "75", "-codec:a", "libmp3lame", "-b:a", "224k", join(OUT, "music.mp3")]);
  rmSync(wavPath);
}

// ---------- SFX ----------
function sfx() {
  const dir = join(OUT, "sfx");
  mkdirSync(dir, { recursive: true });
  const save = (name, buf, peak = 0.85, verb = 0) => {
    if (verb) buf.mix(buf.reverb(1, 0.4), verb);
    buf.normalize(peak);
    buf.wav(join(dir, `${name}.wav`));
  };

  // digital whoosh (right → left, matches RTL flow)
  let b = new Buf(1.0);
  noise(b, { t: 0, dur: 0.8, amp: 1, seed: 21, bpFn: (x) => 400 + 5200 * Math.sin(x * Math.PI), q: 2.2, envFn: (x) => Math.pow(Math.sin(x * Math.PI), 2), panFn: (x) => 0.8 - 1.6 * x });
  tone(b, { t: 0.05, dur: 0.6, freq: 240, freqEnd: 900, amp: 0.08, attack: 0.2, release: 0.3 });
  save("whoosh", b, 0.8, 0.5);

  b = new Buf(0.7);
  noise(b, { t: 0, dur: 0.42, amp: 1, seed: 22, bpFn: (x) => 900 + 7000 * x, q: 3, envFn: (x) => Math.pow(Math.sin(x * Math.PI), 1.5), panFn: (x) => -0.6 + 1.2 * x });
  save("swish", b, 0.7, 0.4);

  // UI click
  b = new Buf(0.25);
  tone(b, { t: 0, dur: 0.03, freq: 2400, amp: 1, decay: 0.008, attack: 0.0005, release: 0.01 });
  tone(b, { t: 0.012, dur: 0.05, freq: 3600, amp: 0.5, decay: 0.012, attack: 0.0005, release: 0.01 });
  save("click", b, 0.6, 0.25);

  // soft key tick
  b = new Buf(0.12);
  noise(b, { t: 0, dur: 0.02, amp: 1, seed: 5, bpFn: () => 4200, q: 3, envFn: (x) => Math.pow(1 - x, 2) });
  tone(b, { t: 0, dur: 0.02, freq: 1500, amp: 0.4, decay: 0.006, attack: 0.0005, release: 0.005 });
  save("tick", b, 0.5);

  // pop / node activation (rising blip)
  b = new Buf(0.6);
  tone(b, { t: 0, dur: 0.16, freq: 520, freqEnd: 1560, amp: 1, decay: 0.07, attack: 0.002, release: 0.04 });
  tone(b, { t: 0, dur: 0.22, freq: 1040, freqEnd: 3120, amp: 0.3, decay: 0.08, attack: 0.002, release: 0.04 });
  save("pop", b, 0.7, 0.5);

  // bass impact
  b = new Buf(2.4);
  tone(b, { t: 0, dur: 2.0, freq: 95, freqEnd: 28, amp: 1, decay: 0.5, attack: 0.002, release: 0.5 });
  tone(b, { t: 0, dur: 0.5, freq: 190, freqEnd: 50, amp: 0.4, decay: 0.12, attack: 0.001, release: 0.1 });
  noise(b, { t: 0, dur: 1.4, amp: 0.5, seed: 31, bpFn: (x) => 5000 * (1 - x) + 200, q: 0.7, envFn: (x) => Math.pow(1 - x, 3) });
  b.softClip(1.6);
  save("impact", b, 0.92, 0.4);

  // riser
  b = new Buf(2.2);
  noise(b, { t: 0, dur: 2.0, amp: 1, seed: 41, bpFn: (x) => 250 + 9000 * Math.pow(x, 2.2), q: 2.5, envFn: (x) => Math.pow(x, 1.8) * (x > 0.97 ? (1 - x) / 0.03 : 1), panFn: (x) => Math.sin(x * 20) * 0.5 });
  tone(b, { t: 0, dur: 2.0, freq: 180, freqEnd: 1440, amp: 0.12, attack: 1.6, release: 0.03 });
  save("riser", b, 0.75);

  // shimmer / sparkle
  b = new Buf(1.8);
  [84, 88, 91, 96, 100, 103].forEach((n, k) => {
    tone(b, { t: k * 0.055, dur: 1.2, freq: midi(n), amp: 0.5, decay: 0.28, attack: 0.002, release: 0.3, pan: (k - 2.5) * 0.3 });
    tone(b, { t: k * 0.055, dur: 0.7, freq: midi(n) * 2.01, amp: 0.15, decay: 0.12, attack: 0.002, release: 0.2, pan: (2.5 - k) * 0.3 });
  });
  save("shimmer", b, 0.6, 0.9);

  // glitch / data burst
  b = new Buf(0.5);
  const r = rng(77);
  for (let k = 0; k < 9; k++) {
    tone(b, { t: k * 0.032, dur: 0.026, freq: 600 + r() * 5200, amp: 0.7, attack: 0.001, release: 0.004, wave: "saw", pan: r() * 1.6 - 0.8 });
  }
  save("glitch", b, 0.45, 0.2);

  // explosion of particles: impact + bright spray
  b = new Buf(3);
  tone(b, { t: 0, dur: 2.2, freq: 110, freqEnd: 26, amp: 1, decay: 0.6, attack: 0.002, release: 0.5 });
  noise(b, { t: 0, dur: 2.4, amp: 0.7, seed: 51, bpFn: (x) => 9000 * Math.pow(1 - x, 1.5) + 400, q: 0.8, envFn: (x) => Math.pow(1 - x, 2.2), panFn: (x) => Math.sin(x * 30) * 0.7 });
  [91, 96, 98, 103].forEach((n, k) => tone(b, { t: 0.02 + k * 0.03, dur: 1.6, freq: midi(n), amp: 0.14, decay: 0.4, attack: 0.002, release: 0.3, pan: k * 0.4 - 0.6 }));
  b.softClip(1.4);
  save("burst", b, 0.92, 0.6);
}

mkdirSync(OUT, { recursive: true });
console.time("music");
music();
console.timeEnd("music");
sfx();
console.log("audio written to", OUT);
