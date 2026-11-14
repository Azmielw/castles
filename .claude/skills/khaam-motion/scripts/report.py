#!/usr/bin/env python3
"""«بلّغ عن مشكلة»: a short report the user can send to @khaam.hq. Nothing is uploaded.

  python <skill>/scripts/report.py --step "وش كان يصير" [--error "آخر سطر من رسالة الخطأ"]

No keys, tokens or personal paths: the home folder becomes ~ and anything that looks like a key is removed.
Prints the report and saves «بلاغ مشكلة.txt» in the workspace (or the current folder).
"""
import argparse, json, os, pathlib, platform, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I
from khaam_paths import SKILL, CACHE, GLOBAL_SKILL, elevenlabs_key, toolkit_dir, workspace, executable, installed_folder
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

HOME = str(pathlib.Path.home())


def clean(text):
    text = str(text or '').replace(HOME, '~').replace(HOME.replace('\\', '/'), '~')
    text = re.sub(r'(sk_|xi-api-key[:= ]*)[A-Za-z0-9_\-]{8,}', '[مخفي]', text)
    text = re.sub(r'\b[A-Za-z0-9_\-]{32,}\b', '[مخفي]', text)
    return text.strip()[:600]


def version_of(cmd, args):
    if not cmd:
        return 'غير موجود'
    try:
        p = subprocess.run([cmd] + args, capture_output=True, text=True, timeout=15)
        first = (p.stdout or p.stderr).strip().splitlines()
        return clean(first[0]) if first else 'موجود'
    except (OSError, subprocess.TimeoutExpired):
        return 'ما اشتغل'


def os_name():
    if sys.platform.startswith('win'):
        build = platform.version().split('.')[-1]
        return 'Windows %s (%s)' % ('11' if build.isdigit() and int(build) >= 22000 else platform.release(), platform.version())
    if sys.platform == 'darwin':
        return 'macOS %s' % platform.mac_ver()[0]
    return '%s %s' % (platform.system(), platform.release())


def skill_version():
    m = re.search(r'v(\d+\.\d+\.\d+)', (SKILL / 'SKILL.md').read_text(encoding='utf-8'))
    return m.group(1) if m else '?'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--step', default='', help='what the user was doing, in their words')
    ap.add_argument('--error', default='', help='the last line of the error, without any key')
    a = ap.parse_args()
    ws = workspace()
    cat = CACHE / 'sfx' / 'catalog.json'
    try:
        sounds = len(json.loads(cat.read_text(encoding='utf-8'))) if cat.is_file() else 0
    except (OSError, ValueError):
        sounds = 0
    lines = [
        'بلاغ مشكلة: موشن خام',
        'النسخة: %s' % skill_version(),
        'الجهاز: %s (%s)' % (os_name(), platform.machine()),
        'Python: %s · Node: %s' % (platform.python_version(), version_of(shutil.which('node'), ['--version'])),
        'FFmpeg: %s' % ('موجود' if executable('ffmpeg') else 'غير موجود'),
        'أدوات الرندر: %s' % ('جاهزة' if toolkit_dir() else 'ناقصة'),
        'مجلد الشغل: %s' % ('موجود' if ws else 'غير موجود'),
        'مكان المهارة: %s%s' % ('داخل المجلد' if installed_folder() else 'برّا المجلد',
                                 '، وفيه نسخة على كل الجهاز' if GLOBAL_SKILL.is_dir() else ''),
        'مكتبة الأصوات: %s' % ('%d صوت' % sounds if sounds else 'غير مثبتة'),
        'مفتاح ElevenLabs: %s' % ('موجود' if elevenlabs_key()[0] else 'غير موجود'),
        'وش كان يصير: %s' % (clean(a.step) or '—'),
        'رسالة الخطأ: %s' % (clean(a.error) or '—'),
        'أرسل هذا لـ @khaam.hq في الخاص، ومعه صورة من الشاشة لو تقدر.',
    ]
    text = '\n'.join(lines) + '\n'
    target = (ws or pathlib.Path.cwd()) / 'بلاغ مشكلة.txt'
    try:
        target.write_text(text, encoding='utf-8')
        saved = clean(str(target))
    except OSError:
        saved = None
    print(text)
    print(json.dumps({'saved': saved}, ensure_ascii=False))


if __name__ == '__main__':
    main()
