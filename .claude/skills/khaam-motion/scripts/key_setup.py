#!/usr/bin/env python3
"""Set up the ElevenLabs key without the key ever passing through the chat.

  python <skill>/scripts/key_setup.py                   # create the key file if missing, open it in Notepad / TextEdit
  python <skill>/scripts/key_setup.py --check           # is a key there, and where from? (never prints it)
  python <skill>/scripts/key_setup.py --check --online  # plus one free request (GET /v1/models) to confirm it works
  python <skill>/scripts/key_setup.py --forget          # delete the key file (only after the user asks)

The file is ~/.cache/khaam-motion/elevenlabs-key.txt: outside every project and the skill, so it never travels
with a folder. The helpers read it on every call, so no restart is needed. An ELEVENLABS_API_KEY environment
variable, if set, still wins. Claude never opens, reads, prints, copies or uploads this file; only this script
and the ElevenLabs helpers read it.
"""
import argparse, json, os, subprocess, sys, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I
from khaam_paths import KEY_FILE, elevenlabs_key
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

TEMPLATE = ('# الصق مفتاح ElevenLabs في السطر اللي تحت، واحفظ (Ctrl+S، وفي الماك Cmd+S)، وسكّر الملف.\n'
            '# Paste your ElevenLabs API key on the empty line below, save, and close this file.\n\n')


def open_in_editor(path):
    if sys.platform.startswith('win'):
        subprocess.Popen(['notepad.exe', str(path)])
    elif sys.platform == 'darwin':
        subprocess.Popen(['open', '-e', str(path)])
    else:
        subprocess.Popen(['xdg-open', str(path)])


def create():
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    created = not KEY_FILE.exists()
    if created:
        KEY_FILE.write_text(TEMPLATE, encoding='utf-8')
    if os.name == 'posix':
        os.chmod(KEY_FILE.parent, 0o700)
        os.chmod(KEY_FILE, 0o600)
    open_in_editor(KEY_FILE)
    return {'opened': True, 'created': created, 'file': str(KEY_FILE),
            'next': 'The user pastes the key on the empty line, saves and closes the file, then says «تم». Run --check --online.'}


def check(online):
    key, source = elevenlabs_key()
    out = {'present': bool(key), 'source': source, 'file': str(KEY_FILE)}
    if source == 'file-invalid':
        out['problem'] = 'The file holds more than one value or a value with spaces. Run key_setup.py again and keep one key.'
    if key and online:
        req = urllib.request.Request('https://api.elevenlabs.io/v1/models', headers={'xi-api-key': key})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                out['online'] = 'ok' if r.status == 200 else 'http %d' % r.status
        except urllib.error.HTTPError as e:
            out['online'] = {401: 'rejected: wrong, deleted or expired key',
                             403: 'refused: the key lacks a permission (turn on Text to Speech, Voices, Models, Sound Effects and Music)'
                             }.get(e.code, 'http %d' % e.code)
        except (urllib.error.URLError, TimeoutError, OSError):
            out['online'] = 'network error (nothing was charged)'
        except ValueError:
            out['online'] = 'the key has characters that cannot be sent; run key_setup.py again'
    del key
    out['charged'] = False  # GET /v1/models costs no credits
    return out


def forget():
    existed = KEY_FILE.exists()
    if existed:
        KEY_FILE.unlink()
    return {'deleted': existed, 'file': str(KEY_FILE),
            'note': 'Also delete the key in ElevenLabs (Developers > API Keys) if it may have leaked.'}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--online', action='store_true')
    ap.add_argument('--forget', action='store_true')
    a = ap.parse_args()
    result = forget() if a.forget else check(a.online) if a.check else create()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
