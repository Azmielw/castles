// Builds word-synced captions + SRT from the voiceover word timestamps.
// Input : src/config/script.json, src/data/voiceover-words.raw.json, public/audio/voiceover.mp3
// Output: src/data/voiceover.generated.json, out/captions.srt, public/captions.srt
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = JSON.parse(readFileSync(join(ROOT, "src/config/script.json"), "utf8"));
const raw = JSON.parse(readFileSync(join(ROOT, "src/data/voiceover-words.raw.json"), "utf8")).words.filter((w) => w.type === "word");

const PUNCT = /[،.!؟?…,:؛]+$/u;
const norm = (s) => s.replace(/[ً-ْٰ]/g, "").replace(/[أإآ]/g, "ا").replace(PUNCT, "");
const isLatin = (s) => /^[A-Za-z0-9]/.test(s);
const round = (x) => Math.round(x * 1000) / 1000;

// --- find the quietest sample between two paragraphs so cuts never clip a word
const SR = 16000;
const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-i", join(ROOT, "public/audio/voiceover.mp3"), "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
const total = samples.length / SR;
const rms = (t, win = 0.03) => {
  const a = Math.max(0, Math.round((t - win / 2) * SR));
  const b = Math.min(samples.length, a + Math.round(win * SR));
  let s = 0;
  for (let i = a; i < b; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / Math.max(1, b - a));
};
const quietest = (from, to) => {
  let best = from;
  let bestV = Infinity;
  for (let t = from; t <= to; t += 0.005) {
    const v = rms(t);
    if (v < bestV) [bestV, best] = [v, t];
  }
  return best;
};

// --- map script paragraphs onto the timestamped words
let cursor = 0;
const paras = script.paragraphs.map((p) => {
  const texts = p.text.trim().split(/\s+/);
  const first = cursor;
  cursor += texts.length;
  return { ...p, texts, first, last: cursor - 1 };
});
if (cursor !== raw.length) throw new Error(`script has ${cursor} words but the recording has ${raw.length}`);

const cuts = [0];
for (let i = 1; i < paras.length; i++) {
  const prevEnd = raw[paras[i].first - 1].end;
  const nextStart = raw[paras[i].first].start;
  cuts.push(quietest(prevEnd - 0.25, nextStart + 0.1));
}
cuts.push(total);

const violet = new Set(script.highlight.violet.map(norm));
const blue = new Set(script.highlight.blue.map(norm));
const segments = [];
const phrases = [];

paras.forEach((p, pi) => {
  const srcStart = cuts[pi];
  const srcEnd = cuts[pi + 1];
  const shift = p.placeAt - srcStart;
  segments.push({ id: p.id, srcStart: round(srcStart), srcEnd: round(srcEnd), placeAt: p.placeAt, endAt: round(p.placeAt + srcEnd - srcStart), text: p.text });

  // tokens: merge consecutive Latin words (brand names) so RTL layout keeps them in order
  const tokens = [];
  p.texts.forEach((text, k) => {
    const w = raw[p.first + k];
    const prev = tokens[tokens.length - 1];
    const brk = PUNCT.test(text) || /\.\.\.$/.test(text);
    if (prev && prev.latin && isLatin(text) && !prev.brk) {
      prev.full += " " + text;
      prev.end = round(w.end + shift);
      prev.brk = brk;
    } else {
      tokens.push({ full: text, start: round(w.start + shift), end: round(w.end + shift), latin: isLatin(text), brk });
    }
  });
  tokens.forEach((t) => {
    t.text = t.full.replace(/\.\.\.$/, "").replace(PUNCT, "");
    const key = norm(t.text);
    t.color = violet.has(key) ? "violet" : blue.has(key) ? "blue" : "white";
  });

  // short phrases: break on punctuation, cap the word count, avoid one-word orphans
  const max = script.maxWordsPerCaption;
  let clause = [];
  const flush = () => {
    if (!clause.length) return;
    const n = Math.ceil(clause.length / max);
    const size = Math.ceil(clause.length / n);
    for (let i = 0; i < clause.length; i += size) phrases.push({ seg: p.id, tokens: clause.slice(i, i + size) });
    clause = [];
  };
  tokens.forEach((t) => {
    clause.push(t);
    if (t.brk) flush();
  });
  flush();
});

phrases.forEach((ph, i) => {
  ph.start = ph.tokens[0].start;
  const lastEnd = ph.tokens[ph.tokens.length - 1].end;
  const next = phrases[i + 1];
  ph.end = round(Math.min(next ? next.tokens[0].start - 0.02 : Infinity, lastEnd + 0.7));
  ph.tokens = ph.tokens.map(({ text, full, start, end, color, latin }) => ({ text, full, start, end, color, latin }));
});

writeFileSync(join(ROOT, "src/data/voiceover.generated.json"), JSON.stringify({ duration: round(total), segments, phrases }, null, 1));

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = phrases.map((ph, i) => `${i + 1}\n${ts(ph.start)} --> ${ts(ph.end)}\n${ph.tokens.map((t) => t.full).join(" ")}\n`).join("\n");
mkdirSync(join(ROOT, "out"), { recursive: true });
writeFileSync(join(ROOT, "out/captions.srt"), srt);
writeFileSync(join(ROOT, "public/captions.srt"), srt);
console.log(`${segments.length} voice segments, ${phrases.length} captions`);
segments.forEach((s) => console.log(s.id.padEnd(9), "src", s.srcStart, "→", s.srcEnd, "| timeline", s.placeAt, "→", s.endAt));
