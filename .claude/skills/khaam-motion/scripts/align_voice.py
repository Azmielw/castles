#!/usr/bin/env python3
"""Word timings from a recorded voice - Khaam Motion.

Turns a narration recording (the user's own voice, or any voice file the user has the right to use) plus
the exact script that was read into the same <name>.words.json that gen_tts_elevenlabs.py writes, so the
captions, the word-lit block and the word cues work the same way for a recorded voice. Runs on the CPU:
no GPU needed, no account, no key, and the audio never leaves the computer. Since 1.7 it tries an NVIDIA GPU
first (CUDA, float16: seconds instead of minutes) when its CUDA libraries are there, and falls back to the
CPU by itself (--device cpu forces the CPU; the CPU build ran out of memory on a busy PC three times on 11-12).

Subcommands (no subcommand = plan):
  plan    offline: what is installed, what a one-time setup would download and its size, and whether the GPU
          can be used. Changes nothing.
  setup   one-time install, only after the user's yes (--yes): a private Python environment in
          ~/.cache/khaam-motion/align-env with faster-whisper, and one speech model checked by SHA-256.
          --gpu adds NVIDIA's CUDA libraries (cuBLAS 12, cuDNN 9) to that environment: about 1.25 GB, asked
          first; never needed (the CPU works without them).
  align   one recording + its script -> <audio stem>.words.json beside the audio (never overwrites).

How it works: faster-whisper transcribes the recording with word times, guided by the script; the
script's own words are matched to what was heard letter by letter (harakat, hamza forms and taa marbuta
ignored for the match), words the model did not hear clearly get times shared out between their
neighbours, and each start is moved to where the sound rises after the nearest dip (Whisper's own word
starts run 0.1-0.3 s early).

Licences: faster-whisper 1.2.1 (MIT, SYSTRAN), CTranslate2 (MIT, OpenNMT), OpenAI Whisper weights (MIT),
converted by Systran / Mobius Labs (MIT). Downloads come only from PyPI and from the pinned Hugging Face
revisions below.
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from khaam_paths import CACHE, models_dir  # noqa: E402

for _stream in (sys.stdout, sys.stderr):  # Windows consoles: print Arabic safely
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

FW_VERSION = '1.2.1'
ENV_DIR = CACHE / 'align-env'
# Pinned model revisions. Sizes and SHA-256 were read from the files themselves (2026-11-11).
MODELS = {
    'small': {
        'repo': 'Systran/faster-whisper-small', 'revision': '536b0662742c02347bc0e980a01041f333bce120',
        'licence': 'MIT', 'files': {
            'config.json': (2370, 'b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828'),
            'model.bin': (483546902, '3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671'),
            'tokenizer.json': (2203239, 'fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab'),
            'vocabulary.txt': (459861, '34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913'),
        }},
    'medium': {
        'repo': 'Systran/faster-whisper-medium', 'revision': '08e178d48790749d25932bbc082711ddcfdfbc4f',
        'licence': 'MIT', 'files': {
            'config.json': (2257, '3622a2ddc41ec0e0fd4e68c13c6830f03b90c38d89aaad184de02c8c642cf807'),
            'model.bin': (1527906378, '9b45e1009dcc4ab601eff815b61d80e60ce3fd8c74c1a14f4a282258286b51ae'),
            'tokenizer.json': (2203239, 'fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab'),
            'vocabulary.txt': (459861, '34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913'),
        }},
    'turbo': {
        'repo': 'mobiuslabsgmbh/faster-whisper-large-v3-turbo', 'revision': '0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf',
        'licence': 'MIT', 'files': {
            'config.json': (2263, 'b0253ea6c0d3bea6b1e19e91a02acfd3b53f4467362efcb5a3e6b16c9b3a9b7e'),
            'model.bin': (1617884929, 'e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da'),
            'preprocessor_config.json': (340, '7ccc62c6f2765af1f3b46c00c9b5894426835a05021c8b9c01eecb6dfb542711'),
            'tokenizer.json': (2710337, '297b13372ac43916285644fb9687add3cc62ee2a1adb60da3dc25cc94c1871fd'),
            'vocabulary.json': (1068114, 'c69260f2ab26d659b7c398f9a2b2b48ed0df16c3b47d7326782fd9cba71690c1'),
        }},
}
DEFAULT_MODEL = 'small'
# Pinned: faster-whisper 1.2.1 passes av.open(metadata_errors=...), which PyAV 19 no longer accepts (found 2026-11-11 in a
# clean environment); PyAV 17.1.0 works (tested on Python 3.11 and 3.13).
PINS = ['faster-whisper==' + FW_VERSION, 'av==17.1.0']
# Measured: pip into an empty environment downloaded 89 MB (Windows 11, Python 3.13, 2026-11-11); the environment
# takes about 290 MB on disk.
PACKAGES_MB = 89
# The GPU route (setup --gpu): the CUDA libraries CTranslate2 4.x loads, as tested with faster-whisper 1.2.1 and
# CTranslate2 4.8.0 on an RTX 4080 SUPER (Windows 11, 2026-11-12). Wheel sizes from PyPI the same day (win_amd64:
# cuBLAS 553 MB, cuDNN 690 MB, runtime 4 MB); about 1.8 GB on disk once installed.
GPU_PINS = ['nvidia-cublas-cu12==12.9.2.10', 'nvidia-cudnn-cu12==9.23.2.1', 'nvidia-cuda-runtime-cu12==12.9.79']
GPU_MB = 1250
CUDA_DLLS = {'nt': ['cublas64_12.dll', 'cublasLt64_12.dll', 'cudnn64_9.dll', 'cudnn_ops64_9.dll',
                    'cudnn_cnn64_9.dll'],
             'posix': ['libcublas.so.12', 'libcublasLt.so.12', 'libcudnn.so.9']}

TAG_RE = re.compile(r'\[[^\[\]\n]{1,120}\]')
HARAKAT_RE = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
PUNCT = '.,!?;:…—–-«»“”‘’"\'()[]{}،؛؟٪*/\\|'
# Invisible characters from a web copy (direction marks, zero-width joiners, the BOM ...; the same set as
# cues.INVISIBLE_RE): not part of any word of the script (the wisdom rerun, 2026-11-12).
INVISIBLE_RE = re.compile('[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]')
AR_MAP = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي',
                        'ء': '', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6',
                        '٧': '7', '٨': '8', '٩': '9', 'ک': 'ك', 'ی': 'ي'})


class AlignError(Exception):
    pass


# ---------------------------------------------------------------- text
def normalise(word):
    """Letters only, for matching: no harakat, one alef, ي for ى, ه for ة, no punctuation, lower case."""
    w = unicodedata.normalize('NFC', word)
    w = HARAKAT_RE.sub('', w).translate(AR_MAP).lower()
    return ''.join(c for c in w if c.isalnum())


def script_words(text):
    words = []
    for raw in TAG_RE.sub(' ', text).split():
        if INVISIBLE_RE.search(raw):
            raw = INVISIBLE_RE.sub('', raw)
        clean = raw.strip(PUNCT)
        if clean and any(c.isalnum() for c in clean):
            words.append({'word': clean, 'raw': raw, 'norm': normalise(clean)})
    return words


def read_script(path):
    p = Path(path).expanduser()
    if not p.is_file():
        raise AlignError('Script file not found: %s' % p.name)
    text = p.read_text(encoding='utf-8-sig').replace('\r\n', '\n').strip()
    if not text:
        raise AlignError('The script file is empty.')
    return text


# ---------------------------------------------------------------- model files
def sha256_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def hf_cache_dirs():
    roots = []
    if os.environ.get('HF_HUB_CACHE'):
        roots.append(Path(os.environ['HF_HUB_CACHE']))
    if os.environ.get('HF_HOME'):
        roots.append(Path(os.environ['HF_HOME']) / 'hub')
    roots.append(Path.home() / '.cache' / 'huggingface' / 'hub')
    return roots


def candidate_dirs(name):
    spec = MODELS[name]
    yield models_dir() / 'whisper' / name
    for root in hf_cache_dirs():
        yield root / ('models--' + spec['repo'].replace('/', '--')) / 'snapshots' / spec['revision']


def files_complete(folder, name):
    spec = MODELS[name]['files']
    return all((folder / f).is_file() and (folder / f).stat().st_size == size for f, (size, _) in spec.items())


def verify_folder(folder, name):
    """SHA-256 of every pinned file; raises on any mismatch."""
    for f, (size, digest) in MODELS[name]['files'].items():
        p = folder / f
        if not p.is_file() or p.stat().st_size != size or sha256_file(p) != digest:
            raise AlignError('%s in %s does not match the pinned model; it was not loaded.' % (f, folder.name))


def find_model(name, explicit=None):
    if explicit:
        folder = Path(explicit).expanduser().resolve()
        if not files_complete(folder, name):
            raise AlignError('--model-path does not hold the pinned "%s" model files.' % name)
        return folder
    for folder in candidate_dirs(name):
        if files_complete(folder, name):
            return folder
    return None


# ---------------------------------------------------------------- environment
def fw_importable():
    """Installed in this Python? (find_spec does not load the libraries, so a busy PC cannot fake a 'missing'.)"""
    import importlib.util
    try:
        return importlib.util.find_spec('faster_whisper') is not None
    except (ImportError, ValueError):
        return False


def env_python():
    win = ENV_DIR / 'Scripts' / 'python.exe'
    nix = ENV_DIR / 'bin' / 'python'
    return win if win.is_file() else nix if nix.is_file() else None


def in_private_env():
    try:
        return Path(sys.prefix).resolve() == ENV_DIR.resolve()
    except OSError:
        return False


def reexec_in_env(argv):
    py = env_python()
    if not py:
        raise AlignError('faster-whisper is not installed. Run "align_voice.py plan" and, after the user\'s yes, '
                         '"align_voice.py setup --yes".')
    r = subprocess.run([str(py), '-I', os.path.abspath(__file__)] + argv)
    sys.exit(r.returncode)


# ---------------------------------------------------------------- audio
def energy_db(audio, sr=16000, hop=0.01, win=0.025):
    import numpy as np
    h, w = int(sr * hop), int(sr * win)
    if len(audio) < w:
        return np.full(1, -120.0)
    n = 1 + (len(audio) - w) // h
    idx = np.arange(w)[None, :] + h * np.arange(n)[:, None]
    frames = audio[idx]
    rms = np.sqrt(np.mean(frames.astype('float64') ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


HOP = 0.01


def refine_edges(spans, audio, back=0.10, fwd=0.28, min_depth=12.0, frac=0.2):
    """Whisper's word starts run early (0.1-0.3 s in our tests). For each word, look for the deepest dip in the
    sound from 0.10 s before to 0.28 s after Whisper's start; when it is at least 12 dB under the word's own
    level, the word starts where the sound rises again and the word before ends where it fell. Words with no
    dip near them (joined speech) keep Whisper's times."""
    import numpy as np
    db = np.convolve(energy_db(audio), np.ones(3) / 3, mode='same')
    n = len(db)

    def level(s, e):
        a = int(s / HOP)
        return np.percentile(db[a:min(n, max(a + 10, int(e / HOP)) + 1)], 90)

    out = list(spans)
    for i, (s, e) in enumerate(spans):
        lo = max(0, int((s - back) / HOP))
        hi = min(n - 1, int(min(s + fwd, e - 0.03) / HOP))
        if i > 0:
            lo = max(lo, int((spans[i - 1][0] + 0.06) / HOP))
        if hi <= lo + 2:
            continue
        m = lo + int(np.argmin(db[lo:hi + 1]))
        dip = db[m]
        top = level(s, e)
        if top - dip < min_depth:
            continue
        k = m
        while k < n - 1 and db[k] < dip + max(6.0, frac * (top - dip)):
            k += 1
        start = k * HOP
        out[i] = (start, out[i][1])
        if i > 0:
            thr = dip + max(6.0, frac * (level(*spans[i - 1]) - dip))
            j = m
            while j > 0 and db[j] < thr:
                j -= 1
            end = j * HOP + 0.025
            if out[i - 1][0] + 0.04 <= end <= start:
                out[i - 1] = (out[i - 1][0], end)
    for k in range(1, len(out)):  # in order, never overlapping, never shorter than 40 ms
        s, e = out[k]
        ps, pe = out[k - 1]
        if pe > s:
            out[k - 1] = (ps, max(ps + 0.04, s))
        if out[k][1] < out[k][0] + 0.04:
            out[k] = (out[k][0], out[k][0] + 0.04)
    return out


# ---------------------------------------------------------------- alignment
def map_to_script(words, heard):
    """Letter-level match of the script's words to the heard words; returns (start, end) or None per script word."""
    a_chars, a_word = [], []
    for i, w in enumerate(words):
        for c in w['norm']:
            a_chars.append(c)
            a_word.append(i)
    b_chars, b_time = [], []
    for h in heard:
        n = normalise(h['word'])
        if not n:
            continue
        step = (h['end'] - h['start']) / len(n)
        for k, c in enumerate(n):
            b_chars.append(c)
            b_time.append((h['start'] + k * step, h['start'] + (k + 1) * step))
    sm = difflib.SequenceMatcher(None, ''.join(a_chars), ''.join(b_chars), autojunk=False)
    hits = [[] for _ in words]
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            hits[a_word[blk.a + k]].append(b_time[blk.b + k])
    out = []
    for w, h in zip(words, hits):
        if w['norm'] and len(h) >= max(1, 0.5 * len(w['norm'])):
            out.append((h[0][0], h[-1][1]))
        else:
            out.append(None)
    return out


def fill_gaps(words, spans, duration):
    """Share time between neighbours for words the model did not hear clearly, by letter count."""
    i, n = 0, len(words)
    while i < n:
        if spans[i] is not None:
            i += 1
            continue
        j = i
        while j < n and spans[j] is None:
            j += 1
        left = spans[i - 1][1] if i > 0 else 0.0
        right = spans[j][0] if j < n else duration
        if right < left:
            right = left
        weights = [max(1, len(words[k]['norm'])) for k in range(i, j)]
        total, t = float(sum(weights)), left
        for k, wgt in zip(range(i, j), weights):
            d = (right - left) * wgt / total
            spans[k] = (t, t + d)
            words[k]['estimated'] = True
            t += d
        i = j
    return spans


# ---------------------------------------------------------------- the GPU (CUDA) first, else the CPU
DEVICE = os.environ.get('KHAAM_WHISPER_DEVICE', 'auto')     # auto | cuda | cpu
_CUDA = None


def cuda_lib_dirs():
    """The folders of NVIDIA's pip packages (nvidia-cublas-cu12, nvidia-cudnn-cu12, ...) in this Python: CTranslate2
    does not look there by itself."""
    import site
    roots = []
    for get in ('getsitepackages', 'getusersitepackages'):
        try:
            got = getattr(site, get)()
        except (AttributeError, OSError):
            continue
        roots += [got] if isinstance(got, str) else list(got)
    out = []
    for r in roots:
        base = Path(r) / 'nvidia'
        if base.is_dir():
            for sub in sorted(base.iterdir()):
                for leaf in ('bin', 'lib'):
                    if (sub / leaf).is_dir():
                        out.append(sub / leaf)
    return out


def cuda_state():
    """(usable, why), checked once: an NVIDIA GPU that CTranslate2 sees, and cuBLAS 12 + cuDNN 9 that load. Loading
    the libraries here first keeps a missing one from crashing the process later (it would abort, not raise)."""
    global _CUDA
    if _CUDA is not None:
        return _CUDA
    try:
        import ctranslate2
        n = ctranslate2.get_cuda_device_count()
    except Exception as e:  # noqa: BLE001  (any import or driver failure means: no GPU route)
        _CUDA = (False, 'CTranslate2 cannot see CUDA (%s)' % type(e).__name__)
        return _CUDA
    if n < 1:
        _CUDA = (False, 'no NVIDIA GPU with a CUDA driver')
        return _CUDA
    import ctypes
    dirs = cuda_lib_dirs()
    for d in dirs:
        if os.name == 'nt' and hasattr(os, 'add_dll_directory'):
            try:
                os.add_dll_directory(str(d))
            except OSError:
                pass
        os.environ['PATH'] = str(d) + os.pathsep + os.environ.get('PATH', '')
    loader = (lambda p: ctypes.WinDLL(p)) if os.name == 'nt' else (lambda p: ctypes.CDLL(p, mode=ctypes.RTLD_GLOBAL))
    missing = []
    for name in CUDA_DLLS['nt' if os.name == 'nt' else 'posix']:
        found = False
        for p in [str(d / name) for d in dirs if (d / name).is_file()] + [name]:
            try:
                loader(p)
                found = True
                break
            except OSError:
                continue
        if not found:
            missing.append(name)
    if missing:
        _CUDA = (False, 'an NVIDIA GPU is there, but not its CUDA libraries (%s): "setup --gpu" adds them (about '
                        '%d MB, asked first); the CPU works meanwhile' % (', '.join(missing), GPU_MB))
    else:
        _CUDA = (True, 'CUDA on %d NVIDIA GPU(s)' % n)
    return _CUDA


def load_model_on(model_dir, threads, device='auto'):
    """(model, device used, note): the GPU in float16 first when it can, else the CPU in int8."""
    from faster_whisper import WhisperModel
    note = None
    if device in ('auto', 'cuda'):
        ok, note = cuda_state()
        if ok:
            try:
                return WhisperModel(str(model_dir), device='cuda', compute_type='float16'), 'cuda', note
            except Exception as e:  # noqa: BLE001  (CUDA out of memory, a driver too old, ...: the CPU instead)
                note = 'the GPU failed (%s: %s)' % (type(e).__name__, str(e)[:160])
        if device == 'cuda':
            raise AlignError('--device cuda: %s.' % note)
    return WhisperModel(str(model_dir), device='cpu', compute_type='int8', cpu_threads=threads), 'cpu', note


def load_model(model_dir, threads):
    return load_model_on(model_dir, threads, DEVICE)[0]


def memory_error(e):
    return isinstance(e, MemoryError) or 'alloc' in str(e).lower() or 'out of memory' in str(e).lower()


MEMORY_HELP = ('Not enough free memory for the speech model (the CPU build asks for one large block; on 11-12 it '
               'failed three times while other programs rendered). Close other heavy apps (browsers, other Claude '
               'chats, renders) and run it once more with --threads 2, or on an NVIDIA GPU (setup --gpu). Do not run '
               'it again and again.')


def transcribe(model, audio, language, prompt, beam):
    segments, info = model.transcribe(audio, language=language, beam_size=beam, word_timestamps=True,
                                      initial_prompt=prompt or None, condition_on_previous_text=False,
                                      vad_filter=False, temperature=0.0)
    heard = []
    for seg in segments:
        for w in seg.words or []:
            heard.append({'word': w.word.strip(), 'start': float(w.start), 'end': float(w.end),
                          'p': round(float(w.probability), 3)})
    return heard


PROMPT_WORDS = int(os.environ.get('KHAAM_ALIGN_PROMPT_WORDS', '0'))


def script_prompt(words, n=PROMPT_WORDS):
    """Off by default. Tested 2026-11-11: the whole script as a prompt made Whisper 'hear' the script's ending
    in a loop (it keeps only a prompt's last ~220 tokens), and even 12 words made it skip half of one take.
    Plain transcription matched every word in every test; the letter-level match does the rest."""
    return HARAKAT_RE.sub('', ' '.join(w['raw'] for w in words[:n])) if n > 0 else ''


def align_audio(model, audio, words, language='ar', beam=5, snap_edges=True):
    """The whole method on a 16 kHz mono array: returns (rows, heard, matched)."""
    for w in words:
        w.pop('estimated', None)
    duration = len(audio) / 16000.0
    heard = transcribe(model, audio, language, script_prompt(words), beam)
    spans = map_to_script(words, heard)
    matched = sum(1 for s in spans if s is not None)
    spans = fill_gaps(words, spans, duration)
    if snap_edges:
        spans = refine_edges(spans, audio)
    rows = []
    for w, (s, e) in zip(words, spans):
        row = {'word': w['word'], 'raw': w['raw'], 'start': round(s, 3), 'end': round(e, 3)}
        if w.get('estimated'):
            row['estimated'] = True
        rows.append(row)
    return rows, heard, matched


# ---------------------------------------------------------------- commands
def cmd_plan(a):
    have_fw = fw_importable() or bool(env_python())
    model_folder = find_model(a.model)
    need = []
    if not have_fw:
        need.append('faster-whisper %s and its libraries: about %d MB from PyPI, into a private environment '
                    '(~/.cache/khaam-motion/align-env); the user\'s own Python is not changed' % (FW_VERSION, PACKAGES_MB))
    if not model_folder:
        mb = sum(s for s, _ in MODELS[a.model]['files'].values()) / 1e6
        need.append('the "%s" speech model: %.0f MB from huggingface.co/%s (pinned revision, SHA-256 checked)'
                    % (a.model, mb, MODELS[a.model]['repo']))
    gpu = gpu_report()
    out = {
        'mode': 'plan (offline, nothing changed)',
        'engine': 'faster-whisper %s: the GPU (CUDA float16) when ready, else the CPU (int8)' % FW_VERSION,
        'gpu': gpu,
        'licences': 'faster-whisper MIT, CTranslate2 MIT, Whisper weights MIT (model "%s": %s)' % (a.model, MODELS[a.model]['repo']),
        'faster_whisper_ready': have_fw,
        'model': a.model,
        'model_ready': bool(model_folder),
        'setup_needed': bool(need),
        'setup_would_download': need,
        'models_available': {k: '%.0f MB' % (sum(s for s, _ in v['files'].values()) / 1e6) for k, v in MODELS.items()},
    }
    if need:
        total = (0 if have_fw else PACKAGES_MB) + (0 if model_folder else sum(s for s, _ in MODELS[a.model]['files'].values()) / 1e6)
        out['ask_user'] = ('أحتاج أنزّل أداة تفريغ صوت مجانية مرة وحدة (حوالي %d ميقا): فيها أوقّت الكلام على الصوت، '
                           'وأفحص النص المقتبس كلمة كلمة. تشتغل على جهازك بدون نت%s. أنزّلها؟'
                           % (round(total), '، وتستفيد من كرت الشاشة' if gpu.get('usable') else ''))
        out['on_yes'] = 'python "<skill>/scripts/align_voice.py" setup --yes' + ('' if a.model == DEFAULT_MODEL else ' --model ' + a.model)
    if gpu.get('gpu_present') and not gpu.get('usable'):
        out['gpu_setup_would_download'] = ('NVIDIA CUDA libraries %s: about %d MB from PyPI into the private '
                                           'environment (optional: the CPU works without them)'
                                           % (', '.join(GPU_PINS), GPU_MB))
        out['ask_user_gpu'] = ('جهازك فيه كرت شاشة NVIDIA. لو نزّلت مكتباته (حوالي %.1f قيقا مرة وحدة) يصير التفريغ '
                               'بثواني بدل دقايق، وبدونها يشتغل على المعالج عادي. أنزّلها؟' % (GPU_MB / 1000.0))
        out['on_yes_gpu'] = 'python "<skill>/scripts/align_voice.py" setup --yes --gpu'
    return out


def gpu_report():
    """What the GPU route can do here, offline: in this Python when faster-whisper is in it, else in the private
    environment (a quick separate run). Never downloads anything."""
    import shutil
    present = bool(shutil.which('nvidia-smi'))
    if fw_importable():
        ok, why = cuda_state()
        return {'usable': ok, 'why': why, 'gpu_present': present or ok}
    py = env_python()
    if py:
        try:
            r = subprocess.run([str(py), '-I', os.path.abspath(__file__), '_gpu'], capture_output=True, text=True,
                               timeout=120)
            got = json.loads(r.stdout.strip().splitlines()[-1])
            got['gpu_present'] = present or got.get('usable', False)
            return got
        except (OSError, ValueError, IndexError, subprocess.TimeoutExpired):
            pass
    return {'usable': False, 'why': 'faster-whisper is not installed yet' if not py else 'could not check',
            'gpu_present': present}


def cmd_gpu(a):
    ok, why = cuda_state()
    print(json.dumps({'usable': ok, 'why': why}))
    return None


def cmd_setup(a):
    if not a.yes:
        raise AlignError('Setup downloads files: ask the user first (plan prints the size), then pass --yes.')
    steps = []
    py = sys.executable
    if not (fw_importable() or env_python()):
        subprocess.run([py, '-m', 'venv', str(ENV_DIR)], check=True)
        epy = env_python()
        subprocess.run([str(epy), '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--quiet']
                       + PINS, check=True)
        steps.append('installed %s into %s' % (', '.join(PINS), ENV_DIR.name))
    folder = find_model(a.model)
    if folder:
        verify_folder(folder, a.model)
        steps.append('model "%s" already on this computer, SHA-256 checked' % a.model)
    else:
        runner = sys.executable if fw_importable() else str(env_python())
        r = subprocess.run([runner, '-I', os.path.abspath(__file__), '_download', '--model', a.model])
        if r.returncode:
            raise AlignError('The model download failed; nothing was loaded.')
        steps.append('downloaded model "%s" (pinned revision), SHA-256 checked' % a.model)
    if getattr(a, 'gpu', False):
        epy = env_python()
        if not epy or fw_importable() and not in_private_env():
            raise AlignError('faster-whisper runs from this Python, not from the private environment, so the CUDA '
                             'libraries would go into the user\'s own Python. Ask the user; on a yes they run: '
                             '"%s" -m pip install %s' % (sys.executable, ' '.join(GPU_PINS)))
        subprocess.run([str(epy), '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--quiet']
                       + GPU_PINS, check=True)
        steps.append('installed the CUDA libraries (%s) into %s' % (', '.join(GPU_PINS), ENV_DIR.name))
    return {'mode': 'setup done', 'steps': steps, 'next': 'align --audio <file> --script <text file>'}


def cmd_download(a):
    os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
    os.environ.setdefault('HF_HUB_VERBOSITY', 'error')   # no "unauthenticated requests" notice: no account is needed
    from huggingface_hub import hf_hub_download
    spec = MODELS[a.model]
    dest = models_dir() / 'whisper' / a.model
    dest.mkdir(parents=True, exist_ok=True)
    for f in spec['files']:
        hf_hub_download(spec['repo'], f, revision=spec['revision'], local_dir=str(dest))
    try:
        verify_folder(dest, a.model)
    except AlignError:
        for f in spec['files']:
            try:
                (dest / f).unlink()
            except OSError:
                pass
        raise
    print(json.dumps({'downloaded': a.model, 'folder': str(dest), 'verified': 'sha256'}))
    return None


def cmd_align(a):
    audio_path = Path(a.audio).expanduser().resolve()
    if not audio_path.is_file():
        raise AlignError('Recording not found: %s' % audio_path.name)
    text = read_script(a.script)
    words = script_words(text)
    if not words:
        raise AlignError('The script has no words to time.')
    out = Path(a.output).expanduser().resolve() if a.output else audio_path.with_name(audio_path.stem + '.words.json')
    if out.exists() and not a.overwrite:
        raise AlignError('Refusing to overwrite %s (pass --output with a new name).' % out.name)
    folder = find_model(a.model, a.model_path)
    if not folder:
        raise AlignError('The "%s" model is not on this computer. Run plan, ask the user, then setup --yes.' % a.model)
    if not a.skip_hash:
        verify_folder(folder, a.model)
    t0 = time.perf_counter()
    from faster_whisper import decode_audio
    audio = decode_audio(str(audio_path), sampling_rate=16000)
    duration = len(audio) / 16000.0
    device, note = 'cpu', None
    try:
        model, device, note = load_model_on(folder, a.threads, a.device)
        try:
            rows, heard, matched = align_audio(model, audio, words, a.language, a.beam, not a.no_snap)
        except (RuntimeError, MemoryError) as e:
            if device != 'cuda' or a.device == 'cuda':
                raise
            note = 'the GPU failed while transcribing (%s): the CPU instead' % str(e)[:120]
            del model
            model, device, _ = load_model_on(folder, a.threads, 'cpu')
            rows, heard, matched = align_audio(model, audio, words, a.language, a.beam, not a.no_snap)
    except (RuntimeError, MemoryError) as e:
        if memory_error(e):
            raise AlignError(MEMORY_HELP) from None
        raise
    t1 = time.perf_counter()
    share = matched / float(len(words))
    result = {
        'source': 'recorded voice aligned to its script with faster-whisper (%s), word starts moved to the sound onsets' % a.model,
        'audio_file': audio_path.name,
        'audio_sha256': sha256_file(audio_path),
        'duration_s': round(duration, 3),
        'script_file': Path(a.script).name,
        'model': a.model,
        'engine': ('faster-whisper %s, GPU (CUDA float16)' % FW_VERSION) if device == 'cuda' else
                  ('faster-whisper %s, CPU int8, %s threads' % (FW_VERSION, a.threads or 'all')),
        'words_heard': matched,
        'words_estimated': len(words) - matched,
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'words': rows,
    }
    if a.debug_heard:
        result['heard'] = heard
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    summary = {'mode': 'aligned', 'output': str(out), 'words': len(words), 'words_heard': matched,
               'words_estimated': [w['word'] for w in words if w.get('estimated')],
               'audio_seconds': round(duration, 2), 'seconds_taken': round(time.perf_counter() - t0, 1),
               'transcribe_seconds': round(t1 - t0, 1), 'device': device}
    if note and device != 'cuda':
        summary['gpu'] = note
    if share < 0.85:
        summary['warning'] = ('Only %d%% of the script was heard: check that the script is exactly what was said '
                              '(skipped or added lines), then look at the estimated words.' % round(100 * share))
    return summary


def build_parser():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd')
    pl = sub.add_parser('plan', help='offline: what is installed and what setup would download (default)')
    pl.add_argument('--model', choices=sorted(MODELS), default=DEFAULT_MODEL)
    se = sub.add_parser('setup', help='one-time install, only with --yes after the user agrees')
    se.add_argument('--model', choices=sorted(MODELS), default=DEFAULT_MODEL)
    se.add_argument('--yes', action='store_true')
    se.add_argument('--gpu', action='store_true', help='also the NVIDIA CUDA libraries (about %d MB, optional)' % GPU_MB)
    dl = sub.add_parser('_download', help=argparse.SUPPRESS)
    dl.add_argument('--model', choices=sorted(MODELS), default=DEFAULT_MODEL)
    sub.add_parser('_gpu', help=argparse.SUPPRESS)
    al = sub.add_parser('align', help='recording + script -> .words.json')
    al.add_argument('--audio', required=True, help='the recording (wav, mp3, m4a, ogg...)')
    al.add_argument('--script', required=True, help='UTF-8 text file with exactly what was said')
    al.add_argument('--output', help='default: <audio stem>.words.json beside the audio')
    al.add_argument('--language', default='ar', help='ISO code of the speech, default ar')
    al.add_argument('--model', choices=sorted(MODELS), default=DEFAULT_MODEL)
    al.add_argument('--model-path', help=argparse.SUPPRESS)
    al.add_argument('--threads', type=int, default=0, help='CPU threads (0 = all)')
    al.add_argument('--device', choices=('auto', 'cuda', 'cpu'), default=DEVICE,
                    help='auto (default): an NVIDIA GPU when its CUDA libraries are there, else the CPU')
    al.add_argument('--beam', type=int, default=5)
    al.add_argument('--no-snap', action='store_true', help=argparse.SUPPRESS)
    al.add_argument('--skip-hash', action='store_true', help=argparse.SUPPRESS)
    al.add_argument('--debug-heard', action='store_true', help=argparse.SUPPRESS)
    al.add_argument('--overwrite', action='store_true', help=argparse.SUPPRESS)
    return p


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    parser = build_parser()
    a = parser.parse_args(argv)
    if a.cmd is None:
        a = parser.parse_args(['plan'])
    if a.cmd in ('align', '_download', '_gpu') and not fw_importable() and not in_private_env():
        reexec_in_env(argv)
    handler = {'plan': cmd_plan, 'setup': cmd_setup, '_download': cmd_download, 'align': cmd_align,
               '_gpu': cmd_gpu}[a.cmd]
    result = handler(a)
    if result is not None:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except AlignError as e:
        print('ERROR: ' + str(e), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('ERROR: interrupted.', file=sys.stderr)
        sys.exit(1)
