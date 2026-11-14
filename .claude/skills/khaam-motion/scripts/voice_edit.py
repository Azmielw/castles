#!/usr/bin/env python3
"""Voice edits that never touch the speech - Khaam Motion.

Jobs on a narration take and its .words.json (from gen_tts_elevenlabs.py or align_voice.py):
  snap     moves each word edge that sits next to silence onto the waveform: a start after a pause moves to where
           the sound begins, an end that swallowed the pause moves back to the last sound (voiceover.md §10.9:
           ElevenLabs starts after a pause can be 0.1-0.2 s late, and a word's end can swallow the pause). Since 1.7
           it also pulls an edge in over a stretch of 0.10 s or more that is quiet in both measures (the 250-3800 Hz
           speech band and the full band) and reaches within 80 ms of the edge, so breath or room tone no longer hides
           the pause; a stretch loud above 3.8 kHz (a sibilant, «س») is never taken (--edges loud: the old rule only).
           Words joined to their neighbours keep their times. Writes a new .words.json; the audio is not changed.
  pause    makes chosen pauses longer: inserts silence inside the existing pause before a word (in its quietest
           spot, on the quietest sample) and moves every later word time by exactly the inserted time. The speech
           is never cut, stretched or re-pitched (no time-stretch). Writes a new WAV (24-bit, the take's own sample
           rate and channels) and its .words.json.
  tighten  makes pauses shorter, to the pace standard (reference/pace.md P2-P3): removes only TRUE silence (the
           speech band and the full band both 30 dB under the voice's median, in runs of 0.12 s or more, 20 ms
           from where the silence ends), one 10 ms equal-power crossfade per cut, never a stretch. Each pause keeps
           a length set by the script's punctuation after the word before it («…» 0.55 s when it is the one held
           beat, «.» «؟» «!» 0.24, «،» «:» or a line end 0.16, none --default 0.12, as the P3 measure takes a pause),
           and at a sentence end at least 0.15 s of true silence (0.25 s at a paragraph turn) so the last consonant
           stays clear. --hold WORD=SEC: the one held beat (lengthened with that gap's own silence if it is short,
           never digital zero); --before WORD=SEC: another target; --keep WORD=SEC: another true-silence floor;
           --gain FIRST..LAST=DB: a phrase louder or softer, ramped inside the pauses. Writes a 24-bit WAV, its
           .words.json (word times rebuilt from the cuts) and a report of every cut against the word boundaries,
           and prints the pace after the cut (first word, words/s, silence share, the held beat, the longest other
           gap) against its limits.
  levels   any take, cut or not: each sentence's level against the take's median (the 11-10 rule: no phrase more
           than 3 dB under) with the --gain line that would fix it, and the same pace numbers. With --gain and
           --out-audio it writes a copy with those gains (ramped inside the pauses); the times do not move.

    python -X utf8 scripts/voice_edit.py snap --audio "assets/vo/take1.mp3" --words "assets/vo/take1.words.json" \\
        --out "assets/vo/take1.snapped.words.json"
    python -X utf8 scripts/voice_edit.py pause --audio "assets/vo/take1.mp3" --words "assets/vo/take1.words.json" \\
        --snap --before "بس=0.5" "خلّها=0.9" "وإنت#2=0.4" --out-audio "assets/vo/vo.wav" [--out-words ...]
    python -X utf8 scripts/voice_edit.py tighten --audio "assets/vo/take1.mp3" --words "assets/vo/take1.words.json" \\
        [--script plan/vo/vo.txt] --hold "خلّها=0.66" [--gain "وش..عندك=2"] --out-audio "assets/vo/vo.wav"
    python -X utf8 scripts/voice_edit.py levels --audio "assets/vo/vo.wav" --words "assets/vo/vo.words.json"

A word is named as in cues.py: as written in the script (harakat, hamza forms, ى/ي and ة/ه ignored), «وإنت#2» for
the second time it is said, or two words «ليلة مطر» (the pause goes before the first). The pause must already
be there: a quiet run of 60 ms or more between that word and the one before it (voiceover.md §10.5: splice only
on the pauses). --snap snaps the edges first (the same as the snap job). Quiet is measured from the take itself
(--floor take, the default since 1.7: 38 dB under its loud level, or 3 dB less than its pauses are deep when they
are shallower, as in some designed voices). The script for tighten and levels: --script, else the take's own .json
sidecar from gen_tts_elevenlabs.py (the text sent), else the punctuation kept in the words ("raw"). Afterwards:
cues.py build (or cues.py beats) with the new words, and the new WAV in plan/sound.json ("voice"). Never overwrites
the take or its words; needs FFmpeg and NumPy.
"""
import argparse
import difflib
import hashlib
import json
import math
import os
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cues  # noqa: E402  (the word-naming rules, and UTF-8 output on Windows)
from khaam_paths import executable  # noqa: E402

HOP_S, WIN_S = 0.01, 0.02          # 10 ms steps, 20 ms windows
FLOOR_DB = 38.0                    # quiet = more than 38 dB under the take's loud level (its 90th percentile)
MIN_PAUSE_S = 0.06                 # a pause is a quiet run of 60 ms or more
MIN_FLOOR_DB = 18.0                # pauses shallower than this cannot be told from the voice

# tighten and levels: the measures of reference/pace.md (P3), taken as the direction's pauses.py takes them
BHOP_S = 0.02                      # 20 ms frames, 40 ms Hann windows, on a 16 kHz mono copy of the take
BAND = (250.0, 3800.0)             # the speech band
HIGH = (3800.0, 8000.0)            # sibilants: a stretch loud here is never taken as quiet
BAND_UNDER_DB = 15.0               # a pause (P3's measure): the speech band 15 dB under the median of its loud frames
DEEP_DB = 30.0                     # true silence: the band AND the full band 30 dB under that median
MIN_SILENT_S = 0.12                # only silent runs this long are cut (a stop's closure inside a word is shorter)
MARGIN_S = 0.02                    # never within 20 ms of where the silence ends
XF_S = 0.005                       # half of each cut's equal-power crossfade (10 ms in all)
TARGET_S = {'ellipsis': 0.55, 'stop': 0.24, 'comma': 0.16}   # the pause kept after each mark (P3 measure)
DEFAULT_S = 0.12                   # between words with no mark
END_FLOOR_S, TURN_FLOOR_S = 0.15, 0.25   # true silence kept at a sentence end / a paragraph turn
OTHER_MAX_S = 0.35                 # P3: every gap but the held beat 0.35 s or less
HOLD_RANGE = (0.5, 0.8)            # P3: one held beat of 0.5-0.8 s per 30 s
WPS_RANGE = (1.9, 2.4)             # P2: words a second over the spoken span
SILENCE_MAX = 0.10                 # P3: true silence inside the speech at most 10% of the spoken span
FIRST_WORD_MAX_S = 0.1             # P1: the first word by 0.1 s (of the video; here: of the file)
PHRASE_UNDER_DB = 3.0              # the 11-10 rule: no phrase more than 3 dB under the take


NOT_WORDS = []                     # tokens of a take's timings made only of invisible characters and punctuation


class EditError(Exception):
    pass


def need_numpy():
    try:
        import numpy as np
    except ImportError:
        raise EditError('NumPy is missing in this Python (the sound tools need it too): ask the user once, then '
                        'python -m pip install numpy scipy') from None
    return np


def ffmpeg_tools():
    ff, fp = executable('ffmpeg'), executable('ffprobe')
    if not ff or not fp:
        raise EditError('FFmpeg not found on PATH (install: winget install Gyan.FFmpeg / brew install ffmpeg / '
                        'sudo apt install ffmpeg)')
    return ff, fp


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def decode(path):
    """The take as raw 24-bit PCM at its own sample rate and channels: (bytes, rate, channels)."""
    ff, fp = ffmpeg_tools()
    r = subprocess.run([fp, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels',
                        '-of', 'json', str(path)], capture_output=True, text=True)
    try:
        st = json.loads(r.stdout)['streams'][0]
        rate, ch = int(st['sample_rate']), int(st['channels'])
    except (ValueError, KeyError, IndexError, TypeError):
        raise EditError('%s has no sound FFmpeg can read.' % Path(path).name) from None
    r = subprocess.run([ff, '-v', 'error', '-nostdin', '-i', str(path), '-map', '0:a:0', '-f', 's24le',
                        '-acodec', 'pcm_s24le', '-ar', str(rate), '-ac', str(ch), '-'], capture_output=True)
    if r.returncode or not r.stdout:
        raise EditError('FFmpeg could not decode %s: %s' % (Path(path).name, r.stderr.decode('utf-8', 'replace')[-200:]))
    fb = 3 * ch
    pcm = r.stdout[:len(r.stdout) // fb * fb]
    return pcm, rate, ch


def samples(np, pcm, ch):
    """24-bit little-endian PCM -> int32 array (frames, channels)."""
    b = np.frombuffer(pcm, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
    x = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
    x = np.where(x >= 1 << 23, x - (1 << 24), x)
    return x.reshape(-1, ch)


def _step_db(np, x, rate):
    """dB of every 10 ms step (20 ms windows) of the take, mono."""
    mono = x.astype(np.float64).mean(axis=1) / 8388608.0
    hop, win = max(1, int(round(rate * HOP_S))), max(2, int(round(rate * WIN_S)))
    if len(mono) < win:
        raise EditError('The take is too short to edit.')
    cs = np.concatenate(([0.0], np.cumsum(mono ** 2)))
    k = np.arange(0, len(mono) - win + 1, hop)
    db = 20 * np.log10(np.sqrt(np.maximum(cs[k + win] - cs[k], 0.0) / win) + 1e-9)
    return db, hop


def loudness(np, x, rate):
    """Per 10 ms step: is the sound loud (speech) or quiet? Returns (loud mask, hop seconds, threshold dB).
    The fixed 38 dB floor of 1.6 (kept for tools that import it); the jobs use loudness_info(..., 'take')."""
    db, hop = _step_db(np, x, rate)
    thr = float(np.percentile(db, 90) - FLOOR_DB)
    return db > thr, hop / float(rate), thr


def loudness_info(np, x, rate, floor='take'):
    """As loudness(), with the floor measured from the take itself: 38 dB under its loud level, or 3 dB less than
    its pauses are deep when they are shallower (a designed voice's pauses can sit only ~33 dB under its speech).
    Returns (loud mask, hop seconds, threshold dB, info)."""
    db, hop = _step_db(np, x, rate)
    top, low = float(np.percentile(db, 90)), float(np.percentile(db, 5))
    depth = top - low
    if floor in (None, 'take'):
        use = min(FLOOR_DB, depth - 3.0)
    else:
        try:
            use = float(floor)
        except ValueError:
            raise EditError('--floor is "take" or a number of dB (e.g. 32).') from None
    info = {'pause_depth_db': round(depth, 1), 'quiet_under_db': round(use, 1),
            'floor': 'take' if floor in (None, 'take') else 'given'}
    if use < MIN_FLOOR_DB:
        raise EditError('This take\'s pauses sit only %.0f dB under its speech (noise, room tone or music in the '
                        'pauses), so silence cannot be told from the voice. Clean the recording first, or pass '
                        '--floor <dB> (quiet = that many dB under the loud level; %.0f or more).'
                        % (depth, MIN_FLOOR_DB))
    return db > top - use, hop / float(rate), top - use, info


def read_words(path):
    p = Path(path).expanduser()
    if not p.is_file():
        raise EditError('Word timings not found: %s' % p.name)
    try:
        data = json.loads(p.read_text(encoding='utf-8-sig'))
    except ValueError:
        raise EditError('%s is not valid JSON.' % p.name) from None
    rows = data.get('words') if isinstance(data, dict) else data
    if not isinstance(rows, list) or not rows:
        raise EditError('%s has no "words" list.' % p.name)
    for r in rows:
        if not (r.get('word') or r.get('text')) or 'start' not in r or 'end' not in r:
            raise EditError('%s has a word with no text, start or end.' % p.name)
    rows, dropped = cues.clean_rows(rows)   # invisible characters are not there; a token of only them is no word
    NOT_WORDS.extend(dropped)
    return (data if isinstance(data, dict) else {'words': rows}), [dict(r) for r in rows], p


def label(r):
    return r.get('word') or r.get('text')


def snap(np, rows, loud, hop_s):
    """The edges next to silence onto the waveform. Returns (new rows, moves)."""
    n = len(loud)

    def fr(t):
        return int(round(t / hop_s))
    back, fwd, joined, pad = fr(0.25), fr(0.30), fr(0.03), fr(0.02)
    out, moves = [dict(r) for r in rows], []
    for i, w in enumerate(out):
        s0, e0 = float(w['start']), float(w['end'])
        s = fr(s0)
        # start: the onset (quiet -> loud) nearest the given start, 0.25 s before to 0.30 s after it, never before the
        # previous word's end; only when the given start is not inside continuous sound (joined words keep it)
        r0 = max(1, s - back, fr(float(out[i - 1]['end'])) if i else 1)
        r1 = min(n, s + fwd)
        onsets = [k for k in range(r0, r1) if loud[k] and not loud[k - 1]]
        if onsets and s < n and not loud[max(0, s - joined):s + 1].all():
            k = min(onsets, key=lambda k: abs(k - s))
            ns = round(k * hop_s, 3)
            if abs(ns - s0) > 0.015 and ns < e0 - 0.04:
                moves.append({'word': label(w), 'edge': 'start', 'from': round(s0, 3), 'to': ns})
                w['start'] = ns
        # end: when the word ends in quiet, back to its last loud step (+20 ms)
        e = min(n, fr(e0))
        if e > 0 and not loud[min(n - 1, e - 1)]:
            a0 = fr(float(w['start']))
            inside = np.flatnonzero(loud[a0:e])
            if len(inside):
                ne = round((a0 + int(inside[-1]) + pad) * hop_s, 3)
                if e0 - ne > 0.015 and ne > float(w['start']) + 0.04:
                    moves.append({'word': label(w), 'edge': 'end', 'from': round(e0, 3), 'to': ne})
                    w['end'] = ne
    return out, moves


# ---------------------------------------------------------------- the speech band (P3's measure), true silence
def runs_of(np, mask):
    """[(start, end)] of the True runs of a 1-D mask (end exclusive)."""
    m = np.concatenate(([False], np.asarray(mask, dtype=bool), [False]))
    d = np.diff(m.astype(np.int8))
    return list(zip(np.flatnonzero(d == 1).tolist(), np.flatnonzero(d == -1).tolist()))


def bands(np, path):
    """The take as the direction's pauses.py reads it: FFmpeg to 16 kHz mono, 40 ms Hann windows every 20 ms; per
    frame the 250-3800 Hz band, the full band and the 3.8-8 kHz band (dB), the band's median over its loud frames
    (ref), and the thresholds of true silence (30 dB under ref, or 3 dB over the take's own floor when its pauses
    are shallower)."""
    ff, _ = ffmpeg_tools()
    r = subprocess.run([ff, '-v', 'error', '-nostdin', '-threads', '1', '-i', str(path), '-map', '0:a:0', '-ac', '1',
                        '-ar', '16000', '-f', 's16le', '-'], capture_output=True)
    if r.returncode or not r.stdout:
        raise EditError('FFmpeg could not read %s.' % Path(path).name)
    x = np.frombuffer(r.stdout[:len(r.stdout) // 2 * 2], np.int16).astype(np.float32) / 32768.0
    hop, win = 320, 640
    n = len(x) // hop
    full_n = max(0, (len(x) - win) // hop + 1)
    band, full, high = (np.full(n, -120.0) for _ in range(3))
    if full_n:
        w = np.hanning(win).astype(np.float32)
        fr = np.fft.rfftfreq(win, 1 / 16000.0)
        mb, mh = (fr >= BAND[0]) & (fr <= BAND[1]), (fr > HIGH[0]) & (fr <= HIGH[1])
        for c0 in range(0, full_n, 2048):              # in blocks: little memory on a long take
            c1 = min(full_n, c0 + 2048)
            idx = (np.arange(c0, c1) * hop)[:, None] + np.arange(win)[None, :]
            S = np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2
            band[c0:c1] = 10 * np.log10(S[:, mb].sum(axis=1) + 1e-12)
            full[c0:c1] = 10 * np.log10(S.sum(axis=1) + 1e-12)
            high[c0:c1] = 10 * np.log10(S[:, mh].sum(axis=1) + 1e-12)
    if not n:
        raise EditError('%s is too short to measure.' % Path(path).name)
    ref = float(np.median(band[band > np.percentile(band, 40)]))
    # the take's own pause floor: the median level of the frames inside its pauses (the band 15 dB under). A clean
    # take's floor sits far under ref - 30 and changes nothing; a designed voice with noise in its pauses (sample
    # 06: the full band only ~29 dB under) gets its true silence at 6 dB over that floor, never closer to the voice
    # than 24 dB.
    pz = band[:full_n] < ref - BAND_UNDER_DB
    floor_b = float(np.median(band[:full_n][pz])) if pz.sum() > 10 else ref - 60.0
    floor_f = float(np.median(full[:full_n][pz])) if pz.sum() > 10 else ref - 60.0
    thr_b = max(ref - DEEP_DB, min(floor_b + 6.0, ref - 24.0))
    thr_f = max(ref - DEEP_DB, min(floor_f + 6.0, ref - 24.0))
    loud_f = np.flatnonzero(band >= ref - BAND_UNDER_DB)
    return {'band': band, 'full': full, 'high': high, 'ref': ref, 'hi_ref': float(np.percentile(high, 90)),
            'thr_band': thr_b, 'thr_full': thr_f, 'deep_under_db': round(ref - max(thr_b, thr_f), 1), 'n': n,
            'pause_floor_db': [round(floor_b - ref, 1), round(floor_f - ref, 1)],
            'first_sound_s': round(float(loud_f[0]) * BHOP_S + BHOP_S, 3) if len(loud_f) else None,
            'seconds': len(x) / 16000.0}


def ref_of(np, band):
    return float(np.median(band[band > np.percentile(band, 40)]))


def band_edges(np, rows, A, loud, hop_s, rate, N):
    """Pull a word edge in over a stretch of 0.10 s or more that is quiet in both measures (the speech band 15 dB
    under its median, and the full band not loud) and reaches within 80 ms of the edge, leaving 20 ms of it on the
    word; never over a stretch loud above 3.8 kHz (a sibilant). An ElevenLabs word span can swallow the pause after
    it, and breath or room tone can keep the full band above the plain snap's floor (sample 02, 11-12)."""
    bh = rate * BHOP_S
    quiet = (A['band'] < A['ref'] - BAND_UNDER_DB) & (A['high'] < A['hi_ref'] - 22.0)
    ok = np.zeros(N, bool)
    for s0, s1 in runs_of(np, quiet):    # frame j's level stands for the samples around its window's middle
        ok[int(s0 * bh + bh / 2):min(N, int(s1 * bh + bh / 2))] = True
    ld = loud.copy()
    ld[1:] |= loud[:-1]
    ld[:-1] |= loud[1:]                   # a loud 20 ms window reaches into its neighbours
    lm = np.repeat(~ld, int(round(hop_s * rate)))[:N]
    ok[:len(lm)] &= lm
    ok[len(lm):] = False
    MIN, KEEP, NEAR, INNER = (int(round(t * rate)) for t in (0.10, 0.02, 0.08, 0.06))
    out, moves = [dict(r) for r in rows], []
    for w in out:
        s0, s1 = int(round(float(w['start']) * rate)), int(round(float(w['end']) * rate))
        if s1 - s0 < 2 * INNER:
            continue
        rr = [(s0 + u, s0 + v) for u, v in runs_of(np, ok[s0:s1]) if v - u >= MIN]
        tail = [r for r in rr if r[1] >= s1 - NEAR and r[0] > s0 + INNER]
        if tail:
            r0 = min(r[0] for r in tail)
            new = round((r0 + KEEP) / float(rate), 3)
            if new < float(w['end']) - 0.015:
                moves.append({'word': label(w), 'edge': 'end (band)', 'from': round(float(w['end']), 3), 'to': new})
                w['end'] = new
                s1 = r0 + KEEP
        head = [r for r in rr if r[0] <= s0 + NEAR and r[1] < s1 - INNER]
        if head:
            r1 = max(r[1] for r in head)
            new = round((r1 - KEEP) / float(rate), 3)
            if new > float(w['start']) + 0.015 and new < float(w['end']) - 0.04:
                moves.append({'word': label(w), 'edge': 'start (band)', 'from': round(float(w['start']), 3), 'to': new})
                w['start'] = new
    return out, moves


def true_silence(np, A, N, rate, lo_s, hi_s):
    """Sample mask of what may be cut: runs of frames where the band and the full band are both under the true-
    silence thresholds, 0.12 s or longer, minus 20 ms at each end, inside [lo_s, hi_s] seconds."""
    deep = (A['band'] < A['thr_band']) & (A['full'] < A['thr_full'])
    bh, m = rate * BHOP_S, int(round(MARGIN_S * rate))
    ok = np.zeros(N, bool)
    for s0, s1 in runs_of(np, deep):
        if (s1 - s0) * BHOP_S < MIN_SILENT_S - 1e-9:
            continue
        a0 = int(round(s0 * bh + bh)) + m          # frame s0's window may hold sound in its first half
        a1 = int(round(s1 * bh + bh)) - m          # frame s1-1's window ends at (s1+1) * hop
        if a1 > a0:
            ok[max(0, a0):min(N, a1)] = True
    ok[:max(0, int(round(lo_s * rate)))] = False
    ok[min(N, int(round(hi_s * rate))):] = False
    return ok, deep


def joint_run(A, bquiet, ps, e0, s1, ne):
    """The band-quiet run (P3's measure) at the joint between two words: (first frame, end frame) or None."""
    f0, f1 = max(0, int(ps / BHOP_S)), min(len(bquiet), int(ne / BHOP_S) + 1)
    best = None
    for r0, r1 in _runs_py(bquiet[f0:f1]):
        r0, r1 = r0 + f0, r1 + f0
        if r1 * BHOP_S > min(e0, s1) - 0.06 and r0 * BHOP_S < max(e0, s1) + 0.06:
            if best is None or (r1 - r0) > (best[1] - best[0]):
                best = (r0, r1)
    return best


def _runs_py(mask):
    out, s = [], None
    for i, q in enumerate(mask):
        if q and s is None:
            s = i
        if not q and s is not None:
            out.append((s, i))
            s = None
    if s is not None:
        out.append((s, len(mask)))
    return out


# ---------------------------------------------------------------- the script's punctuation
ELLIPSIS, STOPS, COMMAS = ('…', '...'), '.؟?!', '،,؛;:—–'


def mark_kind(marks):
    if any(e in marks for e in ELLIPSIS):
        return 'ellipsis'
    if any(c in marks for c in STOPS):
        return 'stop'
    if any(c in marks for c in COMMAS) or '\n' in marks:
        return 'comma'
    return None


def script_tokens(text):
    """[[word, marks after it, turn after it]] of a script; tags removed, a line end adds '\\n' to the marks, a blank
    line after a word is a paragraph turn."""
    out = []
    for line in text.replace('\r\n', '\n').split('\n'):
        line = cues.visible(cues.TAG_RE.sub(' ', line)).strip()   # invisible characters are not text
        if not line:
            if out:
                out[-1][2] = True
            continue
        for raw in line.split():
            if not any(c.isalnum() for c in raw):
                if out:
                    out[-1][1] += raw
                continue
            last = max(k for k, c in enumerate(raw) if c.isalnum())
            out.append([raw.strip(cues.PUNCT), raw[last + 1:], False])
        if out:
            out[-1][1] += '\n'
    return out


def find_script(a, audio, data):
    """(text, where it came from) for tighten and levels: --script, else the take's .json sidecar, else None."""
    if getattr(a, 'script', None):
        p = Path(a.script).expanduser()
        if not p.is_file():
            raise EditError('Script file not found: %s' % p.name)
        return p.read_text(encoding='utf-8-sig'), p.name
    for side in (audio.with_name(audio.name + '.json'), audio.with_suffix('.json')):
        if side.is_file() and not side.name.endswith('.words.json'):
            try:
                meta = json.loads(side.read_text(encoding='utf-8-sig'))
            except ValueError:
                continue
            if isinstance(meta, dict) and isinstance(meta.get('text'), str) and meta['text'].strip():
                return meta['text'], side.name + ' (the text sent)'
    return None, None


def word_marks(rows, text):
    """Per word: (kind of the mark after it, a paragraph turn after it, a sentence end after it); from the script
    when given (matched word by word), else from each word's own "raw" text. Returns (marks, source note)."""
    own = []
    for r in rows:
        raw = str(r.get('raw') or label(r))
        last = max((k for k, c in enumerate(raw) if c.isalnum()), default=len(raw) - 1)
        kind = mark_kind(raw[last + 1:])
        own.append((kind, False, kind == 'stop'))
    if not text:
        have = any(k for k, _, _ in own)
        return own, ('the punctuation kept in the words ("raw")' if have else 'none: every gap takes --default')
    toks = script_tokens(text)
    a = [cues.norm(t[0]) for t in toks]
    b = [cues.norm(label(r)) for r in rows]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    marks, hit = list(own), 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(j2 - j1):
                t = toks[i1 + k]
                kind = mark_kind(t[1])     # a sentence end: a stop, or «…» at the end of a line
                marks[j1 + k] = (kind, t[2], kind == 'stop' or (kind == 'ellipsis' and '\n' in t[1]))
                hit += 1
    return marks, '%d of %d words matched to the script' % (hit, len(rows))


# ---------------------------------------------------------------- options
def named_seconds(rows, items, what, lo, hi):
    """{word index: seconds} from WORD=SECONDS items."""
    out = {}
    for item in items or []:
        if '=' not in item:
            raise EditError('%s takes word=seconds, e.g. "بس=0.5" (got "%s").' % (what, item))
        key, sec = item.rsplit('=', 1)
        try:
            sec = float(sec)
        except ValueError:
            raise EditError('%s "%s": the seconds after = are not a number.' % (what, item)) from None
        if not lo <= sec <= hi:
            raise EditError('%s "%s": give between %s and %s seconds.' % (what, item, lo, hi))
        i = find_word(rows, key.strip())
        if i == 0:
            raise EditError('%s "%s": the first word has no pause before it.' % (what, item))
        if i in out:
            raise EditError('«%s» is named twice in %s: give it one time.' % (key, what))
        out[i] = sec
    return out


def gain_specs(rows, items):
    """[(first index, last index, dB, text)] from FIRST..LAST=DB items."""
    out = []
    for item in items or []:
        if '=' not in item or '..' not in item.rsplit('=', 1)[0]:
            raise EditError('--gain takes FIRST..LAST=DB, e.g. "وش..عندك=2" (got "%s").' % item)
        key, db = item.rsplit('=', 1)
        try:
            db = float(db)
        except ValueError:
            raise EditError('--gain "%s": the dB after = is not a number.' % item) from None
        if not -12 <= db <= 12:
            raise EditError('--gain "%s": keep it between -12 and +12 dB.' % item)
        k0, k1 = key.split('..', 1)
        i0, i1 = find_word(rows, k0.strip()), find_word(rows, k1.strip())
        if i1 < i0:
            raise EditError('--gain "%s": «%s» comes before «%s» in the take.' % (item, k1, k0))
        out.append((i0, i1, db, key))
    return out


def apply_gains(np, x, rows, specs, rate):
    """Each span louder or softer, the change ramped inside the pause before and after it (in its middle, up to
    40 ms long); words joined to the span get a 20 ms ramp 10-30 ms off the edge. Returns (x, report)."""
    N = len(x)
    gain = np.ones(N)
    rep = []
    for i0, i1, db, key in specs:
        g = 10 ** (db / 20.0)
        s, e = float(rows[i0]['start']), float(rows[i1]['end'])
        pe = float(rows[i0 - 1]['end']) if i0 > 0 else max(0.0, s - 0.1)
        ns = float(rows[i1 + 1]['start']) if i1 + 1 < len(rows) else min(N / float(rate), e + 0.1)

        def ramp(a_s, b_s):
            gap = b_s - a_s
            if gap >= 0.025:
                mid, ln = (a_s + b_s) / 2.0, min(0.04, 0.8 * gap)
                return mid - ln / 2, mid + ln / 2
            return None
        up = ramp(pe, s) or (s - 0.03, s - 0.01)
        down = ramp(e, ns) or (e + 0.01, e + 0.03)
        a0, a1 = (max(0, min(N, int(round(t * rate)))) for t in up)
        b0, b1 = (max(0, min(N, int(round(t * rate)))) for t in down)
        gain[a1:b0] *= g
        if a1 > a0:
            gain[a0:a1] *= np.linspace(1.0, g, a1 - a0)
        if b1 > b0:
            gain[b0:b1] *= np.linspace(g, 1.0, b1 - b0)
        rep.append({'words': key, 'db': db, 'from_s': round(a0 / float(rate), 3), 'to_s': round(b1 / float(rate), 3)})
    return x * gain[:, None], rep


def write_wav(np, path, y, rate, ch):
    yi = np.clip(np.round(y * 8388607), -8388608, 8388607).astype(np.int32)
    b = np.stack([(yi >> 0) & 255, (yi >> 8) & 255, (yi >> 16) & 255], axis=-1).astype(np.uint8)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(ch)
        wf.setsampwidth(3)
        wf.setframerate(rate)
        wf.writeframes(b.reshape(-1).tobytes())


# ---------------------------------------------------------------- the pace (reference/pace.md P1-P3)
def pace_numbers(np, path, rows, A=None):
    """P1-P3 of a take with its word times: first word, words/s over the spoken span, the true-silence share, the
    band measure's share (pauses.py: the band 15 dB under for 0.25 s or more), every gap by both measures."""
    A = A or bands(np, path)
    band, full = A['band'], A['full']
    a, b = float(rows[0]['start']), float(rows[-1]['end'])
    span = max(0.01, b - a)
    t = np.arange(A['n']) * BHOP_S
    inside = (t >= a) & (t <= b)
    bq = (band < A['ref'] - BAND_UNDER_DB) & inside
    band_runs = [(s, e) for s, e in runs_of(np, bq) if (e - s) * BHOP_S >= 0.25 - 1e-9]
    band_total = sum(e - s for s, e in band_runs) * BHOP_S
    deep = (band < A['thr_band']) & (full < A['thr_full']) & inside
    # a pause of true silence: a run of 0.25 s or more, as pauses.py counts a pause (the floors kept at sentence
    # ends, 0.15-0.25 s, are joints, not pauses); every true-silent run of 0.10 s or more is shown too
    true_runs = [(s, e) for s, e in runs_of(np, deep) if (e - s) * BHOP_S >= 0.25 - 1e-9]
    true_total = sum(e - s for s, e in true_runs) * BHOP_S
    all_true = sum(e - s for s, e in runs_of(np, deep) if (e - s) * BHOP_S >= 0.10 - 1e-9) * BHOP_S
    bquiet = band < A['ref'] - BAND_UNDER_DB
    gaps = []
    for i in range(1, len(rows)):
        ps, e0 = float(rows[i - 1]['start']), float(rows[i - 1]['end'])
        s1, ne = float(rows[i]['start']), float(rows[i]['end'])
        best = joint_run(A, bquiet, ps, e0, s1, ne)
        if not best:
            continue
        L = (best[1] - best[0]) * BHOP_S
        d = deep[best[0]:best[1]]
        tr = max([(e - s) for s, e in runs_of(np, d)] or [0]) * BHOP_S
        gaps.append({'before': label(rows[i]), 'i': i, 'at_s': round(best[0] * BHOP_S, 2), 'pause_s': round(L, 2),
                     'true_silence_s': round(tr, 2)})
    held = [g for g in gaps if g['pause_s'] >= 0.45 and g['true_silence_s'] > OTHER_MAX_S]
    others = [g for g in gaps if g not in held]
    longest = max(others, key=lambda g: (g['true_silence_s'], g['pause_s']), default=None)
    allowed = max(1, int(math.ceil(span / 30.0 - 1e-9)))
    checks = []

    def check(rule, value, limit, ok, note=None):
        row = {'rule': rule, 'value': value, 'limit': limit, 'ok': bool(ok)}
        if note:
            row['note'] = note
        checks.append(row)
    first = min(a, A['first_sound_s']) if A.get('first_sound_s') is not None else a
    check('P1 first word (in this file)', '%.2f s (aligned word %.2f s)' % (first, a),
          '<= %.1f s of the video' % FIRST_WORD_MAX_S, first <= FIRST_WORD_MAX_S + 1e-9,
          None if first <= FIRST_WORD_MAX_S + 1e-9 else
          'fine when the voice starts later on purpose; otherwise place it by 0.1 s (sound.json "at")')
    wps = len(rows) / span
    check('P2 words/s over the spoken span', round(wps, 2), '%.1f-%.1f' % WPS_RANGE,
          WPS_RANGE[0] - 1e-9 <= wps <= WPS_RANGE[1] + 1e-9,
          None if WPS_RANGE[0] - 1e-9 <= wps <= WPS_RANGE[1] + 1e-9 else
          'faster than the standard: keep more silence (higher targets)' if wps > WPS_RANGE[1] else
          'slower than the standard: when little was cut, the pauses carry room tone or breath that the take\'s own '
          'floor keeps; run tighten again with --floor 28 (then 30), never a time-stretch (the stores dry run of '
          '11-12: 1.76 -> 1.92 words/s on a designed voice)')
    check('P3 true silence share (pauses of 0.25 s or more)', '%.1f%%' % (100 * true_total / span),
          '<= %d%%' % round(100 * SILENCE_MAX), true_total / span <= SILENCE_MAX + 1e-9,
          'all true silence of 0.10 s or more: %.1f%%' % (100 * all_true / span))
    check('P3 band-measure share (pauses.py)', '%.1f%%' % (100 * band_total / span), 'info',
          True, 'counts a word\'s last consonant and its release as pause, so it reads higher than true silence')
    hv = ', '.join('%.2f s before «%s»' % (g['pause_s'], g['before']) for g in held) or 'none'
    check('P3 held beat', hv, 'one of %.1f-%.1f s per 30 s (%d here)' % (HOLD_RANGE + (allowed,)),
          len(held) <= allowed and all(HOLD_RANGE[0] - 0.05 <= g['pause_s'] <= HOLD_RANGE[1] + 0.05 for g in held),
          'none held: name one with --hold WORD=0.6' if not held else None)
    if longest:
        lv = '%.2f s true silence (%.2f s by the band) before «%s»' % (longest['true_silence_s'], longest['pause_s'],
                                                                       longest['before'])
        check('P3 longest other gap', lv, '<= %.2f s' % OTHER_MAX_S, longest['true_silence_s'] <= OTHER_MAX_S + 1e-9,
              'the band measure counts the word\'s tail too' if longest['pause_s'] > OTHER_MAX_S else None)
    return {'first_word_s': round(a, 3), 'spoken_span_s': round(span, 3), 'words': len(rows),
            'words_per_s': round(wps, 2), 'true_silence_s': round(true_total, 2),
            'true_silence_share': round(true_total / span, 3), 'all_true_silence_share': round(all_true / span, 3),
            'band_pause_s': round(band_total, 2),
            'band_pause_share': round(band_total / span, 3), 'band_ref_db': round(A['ref'], 1),
            'held_beats': held, 'gaps_over_0_25': [g for g in gaps if g['pause_s'] >= 0.25],
            'checks': checks}


def checks_text(pace):
    return ['%s %s: %s (limit %s)%s' % ('ok  ' if c['ok'] else 'MISS', c['rule'], c['value'], c['limit'],
                                        ('  - ' + c['note']) if c.get('note') else '') for c in pace['checks']]


def find_word(rows, key):
    """Index of the word a --before names, by the rules of cues.py."""
    words = [{'text': label(r), 'plain': cues.plain(label(r)), 'n': cues.norm(label(r)), 'start': float(r['start']),
              'end': float(r['end']), 'take': ''} for r in rows]
    try:
        m, i, _ = cues.find_cue(words, key)
    except cues.CueError as e:
        raise EditError(str(e).replace('Run "cues.py words"', 'Run "cues.py words --words <file>"')) from None
    if m.group('edge') or m.group('shift'):
        raise EditError('Name only the word for a pause (and #2 for the second time it is said), e.g. "بس=0.5".')
    return i


def free(path, overwrite, sources):
    p = Path(path).expanduser().resolve()
    for s in sources:
        if cues_same(p, s):
            raise EditError('Refusing to overwrite the take or its words (%s): give a new name.' % p.name)
    if p.exists() and not overwrite:
        raise EditError('%s already exists: give a new name, or add --overwrite.' % p.name)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def cues_same(a, b):
    try:
        return os.path.normcase(str(Path(a).resolve())) == os.path.normcase(str(Path(b).resolve()))
    except OSError:
        return False


def shown(p):
    """A path as the user would type it: relative to the current folder when it is inside it."""
    try:
        return Path(p).resolve().relative_to(Path.cwd().resolve()).as_posix()
    except ValueError:
        return Path(p).as_posix()


def words_base(p):
    name = p.name
    return name[:-len('.words.json')] if name.endswith('.words.json') else p.stem


def write_words(path, data, rows, note, extra):
    out = dict(data)
    out['source'] = ('%s; %s' % (data['source'], note)) if data.get('source') else note
    out.update(extra)
    out['words'] = rows
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def cmd_snap(a):
    np = need_numpy()
    data, rows, wpath = read_words(a.words)
    audio = Path(a.audio).expanduser()
    if not audio.is_file():
        raise EditError('Take not found: %s' % audio.name)
    out = free(a.out or wpath.with_name(words_base(wpath) + '.snapped.words.json'), a.overwrite, [wpath, audio])
    pcm, rate, ch = decode(audio)
    x = samples(np, pcm, ch)
    loud, hop_s, thr, finfo = loudness_info(np, x, rate, a.floor)
    new, moves = snap(np, rows, loud, hop_s)
    if a.edges == 'both':
        new, more = band_edges(np, new, bands(np, audio), loud, hop_s, rate, len(x))
        moves += more
    write_words(out, data, new, 'edges snapped to the waveform (voice_edit.py snap%s)'
                % ('' if a.edges == 'both' else ' --edges loud'),
                {'voice_edit': {'snapped_edges': len(moves), 'quiet_under_db': round(thr, 1),
                                'pause_depth_db': finfo['pause_depth_db'], 'edges': a.edges, 'words_from': wpath.name,
                                'created_utc': datetime.now(timezone.utc).isoformat()}})
    big = max((abs(m['to'] - m['from']) for m in moves), default=0.0)
    return {'mode': 'snapped', 'output': str(out), 'words': len(rows), 'edges': 2 * len(rows),
            'edges_moved': len(moves), 'starts_moved': sum(m['edge'].startswith('start') for m in moves),
            'ends_moved': sum(m['edge'].startswith('end') for m in moves), 'largest_move_s': round(big, 3),
            'quiet_under_db': finfo['quiet_under_db'], 'pause_depth_db': finfo['pause_depth_db'],
            'moved': ['%s %s %.2f→%.2f' % (m['word'], m['edge'], m['from'], m['to']) for m in moves],
            'say': 'عدد الكلمات اللي ضبطت توقيتها على الصوت: %d. الصوت نفسه ما تغيّر.' % len({m['word'] for m in moves}),
            'next': 'cues.py build --words "%s" ...' % shown(out)}


def pause_spot(np, x, rows, snapped, i, loud, hop_s, rate, depth=None):
    """Where to insert before word i: the middle of the longest quiet run between it and the word before, on the
    quietest sample there. Returns (sample index, quiet run seconds)."""
    if i == 0:
        return 0, float(snapped[0]['start'])
    n = len(loud)
    a = max(0, int(round(float(snapped[i - 1]['end']) / hop_s)))
    b = min(n, int(round(float(snapped[i]['start']) / hop_s)))
    best, k = (0, 0), a
    while k < b:
        if loud[k]:
            k += 1
            continue
        j = k
        while j < b and not loud[j]:
            j += 1
        if j - k > best[1] - best[0]:
            best = (k, j)
        k = j
    run_s = (best[1] - best[0]) * hop_s
    if run_s < MIN_PAUSE_S - 1e-9:
        raise EditError('There is no pause before «%s» (no quiet run of 60 ms between it and «%s»): silence there '
                        'would cut a word. Pick a word after a comma, a stop or «…».%s'
                        % (label(rows[i]), label(rows[i - 1]),
                           (' This take\'s pauses sit about %.0f dB under its speech; quiet was counted from %.0f dB '
                            'under.' % (depth['pause_depth_db'], depth['quiet_under_db'])) if depth else ''))
    hop = int(round(hop_s * rate))
    lo, hi = best[0] * hop, (best[1] - 1) * hop + max(2, int(round(rate * WIN_S)))
    mid = (lo + hi) // 2
    lo, hi = max(lo, mid - (hi - lo) // 4), min(len(x), mid + (hi - lo) // 4 + 1)
    level = np.abs(x[lo:hi]).sum(axis=1)
    cand = np.flatnonzero(level == level.min())
    at = lo + int(cand[np.argmin(np.abs(cand + lo - mid))])
    return at, run_s


def cmd_pause(a):
    np = need_numpy()
    data, rows, wpath = read_words(a.words)
    audio = Path(a.audio).expanduser()
    if not audio.is_file():
        raise EditError('Take not found: %s' % audio.name)
    wants = []
    for item in a.before:
        if '=' not in item:
            raise EditError('--before takes word=seconds, e.g. "بس=0.5" (got "%s").' % item)
        key, sec = item.rsplit('=', 1)
        try:
            sec = float(sec)
        except ValueError:
            raise EditError('--before "%s": the seconds after = are not a number.' % item) from None
        if not 0 < sec <= 5:
            raise EditError('--before "%s": add between 0 and 5 seconds.' % item)
        wants.append((key.strip(), sec))
    out_audio = free(a.out_audio or audio.with_name(audio.stem + ' paused.wav'), a.overwrite, [audio, wpath])
    if out_audio.suffix.lower() != '.wav':
        raise EditError('--out-audio is a .wav file.')
    out_words = free(a.out_words or out_audio.with_name(out_audio.stem + '.words.json'), a.overwrite, [audio, wpath])
    pcm, rate, ch = decode(audio)
    x = samples(np, pcm, ch)
    loud, hop_s, thr, finfo = loudness_info(np, x, rate, a.floor)
    snapped, moves = snap(np, rows, loud, hop_s)
    keep = snapped if a.snap else rows
    spots, seen = [], set()
    for key, sec in wants:
        i = find_word(rows, key)
        if i in seen:
            raise EditError('«%s» is named twice in --before: give it one time.' % key)
        seen.add(i)
        at, run_s = pause_spot(np, x, rows, snapped, i, loud, hop_s, rate, finfo)
        gap = float(snapped[i]['start']) - (float(snapped[i - 1]['end']) if i else 0.0)
        spots.append((at, int(round(sec * rate)), key, gap, run_s))
    spots.sort()
    fb = 3 * ch
    parts, last = [], 0
    for at, add, _, _, _ in spots:
        parts += [pcm[last * fb:at * fb], bytes(add * fb)]
        last = at
    parts.append(pcm[last * fb:])
    with wave.open(str(out_audio), 'wb') as f:
        f.setnchannels(ch)
        f.setsampwidth(3)
        f.setframerate(rate)
        f.writeframes(b''.join(parts))

    def moved(t):  # a time moves when its sample is at or after an insertion point: it keeps its own sound
        k = int(round(float(t) * rate))
        return round(float(t) + sum(add for at, add, _, _, _ in spots if k >= at) / float(rate), 3)
    new = []
    for r in keep:
        r = dict(r)
        r['start'], r['end'] = moved(r['start']), moved(r['end'])
        new.append(r)
    frames = len(pcm) // fb + sum(s[1] for s in spots)
    inserted = [{'before': key, 'seconds': round(add / float(rate), 4), 'at_s': round(at / float(rate), 3),
                 'pause_was_s': round(gap, 2), 'pause_now_s': round(gap + add / float(rate), 2),
                 'at_sample': at, 'samples': add}
                for at, add, key, gap, _ in spots]
    extra = {'audio_file': out_audio.name, 'audio_sha256': sha256(out_audio), 'duration_s': round(frames / float(rate), 3),
             'voice_edit': {'from_audio': audio.name, 'from_audio_sha256': sha256(audio), 'words_from': wpath.name,
                            'snapped_edges': len(moves) if a.snap else 0, 'inserted': inserted,
                            'created_utc': datetime.now(timezone.utc).isoformat()}}
    note = 'pauses lengthened with inserted silence, speech untouched (voice_edit.py pause%s)' % (' --snap' if a.snap else '')
    write_words(out_words, data, new, note, extra)
    return {'mode': 'pauses lengthened', 'audio': str(out_audio), 'words': str(out_words),
            'sample_rate': rate, 'channels': ch, 'inserted': inserted,
            'duration_s': [round(len(pcm) // fb / float(rate), 3), round(frames / float(rate), 3)],
            'edges_snapped': len(moves) if a.snap else 0,
            'say': 'عدد الوقفات اللي طوّلتها: %d. انضاف سكوت داخل الوقفة بس، والكلام نفسه ما تغيّر ولا تسرّع.' % len(spots),
            'next': 'cues.py build --words "%s" ...; and in plan/sound.json "voice": {"file": "%s"}'
                    % (shown(out_words), shown(out_audio))}


# ---------------------------------------------------------------- tighten
def plan_cuts(np, x, snapped, marks, A, ok, ref, a, targets, holds, keeps, rate):
    """Every gap's measure, target and the one cut (or held-beat insert) it gets. Returns (gaps, cuts, inserts)."""
    def t2s(t):
        return int(round(t * rate))
    bquiet = A['band'] < ref - BAND_UNDER_DB
    xf, bh = t2s(XF_S), rate * BHOP_S
    gaps, cuts, inserts = [], [], []
    for i in range(1, len(snapped)):
        ps, e0 = float(snapped[i - 1]['start']), float(snapped[i - 1]['end'])
        s1, ne = float(snapped[i]['start']), float(snapped[i]['end'])
        kind, turn, end = marks[i - 1]
        best = joint_run(A, bquiet, ps, e0, s1, ne)
        L = 0.0 if best is None else (best[1] - best[0]) * BHOP_S
        T = targets[i]
        floor_true = keeps.get(i, TURN_FLOOR_S if turn else END_FLOOR_S if end else 0.0)
        row = {'before': label(snapped[i]), 'i': i, 'mark': kind or '', 'turn': bool(turn), 'pause_s': round(L, 2),
               'target_s': T, 'removed_s': 0.0}
        if floor_true:
            row['keep_true_s'] = floor_true
        if i in holds:
            row['held'] = True
        if best is not None:
            g0, g1 = int(round(best[0] * bh)), int(round((best[1] + 1) * bh))
            # and never inside a word as snapped: 20 ms clear of the word before's end and the next word's start
            g0, g1 = max(g0, t2s(e0 + MARGIN_S)), min(g1, t2s(s1 - MARGIN_S))
            zr = [(g0 + u, g0 + v) for u, v in runs_of(np, ok[g0:g1])] if g1 > g0 else []
            room = max([(v - u) - 2 * xf for u, v in zr] or [0])
            row['silence_cuttable_s'] = round(max(0, room) / float(rate), 3)
            row['floor_s'] = round(L - max(0, room) / float(rate), 2)
            want = L - T
            if i in holds and want < -0.01 and zr:   # the held beat: lengthened with the gap's own true silence
                z0, z1 = max(zr, key=lambda r: r[1] - r[0])
                n_add = t2s(-want)
                src = x[z0 + xf:z1 - xf]
                if len(src) > 4 * xf:
                    reps = int(np.ceil((n_add + 2 * xf) / float(len(src)))) + 1
                    seg = np.concatenate([src] * reps)[:n_add + 2 * xf]
                    p_ins = (z0 + z1) // 2
                    inserts.append((p_ins, n_add, seg))
                    row['added_s'] = round(n_add / float(rate), 3)
                    row['insert_take_s'] = round(p_ins / float(rate), 3)
            if want > 0.004 and zr:
                z0, z1 = max(zr, key=lambda r: r[1] - r[0])
                rem = min(t2s(want), max(0, (z1 - z0) - 2 * xf))
                if floor_true:   # the true silence left = the run's rest + both margins + the fade
                    left_ok = t2s(max(0.0, floor_true - 2 * MARGIN_S - 2 * XF_S))
                    rem = min(rem, max(0, (z1 - z0) - 2 * xf - left_ok))
                if rem >= t2s(0.004):
                    c0 = (z0 + z1) // 2 - rem // 2
                    cuts.append((c0, c0 + rem))
                    row['removed_s'] = round(rem / float(rate), 3)
                    row['cut_take_s'] = [round(c0 / float(rate), 3), round((c0 + rem) / float(rate), 3)]
                else:
                    rem = 0
                if rem < t2s(want) - t2s(0.01):
                    row['short_by_s'] = round((t2s(want) - rem) / float(rate), 3)
        gaps.append(row)
    return gaps, cuts, inserts


def cmd_tighten(a):
    np = need_numpy()
    data, rows, wpath = read_words(a.words)
    audio = Path(a.audio).expanduser()
    if not audio.is_file():
        raise EditError('Take not found: %s' % audio.name)
    if len(rows) < 2:
        raise EditError('One word has no pauses to tighten.')
    out_audio = free(a.out_audio or audio.with_name(audio.stem + ' tight.wav'), a.overwrite, [audio, wpath])
    if out_audio.suffix.lower() != '.wav':
        raise EditError('--out-audio is a .wav file.')
    out_words = free(a.out_words or out_audio.with_name(out_audio.stem + '.words.json'), a.overwrite, [audio, wpath])
    report_p = free(a.report or out_audio.with_name(out_audio.stem + '.tighten.json'), a.overwrite, [audio, wpath])
    for v, what in ((a.default, '--default'), (a.ellipsis, '--ellipsis'), (a.stop, '--stop'), (a.comma, '--comma')):
        if v is not None and not 0.05 <= v <= 1.5:
            raise EditError('%s is the pause kept, in seconds (0.05-1.5).' % what)
    pcm, rate, ch = decode(audio)
    xi = samples(np, pcm, ch)
    x = xi.astype(np.float64) / 8388608.0
    N = len(x)

    def t2s(t):
        return int(round(t * rate))
    loud, hop_s, thr, finfo = loudness_info(np, xi, rate, a.floor)
    snapped, moves = snap(np, rows, loud, hop_s)
    A = bands(np, audio)
    if a.edges == 'both':
        snapped, more = band_edges(np, snapped, A, loud, hop_s, rate, N)
        moves += more
    text, script_src = find_script(a, audio, data)
    marks, marks_note = word_marks(snapped, text)
    holds = named_seconds(snapped, a.hold, '--hold', 0.3, 1.5)
    before = named_seconds(snapped, a.before, '--before', 0.05, 1.5)
    keeps = named_seconds(snapped, a.keep, '--keep', 0.0, 1.0)
    span_est = 0.8 * (float(snapped[-1]['end']) - float(snapped[0]['start']))
    allowed = max(1, int(math.ceil(span_est / 30.0 - 1e-9)))
    ell = [i for i in range(1, len(snapped)) if marks[i - 1][0] == 'ellipsis']
    stop_t = a.stop if a.stop is not None else TARGET_S['stop']
    if a.ellipsis is not None:
        ell_t, ell_note = a.ellipsis, '«…» %.2f s (--ellipsis)' % a.ellipsis
    elif holds:
        ell_t, ell_note = stop_t, '«…» as a stop (%.2f s): the held beat is the one named with --hold' % stop_t
    elif 0 < len(ell) <= allowed:
        ell_t, ell_note = TARGET_S['ellipsis'], '«…» %.2f s: the held beat (%d in the script)' % (TARGET_S['ellipsis'],
                                                                                                len(ell))
    else:
        ell_t, ell_note = stop_t, ('«…» as a stop (%.2f s): %d in the script, more than one held beat per 30 s; name the '
                                   'one held beat with --hold WORD=0.6' % (stop_t, len(ell))) if ell else None
    by_kind = {'ellipsis': ell_t, 'stop': stop_t, 'comma': a.comma if a.comma is not None else TARGET_S['comma'],
               None: a.default if a.default is not None else DEFAULT_S}
    if not text and not any(k for k, _, _ in marks):
        by_kind[None] = a.default if a.default is not None else 0.20
    targets = {i: holds.get(i, before.get(i, by_kind[marks[i - 1][0]])) for i in range(1, len(snapped))}
    lo_s, hi_s = float(snapped[0]['start']), float(snapped[-1]['end'])
    ok, deep = true_silence(np, A, N, rate, lo_s, hi_s)
    ref0 = A['ref']
    if a.ref_db is not None:
        ref = a.ref_db
        gaps, cuts, inserts = plan_cuts(np, x, snapped, marks, A, ok, ref, a, targets, holds, keeps, rate)
    else:   # cutting silence raises the band's median, and the final is measured against that: plan twice
        gaps, cuts, inserts = plan_cuts(np, x, snapped, marks, A, ok, ref0, a, targets, holds, keeps, rate)
        centres = (np.arange(A['n']) * BHOP_S + BHOP_S) * rate
        kept = np.ones(A['n'], bool)
        for c0, c1 in cuts:
            kept &= ~((centres >= c0) & (centres < c1))
        ref = ref_of(np, A['band'][kept]) if kept.sum() > 10 else ref0
        gaps, cuts, inserts = plan_cuts(np, x, snapped, marks, A, ok, ref, a, targets, holds, keeps, rate)
    # the head (P1): true silence before the first word cut to --lead; the tail only with --tail
    head = 0
    if a.lead is not None and a.lead >= 0:
        nd = np.flatnonzero(~deep[:max(1, int(lo_s / BHOP_S) + 1)])
        first_sound = min(lo_s, (nd[0] * BHOP_S) if len(nd) else lo_s)
        head = max(0, t2s(first_sound - a.lead))
        if head < t2s(0.02):
            head = 0
    tail = N
    if a.tail is not None:
        k0 = min(A['n'], int(hi_s / BHOP_S))
        nd = np.flatnonzero(~deep[k0:])              # the last sound after the last word (its decay, a breath)
        tail_end = max(hi_s, (k0 + int(nd[-1]) + 2) * BHOP_S) if len(nd) else hi_s
        tail = min(N, t2s(tail_end + a.tail))
        if tail > N - t2s(0.02):
            tail = N
    specs = gain_specs(snapped, a.gain)
    x, gains = apply_gains(np, x, snapped, specs, rate)
    # splice: one equal-power crossfade of 2*XF across each cut (both sides are silence)
    h = t2s(XF_S)
    cuts = [(c0, c1) for c0, c1 in cuts if c0 - h >= head and c1 + h <= tail]
    inserts = [(p_, n_, s_) for p_, n_, s_ in inserts if p_ - h >= head and p_ + h <= tail]
    th = np.linspace(0, np.pi / 2, 2 * h)
    fo, fi = np.cos(th)[:, None], np.sin(th)[:, None]
    parts, pos = [], head
    events = [('cut', c0, c1, None) for c0, c1 in cuts] + [('ins', p_, p_, (n_, s_)) for p_, n_, s_ in inserts]
    for kind, c0, c1, extra in sorted(events, key=lambda e: e[1]):
        if kind == 'cut':
            parts.append(x[pos:c0 - h])
            parts.append(x[c0 - h:c0 + h] * fo + x[c1 - h:c1 + h] * fi)
            pos = c1 + h
        else:
            n_, s_ = extra
            parts.append(x[pos:c0 - h])
            parts.append(x[c0 - h:c0 + h] * fo + s_[:2 * h] * fi)
            parts.append(s_[2 * h:n_])
            parts.append(s_[n_:n_ + 2 * h] * fo + x[c0 - h:c0 + h] * fi)
            pos = c0 + h
    parts.append(x[pos:tail])
    y = np.concatenate(parts)
    fade = min(len(y), t2s(0.005))
    if head and fade:
        y[:fade] *= np.linspace(0.0, 1.0, fade)[:, None]
    if tail < N and fade:
        y[-fade:] *= np.linspace(1.0, 0.0, fade)[:, None]

    def newt(t):
        s = t2s(t)
        gone = min(s, head)
        gone += sum((c1 - c0) for c0, c1 in cuts if c1 <= s)
        for c0, c1 in cuts:
            if c0 < s < c1:      # an edge that sat in silence moves to the splice
                gone += s - c0
        gone -= sum(n_ for p_, n_, s_ in inserts if p_ <= s)
        return round(max(0.0, (s - gone) / float(rate)), 3)
    out_rows = []
    for w in snapped:
        r = dict(w)
        r['start'], r['end'] = newt(float(w['start'])), newt(float(w['end']))
        out_rows.append(r)
    report_cuts = []
    mono = x.mean(axis=1)
    for c0, c1 in sorted(cuts):
        t0, t1 = c0 / float(rate), c1 / float(rate)
        inside = [label(w) for w in snapped if float(w['start']) < t1 and float(w['end']) > t0]
        dist = min(min(abs(t0 - float(w['end'])), abs(t1 - float(w['start'])), abs(t0 - float(w['start'])),
                       abs(t1 - float(w['end']))) for w in snapped)
        seg = mono[c0:c1]
        report_cuts.append({'take_s': [round(t0, 3), round(t1, 3)], 'len_s': round(t1 - t0, 3),
                            'inside_aligned_word': inside, 'nearest_edge_s': round(dist, 3),
                            'peak_dbfs_removed': round(20 * np.log10(np.abs(seg).max() + 1e-12), 1)})
    write_wav(np, out_audio, y, rate, ch)
    removed = (N - len(y)) / float(rate)
    extra = {'audio_file': out_audio.name, 'audio_sha256': sha256(out_audio), 'duration_s': round(len(y) / float(rate), 3),
             'voice_edit': {'job': 'tighten', 'from_audio': audio.name, 'from_audio_sha256': sha256(audio),
                            'words_from': wpath.name, 'cuts': len(cuts), 'removed_s': round(removed, 3),
                            'head_cut_s': round(head / float(rate), 3), 'report': report_p.name,
                            'created_utc': datetime.now(timezone.utc).isoformat()}}
    write_words(out_words, data, out_rows, 'edges snapped, silence cut, speech untouched (voice_edit.py tighten)', extra)
    pace = pace_numbers(np, out_audio, out_rows)
    peak = float(np.abs(y).max()) if len(y) else 0.0
    rep = {'take': audio.name, 'rate': rate, 'channels': ch, 'take_s': round(N / float(rate), 3),
           'out_s': round(len(y) / float(rate), 3), 'removed_s': round(removed, 3), 'cuts': len(cuts),
           'head_cut_s': round(head / float(rate), 3), 'tail_cut_s': round((N - tail) / float(rate), 3),
           'peak_dbfs': round(20 * np.log10(peak + 1e-12), 2), 'band_ref_db_take': round(ref0, 1),
           'band_ref_db_measured_against': round(ref, 1), 'true_silence_under_db': A['deep_under_db'],
           'pause_floor_vs_ref_db': {'band': A['pause_floor_db'][0], 'full': A['pause_floor_db'][1]},
           'quiet_floor': finfo, 'min_silent_s': MIN_SILENT_S, 'margin_s': MARGIN_S, 'crossfade_s': 2 * XF_S,
           'script': script_src or 'none', 'marks': marks_note, 'ellipsis': ell_note,
           'targets_s': {'ellipsis': ell_t, 'stop': by_kind['stop'], 'comma': by_kind['comma'], 'none': by_kind[None]},
           'floors_true_s': {'sentence_end': END_FLOOR_S, 'turn': TURN_FLOOR_S},
           'snapped_edges': ['%s %s %.2f->%.2f' % (m['word'], m['edge'], m['from'], m['to']) for m in moves],
           'inserted': [{'take_s': round(p_ / float(rate), 3), 'added_s': round(n_ / float(rate), 3)}
                        for p_, n_, s_ in inserts],
           'gain': gains, 'gaps': gaps, 'cuts_vs_words': report_cuts, 'pace_after': pace,
           'rule': 'only true silence: the 250-3800 Hz band and the full band both %.0f dB or more under the voice\'s '
                   'median, in silent runs of 0.12 s or more, 20 ms or more from where the silence ends; one 10 ms '
                   'equal-power crossfade per cut; no stretch, no pitch change' % A['deep_under_db']}
    report_p.write_text(json.dumps(rep, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    short = [g for g in gaps if g.get('short_by_s')]
    words_in_cuts = sorted({w for c in report_cuts for w in c['inside_aligned_word']})
    result = {'mode': 'silence cut (tighten)', 'audio': str(out_audio), 'words': str(out_words), 'report': str(report_p),
              'take_s': rep['take_s'], 'out_s': rep['out_s'], 'removed_s': rep['removed_s'], 'cuts': len(cuts),
              'head_cut_s': rep['head_cut_s'],
              'loudest_removed_dbfs': max((c['peak_dbfs_removed'] for c in report_cuts), default=None),
              'script': script_src or 'none', 'marks': marks_note,
              'pace': checks_text(pace)}
    if ell_note:
        result['ellipsis'] = ell_note
    if inserts:
        result['held_beat_lengthened'] = rep['inserted']
    if gains:
        result['gain'] = gains
    if short:
        result['kept_longer'] = ('%d pause(s) stay over their target: what is left there is the word\'s own tail or '
                                 'too little true silence to cut (see "short_by_s" in the report).' % len(short))
    if words_in_cuts:
        result['check'] = ('Cuts sit inside the aligned span of %s: the alignment ran into silence there; the cut '
                           'removed only true silence (loudest %.1f dBFS). Listen to those words.'
                           % ('، '.join('«%s»' % w for w in words_in_cuts), max(c['peak_dbfs_removed'] for c in report_cuts)))
    result['say'] = ('قصّيت السكوت بس (%d قصّة، %.1f ث)، والكلام نفسه ما انقص ولا تسرّع. السرعة الحين %.2f كلمة بالثانية.'
                     % (len(cuts), removed, pace['words_per_s']))
    result['next'] = ('listen to the whole file; then cues.py build (or beats) --words "%s", and in plan/sound.json '
                      '"voice": {"file": "%s"}; check a quoted text with check_quote.py on this file'
                      % (shown(out_words), shown(out_audio)))
    return result


# ---------------------------------------------------------------- levels
def phrase_groups(rows, marks, split):
    """[(first, last)] word index spans: sentences (a stop, «…» at a line end, a turn) or, with split=phrase, also
    commas and every «…»."""
    out, s = [], 0
    for i in range(len(rows)):
        kind, turn, stop = marks[i]
        end = turn or stop or i == len(rows) - 1
        if split == 'phrase':
            end = end or kind in ('comma', 'ellipsis')
        if end:
            out.append((s, i))
            s = i + 1
    return out


def phrase_levels(np, path, rows, groups):
    """Each span's level: RMS of 400 ms blocks (200 ms apart) of a 100 Hz high-passed, 2 kHz-lifted mono copy, the
    loudest 70%% averaged (as sample 03's phrase_levels.py); and its difference from the median span."""
    ff, _ = ffmpeg_tools()
    sr = 48000
    r = subprocess.run([ff, '-v', 'error', '-nostdin', '-threads', '1', '-i', str(path), '-map', '0:a:0', '-ac', '1',
                        '-ar', str(sr), '-af', 'highpass=f=100,treble=g=4:f=2000', '-f', 'f32le', '-'],
                       capture_output=True)
    if r.returncode or not r.stdout:
        raise EditError('FFmpeg could not read %s.' % Path(path).name)
    x = np.frombuffer(r.stdout[:len(r.stdout) // 4 * 4], dtype=np.float32)
    blk = int(0.4 * sr)
    out = []
    for i0, i1 in groups:
        a, b = float(rows[i0]['start']), float(rows[i1]['end'])
        seg = x[int(a * sr):max(int(a * sr) + 1, int(b * sr))]
        if len(seg) <= blk:
            lv = [20 * np.log10(np.sqrt(np.mean(seg.astype(np.float64) ** 2)) + 1e-9)]
        else:
            lv = [20 * np.log10(np.sqrt(np.mean(seg[k:k + blk].astype(np.float64) ** 2)) + 1e-9)
                  for k in range(0, len(seg) - blk + 1, blk // 2)]
        lv = sorted(lv)[int(len(lv) * 0.3):] or lv
        out.append({'from_s': round(a, 2), 'to_s': round(b, 2), 'first': i0, 'last': i1,
                    'text': ' '.join(label(r) for r in rows[i0:i1 + 1]), 'level_db': float(np.mean(lv))})
    med = float(np.median([o['level_db'] for o in out]))
    for o in out:
        o['vs_median_db'] = round(o['level_db'] - med, 1)
        o['level_db'] = round(o['level_db'], 1)
    return out, round(med, 1)


def gain_name(rows, i, side):
    """A word name for --gain that cues.find_cue resolves to index i (adds #n when the word is said earlier)."""
    n = cues.norm(label(rows[i]))
    k = sum(1 for r in rows[:i + 1] if cues.norm(label(r)) == n)
    return cues.plain(label(rows[i])) + ('#%d' % k if k > 1 else '')


def cmd_levels(a):
    np = need_numpy()
    data, rows, wpath = read_words(a.words)
    audio = Path(a.audio).expanduser()
    if not audio.is_file():
        raise EditError('Take not found: %s' % audio.name)
    text, script_src = find_script(a, audio, data)
    marks, marks_note = word_marks(rows, text)
    # measure on the words as they sound: an aligned span that swallowed a pause would read as a quiet phrase
    pcm, rate, ch = decode(audio)
    xs = samples(np, pcm, ch)
    loud, hop_s, thr, finfo = loudness_info(np, xs, rate, a.floor)
    A = bands(np, audio)
    mrows, _ = snap(np, rows, loud, hop_s)
    mrows, _ = band_edges(np, mrows, A, loud, hop_s, rate, len(xs))
    src = audio
    gains = []
    if a.gain:
        if not a.out_audio:
            raise EditError('--gain writes a copy: give --out-audio (a new .wav).')
        out_audio = free(a.out_audio, a.overwrite, [audio, wpath])
        if out_audio.suffix.lower() != '.wav':
            raise EditError('--out-audio is a .wav file.')
        out_words = free(a.out_words or out_audio.with_name(out_audio.stem + '.words.json'), a.overwrite,
                         [audio, wpath])
        x = xs.astype(np.float64) / 8388608.0
        y, gains = apply_gains(np, x, mrows, gain_specs(mrows, a.gain), rate)
        write_wav(np, out_audio, y, rate, ch)
        write_words(out_words, data, rows, 'phrase gains (voice_edit.py levels --gain), times unchanged',
                    {'audio_file': out_audio.name, 'audio_sha256': sha256(out_audio),
                     'voice_edit': {'job': 'levels --gain', 'from_audio': audio.name, 'gain': gains,
                                    'created_utc': datetime.now(timezone.utc).isoformat()}})
        src = out_audio
        A = bands(np, src)
    groups = phrase_groups(mrows, marks, a.split)
    lv, med = phrase_levels(np, src, mrows, groups)
    quiet = [o for o in lv if o['vs_median_db'] < -PHRASE_UNDER_DB]
    loud_ = [o for o in lv if o['vs_median_db'] > PHRASE_UNDER_DB]
    fix, far = [], []
    for o in quiet + loud_:      # to within 2 dB of the median, at most 6 dB at a time; the ear decides
        db = -o['vs_median_db'] - (2.0 if o['vs_median_db'] < 0 else -2.0)
        db = max(-6.0, min(6.0, round(db * 2) / 2.0))
        if abs(o['vs_median_db']) > 8:
            far.append(o['text'])
        fix.append('%s..%s=%s' % (gain_name(rows, o['first'], 0), gain_name(rows, o['last'], 1), format(db, 'g')))
    pace = pace_numbers(np, src, mrows, A)
    result = {'mode': 'levels and pace', 'audio': str(src), 'split': a.split, 'script': script_src or 'none',
              'marks': marks_note, 'median_db': med,
              'phrases': ['%6.2f-%6.2f  %+5.1f dB  %s%s' % (o['from_s'], o['to_s'], o['vs_median_db'], o['text'],
                                                           '  <-- quiet' if o in quiet else '  <-- loud' if o in loud_
                                                           else '') for o in lv],
              'rule': 'no phrase more than %.0f dB under the take\'s median (the owner\'s ear, 11-10)' % PHRASE_UNDER_DB,
              'pace': checks_text(pace)}
    if gains:
        result['gain_applied'] = gains
        result['written'] = [str(src), str(out_words)]
    if far:
        result['listen'] = ('More than 8 dB off the median: %s. A whisper, a swallowed word or a timing that ran into '
                            'silence: listen before any gain; a word too quiet to hear means a new whole take.'
                            % '، '.join('«%s»' % t for t in far))
    if fix:
        result['fix'] = ('voice_edit.py tighten ... --gain %s (or levels --gain ... --out-audio <new.wav> on a take '
                         'that is already tight)' % ' '.join('"%s"' % f for f in fix))
        result['say'] = 'فيه %d جملة صوتها أوطى أو أعلى من الباقي بأكثر من 3 ديسيبل: أرفعها أو أخفضها بين الوقفات.' % len(fix)
    else:
        result['say'] = 'مستوى الجمل متقارب: ما فيه جملة أوطى من الباقي بأكثر من 3 ديسيبل.'
    if a.report:
        rp = free(a.report, a.overwrite, [audio, wpath])
        rp.write_text(json.dumps({'levels': lv, 'median_db': med, 'pace': pace, 'gain': gains}, ensure_ascii=False,
                                 indent=1) + '\n', encoding='utf-8')
        result['report'] = str(rp)
    return result


def floor_arg(v):
    if v == 'take':
        return v
    try:
        f = float(v)
    except ValueError:
        raise argparse.ArgumentTypeError('"take" or a number of dB') from None
    return f


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)

    def floor_opt(sp):
        sp.add_argument('--floor', type=floor_arg, default='take',
                        help='quiet = this many dB under the loud level, or "take" (default): 38, or 3 dB less than the '
                             'take\'s pauses are deep when they are shallower')
    sn = sub.add_parser('snap', help='word edges next to silence onto the waveform -> a new .words.json')
    sn.add_argument('--audio', required=True, help='the take (mp3, wav, ...)')
    sn.add_argument('--words', required=True, help="the take's .words.json")
    sn.add_argument('--out', help='default: <words>.snapped.words.json beside it')
    sn.add_argument('--edges', choices=('both', 'loud'), default='both',
                    help='both (default): also pull edges in over stretches quiet in the band and the full band; '
                         'loud: only the loudness rule of 1.6')
    floor_opt(sn)
    sn.add_argument('--overwrite', action='store_true', help='replace an output file that already exists')
    pa = sub.add_parser('pause', help='longer pauses before named words -> a new WAV + .words.json')
    pa.add_argument('--audio', required=True, help='the take (mp3, wav, ...)')
    pa.add_argument('--words', required=True, help="the take's .words.json")
    pa.add_argument('--before', action='extend', nargs='+', required=True, metavar='WORD=SECONDS',
                    help='silence to add in the pause before that word, e.g. "بس=0.5" "وإنت#2=0.4"')
    pa.add_argument('--snap', action='store_true', help='also snap the word edges (as the snap job)')
    pa.add_argument('--out-audio', help='a .wav (default: "<take> paused.wav" beside the take)')
    pa.add_argument('--out-words', help='default: <out-audio stem>.words.json')
    floor_opt(pa)
    pa.add_argument('--overwrite', action='store_true', help='replace output files that already exist')
    ti = sub.add_parser('tighten', help='shorter pauses: only true silence cut, never a stretch -> a new WAV, '
                                        '.words.json and report')
    ti.add_argument('--audio', required=True, help='the take as generated or recorded (mp3, wav, ...)')
    ti.add_argument('--words', required=True, help="the take's .words.json")
    ti.add_argument('--script', help='the script read (UTF-8); default: the take\'s .json sidecar, else the words\' '
                                     'own punctuation')
    ti.add_argument('--hold', action='extend', nargs='+', metavar='WORD=SECONDS',
                    help='the one held beat (0.5-0.8 s per 30 s), e.g. "خلّها=0.66": the pause before that word; '
                         'lengthened with the gap\'s own silence if it is shorter')
    ti.add_argument('--before', action='extend', nargs='+', metavar='WORD=SECONDS',
                    help='another target for the pause before that word')
    ti.add_argument('--keep', action='extend', nargs='+', metavar='WORD=SECONDS',
                    help='keep at least this much true silence before that word (default 0.15 s at a sentence end, '
                         '0.25 s at a paragraph turn)')
    ti.add_argument('--gain', action='extend', nargs='+', metavar='FIRST..LAST=DB',
                    help='a phrase louder or softer, ramped inside the pauses, e.g. "وش..عندك=2"')
    ti.add_argument('--default', type=float, help='pause kept between words with no mark (0.12; 0.20 when the take '
                                                  'has no punctuation to read)')
    ti.add_argument('--stop', type=float, help='pause kept after «.» «؟» «!» (0.24)')
    ti.add_argument('--comma', type=float, help='pause kept after «،» «:» or a line end (0.16)')
    ti.add_argument('--ellipsis', type=float, help='pause kept after every «…» (default: 0.55 when it is the one held '
                                                   'beat, else as a stop)')
    ti.add_argument('--lead', type=float, default=0.05, help='true silence kept before the first word (0.05 s; -1 '
                                                             'keeps the head as it is)')
    ti.add_argument('--tail', type=float, help='true silence kept after the last word (default: the tail as it is)')
    ti.add_argument('--edges', choices=('both', 'loud'), default='both', help='as in snap')
    ti.add_argument('--ref-db', type=float, help='the band median the pauses are measured against (default: the cut '
                                                  'file\'s, estimated)')
    floor_opt(ti)
    ti.add_argument('--out-audio', help='a .wav (default: "<take> tight.wav" beside the take)')
    ti.add_argument('--out-words', help='default: <out-audio stem>.words.json')
    ti.add_argument('--report', help='default: <out-audio stem>.tighten.json')
    ti.add_argument('--overwrite', action='store_true', help='replace output files that already exist')
    le = sub.add_parser('levels', help='each sentence against the median, and the pace numbers')
    le.add_argument('--audio', required=True, help='the take (as generated, or after tighten)')
    le.add_argument('--words', required=True, help="its .words.json")
    le.add_argument('--script', help='the script read (default: the take\'s .json sidecar, else the words\' own '
                                     'punctuation)')
    le.add_argument('--split', choices=('sentence', 'phrase'), default='sentence',
                    help='sentence (default) or phrase (also at «،» and «…»)')
    le.add_argument('--gain', action='extend', nargs='+', metavar='FIRST..LAST=DB',
                    help='write a copy with these gains (needs --out-audio)')
    le.add_argument('--out-audio', help='the copy with --gain (.wav)')
    le.add_argument('--out-words', help='default: <out-audio stem>.words.json (the same times)')
    le.add_argument('--report', help='also write the numbers as JSON')
    floor_opt(le)
    le.add_argument('--overwrite', action='store_true', help='replace output files that already exist')
    a = p.parse_args(argv)
    if a.cmd == 'tighten' and a.lead is not None and a.lead < 0:
        a.lead = None
    del NOT_WORDS[:]
    result = {'snap': cmd_snap, 'pause': cmd_pause, 'tighten': cmd_tighten, 'levels': cmd_levels}[a.cmd](a)
    if NOT_WORDS:
        result['not_words'] = ('%d token(s) in the timings are only invisible characters (direction marks from a '
                               'pasted text) and punctuation: %s. They are not words, so no pause is named or held '
                               'before them; the narration and its text are unchanged.'
                               % (len(NOT_WORDS), ' '.join('«%s»' % cues.visible(t) for t in NOT_WORDS)))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except EditError as e:
        print('ERROR: ' + str(e), file=sys.stderr)
        sys.exit(1)
