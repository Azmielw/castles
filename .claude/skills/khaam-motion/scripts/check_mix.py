#!/usr/bin/env python3
"""The sound check (new in 1.7): measures a finished mix against the film-sound rule and fails loudly.

  python "<skill>/scripts/check_mix.py" "renders/final/video v1.mp4"
  python "<skill>/scripts/check_mix.py" assets/mix.wav --plan plan/sound.json --json plan/sound-check.json

Reads a WAV or a finished video. Exit code 0 = passes, 1 = fails (every failure says what to change).
Without --plan it measures the audio alone (effects are then estimated from the sound itself).
With the plan written for sound_mix.py it also checks: the effects count exactly (a moment built from "layers" counts
once; with a voice no estimate is made from the sound: it would count syllables), quiet around quoted scripture,
music only when the user asked and never under scripture, interface tones only on interface pictures, the voice on top.

The rule (reference/film-sound.md): a bed from the first frame to the last; 3-5 effects that belong to the
picture (no more than 5 in any 10 s); no music unless the user asks, never under quoted scripture; effects cleared
0.5 s around quoted scripture; a voice always on top; true peak under -1 dBTP.
Levels (sound v2, 2026-11-12, khaam_sound.FILM_SOUND): with a voice, -14 LUFS integrated, the voice on top, bed + effects
in 2-6 kHz at most -28. With no voice, nothing comes near speech: the loudest 400 ms at most -22 LUFS, the 2-6 kHz band at
most -28, through a phone speaker at most -22, a stretch held near its top over 1.2 s at most -27, integrated at most -24
(no target), every effect's top at least -34 (warn).
Both (v2): no static floor (a 5 s window whose quietest 30% of 100 ms frames spread under 3 dB with a noise-like spectrum:
FAIL above -50 LUFS, WARN -55 to -50; heard as «تشويش»); no buzz (an effect over -34 LUFS with a narrow 60-300 Hz envelope
peak of 15 dB or more: heard as a fly); with --plan, real sounds only (no code-made bed or effect unless "sketch": true,
which fails as not final). A bed is optional: digital silence, near-silence and bed presence are information only.
Both: no rising whine (an effect whose pitch climbs into 2.5 kHz+ as it swells reads as an insect coming at you).
Without --plan the check cannot know there is a voice: pass --voice for a narrated video.
Tools measure, they don't hear: a pass means the numbers hold, not that it sounds good. Say so to the user.
"""
import argparse, json, pathlib, re, subprocess, sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # works under python -I
import numpy as np
from scipy.signal import sosfilt
from khaam_sound import (SR, read_audio, integrated_lufs, loudness_range, true_peak_db, block_loudness, ffmpeg_bin, _k_sos,
                         as_stereo, FILM_SOUND, harsh_band, phone_path, static_floor, buzz)

RULE = dict(lufs=-14.0, lufs_tol=1.0, tp_max=-1.0, near_silence_max=2.0, digital_silence_max=0.5, bed_presence_min=98.0,
            gap_max=0.25, max_fx_per_10s=5, min_fx=3, clear_s=0.5, lra_warn=6.0, low_warn=25.0)


def ffmpeg_r128(path):
    ff = ffmpeg_bin()
    if not ff:
        return None
    r = subprocess.run([ff, '-nostats', '-hide_banner', '-i', str(path), '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    tail = r.stderr[r.stderr.rfind('Summary:'):] if 'Summary:' in r.stderr else ''
    g = lambda pat: (float(m.group(1)) if (m := re.search(pat, tail)) else None)
    out = {'integrated_lufs': g(r'I:\s+(-?[\d.]+|-inf) LUFS'), 'lra': g(r'LRA:\s+(-?[\d.]+) LU'),
           'true_peak_dbtp': g(r'Peak:\s+(-?[\d.]+|-inf) dBFS')}
    return out if out['integrated_lufs'] is not None else None


def frames_db(x, win):
    """Unweighted RMS in dBFS for consecutive windows of `win` seconds (both channels)."""
    w = max(1, int(win * SR)); m = (as_stereo(x) ** 2).mean(1)
    k = len(m) // w
    return 10 * np.log10(np.maximum(m[:k * w].reshape(k, w).mean(1), 1e-30))


def k_frames(x, win):
    """K-weighted loudness of consecutive windows (LUFS-like), so a floor can be compared with integrated loudness."""
    w = max(1, int(win * SR)); k = sosfilt(_k_sos(), as_stereo(x), axis=0); p = (k ** 2).sum(1)
    n = len(p) // w
    return -0.691 + 10 * np.log10(np.maximum(p[:n * w].reshape(n, w).mean(1), 1e-30))


def estimate_effects(x, integrated):
    """Effects estimated from the sound alone: sharp rises (at least 6 dB inside 100 ms) that reach the foreground
    (within 18 dB of the integrated loudness) and stand 8 dB over the running floor; rises closer than 0.25 s count once.
    Slow swells are not counted. An estimate for a mix without a plan, not a count."""
    hop = 0.01
    lv = k_frames(x, hop)
    if len(lv) < 12:
        return []
    from scipy.ndimage import percentile_filter, minimum_filter1d
    lv = np.convolve(lv, np.ones(2) / 2, mode='same')
    floor = np.maximum(percentile_filter(lv, 20, size=int(1.5 / hop), mode='nearest'), integrated - 40)
    prev_min = np.concatenate([np.full(10, lv[0]), minimum_filter1d(lv, size=10, mode='nearest')[5:-5]])[:len(lv)]
    rise = lv - prev_min
    fg = integrated - 18
    events, last = [], -9.0
    for i in range(len(lv)):
        t = i * hop
        if rise[i] >= 6 and lv[i] > fg and lv[i] > floor[i] + 8 and t - last > 0.25:
            events.append(round(t, 2)); last = t
    return events


def mom_max(x):
    """Momentary loudness maximum (400 ms blocks, 50 ms hop), LUFS."""
    return float(block_loudness(x, 0.4, 0.05)[1].max()) if len(x) else -120.0


def rising_whine(y):
    """(octaves the spectral centroid climbs from the first 100 ms within 20 dB of the top to the top, dB the level climbs,
    the centroid at the top in Hz). A noise band that climbs in pitch while it swells, ending high, is how an insect
    flying at the ear sounds: sample 2's candle (1.7.0 light.swell) climbed 0.8 octave and 19 dB to 3.0 kHz."""
    m = as_stereo(y).mean(1); h = int(0.1 * SR)
    lv, ce = [], []
    for i in range(0, len(m) - h + 1, h):
        s = m[i:i + h]; S = np.abs(np.fft.rfft(s * np.hanning(h))) ** 2; f = np.fft.rfftfreq(h, 1 / SR)
        lv.append(10 * np.log10((s ** 2).mean() + 1e-20)); ce.append(float((S * f).sum() / max(S.sum(), 1e-30)))
    if len(lv) < 3:
        return 0.0, 0.0, ce[0] if ce else 0.0
    lv = np.array(lv); top = int(np.argmax(lv)); st = int(np.argmax(lv > lv[top] - 20))
    return float(np.log2(max(ce[top], 1) / max(ce[st], 1))), float(lv[top] - lv[st]), ce[top]


def per_effect(fx, spans):
    """Each effect cut from the effects stem by the mixer's own span (+0.25 s of tail)."""
    out = []
    for s, e, name in spans:
        y = fx[int(s * SR):min(len(fx), int((e + 0.25) * SR))]
        if len(y) < int(0.4 * SR):
            y = np.pad(y, ((0, int(0.4 * SR) - len(y)), (0, 0)))
        _, Mv = block_loudness(y, 0.4, 0.02)
        top = float(Mv.max())
        octs, rise, ctop = rising_whine(y)
        out.append({'effect': name, 'from': s, 'top_lufs': round(top, 1), 'held_s': round(float((Mv >= top - 6).sum()) * 0.02, 2),
                    'harsh_top_lufs': round(mom_max(harsh_band(y)), 1), 'climb_octaves': round(octs, 2), 'climb_db': round(rise, 1),
                    'centroid_at_top_hz': int(ctop)})
    return out


def max_in_window(times, span=10.0):
    t = sorted(times)
    return max((sum(1 for u in t if s <= u < s + span) for s in t), default=0)


def plan_span(c):
    """Where an effect sounds, from the plan alone (sound_mix.py's report has the measured spans)."""
    t = float(c['t'])
    if c.get('layers'):
        L = c['layers']
        return (t + min(float(l.get('at', 0)) for l in L),
                t + max(float(l.get('at', 0)) + float(l.get('duration') or l.get('d') or 0.5) for l in L),
                '+'.join(str(l.get('sound') or l.get('file') or l.get('lib')) for l in L))
    return (t, t + float(c.get('length', 0.5)), c.get('sound') or c.get('file') or c.get('lib'))


def plan_material(c, material_of):
    """An effect's material as the mixer sees it: a moment built from layers is an interface sound if any layer is one."""
    if c.get('layers'):
        mats = [l.get('material') or material_of.get(l.get('sound', ''), '') for l in c['layers']]
        return 'interface' if 'interface' in mats else (c.get('material') or next((m for m in mats if m), ''))
    return c.get('material') or material_of.get(c.get('sound', ''), '')


def load_plan(path):
    p = pathlib.Path(path)
    plan = json.loads(p.read_text(encoding='utf-8-sig'))
    plan['_dir'] = p.parent
    return plan


def check(path, plan=None, quiet=False, voice=False):
    x = read_audio(path)
    # an AAC encode adds up to ~21 ms of digital zero at the start and the end (encoder priming and padding):
    # not a gap in the floor, so up to 50 ms of it is trimmed at each end before measuring (and reported)
    amp = np.abs(x).max(1) if len(x) else np.zeros(0)
    zero = amp < 10 ** (-80 / 20)
    lead = int(np.argmax(~zero)) if (~zero).any() else 0
    tail = int(np.argmax(~zero[::-1])) if (~zero).any() else 0
    lead, tail = (lead if lead <= 0.05 * SR else 0), (tail if tail <= 0.05 * SR else 0)
    x = x[lead:len(x) - tail]
    dur = len(x) / SR
    res = {'file': pathlib.Path(path).name, 'seconds': round(dur, 2), 'checks': [], 'measured': {}}
    M = res['measured']
    M['edge_padding_trimmed_ms'] = [round(lead / SR * 1000, 1), round(tail / SR * 1000, 1)]
    rule = dict(RULE)
    asked = set((plan or {}).get('user_asked', []))
    if plan:
        rule['lufs'] = float(plan.get('master', {}).get('lufs', rule['lufs']))

    def add(name, ok, value, target, fix='', level='fail'):
        res['checks'].append({'check': name, 'status': 'pass' if ok else level, 'value': value, 'target': target,
                              **({'fix': fix} if not ok and fix else {})})

    def info(name, value, target):
        res['checks'].append({'check': name, 'status': 'info', 'value': value, 'target': target})

    r = ffmpeg_r128(path)
    M['integrated_lufs'] = r['integrated_lufs'] if r else round(integrated_lufs(x), 2)
    M['true_peak_dbtp'] = r['true_peak_dbtp'] if r else round(true_peak_db(x), 2)
    M['lra'] = r['lra'] if r else round(loudness_range(x), 2)
    M['meter'] = 'ffmpeg ebur128' if r else 'khaam_sound (BS.1770-4)'
    M['sample_peak_dbfs'] = round(20 * np.log10(max(np.abs(x).max(), 1e-12)), 2)
    I = M['integrated_lufs'] if M['integrated_lufs'] is not None else -70.0

    f100 = frames_db(x, 0.1)
    M['near_silence_pct'] = round(100 * float((f100 < -50).mean()), 1)
    f50 = frames_db(x, 0.05)
    M['digital_silence_pct'] = round(100 * float((f50 < -80).mean()), 1)
    # the floor: the quietest 20 ms inside each half second, K-weighted
    k20 = k_frames(x, 0.02)
    from scipy.ndimage import minimum_filter1d
    fl = minimum_filter1d(k20, size=25, mode='nearest')
    present = fl >= -52
    M['bed_presence_pct'] = round(100 * float(present.mean()), 1)
    gaps, run = [], 0
    for p in present:
        run = 0 if p else run + 1
        gaps.append(run)
    M['longest_gap_s'] = round(max(gaps, default=0) * 0.02, 2)
    # the floor's level: the quiet tenth of the video (between effects, between words)
    M['floor_lufs'] = round(max(float(np.percentile(k20, 10)), -120.0), 1) if len(k20) else -120.0
    M['floor_under_program_db'] = round(I - M['floor_lufs'], 1)
    mono = x.mean(1); S = np.abs(np.fft.rfft(mono)) ** 2; f = np.fft.rfftfreq(len(mono), 1 / SR)
    M['energy_below_100hz_pct'] = round(100 * float(S[f < 100].sum() / max(S.sum(), 1e-30)), 1)
    # where things sit (2026-11-12): the loudest 400 ms, the 2-6 kHz band, a phone speaker, the mono sum
    M['momentary_max_lufs'] = round(mom_max(x), 1)
    M['harsh_momentary_max_lufs'] = round(mom_max(harsh_band(x)), 1)
    xp = phone_path(x)
    M['phone_momentary_max_lufs'] = round(mom_max(xp), 1)
    kp = k_frames(xp, 0.02)
    M['phone_floor_lufs'] = round(max(float(np.percentile(kp, 10)), -120.0), 1) if len(kp) else -120.0
    M['loudest_over_floor_db'] = round(M['momentary_max_lufs'] - M['floor_lufs'], 1)
    M['phone_loudest_over_floor_db'] = round(M['phone_momentary_max_lufs'] - M['phone_floor_lufs'], 1)
    M['mono_momentary_max_lufs'] = round(mom_max(np.stack([mono, mono], 1)), 1)
    S_ = FILM_SOUND

    narrated = bool(plan and plan.get('voice')) or bool(voice)
    # with a voice the estimate would count syllables (71 for a plan of 5), and on the effects stem the ducking under
    # every word and a thunder's roll (10 for a plan of 5): the plan's count is exact, so no estimate is made
    est = None if narrated else estimate_effects(x, I)
    M['effects_estimated'] = None if est is None else len(est)
    M['effects_estimated_at'] = est or []
    cues = None
    if plan:
        cues = [float(c['t']) for c in plan.get('effects', [])]
        M['effects_in_plan'] = len(cues)
    times = cues if cues is not None else (est if est is not None else [])
    M['effects_counted_from'] = ('the plan' if cues is not None else 'an estimate from the sound' if est is not None
                                 else 'not counted: a voice and no plan')
    M['effects_max_in_10s'] = max_in_window(times)
    M['effects_per_10s'] = round(len(times) / dur * 10, 1) if dur else 0

    # ---- the rule
    if narrated:
        add('loudness', abs(I - rule['lufs']) <= rule['lufs_tol'], f'{I:.1f} LUFS', f"{rule['lufs']:.0f} ±{rule['lufs_tol']:.0f} LUFS",
            f"Master again to {rule['lufs']:.0f} LUFS: one gain of {rule['lufs'] - I:+.1f} dB plus the true-peak limiter "
            '(sound_mix.py does this). Never two-pass loudnorm in dynamic mode.')
    else:
        # no voice (sound v2, 2026-11-12): no integrated target (BS.1770 gates any bed out, so the number only counts how many
        # effects there are and how long they ring); a high one means the effects sit near the loudness of speech
        add('loudness (no voice: no target)', I <= S_['integrated_max'], f'{I:.1f} LUFS',
            f"at most {S_['integrated_max']:.0f} LUFS (expect -34 to -28)",
            f'Too loud for a video with no voice: only the effects can carry {I:.1f} LUFS. Never master a voiceless video to '
            f"-14. Mix it again with sound_mix.py (the strongest effect at {S_['effects_top']:.0f} LUFS). If this video has a "
            'voice, check it with --plan (or --voice).')
        if I < S_['integrated_low']:
            add('loudness (no voice: not too quiet)', False, f'{I:.1f} LUFS', f"over {S_['integrated_low']:.0f} LUFS",
                f"Very quiet: check that the strongest effect sits at {S_['effects_top']:.0f} LUFS (loudest 400 ms).", 'warn')
        add('loudest moment', M['momentary_max_lufs'] <= S_['loudest_max'], f"{M['momentary_max_lufs']} LUFS (loudest 400 ms)",
            f"at most {S_['loudest_max']:.0f} LUFS (a voice would sit at -14)",
            f"An effect is too strong. Turn the effects down {M['momentary_max_lufs'] - S_['effects_top']:.0f} dB: the strongest "
            f"at {S_['effects_top']:.0f} LUFS, the others under it (effects_top in the plan; sound_mix.py does it).")
        add('2-6 kHz band', M['harsh_momentary_max_lufs'] <= S_['harsh_max'], f"{M['harsh_momentary_max_lufs']} LUFS (loudest 400 ms)",
            f"at most {S_['harsh_max']:.0f} LUFS",
            'A bright sound (a scratch, a hiss, a flare) sits where the ear and a phone speaker are most sensitive: turn it '
            'down (sound_mix.py turns any effect whose band passes -29 down to it).')
        add('phone speaker', M['phone_momentary_max_lufs'] <= S_['phone_max'],
            f"loudest {M['phone_momentary_max_lufs']} LUFS (mono, 400 Hz-8 kHz)", f"at most {S_['phone_max']:.0f} LUFS",
            'A phone speaker plays bright effects in full: turn them down.')
        info('loudest over the floor', f"{M['loudest_over_floor_db']} dB (phone {M['phone_loudest_over_floor_db']} dB)",
             'round 1 only; with real sounds and often no bed it is not judged')
    add('true peak', M['true_peak_dbtp'] <= rule['tp_max'], f"{M['true_peak_dbtp']:.1f} dBTP", f"under {rule['tp_max']:.0f} dBTP",
        'Lower the limiter ceiling to -2 dBTP before encoding (AAC adds up to about 0.5 dB).')
    # sound v2 (2026-11-12): a bed is a real recording of the place, or nothing; a page, a studio shot or a dark room has
    # no sound of its own, and a code-made bed under it was the «تشويش» the owner heard. So these are information only.
    info('digital silence', f"{M['digital_silence_pct']}% of the video", 'information (a video may have no bed)')
    info('near-silence', f"{M['near_silence_pct']}% below -50 dB", 'information')
    info('bed present', f"{M['bed_presence_pct']}% of the time, longest gap {M['longest_gap_s']} s", 'information')
    info('floor', f"{M['floor_lufs']} LUFS (the quiet tenth; {M['floor_under_program_db']} dB under the program)", 'information')
    # the static floor: heard as «تشويش»
    w, rows = static_floor(x)
    shown = bool(plan and plan.get('shown'))
    M['static_floor_worst'] = w; M['static_windows'] = f"{sum(r['static'] for r in rows)}/{len(rows)}"
    st_fix = ('A steady noise sits between the sounds (heard as «تشويش»): a code-made bed, a room tone, or a recording with a '
              'hiss floor. Use a real bed of the place with sparse events (sound_mix.py sets it by its floor, -56), or no bed.')
    if w is None:
        add('no static floor', True, f"0/{len(rows)} windows static", f"no static floor over {S_['static_fail']:.0f} LUFS")
    else:
        txt = (f"{M['static_windows']} windows static; loudest at {w['at_s']} s: {w['floor_lufs']} LUFS, spread {w['spread_db']} dB, "
               f"flatness {w['flatness']}")
        if w['floor_lufs'] > S_['static_fail'] and not shown:
            add('no static floor', False, txt, f"no static floor over {S_['static_fail']:.0f} LUFS", st_fix)
        elif w['floor_lufs'] > S_['static_warn']:
            add('no static floor', False, txt, f"no static floor over {S_['static_warn']:.0f} LUFS" +
                (' (the plan says the picture shows it)' if shown else ''), st_fix, 'warn')
        else:
            add('no static floor', True, txt, f"static floors under {S_['static_warn']:.0f} LUFS only")
    n_fx, mx = len(times), M['effects_max_in_10s']
    dense_ok = 'dense' in asked or (narrated and cues is None)  # a voice and no plan: nothing to count from
    add('effects: few, not one per event', mx <= rule['max_fx_per_10s'] or dense_ok,
        f"{n_fx} effects ({M['effects_counted_from']}), at most {mx} in any 10 s",
        f"3-5 per video, ≤ {rule['max_fx_per_10s']} in any 10 s",
        'Too many effects: the ear hears a list of clicks, not a scene. Keep only the moments that matter (the hook landing, '
        'the turn, the payoff, the call to action) and let the bed carry the rest.')
    if dur >= 6 and n_fx < rule['min_fx'] and not narrated:
        add('effects: enough moments', False, f'{n_fx} effects', 'at least 3 in a video without a voice',
            'Mark the three moments that matter with a soft effect from the picture\'s material.', 'warn')
    if narrated:
        add('loudness range', M['lra'] is None or M['lra'] <= rule['lra_warn'], f"{M['lra']} LU", f"≤ {rule['lra_warn']:.0f} LU",
            'Loud hits over a very quiet floor: bring the effects down 2-3 dB or the bed up 2-3 dB.', 'warn')
    # no voice: the loudness range is not checked any more (2026-11-12). Its old advice (never raise the bed, make every
    # moment ring longer, all to hold -14) is what pushed the voiceless samples to the loudness of speech; the
    # "loudest over the bed" line above is the measure that matters there.
    add('mono', M['mono_momentary_max_lufs'] >= M['momentary_max_lufs'] - 3, f"loudest {M['mono_momentary_max_lufs']} LUFS in mono",
        f"within 3 dB of stereo ({M['momentary_max_lufs']})", 'Something cancels in mono (a phone plays mono): narrow the widest effect.', 'warn')
    add('phone speakers', M['energy_below_100hz_pct'] <= rule['low_warn'], f"{M['energy_below_100hz_pct']}% below 100 Hz",
        f"≤ {rule['low_warn']:.0f}%", 'A phone cannot play this much low end: high-pass the bed at 80-120 Hz or give low hits a '
        'higher contact layer.', 'warn')
    add('no clipping', M['sample_peak_dbfs'] < -0.01, f"{M['sample_peak_dbfs']} dBFS", 'under 0 dBFS', 'Lower the master and limit again.')

    if plan:
        res['plan'] = str(plan.get('_name', 'plan'))
        synth = ([f"the bed \"{b.get('kind')}\"" for b in plan.get('bed') or [] if 'kind' in b and 'file' not in b and 'lib' not in b] +
                 [f"\"{c['sound']}\" at {c['t']} s" for c in plan.get('effects', []) if 'sound' in c and not str(c['sound']).startswith('ui.')] +
                 [f"the layer \"{l['sound']}\" at {c['t']} s" for c in plan.get('effects', []) for l in c.get('layers') or []
                  if 'sound' in l and not str(l['sound']).startswith('ui.')])
        sketch = bool(plan.get('sketch'))
        add('real sounds only', not synth and not sketch, ('a sketch: ' if sketch else '') + ('; '.join(synth) or 'all real recordings'),
            'no code-made bed or effect in a finished video',
            'Replace each with a real recording of the thing shown ("lib": sounds/library/MANIFEST.md, or a CC0 file), the bed '
            'with a real recording of the place or "bed": [], and remove "sketch": true.')
        st0 = plan.get('_stems')
        if st0 is not None:
            need = ['fx'] + (['voice'] if narrated else [])
            missing = [k for k in need if not (st0.get(k) and pathlib.Path(st0[k]).is_file())]
            add('stems from the mixer', not missing, 'all there' if not missing else 'missing: ' + ', '.join(missing),
                'the stems sound_mix.py records beside the plan',
                'Mix again with sound_mix.py (it refuses a sound that is not a number, and records every stem it writes).')
        music = plan.get('music')
        add('no music unless asked', not music or 'music' in asked, 'music on' if music else 'no music', 'no music by default',
            'Remove the music, or record in the plan that the user asked for it ("user_asked": ["music"]).')
        zones = [(float(z['from']), float(z['to'])) for z in plan.get('scripture', [])]
        spans = plan.get('_spans') or [plan_span(c) for c in plan.get('effects', [])]
        bad = [f'{s:.2f}-{e:.2f} s {nm}' for s, e, nm in spans for a, b in zones if s < b + rule['clear_s'] and e > a - rule['clear_s']]
        add('quiet around quoted scripture', not bad, '; '.join(bad) or (f'{len(zones)} zone(s) clear' if zones else 'no quoted scripture'),
            f"no effect from 0.5 s before to 0.5 s after", 'Move or remove: ' + '; '.join(bad))
        if music and zones:
            add('no music under scripture', bool(plan.get('_music_cleared')), 'music cleared' if plan.get('_music_cleared') else 'music under scripture',
                'music silent from 0.5 s before to 0.5 s after', 'Cut the music around the quoted text (sound_mix.py does it).')
        pics = plan.get('pictures') or []
        if pics:
            from material_sfx import MATERIAL_OF
            wrong = []
            for c in plan.get('effects', []):
                mat = plan_material(c, MATERIAL_OF)
                pic = next((p['material'] for p in pics if float(p['from']) <= float(c['t']) < float(p['to'])), None)
                if mat == 'interface' and pic != 'interface':
                    wrong.append(f"{c['t']} s {plan_span(c)[2]} on a {pic} picture")
            add('interface tones only on interfaces', not wrong, '; '.join(wrong) or 'ok', 'ui.* only where the picture is an interface',
                'Swap each for a sound of the picture\'s own material (material_sfx.py --list).')
        stems = plan.get('_stems')
        have = lambda k: bool(stems and stems.get(k) and pathlib.Path(stems[k]).is_file())
        if narrated and have('voice') and (have('fx') or have('bed')):
            v = read_audio(stems['voice'])
            parts = [read_audio(stems[k]) for k in ('bed', 'fx') if have(k)]
            m0 = min(len(q) for q in parts); rest = sum(q[:m0] for q in parts)
            n = min(len(v), len(rest), len(x)); v, rest = v[:n], rest[:n]
            _, lv = block_loudness(v); _, lr = block_loudness(rest)
            Iv = integrated_lufs(v); voiced = lv > Iv - 10
            margin = float(np.min(lv[voiced] - lr[voiced])) if voiced.any() else 99.0
            M['voice_over_rest_min_db'] = round(margin, 1)
            add('voice on top', margin >= 8, f'{margin:.1f} dB (worst 400 ms while speaking)', '≥ 8 dB over bed + effects',
                'Something covers the voice: duck the effects under every spoken word, or move the effect into a pause. A pause '
                'shorter than 0.8 s does not clear an effect (every 400 ms there still holds a word): lower it 3-5 dB instead.')
            # the same through a phone speaker (mono, 400 Hz-8 kHz): it drops the voice's body but plays bright effects in full.
            # Judged only where the voice is present on the phone (a word's low tail that a phone never plays is not counted).
            # A warning: the full-band line above is the rule; this one is new (2026-11-12) and nobody has listened yet.
            pvv = phone_path(v); tpv, pv = block_loudness(pvv); _, pr = block_loudness(phone_path(rest))
            on = pv > integrated_lufs(pvv) - 10
            pm = float(np.min(pv[on] - pr[on])) if on.any() else 99.0
            at = float(tpv[on][np.argmin(pv[on] - pr[on])]) if on.any() else 0.0
            M['phone_voice_over_rest_min_db'] = round(pm, 1)
            add('voice on top, phone speaker', pm >= 8, f'{pm:.1f} dB (worst 400 ms while speaking, at {at:.1f} s; mono 400 Hz-8 kHz)',
                '≥ 8 dB over bed + effects', 'On a phone a bright effect or a hissy bed comes up against the voice here: '
                'turn the bright effect down or move it into a pause.', 'warn')
            hb = round(mom_max(harsh_band(rest)), 1)
            M['bed_fx_harsh_momentary_max_lufs'] = hb
            add('2-6 kHz band (bed + effects)', hb <= S_['harsh_max'], f'{hb} LUFS (loudest 400 ms)', f"at most {S_['harsh_max']:.0f} LUFS",
                'A bright effect or a hissy bed sits where the ear and a phone speaker are most sensitive: turn it down or use a warmer sound.')
        if stems and stems.get('fx') and pathlib.Path(stems['fx']).is_file() and spans:
            # every effect alone, from the mixer's own stem and spans
            fx = read_audio(stems['fx'])
            bed_l = integrated_lufs(read_audio(stems['bed'])) if stems.get('bed') and pathlib.Path(stems['bed']).is_file() else M['floor_lufs']
            rows = per_effect(fx, spans)
            for r, (s0_, e0_, _nm) in zip(rows, spans):
                r['buzz_db'], r['buzz_hz'] = buzz(fx[int(s0_ * SR):min(len(fx), int((e0_ + 0.25) * SR))])
            M['effects_alone'] = rows
            bz = [f"{r['effect']} at {r['from']:.2f} s ({r['buzz_db']} dB at {r['buzz_hz']} Hz, top {r['top_lufs']})"
                  for r in rows if r['buzz_db'] >= S_['buzz_fail'] and r['top_lufs'] > S_['buzz_min_top']]
            add('no buzz', not bz, '; '.join(bz) or 'none',
                f"no effect over {S_['buzz_min_top']:.0f} LUFS with a narrow 60-300 Hz envelope peak of {S_['buzz_fail']:.0f} dB",
                'This sound is modulated like a wing beat and reads as a fly (a code-made scratch, or one recording repeated at '
                'an exact interval): use a real recording of the thing, played once.')
            whines = [r for r in rows if r['climb_octaves'] >= 0.75 and r['climb_db'] >= 12 and r['centroid_at_top_hz'] >= 2500]
            txt = lambda rs: '; '.join(f"{r['effect']} at {r['from']:.2f} s (+{r['climb_octaves']} octave, +{r['climb_db']} dB, to "
                                       f"{r['centroid_at_top_hz']} Hz, top {r['top_lufs']} LUFS)" for r in rs)
            # 2026-11-12 (close-loop): the fix depends on what climbs. A code-made sound is swapped; a real recording (a pencil's
            # last loud stroke, a whoosh's tail) is cut before the climb or lowered, never swapped for a code-made one.
            made = set()
            if plan:
                made = ({str(c['sound']) for c in plan.get('effects', []) if 'sound' in c} |
                        {str(l['sound']) for c in plan.get('effects', []) for l in c.get('layers') or [] if 'sound' in l})
            is_made = lambda r: any(p in made for p in str(r['effect']).split('+'))
            fix_made = ('This reads as an insect flying at the ear, not as light or air. Use a sound that stays warm as it swells '
                        '(light.swell since 2026-11-12 rises about one octave under 3 kHz), or the thing itself (a flame: '
                        'fire.wick or fire.catch).')
            fix_real = ('This real recording climbs at its end (a pencil\'s last loud stroke, a tail that brightens): play only its '
                        'even part ("cut": [from, to] in plan/sound.json, ending before the climb; pencil-strokes: "cut": [0, 0.5]), '
                        'or lower it 4-6 dB. Never swap it for a code-made sound.')
            whine_fix = lambda rs: ' '.join(dict.fromkeys(fix_made if is_made(r) else fix_real for r in rs))
            loud_w = [r for r in whines if r['top_lufs'] > S_['whine_fail_above']]
            add('no rising whine', not loud_w, txt(loud_w) or 'none in the foreground',
                f"no effect over {S_['whine_fail_above']:.0f} LUFS climbs 0.75+ octave and 12+ dB into 2.5 kHz+", whine_fix(loud_w))
            quiet_w = [r for r in whines if r['top_lufs'] <= S_['whine_fail_above']]
            if quiet_w:
                add('rising whine, kept quiet', False, txt(quiet_w), 'none', 'Quiet enough to pass, but never raise it: ' + whine_fix(quiet_w), 'warn')
            if not narrated:
                long_ = [f"{r['effect']} at {r['from']:.2f} s ({r['held_s']} s near its top, top {r['top_lufs']} LUFS)"
                         for r in rows if r['held_s'] > S_['long_s'] and r['top_lufs'] > S_['long_top'] + 0.5]
                add('long sounds sit lower', not long_, '; '.join(long_) or 'ok',
                    f"held over {S_['long_s']} s near the top → top at most {S_['long_top']:.0f} LUFS",
                    'A long swell at full level is what makes a calm video feel loud: lower it 3 dB or shorten it (sound_mix.py does it).')
            if narrated:
                lost = [f"{r['effect']} at {r['from']:.2f} s (top {r['top_lufs']} LUFS, bed {bed_l:.1f})" for r in rows if r['top_lufs'] < bed_l + 4]
                add('every effect heard over the bed', not lost, '; '.join(lost) or 'ok', 'top at least 4 dB over the bed',
                    'This effect is under the bed\'s level, so on a phone nobody hears it: raise it, or drop it.', 'warn')
            else:
                quiet = [f"{r['effect']} at {r['from']:.2f} s (top {r['top_lufs']})" for r in rows if r['top_lufs'] < S_['heard_min']]
                add('every effect heard', not quiet, '; '.join(quiet) or 'ok', f"top at least {S_['heard_min']:.0f} LUFS",
                    'Too quiet to be heard on a phone: raise it (gain_db toward 0) or drop it.', 'warn')
    res['passed'] = all(c['status'] != 'fail' for c in res['checks'])
    if not quiet:
        report(res)
    return res


def report(res):
    M = res['measured']
    print(f"Sound check · {res['file']} · {res['seconds']} s")
    print(f"  loudness {M['integrated_lufs']} LUFS · true peak {M['true_peak_dbtp']} dBTP · LRA {M['lra']} LU ({M['meter']})")
    print(f"  loudest 400 ms {M['momentary_max_lufs']} LUFS · 2-6 kHz {M['harsh_momentary_max_lufs']} LUFS · "
          f"phone speaker {M['phone_momentary_max_lufs']} LUFS ({M['phone_loudest_over_floor_db']} dB over its bed) · "
          f"loudest over the bed {M['loudest_over_floor_db']} dB")
    print(f"  digital silence {M['digital_silence_pct']}% · near-silence {M['near_silence_pct']}% · bed present {M['bed_presence_pct']}% "
          f"(longest gap {M['longest_gap_s']} s) · floor {M['floor_lufs']} LUFS ({M['floor_under_program_db']} dB under)")
    est = (f"estimated from the sound: {M['effects_estimated']}" if M['effects_estimated'] is not None
           else 'not estimated from the sound: it would count the voice')
    print(f"  effects {M.get('effects_in_plan', M['effects_estimated'])} ({M['effects_counted_from']}; {est}) · "
          f"at most {M['effects_max_in_10s']} in any 10 s · below 100 Hz {M['energy_below_100hz_pct']}%")
    print(f"  static floor: {M.get('static_windows', '-')} windows static" + (f" (loudest {M['static_floor_worst']['floor_lufs']} LUFS)"
          if M.get('static_floor_worst') else ''))
    for c in res['checks']:
        mark = {'pass': 'ok  ', 'warn': 'WARN', 'fail': 'FAIL', 'info': 'info'}[c['status']]
        print(f"  {mark} {c['check']}: {c['value']} (target {c['target']})")
        if c.get('fix'):
            print(f"       → {c['fix']}")
    print('PASSED: the numbers hold (nobody has listened yet).' if res['passed'] else
          'FAILED: fix every FAIL line above, mix again and check again before you show the video.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file', help='the mix (WAV) or the finished video')
    ap.add_argument('--plan', help='plan/sound.json used by sound_mix.py (exact effects, scripture, voice, music)')
    ap.add_argument('--json', help='also write the measurements here')
    ap.add_argument('--voice', action='store_true', help='the video has a voice (only needed without --plan)')
    a = ap.parse_args()
    plan = None
    if a.plan:
        plan = load_plan(a.plan)
        plan['_name'] = pathlib.Path(a.plan).name
        rep = pathlib.Path(a.plan).with_name(pathlib.Path(a.plan).stem + '.mixed.json')
        if rep.is_file():  # written by sound_mix.py: the real sounding spans of every effect, and the stems
            m = json.loads(rep.read_text(encoding='utf-8'))
            plan['_spans'] = [tuple(s) for s in m.get('spans', [])]
            plan['_stems'] = {k: str(pathlib.Path(a.plan).parent / v) for k, v in m.get('stems', {}).items()}
            plan['_music_cleared'] = m.get('music_cleared', False)
    try:
        res = check(a.file, plan, voice=a.voice)
    except MemoryError:
        raise SystemExit('check_mix: the PC is short of memory right now (another render?). Run it again when that ends.')
    if a.json:
        pathlib.Path(a.json).write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str), encoding='utf-8')
    sys.exit(0 if res['passed'] else 1)


if __name__ == '__main__':
    main()
