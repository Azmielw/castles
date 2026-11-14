#!/usr/bin/env python3
"""The film mix (new in 1.7): one plan file in, the finished mix out, checked against the rule.

  python "<skill>/scripts/sound_mix.py" plan/sound.json                 # writes assets/mix.wav, then runs check_mix.py
  python "<skill>/scripts/sound_mix.py" plan/sound.json --out assets/mix.wav --no-check
  python "<skill>/scripts/sound_mix.py" --library                       # the real recordings that ship with the skill

REAL SOUNDS ONLY (sound v2, 2026-11-12). Every effect is a real recording of the thing shown: "lib" (a name from
sounds/library/MANIFEST.md) or "file" (a CC0 recording in the project), placed on its frame ("align": attack, peak, start;
"cut": [from, to]; "pan"; "gain_db"; or "layers" of several recordings at their own "at"). The bed is a real recording of
the place with sparse events ("bed": [{"lib": "amb-night-crickets", "from": 0, "to": 9, "offset": 0}], overlaps crossfade),
or no bed ("bed": []). Light and camera moves make no sound. Levels (khaam_sound.FILM_SOUND): with a voice, the voice at
-14 LUFS, effects 12 dB under it and ducked 6 dB under every word; with no voice, the strongest effect's loudest 400 ms at
-24 (effects_top), others under it by gain_db, a stretch held near its top over 1.2 s at -27, any effect's 2-6 kHz band
at most -29; a bed's loudest 400 ms at -34 (bed_top; with a voice, 20 dB under it) and any static floor in it at -56.
Code-made beds ("kind") and effects ("sound", except ui.* on an interface picture) are refused unless the plan says
"sketch": true, which mixes them the 1.7.0 way below for a quick draft; the check then fails it as not final.

The 1.7.0 description of the sketch path follows.

The plan (reference/film-sound.md has the full format) says: the video's length; the bed or beds (kind, from, to;
overlapping beds crossfade); the effects (time, a sound from material_sfx.py or a file, or "layers": several sounds
built into one moment, e.g. approach + contact + settle; why); the voice if any;
the quoted scripture spans; what each part of the picture is made of; and anything the user asked against the default.
The mixer builds every bed and effect by code, places hits by their attack and swells by their peak, keeps effects
0.5 s clear of quoted scripture, cuts any music there, ducks effects under the voice, and writes stems plus
<plan>.mixed.json for the check. With a voice: the voice at -14 LUFS, the bed 22 dB under it, true peak under -2 dBTP
(room for the AAC encode). With no voice (fixed 2026-11-12): the strongest effect's loudest 400 ms at -20 LUFS, the
bed at -29, no integrated target (khaam_sound.FILM_SOUND; reference/film-sound.md says why).
It refuses, with the reason, anything that breaks the rule: fix the plan, don't force it.
"""
import argparse, json, pathlib, sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # works under python -I
import numpy as np
from khaam_sound import (SR, read_audio, write_wav, integrated_lufs, momentary_max, master, true_peak_db, block_loudness,
                         fades, as_stereo, loudness_range, FILM_SOUND, harsh_band, near_top)
from sound_beds import make_bed, RECIPES as BED_KINDS
from material_sfx import make_sfx, SOUNDS, MATERIAL_OF

TEXTURED = {'rain', 'wind', 'night', 'dawn', 'fire', 'underwater'}


def fail(msg):
    raise SystemExit('sound_mix: ' + msg)


def anchor(y, how):
    m = np.abs(y).max(1); pk = m.max() or 1.0
    if how == 'attack':
        return int(np.argmax(m >= pk * 10 ** (-6 / 20)))
    if how == 'peak':
        env = np.convolve(m, np.ones(480) / 480, mode='same')
        return int(np.argmax(env))
    return 0


def layered(c, key, root):
    """One moment made of parts: "layers" in an effect, each a material sound (or a file) with `at`
    (seconds from the effect's t; negative = before it), `duration`, `gain_db` (between the layers, 0 = the strongest),
    and its own `seed`, `pan`, `space` (the effect's when not given). A layer starts at `at` unless its `align` says
    `attack` or `peak`. Returns (the moment as one stereo sound, its start in samples from t, its name, its material).
    The mixer then treats it as ONE effect: one count in the effects per 10 s, one level, one peak limiter."""
    layers = c.get('layers') or []
    if not isinstance(layers, list) or not layers:
        fail(f'the effect at {c["t"]} s has "layers" but no layer in it.')
    if 'sound' in c or 'file' in c:
        fail(f'the effect at {c["t"]} s has "layers" and also "sound" or "file": give it one of them.')
    parts, names, mats = [], [], []
    for L in layers:
        if 'sound' in L:
            if L['sound'] not in SOUNDS:
                fail(f'unknown sound "{L["sound"]}" in the layers at {c["t"]} s (material_sfx.py --list).')
            y = make_sfx(L['sound'], int(L.get('seed', c.get('seed', 1))), L.get('duration', L.get('d')), key,
                         float(L.get('pan', c.get('pan', 0.0))), float(L.get('space', c.get('space', 0.15))))
            names.append(L['sound']); mats.append(MATERIAL_OF[L['sound']])
        elif 'file' in L:
            y = read_audio(root / L['file']); y = y / (np.abs(y).max() + 1e-12) * 10 ** (-3 / 20)
            names.append(L['file']); mats.append(L.get('material', ''))
        else:
            fail(f'a layer of the effect at {c["t"]} s has no "sound" (or "file").')
        y = y * 10 ** (float(L.get('gain_db', 0)) / 20)
        parts.append((int(round(float(L.get('at', 0)) * SR)) - anchor(y, L.get('align', 'start')), y))
    s0 = min(s for s, _ in parts)
    buf = np.zeros((max(s + len(y) for s, y in parts) - s0, 2))
    for s, y in parts:
        buf[s - s0:s - s0 + len(y)] += y
    mat = 'interface' if 'interface' in mats else (c.get('material') or next((m for m in mats if m), ''))
    return buf, s0, '+'.join(names), mat


def level_voice(v, ratio=4.0, above_db=2.0, max_gr=10.0):
    """Leveling of a narration take before it is set to -14 LUFS: only the loudest syllables (more than `above_db`
    over the take's median spoken level) are turned down, 4:1, at most `max_gr` dB, 5 ms attack, 150 ms release.
    A peaky take (TTS, a phone recording) then reaches -14 without the limiter flattening it. Returns (voice, max dB)."""
    v = as_stereo(v)
    hop = 48  # 1 ms at 48 kHz
    p = (v ** 2).mean(1)
    w = int(0.02 * SR)
    rms = np.sqrt(np.maximum(np.convolve(p, np.ones(w) / w, mode='same'), 1e-20))
    lev = 20 * np.log10(rms[::hop])
    act = lev > lev.max() - 40
    if act.sum() < 10:
        return v, 0.0
    T = float(np.median(lev[act])) + above_db
    want = np.minimum(np.maximum(lev - T, 0) * (1 - 1 / ratio), max_gr)
    a, r = np.exp(-1 / 5.0), np.exp(-1 / 150.0)  # per 1 ms frame
    gr = np.empty_like(want); g = 0.0
    for i, x in enumerate(want):
        g = a * g + (1 - a) * x if x > g else r * g + (1 - r) * x
        gr[i] = g
    gain = 10 ** (-np.interp(np.arange(len(v)), np.arange(len(gr)) * hop, gr) / 20)
    return v * gain[:, None], float(gr.max())


def sounding_span(y, start):
    m = np.abs(y).max(1); thr = m.max() * 10 ** (-40 / 20)
    idx = np.nonzero(m > thr)[0]
    if not len(idx):
        return start / SR, start / SR
    return (start + idx[0]) / SR, (start + idx[-1]) / SR


def build_bed(plan, n):
    segs = sorted(plan.get('bed') or [], key=lambda b: float(b.get('from', 0)))
    if not segs:  # v2: a place with no sound of its own has no bed (2026-11-12)
        return np.zeros((n, 2)), []
    dur = n / SR
    out = np.zeros((n, 2))
    cover = np.zeros(n)
    for i, b in enumerate(segs):
        kind = b['kind']
        if kind not in BED_KINDS and 'file' not in b:
            fail(f'unknown bed "{kind}". Beds: {", ".join(BED_KINDS)} (or "file" for a real recording).')
        a, z = max(0.0, float(b.get('from', 0))), min(dur, float(b.get('to', dur)))
        if z - a < 0.5:
            fail(f'bed {i + 1} ({kind}) is shorter than half a second.')
        ln = int(round((z - a) * SR))
        if 'file' in b:  # a real recording: looped with 1 s equal-power crossfades when it is shorter than its span
            src = read_audio(pathlib.Path(plan['_dir']).parent / b['file']) if (pathlib.Path(plan['_dir']).parent / b['file']).is_file() \
                else read_audio(pathlib.Path(plan['_dir']) / b['file'])
            xf = min(SR, len(src) // 4)
            x = np.zeros((ln + len(src), 2)); pos = 0
            w = np.ones(len(src)); w[:xf] = np.sin(np.linspace(0, np.pi / 2, xf)); w[-xf:] = np.cos(np.linspace(0, np.pi / 2, xf))
            while pos < ln:
                x[pos:pos + len(src)] += src * w[:, None]
                pos += len(src) - xf
            x = x[:ln]
            from khaam_sound import normalise_loudness
            x = normalise_loudness(x, -30.0)
        else:
            x = make_bed(kind, max(z - a, 1.0), int(b.get('seed', 1)), b.get('intensity'), float(b.get('bright', 1.0)), -30.0)[:ln]
        x = x * 10 ** (float(b.get('gain_db', 0)) / 20)
        # crossfades with neighbours: equal power over the overlap; the very first and last edges get 15 ms
        w = np.ones(ln)
        prev = segs[i - 1] if i else None
        nxt = segs[i + 1] if i + 1 < len(segs) else None
        if prev and float(prev.get('to', dur)) > a:
            k = int(min(float(prev['to']) - a, z - a) * SR); w[:k] *= np.sin(np.linspace(0, np.pi / 2, k))
        elif a > 0:
            k = int(0.015 * SR); w[:k] *= np.sin(np.linspace(0, np.pi / 2, k))
        if nxt and float(nxt.get('from', 0)) < z:
            k = int(min(z - float(nxt['from']), z - a) * SR); w[ln - k:] *= np.cos(np.linspace(0, np.pi / 2, k))
        elif z < dur:
            k = int(0.015 * SR); w[ln - k:] *= np.cos(np.linspace(0, np.pi / 2, k))
        s0 = int(round(a * SR))
        out[s0:s0 + ln] += x[:n - s0] * w[:n - s0, None]
        cover[s0:s0 + ln] += w[:n - s0] ** 2
    gaps = np.nonzero(cover < 0.25)[0]
    if len(gaps) > 0.02 * SR:
        fail(f'the bed leaves {len(gaps) / SR:.2f} s uncovered (first gap at {gaps[0] / SR:.2f} s). Beds must touch or overlap.')
    k = int(0.015 * SR)
    out[:k] *= np.sin(np.linspace(0, np.pi / 2, k))[:, None]
    out[-k:] *= np.cos(np.linspace(0, np.pi / 2, k))[:, None]
    return out, [b['kind'] for b in segs]


def mix_sketch(plan_path, out_path=None, ceiling=-2.0):
    plan_path = pathlib.Path(plan_path)
    plan = json.loads(plan_path.read_text(encoding='utf-8-sig'))
    plan['_dir'] = plan_path.parent
    root = plan_path.parent.parent if plan_path.parent.name == 'plan' else plan_path.parent
    dur = float(plan['duration']); n = int(round(dur * SR))
    lufs = float(plan.get('master', {}).get('lufs', -14.0))
    asked = set(plan.get('user_asked', []))
    key = plan.get('key', 'D')
    zones = [(float(z['from']), float(z['to'])) for z in plan.get('scripture', [])]
    pics = plan.get('pictures') or []
    voice_cfg = plan.get('voice')
    narrated = bool(voice_cfg)

    # ---- voice (reference level for everything else when present)
    voice = np.zeros((n, 2)); voice_levelled = 0.0; voice_cut = 0.0
    if narrated:
        from khaam_sound import highpass
        v = highpass(read_audio(root / voice_cfg['file']), 70, 2)  # rumble and any DC offset out of the take
        if voice_cfg.get('level', True):
            v, voice_levelled = level_voice(v)
        v = v * 10 ** ((lufs - integrated_lufs(v)) / 20)
        # the voice's own peak limiter, before it meets the bed: the master then has almost nothing left to do,
        # so the bed never pumps with the voice and the voice keeps its place over the bed
        from khaam_sound import tp_limit as _tpl
        voice_cut = max(0.0, true_peak_db(v) - (ceiling - 0.4))
        for _ in range(6):
            vl = _tpl(v, ceiling - 0.4, lookahead=0.002, release=0.06)
            err = lufs - integrated_lufs(vl)
            if abs(err) < 0.1:
                break
            v = v * 10 ** (err / 20)
            voice_cut = max(voice_cut, true_peak_db(v) - (ceiling - 0.4))
        v = vl * 10 ** (float(voice_cfg.get('gain_db', 0)) / 20)
        s0 = int(round(float(voice_cfg.get('at', 0)) * SR))
        voice[s0:s0 + len(v)] += v[:max(0, n - s0)]

    # ---- effects
    fx = np.zeros((n, 2)); spans = []; problems = []
    placed = []  # (start, end, sound at momentary max = its gain_db); levels are set in the master step
    cues = sorted(plan.get('effects', []), key=lambda c: float(c['t']))
    if len(cues) and not 'dense' in asked:
        ts = [float(c['t']) for c in cues]
        worst = max(sum(1 for u in ts if s <= u < s + 10) for s in ts)
        if worst > 5:
            problems.append(f'{worst} effects inside 10 s (the rule allows 5): keep the moments that matter, let the bed carry the rest.')
    for c in cues:
        t = float(c['t'])
        lay = None
        if 'layers' in c:  # one moment in parts, placed by each layer's own `at` (the effect's align does not apply)
            y, off, lay, mat = layered(c, key, root)
        elif 'sound' in c:
            if c['sound'] not in SOUNDS:
                fail(f'unknown sound "{c["sound"]}" at {t} s (material_sfx.py --list).')
            y = make_sfx(c['sound'], int(c.get('seed', 1)), c.get('duration'), key, float(c.get('pan', 0.0)), float(c.get('space', 0.15)))
            mat = MATERIAL_OF[c['sound']]
        else:
            y = read_audio(root / c['file']); mat = c.get('material', '')
        y = y * 10 ** ((float(c.get('gain_db', 0)) - momentary_max(y)) / 20)  # momentary max = gain_db; level set at master
        start = int(round(t * SR)) + off if lay else int(round(t * SR)) - anchor(y, c.get('align', 'attack'))
        a, b = max(start, 0), min(start + len(y), n)
        if b <= a:
            problems.append(f'effect at {t} s falls outside the video.'); continue
        seg = y[a - start:b - start].copy()
        if b == n and b - start < len(y):
            seg = fades(seg, 0, 0.02)
        placed.append((a, b, seg))
        s_from, s_to = sounding_span(seg, a)
        name = lay or c.get('sound') or c.get('file')
        spans.append([round(s_from, 3), round(s_to, 3), name])
        for za, zb in zones:
            if s_from < zb + 0.5 and s_to > za - 0.5:
                problems.append(f'effect "{name}" sounds {s_from:.2f}-{s_to:.2f} s, inside the quiet zone around the quoted text '
                                f'({za - 0.5:.2f}-{zb + 0.5:.2f} s): move it to a pause outside, or drop it.')
        if mat == 'interface':
            pic = next((p['material'] for p in pics if float(p['from']) <= t < float(p['to'])), None)
            if pic != 'interface':
                problems.append(f'"{name}" at {t} s is an interface sound on a {pic or "non-interface"} picture: use the picture\'s '
                                'own material (material_sfx.py --list).')

    # ---- music only on request, never under quoted scripture
    music = np.zeros((n, 2)); music_cleared = False
    if plan.get('music'):
        if 'music' not in asked:
            problems.append('music is in the plan but the user did not ask for it: remove it, or add "music" to "user_asked".')
        else:
            m = read_audio(root / plan['music']['file'])[:n]
            m = m * 10 ** ((lufs - 18 + float(plan['music'].get('gain_db', 0)) - integrated_lufs(m)) / 20)
            g = np.ones(n); r = int(0.3 * SR)
            for za, zb in zones:
                a, b = int(max(0, za - 0.5) * SR), int(min(dur, zb + 0.5) * SR)
                g[a:b] = 0
                g[max(0, a - r):a] = np.minimum(g[max(0, a - r):a], np.linspace(1, 0, a - max(0, a - r)))
                g[b:b + r] = np.minimum(g[b:b + r], np.linspace(0, 1, len(g[b:b + r])))
            music[:len(m)] = m * g[:len(m), None]; music_cleared = True
    if problems:
        fail('the plan breaks the sound rule:\n  - ' + '\n  - '.join(problems))

    # ---- the bed, and the levels
    bed, kinds = build_bed(plan, n)
    fixed_under = plan.get('bed_under_db')
    if kinds:
        bed /= 10 ** (integrated_lufs(bed) / 20)  # bed at 0 LUFS; its real level is set below
    from khaam_sound import tp_limit
    ceil_fx = ceiling - 0.4
    duck = np.ones(n)
    if narrated:  # effects (and music) duck 6 dB under every spoken word
        _, lv = block_loudness(voice, 0.05, 0.01)
        Iv = integrated_lufs(voice)
        act = np.repeat((lv > Iv - 15).astype(float), int(0.01 * SR))
        act = np.pad(act, (0, max(0, n - len(act))))[:n]
        from scipy.ndimage import maximum_filter1d, uniform_filter1d
        act = uniform_filter1d(maximum_filter1d(act, int(0.15 * SR)), int(0.05 * SR))
        duck = 10 ** (-6 * act / 20)
        music *= duck[:, None]
    has_music = np.abs(music).max() > 0
    mu_l = tp_limit(music, ceil_fx) if has_music else music

    def effects_at(level, cap):
        """Every effect at momentary max = level + its gain_db, each limited on its own (a click's spike never holds a swell
        down), at most `cap` dB; an effect that would need more is turned down instead. Returns (bus, worst limiting)."""
        bus = np.zeros((n, 2)); worst = 0.0
        for a, b, seg in placed:
            y = seg * 10 ** (level / 20)
            over = true_peak_db(y) - ceil_fx
            if over > cap:
                y *= 10 ** ((cap - over) / 20); over = cap
            if over > 0:
                y = tp_limit(y, ceil_fx); worst = max(worst, over)
            bus[a:b] += y * duck[a:b, None]
        return bus, worst

    S = FILM_SOUND

    def effects_quiet(level):
        """No voice (fixed 2026-11-12): every effect's loudest 400 ms at `level` + its gain_db, then the standard's two caps:
        its 2-6 kHz band at most harsh_max - 1 dB (a scratch or a hiss sits lower than a thud: the ear and a phone speaker
        are most sensitive there), and a sound that holds within 6 dB of its own top for more than long_s seconds tops out
        at long_top. Both are measured as check_mix.py measures them: on each effect's span of the summed effects (its
        sounding span + 0.25 s), so two effects that overlap are judged together; the longest effect in a span that breaks
        a cap is turned down first. Effects are turned down, never limited (a limiter here only catches a stray true peak).
        Returns (bus, worst limiting, [(name, dB turned down, why)])."""
        ys, cuts, whys = [], [0.0] * len(placed), [set() for _ in placed]
        for a, b, seg in placed:
            ys.append(seg * 10 ** (level / 20))
        win = [(int(sp[0] * SR), min(n, int((sp[1] + 0.25) * SR))) for sp in spans]
        order = sorted(range(len(placed)), key=lambda i: -(spans[i][1] - spans[i][0]))

        def summed():
            bus = np.zeros((n, 2))
            for (a, b, _), y in zip(placed, ys):
                bus[a:b] += y
            return bus

        for _ in range(24):
            bus, changed = summed(), False
            for i in order:
                s0, s1 = win[i]
                if s1 - s0 < 10:
                    continue
                seg = bus[s0:s1]
                here = [k for k in order if win[k][0] < s1 and win[k][1] > s0]  # this effect and any overlapping it
                hm = momentary_max(harsh_band(seg)) if s1 - s0 >= int(0.4 * SR) else momentary_max(np.pad(harsh_band(seg), ((0, int(0.4 * SR)), (0, 0))))
                if hm > S['harsh_max'] - 1:
                    # the brightest of them goes down
                    j = max(here, key=lambda k: momentary_max(harsh_band(np.pad(ys[k], ((0, int(0.4 * SR)), (0, 0))))))
                    d = hm - (S['harsh_max'] - 1) + 0.2
                    ys[j] = ys[j] * 10 ** (-d / 20); cuts[j] += d; whys[j].add('its 2-6 kHz band')
                    changed = True
                    break
                top_m, held = near_top(seg)
                if held > S['long_s'] and top_m > S['long_top']:
                    # a long loud stretch (one sound held, or several in a row): all of them go down together
                    d = top_m - S['long_top'] + 0.2
                    for j in here:
                        ys[j] = ys[j] * 10 ** (-d / 20); cuts[j] += d; whys[j].add('a long stretch near the top')
                    changed = True
                    break
            if not changed:
                break
        worst, eased = 0.0, []
        for i, y in enumerate(ys):
            over = true_peak_db(y) - ceil_fx
            if over > 0:
                ys[i] = tp_limit(y, ceil_fx); worst = max(worst, over)
            if cuts[i] > 0.05:
                eased.append((spans[i][2], round(cuts[i], 1), ' and '.join(sorted(whys[i]))))
        return summed(), worst, eased

    eased = []
    if narrated:
        under = float(fixed_under if fixed_under is not None else 22)
        fx_l, fx_cut = effects_at(integrated_lufs(voice) + float(plan.get('effects_db', -12.0)), 3.0)
        total = voice + fx_l + mu_l + bed * 10 ** ((integrated_lufs(voice) - under) / 20)
    else:
        # No voice: nothing comes near the loudness of speech (-14). Before 2026-11-12 the mixer raised the effects until the
        # whole video read -14 LUFS integrated; BS.1770 gates the bed out, so the effects alone carried it, each at -8 to -13
        # LUFS momentary (up to 6 dB over speech) with up to 9 dB of limiting: the owner heard all three such samples as far too
        # loud. Now each effect is set by its own loudness and the integrated number is whatever results (about -27 to -21).
        top = float(plan.get('effects_top', S['effects_top'])) + float(plan.get('effects_db', 0.0))
        bed_lufs = float(plan.get('bed_lufs', S['bed_lufs']))
        ignored = [k for k in ('bed_under_db',) if k in plan] + (['master.lufs'] if 'lufs' in (plan.get('master') or {}) else [])
        if ignored:
            print(f'Note: {", ".join(ignored)} is ignored in a video with no voice (no integrated target since 2026-11-12): '
                  f'the bed sits at bed_lufs ({bed_lufs:.0f} LUFS), the strongest effect at effects_top ({top:.0f} LUFS).')
        under = None
        bed_at = bed * 10 ** (bed_lufs / 20)  # the bed was set to 0 LUFS above
        fx_l, fx_cut, eased = effects_quiet(top)
        total = fx_l + mu_l + bed_at
    if narrated:
        # the voice arrives levelled and peak-limited, so this is one small gain plus a safety limiter
        final, rep = master(total, lufs, ceiling)
        G = 10 ** (rep.pop('gain_db') / 20)
    else:
        G = 1.0
        final = tp_limit(total, ceiling - 0.1)  # a safety net: at these levels nothing should reach it
        rep = {'integrated_lufs': round(integrated_lufs(final), 2), 'true_peak_dbtp': round(true_peak_db(final), 2),
               'lra': round(loudness_range(final), 2), 'momentary_max': round(momentary_max(final), 1)}
    fx_cut = round(float(fx_cut), 1)
    gain = G
    if narrated and voice_cut > 4:
        print(f'Note: this take swings widely between soft and loud syllables: after leveling, {voice_cut:.1f} dB of its peaks are '
              'still limited to reach -14. It passes; a steadier read (an even distance to the microphone) will sound more natural.')
    bed = bed * 10 ** ((integrated_lufs(voice) - under) / 20) if narrated else bed_at
    fx, music = fx_l, mu_l
    for nm, d, why in eased:
        print(f'Note: "{nm}" turned down {d} dB ({why}): the standard keeps it quieter (reference/film-sound.md).')
    if not narrated and rep['momentary_max'] > S['loudest_max']:
        print(f'Note: the loudest moment reaches {rep["momentary_max"]} LUFS, over {S["loudest_max"]:.0f}: with no voice nothing may '
              'come that near speech. Lower effects_top (or the gain_db of the loudest effect) and mix again.')

    out = pathlib.Path(out_path) if out_path else root / 'assets' / 'mix.wav'
    write_wav(out, final)
    stem_dir = out.with_suffix('.stems')
    stems = {}
    for name, sig in (('bed', bed), ('fx', fx), ('voice', voice), ('music', music)):
        if np.abs(sig).max() > 0:
            p = stem_dir / f'{name}.wav'
            write_wav(p, np.clip(sig * gain, -0.999, 0.999))
            stems[name] = _os.path.relpath(p, plan_path.parent).replace('\\', '/')
    levels = {'bed_lufs': round(integrated_lufs(bed * gain), 1), 'bed_under_program_db': round(rep['integrated_lufs'] - integrated_lufs(bed * gain), 1)}
    if np.abs(fx).max() > 0:
        levels['effects_lufs'] = round(integrated_lufs(fx * gain), 1)
    if narrated:
        levels['voice_lufs'] = round(integrated_lufs(voice * gain), 1)
        levels['bed_under_voice_db'] = round(levels['voice_lufs'] - levels['bed_lufs'], 1)
    levels['effects_peaks_limited_db'] = fx_cut
    if not narrated:
        levels['effects_top_lufs'] = round(top, 1)
        levels['loudest_lufs'] = rep['momentary_max']
        levels['effects_turned_down'] = [{'effect': nm, 'db': d, 'why': why} for nm, d, why in eased]
    if narrated:
        levels['voice_levelled_db'] = round(voice_levelled, 1)
        levels['voice_peaks_limited_db'] = round(voice_cut, 1)
    report = {'mix': _os.path.relpath(out, plan_path.parent).replace('\\', '/'), 'seconds': dur, 'beds': kinds,
              'effects': len(cues), 'spans': spans, 'stems': stems, 'music_cleared': music_cleared, 'master': rep, 'levels': levels}
    rp = plan_path.with_name(plan_path.stem + '.mixed.json')
    rp.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'Wrote {out}: {dur:.2f} s, beds {" → ".join(kinds)}, {len(cues)} effects, {rep["integrated_lufs"]} LUFS, '
          f'{rep["true_peak_dbtp"]} dBTP, LRA {rep["lra"]}; bed {levels["bed_under_program_db"]} dB under the program; '
          + (f'voice levelled by up to {voice_levelled:.1f} dB on its loudest syllables, its peaks limited by {voice_cut:.1f} dB; '
             if narrated else f'no voice: loudest moment {rep["momentary_max"]} LUFS, strongest effect set to {top:.0f}; ')
          + f'effect peaks limited by {fx_cut} dB (the bed is never limited). '
          f'Stems and {rp.name} beside it.')
    return out, rp



# ======================================================================================= sound v2 (2026-11-12): real sounds
# The owner's second listen: a continuous «تشويش» under every voiceless sample (the code-made bed), a written «؟» like a fly
# (the code-made ink.stroke), a candle like a crack (fire.wick). So a final video takes real recordings only: every effect
# the real sound of the thing shown, a bed a real recording of the place with sparse events kept very low, or no bed.
# This path is the one the six rebuilt «مسار خام» samples were mixed with (the sound session's mix_v2.py, folded in here,
# with the gift's own rules added: the quiet zone around quoted text, the effect count, music only on request, interface
# sounds only on an interface picture, and a refusal of any signal that is not a number).

def synthetic_parts(plan):
    """Every code-made part of a plan: a bed by "kind", an effect or a layer by "sound" (ui.* interface sounds excepted:
    they belong to an interface picture and are checked there)."""
    out = []
    for b in plan.get('bed') or []:
        if 'kind' in b and 'file' not in b and 'lib' not in b:
            out.append(f'the bed "{b["kind"]}"')
    for c in plan.get('effects', []):
        if 'sound' in c and not str(c['sound']).startswith('ui.'):
            out.append(f'"{c["sound"]}" at {c["t"]} s')
        for L in c.get('layers') or []:
            if 'sound' in L and not str(L['sound']).startswith('ui.'):
                out.append(f'the layer "{L["sound"]}" at {c["t"]} s')
    return out


def _find(entry, root, plan_dir, what):
    from khaam_sound import library_file
    if entry.get('lib'):
        return library_file(entry['lib'])
    f = entry.get('file')
    if not f:
        fail(f'{what} has neither "lib" (a name from sounds/library/MANIFEST.md) nor "file".')
    for base in (root, plan_dir):
        if (pathlib.Path(base) / f).is_file():
            return pathlib.Path(base) / f
    fail(f'{what}: no file "{f}" (looked from {root} and from {plan_dir}). A library sound is "lib": "<name>" '
         '(sound_mix.py --library lists them).')


def _finite(sig, what):
    if not np.isfinite(sig).all():
        fail(f'{what} is not a number in places (NaN or infinite): nothing was written. Re-make or replace that sound.')
    return sig


def _loop_to(y, ln):
    """A recording shorter than its span, looped with 1 s equal-power crossfades."""
    if len(y) >= ln:
        return y[:ln]
    xf = min(SR, len(y) // 4)
    out = np.zeros((ln + len(y), 2)); pos = 0
    w = np.ones(len(y)); w[:xf] = np.sin(np.linspace(0, np.pi / 2, xf)); w[-xf:] = np.cos(np.linspace(0, np.pi / 2, xf))
    while pos < ln:
        out[pos:pos + len(y)] += y * w[:, None]
        pos += len(y) - xf
    return out[:ln]


def mix_real(plan_path, out_path=None, ceiling=-2.0):
    """Sound v2: real recordings only (khaam_sound.FILM_SOUND; reference/film-sound.md)."""
    from khaam_sound import highpass, tp_limit, static_floor, pan as pan_mono
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    S = FILM_SOUND
    plan_path = pathlib.Path(plan_path).resolve()
    plan = json.loads(plan_path.read_text(encoding='utf-8-sig'))
    plan_dir = plan_path.parent
    root = plan_dir.parent if plan_dir.name == 'plan' else plan_dir
    dur = float(plan['duration']); n = int(round(dur * SR))
    narrated = bool(plan.get('voice'))
    asked = set(plan.get('user_asked', []))
    key = plan.get('key', 'D')
    zones = [(float(z['from']), float(z['to'])) for z in plan.get('scripture', [])]
    pics = plan.get('pictures') or []
    problems = []
    unused = [k for k in ('bed_under_db', 'bed_lufs') if k in plan] + (['master.lufs'] if 'lufs' in (plan.get('master') or {}) else [])
    if unused:
        print(f'Note: {", ".join(unused)} is not used with real sounds: a voice sits at -14, a bed by its loudest 400 ms '
              f'(bed_top, default {S["bed_top"]:.0f}) and its static floor ({S["bed_static_floor"]:.0f}), the effects by effects_top '
              f'(no voice, default {S["effects_top"]:.0f}) or effects_db (with a voice, default {S["effects_db"]:.0f}).')

    def load(path, what):
        return _finite(highpass(as_stereo(read_audio(path)), 70, 2), what)  # a recording's rumble out: a phone plays none of it

    def panned(y, p):
        return pan_mono(y.mean(1), float(p)) if p else y

    # ---- voice: -14 LUFS, levelled on its loudest syllables, its own peak limiter
    voice = np.zeros((n, 2)); duck = np.ones(n)
    if narrated:
        vc = plan['voice']
        v = highpass(load(_find(vc, root, plan_dir, 'the voice'), 'the voice'), 70, 2)
        if vc.get('level', True):
            v, _ = level_voice(v)
        for _ in range(6):
            v = v * 10 ** ((S['voice_lufs'] - integrated_lufs(tp_limit(v, ceiling - 0.4))) / 20)
        v = tp_limit(v, ceiling - 0.4)
        s0 = int(round(float(vc.get('at', 0)) * SR))
        voice[s0:s0 + len(v)] += v[:max(0, n - s0)]
        _, lv = block_loudness(voice, 0.05, 0.01)
        act = np.repeat((lv > integrated_lufs(voice) - 15).astype(float), int(0.01 * SR))
        act = np.pad(act, (0, max(0, n - len(act))))[:n]
        act = uniform_filter1d(maximum_filter1d(act, int(0.15 * SR)), int(0.05 * SR))
        duck = 10 ** (-S['duck_db'] * act / 20)

    # ---- the bed: a real recording of the place, or nothing ("bed": [])
    bed = np.zeros((n, 2)); bed_notes = []; bed_parts = []
    bed_top = float(plan.get('bed_top', S['voice_lufs'] - 20 if narrated else S['bed_top']))
    segs = sorted(plan.get('bed') or [], key=lambda b: float(b.get('from', 0)))
    for i, b in enumerate(segs):
        name = b.get('lib') or b.get('file')
        src = load(_find(b, root, plan_dir, f'bed {i + 1}'), f'bed {name}')
        a, z = max(0.0, float(b.get('from', 0))), min(dur, float(b.get('to', dur)))
        if z - a < 0.5:
            fail(f'bed {i + 1} ({name}) is shorter than half a second.')
        off = int(float(b.get('offset', 0)) * SR); ln = int(round((z - a) * SR))
        y = _loop_to(src[off:], ln)
        g = bed_top + float(b.get('gain_db', 0)) - momentary_max(y)
        w, _ = static_floor(y * 10 ** (g / 20))
        if w and w['floor_lufs'] > S['bed_static_floor']:
            g += S['bed_static_floor'] - w['floor_lufs']
        y = y * 10 ** (g / 20)
        wgt = np.ones(ln)
        prev, nxt = (segs[i - 1] if i else None), (segs[i + 1] if i + 1 < len(segs) else None)
        k_in = int(min(float(prev['to']) - a, z - a) * SR) if prev and float(prev['to']) > a else int((0.25 if a <= 0 else 0.5) * SR)
        k_out = int(min(z - float(nxt['from']), z - a) * SR) if nxt and float(nxt['from']) < z else int((0.6 if z >= dur else 0.5) * SR)
        wgt[:k_in] *= np.sin(np.linspace(0, np.pi / 2, k_in)) ** 2 if not (prev and float(prev['to']) > a) else np.sin(np.linspace(0, np.pi / 2, k_in))
        wgt[ln - k_out:] *= np.cos(np.linspace(0, np.pi / 2, k_out)) ** 2 if not (nxt and float(nxt['from']) < z) else np.cos(np.linspace(0, np.pi / 2, k_out))
        s0 = int(round(a * SR))
        part = (y * wgt[:, None])[:n - s0]
        bed[s0:s0 + ln] += part
        bed_parts.append([s0, part])
        bed_notes.append({'bed': name, 'from': a, 'to': z, 'gain_db': round(g, 1), 'static_floor': w['floor_lufs'] if w else None})

    # ---- effects: each set by its loudest 400 ms, placed on its frame by its attack (or peak, or start)
    top = (S['voice_lufs'] + float(plan.get('effects_db', S['effects_db']))) if narrated else float(plan.get('effects_top', S['effects_top']))
    cues = sorted(plan.get('effects', []), key=lambda c: float(c['t']))
    if cues and 'dense' not in asked:
        ts = [float(c['t']) for c in cues]
        worst = max(sum(1 for u in ts if s <= u < s + 10) for s in ts)
        if worst > 5:
            problems.append(f'{worst} effects inside 10 s (the rule allows 5): keep the moments that matter.')

    def one(entry, what, default_pan):
        if 'sound' in entry:  # only ui.* reaches here (synthetic_parts)
            if entry['sound'] not in SOUNDS:
                fail(f'unknown sound "{entry["sound"]}" in {what} (material_sfx.py --list).')
            y = make_sfx(entry['sound'], int(entry.get('seed', 1)), entry.get('duration'), key, 0.0, float(entry.get('space', 0.15)))
            return _finite(y, what), entry['sound'], MATERIAL_OF[entry['sound']]
        path = _find(entry, root, plan_dir, what)
        y = load(path, what)
        if entry.get('cut'):
            y = y[int(float(entry['cut'][0]) * SR):int(float(entry['cut'][1]) * SR)]
        return panned(y, entry.get('pan', default_pan)), pathlib.Path(str(entry.get('lib') or entry.get('file'))).stem, entry.get('material', '')

    placed, spans = [], []
    for c in cues:
        t = float(c['t'])
        if c.get('layers'):
            parts, names, mats = [], [], []
            for L in c['layers']:
                y, nm, mt = one(L, f'a layer at {t} s', c.get('pan', 0))
                y = y * 10 ** (float(L.get('gain_db', 0)) / 20)
                parts.append((int(round(float(L.get('at', 0)) * SR)) - anchor(y, L.get('align', 'attack')), y))
                names.append(nm); mats.append(mt)
            s_min = min(s for s, _ in parts)
            y = np.zeros((max(s + len(p) for s, p in parts) - s_min, 2))
            for s, p in parts:
                y[s - s_min:s - s_min + len(p)] += p
            start = int(round(t * SR)) + s_min
            name = '+'.join(names)
            mat = 'interface' if 'interface' in mats else (c.get('material') or next((m for m in mats if m), ''))
        else:
            y, name, mat = one(c, f'the effect at {t} s', 0)
            start = int(round(t * SR)) - anchor(y, c.get('align', 'attack'))
        y = y * 10 ** ((top + float(c.get('gain_db', 0)) - momentary_max(y)) / 20)
        why = []
        hm = momentary_max(harsh_band(y))
        if hm > S['harsh_cap']:
            y *= 10 ** ((S['harsh_cap'] - hm) / 20); why.append(f'2-6 kHz -{hm - S["harsh_cap"]:.1f} dB')
        if true_peak_db(y) > ceiling - 0.4:
            y = tp_limit(y, ceiling - 0.4)
        a, b = max(start, 0), min(start + len(y), n)
        if b <= a:
            problems.append(f'the effect at {t} s falls outside the video.'); continue
        seg = y[a - start:b - start]
        if b == n and b - start < len(y):
            seg = fades(seg, 0, 0.03)
        s_from, s_to = sounding_span(seg, a)
        for za, zb in zones:
            if s_from < zb + 0.5 and s_to > za - 0.5:
                problems.append(f'"{name}" sounds {s_from:.2f}-{s_to:.2f} s, inside the quiet zone around the quoted text '
                                f'({za - 0.5:.2f}-{zb + 0.5:.2f} s): move it to a pause outside, or drop it.')
        if mat == 'interface':
            pic = next((p['material'] for p in pics if float(p['from']) <= t < float(p['to'])), None)
            if pic != 'interface':
                problems.append(f'"{name}" at {t} s is an interface sound on a {pic or "non-interface"} picture: interface sounds '
                                'only on an interface (a pressed button).')
        placed.append([a, b, seg * duck[a:b, None], name, t, why])
        spans.append([round(s_from, 3), round(s_to, 3), name])

    # ---- music only on request, never under quoted scripture
    music = np.zeros((n, 2)); music_cleared = False
    if plan.get('music'):
        if 'music' not in asked:
            problems.append('music is in the plan but the user did not ask for it: remove it, or add "music" to "user_asked".')
        else:
            m = _finite(read_audio(_find(plan['music'], root, plan_dir, 'the music'))[:n], 'the music')
            m = m * 10 ** ((S['voice_lufs'] - 18 + float(plan['music'].get('gain_db', 0)) - integrated_lufs(m)) / 20)
            g = np.ones(n); r = int(0.3 * SR)
            for za, zb in zones:
                a, b = int(max(0, za - 0.5) * SR), int(min(dur, zb + 0.5) * SR)
                g[a:b] = 0
                g[max(0, a - r):a] = np.minimum(g[max(0, a - r):a], np.linspace(1, 0, a - max(0, a - r)))
                g[b:b + r] = np.minimum(g[b:b + r], np.linspace(0, 1, len(g[b:b + r])))
            music[:len(m)] = m * g[:len(m), None] * duck[:len(m), None]; music_cleared = True
    if problems:
        fail('the plan breaks the sound rule:\n  - ' + '\n  - '.join(problems))

    # ---- no voice: a stretch held within 6 dB of its top over long_s (one sound or several overlapping) tops out at long_top
    def summed():
        bus = np.zeros((n, 2))
        for a, b, seg, *_ in placed:
            bus[a:b] += seg
        return bus
    if not narrated:
        win = [(int(s[0] * SR), min(n, int((s[1] + 0.25) * SR))) for s in spans]
        for _ in range(12):
            bus, changed = summed(), False
            for s0, s1 in win:
                tm, held = near_top(bus[s0:s1])
                if held > S['long_s'] and tm > S['long_top']:
                    d = tm - S['long_top'] + 0.2
                    for p, (w0, w1) in zip(placed, win):
                        if w0 < s1 and w1 > s0:
                            p[2] = p[2] * 10 ** (-d / 20); p[5].append(f'a long stretch near the top -{d:.1f} dB')
                    changed = True
                    break
            if not changed:
                break
    fx = summed()
    eased = [{'effect': name, 'at': t, 'why': '; '.join(why)} for a, b, seg, name, t, why in placed if why]
    # The floor of the whole mix, measured as check_mix.py measures it: each bed was set alone, but a crossfade, a short
    # span or the effects around it can still leave a 5 s window whose floor holds still (heard as «تشويش»). Any such
    # window over -55 LUFS brings the beds under it down until it sits at -56 (not when the plan says the picture shows a
    # dense ambience: "shown"). Found 2026-11-12 on a voiceless night-to-dawn test: -40 LUFS, the check failed it.
    if bed_parts and not plan.get('shown'):
        for _ in range(6):
            w, _rows = static_floor(voice + fx + bed + music)
            if not w or w['floor_lufs'] <= S['static_warn']:
                break
            w0, w1 = int(w['at_s'] * SR), int((w['at_s'] + 5.0) * SR)
            hit = [k for k, (s0, part) in enumerate(bed_parts) if s0 < w1 and s0 + len(part) > w0]
            if not hit:
                break
            d = w['floor_lufs'] - S['bed_static_floor']
            bed = np.zeros((n, 2))
            for k, (s0, part) in enumerate(bed_parts):
                if k in hit:
                    bed_parts[k][1] = part = part * 10 ** (-d / 20)
                    bed_notes[k]['gain_db'] = round(bed_notes[k]['gain_db'] - d, 1)
                    bed_notes[k]['lowered_for_static_db'] = round(bed_notes[k].get('lowered_for_static_db', 0) + d, 1)
                bed[s0:s0 + len(part)] += part
        for b in bed_notes:
            if b.get('lowered_for_static_db'):
                print(f'Note: the bed "{b["bed"]}" ({b["from"]:.1f}-{b["to"]:.1f} s) came down {b["lowered_for_static_db"]} dB: '
                      'under the whole mix its floor held still (heard as «تشويش»). If it is now too faint, choose a sparser '
                      'recording of the place, or no bed.')
    total = _finite(voice + fx + bed + music, 'the mix')
    final = tp_limit(total, ceiling - 0.1)
    out = pathlib.Path(out_path) if out_path else root / 'assets' / 'mix.wav'
    write_wav(out, final)
    sd = out.with_suffix('.stems'); stems = {}
    for k, sig in (('bed', bed), ('fx', fx), ('voice', voice), ('music', music)):
        if k == 'fx' or (k == 'voice' and narrated) or np.abs(sig).max() > 0:
            write_wav(sd / f'{k}.wav', np.clip(sig, -0.999, 0.999))
            stems[k] = _os.path.relpath(sd / f'{k}.wav', plan_dir).replace('\\', '/')
    rep = {'integrated_lufs': round(integrated_lufs(final), 2), 'true_peak_dbtp': round(true_peak_db(final), 2),
           'lra': round(loudness_range(final), 2), 'momentary_max': round(momentary_max(final), 1)}
    report = {'mix': _os.path.relpath(out, plan_dir).replace('\\', '/'), 'seconds': dur, 'standard': 'v2: real sounds (2026-11-12)',
              'beds': [b['bed'] for b in bed_notes], 'effects': len(cues), 'spans': spans, 'stems': stems,
              'music_cleared': music_cleared, 'master': rep,
              'levels': {'effects_top_lufs': top, 'bed_top_lufs': bed_top, 'beds': bed_notes, 'effects_turned_down': eased,
                         'loudest_lufs': rep['momentary_max'],
                         'voice_lufs': round(integrated_lufs(voice), 1) if narrated else None}}
    rp = plan_path.with_name(plan_path.stem + '.mixed.json')
    rp.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    for e in eased:
        print(f'Note: "{e["effect"]}" at {e["at"]} s turned down ({e["why"]}): the standard keeps it quieter.')
    print(f'Wrote {out}: {dur:.2f} s, real sounds, {"a voice at -14 LUFS, " if narrated else "no voice, "}'
          f'{len(cues)} effects (the strongest at {top:.0f} LUFS loudest), '
          + ('beds ' + ', '.join('%s %+.1f dB' % (b['bed'], b['gain_db']) for b in bed_notes) if bed_notes else 'no bed')
          + f'; {rep["integrated_lufs"]} LUFS, loudest {rep["momentary_max"]}, {rep["true_peak_dbtp"]} dBTP. Stems and {rp.name} beside it.')
    return out, rp


def mix(plan_path, out_path=None, ceiling=-2.0):
    """Real sounds (v2) unless the plan is marked "sketch": true; a plan with code-made sounds and no such mark is refused."""
    plan = json.loads(pathlib.Path(plan_path).read_text(encoding='utf-8-sig'))
    synth = synthetic_parts(plan)
    if plan.get('sketch'):
        print('Note: a SKETCH ("sketch": true): code-made sounds are allowed to hear a draft, and the check fails it as not final. '
              'A finished video takes real recordings only (reference/film-sound.md, rule 1).')
        return mix_sketch(plan_path, out_path, ceiling)
    if synth:
        fail('real sounds only (sound v2, 2026-11-12: the owner heard the code-made bed as a continuous «تشويش», a code-made '
             'pen as a fly and a code-made candle as a crack). Code-made in this plan: ' + '; '.join(synth) + '.\n'
             '  Replace each effect with a real recording of the thing shown ("lib": a name from sounds/library/MANIFEST.md, or '
             '"file": a CC0 recording in the project; openverse_sfx.py finds more), and the bed with a real recording of the place '
             '("lib": "amb-night-crickets", ...) or "bed": [] when the place has no sound of its own.\n'
             '  To hear a quick draft as it is, add "sketch": true to the plan: the check will then fail it as not final.')
    return mix_real(plan_path, out_path, ceiling)


def list_library():
    from khaam_sound import skill_dir
    man = skill_dir() / 'sounds' / 'library' / 'MANIFEST.md'
    if not man.is_file():
        raise SystemExit(f'No library at {man.parent}: is the skill complete?')
    for line in man.read_text(encoding='utf-8').splitlines():
        if line.startswith('| `'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            print(f'{cells[0].strip("`"):24s} {cells[2]:>6s} s  {cells[1]}')
    print(f'Licences and sources: {man}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('plan', nargs='?')
    ap.add_argument('--out', help='default: <video folder>/assets/mix.wav')
    ap.add_argument('--ceiling', type=float, default=-2.0, help='true-peak ceiling before encoding (default -2 dBTP)')
    ap.add_argument('--no-check', action='store_true')
    ap.add_argument('--library', action='store_true', help='list the real recordings that ship with the skill')
    a = ap.parse_args()
    if a.library:
        list_library(); return
    if not a.plan:
        ap.error('give the plan (plan/sound.json), or --library')
    try:
        out, _ = mix(a.plan, a.out, a.ceiling)
    except MemoryError:
        raise SystemExit('sound_mix: the PC is short of memory right now (another render?). Run it again when that ends.')
    if not a.no_check:
        import subprocess
        r = subprocess.run([sys.executable, '-I', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'check_mix.py'),
                            str(out), '--plan', a.plan])
        sys.exit(r.returncode)


if __name__ == '__main__':
    main()
