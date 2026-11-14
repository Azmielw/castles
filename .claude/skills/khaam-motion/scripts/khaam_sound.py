"""Shared sound helpers for «موشن خام» 1.7 (beds, material effects, the film mix and its check).

NumPy + SciPy only. Everything is made at 48 kHz in float64 and written as 16-bit PCM WAV with TPDF dither.
The code-made sounds here are made from a seed, so the same seed gives the same file. Since 2026-11-12 (sound v2) they
are sketches only: a final video uses real recordings (the small CC0 library in sounds/library/, or the Openverse route),
and the bed is a real recording of the place or nothing. static_floor() and buzz() measure what the owner heard as
«تشويش» (a synthesised bed) and as a fly (a noise under a 70-140 Hz wobble).

Loudness follows ITU-R BS.1770-4 / EBU R128 (K-weighting, 400 ms blocks, gates at -70 LUFS and -10 LU);
true peak is read on a 4x oversampled signal. check_mix.py cross-checks both with FFmpeg's ebur128 filter.
"""
import json, os, pathlib, shutil, subprocess, sys
import numpy as np
from scipy.signal import sosfilt, resample_poly, butter
from scipy.io import wavfile

for _s in (sys.stdout, sys.stderr):  # Arabic paths on a cp1252 console
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

SR = 48000

# Where things sit (reference/film-sound.md). Round 1 (2026-11-12 morning, after the first listen: the voiceless samples
# were "far too loud"), then v2 the same day (the owner's second listen: a continuous «تشويش» under all three, which was the
# synthesised bed, a written «؟» like a fly, a candle like a crack; and still a bit loud). A voice sits at -14 LUFS. With no
# voice nothing comes near it: the strongest effect's loudest 400 ms at -24, the loudest moment at most -22, and no
# integrated target. A bed is a real recording of the place, its loudest 400 ms at -34 (with a voice: 20 dB under it) and
# any static floor in it at -56; or no bed at all.
FILM_SOUND = dict(
    voice_lufs=-14.0,          # narrated: the voice, integrated
    effects_top=-24.0,         # no voice: the strongest effect's momentary max (LUFS); others lower by their gain_db (v2; was -20)
    effects_db=-12.0,          # with a voice: the strongest effect this far under the voice, ducked 6 dB under every word
    duck_db=6.0,               # with a voice: effects ducked this much under every spoken word
    bed_top=-34.0,             # a real bed: its loudest 400 ms (no voice); with a voice, voice - 20 (= -34 too)
    bed_static_floor=-56.0,    # a real bed: any static floor in it (a noise-like stretch that holds still) sits at most here
    bed_lufs=-29.0,            # sketch only (a code-made bed, "sketch": true): its integrated level; never in a final video
    loudest_max=-22.0,         # no voice: the mix's momentary max may not pass this (v2; was -18)
    loudest_over_bed=13.0,     # round 1, sketch only: loudest moment over a code-made bed (not judged in v2)
    harsh_max=-28.0,           # 2-6 kHz band, momentary max (LUFS): of the mix with no voice; of bed + effects with a voice (v2; was -24)
    harsh_cap=-29.0,           # the mixer turns any effect whose 2-6 kHz band passes this down to it
    long_s=1.2,                # an effect may hold within 6 dB of its own top this long...
    long_top=-27.0,            # ...or its top sits this low (no voice; v2; was -23)
    phone_max=-22.0,           # no voice: the loudest 400 ms through a phone speaker (mono, 400 Hz-8 kHz)
    phone_over_bed=18.0,       # round 1, sketch only (not judged in v2)
    integrated_max=-24.0,      # no voice: an integrated loudness above this means effects near speech level (v2; was -18)
    integrated_low=-36.0,      # no voice: under this, warn (v2; was -30)
    heard_min=-34.0,           # no voice: every effect's top at least this (else a phone loses it): warn
    whine_fail_above=-30.0,    # a rising whine (pitch climbing into 2.5 kHz+ as it swells) fails above this top, warns under
    static_fail=-50.0,         # a static floor (5 s windows) louder than this fails: it is heard as «تشويش»
    static_warn=-55.0,         # ...and from here to static_fail it warns
    buzz_fail=15.0,            # an effect over buzz_min_top with a narrow 60-300 Hz envelope peak this high (dB) reads as a fly
    buzz_min_top=-34.0,
)


def harsh_band(x):
    """The 2-6 kHz band (4th-order Butterworth), where the ear and a phone speaker are most sensitive; stereo."""
    return sosfilt(butter(4, [2000, 6000], fs=SR, btype='bandpass', output='sos'), as_stereo(x), axis=0)


def near_top(y):
    """(top, held): a sound's loudest 400 ms (LUFS) and how long (s, 400 ms blocks at a 20 ms hop) it stays within 6 dB of
    it. The mixer and the check measure an effect's span on the effects stem with this, overlaps included."""
    y = as_stereo(y)
    if len(y) < int(0.4 * SR):
        y = np.pad(y, ((0, int(0.4 * SR) - len(y)), (0, 0)))
    _, m = block_loudness(y, 0.4, 0.02)
    top = float(m.max())
    return top, float((m >= top - 6).sum()) * 0.02


def phone_path(x):
    """A phone speaker, roughly: the mono sum, high-passed at 400 Hz and low-passed at 8 kHz (4th order each); stereo."""
    m = as_stereo(x).mean(1)
    m = sosfilt(butter(4, 400, fs=SR, btype='highpass', output='sos'), m)
    m = sosfilt(butter(4, 8000, fs=SR, btype='lowpass', output='sos'), m)
    return np.stack([m, m], 1)


# ---------------------------------------------------------------- noise and control signals
def rng_for(seed, salt=0):
    return np.random.default_rng([int(seed) & 0xFFFFFFFF, int(salt) & 0xFFFFFFFF])


def shaped_noise(n, rng, curve):
    """White noise shaped in the frequency domain by curve(f) (an amplitude curve, f in Hz).
    The result is circular: x followed by x has no seam, so a bed made this way loops cleanly."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1] if n > 1 else 1.0
    spec *= curve(f)
    spec[0] = 0.0
    x = np.fft.irfft(spec, n)
    s = x.std()
    return x / s if s > 0 else x


def slow(n, rng, rate_hz, octaves=3):
    """A smooth random control signal (about zero mean, unit spread) that moves no faster than rate_hz.
    Built from a few octaves (a 1/f-like wander), circular like shaped_noise."""
    out = np.zeros(n)
    for k in range(octaves):
        r = rate_hz / (2 ** k)
        out += (0.6 ** k) * shaped_noise(n, rng, lambda f, r=r: np.exp(-(f / r) ** 2))
    s = out.std()
    return out / s if s > 0 else out


def lp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order))


def bell(fc, q=1.0):
    """A band on a log-frequency axis: q is roughly the inverse width in octaves."""
    return lambda f: np.exp(-0.5 * (np.log2(f / fc) * q * 2) ** 2)


def tilt(power):
    """power -0.5 = pink, -1 = brown (amplitude curve f**power), referenced to 1 kHz."""
    return lambda f: (f / 1000.0) ** power


def chain(*curves):
    def c(f):
        out = np.ones_like(f)
        for k in curves:
            out = out * k(f)
        return out
    return c


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], fs=SR, btype='bandpass', output='sos'), x)


def lowpass(x, fc, order=2):
    return sosfilt(butter(order, fc, fs=SR, btype='lowpass', output='sos'), x)


def highpass(x, fc, order=2):
    return sosfilt(butter(order, fc, fs=SR, btype='highpass', output='sos'), x)


def env_ar(n, attack, release, shape=2.0):
    """Attack/decay envelope over n samples (attack and release in seconds)."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1) ** shape
    r = np.exp(-np.maximum(t - attack, 0) / max(release, 1e-4))
    return a * r


def fades(x, fade_in=0.003, fade_out=0.01):
    n = len(x)
    i, o = min(int(fade_in * SR), n // 2), min(int(fade_out * SR), n // 2)
    w = np.ones(n)
    if i: w[:i] = np.sin(np.linspace(0, np.pi / 2, i)) ** 2
    if o: w[n - o:] = np.cos(np.linspace(0, np.pi / 2, o)) ** 2
    return x * (w[:, None] if x.ndim == 2 else w)


def add_at(buf, ev, start, wrap=False):
    """Add ev (mono or stereo) into buf from sample start; wrap=True folds the tail onto the start (circular beds)."""
    n = len(buf)
    if ev.ndim == 1 and buf.ndim == 2:
        ev = np.stack([ev, ev], 1)
    if wrap:
        idx = (start + np.arange(len(ev))) % n
        np.add.at(buf, idx, ev)
        return
    a, b = max(start, 0), min(start + len(ev), n)
    if b > a:
        buf[a:b] += ev[a - start:b - start]


def pan(mono, p):
    """Equal-power pan, p from -1 (left) to 1 (right)."""
    th = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], 1)


def stereo_pair(make, n, rng, common=0.4):
    """Two partly correlated channels from a mono generator make(rng) -> array of n."""
    m, l, r = make(rng), make(rng), make(rng)
    c, s = np.sqrt(common), np.sqrt(1 - common)
    return np.stack([c * m + s * l, c * m + s * r], 1)


def diffuse(x, rng, tail=0.18, wet=0.3, bright=5000):
    """A short soft space (exponentially decaying filtered noise impulse response, different per channel)."""
    m = int(tail * SR)
    t = np.arange(m) / SR
    out = []
    xs = x if x.ndim == 2 else np.stack([x, x], 1)
    for ch in range(2):
        ir = lowpass(rng.standard_normal(m), bright, 1) * np.exp(-t / (tail / 5))
        ir /= np.sqrt((ir ** 2).sum()) + 1e-12
        w = np.fft.irfft(np.fft.rfft(xs[:, ch], len(xs) + m) * np.fft.rfft(ir, len(xs) + m), len(xs) + m)
        if True:  # circular fold so the bed stays seamless
            w[:m] += w[len(xs):]
        out.append((1 - wet) * xs[:, ch] + wet * w[:len(xs)])
    return np.stack(out, 1)


# ---------------------------------------------------------------- loudness (BS.1770-4)
def _k_sos(sr=SR):
    # pre-filter (high shelf) and RLB high-pass, derived for any rate as in BS.1770 / pyloudnorm
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / sr)
    a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    b2 = [1, -2, 1]
    return np.array([b1 + a1, b2 + a2])


def as_stereo(x):
    x = np.asarray(x, float)
    return np.stack([x, x], 1) if x.ndim == 1 else x


def block_loudness(x, block=0.4, hop=0.1):
    """Loudness (LUFS) of each block; returns (times of block starts, values)."""
    x = as_stereo(x)
    k = sosfilt(_k_sos(), x, axis=0)
    p = (k ** 2).sum(1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    nb, nh = int(block * SR), int(hop * SR)
    if len(p) < nb:
        ms = np.array([p.mean() if len(p) else 0.0]); starts = np.array([0])
    else:
        starts = np.arange(0, len(p) - nb + 1, nh)
        ms = (c[starts + nb] - c[starts]) / nb
    return starts / SR, -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))


def integrated_lufs(x):
    _, l = block_loudness(x)
    l = l[l > -70]
    if not len(l):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(10 ** ((l + 0.691) / 10))) - 10
    g = l[l > rel]
    return float(-0.691 + 10 * np.log10(np.mean(10 ** ((g + 0.691) / 10))))


def loudness_range(x):
    _, s = block_loudness(x, 3.0, 0.1)
    s = s[s > -70]
    if len(s) < 2:
        return 0.0
    rel = -0.691 + 10 * np.log10(np.mean(10 ** ((s + 0.691) / 10))) - 20
    s = s[s > rel]
    return float(np.percentile(s, 95) - np.percentile(s, 10)) if len(s) > 1 else 0.0


def momentary_max(x):
    _, m = block_loudness(x, 0.4, 0.05)
    return float(m.max())


def true_peak_db(x, chunk_s=2.0):
    """True peak (dBTP) on a 4x oversampled signal, read in 2 s chunks with a 50 ms overlap: the same number as one pass,
    in a fraction of the memory (one pass ran out of memory twice on a busy PC, 2026-11-12)."""
    x = as_stereo(x)
    n, c, ov = len(x), int(chunk_s * SR), int(0.05 * SR)
    peak = 0.0
    for s0 in range(0, max(n, 1), c):
        seg = x[max(0, s0 - ov):min(n, s0 + c + ov)]
        if len(seg):
            peak = max(peak, float(np.abs(resample_poly(seg, 4, 1, axis=0)).max()))
    return float(20 * np.log10(max(peak, 1e-12)))


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


# ---------------------------------------------------------------- limiter and mastering
def tp_limit(x, ceiling_db=-1.5, lookahead=0.004, release=0.12):
    """Look-ahead limiter driven by the 4x oversampled peak, so true peak (not only sample peak) stays under the ceiling."""
    x = as_stereo(x)
    c = 10 ** (ceiling_db / 20)
    up = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
    pk = up[: len(x) * 4].reshape(-1, 4).max(1) if len(up) >= len(x) * 4 else np.pad(up, (0, len(x) * 4 - len(up))).reshape(-1, 4).max(1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    if g.min() >= 1.0:
        return x
    L = max(1, int(lookahead * SR))
    # moving minimum over the look-ahead window, then a box average of the same width: the gain is fully down at the peak
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    gm = minimum_filter1d(g, size=2 * L + 1, mode='nearest')
    gs = uniform_filter1d(gm, size=L, mode='nearest')
    gs = np.minimum(gs, gm)
    a = np.exp(-1 / (release * SR))
    out = np.empty_like(gs); prev = 1.0
    for i, v in enumerate(gs):  # release: recover slowly, never faster than one pole
        prev = v if v < prev else a * prev + (1 - a) * v
        out[i] = prev
    return x * out[:, None]


def master(x, lufs=-14.0, ceiling_db=-1.5, rounds=10):
    """One gain to the target loudness + the true-peak limiter; the gain is corrected until both hold. Returns (signal, report).
    The limiter always works on the clean signal (never on an already limited one), so it is applied once per round, not stacked."""
    x = as_stereo(x)
    g = lufs - integrated_lufs(x)
    y = x
    for _ in range(rounds):
        y = tp_limit(x * 10 ** (g / 20), ceiling_db - 0.1)
        err = lufs - integrated_lufs(y)
        if abs(err) < 0.1 and true_peak_db(y) <= ceiling_db:
            break
        g += err
    return y, {'integrated_lufs': round(integrated_lufs(y), 2), 'true_peak_dbtp': round(true_peak_db(y), 2),
               'lra': round(loudness_range(y), 2), 'gain_db': round(float(g), 2)}


# ---------------------------------------------------------------- files
def write_wav(path, x, peak_guard=True):
    """16-bit PCM WAV, TPDF dither. Refuses to clip."""
    path = pathlib.Path(path)
    x = as_stereo(x) if np.asarray(x).ndim == 2 else np.asarray(x, float)
    if peak_guard and np.abs(x).max() >= 1.0:
        raise SystemExit(f'{path.name}: would clip (peak {db(np.abs(x).max()):.2f} dBFS); lower the level first.')
    rng = np.random.default_rng(12345)
    d = (rng.random(x.shape) - rng.random(x.shape))  # TPDF, +-1 LSB
    q = np.clip(np.rint(x * 32767 + d), -32768, 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), SR, q)
    return path


def ffmpeg_bin():
    """FFmpeg as the rest of the skill finds it (KHAAM_FFMPEG or .khaam/config.json first, then PATH)."""
    try:
        from khaam_paths import executable
        return executable('ffmpeg')
    except Exception:
        return shutil.which('ffmpeg')


def read_audio(path):
    """Any audio or video file -> float stereo at 48 kHz (through FFmpeg when it is not a plain WAV)."""
    path = pathlib.Path(path)
    if path.suffix.lower() == '.wav':
        try:
            sr, d = wavfile.read(str(path))
            if d.dtype.kind == 'i':
                d = d / float(np.iinfo(d.dtype).max + 1)
            elif d.dtype.kind == 'u':
                d = (d - 128) / 128.0
            d = as_stereo(d.astype(float))
            if sr != SR:
                d = resample_poly(d, SR, sr, axis=0)
            return d[:, :2]
        except ValueError:
            pass
    ff = ffmpeg_bin()
    if not ff:
        raise SystemExit('FFmpeg not found (needed to read this file). Install: winget install Gyan.FFmpeg / brew install ffmpeg')
    raw = subprocess.run([ff, '-v', 'error', '-i', str(path), '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(float).reshape(-1, 2)


def normalise_loudness(x, lufs):
    cur = integrated_lufs(x)
    return x * 10 ** ((lufs - cur) / 20)



# ---------------------------------------------------------------- v2 measures (2026-11-12): static floor and buzz
def _flatness(F, w):
    S = (np.abs(np.fft.rfft(F * np.hanning(w), axis=1)) ** 2).mean(0)
    f = np.fft.rfftfreq(w, 1 / SR)
    edges = 300 * 2 ** (np.arange(0, np.log2(8000 / 300) + 1e-9, 1 / 6))
    pb = np.array([S[(f >= a) & (f < b)].mean() for a, b in zip(edges[:-1], edges[1:]) if ((f >= a) & (f < b)).any()])
    return float(np.exp(np.mean(np.log(pb + 1e-30))) / (pb.mean() + 1e-30))


def static_floor(x, win_s=5.0, hop_s=2.5):
    """The «تشويش» measure. Per 5 s window (hop 2.5 s): the frames between events = the quietest 30% of 100 ms frames;
    their K-weighted level (LUFS), their spread (sd, dB) and the flatness of their summed spectrum (300 Hz-8 kHz,
    1/6 octave; 1 = white noise). A window is STATIC when the spread is under 3 dB (the floor holds still) and the
    flatness is at least 0.12 (noise, not tones). Returns (the loudest static window or None, every window)."""
    x = as_stereo(x)
    k = sosfilt(_k_sos(), x, axis=0); p = (k ** 2).sum(1)
    m = x.mean(1); w = int(0.1 * SR); n = len(p) // w
    if n < 5:
        return None, []
    lv = -0.691 + 10 * np.log10(np.maximum(p[:n * w].reshape(n, w).mean(1), 1e-20))
    F = m[:n * w].reshape(n, w)
    worst, rows = None, []
    W, H = int(win_s / 0.1), int(hop_s / 0.1)
    for s in range(0, max(1, n - W + 1), H):
        seg = lv[s:s + W]
        q = seg <= np.percentile(seg, 30)
        if q.sum() < 5:
            continue
        lvl = float(10 * np.log10(np.mean(10 ** (seg[q] / 10))))
        sd = float(np.std(seg[q]))
        fl = _flatness(F[s:s + W][q], w) if lvl > -90 else 0.0
        r = {'at_s': round(s * 0.1, 1), 'floor_lufs': round(lvl, 1), 'spread_db': round(sd, 1), 'flatness': round(fl, 3),
             'static': bool(sd < 3.0 and fl >= 0.12 and lvl > -90)}
        rows.append(r)
        if r['static'] and (worst is None or r['floor_lufs'] > worst['floor_lufs']):
            worst = r
    return worst, rows


def buzz(y):
    """The fly measure: the envelope (500 Hz-8 kHz band, Hilbert) of a sound, its spectrum between 60 and 300 Hz, and the
    highest narrow peak over the median of its own half-octave neighbourhood, in dB, with its frequency. A wing beat or a
    hum is a narrow peak there (the 1.7 ink.stroke: 17.6-22.7 dB); scraping, steps, taps and flaps are not (real
    recordings 3-13.4 dB). One recording repeated at an exact interval combs the envelope too (a footstep copied three
    times: 17 dB): never repeat one recording at an exact interval."""
    from scipy.signal import hilbert
    from scipy.fft import next_fast_len
    m = as_stereo(y).mean(1)
    if len(m) < int(0.3 * SR):
        m = np.pad(m, (0, int(0.3 * SR) - len(m)))
    b = sosfilt(butter(4, [500, 8000], fs=SR, btype='bandpass', output='sos'), m)
    e = np.abs(hilbert(b, next_fast_len(len(b))))[:len(b)]
    e = e - e.mean()
    n2 = next_fast_len(max(len(e), 4 * SR // 10))
    E = np.abs(np.fft.rfft(e * np.hanning(len(e)), n2)) ** 2
    f = np.fft.rfftfreq(n2, 1 / SR)
    best = (0.0, 0.0)
    for i in np.nonzero((f >= 60) & (f <= 300))[0]:
        nb = (f >= f[i] / 1.41) & (f <= f[i] * 1.41)
        r = 10 * np.log10((E[i] + 1e-30) / (np.median(E[nb]) + 1e-30))
        if r > best[0]:
            best = (round(float(r), 1), round(float(f[i]), 1))
    return best


def skill_dir():
    """The skill's own folder (this file sits in <skill>/scripts/)."""
    return pathlib.Path(__file__).resolve().parent.parent


def library_file(name):
    """A real recording from the skill's small CC0 library (sounds/library/, licences in its MANIFEST.md), by name:
    "chalk-short" or "chalk-short.flac"."""
    lib = skill_dir() / 'sounds' / 'library'
    stem = pathlib.Path(str(name)).stem
    for ext in ('.flac', '.wav'):
        if (lib / (stem + ext)).is_file():
            return lib / (stem + ext)
    have = sorted(p.stem for p in lib.glob('*.flac')) if lib.is_dir() else []
    raise SystemExit(f'No "{name}" in the library ({lib}). It has: {", ".join(have) or "nothing (is the skill complete?)"}. '
                     'Its MANIFEST.md says what each one is for.')

def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=1)
