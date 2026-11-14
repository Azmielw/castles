#!/usr/bin/env python3
"""Check a quoted text (an ayah, a hadith, a dua) in a narration take, word by word - Khaam Motion.

    python -X utf8 scripts/check_quote.py "assets/vo/vo.wav" --text "source/dua.txt" [--words assets/vo/vo.words.json]
        [--pair "أَحْيَانَا/أَحْيَانًا"] [--auto-pairs] [--control "assets/vo/control/wrong.mp3"] [--out plan/vo/quote-check.json]

--text is the source text exactly as copied from its page (a UTF-8 file, or the text itself). Three checks, on every
take that carries a quoted text (reference/voiceover.md §10.5):
  1. The text: the take's words (its .words.json: the text sent to ElevenLabs, or the script aligned to a recording
     with align_voice.py) against the source, letter by letter and mark by mark. One word or one haraka off means the
     take was made from a wrong text: fix the script and generate a new whole take.
  2. A Whisper read: every quoted word must be heard. Whisper writes no harakat, so this proves the words, not the
     vowels.
  3. A forced choice on each word whose vowelling changes its meaning: Whisper scores the right spelling against the
     wrong one on the take's own sound, in context (two words before, one after) and alone (with the next word); the
     margin is a log-probability, positive = the right spelling. --pair RIGHT/WRONG names a word (the first time it
     is in the quote; RIGHT#2 for the second); --auto-pairs adds the mechanical ones (a final «ـَا» against «ـًا»,
     tanween against a single vowel; never a lone mechanical pair fails a take). A margin alone proves little: read it against a
     NEGATIVE CONTROL, the same words generated on purpose with the wrong vowel (--control; the script prints how to
     make one). On 11-12, Eleven v4 read «أَحْيَانَا» as «أحيانًا» in a short chunk, harakat or not (-3.9/-4.2, like
     the wrong control's -3.7/-4.4); inside the whole narration it read it right (+0.9 to +2.4).
     A control counts only when it reads wrong by the same measure (its own margin under 0). One that scores right
     did not take the wrong vowel (v4 often says the known form of a famous text whatever is written) or the vowel
     cannot be heard there: it judges nothing, never fails a take, and the word goes to the user's ear.
A verdict per word, and always: only the user's ear clears it. Exit 1 when a check fails.

Uses align_voice.py's faster-whisper and its pinned models (default "turbo", large-v3-turbo: forced choice needs a
large model). A missing model is never downloaded here: "align_voice.py plan --model turbo" says the size and asks
first. An NVIDIA GPU first (seconds), else the CPU (minutes; --threads 2 when memory is short).
"""
import argparse
import difflib
import json
import math
import os
import re
import subprocess
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import align_voice as av  # noqa: E402  (the faster-whisper environment, pinned models, the GPU route)
import cues  # noqa: E402  (word matching rules, UTF-8 output on Windows)

MARKS = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ]')   # harakat and Quranic marks
FATHA, DAMMA, KASRA, SHADDA = 'َ', 'ُ', 'ِ', 'ّ'
TANWEEN = {'ً': FATHA, 'ٌ': DAMMA, 'ٍ': KASRA}            # fathatan, dammatan, kasratan -> one vowel
CLEAR, NEAR = 3.0, 1.5                 # with a control: clear of it by 3 or more; within 1.5 reads like it
RIGHT_MIN = 2.0                        # without a control: voice.md's scale (above +2 right, under 0 wrong)


class QuoteError(Exception):
    pass


def marked(w):
    """Letters and marks only (NFC): what the voice was asked to say, for an exact comparison."""
    w = unicodedata.normalize('NFC', w).replace('ـ', '')
    return ''.join(c for c in w if c.isalpha() or MARKS.match(c))


def bare(w):
    return MARKS.sub('', marked(w))


def read_text(arg):
    p = Path(arg).expanduser()
    try:
        is_file = len(arg) < 400 and p.is_file()
    except OSError:
        is_file = False
    text = p.read_text(encoding='utf-8-sig') if is_file else arg
    words = []
    for raw in cues.TAG_RE.sub(' ', text).split():
        if any(c.isalnum() for c in raw):
            words.append({'text': marked(raw), 'norm': cues.norm(raw)})
    if not words:
        raise QuoteError('--text has no words.')
    return words, (p.name if is_file else 'pasted text')


def words_file(take, given):
    if given:
        p = Path(given).expanduser()
        if not p.is_file():
            raise QuoteError('Word timings not found: %s' % p.name)
        return p
    for p in (take.with_name(take.stem + '.words.json'), take.with_name(take.name + '.words.json')):
        if p.is_file():
            return p
    return None


def load_rows(p):
    data = json.loads(p.read_text(encoding='utf-8-sig'))
    rows = data.get('words') if isinstance(data, dict) else data
    out = []
    rows, _ = cues.clean_rows(rows or [])   # invisible characters are not there (cues.INVISIBLE_RE)
    for r in rows:
        t = r.get('word') or r.get('text')
        if t and 'start' in r and 'end' in r:
            out.append({'text': marked(t), 'norm': cues.norm(t), 'start': float(r['start']), 'end': float(r['end'])})
    if not out:
        raise QuoteError('%s has no words with times.' % p.name)
    return out


def locate(quote, rows):
    """Quote word index -> row index (or None), by the letters (harakat ignored), on the best matching stretch."""
    sm = difflib.SequenceMatcher(None, [q['norm'] for q in quote], [r['norm'] for r in rows], autojunk=False)
    where = [None] * len(quote)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                where[i1 + k] = j1 + k
    return where


def heard_cover(quote, heard, rows, where):
    """Per quoted word: the heard words that carry all its letters, near it in time (Whisper joins and splits words:
    «بعد ما» came out as «بعدما»). Returns [list of heard indexes, or None]."""
    a_chars, a_word, b_chars, b_word = [], [], [], []
    for i, q in enumerate(quote):
        for c in q['norm']:
            a_chars.append(c)
            a_word.append(i)
    for j, h in enumerate(heard):
        for c in h['norm']:
            b_chars.append(c)
            b_word.append(j)
    sm = difflib.SequenceMatcher(None, ''.join(a_chars), ''.join(b_chars), autojunk=False)
    hits, cover = [0] * len(quote), [set() for _ in quote]
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            i, j = a_word[blk.a + k], b_word[blk.b + k]
            if where[i] is not None:
                r = rows[where[i]]
                if not (heard[j]['end'] > r['start'] - 0.35 and heard[j]['start'] < r['end'] + 0.35):
                    continue
            hits[i] += 1
            cover[i].add(j)
    return [sorted(cover[i]) if hits[i] >= len(q['norm']) else None for i, q in enumerate(quote)]


# ---------------------------------------------------------------- Whisper
def need_model(a):
    folder = av.find_model(a.model)
    if not folder:
        raise QuoteError('The "%s" speech model is not on this computer. Run: python "<skill>/scripts/align_voice.py" '
                         'plan --model %s (it says the size), ask the user, then setup --yes --model %s.'
                         % (a.model, a.model, a.model))
    av.verify_folder(folder, a.model)
    return folder


def transcribe(model, x, offset):
    segs, _ = model.transcribe(x, language='ar', beam_size=5, word_timestamps=True, condition_on_previous_text=False,
                               vad_filter=False, temperature=0.0)
    out = []
    for s in segs:
        for w in s.words or []:
            t = w.word.strip()
            if t:
                out.append({'text': t, 'norm': cues.norm(t), 'start': round(float(w.start) + offset, 3),
                            'end': round(float(w.end) + offset, 3), 'p': round(float(w.probability), 2)})
    return out


class Scorer:
    """log P(text | audio) of one spelling through faster-whisper's aligner (teacher-forced), as the forced-choice
    tests of 10-31 and 11-12 (diacritic_check.py) did."""

    def __init__(self, model):
        from faster_whisper.tokenizer import Tokenizer
        self.model = model
        self.tok = Tokenizer(model.hf_tokenizer, True, task='transcribe', language='ar')

    def margin(self, x, rows, i, right, wrong, before, after):
        import numpy as np
        from faster_whisper.audio import pad_or_trim
        a, b = max(0, i - before), min(len(rows) - 1, i + after)
        s = max(0, int((rows[a]['start'] - 0.08) * 16000))
        e = min(len(x), int((rows[b]['end'] + 0.08) * 16000))
        if e - s < 1600:
            e = min(len(x), s + 1600)
        feats = self.model.feature_extractor(x[s:e])
        n = feats.shape[-1] - 1
        enc = self.model.encode(pad_or_trim(feats[:, :n]))
        plain = [bare(r['text']) for r in rows[a:b + 1]]

        def logp(form):
            ws = list(plain)
            ws[i - a] = form
            pr = self.model.model.align(enc, self.tok.sot_sequence, [self.tok.encode(' ' + ' '.join(ws))], n)[0]
            return float(np.log(np.maximum(np.array(pr.text_token_probs), 1e-12)).sum())
        return round(logp(right) - logp(wrong), 2), ' '.join(plain)


# ---------------------------------------------------------------- pairs
def auto_variants(w):
    """Mechanical wrong spellings of one quoted word: a final «ـَا» as «ـًا» and back, tanween as one vowel (the
    11-12 fault). A dropped shadda is not tried: Whisper's tokens barely carry gemination (on 11-12 «النُّشُورُ»
    scored under its shadda-less spelling on a take read right), so that pair would only cry wolf."""
    out = []
    if w.endswith(FATHA + 'ا'):
        out.append(w[:-2] + 'ً' + 'ا')
    if w.endswith('ً' + 'ا'):
        out.append(w[:-2] + FATHA + 'ا')
    if w and w[-1] in TANWEEN:
        out.append(w[:-1] + TANWEEN[w[-1]])
    return [v for v in dict.fromkeys(out) if v != w]


def parse_pairs(a, quote):
    pairs = []
    for spec in a.pair or []:
        if '/' not in spec:
            raise QuoteError('--pair is RIGHT/WRONG, e.g. "أَحْيَانَا/أَحْيَانًا" (got "%s").' % spec)
        right, wrong = (s.strip() for s in spec.split('/', 1))
        nth = 1
        m = re.match(r'^(.*)#(\d+)$', right)
        if m:
            right, nth = m.group(1), int(m.group(2))
        hits = [k for k, q in enumerate(quote) if q['text'] == marked(right)] or \
               [k for k, q in enumerate(quote) if q['norm'] == cues.norm(right)]
        if len(hits) < nth:
            raise QuoteError('--pair "%s": «%s» is not in the quoted text%s.' % (spec, right,
                             '' if not hits else ' %d times' % nth))
        if cues.norm(wrong) != cues.norm(right):
            raise QuoteError('--pair "%s": the two spellings must have the same letters and differ only in their marks.'
                             % spec)
        pairs.append({'k': hits[nth - 1], 'right': marked(right), 'wrong': marked(wrong), 'from': 'named'})
    if a.auto_pairs:
        have = {(p['k'], p['wrong']) for p in pairs}
        for k, q in enumerate(quote):
            for v in auto_variants(q['text']):
                if (k, v) not in have:
                    pairs.append({'k': k, 'right': q['text'], 'wrong': v, 'from': 'auto'})
    return pairs


def control_text(quote, k, wrong):
    """The words a control says: the quote up to one word after the tested one, with the wrong spelling in it."""
    ws = [q['text'] for q in quote[:min(len(quote), k + 2)]]
    ws[k] = wrong
    return ' '.join(ws)


# ---------------------------------------------------------------- the run
def reexec_in_env(argv):
    py = av.env_python()
    if not py:
        raise QuoteError('faster-whisper is not installed. Run "align_voice.py plan --model turbo" and, after the '
                         'user\'s yes, "align_voice.py setup --yes --model turbo".')
    r = subprocess.run([str(py), '-I', os.path.abspath(__file__)] + argv)
    sys.exit(r.returncode)


def take_rows(take, given, model, x, quote):
    """The take's word rows: its .words.json, else Whisper's own words on the whole take."""
    wp = words_file(take, given)
    if wp:
        return load_rows(wp), wp.name, None
    if len(x) / 16000.0 > 180:
        raise QuoteError('%s is over 3 minutes and has no .words.json: give --words (gen_tts_elevenlabs.py writes one; '
                         'align_voice.py align makes one for a recording).' % take.name)
    heard = transcribe(model, x, 0.0)
    if not heard:
        raise QuoteError('Whisper heard no words in %s.' % take.name)
    return heard, 'Whisper (no .words.json)', heard


def run(a):
    take = Path(a.take).expanduser()
    if not take.is_file():
        raise QuoteError('Take not found: %s' % take.name)
    quote, src = read_text(a.text)
    folder = need_model(a)
    from faster_whisper import decode_audio
    t0 = time.perf_counter()
    try:
        model, device, note = av.load_model_on(folder, a.threads, a.device)
        x = decode_audio(str(take), sampling_rate=16000)
        rows, rows_src, heard_all = take_rows(take, a.words, model, x, quote)
        where = locate(quote, rows)
        found = [w for w in where if w is not None]
        if not found:
            raise QuoteError('None of the quoted words is in %s: is this the right take, and the right text?' % rows_src)
        # 2. a Whisper read of the quote's stretch (1 s each side), or of the whole take
        if heard_all is None:
            lo, hi = max(0.0, rows[min(found)]['start'] - 1.0), rows[max(found)]['end'] + 1.0
            heard = transcribe(model, x[int(lo * 16000):int(hi * 16000)], lo)
        else:
            heard = heard_all
        hw = heard_cover(quote, heard, rows, where)
        # 3. forced choice
        pairs = parse_pairs(a, quote)
        scorer = Scorer(model) if pairs else None
        for p in pairs:
            i = where[p['k']]
            if i is None:
                p['error'] = 'the word is not in the take\'s timings'
                continue
            p['context'], p['context_text'] = scorer.margin(x, rows, i, p['right'], p['wrong'], 2, 1)
            p['alone'], _ = scorer.margin(x, rows, i, p['right'], p['wrong'], 0, 1)
        controls = []
        for n, cpath in enumerate(a.control or []):
            cp = Path(cpath).expanduser()
            if not cp.is_file():
                raise QuoteError('Control not found: %s' % cp.name)
            cx = decode_audio(str(cp), sampling_rate=16000)
            cw = (a.control_words or [])[n] if n < len(a.control_words or []) else None
            crows, csrc, _ = take_rows(cp, cw, model, cx, quote)
            controls.append(cp.name)
            cmarks = any(MARKS.search(r['text']) for r in crows)
            for p in pairs:
                # a control stands for the pair it was made for: the word it says with the wrong spelling (when its
                # timings keep the marks), else the pairs named with --pair
                if cmarks:
                    hits = [j for j, r in enumerate(crows) if r['text'] == p['wrong']]
                elif p['from'] == 'named':
                    hits = [j for j, r in enumerate(crows) if r['norm'] == cues.norm(p['right'])]
                else:
                    hits = []
                if not hits:
                    continue
                c_ctx, _ = scorer.margin(cx, crows, hits[0], p['right'], p['wrong'], 2, 1)
                c_alone, _ = scorer.margin(cx, crows, hits[0], p['right'], p['wrong'], 0, 1)
                p.setdefault('controls', []).append({'file': cp.name, 'context': c_ctx, 'alone': c_alone})
    except (RuntimeError, MemoryError) as e:
        if av.memory_error(e):
            raise QuoteError(av.MEMORY_HELP) from None
        raise
    secs = round(time.perf_counter() - t0, 1)

    # ---- verdicts
    problems, unclear, table = [], [], []
    marks_known = any(MARKS.search(rows[w]['text']) for w in found)
    for k, q in enumerate(quote):
        i, h = where[k], hw[k]
        row = {'word': q['text']}
        if i is None:
            row['text'] = 'NOT IN THE TAKE'
            problems.append('«%s» is not in the take' % q['text'])
        else:
            said = rows[i]['text']
            row['at_s'] = round(rows[i]['start'], 2)
            if said == q['text'] or (not marks_known and bare(said) == bare(q['text'])):
                row['text'] = 'same' if marks_known else 'same letters'
            elif bare(said) == bare(q['text']):
                row['text'] = 'OTHER MARKS: «%s»' % said
                problems.append('«%s» was sent as «%s»' % (q['text'], said))
            else:
                row['text'] = 'OTHER WORD: «%s»' % said
                problems.append('«%s» is «%s» in the take' % (q['text'], said))
        if h:
            joined = ' '.join(heard[j]['text'] for j in h)
            row['whisper'] = 'heard (p %.2f)%s' % (min(heard[j]['p'] for j in h),
                                                   '' if cues.norm(joined) == q['norm'] else ' in «%s»' % joined)
        else:
            near = [w['text'] for w in heard if i is not None and w['end'] > rows[i]['start'] - 0.1
                    and w['start'] < rows[i]['end'] + 0.1]
            row['whisper'] = 'NOT HEARD%s' % ((' (heard «%s»)' % ' '.join(near)) if near else '')
            problems.append('Whisper did not hear «%s»%s' % (q['text'], (' (it wrote «%s»)' % ' '.join(near))
                                                                     if near else ''))
        table.append(row)
    void_controls = []
    for p in pairs:
        if p.get('error'):
            continue
        ctl_all = p.get('controls') or []
        # A control counts only if it reads wrong by this same measure (its own margin under 0). A control that scores
        # on the right side did not take the wrong vowel (Eleven v4 often says the known form whatever is written), or
        # Whisper cannot hear this vowel here: either way it cannot judge the take, and a new take would not settle it
        # (the wisdom dry run of 11-12: two controls at +9.3 and +6.8 failed a take that measured right).
        ctl = [c for c in ctl_all if c['context'] < 0] or None
        void = [c for c in ctl_all if c['context'] >= 0]
        if void:
            p['void_controls'] = [c['file'] for c in void]
        if not ctl and void:
            p['verdict'] = 'unclear: the control came out right (%+.2f), so it cannot judge' % max(c['context'] for c in void)
            void_controls.append('«%s» (%s)' % (p['wrong'], ', '.join(c['file'] for c in void)))
        elif ctl:
            c_ctx, c_alone = max(c['context'] for c in ctl), max(c['alone'] for c in ctl)
            p['vs_control'] = [round(p['context'] - c_ctx, 2), round(p['alone'] - c_alone, 2)]
            if p['context'] - c_ctx < NEAR or p['alone'] - c_alone < NEAR or p['context'] < 0:
                p['verdict'] = 'READS LIKE THE WRONG CONTROL'
            elif p['context'] - c_ctx >= CLEAR and p['alone'] - c_alone >= CLEAR:
                p['verdict'] = 'clear of the control'
            else:
                p['verdict'] = 'unclear'
        else:
            if p['context'] < 0:
                p['verdict'] = 'LEANS WRONG'
            elif p['context'] >= RIGHT_MIN and p['alone'] >= 0:
                p['verdict'] = 'leans right (no control)'
            else:
                p['verdict'] = 'unclear'
        line = '«%s» against «%s»: %s' % (p['right'], p['wrong'], p['verdict'])
        if p['verdict'] == 'READS LIKE THE WRONG CONTROL' or (p['verdict'] == 'LEANS WRONG' and p['from'] == 'named'):
            problems.append(line)
        elif p['verdict'] != 'clear of the control' and (p['from'] == 'named' or p['verdict'].startswith('unclear: the control')):
            unclear.append(line)
        elif p['verdict'] in ('unclear', 'LEANS WRONG') and p['from'] == 'auto':
            unclear.append(line + ' (a mechanical pair with no control: listen to that word, or name it with --pair '
                                  'and make a control)')
        shown = ctl or ctl_all
        table[p['k']].setdefault('choice', []).append('%s %+.2f / %+.2f%s → %s' % (
            p['wrong'], p['context'], p['alone'],
            (' (control %+.2f / %+.2f)' % (max(c['context'] for c in shown), max(c['alone'] for c in shown))) if shown
            else '', p['verdict']))
    named_without_control = [p for p in pairs if p['from'] == 'named' and not p.get('controls') and not p.get('error')]
    result = {
        'mode': 'quoted text checked word by word',
        'take': take.name, 'text': src, 'words_from': rows_src, 'quoted_words': len(quote),
        'engine': 'faster-whisper %s, model %s, %s' % (av.FW_VERSION, a.model,
                                                      'GPU (CUDA float16)' if device == 'cuda' else 'CPU (int8)'),
        'seconds_taken': secs,
        'words': ['%-14s %6s  text: %-22s whisper: %-26s%s' % (
            r['word'], ('%.2f' % r['at_s']) if 'at_s' in r else '-', r['text'], r['whisper'],
            ('  choice: ' + ' | '.join(r['choice'])) if r.get('choice') else '') for r in table],
        'pairs': len(pairs), 'controls': controls,
    }
    if note and device != 'cuda':
        result['gpu'] = note
    if not marks_known:
        result['note'] = ('The take\'s word timings carry no harakat, so check 1 compares the letters only: check the '
                          'marks in the text you sent (plan/vo/*.txt) against the source yourself.')
    if not pairs:
        result['pairs_hint'] = ('No forced choice was run. For each word whose vowel changes its meaning, add --pair '
                                'RIGHT/WRONG (e.g. "أَحْيَانَا/أَحْيَانًا"), or --auto-pairs for the mechanical ones.')
    if named_without_control:
        p = named_without_control[0]
        result['control_how'] = (
            'A margin needs a negative control to mean anything. Make one on purpose (paid, a few credits: ask the user '
            'first): the same voice, model, settings and seed, generating only «%s» (the wrong vowel on purpose), e.g. '
            'gen_tts_elevenlabs.py generate --allow-paid-request --voice-id <id> --seed <same> --text-file '
            'plan/vo/control-wrong.txt --output "assets/vo/control/wrong.mp3"; then run this again with --control '
            '"assets/vo/control/wrong.mp3". The control never goes into the video.'
            % control_text(quote, p['k'], p['wrong']))
    if void_controls:
        result['void_controls'] = (
            'These controls came out right, not wrong (their own margin is positive), so they judge nothing: %s. The voice '
            'said the known form whatever was written, or Whisper cannot hear this vowel here. Do not pay for a new take '
            'for this word, and do not make the same control again: the user\'s ear decides it.' % '; '.join(void_controls))
    if problems:
        result['verdict'] = 'FAILED: ' + '; '.join(problems)
        result['say'] = ('الفحص لقى مشكلة في النص المقتبس (%s). نولّد السرد كامل من جديد، ما نرقّعه، ونفحصه مرة ثانية. '
                         'وبعدها أذنك هي الحكم الأخير.' % problems[0])
    elif unclear or named_without_control:
        result['verdict'] = 'NOT CLEARED BY THE CHECKS: ' + '; '.join(unclear or ['no negative control'])
        result['say'] = ('الكلمات كلها موجودة وانسمعت، بس الحركة في %s ما انحسمت بالفحص. اسمعها أنت كلمة كلمة، '
                         'وأذنك هي الحكم الأخير.' % ('، '.join('«%s»' % p['right'] for p in pairs
                                                            if p.get('verdict') != 'clear of the control'
                                                            and p['from'] == 'named') or 'الكلمات المختارة'))
    else:
        result['verdict'] = 'no fault found by the checks'
        result['say'] = ('الفحص ما لقى خطأ: النص نفسه، وكل كلمة انسمعت%s. بس هذا ما يكفي: اسمع النص المقتبس كلمة كلمة، '
                         'وأذنك هي الحكم الأخير.' % ('، والحركات المختبرة واضحة' if pairs else ''))
    result['last_word'] = 'Only the user\'s ear clears it: play the quoted lines to the user and ask them to listen word ' \
                          'by word before anything is published.'
    if a.out:
        out = Path(a.out).expanduser()
        if out.exists() and not a.overwrite:
            raise QuoteError('%s already exists: give a new name, or add --overwrite.' % out.name)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({'result': result, 'table': table, 'pairs': pairs, 'heard': heard,
                                   'created_utc': datetime.now(timezone.utc).isoformat()},
                                  ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        result['report'] = str(out)
    return result, bool(problems)


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('take', help='the narration take (mp3, wav, ...), as generated or after tighten')
    p.add_argument('--text', required=True, help='the source text exactly as copied (a UTF-8 file, or the text)')
    p.add_argument('--words', help='the take\'s .words.json (default: beside the take; else Whisper\'s own words)')
    p.add_argument('--pair', action='append', metavar='RIGHT/WRONG',
                   help='a word whose vowel changes its meaning, e.g. "أَحْيَانَا/أَحْيَانًا" (repeat)')
    p.add_argument('--auto-pairs', action='store_true', help='also the mechanical pairs (a final ـَا against ـًا, '
                                                             'tanween against one vowel)')
    p.add_argument('--control', action='append', help='a negative control: the words generated on purpose with the '
                                                       'wrong vowel (repeat)')
    p.add_argument('--control-words', action='append', help='its .words.json (default: beside it)')
    p.add_argument('--model', choices=sorted(av.MODELS), default='turbo')
    p.add_argument('--device', choices=('auto', 'cuda', 'cpu'), default=av.DEVICE)
    p.add_argument('--threads', type=int, default=2, help='CPU threads when there is no GPU (default 2: less memory)')
    p.add_argument('--out', help='also write everything as JSON')
    p.add_argument('--overwrite', action='store_true')
    a = p.parse_args(argv)
    if not av.fw_importable() and not av.in_private_env():
        reexec_in_env(argv)
    result, failed = run(a)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (QuoteError, av.AlignError) as e:
        print('ERROR: ' + str(e), file=sys.stderr)
        sys.exit(2)
    except KeyboardInterrupt:
        print('ERROR: interrupted.', file=sys.stderr)
        sys.exit(2)
