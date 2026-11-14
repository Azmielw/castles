#!/usr/bin/env python3
"""SKETCHES ONLY since 2026-11-12 (sound v2): every sound here is made by code. In a final video a thing on screen gets the real recording of that thing (sounds/library/, or the Openverse route), never one of these: the owner heard ink.stroke as a fly and fire.wick as a crack. sound_mix.py takes them only in a plan marked "sketch": true, except the ui.* interface sounds on an interface picture.

Soft effects by material, made by code (new in 1.7). Pick the palette of what the picture is made of.

  python "<skill>/scripts/material_sfx.py" --list
  python "<skill>/scripts/material_sfx.py" paper.flip "assets/sfx/flip-1.wav" --seed 2
  python "<skill>/scripts/material_sfx.py" light.swell "assets/sfx/dawn-swell.wav" --duration 1.8 --key D

Each sound is synthesised from a seed (another seed = another take, so repeats never sound copied), written as
48 kHz 16-bit PCM WAV with its peak at -3 dBFS; sound_mix.py sets the real level. Interface tones (ui.*) are for
pictures of interfaces only. Anything tonal (light.*, ui.tone) stays in one key per video (--key, default D).
These are soft, close-up Foley-like sketches, not recordings: audition them in the scene, and fetch a real recording
through openverse_sfx.py where a real object must be recognised (reference/film-sound.md).
"""
import argparse, pathlib, sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # works under python -I
import numpy as np
from khaam_sound import SR, rng_for, bandpass, lowpass, highpass, env_ar, fades, pan, diffuse, write_wav, add_at

KEYS = {'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 392.00, 'A': 440.00, 'B': 493.88}


def _t(d):
    return np.arange(int(d * SR)) / SR


def _noise(rng, d):
    return rng.standard_normal(int(d * SR))


def _noise_n(rng, m):
    """Exactly m samples of noise. _noise_n(rng, m) can return m - 1 (the float round trip), which crashed fire.wick and
    fire.catch for some seeds against np.hanning(m) (2026-11-12, seeds 19, 22, 41, 43, 45)."""
    return rng.standard_normal(int(m))


def _grain(rng, d, rate, lo, hi, size=3.0):
    """Sparse little contacts (paper fibres, soil, grit): impulses with capped heavy-tailed sizes, band-limited."""
    n = int(d * SR); g = np.zeros(n)
    k = rng.integers(0, n, max(1, int(d * rate)))
    g[k] = np.minimum(rng.pareto(size, len(k)), 4) * rng.choice([-1, 1], len(k))
    return bandpass(g, lo, hi, 2)


def _modal(rng, d, partials, click=0.3, click_band=(2000, 9000)):
    """Struck objects: a few decaying partials (freq Hz, amp, decay s) plus a short contact noise."""
    t = _t(d); y = np.zeros(len(t))
    for f, a, tau in partials:
        f = f * rng.uniform(0.97, 1.03)
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    c = bandpass(_noise(rng, d), *click_band, 2) * np.exp(-t / 0.0015)
    return (y + click * c) * (1 - np.exp(-t / 0.0004))


def _sweep_noise(rng, d, f_from, f_to, q=1.2, shape=1.5):
    """Air moving: noise whose band slides from f_from to f_to, shaped like a pass (loudest in the middle)."""
    n = int(d * SR); x = _noise(rng, d); hop = 256
    out = np.zeros(n); win = np.hanning(2 * hop)
    for i in range(0, n - 2 * hop, hop):
        c = f_from * (f_to / f_from) ** (i / n)
        lo, hi = c / (1 + 1 / q), min(c * (1 + 1 / q), SR / 2 - 100)
        seg = bandpass(x[i:i + 2 * hop], max(lo, 30), hi, 1)
        out[i:i + 2 * hop] += seg * win
    t = _t(d)
    return out * np.sin(np.pi * t / d) ** shape


# ------------------------------------------------------------------ paper and ink
def paper_slide(rng, d=0.45, **k):
    t = _t(d)
    x = bandpass(_noise(rng, d), 1200, 7500, 2) * 0.35 + _grain(rng, d, 900, 1500, 9000)
    speed = np.sin(np.pi * t / d) ** 1.3 * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(5, 9) * t))
    return x * speed


def paper_flip(rng, d=0.32, **k):
    """A card turned over: a short air pass, then a soft flap as it lands."""
    t = _t(d)
    air = _sweep_noise(rng, d * 0.7, 700, 2600, 1.0, 2.0)
    y = np.zeros(len(t)); y[:len(air)] += 0.5 * air
    land = paper_tap(rng, 0.12)
    add_at(y, 0.9 * land, int(d * 0.62 * SR))
    return y


def paper_tap(rng, d=0.14, **k):
    """A card or sheet set down on paper or a desk: a soft papery smack with a little body."""
    t = _t(d)
    smack = bandpass(_noise(rng, d), 700, 6500, 2) * np.exp(-t / 0.007)
    body = np.sin(2 * np.pi * rng.uniform(220, 300) * t) * np.exp(-t / 0.016)
    return (1.6 * smack + 0.45 * body) * (1 - np.exp(-t / 0.0006))


def paper_page(rng, d=0.7, **k):
    """A page turning: crinkle that rises and falls, with a soft air pass under it."""
    t = _t(d)
    cr = _grain(rng, d, 1400, 1800, 9000, 2.6) * (np.sin(np.pi * t / d) ** 0.8)
    air = _sweep_noise(rng, d, 500, 1800, 1.0, 1.5)
    return cr + 0.4 * air


def ink_stroke(rng, d=0.35, **k):
    """A pen line on paper: fine friction whose roughness follows the hand's speed."""
    t = _t(d)
    rough = 1 + 0.5 * np.sin(2 * np.pi * rng.uniform(70, 140) * t + 3 * np.sin(2 * np.pi * 9 * t))
    fr = bandpass(_noise(rng, d), 2200, 9000, 2) * rough + 0.7 * _grain(rng, d, 1800, 2500, 10000, 3.5)
    speed = np.clip(np.sin(np.pi * t / d), 0, 1) ** 0.7
    return fades(fr * speed, 0.004, 0.02)


def ink_circle(rng, d=0.45, **k):
    t = _t(d)
    y = ink_stroke(rng, d)
    return y * (0.75 + 0.25 * np.sin(2 * np.pi * t / d * 2.0 + 1.0))  # the hand slows twice going round


def ink_cross(rng, d=0.42, **k):
    """✗: two quick strokes."""
    y = np.zeros(int(d * SR))
    add_at(y, ink_stroke(rng, 0.13), 0)
    add_at(y, ink_stroke(rng, 0.14) * 0.9, int(0.2 * SR))
    return y


def ink_tick(rng, d=0.3, **k):
    """✓: a short stroke down and a longer one up, joined."""
    y = np.zeros(int(d * SR))
    add_at(y, ink_stroke(rng, 0.08), 0)
    add_at(y, ink_stroke(rng, 0.17), int(0.07 * SR))
    return y


def ink_marker(rng, d=0.4, **k):
    """A felt marker or highlighter: smoother and lower than a pen, a little squeak."""
    t = _t(d)
    x = bandpass(_noise(rng, d), 700, 3200, 2)
    sq = np.sin(2 * np.pi * rng.uniform(1300, 1800) * t + 0.4 * np.sin(2 * np.pi * 30 * t)) * 0.08
    return fades((x + sq) * np.sin(np.pi * t / d) ** 0.6, 0.006, 0.03)


# ------------------------------------------------------------------ cloth
def cloth_rustle(rng, d=0.5, **k):
    t = _t(d)
    x = bandpass(_noise(rng, d), 300, 3500, 2)
    am = np.abs(lowpass(_noise(rng, d), 25, 2)); am /= am.max() + 1e-9
    return x * (0.3 + am) * np.sin(np.pi * t / d) ** 1.2


def cloth_flap(rng, d=0.35, **k):
    t = _t(d)
    x = bandpass(_noise(rng, d), 180, 2200, 2)
    flutter = 0.55 + 0.45 * np.sin(2 * np.pi * rng.uniform(11, 17) * t) ** 2
    return x * flutter * env_ar(len(t), 0.03, d / 3)


def cloth_fold(rng, d=0.3, **k):
    return 0.8 * _sweep_noise(rng, d, 1600, 500, 1.0, 1.4) + 0.3 * cloth_rustle(rng, d)


# ------------------------------------------------------------------ wood and cardboard
def wood_knock(rng, d=0.25, **k):
    return _modal(rng, d, [(260, 0.8, 0.045), (610, 0.8, 0.032), (1150, 0.5, 0.018), (2100, 0.25, 0.01)], 0.8)


def wood_set(rng, d=0.3, **k):
    """A wooden object set down: lower knock with a soft slide before it."""
    y = np.zeros(int(d * SR))
    sl = bandpass(_noise(rng, 0.08), 400, 2500, 2) * np.hanning(int(0.08 * SR)) * 0.25
    add_at(y, sl, 0)
    add_at(y, _modal(rng, 0.22, [(180, 0.7, 0.05), (420, 0.6, 0.035), (900, 0.45, 0.02), (1700, 0.2, 0.01)], 0.9, (1000, 6000)), int(0.06 * SR))
    return y


def card_box(rng, d=0.32, **k):
    """A cardboard box set down: hollow low body and a dry papery slap."""
    t = _t(d)
    body = _modal(rng, d, [(130, 0.8, 0.06), (230, 0.7, 0.045), (430, 0.5, 0.03), (780, 0.3, 0.018)], 0.0)
    slap = bandpass(_noise(rng, d), 600, 5000, 2) * np.exp(-t / 0.014)
    return body + 2.2 * slap * (1 - np.exp(-t / 0.0005))


def card_lid(rng, d=0.38, **k):
    """A lid lifted off: a short cardboard rub, then a small puff of air."""
    t = _t(d)
    rub = bandpass(_noise(rng, d), 700, 4000, 2) * np.clip(np.sin(np.pi * t / (d * 0.6)), 0, 1) * (t < d * 0.6)
    puff = np.zeros(len(t))
    add_at(puff, lowpass(_noise(rng, 0.09), 900, 2) * np.hanning(int(0.09 * SR)), int(d * 0.55 * SR))
    return 0.6 * rub + 0.8 * puff


def card_stamp(rng, d=0.25, **k):
    """A rubber stamp pressed on paper: a muffled thud and a papery smack."""
    t = _t(d)
    thud = np.sin(2 * np.pi * (190 + 70 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.03)
    smack = bandpass(_noise(rng, d), 900, 6000, 2) * np.exp(-t / 0.01)
    return (0.7 * thud + 2.4 * smack) * (1 - np.exp(-t / 0.0008))


# ------------------------------------------------------------------ water
def water_drop(rng, d=0.18, **k):
    """One drop into water: a bubble whose pitch rises (the classic 'plip'), with a tiny contact."""
    t = _t(d); f0 = rng.uniform(700, 1300)
    ph = 2 * np.pi * np.cumsum(f0 * (1 + 2.2 * np.minimum(t, 0.05) / 0.05)) / SR
    y = np.sin(ph) * np.exp(-t / rng.uniform(0.018, 0.03)) * (1 - np.exp(-t / 0.001))
    c = bandpass(_noise(rng, d), 1500, 8000, 2) * np.exp(-t / 0.0015) * 0.25
    return y + c


def water_ripple(rng, d=0.9, **k):
    """A few drops and a soft wash: water moving after a touch."""
    y = np.zeros(int(d * SR)); t = _t(d)
    for o in np.sort(rng.uniform(0, d * 0.5, 4)):
        add_at(y, water_drop(rng, 0.15) * rng.uniform(0.3, 0.8), int(o * SR))
    wash = lowpass(_noise(rng, d), 2500, 2) * np.sin(np.pi * t / d) ** 2 * 0.25
    return y + wash


def water_splash(rng, d=0.7, **k):
    t = _t(d)
    burst = bandpass(_noise(rng, d), 300, 6000, 2) * env_ar(len(t), 0.01, 0.12)
    y = burst.copy()
    for o in rng.uniform(0.03, 0.4, 7):
        add_at(y, water_drop(rng, 0.12) * rng.uniform(0.2, 0.5), int(o * SR))
    return y


def water_dive(rng, d=1.2, **k):
    """The camera dips under the surface: a splash-like air rush that closes into a muffled rumble."""
    t = _t(d)
    rush = _sweep_noise(rng, d * 0.5, 3000, 700, 0.9, 1.0)
    under = lowpass(lowpass(_noise(rng, d), 350, 3), 350, 1) * np.clip((t - d * 0.3) / (d * 0.2), 0, 1) * np.exp(-np.maximum(t - d * 0.5, 0) / (d * 0.3))
    y = 3.0 * under; y[:len(rush)] += 0.6 * rush
    for o in rng.uniform(d * 0.35, d * 0.8, 6):
        add_at(y, lowpass(water_drop(rng, 0.1), 1400, 2) * 0.25, int(o * SR))
    return y


# ------------------------------------------------------------------ light (air, no hard tones)
def light_swell(rng, d=1.6, key='D', **k):
    """Light growing (dawn, a lamp, a glow): an airy rise with a faint shimmer in one key. Peak at about two thirds.
    Fixed 2026-11-12: the band used to climb 250 -> 3200 Hz (its centre 1.3 -> 4.6 kHz) while the level rose 37 dB, the
    sound of something flying at you; the owner heard sample 2's candle as flies. Now it rises about one octave and stays
    warm (under 3 kHz), and the rise is gentler."""
    t = _t(d)
    air = lowpass(_sweep_noise(rng, d, 300, 640, 0.8, 1.0), 3000, 2)
    env = np.clip(t / (d * 0.68), 0, 1) ** 1.5 * np.exp(-np.maximum(t - d * 0.68, 0) / (d * 0.18))
    root = KEYS.get(key, KEYS['D']) * 4  # two octaves up
    sh = sum(a * np.sin(2 * np.pi * root * r * t * (1 + 0.002 * np.sin(2 * np.pi * 4.5 * t + i)))
             for i, (r, a) in enumerate(((1.0, 1.0), (1.5, 0.6), (2.0, 0.35))))
    return fades(air * env + 0.05 * sh * env, 0.02, 0.15)


def light_glint(rng, d=0.9, key='D', **k):
    """A single soft glint (a star, a reflection, a key word lighting): a quiet high shimmer, no attack click."""
    t = _t(d); root = KEYS.get(key, KEYS['D']) * 8
    y = sum(a * np.sin(2 * np.pi * root * r * t) * np.exp(-t / tau) for r, a, tau in ((1, 1, 0.35), (1.5, 0.4, 0.25), (2.01, 0.2, 0.15)))
    air = bandpass(_noise(rng, d), 4000, 12000, 2) * np.exp(-t / 0.12) * 0.15
    return fades((y * 0.6 + air) * (1 - np.exp(-t / 0.015)), 0.01, 0.1)


def light_flash(rng, d=0.8, **k):
    """A white flash or lightning-light: a quick bright rush that dies away (pair with weather.thunder for a storm)."""
    t = _t(d)
    return bandpass(_noise(rng, d), 800, 11000, 2) * env_ar(len(t), 0.04, 0.16)


# ------------------------------------------------------------------ fire
def fire_catch(rng, d=1.4, **k):
    """A flame catching: a match struck (a dry scratch), its flare (a soft whoomph and a hiss, the loudest point), then the
    small flame settling into a quiet flickering breath with a crackle or two, fading by the end. A wick taking light
    from another flame is the same moment heard closer: align its peak (the flare) on the frame the flame shows."""
    d = max(float(d), 0.5)
    t = _t(d); n = len(t); y = np.zeros(n)
    # the strike: 70-110 ms of the head dragged on the striker, rough and bright
    ds = rng.uniform(0.07, 0.11); ts = _t(ds)
    scratch = bandpass(_noise(rng, ds), 2500, 9500, 2) * 0.6 + _grain(rng, ds, 4000, 2000, 10000, 2.6)
    add_at(y, 0.35 * scratch * np.sin(np.pi * ts / ds) ** 0.5, 0)
    # the flare: the head catches about 10 ms before the strike ends; a body of air and a sizzle on top
    f0 = int((ds - 0.01) * SR); df = min(0.7, d - ds + 0.01); tf = _t(df)
    whoomph = bandpass(_noise(rng, df), 220, 2400, 2) * env_ar(len(tf), 0.03, 0.1)
    fizz = np.abs(lowpass(_noise(rng, df), 60, 2)); fizz /= fizz.max() + 1e-9
    sizzle = bandpass(_noise(rng, df), 3000, 9000, 2) * env_ar(len(tf), 0.012, 0.14) * (0.5 + 0.5 * fizz)
    add_at(y, 1.2 * whoomph + 0.4 * sizzle, f0)
    # the small flame: a soft flickering breath, louder just after the flare, then settling and fading out
    tb = np.maximum(t - ds, 0)
    flick = np.abs(lowpass(_noise(rng, d), 9, 2)); flick = 0.55 + 0.45 * flick / (flick.max() + 1e-9)
    body = np.clip(tb / 0.08, 0, 1) * (0.3 + 0.7 * np.exp(-tb / 0.28)) * np.cos(np.pi / 2 * np.clip((t - d * 0.55) / (d * 0.45), 0, 1)) ** 2
    y += 0.3 * bandpass(_noise(rng, d), 200, 1500, 2) * flick * body
    # a crackle or two as the wood (or the wick) takes
    for o in rng.uniform(ds + 0.12, max(ds + 0.13, d * 0.7), rng.integers(2, 5)):
        m = int(rng.uniform(0.003, 0.007) * SR)
        add_at(y, bandpass(_noise_n(rng, m), 1500, 7000, 2) * np.hanning(m) * rng.uniform(0.25, 0.5), int(o * SR))
    return fades(y, 0.002, 0.12)


def fire_wick(rng, d=1.0, **k):
    """A wick taking light from another flame (a candle lit from a candle, a lamp): no strike. A soft puff as the flame
    takes (the loudest point, in the first 50 ms: align "attack" on the frame the flame shows), a faint wax tick or two,
    then the small flame breathing as it settles and fades. Warm and low (under 2.4 kHz): nothing in it climbs in pitch,
    so a small flame stays small. New 2026-11-12, for sample 2's candles (a swell there read as flies)."""
    d = max(float(d), 0.4)
    t = _t(d); y = np.zeros(len(t))
    dp = min(0.45, d); tp = _t(dp)
    add_at(y, bandpass(_noise(rng, dp), 140, 1100, 2) * env_ar(len(tp), 0.015, 0.16), 0)
    for o in rng.uniform(0.05, min(0.35, d * 0.5), rng.integers(1, 3)):
        m = int(rng.uniform(0.003, 0.006) * SR)
        add_at(y, bandpass(_noise_n(rng, m), 900, 3500, 2) * np.hanning(m) * rng.uniform(0.12, 0.25), int(o * SR))
    flick = np.abs(lowpass(_noise(rng, d), 7, 2)); flick = 0.5 + 0.5 * flick / (flick.max() + 1e-9)
    body = np.clip(t / 0.06, 0, 1) * np.exp(-t / (d * 0.45)) * np.cos(np.pi / 2 * np.clip((t - d * 0.6) / (d * 0.4), 0, 1)) ** 2
    y += 0.18 * bandpass(_noise(rng, d), 120, 900, 2) * flick * body
    return fades(lowpass(y, 2400, 2), 0.004, 0.15)


# ------------------------------------------------------------------ stone and ceramic
def stone_tap(rng, d=0.15, **k):
    return _modal(rng, d, [(1250, 1.0, 0.02), (2900, 0.6, 0.012), (4700, 0.3, 0.008)], 0.6, (3000, 11000))


def stone_set(rng, d=0.35, **k):
    """A heavy stone set down: a low thud with grit."""
    t = _t(d)
    thud = np.sin(2 * np.pi * (95 + 50 * np.exp(-t / 0.015)) * t) * np.exp(-t / 0.05)
    grit = _grain(rng, d, 2500, 1500, 8000, 3.0) * np.exp(-t / 0.05)
    return 0.7 * thud + 1.6 * grit + 0.5 * stone_tap(rng, d)


def stone_grind(rng, d=0.5, **k):
    t = _t(d)
    x = bandpass(_noise(rng, d), 250, 2500, 2) * (0.5 + _grain(rng, d, 600, 300, 3000, 2.5) * 0.5)
    return x * np.sin(np.pi * t / d) ** 1.2


def ceramic_clink(rng, d=0.6, **k):
    """A ceramic cup or plate touched: bright inharmonic ring that fades quickly."""
    return _modal(rng, d, [(1850, 1.0, 0.18), (4300, 0.55, 0.1), (6900, 0.3, 0.06), (2650, 0.25, 0.12)], 0.25, (3000, 12000))


# ------------------------------------------------------------------ earth and plants
def earth_pat(rng, d=0.25, **k):
    """Soil patted or a seed pressed in: a dull soft thud with a crumble."""
    t = _t(d)
    thud = lowpass(_noise(rng, d), 320, 2) * np.exp(-t / 0.025) * 2
    cr = _grain(rng, d, 2200, 700, 5000, 3) * np.exp(-t / 0.06)
    return thud + 1.5 * cr


def earth_seed(rng, d=0.2, **k):
    """A small seed landing in soil: tiny tick, then a whisper of soil."""
    t = _t(d)
    tick = bandpass(_noise(rng, d), 1500, 6000, 2) * np.exp(-t / 0.002)
    soil = _grain(rng, d, 900, 800, 5000, 3) * np.exp(-t / 0.04) * 0.5
    return tick + soil + 0.6 * lowpass(_noise(rng, d), 400, 2) * np.exp(-t / 0.012)


def earth_roots(rng, d=1.0, **k):
    """Roots pushing through soil: a slow granular creak-and-crumble that grows downward (low and dry)."""
    t = _t(d)
    cr = _grain(rng, d, 900, 250, 2200, 2.4)
    creak = bandpass(_noise(rng, d), 120, 600, 2) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(17, 26) * t) ** 8)
    return fades((cr + 0.6 * creak) * np.sin(np.pi * t / d) ** 0.8, 0.05, 0.2)


def leaf_open(rng, d=0.45, **k):
    """A leaf or petal unfolding: a small dry rustle, brighter than cloth."""
    t = _t(d)
    x = bandpass(_noise(rng, d), 1200, 7000, 2) * 0.3 + _grain(rng, d, 500, 2000, 9000, 2.8)
    return x * np.sin(np.pi * t / d) ** 1.5


# ------------------------------------------------------------------ air movement and weather
def air_whoosh(rng, d=0.7, **k):
    """A soft pass of air for a camera move or a scene change; peak in the middle. Over 1 s its sweep ends at 1.1 kHz
    instead of 1.9 (at 1.5 s the full sweep climbed 0.82 octave and 15 dB to 2.5 kHz: a whine, 2026-11-12)."""
    return _sweep_noise(rng, d, 380, 1900 if float(d) <= 1.0 else 1100, 0.9, 1.8)


def air_breath(rng, d=1.2, **k):
    """A very soft swell of air, to open a video or carry a pause."""
    t = _t(d)
    return lowpass(highpass(_noise(rng, d), 150, 2), 1800, 2) * np.sin(np.pi * t / d) ** 2


def weather_thunder(rng, d=3.0, **k):
    """Far thunder: a crack that rolls into a long low rumble (sounds best under rain)."""
    t = _t(d)
    roll = lowpass(_noise(rng, d), 180, 3) * (env_ar(len(t), 0.25, d / 3) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 1.3 * t))))
    crack = bandpass(_noise(rng, d), 300, 3000, 2) * env_ar(len(t), 0.01, 0.12)
    return 4 * roll + 1.2 * crack


def weather_gust(rng, d=1.8, **k):
    return _sweep_noise(rng, d, 300, 1100, 0.9, 1.6) + 0.3 * _sweep_noise(rng, d, 900, 2400, 1.5, 2.0)


# ------------------------------------------------------------------ interface (pictures of interfaces only)
def ui_tick(rng, d=0.06, **k):
    t = _t(d)
    return bandpass(_noise(rng, d), 1800, 7000, 2) * np.exp(-t / 0.005) * (1 - np.exp(-t / 0.0003))


def ui_click(rng, d=0.08, **k):
    t = _t(d)
    return np.sin(2 * np.pi * 1600 * t) * np.exp(-t / 0.006) + 0.4 * bandpass(_noise(rng, d), 2000, 8000, 2) * np.exp(-t / 0.002)


def ui_pop(rng, d=0.12, **k):
    t = _t(d); f = 160 + 620 * np.exp(-t / 0.016)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03) * (1 - np.exp(-t / 0.0008))


def ui_tone(rng, d=0.5, key='D', **k):
    """One soft sine in the video's key, for a confirmation on an interface; never a chime ladder."""
    t = _t(d); f = KEYS.get(key, KEYS['D']) * 4
    return (np.sin(2 * np.pi * f * t) + 0.15 * np.sin(4 * np.pi * f * t)) * env_ar(len(t), 0.008, 0.12)


SOUNDS = {
    'paper.slide': (paper_slide, 'a sheet or card sliding on paper'),
    'paper.flip': (paper_flip, 'a card turned over, landing softly'),
    'paper.tap': (paper_tap, 'a card or sheet set down'),
    'paper.page': (paper_page, 'a page turning'),
    'ink.stroke': (ink_stroke, 'a pen line (set --duration to the drawn line)'),
    'ink.circle': (ink_circle, 'a pen drawing a circle round something'),
    'ink.cross': (ink_cross, 'two quick strokes: a cross'),
    'ink.tick': (ink_tick, 'a check mark'),
    'ink.marker': (ink_marker, 'a felt marker or highlighter stroke'),
    'cloth.rustle': (cloth_rustle, 'fabric moving'),
    'cloth.flap': (cloth_flap, 'a banner or sleeve flapping once'),
    'cloth.fold': (cloth_fold, 'fabric folded or a curtain pulled'),
    'wood.knock': (wood_knock, 'a knock on wood'),
    'wood.set': (wood_set, 'a wooden object set down'),
    'card.box': (card_box, 'a cardboard box set down'),
    'card.lid': (card_lid, 'a box lid lifted off'),
    'card.stamp': (card_stamp, 'a rubber stamp pressed on paper'),
    'water.drop': (water_drop, 'one drop into water'),
    'water.ripple': (water_ripple, 'a few drops and a soft wash'),
    'water.splash': (water_splash, 'a small splash'),
    'water.dive': (water_dive, 'the camera dips under the surface'),
    'light.swell': (light_swell, 'light growing: a warm airy rise (about one octave) + faint shimmer in one key (peak at 2/3)'),
    'light.glint': (light_glint, 'a soft high glint (a star, a word lighting)'),
    'light.flash': (light_flash, 'a white flash or lightning-light'),
    'fire.catch': (fire_catch, 'a flame catching: a match struck, its flare (the peak), the small flame settling (--duration = how long it is heard)'),
    'fire.wick': (fire_wick, 'a wick lit from another flame, no strike: a soft puff (the peak, align attack), the small flame settling'),
    'stone.tap': (stone_tap, 'a small stone or tile tapped'),
    'stone.set': (stone_set, 'a heavy stone set down'),
    'stone.grind': (stone_grind, 'stone sliding on stone'),
    'ceramic.clink': (ceramic_clink, 'a ceramic cup or plate touched'),
    'earth.pat': (earth_pat, 'soil patted'),
    'earth.seed': (earth_seed, 'a seed landing in soil'),
    'earth.roots': (earth_roots, 'roots pushing through soil (low, slow)'),
    'leaf.open': (leaf_open, 'a leaf or petal unfolding'),
    'air.whoosh': (air_whoosh, 'a soft pass of air for a move or a scene change (peak in the middle)'),
    'air.breath': (air_breath, 'a very soft swell of air'),
    'weather.thunder': (weather_thunder, 'far thunder rolling'),
    'weather.gust': (weather_gust, 'one gust of wind'),
    'ui.tick': (ui_tick, 'interface tick (interface pictures only)'),
    'ui.click': (ui_click, 'interface click (interface pictures only)'),
    'ui.pop': (ui_pop, 'interface pop (interface pictures only)'),
    'ui.tone': (ui_tone, 'one soft confirmation tone in the key (interface pictures only)'),
}
# what each kind of picture may use; ui.* only where the picture is an interface
PALETTES = {
    'paper': ['paper.slide', 'paper.flip', 'paper.tap', 'paper.page', 'ink.stroke', 'ink.circle', 'ink.cross', 'ink.tick', 'ink.marker', 'card.stamp', 'air.whoosh'],
    'cloth': ['cloth.rustle', 'cloth.flap', 'cloth.fold', 'air.whoosh'],
    'wood': ['wood.knock', 'wood.set', 'card.box', 'card.lid', 'paper.tap'],
    'water': ['water.drop', 'water.ripple', 'water.splash', 'water.dive', 'air.whoosh'],
    'light': ['light.swell', 'light.glint', 'light.flash', 'fire.catch', 'fire.wick', 'air.breath', 'air.whoosh'],
    'fire': ['fire.catch', 'fire.wick', 'light.swell', 'light.glint', 'air.breath'],
    'stone': ['stone.tap', 'stone.set', 'stone.grind', 'ceramic.clink'],
    'earth': ['earth.pat', 'earth.seed', 'earth.roots', 'leaf.open', 'air.breath'],
    'weather': ['weather.thunder', 'weather.gust', 'light.flash', 'air.whoosh'],
    'interface': ['ui.tick', 'ui.click', 'ui.pop', 'ui.tone', 'air.whoosh'],
}
MATERIAL_OF = {name: name.split('.')[0] for name in SOUNDS}
MATERIAL_OF.update({'card.box': 'wood', 'card.lid': 'wood', 'card.stamp': 'paper', 'ink.stroke': 'paper', 'ink.circle': 'paper',
                    'ink.cross': 'paper', 'ink.tick': 'paper', 'ink.marker': 'paper', 'ceramic.clink': 'stone', 'leaf.open': 'earth',
                    'ui.tick': 'interface', 'ui.click': 'interface', 'ui.pop': 'interface', 'ui.tone': 'interface',
                    'air.whoosh': 'air', 'air.breath': 'air'})


def make_sfx(name, seed=1, duration=None, key='D', pan_pos=0.0, space=0.15):
    """Return a stereo effect (peak -3 dBFS). space adds a touch of room so it sits in the bed instead of on top."""
    if name not in SOUNDS:
        raise SystemExit(f'Unknown sound "{name}". See --list.')
    fn = SOUNDS[name][0]
    rng = rng_for(seed, sum(map(ord, name)))
    kw = {'key': key}
    if duration:
        kw['d'] = float(duration)
    y = fn(rng, **kw)
    y = fades(np.asarray(y, float) - np.mean(y), 0.0015, 0.02)
    st = pan(y, pan_pos) * np.sqrt(2)
    if space > 0:
        pad = np.zeros((len(st) + int(0.25 * SR), 2)); pad[:len(st)] = st
        st = diffuse(pad, rng, 0.25, space, 6000)
        # trim the silent end of the tail
        lvl = np.abs(st).max(1); last = np.nonzero(lvl > lvl.max() * 10 ** (-60 / 20))[0]
        st = fades(st[: (last[-1] + 1) if len(last) else len(st)], 0.0, 0.01)
    return st / (np.abs(st).max() + 1e-12) * 10 ** (-3 / 20)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sound', nargs='?')
    ap.add_argument('output', nargs='?')
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--duration', type=float, help='seconds, for sounds that follow a move (strokes, swells, whooshes)')
    ap.add_argument('--key', default='D', choices=list(KEYS), help='the one key for anything tonal in this video')
    ap.add_argument('--pan', type=float, default=0.0, help='-1 left ... 1 right (follow the picture)')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    if a.list or not a.sound:
        for mat, names in PALETTES.items():
            print(f'{mat}:')
            for nm in names:
                print(f'   {nm:<16} {SOUNDS[nm][1]}')
        return
    if not a.output:
        ap.error('give an output path')
    out = pathlib.Path(a.output)
    if out.exists() and not a.force:
        ap.error(f'{out} exists; choose another name or pass --force')
    if a.duration is not None and not 0.03 <= a.duration <= 8:
        ap.error('duration must be 0.03 to 8 seconds')
    y = make_sfx(a.sound, a.seed, a.duration, a.key, a.pan)
    write_wav(out, y)
    print(f'Wrote {out}: {a.sound} ({MATERIAL_OF[a.sound]}), {len(y) / SR:.2f} s, seed {a.seed}, peak -3 dBFS, 48 kHz 16-bit stereo. '
          'Audition it in the scene.')


if __name__ == '__main__':
    main()
