#!/usr/bin/env python3
"""ElevenLabs narration helper for Khaam Motion - Eleven v4 only.

Subcommands (no subcommand = offline plan):
  plan      offline check of one narration chunk (or a voice-design brief)  no network
  account   plan tier, credits left, reset date, voice slots used/free  free GET
  models    list the Eleven v4 models offered to this account     free GET
  voices    search the account's voices by name/label             free GET
  design    Voice Design: 3 previews of a new voice from a description   paid: --allow-paid-request
  save      keep one designed preview as a voice (takes one voice slot)  --allow-voice-slot
  clone     local sample check; creates an Instant Voice Clone only with
            --allow-voice-clone --confirm-rights-and-consent
  generate  one text-to-speech request with word timings          paid: --allow-paid-request
  dialogue  one Text to Dialogue request (interviews)             paid: --allow-paid-request

Voice routes, the user chooses (reference/voiceover.md section 10.0): a recorded voice (his own recording, or a
recording he has the right to use, used as recorded: scripts/align_voice.py, then voice_edit.py tighten); his own
voice made in ElevenLabs from his recording (clone -> generate); or a voice designed for him (design -> save ->
generate on Eleven v4). A shared library voice is used only when the user names it (generate/dialogue refuse a
voice the account does not own unless --library-voice-named-by-user).

The API key comes from the ELEVENLABS_API_KEY environment variable or, if that is unset, from
~/.cache/khaam-motion/elevenlabs-key.txt (scripts/key_setup.py). It is never printed, logged or written. Only eleven_v4 (delivered takes) and eleven_v4_turbo (short
previews) are ever sent; eleven_v3 and older models are refused. One invocation sends at
most one paid or account-changing request. No automatic retries. Existing files are never
overwritten. See reference/voiceover.md section 10.
"""
import argparse
import base64
import hashlib
import json
import math
import os
import re
import string
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from khaam_paths import executable as _configured_executable
except Exception:  # keep the helper usable if config resolution is unavailable
    _configured_executable = None

for _stream in (sys.stdout, sys.stderr):  # Windows consoles: print Arabic/IPA safely
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

API = 'https://api.elevenlabs.io'
MODELS = {'v4': 'eleven_v4', 'v4-turbo': 'eleven_v4_turbo'}
MODEL_ID_RE = re.compile(r'^eleven_v4[a-z0-9_]*$')
DOC_LIMIT = {'eleven_v4': 10000}          # documented characters per request
FORMATS = ('mp3_44100_192', 'mp3_44100_128', 'wav_48000', 'wav_44100')
MAX_RESPONSE = 100 * 1024 * 1024
DIALOGUE_MAX_CHARS = 2000
DIALOGUE_MAX_VOICES = 10
STEADY_CHARS = 900                        # troubleshooting guide: steadier accent below ~800-900
WPS = 2.45                                # English narration estimate only
GULF_WPS = 2.4                            # Arabic (Gulf) on v4, reference/voiceover.md 10.5
GULF_PAUSE = {'comma': 0.2, 'stop': 0.35, 'ellipsis': 0.5}   # seconds added per mark (same section)
POLICY = ('eleven_v4 for every delivered take; eleven_v4_turbo only for short previews; '
          'eleven_v3, Multilingual v2, Flash and Turbo v2/v2.5 are never used')
KNOWN_TAGS = {
    'excited', 'playful', 'amazed', 'proud', 'startled', 'mad', 'bitter', 'anxious', 'scared',
    'confused', 'tired', 'bored', 'despair', 'peaceful', 'curious', 'thoughtful', 'trusting',
    'whispers', 'whispering', 'shouts', 'shouting', 'softly', 'quietly', 'hushed', 'low',
    'booming', 'threatening', 'disbelief', 'slowly', 'rushed', 'snappy', 'speedy', 'pause',
    'laughs', 'laughing', 'sighs', 'gasps', 'crying', 'gulp', 'warmly', 'sarcastic', 'surprised',
    'dramatically', 'impressed', 'sad', 'calm', 'serious', 'cheerfully', 'nervous', 'happy',
    'angry', 'giggles', 'exhales', 'chuckles', 'sincere', 'confident', 'reassuring', 'gently',
}
SFX_TAG_RE = re.compile(r'\b(applause|clapping|thunder\w*|footsteps|doors?\b.*|dog barking|owl\w*|zipper\w*|'
                        r'gunshots?|explosions?|rain|phone buzzing|wind|music)\b', re.I)
TAG_RE = re.compile(r'\[([^\[\]\n]{1,120})\]')
SSML_RE = re.compile(r'<\s*/?\s*(break|phoneme|prosody|speak|emphasis|say-as|sub|lang)\b', re.I)
IPA_RE = re.compile(r'(?<![\w/])/[^/\s][^/\n]{0,60}/(?![\w/])')
DIGIT_RE = re.compile(r'[0-9٠-٩۰-۹]')
ARABIC_RE = re.compile(r'[؀-ۿ]')
ID_RE = re.compile(r'^[A-Za-z0-9_-]{6,100}$')
PUNCT = string.punctuation + '…—–«»“”‘’،؛؟٪'
# Invisible characters from a web copy (direction marks, zero-width joiners, the BOM ...; the same set as
# cues.INVISIBLE_RE): sent as they are, but not part of any word in the timings, and not a difference between two
# texts. A token of only them and punctuation is no word (the wisdom rerun, 2026-11-12).
INVISIBLE_RE = re.compile('[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]')
# Voice Design (POST /v1/text-to-voice/design, checked on elevenlabs.io/docs 2026-11-11): two designer models;
# 3 previews per call; billed by the preview text's characters (ElevenLabs publishes no rate; measured 2026-11-11
# on a Creator plan: 3 previews of a 175-character text = 175 credits). Its API reference lists no response
# headers, and in that run the design response carried no character-cost or request-id: design.json then
# records an estimate (the preview text's characters) and the account shows the charge a few minutes later.
DESIGN_MODELS = {'ttv-v2': 'eleven_multilingual_ttv_v2', 'ttv-v3': 'eleven_ttv_v3'}
DESIGN_TEXT_MIN, DESIGN_TEXT_MAX = 100, 1000
DESIGN_DESC_MIN, DESIGN_DESC_MAX = 20, 1000
OWN_CATEGORIES = ('generated', 'cloned')


class HelperError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # never forward the key to another host


# ---------------------------------------------------------------- text checks
def analyse(text):
    tags = [t.strip() for t in TAG_RE.findall(text)]
    spoken = TAG_RE.sub(' ', text)
    words = [w for w in spoken.split() if any(c.isalnum() for c in w)]
    warnings = []
    if SSML_RE.search(text):
        warnings.append('SSML/XML tags found: Eleven v4 does not support SSML (incl. <break>). '
                        'Use line breaks, ..., dashes, [pause] or [long pause].')
    if text.count('[') != text.count(']'):
        warnings.append('Unbalanced square brackets: a broken tag may be read aloud.')
    if DIGIT_RE.search(IPA_RE.sub(' ', spoken)):
        warnings.append('Digits found: write numbers, prices, dates and units as spoken words.')
    if len(text) > STEADY_CHARS:
        warnings.append('Over ~%d characters: split at a scene/paragraph break for steadier accent '
                        'and cheaper retakes.' % STEADY_CHARS)
    if 0 < len(words) < 8:
        warnings.append('Very short text: v4 performs better with context; send the full sentence or scene.')
    sfx = [t for t in tags if SFX_TAG_RE.search(t)]
    if sfx:
        warnings.append('Sound-effect style tags in narration (%s): produce SFX separately.' % ', '.join(sfx))
    unknown = sorted({t for t in tags if ' ' not in t and ',' not in t and t.lower() not in KNOWN_TAGS})
    if unknown:
        warnings.append('One-word tags not in the v4 tag list (%s): test them or describe the voice, '
                        'e.g. [low, gravelly voice].' % ', '.join(unknown))
    caps = re.findall(r'\b[A-Z]{3,}\b', spoken)
    if len(caps) > 3:
        warnings.append('Many CAPS words (%d): keep emphasis to about one word per section.' % len(caps))
    out = {
        'characters': len(text),
        'words': len(words),
        'tags': tags,
        'arabic_text': bool(ARABIC_RE.search(text)),
        'estimated_seconds_at_english_rate': round(len(words) / WPS, 1) if words else 0,
        'warnings': warnings,
    }
    out.update(estimate_seconds(spoken, len(words)))
    return out


def estimate_seconds(spoken, n_words):
    """Narration length before any take. Mostly Arabic text: voiceover.md 10.5 (Gulf on v4, ~2.4 words a second
    plus 0.2 s a comma, 0.35 s a full stop or question mark, 0.5 s a «…»). Other text: the English rate."""
    if not n_words:
        return {'estimated_seconds': 0}
    if len(ARABIC_RE.findall(spoken)) <= len(re.findall(r'[A-Za-z]', spoken)):
        return {'estimated_seconds': round(n_words / WPS, 1),
                'estimate_basis': 'English rate, %.2f words a second (voiceover.md 10a); measure the real take' % WPS}
    ellipses = spoken.count('…') + len(re.findall(r'\.{2,}', spoken))
    rest = re.sub(r'\.{2,}', ' ', spoken.replace('…', ' '))
    commas = rest.count('،') + rest.count(',')
    stops = len(re.findall(r'[.?؟]', rest))
    secs = n_words / GULF_WPS + commas * GULF_PAUSE['comma'] + stops * GULF_PAUSE['stop'] + ellipses * GULF_PAUSE['ellipsis']
    return {'estimated_seconds': round(secs, 1),
            'estimate_basis': ('Gulf Arabic on v4: %d words at %.1f a second + %d commas x %.2f s + %d stops x %.2f s + '
                               '%d «…» x %.1f s (voiceover.md 10.5); measure the real take'
                               % (n_words, GULF_WPS, commas, GULF_PAUSE['comma'], stops, GULF_PAUSE['stop'],
                                  ellipses, GULF_PAUSE['ellipsis']))}


def read_text(a, required=True):
    text = None
    if getattr(a, 'text_file', None):
        p = Path(a.text_file).expanduser()
        if not p.is_file():
            raise HelperError('Text file not found: %s' % p)
        text = p.read_text(encoding='utf-8-sig')
    elif getattr(a, 'text', None):
        text = a.text
    if text is not None:
        text = text.replace('\r\n', '\n').strip()
        if not text:
            raise HelperError('Text is empty.')
    elif required:
        raise HelperError('Provide --text-file (UTF-8, preferred) or --text.')
    return text


def choose_model(a):
    model_id = getattr(a, 'model_id', None)
    if model_id:
        if not MODEL_ID_RE.match(model_id):
            raise HelperError('Only Eleven v4 model IDs are allowed (eleven_v4, eleven_v4_turbo). Refused: %s' % model_id)
        return model_id
    return MODELS[getattr(a, 'model', None) or 'v4']


def check_unit(name, value):
    if value is None:
        return
    if not (math.isfinite(value) and 0.0 <= value <= 1.0):
        raise HelperError('%s must be between 0 and 1.' % name)


def check_common(a):
    check_unit('--stability', getattr(a, 'stability', None))
    check_unit('--similarity', getattr(a, 'similarity', None))
    seed = getattr(a, 'seed', None)
    if seed is not None and not 0 <= seed <= 4294967295:
        raise HelperError('--seed must be an integer between 0 and 4294967295.')
    lang = getattr(a, 'language_code', None)
    if lang and not re.fullmatch(r'[a-z]{2,3}', lang):
        raise HelperError('--language-code must be an ISO 639 code such as ar or en.')
    ids = getattr(a, 'previous_request_id', None) or []
    if len(ids) > 3:
        raise HelperError('At most 3 --previous-request-id values are accepted.')
    for rid in ids:
        if not ID_RE.match(rid):
            raise HelperError('Invalid request id: %s' % rid)


def output_path(path, fmt):
    p = Path(path).expanduser().resolve()
    ext = '.mp3' if fmt.startswith('mp3') else '.wav'
    if p.suffix.lower() != ext:
        raise HelperError('Output for %s must end with %s.' % (fmt, ext))
    return p


def companions(out, extras=()):
    stem = out.with_suffix('').name
    return [out.with_name(out.name + '.json'), out.with_name(stem + '.words.json')] + \
           [out.with_name(stem + e) for e in extras]


# ---------------------------------------------------------------- network
def key_present():
    from khaam_paths import elevenlabs_key
    return bool(elevenlabs_key()[0])


def api_key():
    from khaam_paths import elevenlabs_key
    k, source = elevenlabs_key()
    if not k:
        hint = ' The key file has more than one line or a broken key; run key_setup.py again.' if source in ('file-invalid', 'environment-invalid') else ''
        raise HelperError('No ElevenLabs key found. The user says «اضبط مفتاح ElevenLabs» and Claude runs '
                          'scripts/key_setup.py (a small file opens in Notepad/TextEdit; paste, save, close). '
                          'No restart needed. Never paste keys into chat or command arguments.' + hint)
    return k


def _scrub(text, k):
    text = ' '.join(str(text).split())
    if k:
        text = text.replace(k, '***')
    return text[:600]


def request(method, path, k, body=None, content_type=None, query=None):
    url = API + path + ('?' + urllib.parse.urlencode(query) if query else '')
    headers = {'xi-api-key': k, 'Accept': 'application/json'}
    if content_type:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    opener = urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(req, timeout=300) as r:
            raw = r.read(MAX_RESPONSE + 1)
            meta = {'request_id': r.headers.get('request-id'), 'character_cost': r.headers.get('character-cost'),
                    'trace_id': r.headers.get('x-trace-id')}
    except urllib.error.HTTPError as e:
        try:
            detail = e.read(4000).decode('utf-8', 'replace')
        except Exception:
            detail = ''
        raise HelperError('ElevenLabs returned HTTP %s. %s No automatic retry.' % (e.code, _scrub(detail, k))) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise HelperError('Network request failed or timed out. For a paid call the billing state may be '
                          'unknown: check the ElevenLabs history before retrying. No automatic retry.') from None
    if len(raw) > MAX_RESPONSE:
        raise HelperError('Response exceeded the size limit; refused.')
    try:
        return json.loads(raw.decode('utf-8')), meta
    except ValueError:
        raise HelperError('ElevenLabs response was not valid JSON.') from None


def resolve_model(k, model_id, text_len=None):
    data, _ = request('GET', '/v1/models', k)
    models = data if isinstance(data, list) else []
    found = next((m for m in models if isinstance(m, dict) and m.get('model_id') == model_id), None)
    if not found:
        offered = [str(m.get('model_id')) for m in models if isinstance(m, dict)
                   and str(m.get('model_id', '')).startswith('eleven_v4')]
        raise HelperError('%s is not offered to this account (Eleven v4 models offered: %s). Nothing was '
                          'generated; older models are never used as a fallback.' % (model_id, ', '.join(offered) or 'none'))
    if found.get('can_do_text_to_speech') is False:
        raise HelperError('%s cannot do HTTP text-to-speech on this account. For a preview use eleven_v4 '
                          'on a short excerpt.' % model_id)
    limit = found.get('maximum_text_length_per_request') or DOC_LIMIT.get(model_id)
    if text_len and limit and text_len > limit:
        raise HelperError('Text has %d characters; %s accepts %d per request. Split it.' % (text_len, model_id, limit))
    return found


# ---------------------------------------------------------------- files
def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_file(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def reserve(paths):
    for p in paths:
        if p.exists():
            raise HelperError('Refusing to overwrite existing file: %s' % p.name)
    made = []
    try:
        for p in paths:
            p.parent.mkdir(parents=True, exist_ok=True)
            with p.open('xb'):
                pass
            made.append(p)
    except OSError:
        release(made)
        raise HelperError('Cannot create the output files; check the folder and names.') from None
    return made


def release(paths):
    for p in paths:  # remove only empty placeholders created by this run
        try:
            if p.exists() and p.stat().st_size == 0:
                p.unlink()
        except OSError:
            pass


def valid_audio(b, fmt):
    if fmt.startswith('mp3'):
        return b[:3] == b'ID3' or (len(b) > 1 and b[0] == 0xFF and (b[1] & 0xE0) == 0xE0)
    return len(b) > 44 and b[:4] == b'RIFF' and b[8:12] == b'WAVE'


def words_from_alignment(al):
    if not isinstance(al, dict):
        return None
    chars = al.get('characters') or []
    starts = al.get('character_start_times_seconds') or []
    ends = al.get('character_end_times_seconds') or []
    if not chars or not (len(chars) == len(starts) == len(ends)):
        return None
    out, buf, span, depth = [], [], [None, None], 0

    def flush():
        raw = ''.join(buf).strip()
        if INVISIBLE_RE.search(raw):
            raw = INVISIBLE_RE.sub('', raw).strip()
        clean = raw.strip(PUNCT)
        if clean and span[0] is not None:
            out.append({'word': clean, 'raw': raw, 'start': round(float(span[0]), 3), 'end': round(float(span[1]), 3)})
        del buf[:]
        span[0] = span[1] = None

    for ch, s, e in zip(chars, starts, ends):
        if ch == '[':
            flush()
            depth += 1
            continue
        if ch == ']' and depth:
            depth -= 1
            continue
        if depth:
            continue
        if ch.isspace():
            flush()
            continue
        if span[0] is None:
            span[0] = s
        span[1] = e
        buf.append(ch)
    flush()
    return out


def finish(data, meta, out, reserved, fmt, record, segments_path=None):
    try:
        audio = base64.b64decode(re.sub(r'\s+', '', str(data.get('audio_base64') or '')), validate=True)
    except (ValueError, TypeError):
        audio = b''
    if not audio or not valid_audio(audio, fmt):
        raise HelperError('Response audio was empty or not a valid %s file. The request may still be billed: '
                          'check the ElevenLabs history. No automatic retry.' % fmt)
    out.write_bytes(audio)  # from here on keep the audio even if a sidecar fails: never pay twice
    words = words_from_alignment(data.get('alignment')) or words_from_alignment(data.get('normalized_alignment'))
    sidecar, words_path = reserved[1], reserved[2]
    if words:
        words_path.write_text(json.dumps({'source': 'ElevenLabs alignment, audio tags removed', 'words': words},
                                         ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if segments_path is not None and data.get('voice_segments') is not None:
        segments_path.write_text(json.dumps(data.get('voice_segments'), ensure_ascii=False, indent=1) + '\n',
                                 encoding='utf-8')
    record.update({
        'request_id': meta.get('request_id'),
        'reported_character_cost': meta.get('character_cost'),
        'output_format': fmt,
        'audio_file': out.name,
        'audio_bytes': len(audio),
        'audio_sha256': sha256_bytes(audio),
        'words_file': words_path.name if words else None,
        'alignment_available': bool(words),
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'review_status': 'unreviewed take: listen in full (no spoken tags, pronunciation, seams, clipping) before approval',
        'rights': ("Check current ElevenLabs plan terms for commercial use; an AI voice is posted with the platform's "
                   "AI label; clones need the speaker's consent."),
    })
    sidecar.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    release(reserved)
    return audio, words


# ---------------------------------------------------------------- local audio probe
def _tool(name):
    try:
        found = _configured_executable(name) if _configured_executable else None
    except Exception:
        found = None
    if not found:
        import shutil
        found = shutil.which(name)
    return found


def probe(path):
    info = {'file': path.name, 'bytes': path.stat().st_size, 'sha256': sha256_file(path)}
    ffprobe, ffmpeg = _tool('ffprobe'), _tool('ffmpeg')
    try:
        if ffprobe:
            r = subprocess.run([ffprobe, '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                'format=duration,bit_rate:stream=codec_name,channels,sample_rate',
                                '-of', 'json', str(path)], capture_output=True, text=True, timeout=60)
            j = json.loads(r.stdout or '{}')
            fmt, streams = j.get('format') or {}, j.get('streams') or [{}]
            info['duration_s'] = round(float(fmt['duration']), 2) if fmt.get('duration') else None
            info['bit_rate_kbps'] = round(int(fmt['bit_rate']) / 1000) if fmt.get('bit_rate') else None
            info['codec'] = streams[0].get('codec_name')
            info['channels'] = streams[0].get('channels')
            info['sample_rate'] = streams[0].get('sample_rate')
        if ffmpeg:
            r = subprocess.run([ffmpeg, '-hide_banner', '-nostats', '-i', str(path), '-af', 'astats',
                                '-f', 'null', '-'], capture_output=True, text=True, timeout=180)
            rms = re.findall(r'RMS level dB:\s*(-?inf|-?\d+(?:\.\d+)?)', r.stderr)
            if rms:
                info['rms_db'] = rms[-1]
            r = subprocess.run([ffmpeg, '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true',
                                '-f', 'null', '-'], capture_output=True, text=True, timeout=180)
            tp = re.findall(r'True peak:\s*\n\s*Peak:\s*(-?inf|-?\d+(?:\.\d+)?)', r.stderr)
            if tp:
                info['true_peak_dbfs'] = tp[-1]
    except (OSError, ValueError, subprocess.TimeoutExpired):
        info['probe_note'] = 'FFmpeg probe incomplete; check the sample by ear.'
    return info


def sample_warnings(checks):
    warn = []
    total = sum(c.get('duration_s') or 0 for c in checks)
    if any(c.get('duration_s') is None for c in checks):
        warn.append('Duration unknown for at least one file (ffprobe unavailable?).')
    elif total < 10:
        warn.append('Under 10 s total: too short for a usable clone.')
    elif total < 60:
        warn.append('Under the recommended 1-2 minutes of clean audio.')
    elif total > 180:
        warn.append('Over ~3 minutes: ElevenLabs advises against more for Instant Voice Clones.')
    for c in checks:
        if c.get('codec') == 'mp3' and c.get('bit_rate_kbps') and c['bit_rate_kbps'] < 128:
            warn.append('%s: MP3 under 128 kbps (192 kbps preferred).' % c['file'])
        try:
            rms = float(c.get('rms_db')) if c.get('rms_db') not in (None, '-inf', 'inf') else None
            tp = float(c.get('true_peak_dbfs')) if c.get('true_peak_dbfs') not in (None, '-inf', 'inf') else None
        except ValueError:
            rms = tp = None
        if rms is not None and not -23.5 <= rms <= -17.5:
            warn.append('%s: RMS %.1f dB, outside the recommended -23 to -18 dB.' % (c['file'], rms))
        if tp is not None and tp > -3.0:
            warn.append('%s: true peak %.1f dBFS, above the recommended -3 dB.' % (c['file'], tp))
    warn.append('Listen for: one speaker only, no music/reverb/background noise, consistent tone and an '
                'energy that matches the target read. v4 reproduces recording flaws.')
    return warn, round(total, 2)


def multipart(fields, files, files_field):
    boundary = '----khaam' + uuid.uuid4().hex
    parts = []
    for name, value in fields:
        parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n' % (boundary, name)).encode('utf-8')
                     + value.encode('utf-8') + b'\r\n')
    for path in files:
        ctype = {'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
                 '.ogg': 'audio/ogg'}.get(path.suffix.lower(), 'application/octet-stream')
        fname = re.sub(r'["\r\n]', '_', path.name)
        parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\nContent-Type: %s\r\n\r\n'
                      % (boundary, files_field, fname, ctype)).encode('utf-8') + path.read_bytes() + b'\r\n')
    parts.append(('--%s--\r\n' % boundary).encode('utf-8'))
    return b''.join(parts), 'multipart/form-data; boundary=' + boundary


# ---------------------------------------------------------------- commands
def cmd_plan(a):
    text = read_text(a, required=False)
    model_id = choose_model(a)
    out = {
        'mode': 'offline plan (no network, nothing sent)',
        'model_policy': POLICY,
        'model_id': model_id,
        'purpose': 'production' if model_id == 'eleven_v4' else 'preview only',
        'voice_id': getattr(a, 'voice_id', None),
        'key_configured': key_present(),
        'settings_on_v4': 'Stability and Similarity only (Style, Speed and SSML do not exist on v4)',
        'paid_request_sent': False,
        'voice_policy': ('the user chooses: a recorded voice (his own, or a recording he has the right to use, named; '
                         'align_voice.py, used as recorded), his own voice made from his recording (clone -> generate), '
                         'or a voice designed for him (design -> save -> generate, posted with the AI label); a shared '
                         'library voice only when the user names it'),
    }
    if getattr(a, 'description', None) or getattr(a, 'description_file', None):
        out['voice_design'] = design_plan(read_description(a), text, DESIGN_MODELS[a.designer])
    if text is not None:
        out['text'] = analyse(text)
        limit = DOC_LIMIT.get(model_id)
        if limit and len(text) > limit:
            out['text']['warnings'].insert(0, 'Over the documented %d-character limit for %s: split it.' % (limit, model_id))
    out['before_generate'] = 'User approves model, voice, characters per chunk and total, takes per chunk and credit budget.'
    return out


def cmd_models(a):
    data, _ = request('GET', '/v1/models', api_key())
    rows = []
    for m in data if isinstance(data, list) else []:
        mid = str(m.get('model_id', ''))
        if mid.startswith('eleven_v4'):
            rows.append({'model_id': mid, 'name': m.get('name'),
                         'can_do_text_to_speech': m.get('can_do_text_to_speech'),
                         'maximum_text_length_per_request': m.get('maximum_text_length_per_request'),
                         'arabic': any((l or {}).get('language_id') == 'ar' for l in m.get('languages') or [])})
    return {'mode': 'models (free GET)', 'eleven_v4_models': rows, 'model_policy': POLICY}


def cmd_voices(a):
    query = {'page_size': str(min(max(a.limit, 1), 100))}
    for key_name, value in (('search', a.search), ('voice_type', a.voice_type), ('category', a.category)):
        if value:
            query[key_name] = value
    data, _ = request('GET', '/v2/voices', api_key(), query=query)
    if not isinstance(data, dict):
        raise HelperError('Unexpected voices response.')
    voices = [{'voice_id': v.get('voice_id'), 'name': v.get('name'), 'category': v.get('category'),
               'labels': v.get('labels')} for v in (data.get('voices') or []) if isinstance(v, dict)]
    return {'mode': 'voices (free GET)', 'count': len(voices), 'has_more': data.get('has_more'), 'voices': voices}


def account_info(k):
    data, _ = request('GET', '/v1/user/subscription', k)
    if not isinstance(data, dict):
        raise HelperError('Unexpected subscription response.')
    used, limit = data.get('character_count'), data.get('character_limit')
    slots_used, slots = data.get('voice_slots_used'), data.get('voice_limit')
    reset = data.get('next_character_count_reset_unix')
    return {
        'tier': data.get('tier'),
        'credits_used': used, 'credits_limit': limit,
        'credits_left': (limit - used) if isinstance(used, int) and isinstance(limit, int) else None,
        'credits_reset_utc': datetime.fromtimestamp(reset, timezone.utc).isoformat() if isinstance(reset, int) else None,
        'voice_slots_used': slots_used, 'voice_slots': slots,
        'voice_slots_free': (slots - slots_used) if isinstance(slots, int) and isinstance(slots_used, int) else None,
    }


def cmd_account(a):
    return {'mode': 'account (free GET)', **account_info(api_key())}


def voice_owned(k, voice_id):
    """(owned, info) for a voice id: designed or cloned voices are the user's own; library voices are not."""
    data, _ = request('GET', '/v1/voices/%s' % urllib.parse.quote(voice_id, safe=''), k)
    if not isinstance(data, dict):
        raise HelperError('Unexpected voice response.')
    cat = data.get('category')
    owned = cat in OWN_CATEGORIES or (cat == 'professional' and data.get('is_owner') is True)
    return owned, {'voice_id': voice_id, 'name': data.get('name'), 'category': cat}


def check_voice_policy(k, voice_ids, named_by_user):
    infos = []
    for vid in dict.fromkeys(voice_ids):
        owned, info = voice_owned(k, vid)
        info['own_voice'] = owned
        infos.append(info)
        if not owned and not named_by_user:
            raise HelperError('Voice %s (%s) is a shared library voice, not one designed or cloned for this user. '
                              'Design a voice first (design, then save) or make the user\'s own from a recording '
                              '(clone), or, only when the user named this library voice, pass '
                              '--library-voice-named-by-user. Nothing was generated.'
                              % (info.get('name') or vid, info.get('category')))
    return infos


def read_description(a):
    text = None
    if getattr(a, 'description_file', None):
        p = Path(a.description_file).expanduser()
        if not p.is_file():
            raise HelperError('Description file not found: %s' % p)
        text = p.read_text(encoding='utf-8-sig')
    elif getattr(a, 'description', None):
        text = a.description
    text = ' '.join((text or '').split())
    if not DESIGN_DESC_MIN <= len(text) <= DESIGN_DESC_MAX:
        raise HelperError('The voice description must be %d-%d characters (it has %d).'
                          % (DESIGN_DESC_MIN, DESIGN_DESC_MAX, len(text)))
    return text


def design_plan(desc, preview, model_id):
    warn = []
    if preview is not None and not DESIGN_TEXT_MIN <= len(preview) <= DESIGN_TEXT_MAX:
        warn.append('Preview text must be %d-%d characters (it has %d).' % (DESIGN_TEXT_MIN, DESIGN_TEXT_MAX, len(preview)))
    if preview is not None and len(preview) < 150:
        warn.append('Longer previews (150-300 characters) give steadier voices.')
    if re.search(r'\b(reverb|echo|phone|tape|radio)\b', desc, re.I):
        warn.append('Sound-effect words in the description (reverb, echo, phone, tape) colour the voice itself: remove them.')
    if not re.search(r'\b(native|arabic|english|gulf|saudi|emirati|kuwaiti|egyptian|levantine)\b', desc, re.I):
        warn.append('Name the language and dialect in the first sentence (e.g. "Native Arabic, Saudi Najdi accent.").')
    return {
        'designer_model': model_id,
        'description_characters': len(desc),
        'preview_characters': len(preview) if preview is not None else 'auto-generated by ElevenLabs',
        'estimated_credits': ('about %d (ElevenLabs bills the preview text once for the 3 voices; measured 2026-11-11 '
                              'on a Creator plan: one credit a preview character)' % len(preview)) if preview is not None else
                             'about 100-300 (auto preview text length is chosen by ElevenLabs)',
        'warnings': warn,
    }


def cmd_design(a):
    desc = read_description(a)
    preview = read_text(a, required=False)
    model_id = DESIGN_MODELS[a.designer]
    plan = design_plan(desc, preview, model_id)
    if preview is not None and not DESIGN_TEXT_MIN <= len(preview) <= DESIGN_TEXT_MAX:
        raise HelperError(plan['warnings'][0])
    if preview is None and not a.auto_text:
        raise HelperError('Give the preview text (--text-file, 100-1000 characters, in the voice\'s dialect) or --auto-text.')
    for name, value, lo, hi in (('--loudness', a.loudness, -1.0, 1.0), ('--guidance', a.guidance, 0.0, 100.0)):
        if not (math.isfinite(value) and lo <= value <= hi):
            raise HelperError('%s must be between %s and %s.' % (name, lo, hi))
    out_dir = Path(a.output_dir).expanduser().resolve()
    files = [out_dir / ('preview %d.mp3' % i) for i in (1, 2, 3)] + [out_dir / 'design.json']
    for p in files:
        if p.exists():
            raise HelperError('Refusing to overwrite existing file: %s (choose a new --output-dir)' % p.name)
    if not a.allow_paid_request:
        raise HelperError('Voice Design is paid: show the user the plan (description, preview text, about %s credits) '
                          'and get a yes, then pass --allow-paid-request.' % (len(preview) if preview else '100-300'))
    k = api_key()
    body = {'voice_description': desc, 'model_id': model_id, 'loudness': a.loudness, 'guidance_scale': a.guidance,
            'auto_generate_text': bool(preview is None), 'should_enhance': False}
    if preview is not None:
        body['text'] = preview
    if a.seed is not None:
        body['seed'] = a.seed
    reserved = reserve(files)
    try:
        data, meta = request('POST', '/v1/text-to-voice/design', k,
                             body=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                             content_type='application/json', query={'output_format': 'mp3_44100_128'})
        previews = (data or {}).get('previews') if isinstance(data, dict) else None
        if not previews:
            raise HelperError('No previews in the response; the call may still be billed: check the ElevenLabs history.')
        rows = []
        for i, pv in enumerate(previews[:3]):
            try:
                audio = base64.b64decode(re.sub(r'\s+', '', str(pv.get('audio_base_64') or '')), validate=True)
            except (ValueError, TypeError):
                audio = b''
            if not audio or not valid_audio(audio, 'mp3'):
                continue
            files[i].write_bytes(audio)
            rows.append({'file': files[i].name, 'generated_voice_id': pv.get('generated_voice_id'),
                         'duration_s': pv.get('duration_secs'), 'sha256': sha256_bytes(audio)})
        used_text = data.get('text') or preview
        cost = design_cost(meta, used_text)
        record = {'provider': 'ElevenLabs', 'endpoint': 'text-to-voice design', 'designer_model': model_id,
                  'voice_description': desc, 'preview_text': used_text,
                  'guidance_scale': a.guidance, 'loudness': a.loudness, 'seed': a.seed,
                  'request_id': meta.get('request_id'), 'trace_id': meta.get('trace_id'), **cost,
                  'previews': rows, 'created_utc': datetime.now(timezone.utc).isoformat(),
                  'next': 'Listen to all three with the user; save the chosen one with save --generated-voice-id '
                          '(takes one voice slot). Unsaved previews are not kept by ElevenLabs for long.'}
        files[3].write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    finally:
        release(reserved)
    return {'mode': 'voice design (paid request sent)', 'folder': str(out_dir), 'previews': rows, **cost,
            'next': 'Play the three previews to the user, then save the one they pick.'}


def design_cost(meta, preview_text):
    """What a design call cost: the character-cost header when ElevenLabs sends it, else an estimate."""
    reported = meta.get('character_cost')
    if reported is not None:
        return {'reported_character_cost': reported,
                'character_cost_source': 'reported by ElevenLabs (character-cost response header)'}
    return {'reported_character_cost': None,
            'estimated_character_cost': len(preview_text or ''),
            'character_cost_source': ('estimate, not reported: the preview text\'s characters (the response had no '
                                      'character-cost header; measured 2026-11-11 on a Creator plan: 3 previews of a '
                                      '175-character text cost 175 credits)'),
            'character_cost_note': 'The account shows the charge a few minutes later: run account then to see it.'}


def cmd_save(a):
    if not ID_RE.match(a.generated_voice_id or ''):
        raise HelperError('--generated-voice-id is missing or invalid (it is in design.json).')
    name = (a.name or '').strip()
    if not name:
        raise HelperError('--name is required.')
    desc = ' '.join((a.description or 'Designed with Khaam Motion').split())[:1000]
    slug = re.sub(r'[^A-Za-z0-9_-]+', '-', name).strip('-') or 'voice'
    record = Path(a.record).expanduser().resolve() if a.record else Path('assets/vo/voices/%s.voice.json' % slug).resolve()
    if record.exists():
        raise HelperError('Refusing to overwrite existing file: %s' % record.name)
    if not a.allow_voice_slot:
        raise HelperError('Saving a designed voice takes one voice slot on the account: tell the user and get a yes, '
                          'then pass --allow-voice-slot.')
    k = api_key()
    acct = account_info(k)
    if acct.get('voice_slots_free') is not None and acct['voice_slots_free'] < 1:
        raise HelperError('All %s voice slots are in use. The user frees one in the ElevenLabs app (My Voices) '
                          'first; nothing was saved.' % acct.get('voice_slots'))
    reserved = reserve([record])
    try:
        body = {'voice_name': name, 'voice_description': desc, 'generated_voice_id': a.generated_voice_id}
        data, meta = request('POST', '/v1/text-to-voice', k, body=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                             content_type='application/json')
        voice_id = data.get('voice_id') if isinstance(data, dict) else None
        if not voice_id:
            raise HelperError('No voice_id in the response; check My Voices in the ElevenLabs app before retrying.')
        design = None
        if a.design_record:
            try:
                design = json.loads(Path(a.design_record).expanduser().read_text(encoding='utf-8'))
            except (OSError, ValueError):
                design = None
        record.write_text(json.dumps({
            'provider': 'ElevenLabs', 'type': 'Voice Design (generated)', 'voice_id': voice_id, 'name': name,
            'generated_voice_id': a.generated_voice_id, 'description': desc,
            'designer_model': (design or {}).get('designer_model'), 'preview_text': (design or {}).get('preview_text'),
            'request_id': meta.get('request_id'), 'created_utc': datetime.now(timezone.utc).isoformat(),
            'note': 'This voice is the user\'s own design. Reuse its voice_id; approve it on a short v4 preview first.',
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except Exception:
        release(reserved)
        raise
    return {'mode': 'designed voice saved (one voice slot used)', 'voice_id': voice_id, 'record': str(record),
            'next': 'Store voice_id in TASTE.md section 6; narrate with generate --voice-id %s' % voice_id}


def clone_slot_check(k):
    """Before a clone is created (it takes one voice slot, as a saved design does): stop when the account has no free
    slot. A free GET; when the account cannot be read, the clone goes ahead as it did in 1.6."""
    try:
        acct = account_info(k)
    except HelperError:
        return
    if acct.get('voice_slots_free') is not None and acct['voice_slots_free'] < 1:
        raise HelperError('All %s voice slots are in use. The user frees one in the ElevenLabs app (My Voices) '
                          'first; nothing was sent.' % acct.get('voice_slots'))


def cmd_clone(a):
    files = [Path(f).expanduser().resolve() for f in a.sample]
    for f in files:
        if not f.is_file():
            raise HelperError('Sample not found: %s' % f.name)
    checks = [probe(f) for f in files]
    warnings, total = sample_warnings(checks)
    result = {'mode': 'local sample check (nothing uploaded)', 'samples': checks, 'total_seconds': total,
              'warnings': warnings,
              'recommendation': '1-2 minutes, one speaker, clean, consistent; MP3 >=128 kbps; RMS -23 to -18 dB; '
                                'true peak <= -3 dB. Use --remove-background-noise only if the sample is noisy.'}
    if not (a.allow_voice_clone and a.confirm_rights_and_consent):
        result['clone_created'] = False
        result['next'] = ('To create the clone, the user must approve it AND confirm they have the right and the '
                          "speaker's consent; then add --allow-voice-clone --confirm-rights-and-consent --name.")
        return result
    if not a.name or not a.name.strip():
        raise HelperError('--name is required to create a voice clone.')
    slug = re.sub(r'[^A-Za-z0-9_-]+', '-', a.name.strip()).strip('-') or 'voice'
    record = Path(a.record).expanduser().resolve() if a.record else Path('assets/vo/voices/%s.voice.json' % slug).resolve()
    reserved = reserve([record])
    try:
        k = api_key()
        clone_slot_check(k)
        fields = [('name', a.name.strip()), ('remove_background_noise', 'true' if a.remove_background_noise else 'false')]
        if a.description:
            fields.append(('description', a.description))
        labels = {k2: v for k2, v in (('language', a.language), ('accent', a.accent)) if v}
        if labels:
            fields.append(('labels', json.dumps(labels)))
        body, ctype = multipart(fields, files, a.files_field)
        data, meta = request('POST', '/v1/voices/add', k, body=body, content_type=ctype)
        voice_id = data.get('voice_id') if isinstance(data, dict) else None
        if not voice_id:
            raise HelperError('No voice_id in the response; check My Voices in the ElevenLabs app before retrying.')
        record.write_text(json.dumps({
            'provider': 'ElevenLabs', 'type': 'Instant Voice Clone', 'voice_id': voice_id, 'name': a.name.strip(),
            'requires_verification': data.get('requires_verification'), 'samples': checks,
            'remove_background_noise': bool(a.remove_background_noise), 'labels': labels or None,
            'rights_and_consent_confirmed_by_user': True, 'request_id': meta.get('request_id'),
            'created_utc': datetime.now(timezone.utc).isoformat(),
            'note': 'Reuse this voice_id; keep the original samples. Approve the voice on a short preview first.',
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except Exception:
        release(reserved)
        raise
    result.update({'clone_created': True, 'voice_id': voice_id, 'record': str(record)})
    return result


def takes_on_disk(out, text, voice_id):
    """Takes of this exact text with this voice already made by this helper (their .json sidecars) in the output's folder
    and, under a project's assets/vo/, the whole vo folder. Added 2026-11-12 after a blind test: a chat cut after two
    paid takes left a next chat that could have paid for them again."""
    root = out.parent
    for p in [out.parent] + list(out.parent.parents)[:2]:
        if p.name == 'vo':
            root = p
            break
    want = re.sub(r'\s+', ' ', INVISIBLE_RE.sub('', text)).strip()
    found = []
    try:
        sidecars = sorted(root.rglob('*.json'))
    except OSError:
        return found
    for sc in sidecars:
        if sc.name.endswith(('.words.json', '.segments.json', '.voice.json')):
            continue
        try:
            d = json.loads(sc.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError):
            continue
        if (isinstance(d, dict) and d.get('provider') == 'ElevenLabs' and d.get('voice_id') == voice_id and
                re.sub(r'\s+', ' ', INVISIBLE_RE.sub('', str(d.get('text', '')))).strip() == want and
                d.get('request_id') is not None):
            found.append({'file': d.get('audio_file') or sc.name[:-5], 'seed': d.get('seed'),
                          'credits': d.get('reported_character_cost')})
    return found


def note_voice_choice(voice):
    """Record the voice route in ~/.cache/khaam-motion/onboarding.json the first time a take is made with the user's
    designed voice (designed) or his voice made from a recording (cloned), so a later chat never offers narration
    again (SKILL.md §0). Never fails the take."""
    choice = {'generated': 'designed', 'cloned': 'cloned'}.get(voice.get('category')) if isinstance(voice, dict) else None
    if not choice:
        return
    try:
        p = Path.home() / '.cache' / 'khaam-motion' / 'onboarding.json'
        d = json.loads(p.read_text(encoding='utf-8-sig')) if p.is_file() else {}
        if not isinstance(d, dict) or d.get('voice_choice'):
            return
        d.update(voice_offer_done=True, voice_choice=choice)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except (OSError, ValueError):
        pass


def cmd_generate(a):
    text = read_text(a)
    model_id = choose_model(a)
    check_common(a)
    if not ID_RE.match(a.voice_id or ''):
        raise HelperError('--voice-id is missing or invalid.')
    out = output_path(a.output, a.format)
    paths = [out] + companions(out)
    for p in paths:
        if p.exists():
            raise HelperError('Refusing to overwrite existing file: %s' % p.name)
    info = analyse(text)
    prior = takes_on_disk(out, text, a.voice_id)
    if prior:
        names = ', '.join('%s (seed %s, %s credits)' % (t['file'], t['seed'], t['credits']) for t in prior)
        if any(t['seed'] is not None and t['seed'] == a.seed for t in prior):
            raise HelperError('The same text, voice and seed were already generated and paid for: %s. That request would '
                              'repeat it. Use that take, or change --seed for a new one. Nothing was sent.' % names)
        if not a.another_take:
            raise HelperError('%d take(s) of this exact text with this voice are already on disk and were paid for: %s. '
                              'Use them: pick one (by listening, or by measurement and say it is unheard). After a cut chat '
                              'these are the narration the user approved: never pay for it again. Only when the plan the '
                              'user approved has more takes than these, or the user asked for one more after hearing them, '
                              'pass --another-take. Nothing was sent.' % (len(prior), names))
    if not a.allow_paid_request:
        raise HelperError('Generation refused: get the user\'s approval for model, voice, text/characters, takes and '
                          'credit budget, then pass --allow-paid-request.')
    k = api_key()
    resolve_model(k, model_id, len(text))
    voices = check_voice_policy(k, [a.voice_id], a.library_voice_named_by_user)
    settings = {'stability': a.stability, 'similarity_boost': a.similarity}
    payload = {'text': text, 'model_id': model_id, 'voice_settings': settings}
    if a.seed is not None:
        payload['seed'] = a.seed
    if a.language_code:
        payload['language_code'] = a.language_code
    if a.normalization:
        payload['apply_text_normalization'] = a.normalization
    if a.previous_request_id:
        payload['previous_request_ids'] = a.previous_request_id
    elif a.previous_text:
        payload['previous_text'] = a.previous_text
    if a.next_text:
        payload['next_text'] = a.next_text
    reserved = reserve(paths)
    try:
        data, meta = request('POST', '/v1/text-to-speech/%s/with-timestamps' % urllib.parse.quote(a.voice_id, safe=''),
                             k, body=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                             content_type='application/json', query={'output_format': a.format})
        record = {'provider': 'ElevenLabs', 'endpoint': 'text-to-speech with-timestamps', 'model_id': model_id,
                  'purpose': 'production' if model_id == 'eleven_v4' else 'preview only',
                  'voice_id': a.voice_id, 'voice': voices[0], 'voice_settings_sent': settings, 'seed': a.seed,
                  'language_code': a.language_code, 'apply_text_normalization': a.normalization or 'server default',
                  'previous_request_ids': a.previous_request_id or None, 'text': text,
                  'text_sha256': sha256_bytes(text.encode('utf-8')), 'characters': len(text),
                  'plan_warnings': info['warnings']}
        audio, words = finish(data if isinstance(data, dict) else {}, meta, out, reserved, a.format, record)
    except Exception:
        release(reserved)
        raise
    note_voice_choice(voices[0])
    return {'mode': 'take generated (paid request sent)', 'output': str(out), 'model_id': model_id,
            'bytes': len(audio), 'words_timed': len(words or []), 'request_id': meta.get('request_id'),
            'reported_character_cost': meta.get('character_cost'),
            'next': 'Listen in full; pass this request_id as --previous-request-id for the next chunk.'}


def load_dialogue(path):
    p = Path(path).expanduser()
    if not p.is_file():
        raise HelperError('Inputs file not found: %s' % p)
    try:
        items = json.loads(p.read_text(encoding='utf-8-sig'))
    except ValueError:
        raise HelperError('Inputs file is not valid JSON.') from None
    if not isinstance(items, list) or not items:
        raise HelperError('Inputs file must be a JSON list of {"voice_id": ..., "text": ...}.')
    clean = []
    for i, it in enumerate(items):
        if not isinstance(it, dict) or not isinstance(it.get('text'), str) or not it['text'].strip() \
                or not ID_RE.match(str(it.get('voice_id', ''))):
            raise HelperError('Input %d needs a valid voice_id and non-empty text.' % (i + 1))
        clean.append({'text': it['text'].strip(), 'voice_id': it['voice_id']})
    total = sum(len(x['text']) for x in clean)
    if total > DIALOGUE_MAX_CHARS:
        raise HelperError('Dialogue text totals %d characters; keep each request at or under %d (split the interview).'
                          % (total, DIALOGUE_MAX_CHARS))
    if len({x['voice_id'] for x in clean}) > DIALOGUE_MAX_VOICES:
        raise HelperError('At most %d distinct voices per dialogue request.' % DIALOGUE_MAX_VOICES)
    return clean, total


def cmd_dialogue(a):
    if getattr(a, 'model', 'v4') != 'v4' or getattr(a, 'model_id', None) not in (None, 'eleven_v4'):
        raise HelperError('Text to Dialogue over HTTP uses eleven_v4 only.')
    inputs, total = load_dialogue(a.inputs_file)
    check_common(a)
    out = output_path(a.output, a.format)
    paths = [out] + companions(out, ('.segments.json',))
    for p in paths:
        if p.exists():
            raise HelperError('Refusing to overwrite existing file: %s' % p.name)
    warnings = [w for x in inputs for w in analyse(x['text'])['warnings']
                if not w.startswith('Very short text')]  # single turns are naturally short
    if not a.allow_paid_request:
        raise HelperError('Generation refused: get the user\'s approval for model, voices, text/characters, takes and '
                          'credit budget, then pass --allow-paid-request.')
    k = api_key()
    resolve_model(k, 'eleven_v4', total)
    voices = check_voice_policy(k, [x['voice_id'] for x in inputs], a.library_voice_named_by_user)
    payload = {'inputs': inputs, 'model_id': 'eleven_v4'}
    settings = {name: value for name, value in (('stability', a.stability), ('similarity', a.similarity)) if value is not None}
    if settings:
        payload['settings'] = settings
    if a.seed is not None:
        payload['seed'] = a.seed
    if a.language_code:
        payload['language_code'] = a.language_code
    if a.normalization:
        payload['apply_text_normalization'] = a.normalization
    if a.previous_request_id:
        payload['previous_request_ids'] = a.previous_request_id
    reserved = reserve(paths)
    try:
        data, meta = request('POST', '/v1/text-to-dialogue/with-timestamps', k,
                             body=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                             content_type='application/json', query={'output_format': a.format})
        record = {'provider': 'ElevenLabs', 'endpoint': 'text-to-dialogue with-timestamps', 'model_id': 'eleven_v4',
                  'purpose': 'production', 'inputs': inputs, 'voices': voices, 'settings_sent': settings or 'server defaults',
                  'seed': a.seed, 'language_code': a.language_code,
                  'apply_text_normalization': a.normalization or 'server default',
                  'previous_request_ids': a.previous_request_id or None, 'characters': total,
                  'segments_file': reserved[3].name, 'plan_warnings': warnings}
        audio, words = finish(data if isinstance(data, dict) else {}, meta, out, reserved, a.format, record,
                              segments_path=reserved[3])
    except Exception:
        release(reserved)
        raise
    return {'mode': 'dialogue take generated (paid request sent)', 'output': str(out), 'bytes': len(audio),
            'words_timed': len(words or []), 'request_id': meta.get('request_id'),
            'reported_character_cost': meta.get('character_cost'),
            'next': 'Listen in full; use the .segments.json speaker timings for cuts and lower thirds.'}


# ---------------------------------------------------------------- CLI
def build_parser():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd')

    def text_args(sp):
        sp.add_argument('--text-file', help='UTF-8 text file with the exact chunk to speak (preferred)')
        sp.add_argument('--text', help='Text to speak (use --text-file for Arabic or long text)')

    def model_args(sp):
        sp.add_argument('--model', choices=['v4', 'v4-turbo'], default='v4',
                        help='v4 = delivered takes (default); v4-turbo = short previews only')
        sp.add_argument('--model-id', help='Exact Eleven v4 model id; must start with eleven_v4')

    def tts_args(sp, defaults):
        sp.add_argument('--output', required=True, help='.mp3 or .wav matching --format; never overwritten')
        sp.add_argument('--format', choices=FORMATS, default='mp3_44100_128',
                        help='mp3_44100_128 works on every plan (default); mp3_44100_192 needs Creator tier+ '
                             '(Free and Starter answer 403); WAV needs a higher tier')
        sp.add_argument('--stability', type=float, default=0.5 if defaults else None)
        sp.add_argument('--similarity', type=float, default=0.75 if defaults else None)
        sp.add_argument('--seed', type=int)
        sp.add_argument('--language-code', help='ISO 639-1, e.g. ar or en')
        sp.add_argument('--normalization', choices=['auto', 'on', 'off'])
        sp.add_argument('--previous-request-id', action='append', default=[],
                        help='request-id of the previous chunk (max 3, under two hours old)')
        sp.add_argument('--allow-paid-request', action='store_true')
        sp.add_argument('--library-voice-named-by-user', action='store_true',
                        help='only when the user named this shared library voice themselves')

    def design_args(sp):
        sp.add_argument('--description', help='who the voice is: language and dialect first, then age, tone, pace')
        sp.add_argument('--description-file', help='UTF-8 file with the description (preferred for Arabic)')
        sp.add_argument('--designer', choices=sorted(DESIGN_MODELS), default='ttv-v2',
                        help='ttv-v2 = eleven_multilingual_ttv_v2 (default: kept the script\'s words and a natural '
                             'pitch in our Arabic tests); ttv-v3 = eleven_ttv_v3')

    pl = sub.add_parser('plan', help='offline check (default)')
    text_args(pl)
    model_args(pl)
    pl.add_argument('--voice-id')
    design_args(pl)

    sub.add_parser('account', help='plan, credits left, voice slots (free GET)')

    de = sub.add_parser('design', help='Voice Design: 3 previews from a description (paid)')
    design_args(de)
    text_args(de)
    de.add_argument('--auto-text', action='store_true', help='let ElevenLabs write the preview text')
    de.add_argument('--output-dir', default='assets/vo/voices/design 1', help='new folder for the 3 previews')
    de.add_argument('--guidance', type=float, default=5.0, help='how strictly to follow the description (API default 5)')
    de.add_argument('--loudness', type=float, default=0.5, help='-1..1; 0 is about -24 LUFS (API default 0.5)')
    de.add_argument('--seed', type=int)
    de.add_argument('--allow-paid-request', action='store_true')

    sv = sub.add_parser('save', help='keep one designed preview as a voice (uses one voice slot)')
    sv.add_argument('--generated-voice-id', required=True)
    sv.add_argument('--name', required=True)
    sv.add_argument('--description')
    sv.add_argument('--design-record', help='the design.json the preview came from')
    sv.add_argument('--record', help='where to save the voice record JSON')
    sv.add_argument('--allow-voice-slot', action='store_true')

    sub.add_parser('models', help='list the Eleven v4 models on this account (free GET)')

    vo = sub.add_parser('voices', help='search the account voices (free GET)')
    vo.add_argument('--search')
    vo.add_argument('--limit', type=int, default=20)
    vo.add_argument('--voice-type', help='e.g. personal, default, saved, community')
    vo.add_argument('--category', help='premade, cloned, generated or professional')

    cl = sub.add_parser('clone', help='check a sample locally; create an IVC only with both confirmation flags')
    cl.add_argument('--sample', action='append', required=True, help='audio sample file (repeatable)')
    cl.add_argument('--name')
    cl.add_argument('--description')
    cl.add_argument('--language', help='label, e.g. ar')
    cl.add_argument('--accent', help='label, e.g. saudi')
    cl.add_argument('--remove-background-noise', action='store_true', help='only for noisy samples')
    cl.add_argument('--record', help='where to save the voice record JSON')
    cl.add_argument('--files-field', choices=['files', 'files[]'], default='files', help=argparse.SUPPRESS)
    cl.add_argument('--allow-voice-clone', action='store_true')
    cl.add_argument('--confirm-rights-and-consent', action='store_true')

    ge = sub.add_parser('generate', help='one paid TTS request with word timings')
    text_args(ge)
    model_args(ge)
    ge.add_argument('--voice-id', required=True)
    tts_args(ge, True)
    ge.add_argument('--previous-text', help='text spoken just before this chunk (ignored if a request id is given)')
    ge.add_argument('--next-text', help='text spoken just after this chunk')
    ge.add_argument('--another-take', action='store_true',
                    help='a further paid take of a text that already has a take on disk (the approved plan has more '
                         'takes, or the user asked for one after hearing them); without it the helper refuses')

    di = sub.add_parser('dialogue', help='one paid Text to Dialogue request (eleven_v4)')
    di.add_argument('--inputs-file', required=True, help='JSON list of {"voice_id": ..., "text": ...}')
    di.add_argument('--model', choices=['v4'], default='v4')
    di.add_argument('--model-id', help=argparse.SUPPRESS)
    tts_args(di, False)
    return p


COMMANDS = {'plan': cmd_plan, 'account': cmd_account, 'models': cmd_models, 'voices': cmd_voices,
            'design': cmd_design, 'save': cmd_save, 'clone': cmd_clone,
            'generate': cmd_generate, 'dialogue': cmd_dialogue}


def main(argv=None):
    parser = build_parser()
    a = parser.parse_args(argv)
    if a.cmd is None:
        a = parser.parse_args(['plan'])
    result = COMMANDS[a.cmd](a)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except HelperError as e:
        print('ERROR: ' + str(e), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('ERROR: interrupted.', file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print('ERROR: ' + type(e).__name__ + '; no key or secret was printed. No automatic retry.', file=sys.stderr)
        sys.exit(1)
