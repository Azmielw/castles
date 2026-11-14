"""Portable, read-only configuration resolution. No machine-specific paths."""
import os,json,pathlib,shutil
SKILL=pathlib.Path(__file__).resolve().parents[1]
def config():
 p=pathlib.Path(os.environ.get('KHAAM_CONFIG',str(pathlib.Path.cwd()/'.khaam/config.json'))).expanduser()
 if not p.exists():return {},p.parent.parent
 d=json.loads(p.read_text(encoding='utf-8-sig'))
 if not isinstance(d,dict):raise ValueError('Khaam config must be a JSON object')
 return d,p.parent.parent
def resolve(key,env,default=None):
 d,base=config();value=os.environ.get(env) or d.get(key) or default
 if value is None:return None
 p=pathlib.Path(os.path.expandvars(str(value))).expanduser()
 return p.resolve() if p.is_absolute() else (base/p).resolve()
def models_dir():return resolve('models_dir','KHAAM_MODELS',str(pathlib.Path.home()/'.cache/khaam-motion/models'))
SHARED_SFX=pathlib.Path.home()/'.cache/khaam-motion/sfx'   # built by scripts/install_sounds.py
def sfx_library():return resolve('sfx_library','KHAAM_SFX_LIBRARY',str(SHARED_SFX if (SHARED_SFX/'catalog.json').is_file() else pathlib.Path.cwd()/'assets/sfx'))
CACHE=pathlib.Path.home()/'.cache/khaam-motion'
SHARED_TOOLKIT=CACHE/'toolkit'   # Node + Playwright for the canvas renderer (START-HERE protocol)
def toolkit_dir():
 """Config or KHAAM_TOOLKIT first; else the shared toolkit once Playwright is installed there."""
 p=resolve('toolkit_dir','KHAAM_TOOLKIT')
 if p:return p
 return SHARED_TOOLKIT if (SHARED_TOOLKIT/'node_modules'/'playwright').is_dir() else None
KEY_FILE=CACHE/'elevenlabs-key.txt'   # created by scripts/key_setup.py; outside every project and the skill
def elevenlabs_key():
 """(key, source). The ELEVENLABS_API_KEY environment variable wins, then the key file. Never print the key."""
 k=os.environ.get('ELEVENLABS_API_KEY','').strip()
 if k:return (k,'environment') if k.isascii() and k.isprintable() and not any(c.isspace() for c in k) else ('','environment-invalid')
 try:lines=KEY_FILE.read_text(encoding='utf-8-sig').splitlines()
 except OSError:return '',None
 vals=[l.strip().split('=',1)[-1].strip().strip('"').strip("'") for l in lines if l.strip() and not l.strip().startswith('#')]
 vals=[v for v in vals if v]
 if not vals:return '','file-empty'
 v=vals[0]
 ok=len(vals)==1 and v.isascii() and v.isprintable() and not any(c.isspace() for c in v) and len(v)>=20
 return (v,'file') if ok else ('','file-invalid')
def onboarding():
 p=CACHE/'onboarding.json'
 try:return json.loads(p.read_text(encoding='utf-8-sig')) if p.is_file() else None
 except (OSError,ValueError):return {'unreadable':True}
GLOBAL_SKILL=pathlib.Path.home()/'.claude'/'skills'/'khaam-motion'   # the global place: never install here (it loads in every project)
def same_path(a,b):
 try:return os.path.normcase(str(pathlib.Path(a).resolve()))==os.path.normcase(str(pathlib.Path(b).resolve()))
 except (OSError,RuntimeError):return False
def installed_folder():
 """<folder> when this skill runs from <folder>/.claude/skills/khaam-motion: since 1.6 the skill lives in the user's own folder.
 None when it runs from the global ~/.claude/skills or from an extracted copy."""
 s=SKILL.parent;c=s.parent
 if s.name.lower()=='skills' and c.name.lower()=='.claude' and not same_path(c.parent,pathlib.Path.home()):return c.parent
 return None
def workspace():
 """The user's workspace: the folder this skill is installed in, once scripts/workspace.py has built it there.
 For a copy outside any folder (older global installs), the folder workspace.py recorded, if it still exists."""
 f=installed_folder()
 if f is not None:return f if (f/'SESSION_HANDOFF.md').is_file() else None
 d=onboarding()
 w=d.get('workspace') if isinstance(d,dict) else None
 if not w:return None
 p=pathlib.Path(w).expanduser()
 return p if p.is_dir() else None
def executable(name):
 d,_=config();override=os.environ.get('KHAAM_'+name.upper()) or d.get(name)
 if override:
  candidate=resolve(name,'KHAAM_'+name.upper())
  if candidate.is_file():return str(candidate)
  return shutil.which(str(override))
 return shutil.which(name)
