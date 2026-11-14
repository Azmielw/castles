#!/usr/bin/env python3
"""Cues from words - Khaam Motion.

Places scene events by naming the spoken word instead of typing seconds. Reads one or more .words.json
files (from gen_tts_elevenlabs.py or align_voice.py), puts them on the video's timeline (--offset), and
either checks cue names or writes timing.js for a HyperFrames project. A video with no voice names its
moments in plan/beats.json instead (build --beats), and "read" gives a script word timings at a reading pace.

A cue name is a word or a few words as written in the script, plus optional parts:
  يسقي            the first time «يسقي» is said (start of the word)
  يسقي#2          the second time
  يسقي:end        where the word ends
  ليلة مطر        two words said one after the other (start of the first; :end = end of the last)
  يسقي+0.2        0.2 s after it (also -0.1)
Harakat, tatweel, punctuation, hamza forms (أ إ آ → ا), ى/ي and ة/ه are ignored when matching.
A name from plan/cues.json or plan/beats.json takes the same endings: dawn:end, dawn+0.2, dawn:end-0.1.
A name's end is where its words end (cues.json) or the "end" given in beats.json.

Commands:
  check  --words <file> [--offset s] ... "<cue>" ...       prints each cue's time; exit 1 if one is missing
         [--cues plan/cues.json] [--beats plan/beats.json]  names too; with names and no cue, lists every name
  build  --words <file> [--offset s] ... [--cues plan/cues.json] --out timing.js
         plan/cues.json maps names to cue words, e.g. {"lightning": "تخافه", "dawn": "يسقي+0.1"}.
         timing.js defines window.KHAAM_WORDS, window.KHAAM_CUES and window.cue("<cue or name>"), which throws a
         clear error in the render when a word is not in the timings; window.KHAAM_CUE_ENDS holds each name's end.
  build  --beats plan/beats.json --out timing.js           a video with no voice: named seconds (below);
         --words and --beats together also work.            [--duration s] sets window.KHAAM_DURATION
  words  --words <file> [--offset s]                         lists every word with its time (to pick cues)
  read   --script <text file> --out assets/vo/<name>.words.json [--start s] [--pace 2.4] [--by letters|even]
         word timings with no voice, at the Gulf reading pace of voiceover.md §10.5: 2.4 words a second, plus
         0.2 s at «،» , ; : —, 0.35 s at . ؟ ? !, 0.5 s at «…». Each word's share is set by its letters
         (--by even: all equal). A line that starts with @<seconds> starts there (a hold before it), e.g.
         "@6.75 النور." A line with no mark at its end gets the comma pause. Same shape as align_voice.py
         writes, so build --words, captions and word-lit.html work unchanged.
  beats  --words <file> [--offset s] --rules plan/beats.txt --out timing.js | plan/beats.json
         the picture timed from the take's words in one command (a narrated video): every beat is a rule over the
         spoken words, so the scenes follow the take when it changes. timing.js as build writes it; a .json --out
         writes plan/beats.json for a canvas project (or for build --beats). Rule file (UTF-8, one per line):
           # the card shows 0.3 s before the quote's first word, and goes 0.7 s after its last
           card      = start(الحمد) - 0.3 .. end(النشور) + 0.7
           close     = start(احفظها)
           door      = max(close - 0.05, end(card) + 0.55)
           rise      = door + 0.6 .. door + 2.6
           duration  = voice_end + 2.2
         name = expr, or name = expr .. expr (a span: the name gets an end, cue("card:end")). An expr is seconds,
         + - * / ( ), max(a, b, ...), min(...), another name, start(X) or end(X) where X is a spoken cue as above
         (يسقي, يسقي#2, ليلة مطر, يسقي+0.2) or a name; voice_start and voice_end are the first word's start and
         the last word's end. "duration" sets window.KHAAM_DURATION. A line starting with # is a note.

plan/beats.json (a video with no voice):
  {"duration": 16.8,
   "cues": {"box": 0.9, "lid": "box+0.2", "bow": {"at": "lid:end+0.1", "end": 9.4}, "tag": {"at": 10.2, "dur": 0.4}},
   "beats": [{"id": "items", "start": 0.9, "end": 6.85}]}
  A time is seconds of the whole video, or another name with :end and +/- seconds ("box+0.2" also takes box's end,
  moved the same), or with --words a spoken cue. {"at": .., "end": ..} or "dur" gives a name its end; each beat with
  an "id" is a name with its end (a beat and a cue may share a name when their start is the same). "duration"
  becomes window.KHAAM_DURATION.
"""
import argparse
import difflib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HARAKAT_RE = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]')
AR_MAP = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي', 'ء': '',
                        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8',
                        '٩': '9', 'ک': 'ك', 'ی': 'ي'})
CUE_RE = re.compile(r'^(?P<words>.+?)(?:#(?P<n>\d+))?(?::(?P<edge>start|end))?(?P<shift>[+-]\d+(?:\.\d+)?)?$')
# Invisible characters a text copied from a web page carries: direction marks (U+200E/200F, the Arabic letter mark
# U+061C), embeddings and isolates (U+202A-202E, U+2066-2069), zero-width space, non-joiner and joiner (U+200B-200D),
# the word joiner and invisible operators (U+2060-2064), the BOM (U+FEFF), the soft hyphen (U+00AD) and U+180E. They
# are not text: the narration tools compare and align words as if they were not there, and a token made only of them
# and punctuation is not a word (the wisdom rerun, 2026-11-12: the quote marks between U+200F marks around a pasted
# hadith came back from ElevenLabs as two "words", and tighten held a beat before one of them). The text itself (the
# card, the paste, what is sent) is never changed; a text without them gives exactly what it gave before.
INVISIBLE_RE = re.compile('[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]')


class CueError(Exception):
    pass


def visible(text):
    """The text with the invisible characters taken out; every visible letter and mark stays as it is."""
    return INVISIBLE_RE.sub('', text)


def ghost(text):
    """A token that held invisible characters and has no letter or digit (a direction mark, a quote mark between
    direction marks): not a word."""
    return bool(INVISIBLE_RE.search(text)) and not any(c.isalnum() for c in text)


def clean_rows(rows):
    """Word rows as if the invisible characters were not there: taken out of "word", "text" and "raw", and a ghost
    row dropped. A row without them stays exactly as it was. Returns (rows, the dropped rows' texts)."""
    out, dropped = [], []
    for r in rows:
        keys = [k for k in ('word', 'text', 'raw') if isinstance(r.get(k), str) and INVISIBLE_RE.search(r[k])]
        if not keys:
            out.append(r)
            continue
        if ghost(str(r.get('word') or r.get('text') or '')):
            dropped.append(str(r.get('raw') or r.get('word') or r.get('text')))
            continue
        r = dict(r)
        for k in keys:
            r[k] = visible(r[k])
        out.append(r)
    return out, dropped


def norm(word):
    w = HARAKAT_RE.sub('', unicodedata.normalize('NFC', word)).translate(AR_MAP).lower()
    return ''.join(c for c in w if c.isalnum())


def plain(word):
    return HARAKAT_RE.sub('', word)


def load_words(files, offsets):
    if not files:
        raise CueError('Give at least one --words file (a .words.json from the narration).')
    offsets = list(offsets or [])
    if len(offsets) > len(files):
        raise CueError('More --offset values than --words files.')
    offsets += [0.0] * (len(files) - len(offsets))
    out = []
    for f, off in zip(files, offsets):
        p = Path(f).expanduser()
        if not p.is_file():
            raise CueError('Word timings not found: %s' % p.name)
        try:
            data = json.loads(p.read_text(encoding='utf-8-sig'))
        except ValueError:
            raise CueError('%s is not valid JSON.' % p.name) from None
        rows = data.get('words') if isinstance(data, dict) else data
        if not isinstance(rows, list) or not rows:
            raise CueError('%s has no "words" list.' % p.name)
        rows, _ = clean_rows(rows)            # invisible characters are not there (INVISIBLE_RE)
        for r in rows:
            text = r.get('word') or r.get('text') or ''
            if not text or 'start' not in r or 'end' not in r:
                continue
            out.append({'text': text, 'plain': plain(text), 'n': norm(text),
                        'start': round(float(r['start']) + off, 3), 'end': round(float(r['end']) + off, 3),
                        'take': p.name})
    out.sort(key=lambda w: w['start'])
    for i, w in enumerate(out):
        w['i'] = i
    return out


def find_cue(words, cue):
    """Where a spoken cue is: (match, index of its first word, number of words). Raises CueError."""
    m = CUE_RE.match(cue.strip())
    if not m:
        raise CueError('Cannot read the cue "%s".' % cue)
    want = [norm(x) for x in m.group('words').split()]
    want = [x for x in want if x]
    if not want:
        raise CueError('The cue "%s" has no letters to look for.' % cue)
    nth = int(m.group('n') or 1)
    hits = []
    for i in range(len(words) - len(want) + 1):
        if all(words[i + k]['n'] == want[k] for k in range(len(want))):
            hits.append(i)
    if len(hits) < nth:
        said = [w['plain'] for w in words]
        close = difflib.get_close_matches(plain(m.group('words')), said, n=4, cutoff=0.5)
        if hits:
            raise CueError('«%s» is said %d time(s) in the narration, not %d.' % (m.group('words'), len(hits), nth))
        hint = ('Close words in the narration: %s.' % '، '.join('«%s»' % c for c in dict.fromkeys(close))) if close else \
            'Run "cues.py words" to see every word with its time.'
        raise CueError('The word «%s» is not in the narration timings. Write it as it is in the script. %s'
                       % (m.group('words'), hint))
    return m, hits[nth - 1], len(want)


def resolve(words, cue):
    m, i, k = find_cue(words, cue)
    t = words[i + k - 1]['end'] if m.group('edge') == 'end' else words[i]['start']
    t += float(m.group('shift') or 0)
    return round(max(0.0, t), 3), words[i]


def word_span(words, cue):
    """A spoken cue as (time, end): time as resolve() gives it; end = where its last word ends, with the same shift."""
    m, i, k = find_cue(words, cue)
    shift = float(m.group('shift') or 0)
    t = (words[i + k - 1]['end'] if m.group('edge') == 'end' else words[i]['start']) + shift
    return round(max(0.0, t), 3), round(max(0.0, words[i + k - 1]['end'] + shift), 3)


# ---------------------------------------------------------------- names (plan/cues.json, plan/beats.json)
def split_name(expr, names):
    """(name, edge, shift) when expr is a name, or a name with :start/:end and/or +/- seconds; else None.
    The same rule as window.cue() in timing.js: the whole text first, then a name with an ending; #2 is for words."""
    if not isinstance(expr, str):
        return None
    if expr in names:
        return expr, None, 0.0
    m = CUE_RE.match(expr.strip())
    if m and m.group('words') in names and int(m.group('n') or 1) == 1:
        return m.group('words'), m.group('edge'), float(m.group('shift') or 0)
    return None


def named_time(name, edge, shift, cues, ends):
    if edge == 'end':
        if name not in ends:
            raise CueError('«%s» has no end: give it one in plan/beats.json, e.g. "%s": {"at": %s, "end": ...}.'
                           % (name, name, cues[name]))
        t = ends[name]
    else:
        t = cues[name]
    return round(max(0.0, t + shift), 3)


def resolve_any(words, cues, ends, expr):
    """What window.cue(expr) returns in timing.js: a name (with its endings) first, then the spoken words."""
    hit = split_name(expr, cues)
    if hit:
        return named_time(hit[0], hit[1], hit[2], cues, ends)
    if not words:
        close = difflib.get_close_matches(str(expr), list(cues), n=4, cutoff=0.5)
        raise CueError('«%s» is not a name in plan/beats.json, and this video has no narration words.%s'
                       % (expr, (' Close names: %s.' % ', '.join(close)) if close else ''))
    return resolve(words, expr)[0]


NUM_RE = re.compile(r'^\d+(?:\.\d+)?$')


def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


class Names:
    """Resolves every name of plan/cues.json and plan/beats.json to (time, end or None), following references."""

    def __init__(self, words, specs):
        self.words, self.specs = words, specs          # name -> [(origin, value), ...]
        self.cues, self.ends, self.busy, self.clamped = {}, {}, [], []

    def all(self):
        for name in self.specs:
            self.get(name)
        return self.cues, self.ends

    def get(self, name):
        if name in self.cues:
            return self.cues[name], self.ends.get(name)
        if name in self.busy:
            loop = self.busy[self.busy.index(name):] + [name]
            raise CueError('These names point at each other in a circle: %s.' % ' -> '.join(loop))
        self.busy.append(name)
        got = []
        for origin, value in self.specs[name]:
            try:
                got.append((origin,) + self.value(origin, value))
            except CueError as e:
                raise CueError('%s: %s' % (name, e)) from None
        self.busy.pop()
        _, t, end = got[0]
        for origin, t2, end2 in got[1:]:
            if abs(t2 - t) > 0.0015:
                raise CueError('%s: named twice with different times (%s s and %s s): keep one, or rename one.'
                               % (name, t, t2))
            if end is None:
                end = end2
            elif end2 is not None and abs(end2 - end) > 0.0015:
                raise CueError('%s: named twice with different ends (%s s and %s s).' % (name, end, end2))
        if end is not None and end < t - 0.0005:
            raise CueError('%s: ends at %s s, before it starts (%s s).' % (name, end, t))
        self.cues[name] = t
        if end is not None:
            self.ends[name] = end
        return t, end

    def ref(self, text):
        """A name with its endings -> (time, end or None), or None when text is not a name."""
        hit = split_name(text, self.specs)
        if not hit:
            return None
        name, edge, shift = hit
        t, end = self.get(name)
        if edge == 'end':
            if end is None:
                raise CueError('«%s» has no end: give it one, e.g. "%s": {"at": %s, "end": ...}.' % (name, name, t))
            t = end
        return self._clamp(t + shift), (None if end is None else self._clamp(end + shift))

    def _clamp(self, t):
        if t < 0:
            self.clamped.append(round(t, 3))
        return round(max(0.0, t), 3)

    def value(self, origin, v):
        if origin == 'cues':                                  # plan/cues.json: spoken words, as before
            if _is_num(v):
                return self._clamp(float(v)), None
            text = str(v)
            if self.words:
                try:
                    return word_span(self.words, text)
                except CueError:
                    hit = self.ref(text)                      # not a word: maybe another name
                    if hit:
                        return hit
                    raise
            hit = self.ref(text)
            if hit:
                return hit
            raise CueError('«%s» is a spoken word, and there are no narration words: give --words too.' % text)
        # plan/beats.json
        if _is_num(v):
            return self._clamp(float(v)), None
        if isinstance(v, str):
            if NUM_RE.match(v.strip()):
                return self._clamp(float(v)), None
            hit = self.ref(v)
            if hit:
                return hit
            if self.words:
                return word_span(self.words, v)
            close = difflib.get_close_matches(v, list(self.specs), n=4, cutoff=0.5)
            raise CueError('«%s» is not a time in seconds nor a name in plan/beats.json.%s'
                           % (v, (' Close names: %s.' % ', '.join(close)) if close else ''))
        if isinstance(v, dict):
            at = v.get('at', v.get('start'))
            if at is None:
                raise CueError('give it a time: {"at": seconds or a name, "end": ...}.')
            t, end = self.value('beats', at)
            if 'end' in v and 'dur' in v:
                raise CueError('give "end" or "dur", not both.')
            if v.get('end') is not None:
                end = self.value('beats', v['end'])[0]
            elif v.get('dur') is not None:
                if not _is_num(v['dur']) or v['dur'] < 0:
                    raise CueError('"dur" is seconds (a number of 0 or more).')
                end = round(t + float(v['dur']), 3)
            return t, end
        raise CueError('a time is seconds, a name like "box+0.2", or {"at": ..., "end": ...}.')


def _read_object(path, what):
    p = Path(path).expanduser()
    try:
        data = json.loads(p.read_text(encoding='utf-8-sig'))
    except OSError:
        raise CueError('Cannot read %s (%s).' % (p.name, what)) from None
    except ValueError:
        raise CueError('%s is not valid JSON (%s).' % (p.name, what)) from None
    if not isinstance(data, dict):
        raise CueError('%s must be a JSON object (%s).' % (p.name, what))
    return data, p


def named_cues(a, words):
    """(cues, ends, duration, notes) from --cues and --beats."""
    specs, duration, notes = {}, None, []
    if getattr(a, 'cues', None):
        p = Path(a.cues).expanduser()
        try:
            spec = json.loads(p.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError):
            raise CueError('Cannot read %s (a JSON object of name -> cue).' % p.name) from None
        if not isinstance(spec, dict):
            raise CueError('%s must be a JSON object of name -> cue.' % p.name)
        for name, c in spec.items():
            specs[name] = [('cues', c)]
    if getattr(a, 'beats', None):
        data, p = _read_object(a.beats, 'named seconds: {"cues": {"box": 0.9, "lid": "box+0.2"}}')
        cues, beats = data.get('cues'), data.get('beats')
        if cues is None and beats is None:
            raise CueError('%s has no "cues" (name -> seconds) and no "beats" list. Example: '
                           '{"duration": 12, "cues": {"box": 0.9, "lid": "box+0.2", "bow": {"at": 8.6, "end": 9.4}}}'
                           % p.name)
        if cues is not None and not isinstance(cues, dict):
            raise CueError('"cues" in %s must be an object of name -> time.' % p.name)
        if beats is not None and not isinstance(beats, list):
            raise CueError('"beats" in %s must be a list of {"id", "start", "end"}.' % p.name)
        for name, v in (cues or {}).items():
            if name in specs:
                raise CueError('«%s» is named in both plan/cues.json and %s: rename one.' % (name, p.name))
            specs[name] = [('beats', v)]
        for b in beats or []:
            if not isinstance(b, dict) or not (b.get('id') or b.get('name')):
                continue
            name = str(b.get('id') or b.get('name'))
            if b.get('start') is None and b.get('at') is None:
                raise CueError('the beat «%s» in %s has no "start".' % (name, p.name))
            item = {'at': b.get('start', b.get('at'))}
            if b.get('end') is not None:
                item['end'] = b['end']
            elif b.get('dur') is not None:
                item['dur'] = b['dur']
            if name in specs and specs[name][0][0] == 'cues':
                raise CueError('«%s» is named in both plan/cues.json and %s: rename one.' % (name, p.name))
            specs.setdefault(name, []).append(('beats', item))
        if data.get('duration') is not None:
            if not _is_num(data['duration']) or data['duration'] <= 0:
                raise CueError('"duration" in %s is the video length in seconds.' % p.name)
            duration = round(float(data['duration']), 3)
    resolver = Names(words, specs)
    errors = []
    for name in specs:
        try:
            resolver.get(name)
        except CueError as e:
            msg = str(e)
            errors.append(msg if msg.startswith(name + ':') or 'circle' in msg else '%s: %s' % (name, msg))
            resolver.busy = []
    if errors:
        raise CueError('Some cues have no word in the narration:\n  ' + '\n  '.join(errors) if getattr(a, 'cues', None)
                       and not getattr(a, 'beats', None) else 'Some names have no time:\n  ' + '\n  '.join(errors))
    if resolver.clamped:
        notes.append('%d time(s) fell before 0 s and were set to 0.' % len(resolver.clamped))
    if getattr(a, 'duration', None):
        duration = round(float(a.duration), 3)
    if duration:
        late = [n for n, t in resolver.cues.items() if t > duration + 0.0005]
        late += [n + ':end' for n, t in resolver.ends.items() if t > duration + 0.0005]
        if late:
            notes.append('After the end of the video (%s s): %s.' % (duration, ', '.join(late)))
    return {n: resolver.cues[n] for n in specs}, {n: resolver.ends[n] for n in specs if n in resolver.ends}, \
        duration, notes


JS = r"""// Made by <skill>/scripts/cues.py from %(sources)s. Times are seconds of the whole video.
// Rebuild it after any %(change)s change: python "<skill>/scripts/cues.py" build ...
window.KHAAM_WORDS = %(words)s;
window.KHAAM_CUES = %(cues)s;
window.KHAAM_CUE_ENDS = %(ends)s;
%(duration)s(function () {
  var HARAKAT = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  var MAP = {"أ":"ا","إ":"ا","آ":"ا","ٱ":"ا","ى":"ي","ة":"ه","ؤ":"و","ئ":"ي","ء":""};
  function norm(w) {
    return String(w).normalize("NFC").replace(HARAKAT, "").replace(/[أإآٱىةؤئء]/g, function (c) { return MAP[c]; })
      .toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  }
  // cue("يسقي"), cue("يسقي#2"), cue("يسقي:end"), cue("ليلة مطر"), cue("يسقي+0.2"), or a name from cues.json or
  // beats.json, also with an ending: cue("dawn:end"), cue("dawn+0.2"), cue("dawn:end-0.1")
  window.cue = function (name) {
    var C = window.KHAAM_CUES, E = window.KHAAM_CUE_ENDS || {}, own = Object.prototype.hasOwnProperty;
    if (own.call(C, name)) return C[name];
    var m = /^(.+?)(?:#(\d+))?(?::(start|end))?([+-]\d+(?:\.\d+)?)?$/.exec(String(name).trim());
    if (!m) throw new Error('cue: cannot read "' + name + '"');
    if (own.call(C, m[1]) && (!m[2] || +m[2] === 1)) {
      if (m[3] === "end" && !own.call(E, m[1]))
        throw new Error('cue: «' + m[1] + '» has no end in timing.js (give it an "end" in plan/beats.json)');
      var v = (m[3] === "end" ? E[m[1]] : C[m[1]]) + (m[4] ? parseFloat(m[4]) : 0);
      return Math.round(Math.max(0, v) * 1000) / 1000;
    }
    var want = m[1].split(/\s+/).map(norm).filter(Boolean), W = window.KHAAM_WORDS, nth = +(m[2] || 1), seen = 0;
    for (var i = 0; i + want.length <= W.length; i++) {
      var ok = true;
      for (var k = 0; k < want.length; k++) if (norm(W[i + k].text) !== want[k]) { ok = false; break; }
      if (ok && ++seen === nth) {
        var t = m[3] === "end" ? W[i + want.length - 1].end : W[i].start;
        return Math.max(0, t + (m[4] ? parseFloat(m[4]) : 0));
      }
    }
    if (!W.length) throw new Error('cue: «' + m[1] + '» is not a name in timing.js, and this video has no ' +
                                   'narration words (name it in plan/beats.json, then run cues.py build --beats).');
    throw new Error('cue: the word «' + m[1] + '» is not in the narration timings (timing.js). ' +
                    'Write it as it is in the script, or run cues.py words to list them.');
  };
  // words between two times, for a word-lit block: wordsBetween(cue("المطر"), cue("أرضك:end"))
  window.wordsBetween = function (t0, t1) {
    return window.KHAAM_WORDS.filter(function (w) { return w.start >= t0 - 0.001 && w.end <= t1 + 0.001; });
  };
})();
"""


def secs(t):
    """Seconds as short text: 12, 16.8, 1234.567."""
    return json.dumps(int(t) if float(t) == int(t) else t)


def cmd_check(a, words):
    cues, ends, rows, bad = {}, {}, [], []
    if a.cues or a.beats:
        cues, ends, _, _ = named_cues(a, words)
    if not a.cue:
        if not cues:
            raise CueError('Give at least one cue to check: a spoken word, or a name with --cues / --beats.')
        rows = [dict({'cue': n, 'time': t}, **({'end': ends[n]} if n in ends else {})) for n, t in cues.items()]
        print(json.dumps({'cues': rows, 'missing': []}, ensure_ascii=False, indent=2))
        return 0
    for c in a.cue:
        try:
            hit = split_name(c, cues)
            if hit:
                rows.append({'cue': c, 'time': named_time(hit[0], hit[1], hit[2], cues, ends), 'name': hit[0]})
                continue
            if not words:
                resolve_any(words, cues, ends, c)          # raises the "no narration words" error
            t, w = resolve(words, c)
            rows.append({'cue': c, 'time': t, 'word': w['text'], 'take': w['take']})
        except CueError as e:
            bad.append({'cue': c, 'error': str(e)})
    print(json.dumps({'cues': rows, 'missing': bad}, ensure_ascii=False, indent=2))
    return 1 if bad else 0


def cmd_words(a, words):
    for w in words:
        print('%7.3f  %7.3f  %s' % (w['start'], w['end'], w['text']))
    return 0


def cmd_build(a, words):
    named, ends, duration, notes = {}, {}, None, []
    if a.cues or a.beats or a.duration:
        named, ends, duration, notes = named_cues(a, words)
    out = Path(a.out).expanduser()
    js_words = [{'text': w['text'], 'start': w['start'], 'end': w['end']} for w in words]
    takes = sorted({w['take'] for w in words})
    if a.beats:
        takes.append(Path(a.beats).name + ('' if words else ' (no voice)'))
    sources = ', '.join(takes)
    out.write_text(JS % {'sources': sources, 'change': 'narration' if words else Path(a.beats).name,
                         'words': json.dumps(js_words, ensure_ascii=False),
                         'cues': json.dumps(named, ensure_ascii=False, indent=1),
                         'ends': json.dumps(ends, ensure_ascii=False, indent=1),
                         'duration': ('window.KHAAM_DURATION = %s;\n' % secs(duration)) if duration else ''},
                   encoding='utf-8')
    report = {'written': str(out), 'words': len(js_words), 'cues': named,
              'video_seconds_covered': [js_words[0]['start'], js_words[-1]['end']] if js_words else None}
    if ends:
        report['cue_ends'] = ends
    if duration:
        report['duration'] = duration
        report['next'] = 'index.html: data-duration="%s" on the root and on every track that runs to the end.' % \
            secs(duration)
    if notes:
        report['notes'] = notes
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


# ---------------------------------------------------------------- read: word timings with no voice
READ_PACE = 2.4                                   # Gulf words a second (voiceover.md §10.5)
MARK_PAUSE = {'…': 0.5, '...': 0.5, '.': 0.35, '؟': 0.35, '?': 0.35, '!': 0.35,
              '،': 0.2, ',': 0.2, '؛': 0.2, ';': 0.2, ':': 0.2, '—': 0.2, '–': 0.2}
LINE_PAUSE = 0.2                                  # a line that ends with no mark: a breath, like a comma
TAG_RE = re.compile(r'\[[^\[\]\n]{1,120}\]')      # [whispers] and other voice tags are not read
PUNCT = '.,!?;:…—–-«»“”‘’"\'()[]{}،؛؟٪*/\\|'
AT_RE = re.compile(r'^@\s*(\d+(?:\.\d+)?)\s*(?:s\b)?\s*(.*)$')


def mark_pause(marks):
    """The pause for the punctuation at a word's edge: the longest mark wins («…» over «.»)."""
    p = 0.0
    for mark, sec in MARK_PAUSE.items():
        if mark in marks:
            p = max(p, sec)
    return p


def mark_kind(marks):
    p = mark_pause(marks)
    return {0.5: 'ellipsis', 0.35: 'stop', 0.2: 'comma'}.get(p)


def read_script_text(path):
    p = Path(path).expanduser()
    if not p.is_file():
        raise CueError('Script file not found: %s' % p.name)
    text = p.read_text(encoding='utf-8-sig').replace('\r\n', '\n').strip()
    if not text:
        raise CueError('The script file is empty.')
    return text, p


def reading_words(text, start=0.0, pace=READ_PACE, by='letters'):
    """The script's words with reading-pace times. Returns (rows, info)."""
    lines = []                                                 # [(at or None, [(word, raw, marks_after)])]
    for line in text.split('\n'):
        line = visible(TAG_RE.sub(' ', line)).strip()   # invisible characters are not read
        if not line:
            continue
        at = None
        m = AT_RE.match(line)
        if m:
            at, line = float(m.group(1)), m.group(2).strip()
        toks = []
        lead = ''
        for raw in line.split():
            first = next((k for k, c in enumerate(raw) if c.isalnum()), None)
            if first is None:                                  # punctuation alone: it belongs to the word before
                if toks:
                    toks[-1][2] += raw
                else:
                    lead += raw
                continue
            last = max(k for k, c in enumerate(raw) if c.isalnum())
            clean = raw.strip(PUNCT)
            if not clean:
                continue
            toks.append([clean, raw, raw[last + 1:]])
        if toks or at is not None:
            lines.append((at, toks, lead))
    words = [t for _, toks, _ in lines for t in toks]
    if not words:
        raise CueError('The script has no words to time.')
    n = len(words)
    if by == 'even':
        raw_slots = [1.0] * n
    else:   # by letters: a long word takes longer, a short one never under 0.30 s nor a long one over 0.62 s
        raw_slots = [min(0.62, max(0.30, 0.24 + 0.045 * max(1, len(norm(w[0]))))) + 0.04 for w in words]
    scale = (n / pace) / sum(raw_slots)                         # all the words together: n / pace seconds
    slots = [s * scale for s in raw_slots]
    rows, t, k, holds, counts, unmarked = [], float(start), 0, 0.0, {'comma': 0, 'stop': 0, 'ellipsis': 0}, 0
    for li, (at, toks, lead) in enumerate(lines):
        if at is not None:
            if at < t - 0.0005:
                raise CueError('The line «%s» is set to start at %s s, but the reading before it runs to %.2f s: '
                               'start it later, or take words out before it.'
                               % (' '.join(w[1] for w in toks)[:40], format(at, 'g'), t))
            holds += at - t
            t = at
        if lead:
            p = mark_pause(lead)
            t += p
            if mark_kind(lead):
                counts[mark_kind(lead)] += 1
        for j, (clean, raw, marks) in enumerate(toks):
            slot = slots[k]
            rows.append({'word': clean, 'raw': raw, 'start': round(t, 3), 'end': round(t + 0.9 * slot, 3)})
            t += slot
            p = mark_pause(marks)
            if p:
                counts[mark_kind(marks)] += 1
            elif j == len(toks) - 1:
                p = LINE_PAUSE
                unmarked += 1
            t += p
            k += 1
    estimate = n / pace + 0.2 * counts['comma'] + 0.35 * counts['stop'] + 0.5 * counts['ellipsis']
    info = {'words': n, 'pace_wps': pace, 'by': by, 'start_s': round(float(start), 3),
            'first_word_s': rows[0]['start'], 'last_word_end_s': rows[-1]['end'],
            'reading_s': round(t - float(start), 3), 'end_s': round(t, 3),
            'estimate_s': round(estimate, 3), 'marks': counts,
            'holds_s': round(holds, 3), 'lines_without_mark': unmarked}
    return rows, info


def cmd_read(a):
    if not 0.5 <= a.pace <= 6:
        raise CueError('--pace is words a second (Gulf narration ≈ 2.4); %s is out of range.' % a.pace)
    if a.start < 0:
        raise CueError('--start is seconds from the start of the video (0 or more).')
    text, script = read_script_text(a.script)
    out = Path(a.out).expanduser()
    if out.exists() and not a.overwrite:
        try:
            old = json.loads(out.read_text(encoding='utf-8-sig'))
            mine = isinstance(old, dict) and str(old.get('source', '')).startswith('reading pace')
        except (OSError, ValueError):
            mine = False
        if not mine:
            raise CueError('%s already holds word timings that "read" did not make (a voice?): refusing to replace '
                           'them. Pass --out with a new name.' % out.name)
    rows, info = reading_words(text, a.start, a.pace, a.by)
    result = {
        'source': 'reading pace, no voice (cues.py read): %s words a second by %s, pauses 0.2 s at «،», 0.35 s at '
                  'a stop, 0.5 s at «…» (voiceover.md §10.5)' % (format(a.pace, 'g'), a.by),
        'script_file': script.name,
        'pace_wps': a.pace,
        'by': a.by,
        'start_s': info['start_s'],
        'duration_s': info['end_s'],
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'words': rows,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    info = dict({'written': str(out)}, **info)
    info['say'] = ('هذي أوقات قراءة تقديرية بدون صوت (%s كلمة بالثانية). إذا صار فيه صوت بعدين، نعيد التوقيت على الصوت نفسه.'
                   % format(a.pace, 'g'))
    info['next'] = 'cues.py build --words "%s" --cues plan/cues.json --out timing.js' % out.as_posix()
    print(json.dumps(info, ensure_ascii=False, indent=2))
    return 0


# ---------------------------------------------------------------- beats: the picture timed from the take's words
RULE_RE = re.compile(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$')
NAME_RE = re.compile(r'[A-Za-z_][A-Za-z0-9_]*')
FUNCS = ('start', 'end', 'max', 'min')
BUILTIN = ('voice_start', 'voice_end')


def strip_note(line):
    """A rule line without its note: '# ...' at the start, or ' # ' after the rule (يسقي#2 has no space)."""
    if line.lstrip().startswith('#'):
        return ''
    m = re.search(r'\s#\s', line + ' ')
    return line[:m.start()] if m else line


class Rules:
    """Named beats from a rule file, resolved lazily over the spoken words (cues.find_cue) and each other."""

    def __init__(self, words, rules):
        self.words, self.rules = words, rules                 # name -> (line number, text)
        self.done, self.busy = {}, []

    def get(self, name):
        if name in self.done:
            return self.done[name]
        if name in self.busy:
            loop = self.busy[self.busy.index(name):] + [name]
            raise CueError('These names point at each other in a circle: %s.' % ' -> '.join(loop))
        line, text = self.rules[name]
        self.busy.append(name)
        try:
            parts = self.split_span(text)
            t = self.eval(parts[0], line)
            end = self.eval(parts[1], line) if len(parts) > 1 else None
        finally:
            self.busy.pop()
        if end is not None and end < t - 0.0005:
            raise CueError('line %d: «%s» ends at %.3f s, before it starts (%.3f s).' % (line, name, end, t))
        self.done[name] = (round(t, 3), None if end is None else round(end, 3))
        return self.done[name]

    @staticmethod
    def split_span(text):
        depth, out, k = 0, [], 0
        for i, c in enumerate(text):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
            elif c == '.' and depth == 0 and text[i:i + 2] == '..' and (i == 0 or text[i - 1] != '.'):
                out.append(text[k:i])
                k = i + 2
        out.append(text[k:])
        if len(out) > 2 or any(not p.strip() for p in out):
            raise CueError('a span is "from .. to" (two times, one "..").')
        return [p.strip() for p in out]

    # a small recursive-descent reader: expr := term (+|- term)*; term := unary (*|/ unary)*;
    # unary := -unary | number | (expr) | f(args) | name
    def eval(self, text, line):
        self.text, self.pos, self.line = text, 0, line
        v = self.expr()
        self.skip()
        if self.pos < len(self.text):
            raise CueError('line %d: cannot read "%s" at «%s».' % (line, text, self.text[self.pos:]))
        return v

    def skip(self):
        while self.pos < len(self.text) and self.text[self.pos].isspace():
            self.pos += 1

    def peek(self):
        self.skip()
        return self.text[self.pos] if self.pos < len(self.text) else ''

    def expr(self):
        v = self.term()
        while self.peek() in ('+', '-') and self.peek():
            op = self.text[self.pos]
            self.pos += 1
            w = self.term()
            v = v + w if op == '+' else v - w
        return v

    def term(self):
        v = self.unary()
        while self.peek() in ('*', '/') and self.peek():
            op = self.text[self.pos]
            self.pos += 1
            w = self.unary()
            if op == '/' and w == 0:
                raise CueError('line %d: division by zero.' % self.line)
            v = v * w if op == '*' else v / w
        return v

    def unary(self):
        c = self.peek()
        if c == '-':
            self.pos += 1
            return -self.unary()
        if c == '(':
            self.pos += 1
            v = self.expr()
            if self.peek() != ')':
                raise CueError('line %d: a "(" has no ")".' % self.line)
            self.pos += 1
            return v
        m = re.compile(r'\d+(?:\.\d+)?').match(self.text, self.pos)
        if m:
            self.pos = m.end()
            return float(m.group(0))
        m = NAME_RE.match(self.text, self.pos)
        if not m:
            raise CueError('line %d: expected a number, a name, start(...) or end(...) at «%s».'
                           % (self.line, self.text[self.pos:]))
        name = m.group(0)
        self.pos = m.end()
        if name in FUNCS and self.peek() == '(':
            self.pos += 1
            if name in ('start', 'end'):
                close = self.text.find(')', self.pos)
                if close < 0:
                    raise CueError('line %d: %s( has no ")".' % (self.line, name))
                arg = self.text[self.pos:close].strip().strip('«»"\'')
                self.pos = close + 1
                return self.edge(name, arg)
            args = [self.expr()]
            while self.peek() == ',':
                self.pos += 1
                args.append(self.expr())
            if self.peek() != ')':
                raise CueError('line %d: %s( has no ")".' % (self.line, name))
            self.pos += 1
            return max(args) if name == 'max' else min(args)
        return self.name_time(name, 'start')

    def name_time(self, name, edge):
        if name == 'voice_start' and name not in self.rules:
            return self.words[0]['start']
        if name == 'voice_end' and name not in self.rules:
            return self.words[-1]['end']
        if name not in self.rules:
            close = difflib.get_close_matches(name, list(self.rules) + list(BUILTIN), n=3, cutoff=0.5)
            raise CueError('line %d: «%s» is not a name in the rules%s. A spoken word goes inside start(...) or '
                           'end(...).' % (self.line, name, (' (close: %s)' % ', '.join(close)) if close else ''))
        line, text, pos = self.line, self.text, self.pos            # resolve another name, then come back
        t, end = self.get(name)
        self.line, self.text, self.pos = line, text, pos
        if edge == 'end':
            if end is None:
                raise CueError('line %d: «%s» has no end: make it a span (from .. to).' % (line, name))
            return end
        return t

    def edge(self, which, arg):
        if not arg:
            raise CueError('line %d: %s() needs a spoken word or a name.' % (self.line, which))
        if arg in self.rules or arg in BUILTIN:
            return self.name_time(arg, which) if arg in self.rules else self.name_time(arg, 'start')
        if not self.words:
            raise CueError('line %d: «%s» is a spoken word, and there are no narration words: give --words.'
                           % (self.line, arg))
        try:
            if which == 'start':
                return resolve(self.words, arg)[0]
            return word_span(self.words, arg)[1]
        except CueError as e:
            raise CueError('line %d: %s' % (self.line, e)) from None


def read_rules(path):
    p = Path(path).expanduser()
    if not p.is_file():
        raise CueError('Rule file not found: %s' % p.name)
    rules, order = {}, []
    for n, raw in enumerate(p.read_text(encoding='utf-8-sig').replace('\r\n', '\n').split('\n'), 1):
        line = strip_note(raw).strip()
        if not line:
            continue
        m = RULE_RE.match(line)
        if not m:
            raise CueError('%s line %d: a rule is "name = time", e.g. card = start(الحمد) - 0.3 (names in Latin '
                           'letters, digits and _).' % (p.name, n))
        name = m.group(1)
        if name in rules:
            raise CueError('%s line %d: «%s» is named twice (line %d).' % (p.name, n, name, rules[name][0]))
        if name in FUNCS:
            raise CueError('%s line %d: «%s» is a word of the rules (start, end, max, min): pick another name.'
                           % (p.name, n, name))
        rules[name] = (n, m.group(2))
        order.append(name)
    if not rules:
        raise CueError('%s has no rules. Example: card = start(الحمد) - 0.3 .. end(النشور) + 0.7' % p.name)
    return rules, order, p


def cmd_beats(a, words):
    rules, order, rp = read_rules(a.rules)
    r = Rules(words, rules)
    errors = []
    for name in order:
        try:
            r.get(name)
        except CueError as e:
            errors.append('%s: %s' % (name, e))
            r.busy = []
    if errors:
        raise CueError('Some beats have no time (%s):\n  %s' % (rp.name, '\n  '.join(errors)))
    duration = r.done['duration'][0] if 'duration' in r.done else None
    if a.duration:
        duration = round(float(a.duration), 3)
    named = {n: max(0.0, r.done[n][0]) for n in order if n != 'duration'}
    ends = {n: max(0.0, r.done[n][1]) for n in order if n != 'duration' and r.done[n][1] is not None}
    notes = []
    neg = [n for n in order if n != 'duration' and r.done[n][0] < 0]
    if neg:
        notes.append('Before 0 s, set to 0: %s.' % ', '.join(neg))
    if duration:
        late = [n for n, t in named.items() if t > duration + 0.0005] + \
               [n + ':end' for n, t in ends.items() if t > duration + 0.0005]
        if late:
            notes.append('After the end of the video (%s s): %s.' % (secs(duration), ', '.join(late)))
    out = Path(a.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix.lower() == '.json':
        if out.exists() and not a.overwrite:
            raise CueError('%s already exists: pass --overwrite to replace it (it is made from %s).' % (out.name, rp.name))
        cues = {n: ({'at': t, 'end': ends[n]} if n in ends else t) for n, t in named.items()}
        data = {'_made_by': 'cues.py beats from %s and %s; rebuild after any change to the take or the rules'
                            % (rp.name, ', '.join(sorted({w['take'] for w in words}))), 'cues': cues}
        if duration:
            data['duration'] = duration
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    else:
        js_words = [{'text': w['text'], 'start': w['start'], 'end': w['end']} for w in words]
        sources = ', '.join(sorted({w['take'] for w in words}) + [rp.name])
        out.write_text(JS % {'sources': sources, 'change': 'narration or %s' % rp.name,
                             'words': json.dumps(js_words, ensure_ascii=False),
                             'cues': json.dumps(named, ensure_ascii=False, indent=1),
                             'ends': json.dumps(ends, ensure_ascii=False, indent=1),
                             'duration': ('window.KHAAM_DURATION = %s;\n' % secs(duration)) if duration else ''},
                       encoding='utf-8')
    report = {'written': str(out), 'rules': rp.name, 'words': len(words),
              'beats': ['%-14s %8.3f%s' % (n, named[n], ('  .. %.3f' % ends[n]) if n in ends else '') for n in named]}
    if duration:
        report['duration'] = duration
        report['next'] = 'index.html: data-duration="%s" on the root and on every track that runs to the end.' % \
            secs(duration)
    if notes:
        report['notes'] = notes
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name in ('check', 'build', 'words'):
        sp = sub.add_parser(name)
        sp.add_argument('--words', action='append', required=(name == 'words'),
                        help='a .words.json (repeat for several takes)')
        sp.add_argument('--offset', action='append', type=float,
                        help='where that take starts in the video, seconds (repeat in the same order)')
        if name == 'check':
            sp.add_argument('cue', nargs='*')
        if name in ('check', 'build'):
            sp.add_argument('--cues', help='JSON object: name -> cue')
            sp.add_argument('--beats', help='plan/beats.json: named seconds, for a video with no voice')
        if name == 'build':
            sp.add_argument('--out', default='timing.js')
            sp.add_argument('--duration', type=float, help='the video length, seconds -> window.KHAAM_DURATION')
        else:
            sp.set_defaults(duration=None)
    rd = sub.add_parser('read', help='word timings with no voice, at the reading pace')
    rd.add_argument('--script', required=True, help='UTF-8 text file with the words, line by line')
    rd.add_argument('--out', required=True, help='e.g. assets/vo/reading.words.json')
    rd.add_argument('--start', type=float, default=0.0, help='where the first word starts in the video, seconds')
    rd.add_argument('--pace', type=float, default=READ_PACE, help='words a second (default 2.4)')
    rd.add_argument('--by', choices=('letters', 'even'), default='letters',
                    help='a word\'s share of the time: by its letters (default) or all equal')
    rd.add_argument('--overwrite', action='store_true', help='replace an existing words file that read did not make')
    bt = sub.add_parser('beats', help='named beats from a rule file over the take\'s words -> timing.js or beats.json')
    bt.add_argument('--words', action='append', required=True, help='the narration .words.json (repeat for several)')
    bt.add_argument('--offset', action='append', type=float,
                    help='where that take starts in the video, seconds (repeat in the same order)')
    bt.add_argument('--rules', required=True, help='plan/beats.txt: one "name = time" rule a line')
    bt.add_argument('--out', default='timing.js', help='timing.js (HyperFrames), or a .json for plan/beats.json')
    bt.add_argument('--duration', type=float, help='the video length, seconds (else the rule "duration")')
    bt.add_argument('--overwrite', action='store_true', help='replace an existing .json --out')
    a = p.parse_args(argv)
    if a.cmd == 'read':
        return cmd_read(a)
    if a.cmd == 'beats':
        return cmd_beats(a, load_words(a.words, a.offset))
    if a.words:
        words = load_words(a.words, a.offset)
    elif getattr(a, 'beats', None):
        if a.offset:
            raise CueError('--offset goes with --words (a narration take).')
        words = []
    else:
        raise CueError('Give --words <take>.words.json (a narration), or --beats plan/beats.json for a video with '
                       'no voice.')
    return {'check': cmd_check, 'build': cmd_build, 'words': cmd_words}[a.cmd](a, words)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except CueError as e:
        print('ERROR: ' + str(e), file=sys.stderr)
        sys.exit(1)
