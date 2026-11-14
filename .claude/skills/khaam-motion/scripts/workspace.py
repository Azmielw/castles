#!/usr/bin/env python3
"""The user's workspace: the folder the skill is installed in, with the three folders they use, the memory between
chats and hidden video folders.

  python <skill>/scripts/workspace.py --plan --chat-folder DIR [--path FOLDER]    # read-only: which folder, why, what to ask
  python <skill>/scripts/workspace.py --create --install-skill --chat-folder DIR  # put this skill in that folder, build it
  python <skill>/scripts/workspace.py --create [--path FOLDER]               # make or complete the workspace only
  python <skill>/scripts/workspace.py --where                                # the workspace, as JSON
  python <skill>/scripts/workspace.py --new-video "العنوان" [--slug coffee-ad] # a video folder in .khaam/projects/
  python <skill>/scripts/workspace.py --deliver FILE --title "العنوان"        # copy a final into «جاهز», never overwriting
  python <skill>/scripts/workspace.py --reveal PATH                          # show a file or folder in Explorer / Finder
  python <skill>/scripts/workspace.py --state [VIDEO_FOLDER]                 # read-only: where a video really is, from its files

Which folder (since 1.6): the folder the chat was opened on (--chat-folder, else the current folder). When that is the
home folder, a drive root, the Desktop, Documents, Downloads, Videos, Pictures or Music itself, or a system or temporary
folder, a visible «مونتاجي» folder on the Desktop instead. A skill already installed in <folder>/.claude/skills/ keeps
its <folder>. --path FOLDER uses that folder as it is. Never the global ~/.claude/skills/: it loads the skill in every
project on the computer, and Claude Code prefers it over a folder's copy, so it would hide every update.
Layout (the user sees only the three Arabic folders):
  <folder>/  CLAUDE.md · SESSION_HANDOFF.md · خام/ · إلهام/ · جاهز/ · .claude/skills/khaam-motion/ · .khaam/projects/<video>/ · .khaam/styles/
Never moves, renames or deletes the user's files; an older copy of this skill moves to ~/.cache/khaam-motion/backup/.
Writes UTF-8 without BOM; folder names are NFC. KHAAM_DESKTOP overrides the Desktop folder (tests, unusual machines).
"""
import argparse, datetime, json, os, pathlib, re, shutil, subprocess, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python -I
from khaam_paths import SKILL, CACHE, GLOBAL_SKILL, onboarding, workspace, installed_folder, same_path
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

nfc = lambda s: unicodedata.normalize('NFC', s)
WS_NAME, RAW, INSPO, READY = nfc('مونتاجي'), nfc('خام'), nfc('إلهام'), nfc('جاهز')
MARK = '## Khaam Motion workspace'
RESUME_MARK = '## After a cut chat'  # the last section of templates/workspace-CLAUDE.md (1.7.0 of 11-12)
SYNCED = ('onedrive', 'icloud', 'mobile documents', 'cloudstorage', 'dropbox', 'google drive', 'googledrive')
TODAY = datetime.date.today().isoformat()
KNOWN = {  # Windows known-folder ids: they find the folder even when Windows or OneDrive moved it
    'Desktop': '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}', 'Documents': '{FDD39AD0-238F-46AF-ADB4-6C85480369C7}',
    'Downloads': '{374DE290-123F-4565-9164-39C4925E467B}', 'Videos': '{18989B1D-99B5-455B-841C-AB7C74E4DDFC}',
    'Pictures': '{33E28130-4E1E-4676-835A-98395C3BC3BB}', 'Music': '{4BD8D571-6D19-48D3-BE97-422220080E43}'}


def known_folder(name):
    home = pathlib.Path.home()
    if name == 'Desktop' and os.environ.get('KHAAM_DESKTOP'):
        return pathlib.Path(os.environ['KHAAM_DESKTOP']).expanduser()
    if sys.platform.startswith('win'):
        try:
            import ctypes, uuid
            from ctypes import wintypes
            class GUID(ctypes.Structure):
                _fields_ = [('a', wintypes.DWORD), ('b', wintypes.WORD), ('c', wintypes.WORD), ('d', ctypes.c_ubyte * 8)]
            u = uuid.UUID(KNOWN[name])
            g = GUID(u.fields[0], u.fields[1], u.fields[2], (ctypes.c_ubyte * 8).from_buffer_copy(u.bytes[8:]))
            out = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(out)) == 0:
                path = pathlib.Path(out.value)
                ctypes.windll.ole32.CoTaskMemFree(out)
                return path
        except Exception:
            pass
        return home / name
    if sys.platform == 'darwin' and name == 'Videos':
        return home / 'Movies'
    return home / name


def inside(p, parent):
    def norm(x):
        try: return os.path.normcase(str(pathlib.Path(x).resolve()))
        except (OSError, RuntimeError): return os.path.normcase(str(x))
    a, b = norm(p), norm(parent).rstrip('\\/')
    return a == b or a.startswith(b + os.sep)


def broad_reason(folder):
    """Why a chat folder can't hold the workspace (too broad, or a system place), or None when it can."""
    f, home = pathlib.Path(folder), pathlib.Path.home()
    if f.parent == f:
        return 'a drive root'
    if same_path(f, home):
        return 'the home folder'
    for name in KNOWN:
        if same_path(f, known_folder(name)):
            return 'the %s folder itself' % name
    for env in ('OneDrive', 'OneDriveConsumer', 'OneDriveCommercial'):
        if os.environ.get(env) and same_path(f, os.environ[env]):
            return 'the OneDrive folder itself'
    if inside(f, home / '.claude') or inside(f, CACHE):
        return 'a settings folder'
    if sys.platform.startswith('win'):
        places = [os.environ.get(e) for e in ('SystemRoot', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData',
                                              'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP')]
    else:
        places = ['/tmp', '/private', '/var', '/usr', '/etc', '/opt', '/System', '/Applications', '/Library', str(home / 'Library')]
    if any(p and inside(f, p) for p in places):
        return 'a system or temporary folder'
    return None


def version_of(folder):
    try:
        m = re.search(r'— v(\d+\.\d+\.\d+)', (pathlib.Path(folder) / 'SKILL.md').read_text(encoding='utf-8-sig'))
        return m.group(1) if m else 'unknown'
    except OSError:
        return None


def plan(chat_folder=None, path=None):
    """Where the skill and the workspace go, and why. Reads only."""
    chat = pathlib.Path(nfc(str(chat_folder or os.getcwd()))).expanduser()
    try: chat = chat.resolve()
    except OSError: pass
    here = installed_folder()
    if path:
        ws, where, why = pathlib.Path(nfc(str(path))).expanduser().resolve(), 'given', 'the folder given with --path'
    elif here is not None:
        ws, where, why = here, 'installed', 'this skill is already installed in it'
    else:
        broad = broad_reason(chat)
        if broad:
            ws, where, why = known_folder('Desktop') / WS_NAME, 'desktop', 'the chat is on %s, so «%s» on the Desktop' % (broad, WS_NAME)
        else:
            ws, where, why = chat, 'chat', 'the folder the chat was opened on'
    target = ws / '.claude' / 'skills' / 'khaam-motion'
    g = GLOBAL_SKILL if GLOBAL_SKILL.is_dir() and not same_path(GLOBAL_SKILL, target) else None
    return {'workspace': ws, 'where': where, 'why': why, 'chat_folder': chat, 'is_chat_folder': same_path(ws, chat),
            'target': target, 'global_copy': g}


def ask_user(p):
    """The one question to ask before --create --install-skill, in the user's words (Arabic)."""
    ws, target = p['workspace'], p['target']
    old = version_of(target) if (target / 'SKILL.md').is_file() and not same_path(SKILL, target) else None
    new = version_of(SKILL)
    if p['where'] == 'desktop':
        if ws.exists():
            line = 'بثبّت المهارة داخل مجلد «%s» اللي في سطح المكتب بس، مو على كل الجهاز.' % ws.name
        else:
            line = ('المحادثة مو مفتوحة على مجلد خاص، فبسوي لك مجلد «%s» في سطح المكتب، وأثبّت المهارة داخله بس، '
                    'مو على كل الجهاز. وأجهّز فيه ثلاث مجلدات: خام، وإلهام، وجاهز.' % ws.name)
    elif old and old == new:
        line = 'بثبّت النسخة %s من جديد داخل هذا المجلد «%s»، وأحفظ اللي فيه نسخة احتياطية.' % (new, ws.name)
    elif old:
        line = 'بحدّث المهارة اللي داخل هذا المجلد «%s» من %s إلى %s، وأحفظ القديمة نسخة احتياطية.' % (ws.name, old, new)
    else:
        line = 'بثبّت المهارة داخل هذا المجلد «%s» بس، مو على كل الجهاز، وأجهّز فيه ثلاث مجلدات: خام، وإلهام، وجاهز.' % ws.name
    if p['global_copy']:
        line += ' ولقيت نسخة قديمة مثبتة على كل الجهاز، بنقلها للنسخ الاحتياطية عشان ما تغطي على الجديدة.'
    return line + ' موافق؟'


def next_chat(p):
    if p['where'] == 'desktop':
        return 'افتح مجلد «%s» اللي في سطح المكتب في قسم Code، وقل «كمّل»' % p['workspace'].name
    return 'افتح نفس المجلد «%s» في قسم Code، وقل «كمّل»' % p['workspace'].name


def tell_user(p):
    name, installed = p['workspace'].name, (p['target'] / 'SKILL.md').is_file()
    if p['where'] == 'desktop':
        head = 'سويت لك مجلد «%s» في سطح المكتب%s ✅' % (name, '، وثبّت فيه المهارة' if installed else '')
    else:
        head = ('ثبّت المهارة في هذا المجلد «%s»، وجهّزته لك ✅' if installed else 'جهّزت لك المجلد «%s» ✅') % name
    return '\n'.join([head,
                      '- خام: حط فيه مقاطعك اللي تصوّرها',
                      '- إلهام: حط فيه أي فيديو أو صورة تعجبك، ومنها أتعلم ذوقك',
                      '- جاهز: هنا تنزل فيديوهاتك النهائية',
                      '- أتذكر كل دردشة: ' + next_chat(p)])


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def record(ws):
    p = CACHE / 'onboarding.json'
    CACHE.mkdir(parents=True, exist_ok=True)
    data = onboarding()
    if not isinstance(data, dict) or data.get('unreadable'):
        data = {}
    data.update(workspace=ws.as_posix(), workspace_created=data.get('workspace_created') or TODAY, handoff='1.6.0')
    write_json(p, data)


def backup(folder):
    """Move an older copy of this skill out of the way: ~/.cache/khaam-motion/backup/khaam-motion-<version>-<date>[-N]/."""
    base = CACHE / 'backup' / ('khaam-motion-%s-%s' % (version_of(folder) or 'unknown', TODAY))
    dest, n = base, 2
    while dest.exists():
        dest, n = base.with_name('%s-%d' % (base.name, n)), n + 1
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(folder), str(dest))
    return dest


def install_skill(target):
    """Copy this running skill into <workspace>/.claude/skills/khaam-motion; an older copy there goes to the backup."""
    if same_path(SKILL, target):
        return {'skill': 'already here', 'skill_dir': str(target)}
    out = {'skill_dir': str(target)}
    claude_dir = target.parent.parent
    new_claude_dir = not claude_dir.exists()
    if target.exists():
        out['previous_copy_moved_to'] = str(backup(target))
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL, target, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    if new_claude_dir and sys.platform.startswith('win'):
        subprocess.run(['attrib', '+h', str(claude_dir)], capture_output=True)
    out['skill'] = 'installed'
    return out


def existing_videos(ws):
    """Projects made before the workspace existed (1.5 users): folders holding TASTE.md or PROGRESS.md."""
    found = []
    for marker in ('TASTE.md', 'PROGRESS.md'):
        for f in ws.glob('*/' + marker):
            if f.parent.name not in (RAW, INSPO, READY, '.khaam') and f.parent not in found:
                found.append(f.parent)
        for f in (ws / '.khaam' / 'projects').glob('*/' + marker):
            if f.parent not in found:
                found.append(f.parent)
    return found


def create(path=None, guide=None, chat_folder=None, install=False):
    p = plan(chat_folder, path)
    ws = p['workspace']
    new_ws = not ws.exists()
    for d in (ws / RAW, ws / INSPO, ws / READY, ws / '.khaam' / 'projects', ws / '.khaam' / 'styles'):
        d.mkdir(parents=True, exist_ok=True)
    if sys.platform.startswith('win'):
        subprocess.run(['attrib', '+h', str(ws / '.khaam')], capture_output=True)
    skill = install_skill(p['target']) if install else {}
    block = (SKILL / 'templates' / 'workspace-CLAUDE.md').read_text(encoding='utf-8')
    claude = ws / 'CLAUDE.md'
    if not claude.exists():
        claude.write_text(block, encoding='utf-8'); claude_state = 'created'
    elif MARK in claude.read_text(encoding='utf-8-sig'):
        claude_state = 'present'
        if RESUME_MARK in block and RESUME_MARK not in claude.read_text(encoding='utf-8-sig'):
            with claude.open('a', encoding='utf-8') as f:  # an older workspace gets the 1.7.0 resume rule, nothing else changes
                f.write('\n\n' + block[block.index(RESUME_MARK):])
            claude_state = 'present, resume rule added'
    else:
        with claude.open('a', encoding='utf-8') as f:
            f.write('\n\n' + block)
        claude_state = 'appended'
    handoff = ws / 'SESSION_HANDOFF.md'
    olds = existing_videos(ws)
    if not handoff.exists():
        text = (SKILL / 'templates' / 'SESSION_HANDOFF.md').read_text(encoding='utf-8').replace('{date}', TODAY).replace('{folder}', ws.name)
        if olds:
            rows = ''.join('| %s | %s | قديم (من قبل 1.6) | — |\n' % (o.name, o.relative_to(ws).as_posix() + '/') for o in olds)
            text = text.replace('|---|---|---|---|\n', '|---|---|---|---|\n' + rows, 1)
        handoff.write_text(text, encoding='utf-8'); handoff_state = 'created'
    else:
        handoff_state = 'present'
    g = pathlib.Path(guide) if guide else SKILL / 'guide.pdf'  # the release ZIP ships the guide as <skill>/guide.pdf
    if g.is_file() and not (ws / 'دليل موشن خام.pdf').exists():
        shutil.copy2(g, ws / 'دليل موشن خام.pdf')
    record(ws)
    if install and p['global_copy']:  # last: the running copy may be the global one, and its templates were needed above
        try: skill['global_copy_moved_to'] = str(backup(p['global_copy']))
        except OSError as e: skill.update(global_copy_left=str(p['global_copy']), global_copy_error=type(e).__name__)
    out = {'workspace': str(ws), 'new': new_ws, 'where': p['where'], 'why': p['why'], 'folders': [RAW, INSPO, READY],
           'claude_md': claude_state, 'handoff': handoff_state, 'videos_found': [str(o) for o in olds]}
    out.update(skill)
    out.update(skill_in_folder=(p['target'] / 'SKILL.md').is_file(), move_chat=not p['is_chat_folder'],
               synced=any(w in str(ws).lower() for w in SYNCED), tell_user=tell_user(p), next_chat=next_chat(p))
    return out


def plan_json(p):
    t, g = p['target'], p['global_copy']
    return {'workspace': str(p['workspace']), 'where': p['where'], 'why': p['why'], 'exists': p['workspace'].exists(),
            'chat_folder': str(p['chat_folder']), 'move_chat': not p['is_chat_folder'], 'skill_target': str(t),
            'installed_there': version_of(t) if (t / 'SKILL.md').is_file() else None,
            'global_copy': str(g) if g else None, 'global_version': version_of(g) if g else None,
            'this_copy': str(SKILL), 'this_version': version_of(SKILL),
            'synced': any(w in str(p['workspace']).lower() for w in SYNCED), 'ask_user': ask_user(p)}


def need_ws():
    ws = workspace()
    if not ws:
        sys.exit('No workspace here yet. Run: workspace.py --plan --chat-folder <folder>, then --create --install-skill.')
    return ws


def new_video(title, slug=None):
    ws = need_ws()
    base = TODAY + '-' + (re.sub(r'[^a-z0-9]+', '-', slug.lower()).strip('-') if slug else 'video')
    base = base.rstrip('-') or TODAY
    projects = ws / '.khaam' / 'projects'
    folder, n = projects / base, 2
    while folder.exists():
        folder, n = projects / ('%s-%d' % (base, n)), n + 1
    for d in ('plan', 'assets', 'src', 'renders/previews', 'renders/final', 'renders/logs', 'cache'):
        (folder / d).mkdir(parents=True, exist_ok=True)
    shutil.copy2(SKILL / 'templates' / 'TASTE.md', folder / 'TASTE.md')
    (folder / 'PROGRESS.md').write_text(
        '# PROGRESS – %s   (updated %s)\nPhase: brief\nCurrent version: —\nDone: -\nIn progress: -\n'
        'Next step: the plan (Gate A)\nOpen issues / user feedback not yet fixed: -\nApprovals: -\nKey files: TASTE.md\n' % (title, TODAY),
        encoding='utf-8')
    (folder / 'LOG.md').write_text('# LOG – %s\n%s · project created · workspace.py --new-video\n' % (title, TODAY), encoding='utf-8')
    write_json(folder / 'manifest.json', [])
    write_json(folder / 'package.json', {'name': folder.name, 'private': True, 'type': 'module'})
    rel = folder.relative_to(ws).as_posix() + '/'
    handoff = ws / 'SESSION_HANDOFF.md'
    if handoff.exists():  # add a row to the videos table so the pointer exists even before the next update
        lines = handoff.read_text(encoding='utf-8-sig').split('\n')
        for i, line in enumerate(lines):
            if line.startswith('|---'):
                j = i + 1
                while j < len(lines) and lines[j].startswith('|'):
                    j += 1
                lines.insert(j, '| %s | %s | بدأ | — |' % (title.replace('|', '/'), rel))
                handoff.write_text('\n'.join(lines), encoding='utf-8')
                break
    return {'video': title, 'folder': str(folder), 'relative': rel}


def deliver(file, title):
    ws = need_ws()
    src = pathlib.Path(file).resolve()
    if not src.is_file():
        sys.exit('File not found: %s' % src)
    clean = re.sub(r'[\\/:*?"<>|]+', '-', nfc(title)).strip(' .-') or 'فيديو'
    ready = ws / READY
    ready.mkdir(exist_ok=True)
    n = 1
    while (ready / ('%s v%d%s' % (clean, n, src.suffix))).exists():
        n += 1
    dest = ready / ('%s v%d%s' % (clean, n, src.suffix))
    shutil.copy2(src, dest)
    return {'delivered': str(dest), 'version': n}


# ---- --state (1.7.0 of 11-12, after a blind test): a chat cut mid-video leaves PROGRESS.md behind the files. The next
# chat reads where the video really is from disk (paid takes, timing, mix, renders), so it never goes back to the plan
# or pays for the same narration twice. Read-only.
_norm_text = lambda s: re.sub(r'\s+', ' ', nfc(str(s))).strip()
_SKIP = ('cache', 'node_modules', '.hyperframes')


def project_of(path=None):
    """The video folder: PATH (or a folder inside it), the current folder, or the most recently touched video."""
    def up(c):
        for p in [c] + list(c.parents)[:4]:
            if (p / 'PROGRESS.md').is_file() or (p.parent.name == 'projects' and p.parent.parent.name == '.khaam'):
                return p
        return None
    if path:
        v = up(pathlib.Path(path).resolve())
        if v is None:
            sys.exit('Not a video folder: %s' % path)
        return v
    v = up(pathlib.Path.cwd().resolve())
    if v is not None:
        return v
    ws = workspace()
    vids = [d for d in (ws / '.khaam' / 'projects').glob('*') if d.is_dir()] if ws else []
    def touched(d):
        ts = [p.stat().st_mtime for p in d.rglob('*') if p.is_file() and not any(s in p.parts for s in _SKIP)]
        return max(ts) if ts else d.stat().st_mtime
    return max(vids, key=touched) if vids else None


def state(path=None):
    v = project_of(path)
    if v is None:
        return {'video': None, 'step': 'no video yet', 'next': 'Gate A for the first video.'}
    rel = lambda p: p.relative_to(v).as_posix()
    when = lambda t: datetime.datetime.fromtimestamp(t).isoformat(sep=' ', timespec='minutes')
    def has(*globs):
        out = {p for g in globs for p in v.glob(g) if p.is_file() and not any(s in p.relative_to(v).parts for s in _SKIP)}
        return sorted(out, key=lambda p: p.stat().st_mtime)
    prog = v / 'PROGRESS.md'
    pt = prog.stat().st_mtime if prog.is_file() else 0.0
    says = {}
    if prog.is_file():
        for line in prog.read_text(encoding='utf-8-sig').splitlines():
            for k in ('Phase', 'Next step', 'Approvals'):
                if line.startswith(k + ':'):
                    says[k.lower().replace(' ', '_')] = line.split(':', 1)[1].strip()
    script = next((p for p in (v / 'plan' / 'vo' / 'vo.txt', v / 'plan' / 'vo.txt') if p.is_file()), None)
    script_text = _norm_text(script.read_text(encoding='utf-8-sig')) if script else None
    takes, voices = [], []
    for sc in has('assets/vo/**/*.json'):
        if sc.name.endswith('.words.json') or sc.name.endswith('.segments.json'):
            continue
        try:
            d = json.loads(sc.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict):
            continue
        if sc.name.endswith('.voice.json'):
            voices.append({'record': rel(sc), 'name': d.get('name') or d.get('voice_name'), 'voice_id': d.get('voice_id')})
        elif d.get('provider') == 'ElevenLabs' and 'text' in d and d.get('request_id') is not None:
            audio = sc.with_name(d.get('audio_file') or sc.name[:-5])
            takes.append({'file': rel(audio), 'on_disk': audio.is_file(), 'paid': True,
                          'voice': (d.get('voice') or {}).get('name') or d.get('voice_id'), 'seed': d.get('seed'),
                          'characters': d.get('characters'), 'credits_reported': d.get('reported_character_cost'),
                          'made': d.get('created_utc'),
                          'same_text_as_script': (_norm_text(d['text']) == script_text) if script_text is not None else None})
    paid_audio = {t['file'] for t in takes}
    found = {
        'plan': has('plan/script.md', 'plan/story-plan.md', 'plan/design.html', 'plan/vo/vo.txt', 'plan/sound.json'),
        'recordings': [p for p in has('assets/vo/*.wav', 'assets/vo/*.mp3', 'assets/vo/*.m4a')
                       if rel(p) not in paid_audio and p.name != 'vo.wav'],
        'voice_tightened': has('assets/vo/vo.wav'),
        'word_timings': has('assets/vo/**/*.words.json'),
        'timing': has('timing.js', 'plan/cues.json', 'plan/beats.txt', 'plan/beats.json'),
        'mix': has('assets/mix.wav', 'plan/sound.mixed.json'),
        'previews': has('renders/previews/*.mp4'),
        'finals': has('renders/final/*.mp4'),
    }
    ws = workspace()
    delivered = []
    if ws and found['finals'] and (ws / READY).is_dir():
        sig = {(p.stat().st_size, int(p.stat().st_mtime)) for p in found['finals']}
        delivered = [p.name for p in (ws / READY).glob('*.mp4') if (p.stat().st_size, int(p.stat().st_mtime)) in sig]
    newer = sorted({rel(p) for fs in found.values() for p in fs if p.stat().st_mtime > pt + 1} |
                   {t['file'] for t in takes if t['on_disk'] and (v / t['file']).stat().st_mtime > pt + 1})
    voiced = bool(takes or found['voice_tightened'] or found['word_timings'] or found['recordings'])
    if delivered:
        step, nxt = 'delivered', 'Done: the final is in «جاهز». The cover and caption beside it if missing; a change is a new version.'
    elif found['finals']:
        step, nxt = 'final rendered', 'Deliver it (workspace.py --deliver), then the cover and the caption. No new decisions.'
    elif found['previews']:
        step, nxt = 'Gate C: preview rendered', 'Show the newest preview, or apply the feedback PROGRESS.md lists; after approval, the final.'
    elif found['mix']:
        step, nxt = 'mixed', 'Render the full preview with its sound (Gate C).'
    elif found['timing'] and voiced:
        step, nxt = 'picture timed from the voice', 'Build the scenes on timing.js, write the sound plan from the same timing, mix, then the preview.'
    elif voiced and found['voice_tightened']:
        step, nxt = 'voice recorded', ('The tightened voice is ready (assets/vo/vo.wav): time the picture from its words '
                                       '(cues.py), then build the scenes. No new take.')
    elif voiced:
        step, nxt = 'voice recorded', ('Use what is on disk: pick the take (say it is unheard if nobody listened), tighten it '
                                       '(voice_edit.py tighten), then time the picture from its words (cues.py). No new take.')
    elif found['plan']:
        step, nxt = 'plan written', 'Gate A: show the plan in one message, unless PROGRESS.md or TASTE.md records its approval.'
    else:
        step, nxt = 'brief', 'Gate A: the plan.'
    gate_a = voiced or bool(found['timing'] or found['mix'] or found['previews'] or found['finals'])
    rules = []
    if takes:
        rules.append('%d narration take(s) on disk were already paid for (%s credits reported): use them; never generate the '
                     'same text again unless the user asks for a new take after hearing these.'
                     % (len(takes), sum(int(t['credits_reported'] or 0) for t in takes) or 'no'))
    if gate_a:
        rules.append('Gate A was approved (the voice and the build come only after it): never ask for the plan again; '
                     'a change the user asks for is a change, not a new plan.')
    if newer:
        rules.append('PROGRESS.md is older than %d file(s) here: the files win. Rewrite PROGRESS.md and the video\'s line in '
                     'SESSION_HANDOFF.md from them first, then give the three-line recap.' % len(newer))
    return {'video': str(v), 'step': step, 'next': nxt, 'gate_a_approved': gate_a,
            'progress_md': {'updated': when(pt) if pt else None, 'says': says, 'stale': bool(newer)},
            'newer_than_progress': newer, 'takes_paid': takes, 'voices_saved': voices,
            'on_disk': {k: [rel(p) for p in fs] for k, fs in found.items()}, 'delivered': delivered, 'rules': rules}


def reveal(path):
    p = pathlib.Path(path).resolve()
    if sys.platform.startswith('win'):
        subprocess.run(['explorer', '/select,', str(p)] if p.is_file() else ['explorer', str(p)])
    elif sys.platform == 'darwin':
        subprocess.run(['open', '-R', str(p)] if p.is_file() else ['open', str(p)])
    else:
        subprocess.run(['xdg-open', str(p if p.is_dir() else p.parent)])
    return {'revealed': str(p)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--plan', action='store_true'); g.add_argument('--create', action='store_true')
    g.add_argument('--where', action='store_true'); g.add_argument('--new-video', metavar='TITLE')
    g.add_argument('--deliver', metavar='FILE'); g.add_argument('--reveal', metavar='PATH')
    g.add_argument('--state', nargs='?', const='', metavar='VIDEO_FOLDER',
                   help='read-only: where a video really is, from its files (after a cut chat), as JSON')
    ap.add_argument('--path'); ap.add_argument('--chat-folder'); ap.add_argument('--install-skill', action='store_true')
    ap.add_argument('--guide'); ap.add_argument('--slug'); ap.add_argument('--title')
    a = ap.parse_args()
    if a.install_skill and not a.create: ap.error('--install-skill goes with --create')
    if a.plan: out = plan_json(plan(a.chat_folder, a.path))
    elif a.create: out = create(a.path, a.guide, a.chat_folder, a.install_skill)
    elif a.where:
        ws = workspace(); d = onboarding() or {}; p = plan(a.chat_folder)
        here = installed_folder()
        out = {'workspace': str(ws) if ws else None, 'recorded': d.get('workspace') if isinstance(d, dict) else None,
               'exists': bool(ws), 'skill_folder': str(here) if here else None,
               'default_if_new': str(p['workspace']), 'default_why': p['why']}
    elif a.new_video: out = new_video(a.new_video, a.slug)
    elif a.deliver:
        if not a.title: ap.error('--deliver needs --title')
        out = deliver(a.deliver, a.title)
    elif a.state is not None: out = state(a.state or None)
    else: out = reveal(a.reveal)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
