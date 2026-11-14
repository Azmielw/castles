#!/usr/bin/env python3
"""The pace check (new in 1.7.0, 2026-11-12): measures a finished video against the pace and motion standard
(reference/pace.md, P1-P13) and prints every number against its limit.

  python "<skill>/scripts/check_pace.py" "renders/final/video v1.mp4" --plan plan/sound.json
  python "<skill>/scripts/check_pace.py" final.mp4 --voice-file assets/vo/vo.wav --at 0.02     # narrated, no plan
  python "<skill>/scripts/check_pace.py" final.mp4                                            # effects only

Exit code 0 = no FAIL line, 1 = a FAIL line. A WARN line may stand if the video's notes (TASTE.md) say why: a verified
card held still while a quote is read, a dark scene the probe cannot see. A pale page is no reason. P4 and P5 FAIL on a
gross miss (since 11-12): a mean gap between 12% changes over 9 s or a gap over 16 s; no 30% change at all over a judged
stretch longer than 10 s, or a gap over 16 s. Tools measure, they don't watch: a pass means the numbers hold, not that
the video holds attention. Say so to the user.

How it measures (the same probe the six «مسار خام» samples were measured with on 2026-11-12):
- Picture: the video decoded at 10 fps, 216x384 grey (FFmpeg, 2 threads). Screen in motion = the share of pixels that
  change by more than 8 grey levels in 0.1 s, averaged. A picture change = at least 12% (or 30%) of the screen changes
  by more than 25 levels within 0.5 s, or whose colour (Cb/Cr) moves by more than 12 (a pale tinted section the grey
  misses; added as its own change, never merged into one); changes closer than 0.6 s count once. A dead second = a second in which under 1%
  of the screen moves on average (a slow colour drift counts as dead). Still = under 0.3% moving.
- Voice: from the voice alone (the voice stem sound_mix.py wrote, found through --plan, or --voice-file). True silence =
  the 250-3800 Hz band and the full band both 30 dB under the voice's median, for 0.25 s or more; the band measure =
  the 250-3800 Hz band 15 dB under it (it also counts a word's last consonant and a breath, so it reads higher). Word
  times from the take's .words.json (beside the voice file, or --words), shifted by the voice's start in the video.
- Camera (only if OpenCV is installed; information, never judged): tracked features fitted frame to frame 0.5 s apart.
  It misses parallax, slow pushes and flat art: report the composition's own camera timeline next to it.
"""
import argparse, json, math, pathlib, subprocess, sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # works under python -I
import numpy as np
from khaam_sound import ffmpeg_bin

FPS, W, H = 10, 216, 384
LIMITS = dict(
    first_word_s=0.1,        # P1 narrated: the first word by 0.1 s
    first_motion_s=0.3,      # P1 effects only: the first visible motion by 0.3 s
    wps_lo=1.9, wps_hi=2.4,  # P2: words per second over the spoken span (2.4: the owner liked 2.35 and 2.38, 11-12)
    silence_max=10.0,        # P3: true silence inside the speech, % of the spoken span
    band_silence_warn=18.0,  # P3: the 15 dB band measure (word tails count), % — a warning only
    gap_max=0.35,            # P3: every gap but the held beat(s)
    held_lo=0.5, held_hi=0.8,  # P3: one held beat per 30 s
    change12_mean=4.5, change12_max=8.0,  # P4
    change30_max=8.0,        # P5
    gross=2.0,               # P4/P5: a gap more than twice its limit is a gross miss, a FAIL (11-12 close-loop)
    none_fail_s=10.0,        # P5: no 30% change at all over a judged stretch longer than this is a FAIL
    chroma=12.0,             # a pixel whose colour (Cb/Cr, full range) moves more than this also counts as changed
    pale_page=200.0,         # a median grey above this is a pale page (paper): the reasons list says it is no excuse
    motion_min=4.0,          # P6: % of the screen moving, on average (aim 5-8)
    dead_narrated=25.0, dead_run_narrated=4,  # P7 narrated: % of seconds, longest run (s)
    dead_fx=10.0, dead_run_fx=2,              # P7 effects only
    end_still_max=2.5,       # P7: the end hold
    cam_lo=30.0, cam_hi=45.0,  # P8 (information)
)


def frames(src):
    ff = ffmpeg_bin() or 'ffmpeg'
    cmd = [ff, '-v', 'error', '-threads', '2', '-i', str(src), '-vf', f'fps={FPS},scale={W}:{H}:flags=area',
           '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = W * H
    out = []
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        out.append(np.frombuffer(b, np.uint8).reshape(H, W))
    p.wait()
    return out


def chroma_frames(src):
    """The colour of each frame (Cb, Cr at full range), half the probe's size: a pale tinted section sliding in over a
    pale page changes the colour more than the grey, and the eye sees it. Empty if FFmpeg cannot give it."""
    ff = ffmpeg_bin() or 'ffmpeg'
    w, h = W // 2, H // 2
    cmd = [ff, '-v', 'error', '-threads', '2', '-i', str(src), '-vf',
           f'fps={FPS},scale={w}:{h}:flags=area:out_range=full,format=yuvj444p', '-f', 'rawvideo', '-pix_fmt', 'yuvj444p', '-']
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except OSError:
        return []
    n = w * h * 3
    out = []
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        out.append(np.frombuffer(b, np.uint8).reshape(3, h, w)[1:].astype(np.int16))
    p.wait()
    return out


def runs(mask, t):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]:
                j += 1
            out.append((float(t[i]), float(t[j - 1])))
            i = j
        else:
            i += 1
    return out


def events(mask, t, merge=0.6):
    m = []
    for a, b in runs(mask, t):
        if m and a - m[-1][1] < merge:
            m[-1] = (m[-1][0], b)
        else:
            m.append((a, b))
    return m


def change_gaps(ev, dur, zones):
    """Gaps between picture changes. A quoted-text zone (a verified card held whole and still while it is read) is not
    judged: its edges count as changes and a gap inside it is left out."""
    marks = sorted([0.0] + [e[0] for e in ev] + [dur] + [z for ab in zones for z in ab])
    gaps = []
    for a, b in zip(marks[:-1], marks[1:]):
        if any(za - 1e-6 <= a and b <= zb + 1e-6 for za, zb in zones):
            continue
        gaps.append((round(b - a, 2), round(a, 1)))
    return gaps


def picture(src, zones):
    F = frames(src)
    if len(F) < 10:
        raise SystemExit(f'check_pace: could not read the picture of {src} (FFmpeg needed; is it a video?).')
    N = len(F); dur = N / FPS
    t = np.arange(N) / FPS
    chg = np.zeros(N); big5 = np.zeros(N)
    chg[0] = 1.0
    for i in range(1, N):
        d = np.abs(F[i].astype(np.int16) - F[i - 1].astype(np.int16))
        chg[i] = float((d > 8).mean())
        if i >= 5:
            big5[i] = float((np.abs(F[i].astype(np.int16) - F[i - 5].astype(np.int16)) > 25).mean())
    R = {'seconds': round(dur, 2), 'motion_pct': round(float(chg[1:].mean()) * 100, 2)}
    C = chroma_frames(src)
    col5 = np.zeros(N)
    for i in range(5, min(N, len(C))):
        d = C[i] - C[i - 5]
        col5[i] = float((np.hypot(d[0], d[1]) > LIMITS['chroma']).mean())
    R['colour_measured'] = bool(C)
    R['paper_grey'] = round(float(np.median([np.median(f) for f in F[::5]])), 1)
    R['pale_page'] = R['paper_grey'] > LIMITS['pale_page']
    for thr in (0.30, 0.12):
        ev = events(big5 >= thr, t)
        # a change the grey misses but the colour shows (a pale tinted section): added, never merged into a grey one
        extra = [e for e in events(col5 >= thr, t) if not any(a - 0.6 <= e[0] <= b + 0.6 for a, b in ev)]
        ev = sorted(ev + extra)
        g = change_gaps(ev, dur, zones)
        outside = [e for e in ev if not any(za - 1e-6 <= e[0] <= zb + 1e-6 for za, zb in zones)]
        R[f'changes{int(thr * 100)}'] = {'n': len(ev), 'by_colour_only': len(extra), 'outside_quotes': len(outside),
                                          'at': [round(e[0], 1) for e in ev],
                                          'gap_mean': round(float(np.mean([x for x, _ in g])), 1) if g else None,
                                          'gap_max': max(g)[0] if g else None, 'gap_max_from': max(g)[1] if g else None}
    # what a lower grey threshold would add on a pale page: faint changes (cards or a grid a few levels off the paper)
    faint = np.zeros(N)
    for i in range(5, N):
        faint[i] = float((np.abs(F[i].astype(np.int16) - F[i - 5].astype(np.int16)) > 15).mean())
    R['faint_changes12'] = len(events(faint >= 0.12, t))
    secs = np.array([chg[int(s * FPS) + (1 if s == 0 else 0):int(s * FPS) + FPS].mean() for s in range(int(dur))])
    dead = secs < 0.01
    best, cur, start, bs = 0, 0, 0, 0
    for i, v in enumerate(dead):
        if v:
            if cur == 0:
                start = i
            cur += 1
            if cur > best:
                best, bs = cur, start
        else:
            cur = 0
    R['dead_seconds'] = int(dead.sum()); R['dead_pct'] = round(float(dead.mean()) * 100, 1) if len(dead) else 0.0
    R['dead_longest'] = [bs, bs + best]
    still = chg < 0.003; still[0] = False
    end = 0
    for v in still[::-1]:
        if not v:
            break
        end += 1
    R['end_still_s'] = round(end / FPS, 1)
    moving = np.nonzero(chg[1:] >= 0.003)[0]
    R['first_motion_s'] = round(float((moving[0] + 1) / FPS), 1) if len(moving) else None
    R['per_second_motion_pct'] = [round(float(x) * 100, 2) for x in secs]
    R['camera'] = camera_share(F, dur)
    return R


def camera_share(F, dur):
    try:
        import cv2
    except Exception:
        return {'measured': False, 'why': 'OpenCV is not installed (pip install opencv-python-headless to measure it); '
                                          'report the composition\'s own camera timeline instead'}
    SCALE = 1080 / W
    vis = []
    for i in range(len(F)):
        if i < 5:
            vis.append(False); continue
        a, b = F[i - 5], F[i]
        pts = cv2.goodFeaturesToTrack(a, 300, 0.01, 5)
        ok = False
        if pts is not None and len(pts) >= 15:
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, winSize=(21, 21), maxLevel=3)
            g = st.ravel() == 1
            p0, p1 = pts[g].reshape(-1, 2), nxt[g].reshape(-1, 2)
            if len(p0) >= 15:
                M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=1.0)
                if M is not None and float(inl.mean()) >= 0.6:
                    s = math.hypot(M[0, 0], M[1, 0]); c = np.array([W / 2, H / 2, 1.0]); tt = M @ c - c[:2]
                    ok = abs((s - 1) * 2) >= 0.004 or math.hypot(*tt) * SCALE * 2 >= 12
        vis.append(ok)
    t = np.arange(len(F)) / FPS
    total = sum(b - a + 0.1 for a, b in runs(np.array(vis), t) if b - a + 0.1 >= 0.5)
    return {'measured': True, 'share_pct': round(total / dur * 100, 1),
            'note': 'the probe misses parallax, slow pushes and flat art: read the composition\'s camera timeline too'}


def voice_audio(path, at, n_total=None):
    ff = ffmpeg_bin() or 'ffmpeg'
    raw = subprocess.run([ff, '-v', 'error', '-threads', '1', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                         capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    if at > 0:
        x = np.concatenate([np.zeros(int(at * 16000), np.float32), x])
    return x


def voice_measure(x, span=None):
    SR, hop, win = 16000, 320, 640
    n = len(x) // hop
    wv = np.hanning(win).astype(np.float32)
    fr = np.fft.rfftfreq(win, 1 / SR); band = (fr >= 250) & (fr <= 3800)
    lev = np.full(n, -120.0); full = np.full(n, -120.0)
    for i in range(n):
        seg = x[i * hop:i * hop + win]
        if len(seg) < win:
            break
        S = np.abs(np.fft.rfft(seg * wv)) ** 2
        lev[i] = 10 * np.log10(S[band].sum() + 1e-12)
        full[i] = 10 * np.log10((seg ** 2).mean() + 1e-12)
    t = np.arange(n) * hop / SR
    ref = float(np.median(lev[lev > np.percentile(lev, 40)]))
    fref = float(np.median(full[full > np.percentile(full, 40)]))
    if span is None:
        on = np.nonzero(lev > ref - 15)[0]
        span = (float(t[on[0]]), float(t[on[-1]] + hop / SR)) if len(on) else (0.0, float(t[-1]))
    a, b = span

    def pauses(mask):
        res, start = [], None
        for i in range(n):
            q = mask[i] and a <= t[i] <= b
            if q and start is None:
                start = i
            if (not q or i == n - 1) and start is not None:
                d = (i - start) * hop / SR
                if d >= 0.25:
                    res.append((round(float(t[start]), 2), round(d, 2)))
                start = None
        return res
    true_p = pauses((lev < ref - 30) & (full < fref - 30))
    band_p = pauses(lev < ref - 15)
    L = max(b - a, 1e-6)
    return {'span': [round(a, 2), round(b, 2)], 'true_pauses': true_p, 'band_pauses': band_p,
            'true_pct': round(sum(d for _, d in true_p) / L * 100, 1), 'band_pct': round(sum(d for _, d in band_p) / L * 100, 1),
            'first_voice_s': round(float(t[np.argmax(lev > ref - 10)]), 2)}


def load_words(path, at):
    d = json.loads(pathlib.Path(path).read_text(encoding='utf-8-sig'))
    ws = d['words'] if isinstance(d, dict) else d
    out = []
    for w in ws:
        txt = str(w.get('word', w.get('w', ''))).strip()
        if txt and any(ch.isalnum() for ch in txt):   # a quote pasted from a web page can leave tokens with no letter
            # (a quote mark between direction marks): they are not spoken words (wisdom dry run, 11-12)
            out.append((txt, float(w.get('start', w.get('s', 0))) + at, float(w.get('end', w.get('e', 0))) + at))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video')
    ap.add_argument('--plan', help='plan/sound.json used by sound_mix.py (the voice, its start, the quoted-text zones)')
    ap.add_argument('--voice-file', help='the narration take as placed (when there is no plan)')
    ap.add_argument('--at', type=float, default=0.0, help='where the voice starts in the video (s), with --voice-file')
    ap.add_argument('--words', help='the take\'s .words.json (default: beside the voice file)')
    ap.add_argument('--quote', action='append', default=[], help='a quoted-text span FROM-TO in seconds (also read from the plan)')
    ap.add_argument('--json', help='also write every measurement here')
    a = ap.parse_args()
    L = LIMITS
    zones = [tuple(float(v) for v in q.split('-')) for q in a.quote]
    vfile, at, words = None, a.at, None
    if a.plan:
        pp = pathlib.Path(a.plan); plan = json.loads(pp.read_text(encoding='utf-8-sig'))
        root = pp.parent.parent if pp.parent.name == 'plan' else pp.parent
        zones += [(float(z['from']), float(z['to'])) for z in plan.get('scripture', [])]
        if plan.get('voice'):
            vfile = root / plan['voice']['file']
            if not vfile.is_file():
                vfile = pp.parent / plan['voice']['file']
            at = float(plan['voice'].get('at', 0))
    if a.voice_file:
        vfile = pathlib.Path(a.voice_file)
    if vfile is not None and not vfile.is_file():
        raise SystemExit(f'check_pace: the voice file is missing: {vfile}. Give the take as placed (--voice-file, --at), '
                         'or run it from the video folder the plan belongs to.')
    narrated = vfile is not None
    if narrated:
        wp = pathlib.Path(a.words) if a.words else vfile.with_name(vfile.stem + '.words.json')
        words = load_words(wp, at) if wp.is_file() else None
    try:
        P = picture(a.video, zones)
    except MemoryError:
        raise SystemExit('check_pace: the PC is short of memory right now (another render?). Run it again when that ends.')
    rows, M = [], {'picture': P}

    def add(code, name, ok, value, limit, fix='', level='fail'):
        rows.append({'p': code, 'check': name, 'status': 'pass' if ok else level, 'value': value, 'limit': limit,
                     **({'fix': fix} if not ok and fix else {})})

    if narrated:
        span = (words[0][1], words[-1][2]) if words else None
        V = voice_measure(voice_audio(vfile, at), span)
        M['voice'] = V
        first = words[0][1] if words else V['first_voice_s']
        add('P1', 'first word', first <= L['first_word_s'], f'{first:.2f} s' + ('' if words else ' (from the sound; no .words.json)'),
            f"by {L['first_word_s']} s", 'Start the voice on the first frame: trim the take\'s head silence, or set the voice\'s "at" to 0.')
        if words:
            sp = words[-1][2] - words[0][1]; wps = len(words) / sp
            M['voice'].update(words=len(words), words_per_s=round(wps, 2))
            add('P2', 'speech rate', L['wps_lo'] <= wps <= L['wps_hi'], f'{wps:.2f} words/s ({len(words)} words over {sp:.1f} s)',
                f"{L['wps_lo']}-{L['wps_hi']} words/s",
                'Slow: cut the silence between words (voice_edit.py tighten), never time-stretch.' if wps < L['wps_lo'] else
                'Fast: keep a held beat and the sentence-end floor (tighten --hold, --keep), or a calmer take; never time-stretch.')
        else:
            add('P2', 'speech rate', False, 'not measured: no .words.json for the take', f"{L['wps_lo']}-{L['wps_hi']} words/s",
                'Give --words (the take\'s .words.json) to measure it.', 'warn')
        add('P3', 'true silence inside the speech', V['true_pct'] <= L['silence_max'],
            f"{V['true_pct']}% of the spoken span ({len(V['true_pauses'])} pauses of 0.25 s or more)", f"at most {L['silence_max']:.0f}%",
            'Cut the silence (voice_edit.py tighten): gaps 0.12-0.35 s, one held beat 0.5-0.8 s per 30 s; never stretch.')
        add('P3', 'band measure (word tails count as pause)', V['band_pct'] <= L['band_silence_warn'], f"{V['band_pct']}%",
            f"at most {L['band_silence_warn']:.0f}% (information beside the true silence)",
            'Long word tails or breaths between words: a steadier take, or tighten with --keep 0.15.', 'warn')
        held = [d for _, d in V['true_pauses'] if d > L['gap_max']]
        allowed = max(1, round((V['span'][1] - V['span'][0]) / 30))
        bad = [d for d in held if d > L['held_hi']]
        add('P3', 'gaps', len(held) <= allowed and not bad,
            f"{len(held)} over {L['gap_max']} s" + (f" (longest {max(held):.2f} s)" if held else ''),
            f"every gap {L['gap_max']} s or less except {allowed} held beat(s) of {L['held_lo']}-{L['held_hi']} s",
            'Tighten the extra pauses (voice_edit.py tighten --hold WORD=0.6 for the one held beat).', 'warn')
    else:
        fm = P['first_motion_s']
        add('P1', 'first visible motion', fm is not None and fm <= L['first_motion_s'], f'{fm} s', f"by {L['first_motion_s']} s",
            'Open on motion: something moves from the first frames (a camera move, a hand, light).')
    c12, c30 = P['changes12'], P['changes30']
    zone_note = f" (quoted-text zone(s) {', '.join(f'{x:.1f}-{y:.1f}' for x, y in zones)} not judged)" if zones else ''
    col = lambda c: f", {c['by_colour_only']} seen by colour alone" if c['by_colour_only'] else ''
    pale = P['pale_page']
    # 11-12 (close-loop): a near miss stays a WARN with its reason; a gross miss is a FAIL that names the fix.
    why_ok = ('A near miss may stand only with its reason in TASTE.md: a verified card held still while a quote is read '
              '(give its span to the check: "scripture" in the plan, or --quote), a dark scene whose real changes stay '
              'under 25 grey levels (say which seconds; look at the contact sheet), or one gap a fraction of a second over. '
              'A pale page is no reason: cards a few levels off the paper are no change to the eye either.')
    fix_pic = 'A new place, a cut, a reframing move or a big object arriving every sentence or two (scene-kit.md, the camera).'
    if pale:
        fix_pic += (' On a pale page: a section on tinted paper sliding in (light blue, kraft), a big drawing (a third of the '
                    'frame or more), a push-in on the number, or a cut to a fresh line; a scroll down the same page is no change.')
    gm, gx = c12['gap_mean'], c12['gap_max']
    p4_ok = gm is not None and gm <= L['change12_mean'] and gx <= L['change12_max']
    p4_gross = gm is not None and (gm > L['change12_mean'] * L['gross'] or gx > L['change12_max'] * L['gross'])
    add('P4', 'picture changes of 12% or more', p4_ok,
        f"{c12['n']} changes{col(c12)}, mean gap {gm} s, longest {gx} s (from {c12['gap_max_from']} s){zone_note}",
        f"mean gap at most {L['change12_mean']} s, none over {L['change12_max']:.0f} s; FAIL past a mean of "
        f"{L['change12_mean'] * L['gross']:.0f} s or a gap of {L['change12_max'] * L['gross']:.0f} s",
        fix_pic + (' A gross miss: the picture stands still for the viewer. Fix it before anyone sees the video.' if p4_gross
                   else ' ' + why_ok), 'fail' if p4_gross else 'warn')
    g5 = c30['gap_max']
    p5_ok = g5 is not None and g5 <= L['change30_max']
    p5_none = c30['outside_quotes'] == 0 and g5 is not None and g5 > L['none_fail_s']
    p5_gross = g5 is not None and (g5 > L['change30_max'] * L['gross'] or p5_none)
    add('P5', 'big changes of 30% or more', p5_ok,
        f"{c30['n']} changes{col(c30)}, longest gap {g5} s (from {c30['gap_max_from']} s)",
        f"at least every {L['change30_max']:.0f} s; FAIL with none at all over {L['none_fail_s']:.0f} s, or a gap over "
        f"{L['change30_max'] * L['gross']:.0f} s",
        'A big change (a new place, a whip, a light change, a new section) at least every 8 s.' +
        (' On a pale page: a new section on tinted paper, or a cut.' if pale else '') +
        (' A gross miss: nothing big changes for the viewer. Fix it before anyone sees the video.' if p5_gross else ' ' + why_ok),
        'fail' if p5_gross else 'warn')
    if pale and not (p4_ok and p5_ok):
        rows.append({'p': 'P4-P5', 'check': 'pale page', 'status': 'info',
                     'value': f"the paper is pale (median grey {P['paper_grey']}); {P['faint_changes12']} faint change(s) of "
                              f"15-25 grey levels are not counted",
                     'limit': 'faint changes are no change to the eye either: tint the sections or draw big; never a reason for a WARN'})
    add('P6', 'screen in motion', P['motion_pct'] >= L['motion_min'], f"{P['motion_pct']}% on average",
        f"at least {L['motion_min']:.0f}% (aim 5-8)", 'The picture stands still: keep the camera moving (a push of 2.5-4%/s, '
        'a track with parallax), let the world behind a card breathe, give the figure an action in every scene.')
    dl, rl = (L['dead_narrated'], L['dead_run_narrated']) if narrated else (L['dead_fx'], L['dead_run_fx'])
    longest = P['dead_longest'][1] - P['dead_longest'][0]
    add('P7', 'dead seconds', P['dead_pct'] <= dl and longest <= rl,
        f"{P['dead_seconds']} of {int(P['seconds'])} s ({P['dead_pct']}%), longest run {longest} s ({P['dead_longest'][0]}-{P['dead_longest'][1]})",
        f"at most {dl:.0f}%, no run over {rl} s" + ('' if narrated else ' (no voice: stricter)'),
        'A second where under 1% of the screen moves is dead: add a slow push, a sway, drifting light or a figure\'s action there.')
    add('P7', 'end hold', P['end_still_s'] <= L['end_still_max'], f"{P['end_still_s']} s fully still at the end",
        f"at most {L['end_still_max']} s, and breathing", 'Keep the last seconds breathing (light, a sway, a slow push).', 'warn')
    cam = P['camera']
    rows.append({'p': 'P8', 'check': 'camera (probe)', 'status': 'info',
                 'value': f"{cam['share_pct']}% of the time" if cam.get('measured') else 'not measured',
                 'limit': f"{L['cam_lo']:.0f}-{L['cam_hi']:.0f}% by the composition's camera timeline; " + cam.get('note', cam.get('why', ''))})
    rows.append({'p': 'P9-P12', 'check': 'look at the frames', 'status': 'info', 'value': 'not measured',
                 'limit': 'a new place or framing every sentence or two; the sentence on screen with each word lit, a new one '
                          'within 4 s; the figure ~430 px and acting, seated upright, no igal; a plate under text over motion'})
    passed = all(r['status'] != 'fail' for r in rows)
    print(f"Pace check · {pathlib.Path(a.video).name} · {P['seconds']} s · {'narrated' if narrated else 'effects only'}")
    for r in rows:
        mark = {'pass': 'ok  ', 'warn': 'WARN', 'fail': 'FAIL', 'info': 'info'}[r['status']]
        print(f"  {mark} {r['p']} {r['check']}: {r['value']} (limit {r['limit']})")
        if r.get('fix'):
            print(f"       → {r['fix']}")
    print('PASSED: the numbers hold (nobody has watched yet). Write them in TASTE.md; a WARN line needs its reason there.'
          if passed else 'FAILED: fix every FAIL line above, render a draft and check again.')
    if a.json:
        pathlib.Path(a.json).write_text(json.dumps({'passed': passed, 'checks': rows, 'measured': M}, ensure_ascii=False, indent=1),
                                        encoding='utf-8')
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
