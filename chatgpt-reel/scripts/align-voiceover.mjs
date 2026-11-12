// Offline word timing for your OWN recording (no external service).
// 1. Put the recording in public/audio/voiceover.mp3 (read exactly the text in src/config/script.json,
//    with a short pause between paragraphs).  2. npm run sync
// It finds the speech between silences, splits it into the script's paragraphs at the longest pauses,
// and spreads each paragraph's words across its speech by word length. Good enough for captions;
// for exact word timing, replace src/data/voiceover-words.raw.json with output from any transcription tool.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MP3 = join(ROOT, "public/audio/voiceover.mp3");
const script = JSON.parse(readFileSync(join(ROOT, "src/config/script.json"), "utf8"));

// ffmpeg prints silencedetect results on stderr
const out = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${MP3}" -af silencedetect=noise=-38dB:d=0.18 -f null - 2>&1`], { encoding: "utf8" });
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", MP3], { encoding: "utf8" }));

// silences → speech regions
const sil = [];
let cur = null;
for (const line of out.split("\n")) {
  const s = line.match(/silence_start: ([\d.]+)/);
  const e = line.match(/silence_end: ([\d.]+)/);
  if (s) cur = { s: Number(s[1]) };
  if (e && cur) sil.push({ s: cur.s, e: Number(e[1]) }), (cur = null);
}
if (cur) sil.push({ s: cur.s, e: dur });
const speech = [];
let t = 0;
for (const x of sil) {
  if (x.s - t > 0.05) speech.push({ s: t, e: x.s });
  t = x.e;
}
if (dur - t > 0.05) speech.push({ s: t, e: dur });

// paragraph boundaries = the (n-1) longest gaps between speech regions, kept in order
const gaps = speech.slice(1).map((r, i) => ({ i: i + 1, len: r.s - speech[i].e }));
const n = script.paragraphs.length;
const cutIdx = gaps.sort((a, b) => b.len - a.len).slice(0, n - 1).map((g) => g.i).sort((a, b) => a - b);
const groups = [];
let start = 0;
for (const c of [...cutIdx, speech.length]) groups.push(speech.slice(start, c)), (start = c);

const words = [];
script.paragraphs.forEach((p, pi) => {
  const regions = groups[pi] ?? [];
  const ws = p.text.trim().split(/\s+/);
  const weight = (w) => w.replace(/[ً-ْ]/g, "").length + 1.5;
  const total = ws.reduce((a, w) => a + weight(w), 0);
  const talk = regions.reduce((a, r) => a + (r.e - r.s), 0);
  let acc = 0;
  for (const w of ws) {
    const a = (acc / total) * talk;
    acc += weight(w);
    const b = (acc / total) * talk;
    // map talk-time back onto real time across the regions
    const at = (x) => {
      let left = x;
      for (const r of regions) {
        if (left <= r.e - r.s) return r.s + left;
        left -= r.e - r.s;
      }
      return regions.length ? regions[regions.length - 1].e : 0;
    };
    words.push({ text: w, type: "word", start: Math.round(at(a) * 1000) / 1000, end: Math.round(at(b) * 1000) / 1000 });
  }
});
writeFileSync(join(ROOT, "src/data/voiceover-words.raw.json"), JSON.stringify({ words }, null, 1));
console.log(`aligned ${words.length} words into ${n} paragraphs (${speech.length} speech regions, ${dur.toFixed(1)}s)`);
