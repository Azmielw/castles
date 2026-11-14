#!/usr/bin/env python3
"""SKETCHES ONLY since 2026-11-12 (sound v2): every bed here is code-made noise, and each one holds still between the sounds: the owner heard it as a continuous «تشويش». A final video gets a real recording of the place with sparse events (sounds/library/amb-*, or the Openverse route), or no bed. sound_mix.py takes these only in a plan marked "sketch": true.

Beds made by code: a continuous floor for the whole length of a video (new in 1.7).

  python "<skill>/scripts/sound_beds.py" --list
  python "<skill>/scripts/sound_beds.py" dawn "assets/sfx/bed-dawn.wav" --duration 42 --seed 3
  python "<skill>/scripts/sound_beds.py" rain "assets/sfx/bed-rain.wav" --duration 30 --level -30 --intensity 0.7

Every bed is synthesised from a seed (no audio file ships, nothing needs a licence), runs the exact length asked,
moves slowly so it never sounds like a loop or like hiss, and loops without a seam (the end flows into the start).
Written as 16-bit PCM WAV, 48 kHz stereo, at --level LUFS integrated (default -30; sound_mix.py sets the real level).
Tools measure, they don't hear: audition the bed in the scene before you rely on it.
"""
import argparse, pathlib, sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # works under python -I
import numpy as np
from khaam_sound import (SR, rng_for, shaped_noise, slow, lp, hp, bell, tilt, chain, pan, stereo_pair, diffuse,
                         add_at, bandpass, lowpass, highpass, normalise_loudness, write_wav, integrated_lufs, true_peak_db)

BEDS = {
    'air':        'open air, quiet and soft: the default floor under anything (no place named)',
    'room':       'a quiet indoor room: low, warm, steady (talking-head, study, a desk at night)',
    'paper':      'a desk with paper: room tone plus a page or a pencil settling now and then (explainers on paper)',
    'rain':       'steady rain outside: hiss, many small drops, a few close ones, a low far rumble (--intensity 0.2-1)',
    'wind':       'wind over open ground: slow gusts that move left and right, a faint whistle only in strong gusts',
    'night':      'outside at night: dark still air and a few far crickets (crickets pause and return on their own)',
    'dawn':       'first light outside: soft air and a few far birds (synthesised birds: see the doubt note)',
    'fire':       'a small fire or campfire: low roar that breathes, wood crackles and a rare pop',
    'underwater': 'under water: deep muffled body, slow pressure movement, a few far bubbles rising',
}
DOUBT = {'dawn': 'Synthesised birds are the least convincing bed here. For a video where birds matter, fetch a real '
                 'dawn chorus through openverse_sfx.py (reference/film-sound.md, "When code is not enough").'}


def air(n, rng, intensity=1.0, bright=1.0):
    curve_b = chain(tilt(-0.45), hp(130, 2), lp(6000 * bright, 2))
    curve_d = chain(tilt(-0.6), hp(90, 2), lp(1500 * bright, 2))
    b = stereo_pair(lambda r: shaped_noise(n, r, curve_b), n, rng, 0.25)
    d = stereo_pair(lambda r: shaped_noise(n, r, curve_d), n, rng, 0.35)
    s1, s2, s3 = slow(n, rng, 0.12), slow(n, rng, 0.08), slow(n, rng, 0.05)
    mix = b * (0.45 * 10 ** (1.5 * s1 / 20))[:, None] + d * (1.0 * 10 ** (1.0 * s2 / 20))[:, None]
    return mix * (10 ** (1.2 * s3 / 20))[:, None]


def room(n, rng, intensity=1.0, bright=1.0):
    body = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.8), hp(70, 2), lp(900 * bright, 2))), n, rng, 0.6)
    vent = stereo_pair(lambda r: shaped_noise(n, r, chain(bell(230, 0.9), hp(80, 1))), n, rng, 0.7)
    top = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.5), hp(350, 1), lp(4000 * bright, 2))), n, rng, 0.3)
    s = slow(n, rng, 0.05)
    return (body + 0.45 * vent + 0.22 * top) * (10 ** (0.8 * s / 20))[:, None]


def _paper_event(rng, kind):
    if kind == 'settle':  # a sheet settling: soft grainy rustle
        m = int(rng.uniform(0.12, 0.32) * SR)
        g = np.zeros(m); k = rng.integers(0, m, int(m / SR * rng.uniform(120, 260)))
        g[k] = rng.pareto(3.0, len(k)) * rng.choice([-1, 1], len(k))
        x = bandpass(g, 1500, 7000, 2) + 0.4 * bandpass(rng.standard_normal(m), 900, 5000, 2) * 0.15
        t = np.arange(m) / SR
        return x * np.clip(np.sin(np.pi * t / t[-1]), 0, None) ** 1.5  # the last sample can land one ulp past pi: NaN
    m = int(0.05 * SR)  # a pencil set down far away: tiny tap
    t = np.arange(m) / SR
    body = np.sin(2 * np.pi * rng.uniform(900, 1400) * t) * np.exp(-t / 0.006)
    return 0.6 * body + bandpass(rng.standard_normal(m), 2500, 8000, 2) * np.exp(-t / 0.002)


def paper(n, rng, intensity=1.0, bright=1.0):
    base = room(n, rng, bright=1.6 * bright)
    ev = np.zeros((n, 2))
    t = rng.uniform(0.5, 2.5)
    while t * SR < n:
        kind = 'settle' if rng.random() < 0.75 else 'tap'
        e = _paper_event(rng, kind)
        e = e / (np.abs(e).max() + 1e-12) * rng.uniform(0.35, 0.7) * (1.0 if kind == 'settle' else 0.5)
        add_at(ev, pan(e, rng.uniform(-0.6, 0.6)), int(t * SR), wrap=True)
        t += rng.uniform(2.5, 7.0) / max(intensity, 0.2)
    ev = diffuse(ev, rng, 0.25, 0.35, 6000)
    return base / np.abs(base).std() * 0.25 + ev * 0.25 * intensity


def rain(n, rng, intensity=0.7, bright=1.0):
    iv = np.clip(intensity, 0.1, 1.0)
    hiss = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.35), hp(350, 1), lp(9000 * bright, 2), bell(2600, 0.35))),
                       n, rng, 0.3)
    rumble = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.8), hp(45, 2), lp(260, 2))), n, rng, 0.6)
    s = slow(n, rng, 0.06)
    inten = 10 ** (2.0 * s / 20)
    drops = np.zeros((n, 2))
    # dense small drops: impulses with heavy-tailed sizes, grouped by a few resonances (drops on water, leaves, ground)
    kern = []
    for f in rng.uniform(1200, 5200, 10):
        m = int(0.012 * SR); t = np.arange(m) / SR
        k = np.sin(2 * np.pi * f * (1 + 0.6 * t / 0.012) * t) * np.exp(-t / rng.uniform(0.0025, 0.006))
        k[:8] += rng.standard_normal(8) * 0.5
        kern.append(k)
    rate = 600 + 1800 * iv
    for ch in range(2):
        cnt = rng.poisson(rate * n / SR)
        pos = rng.integers(0, n, cnt); amp = np.minimum(rng.pareto(3.0, cnt), 2.5) * rng.choice([-1, 1], cnt)
        grp = rng.integers(0, len(kern), cnt)
        for gi, k in enumerate(kern):
            imp = np.zeros(n); sel = grp == gi
            np.add.at(imp, pos[sel], amp[sel])
            drops[:, ch] += np.fft.irfft(np.fft.rfft(imp) * np.fft.rfft(k, n), n)  # circular: seamless
    drops /= drops.std() + 1e-12
    close = np.zeros((n, 2))
    t = rng.uniform(0, 0.3)
    while t * SR < n:  # a few close drops on a surface (leaves, a sill)
        m = int(0.03 * SR); tt = np.arange(m) / SR; f = rng.uniform(700, 1700)
        e = np.sin(2 * np.pi * f * (1 + 1.2 * tt / 0.03) * tt) * np.exp(-tt / 0.006) + 0.3 * rng.standard_normal(m) * np.exp(-tt / 0.0015)
        add_at(close, pan(e * rng.uniform(0.3, 1.0), rng.uniform(-0.8, 0.8)), int(t * SR), wrap=True)
        t += rng.exponential(1 / (2 + 6 * iv))
    close /= close.std() + 1e-12
    mix = 0.55 * hiss + 0.55 * drops * (0.6 + 0.4 * iv) + 0.10 * close + 0.22 * rumble
    return mix * inten[:, None]


def wind(n, rng, intensity=0.7, bright=1.0):
    iv = np.clip(intensity, 0.1, 1.0)
    shift = int(rng.uniform(0.3, 0.7) * SR)
    g = slow(n, rng, 0.1, 4)
    gust = 10 ** ((3.0 + 2.0 * iv) * g / 20)  # slow swells of about +-4 dB (more with --intensity)
    gust_r = np.roll(gust, shift)
    out = np.zeros((n, 2))
    for fc, q, w, p in ((220, 0.8, 0.8, 0.6), (480, 0.9, 0.75, 0.9), (950, 1.0, 0.55, 1.2), (1900, 1.1, 0.32, 1.5),
                        (3600, 1.2, 0.14, 1.8)):
        layer = stereo_pair(lambda r: shaped_noise(n, r, chain(bell(fc * bright, q), hp(60, 2))), n, rng, 0.4)
        wob = 10 ** (1.5 * slow(n, rng, 0.25) / 20)
        out[:, 0] += w * layer[:, 0] * gust ** p * wob
        out[:, 1] += w * layer[:, 1] * gust_r ** p * wob
    whistle = shaped_noise(n, rng, bell(rng.uniform(780, 1050), 6.0))
    wgain = np.clip(gust - 1.3, 0, None) ** 2 * 0.35 * iv
    out += np.stack([whistle * wgain, np.roll(whistle * wgain, shift)], 1)
    body = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.8), hp(45, 2), lp(160, 2))), n, rng, 0.7)
    return out * (0.6 + 0.4 * iv) + 0.35 * body * gust[:, None] ** 0.5


def _cricket(n, rng, start_wrap=True):
    fc = rng.uniform(3900, 5200); T = rng.uniform(0.55, 1.05); pulses = int(rng.integers(3, 5))
    plen = rng.uniform(0.012, 0.018); pgap = rng.uniform(0.028, 0.040)
    y = np.zeros(n)
    m = int(plen * SR); tt = np.arange(m) / SR
    pulse = np.sin(2 * np.pi * fc * tt) * np.sin(np.pi * tt / plen) ** 2
    pulse += 0.12 * np.sin(2 * np.pi * 2 * fc * tt) * np.sin(np.pi * tt / plen) ** 2
    t = rng.uniform(0, T)
    singing = True; switch = t + rng.uniform(4, 12)
    while t * SR < n:
        if t > switch:
            singing = not singing; switch = t + (rng.uniform(5, 14) if singing else rng.uniform(1.5, 5))
        if singing:
            a = rng.uniform(0.75, 1.0)
            for k in range(pulses):
                add_at(y, pulse * a * (1 - 0.08 * k), int((t + k * pgap) * SR), wrap=True)
        t += T * rng.uniform(0.97, 1.03)
    return y


def night(n, rng, intensity=1.0, bright=1.0):
    base = air(n, rng, bright=0.45 * bright)
    cr = np.zeros((n, 2))
    for i in range(int(rng.integers(3, 6))):
        c = _cricket(n, rng) * 10 ** (-rng.uniform(0, 14) / 20)
        cr += pan(c, rng.uniform(-0.85, 0.85))
    cr = diffuse(lowpass(cr, 7000, 1), rng, 0.22, 0.45, 5500)
    cr /= np.abs(cr).std() + 1e-12
    base /= np.abs(base).std() + 1e-12
    return base + 0.24 * intensity * cr


def _bird_species(rng):
    """Each bird keeps its own small repertoire, so it sounds like one bird, not random beeps."""
    sp = []
    for _ in range(int(rng.integers(2, 4))):
        kind = rng.choice(['down', 'up', 'trill', 'whistle'])
        f1 = rng.uniform(2300, 4600)
        sp.append(dict(kind=kind, f1=f1, f2=f1 * rng.uniform(0.6, 1.5), dur=rng.uniform(0.03, 0.09),
                       rep=int(rng.integers(5, 11)), vib=rng.uniform(18, 40)))
    return sp


def _syllable(rng, s):
    if s['kind'] == 'trill':
        one = dict(s, kind='down', dur=0.016, f2=s['f1'] * 0.85)
        gap = rng.uniform(0.022, 0.032)
        parts = [(_syllable(rng, one), k * gap) for k in range(s['rep'])]
        m = int((s['rep'] * gap + 0.03) * SR); y = np.zeros(m)
        for p, off in parts:
            add_at(y, p, int(off * SR))
        return y
    dur = s['dur'] * (4.0 if s['kind'] == 'whistle' else 1.0)
    m = int(dur * SR); t = np.arange(m) / SR
    f = s['f1'] + (s['f2'] - s['f1']) * (t / dur) ** 0.8
    if s['kind'] == 'whistle':
        f = s['f1'] * (1 + 0.025 * np.sin(2 * np.pi * s['vib'] * t)) * (1 + 0.08 * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    e = np.sin(np.pi * t / dur) ** 1.2
    return (np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)) * e


def dawn(n, rng, intensity=1.0, bright=1.0):
    base = air(n, rng, bright=1.1 * bright)
    birds = np.zeros((n, 2))
    for b in range(int(rng.integers(3, 5))):
        sp = _bird_species(rng); p = rng.uniform(-0.9, 0.9); lvl = 10 ** (-rng.uniform(0, 12) / 20)
        t = rng.uniform(0.2, 4.0)
        while t * SR < n:
            phrase = np.zeros(int(2.0 * SR)); off = 0.0
            for _ in range(int(rng.integers(2, 6))):
                syl = _syllable(rng, sp[int(rng.integers(0, len(sp)))])
                add_at(phrase, syl * rng.uniform(0.6, 1.0), int(off * SR))
                off += len(syl) / SR + rng.uniform(0.04, 0.16)
                if off > 1.7:
                    break
            add_at(birds, pan(phrase * lvl, p + rng.uniform(-0.1, 0.1)), int(t * SR), wrap=True)
            t += rng.uniform(2.2, 6.5) / max(intensity, 0.3)
    birds = diffuse(lowpass(birds, 7500, 1), rng, 0.35, 0.5, 6000)
    birds /= np.abs(birds).std() + 1e-12
    base /= np.abs(base).std() + 1e-12
    return base + 0.22 * intensity * birds


def fire(n, rng, intensity=1.0, bright=1.0):
    flick = slow(n, rng, 1.2, 3)
    breath = 10 ** (3.0 * flick / 20)
    roar = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.7), hp(70, 2), lp(380, 2))), n, rng, 0.7)
    hiss = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.4), hp(1200, 2), lp(7000 * bright, 2))), n, rng, 0.4)
    cr = np.zeros((n, 2))
    burst = slow(n, rng, 0.4)
    t = 0.0
    while t * SR < n:
        i = int(t * SR) % n
        k = int(rng.integers(1, 5))
        for j in range(k):  # one crackle = 1-4 tiny clicks inside ~10 ms (wood splitting)
            m = int(rng.uniform(0.0004, 0.003) * SR) + 4
            c = rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 3))
            lo = rng.uniform(900, 3000)
            c = bandpass(np.pad(c, (0, 64)), lo, min(lo * rng.uniform(2, 4), 20000), 1)
            add_at(cr, pan(c * min(rng.pareto(3.0), 3.0) * 0.5, rng.uniform(-0.7, 0.7)), i + int(rng.uniform(0, 0.012) * SR), wrap=True)
        if rng.random() < 0.05:  # a rare louder pop
            m = int(0.03 * SR); tt = np.arange(m) / SR
            p = np.sin(2 * np.pi * rng.uniform(500, 1200) * tt) * np.exp(-tt / 0.006) + rng.standard_normal(m) * np.exp(-tt / 0.002)
            add_at(cr, pan(p * 0.35, rng.uniform(-0.5, 0.5)), i, wrap=True)
        t += rng.exponential(1 / ((4 + 8 * intensity) * np.exp(0.6 * burst[i])))
    cr /= np.abs(cr).std() + 1e-12
    return (roar * 0.55 * breath[:, None] + 0.22 * hiss * breath[:, None] ** 1.5 + 0.20 * cr)


def underwater(n, rng, intensity=1.0, bright=1.0):
    body = stereo_pair(lambda r: shaped_noise(n, r, chain(tilt(-0.7), hp(55, 2), lp(420 * bright, 3))), n, rng, 0.7)
    press = stereo_pair(lambda r: shaped_noise(n, r, chain(bell(320, 0.8), hp(90, 1), lp(1000 * bright, 3))), n, rng, 0.5)
    s1, s2 = slow(n, rng, 0.07), slow(n, rng, 0.15)
    bub = np.zeros((n, 2))
    t = rng.uniform(0.5, 2.5)
    while t * SR < n:
        p = rng.uniform(-0.7, 0.7); off = 0.0
        for _ in range(int(rng.integers(3, 12))):  # a short train of rising bubbles
            f0 = rng.uniform(450, 1500); m = int(0.06 * SR); tt = np.arange(m) / SR
            tau = rng.uniform(0.008, 0.02)
            ph = 2 * np.pi * np.cumsum(f0 * (1 + 1.8 * tt / 0.06)) / SR
            e = np.sin(ph) * np.exp(-tt / tau) * (1 - np.exp(-tt / 0.0008))
            add_at(bub, pan(e * rng.uniform(0.3, 1.0), p), int((t + off) * SR), wrap=True)
            off += rng.uniform(0.03, 0.14)
        t += rng.uniform(1.8, 5.0) / max(intensity, 0.3)
    bub = diffuse(lowpass(bub, 1800, 2), rng, 0.4, 0.5, 1500)
    bub /= np.abs(bub).std() + 1e-12
    mix = body * (10 ** (2.0 * s1 / 20))[:, None] + 0.6 * press * (10 ** (2.5 * s2 / 20))[:, None]
    mix /= np.abs(mix).std() + 1e-12
    return mix + 0.12 * intensity * bub


RECIPES = dict(air=air, room=room, paper=paper, rain=rain, wind=wind, night=night, dawn=dawn, fire=fire, underwater=underwater)


def make_bed(kind, duration, seed=1, intensity=None, bright=1.0, level=-30.0):
    """Return a stereo bed of exactly `duration` seconds at `level` LUFS integrated, circular (seamless when looped)."""
    if kind not in RECIPES:
        raise SystemExit(f'Unknown bed "{kind}". Beds: {", ".join(RECIPES)}')
    n = int(round(duration * SR))
    if n < SR:
        raise SystemExit('A bed must be at least 1 second long.')
    rng = rng_for(seed, sum(map(ord, kind)))
    kw = {'bright': bright}
    if intensity is not None:
        kw['intensity'] = intensity
    if n <= 240 * SR:
        x = RECIPES[kind](n, rng, **kw)
    else:  # long beds: 120 s tiles with different seeds, joined by 4 s equal-power crossfades (and wrapped at the end)
        tile, xf = 120 * SR, 4 * SR
        x = np.zeros((n, 2)); pos = 0; i = 0
        while pos < n:
            seg = RECIPES[kind](tile + xf, rng_for(seed + 1000 * i, sum(map(ord, kind))), **kw)
            seg /= seg.std() + 1e-12
            w = np.ones(len(seg)); w[:xf] = np.sin(np.linspace(0, np.pi / 2, xf)); w[-xf:] = np.cos(np.linspace(0, np.pi / 2, xf))
            add_at(x, seg * w[:, None], pos, wrap=True)
            pos += tile; i += 1
    x = x - x.mean(0)
    return normalise_loudness(x, level)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('kind', nargs='?', choices=list(RECIPES))
    ap.add_argument('output', nargs='?')
    ap.add_argument('--duration', type=float, default=30.0, help='seconds (the video length, or longer)')
    ap.add_argument('--seed', type=int, default=1, help='another seed = another take of the same bed')
    ap.add_argument('--level', type=float, default=-30.0, help='integrated LUFS of the file (default -30)')
    ap.add_argument('--intensity', type=float, default=None, help='rain, wind, fire, birds, crickets: 0.2 calm to 1 strong')
    ap.add_argument('--bright', type=float, default=1.0, help='0.6 darker ... 1.4 brighter')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--force', action='store_true', help='overwrite an existing output')
    a = ap.parse_args()
    if a.list or not a.kind:
        for k, v in BEDS.items():
            print(f'{k:<11} {v}' + (f'\n            doubt: {DOUBT[k]}' if k in DOUBT else ''))
        return
    if not a.output:
        ap.error('give an output path')
    out = pathlib.Path(a.output)
    if out.exists() and not a.force:
        ap.error(f'{out} exists; choose another name or pass --force')
    if not 1 <= a.duration <= 1800:
        ap.error('duration must be 1 to 1800 seconds')
    x = make_bed(a.kind, a.duration, a.seed, a.intensity, a.bright, a.level)
    write_wav(out, x)
    print(f'Wrote {out}: bed "{a.kind}", {a.duration:.2f} s, seed {a.seed}, {integrated_lufs(x):.1f} LUFS, '
          f'true peak {true_peak_db(x):.1f} dBTP, 48 kHz 16-bit stereo, loops without a seam.')
    if a.kind in DOUBT:
        print('Note:', DOUBT[a.kind])


if __name__ == '__main__':
    main()
