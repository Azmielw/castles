# audio.py — موسيقى ومؤثرات أصلية مُركّبة رقميًا + مكساج مع التعليق الصوتي
# الاستخدام: python3 src/audio.py <info.json> <out.wav> [narration.wav]
import json, sys, subprocess, numpy as np

SR = 48000
rng = np.random.default_rng(42)  # بذرة ثابتة


def env(n, a=0.005, r=0.2, sus=1.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4)) * sus
    return e


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y


def noise(n):
    return rng.standard_normal(n)


def sfx(kind, dur=None):
    if kind == 'wind':
        n = int(SR * (dur or 2)); x = noise(n)
        x = onepole_lp(x, 500) - onepole_lp(x, 120)
        t = np.linspace(0, 1, n); e = np.sin(np.pi * t) ** 1.5
        return x * e * 2.2
    if kind == 'snap':
        n = int(SR * 0.25); t = np.arange(n) / SR
        return (noise(n) * env(n, 0.0005, 0.01) * 0.9 + np.sin(2 * np.pi * 1800 * t) * env(n, 0.0005, 0.03) * 0.5)
    if kind == 'whoosh':
        n = int(SR * 0.55); x = noise(n)
        t = np.linspace(0, 1, n)
        lo = onepole_lp(x, 1800); hi = onepole_lp(x, 300)
        return (lo - hi) * np.sin(np.pi * t) ** 2 * 1.6
    if kind == 'jump':
        n = int(SR * 0.28); t = np.arange(n) / SR
        f = 220 + 520 * (t / t[-1]); ph = 2 * np.pi * np.cumsum(f) / SR
        return np.sin(ph) * env(n, 0.005, 0.12) * 0.45
    if kind in ('land', 'thud'):
        n = int(SR * 0.45); t = np.arange(n) / SR
        f = 90 * np.exp(-t * 6) + 45; ph = 2 * np.pi * np.cumsum(f) / SR
        return np.sin(ph) * env(n, 0.002, 0.12) * 1.0 + onepole_lp(noise(n), 400) * env(n, 0.001, 0.04) * 1.2
    if kind in ('wood', 'step'):
        n = int(SR * 0.2); t = np.arange(n) / SR
        g = 0.7 if kind == 'wood' else 0.3
        return (np.sin(2 * np.pi * 620 * t) + 0.5 * np.sin(2 * np.pi * 1130 * t)) * env(n, 0.0005, 0.035) * g + noise(n) * env(n, 0.0003, 0.006) * g * 0.6
    if kind == 'clang':
        n = int(SR * 1.4); t = np.arange(n) / SR
        parts = [(523, 1, 0.5), (1312, 0.6, 0.35), (2161, 0.45, 0.25), (3170, 0.3, 0.15), (4410, 0.2, 0.1)]
        x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in parts)
        th = np.pad(sfx('thud'), (0, n - int(SR * 0.45)))
        return x * 0.5 + th * 0.6 + noise(n) * env(n, 0.0003, 0.015)
    if kind == 'clunk':
        n = int(SR * 0.5); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 180 * t) + 0.6 * np.sin(2 * np.pi * 470 * t)) * env(n, 0.001, 0.06) * 0.7 + noise(n) * env(n, 0.0005, 0.01) * 0.4
    if kind in ('creak', 'creak2'):
        L = 0.9 if kind == 'creak' else 0.7
        n = int(SR * L); t = np.arange(n) / SR
        f = 95 + 40 * np.sin(2 * np.pi * 1.3 * t) + 25 * t / L
        ph = 2 * np.pi * np.cumsum(f) / SR
        saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
        grit = (np.sin(2 * np.pi * 23 * t) > 0.2).astype(float) * 0.6 + 0.4
        x = onepole_lp(saw * grit, 1500)
        e = np.minimum(1, t / 0.05) * np.minimum(1, (L - t) / 0.15)
        return x * e * 0.55
    if kind in ('ding', 'ding2'):
        n = int(SR * 1.6); t = np.arange(n) / SR
        fs = [1318.5, 2637] if kind == 'ding' else [880, 1108.7, 1318.5]
        x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.5) / (i + 1) for i, f in enumerate(fs))
        return x * env(n, 0.002, 10) * 0.35
    raise ValueError(kind)


def pluck(f, n, decay=0.45):
    t = np.arange(n) / SR
    x = sum((0.6 ** k) * np.sin(2 * np.pi * f * (k + 1) * t) for k in range(5))
    return x * np.minimum(1, t / 0.004) * np.exp(-t / decay)


def music(dur):
    # موسيقى أصلية هادئة: 96 bpm، سلم خماسي في ري الكبير، تتغير الطبقة عند الكشف
    n = int(SR * dur); out = np.zeros(n)
    bpm = 96; beat = 60 / bpm
    D = 293.66
    scale = [0, 2, 4, 7, 9, 12, 14, 16]
    melody = [0, 4, 7, 4, 9, 7, 4, 2, 0, 2, 4, 7, 12, 9, 7, 4]
    bass = [0, 0, -5, -5, -3, -3, -7, -7]
    hz = lambda semi, base=D: base * 2 ** (semi / 12)
    i = 0; t0 = 0.0
    while t0 < dur:
        s = int(t0 * SR)
        note = melody[i % len(melody)]
        if i % 2 == 0 or i % 16 > 11:
            m = int(SR * 0.9); seg_ = pluck(hz(note), min(m, n - s)) * 0.16
            out[s:s + len(seg_)] += seg_
        if i % 4 == 0:
            b = bass[(i // 4) % len(bass)]
            m = int(SR * beat * 4); seg_ = pluck(hz(b - 12), min(m, n - s), 1.2) * 0.2
            out[s:s + len(seg_)] += seg_
        # نقرة إيقاع خفيفة
        if i % 2 == 1:
            m = int(SR * 0.05); k = noise(min(m, n - s)) * env(min(m, n - s), 0.0005, 0.008) * 0.05
            out[s:s + len(k)] += k
        i += 1; t0 += beat / 2
    # وسادة ناعمة
    t = np.arange(n) / SR
    pad = sum(np.sin(2 * np.pi * hz(x - 12) * t + x) for x in (0, 4, 7)) * 0.03
    pad *= 0.6 + 0.4 * np.sin(2 * np.pi * t / 8)
    return out + pad


def place(buf, x, t, gain=1.0):
    s = int(t * SR)
    if s >= len(buf): return
    x = x[:len(buf) - s]; buf[s:s + len(x)] += x * gain


def main():
    info = json.load(open(sys.argv[1])); out = sys.argv[2]
    narr = sys.argv[3] if len(sys.argv) > 3 else None
    timing = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else None
    dur = info['dur']; n = int(SR * dur)
    mus = music(dur)
    fx = np.zeros(n)
    gains = {'wind': 0.5, 'snap': 0.8, 'whoosh': 0.5, 'jump': 0.6, 'land': 0.8, 'wood': 0.7, 'step': 0.6,
             'clang': 0.9, 'clunk': 0.7, 'thud': 0.8, 'creak': 0.8, 'creak2': 0.7, 'ding': 0.6, 'ding2': 0.6}
    for c in info['cues']:
        place(fx, sfx(c['type'], c.get('dur')), max(0, c['t']), gains[c['type']])
    voice = np.zeros(n)
    duck = np.ones(n)
    if narr:
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', narr, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                             capture_output=True, check=True).stdout
        v = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
        voice[:min(n, len(v))] = v[:n]
        # خفض الموسيقى أثناء الكلام (من خريطة التوقيت)
        if timing:
            for l in timing['lines']:
                a, b = int((l['start'] - 0.15) * SR), int((l['end'] + 0.25) * SR)
                duck[max(0, a):min(n, b)] = 0.45
            k = int(SR * 0.12); ker = np.ones(k) / k
            duck = np.convolve(duck, ker, mode='same')
    # الموسيقى أعلى قليلًا في الذيل ونهاية الحلقة
    mix = voice * 1.0 + mus * duck * 0.55 + fx * 0.55
    # تلاشي البداية/النهاية للموسيقى فقط حتى لا تقطع الكلام
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.89  # ذروة عينة ≈ -1 dBFS (ليست قياس ذروة حقيقية)
    st = np.stack([mix, mix], axis=1).astype(np.float32)
    p = subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
                        '-c:a', 'pcm_s16le', out], input=st.tobytes(), check=True)
    print('wrote', out, 'dur', round(dur, 3), 'sample-peak-before-norm', round(float(peak), 3))


if __name__ == '__main__':
    main()
