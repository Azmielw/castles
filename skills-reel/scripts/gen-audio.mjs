// Synthesizes the music bed and SFX kit as 16-bit WAVs — no downloads, deterministic.
import fs from "node:fs";
const SR = 44100;
const out = "public/audio";
fs.mkdirSync(out, { recursive: true });

function wav(name, ch) {
  const [L, R] = ch.length === 2 ? ch : [ch[0], ch[0]];
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(`${out}/${name}.wav`, buf);
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const arr = (sec) => new Float32Array(Math.round(sec * SR));
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// ---- music bed: 96 BPM, warm detuned pad + soft kick + quiet hats, A minor-ish loop
{
  const len = 70, bpm = 96, beat = 60 / bpm;
  const L = arr(len), R = arr(len);
  const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]; // Am F C G
  const bar = beat * 4;
  for (let i = 0; i < L.length; i++) {
    const t = i / SR;
    const ci = Math.floor(t / (bar * 2)) % 4;
    const local = t % (bar * 2);
    const env = Math.min(1, local / 1.2) * Math.min(1, (bar * 2 - local) / 0.6);
    let l = 0, r = 0;
    for (const m of chords[ci]) {
      const f = midi(m - 12);
      l += Math.sin(2 * Math.PI * f * 0.997 * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.003 * t);
      r += Math.sin(2 * Math.PI * f * 1.003 * t) + 0.35 * Math.sin(2 * Math.PI * f * 1.997 * t);
    }
    const sub = 0.5 * Math.sin(2 * Math.PI * midi(chords[ci][0] - 24) * t);
    L[i] = (l * 0.045 + sub * 0.08) * env;
    R[i] = (r * 0.045 + sub * 0.08) * env;
    // kick on every beat after the intro (from 5.5 s), hats on off-beats
    if (t > 5.5 && t < len - 3) {
      const bt = t % beat;
      const k = bt < 0.25 ? Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-bt * 30)) * bt) * Math.exp(-bt * 14) : 0;
      const ht = (t + beat / 2) % beat;
      const h = ht < 0.04 ? rnd() * Math.exp(-ht * 120) * 0.05 : 0;
      L[i] += k * 0.22 + h; R[i] += k * 0.22 + h;
    }
    const fade = Math.min(1, t / 1.5) * Math.min(1, (len - t) / 2.5);
    L[i] *= fade; R[i] *= fade;
  }
  wav("bed", [L, R]);
}
// ---- whoosh: band-swept noise
{
  const a = arr(0.55); let lp = 0, lp2 = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / a.length;
    const c = 0.02 + 0.25 * Math.sin(Math.PI * t);
    lp += c * (rnd() - lp); lp2 += c * (lp - lp2);
    a[i] = (lp - lp2) * 3.2 * Math.sin(Math.PI * t) ** 1.5;
  }
  wav("whoosh", [a]);
}
// ---- pop: pitch-drop sine
{
  const a = arr(0.14);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR; ph += (2 * Math.PI * (180 + 520 * Math.exp(-t * 40))) / SR;
    a[i] = Math.sin(ph) * Math.exp(-t * 28) * 0.6;
  }
  wav("pop", [a]);
}
// ---- click: tiny UI tick
{
  const a = arr(0.05);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    a[i] = (Math.sin(2 * Math.PI * 3200 * t) * 0.5 + rnd() * 0.3) * Math.exp(-t * 160) * 0.5;
  }
  wav("click", [a]);
}
// ---- thump: low hit for big reveals
{
  const a = arr(0.6);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    a[i] = (Math.sin(2 * Math.PI * (45 + 70 * Math.exp(-t * 25)) * t) * Math.exp(-t * 7) + rnd() * 0.15 * Math.exp(-t * 60)) * 0.8;
  }
  wav("thump", [a]);
}
// ---- shimmer: bright sparkle for the Skills reveal / matches
{
  const a = arr(1.1);
  const fs_ = [1568, 2093, 2637, 3136];
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    let s = 0;
    fs_.forEach((f, k) => { const st = k * 0.06; if (t > st) s += Math.sin(2 * Math.PI * f * (t - st)) * Math.exp(-(t - st) * 4); });
    a[i] = s * 0.12 * (0.8 + 0.2 * Math.sin(2 * Math.PI * 9 * t));
  }
  wav("shimmer", [a]);
}
// ---- buzz: soft "wrong" tone for the warning / removed skills
{
  const a = arr(0.3);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const sq = Math.sign(Math.sin(2 * Math.PI * 110 * t)) * 0.5 + Math.sin(2 * Math.PI * 116 * t) * 0.5;
    a[i] = sq * Math.exp(-t * 9) * 0.22;
  }
  wav("buzz", [a]);
}
console.log("audio ok");
