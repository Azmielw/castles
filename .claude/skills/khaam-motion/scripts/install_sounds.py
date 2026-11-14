#!/usr/bin/env python3
"""Khaam sound library installer for the Khaam Motion skill (khaam-motion 1.5; the same script the 1.4 sound add-on carried):
a local SFX library from open sources, kept outside the skill folder. By Khaam (@khaam.hq), 2026-11-04.

    python install_sounds.py all              # setup + earshot + uisfx + catalog (5-10 minutes, ~530 MB)
    python install_sounds.py setup|earshot|uisfx|catalog
    options: --root <library>  (default ~/.cache/khaam-motion/sfx)
             --venv <dir>      (default ~/.cache/khaam-motion/earshot-venv)

Sources (checked 2026-11-04):
  Earshot 0.4.0, code MIT, https://github.com/Leonxlnx/earshot : 252 sounds written as code, rendered here (your own files)
  uisfx 0.4.0, sounds CC0-1.0, https://github.com/romainsimon/uisfx : 936 UI sounds (12 packs x 78 cues)
Each download must match the hash below before it is used. No API key, no account, and no audio leaves this computer.
"""
import argparse, base64, hashlib, json, os, pathlib, subprocess, sys, tarfile, urllib.request, venv

EARSHOT_URL = 'https://github.com/Leonxlnx/earshot/archive/refs/tags/v0.4.0.zip'
EARSHOT_SHA256 = 'bcb873294ea8c17cf3986da1c9e01d5a5c6bbc7bd66acb1dc071046960aeea8a'
UISFX_URL = 'https://registry.npmjs.org/uisfx/-/uisfx-0.4.0.tgz'
UISFX_SHA512 = 'W891N75C09cvpaNeChP+7BiP0Yp5VSbrIcRgZvzpFUT3o/2DxZqROmUcX50oxeyMnY4Hqxu4jEfjndVUpmheEQ=='
BASE = pathlib.Path.home() / '.cache' / 'khaam-motion'

# Earshot bank category -> folder named by role, so a sound is easy to find by its job
FOLDER = {
    'click': 'click', 'pro_click': 'click', 'tap': 'click tap', 'pro_tap': 'click tap', 'toggle': 'click toggle',
    'hover_tick': 'click tick', 'pro_hover_tick': 'click tick',
    'cut_hit': 'impact cut hit', 'impact': 'impact', 'pro_impact': 'impact', 'knock': 'impact knock thud',
    'downlifter': 'whoosh downlifter fall', 'drip': 'water drip', 'glitch': 'glitch', 'pro_glitch': 'glitch',
    'logo_sting': 'chime logo sting', 'pro_logo_sting': 'chime logo sting', 'mallet': 'chime mallet',
    'notify': 'chime notification', 'pro_notify': 'chime notification ding', 'pluck': 'chime pluck kalimba',
    'shimmer': 'chime shimmer sparkle', 'pro_shimmer': 'chime shimmer sparkle',
    'pop': 'pop', 'pro_pop': 'pop', 'ui_pop': 'pop ui', 'pro_pop_in': 'pop in',
    'riser': 'riser', 'pro_riser': 'riser', 'reverse_swell': 'riser reverse swell',
    'shutter': 'camera shutter', 'sub_drop': 'sub drop', 'pro_sub_drop': 'sub drop',
    'swipe': 'whoosh swipe', 'swish': 'whoosh swish', 'whoosh_big': 'whoosh big', 'pro_whoosh_big': 'whoosh big',
    'whoosh_fast': 'whoosh fast', 'pro_zip': 'whoosh zip',
    'typing_key': 'typing key', 'pro_typing_key': 'typing key', 'pro_typing_run': 'typing run',
}
FIT = {'bell': 'chime bell', 'click': 'click', 'hit': 'impact', 'key.space': 'typing key', 'key': 'typing key',
       'land.light': 'click tap', 'pop': 'pop', 'snap': 'click', 'tick': 'click tick', 'whoosh.short': 'whoosh fast'}


def fetch(url, dest, ok):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.is_file():
        print('download', url)
        try:
            urllib.request.urlretrieve(url, dest)
        except Exception as e:  # e.g. missing SSL certificates on macOS: curl has its own
            print('urllib failed (%s), trying curl' % e)
            subprocess.run(['curl', '-fsSL', '-o', str(dest), url], check=True)
    if not ok(dest.read_bytes()):
        dest.unlink()
        sys.exit('STOP: %s does not match its published hash. Nothing was installed from it.' % dest.name)
    return dest


def venv_python(v):
    return v / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def setup(a):
    z = fetch(EARSHOT_URL, a.root / '_downloads' / 'earshot-0.4.0.zip',
              lambda d: hashlib.sha256(d).hexdigest() == EARSHOT_SHA256)
    py = venv_python(a.venv)
    if not py.is_file():
        print('create venv', a.venv)
        venv.create(a.venv, with_pip=True)
    pip = [str(py), '-m', 'pip', 'install', '-q', '--disable-pip-version-check']
    # light install: the sound bank only; no torch, no AI models
    subprocess.run(pip + ['numpy', 'scipy', 'soundfile'], check=True)
    if subprocess.run(pip + ['numba']).returncode:  # optional: renders ~10x faster
        print('numba not available here: rendering still works, just slower (about 20 minutes)')
    subprocess.run(pip + ['--no-deps', str(z)], check=True)
    print('earshot ready:', py)


def earshot(a):
    try:
        import soundfile as sf
        from earshot.forge import bank
    except ImportError:  # not inside the venv: run this step with the venv's Python
        py = venv_python(a.venv)
        if not py.is_file():
            sys.exit('run the "setup" step first')
        sys.exit(subprocess.run([str(py), '-I', os.path.abspath(__file__), 'earshot',
                                 '--root', str(a.root), '--venv', str(a.venv)]).returncode)
    out = a.root / 'earshot'
    audit, n = {}, 0
    for sid in bank.ids():
        cat, member = sid.split('/', 1)
        if cat == 'fit':
            sub, member = member.split('/', 1)
            folder = FIT.get(sub, 'other')
        else:
            folder = FOLDER.get(cat, 'other')
        d = out / folder
        d.mkdir(parents=True, exist_ok=True)
        seed0 = int(bank.get(sid).get('seed', 0))
        for k, seed in enumerate((None, seed0 + 101), 1):  # take 01 = the delivered sound, take 02 = a variation
            try:
                y, meta = bank.render(sid, seed=seed)
            except Exception as e:
                audit['%s#%d' % (sid, k)] = 'error: %s' % e
                continue
            c = meta.get('checks') or {'ok': True}
            if not c['ok']:  # Earshot's own audit: clicks, cut tails, clipping, ring
                audit['%s#%d' % (sid, k)] = [w['msg'] for w in c.get('warnings', [])]
                continue
            name = ('%s %s %s %02d' % (folder, cat, member, k)).replace('/', ' ').replace('.', ' ')
            sf.write(d / (name + '.wav'), y, 48000, subtype='PCM_24')
            n += 1
            if n % 100 == 0:
                print('%d takes rendered...' % n, flush=True)
    (out / 'audit.json').write_text(json.dumps(audit, indent=1), encoding='utf-8')
    print('%d earshot takes in %s (skipped by its audit: %d)' % (n, out, len(audit)))


def uisfx(a):
    t = fetch(UISFX_URL, a.root / '_downloads' / 'uisfx-0.4.0.tgz',
              lambda d: base64.b64encode(hashlib.sha512(d).digest()).decode() == UISFX_SHA512)
    out = a.root / 'uisfx'
    keep = {'package/LICENSE', 'package/LICENSE-AUDIO', 'package/manifest.json', 'package/README.md'}
    n = 0
    with tarfile.open(t, 'r:gz') as tf:
        for m in tf.getmembers():
            p = pathlib.PurePosixPath(m.name)
            if not m.isfile() or '..' in p.parts or p.is_absolute():
                continue
            if not (m.name.startswith('package/sounds/') and p.suffix == '.mp3') and m.name not in keep:
                continue
            dest = out.joinpath(*p.parts[1:])
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(tf.extractfile(m).read())
            n += 1
    print('%d uisfx files in %s' % (n, out))


def catalog(a):
    """catalog.json in the skill's own format (reference/sfx-catalog-format.md), checked by scripts/verify_sfx.py"""
    man = a.root / 'uisfx' / 'manifest.json'
    cues = {}
    if man.is_file():
        cues = {c['name']: c.get('description', '') for c in json.loads(man.read_text(encoding='utf-8'))['cues']}
    src = {
        'earshot': ('https://github.com/Leonxlnx/earshot', 'Earshot 0.4.0 sound bank, rendered on this computer',
                    'own render (Earshot code: MIT)', 'synthesized in code, 48 kHz 24-bit WAV'),
        'uisfx': ('https://github.com/romainsimon/uisfx', 'uisfx 0.4.0 (Yuki Capital)', 'CC0-1.0',
                  'MP3 (lossy), from the npm package'),
    }
    rows = []
    for sub, (url, author, lic, quality) in src.items():
        base = a.root / sub
        for f in sorted(base.rglob('*')):
            if f.suffix.lower() not in ('.wav', '.mp3'):
                continue
            rel = f.relative_to(a.root).as_posix()
            h = hashlib.sha256(f.read_bytes()).hexdigest()
            r = {'id': sub + ':' + f.relative_to(base).with_suffix('').as_posix(), 'path': rel, 'original_path': rel,
                 'source_url': url, 'author': author, 'license': lic, 'quality': quality,
                 'review_sha256': h, 'original_sha256': h}
            if sub == 'uisfx':
                r.update(pack=f.parent.name, cue=f.stem, description=cues.get(f.stem, ''))
            else:
                r['role'] = f.parent.name
            rows.append(r)
    (a.root / 'catalog.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')
    (a.root / 'README.md').write_text(
        '# Khaam sound library (built by the Khaam Motion skill: scripts/install_sounds.py)\n\n'
        '| Folder | Source | Licence |\n|---|---|---|\n'
        '| `earshot/` | Earshot 0.4.0 sound bank (https://github.com/Leonxlnx/earshot), rendered on this computer, '
        'folders named by role | your own renders; Earshot code is MIT |\n'
        '| `uisfx/sounds/<pack>/` | uisfx 0.4.0 (https://github.com/romainsimon/uisfx), 12 packs x 78 cues; '
        'cue meanings in `uisfx/manifest.json` | CC0-1.0 (`uisfx/LICENSE-AUDIO`) |\n\n'
        'Every file is listed with its source, licence and SHA-256 in `catalog.json`. '
        'Check it with the skill: `python <skill>/scripts/verify_sfx.py --library <this folder>`.\n',
        encoding='utf-8')
    print('%d sounds in %s' % (len(rows), a.root / 'catalog.json'))


if __name__ == '__main__':
    # show progress as it happens; never crash on a non-English folder name in a Windows console
    sys.stdout.reconfigure(line_buffering=True, errors='backslashreplace')
    sys.stderr.reconfigure(errors='backslashreplace')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('step', choices=['all', 'setup', 'earshot', 'uisfx', 'catalog'])
    ap.add_argument('--root', type=pathlib.Path, default=BASE / 'sfx')
    ap.add_argument('--venv', type=pathlib.Path, default=BASE / 'earshot-venv')
    args = ap.parse_args()
    args.root = args.root.expanduser().resolve()
    args.venv = args.venv.expanduser().resolve()
    steps = ['setup', 'earshot', 'uisfx', 'catalog'] if args.step == 'all' else [args.step]
    for s in steps:
        if s == 'earshot' and args.step == 'all':  # always render inside the venv
            r = subprocess.run([str(venv_python(args.venv)), '-I', os.path.abspath(__file__), 'earshot',
                                '--root', str(args.root), '--venv', str(args.venv)])
            if r.returncode:
                sys.exit(r.returncode)
        else:
            globals()[s](args)
