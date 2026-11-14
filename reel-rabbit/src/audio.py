# audio.py — موسيقى ومؤثرات أصلية مركّبة رقميًا + مكساج (ومع التعليق الصوتي إن وُجد)
# الاستخدام: python3 src/audio.py <info.json> <out.wav> [narration] [timing.json]
import json, sys, subprocess, numpy as np
SR = 48000
rng = np.random.default_rng(7)

def tt(n): return np.arange(n) / SR
def env(n, a=0.005, r=0.2): t = tt(n); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))
def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y
def noise(n): return rng.standard_normal(n)
def tone(f, dur, r=0.2, a=0.004, harm=(1,)):
    n = int(SR * dur); t = tt(n); return sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm)) * env(n, a, r)
def sweep(f0, f1, dur, r=0.2):
    n = int(SR * dur); t = tt(n); f = f0 + (f1 - f0) * (t / t[-1]); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, r)
def seq(notes, step, dur, r=0.25, harm=(1, 0.4, 0.15)):
    out = np.zeros(int(SR * (step * len(notes) + dur)))
    for i, f in enumerate(notes):
        x = tone(f, dur, r, harm=harm); s = int(i * step * SR); out[s:s + len(x)] += x
    return out

_cache = {}
def sfx(kind):
    if kind in _cache: return _cache[kind]
    N = lambda d: int(SR * d)
    if kind == 'whoosh': n = N(0.5); x = noise(n); x = (lp(x, 2200) - lp(x, 350)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * 1.5
    elif kind == 'step': n = N(0.09); x = lp(noise(n), 900) * env(n, 0.001, 0.018) * 1.6 + tone(140, 0.09, 0.02) * 0.5
    elif kind == 'skid': n = N(0.38); x = (lp(noise(n), 3500) - lp(noise(n), 900)) * env(n, 0.01, 0.13) * 1.3
    elif kind == 'pop': x = sweep(380, 900, 0.12, 0.05) * 0.8
    elif kind == 'pop2': x = sweep(520, 1100, 0.1, 0.04) * 0.6
    elif kind == 'tick': x = tone(1500, 0.06, 0.012) * 0.5
    elif kind == 'boing': n = N(0.45); t = tt(n); f = 300 + 180 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 5) + 250 * t; x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.16) * 0.6
    elif kind == 'jump': x = sweep(240, 760, 0.26, 0.11) * 0.55
    elif kind == 'thud': n = N(0.4); t = tt(n); f = 95 * np.exp(-t * 6) + 45; x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.11) + lp(noise(n), 500) * env(n, 0.001, 0.04) * 1.2
    elif kind == 'drain': x = seq([523, 440, 349, 262], 0.07, 0.16, 0.07, harm=(1, 0.5, 0.25)) * 0.45
    elif kind == 'charge': x = seq([262, 330, 392, 523, 659, 784], 0.055, 0.2, 0.09) * 0.4
    elif kind == 'ding': x = tone(1318.5, 1.2, 0.4, harm=(1, 0.5)) * 0.4
    elif kind == 'lock': x = seq([988, 1318.5], 0.09, 0.9, 0.3, harm=(1, 0.5)) * 0.45
    elif kind == 'slow': x = sweep(600, 180, 0.7, 0.4) * 0.3
    elif kind == 'sad': x = seq([392, 370, 349, 294], 0.26, 0.7, 0.4, harm=(1, 0.3)) * 0.4
    elif kind == 'night':
        n = N(1.6); t = tt(n); x = np.sin(2 * np.pi * 4200 * t) * (np.sin(2 * np.pi * 26 * t) > 0.3) * (np.sin(2 * np.pi * 2.2 * t) > 0) * np.sin(np.pi * t / t[-1]) * 0.07
    elif kind == 'rise': x = seq([392, 494, 587, 784, 988], 0.11, 0.7, 0.35) * 0.4
    elif kind == 'rustle':
        n = N(0.5); x = (lp(noise(n), 6000) - lp(noise(n), 1500)) * (0.5 + 0.5 * np.sin(2 * np.pi * 21 * tt(n))) * env(n, 0.01, 0.16) * 1.2
    elif kind == 'fanfare': x = seq([523, 659, 784, 1047, 784, 1047, 1319], 0.085, 1.0, 0.45, harm=(1, 0.5, 0.3, 0.15)) * 0.5
    elif kind == 'buzz': n = N(0.3); t = tt(n); x = np.sign(np.sin(2 * np.pi * 150 * t)) * env(n, 0.005, 0.12) * 0.22
    elif kind == 'sparkle': x = seq([1568, 1976, 2349, 3136, 2637, 3520], 0.06, 0.5, 0.2, harm=(1,)) * 0.25
    else: raise ValueError(kind)
    _cache[kind] = x; return x

def pluck(f, n, decay=0.4):
    t = tt(n); return sum((0.55 ** k) * np.sin(2 * np.pi * f * (k + 1) * t) for k in range(5)) * np.minimum(1, t / 0.004) * np.exp(-t / decay)

def music(dur):
    # موسيقى أصلية مرحة: 112 bpm، ري كبير، باص + لحن + نقر خفيف
    n = int(SR * dur); out = np.zeros(n); beat = 60 / 112; D = 293.66
    hz = lambda s: D * 2 ** (s / 12)
    mel = [0, 4, 7, 9, 7, 4, 2, 4, 0, 4, 7, 12, 9, 7, 4, 7, 5, 9, 12, 9, 7, 4, 2, 0, -3, 0, 4, 7, 4, 2, 0, 2]
    bass = [0, 0, -5, -5, 5, 5, -3, -5]
    i = 0; t0 = 0.0
    while t0 < dur:
        s = int(t0 * SR)
        if i % 4 != 3:
            x = pluck(hz(mel[i % len(mel)] + 12), min(int(SR * 0.6), n - s), 0.28) * 0.11; out[s:s + len(x)] += x
        if i % 2 == 0:
            x = pluck(hz(bass[(i // 4) % len(bass)] - 12), min(int(SR * 0.5), n - s), 0.35) * 0.2; out[s:s + len(x)] += x
        if i % 2 == 1:
            m = min(int(SR * 0.04), n - s); out[s:s + m] += noise(m) * env(m, 0.0005, 0.007) * 0.06
        if i % 4 == 0:
            m = min(int(SR * 0.2), n - s); t = tt(m); out[s:s + m] += np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 14) + 48) / SR) * env(m, 0.002, 0.07) * 0.28
        i += 1; t0 += beat / 2
    return out

def main():
    info = json.load(open(sys.argv[1])); out = sys.argv[2]
    narr = sys.argv[3] if len(sys.argv) > 3 else None
    timing = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else None
    dur = info['dur']; n = int(SR * dur); t = tt(n)
    pts = info.get('env') or [[0, 1], [dur, 1]]
    genv = np.interp(t, [p[0] for p in pts], [p[1] for p in pts])
    mus = music(dur) * genv
    fx = np.zeros(n)
    for c in info['cues']:
        x = sfx(c['type']) * c.get('gain', 1.0) * (0.45 if c['type'] == 'step' else 1.0); s = int(c['t'] * SR)
        if s < n: x = x[:n - s]; fx[s:s + len(x)] += x
    voice = np.zeros(n); duck = np.ones(n)
    if narr:
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', narr, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
        v = np.frombuffer(raw, dtype=np.float32).astype(np.float64); voice[:min(n, len(v))] = v[:n]
        if timing:
            for l in timing['lines']:
                a, b = int((l['start'] - 0.15) * SR), int((l['end'] + 0.25) * SR); duck[max(0, a):min(n, b)] = 0.4
            k = int(SR * 0.12); duck = np.convolve(duck, np.ones(k) / k, mode='same')
    mix = voice + mus * duck * (0.5 if narr else 0.9) + fx * (0.5 if narr else 0.8)
    peak = float(np.max(np.abs(mix))) + 1e-9; mix = mix / peak * 0.89
    st = np.stack([mix, mix], axis=1).astype(np.float32)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', out], input=st.tobytes(), check=True)
    print('wrote', out, 'dur', round(dur, 3), 'peak-before-norm', round(peak, 3))

if __name__ == '__main__': main()
