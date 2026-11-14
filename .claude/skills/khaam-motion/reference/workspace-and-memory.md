<!-- Khaam Motion · reference file, loaded on demand from SKILL.md -->
# The workspace and the memory between chats (since 1.6)

## 1. What the user sees, what Claude keeps
The workspace is the user's own folder: the one the chat was opened on, or «مونتاجي» on the Desktop when the chat had no folder of its own. The skill itself is installed inside it, for that folder only.
```
<the folder>/                 ← the one folder the user opens in the Code tab
  CLAUDE.md                   ← loads by itself in every chat opened here (templates/workspace-CLAUDE.md)
  SESSION_HANDOFF.md          ← «وين وقفنا»: the memory between chats (templates/SESSION_HANDOFF.md)
  خام/                        ← clips and recordings the user made
  إلهام/                      ← what they like or own: videos, pictures, links, logo, fonts, colours, sounds
  جاهز/                       ← finished videos («<العنوان> v<N>.mp4») and credits («<العنوان> حقوق.txt»)
  دليل موشن خام.pdf            ← the beginner guide, when it came with the ZIP
  .claude/skills/khaam-motion/ ← the skill, installed for this folder only (hidden)
  .khaam/projects/<video>/    ← one folder per video, the layout in planning-and-tracking.md (hidden)
  .khaam/styles/              ← the user's saved styles, shared by every video (hidden)
```
- **Install and create it in one go** (START-HERE protocol step 4):
  1. From the extracted ZIP: `python "<temp>/khaam-motion/scripts/workspace.py" --plan --chat-folder "<the chat's folder>"`. It reads only, and prints the folder, why, and the question to ask (`ask_user`).
  2. On a yes, the same with `--create --install-skill`. It copies the skill into `<folder>/.claude/skills/khaam-motion/` and moves an old global copy to `~/.cache/khaam-motion/backup/`. It builds the three folders and the memory, and copies the guide (`<skill>/guide.pdf`) in as «دليل موشن خام.pdf». It records the path in `~/.cache/khaam-motion/onboarding.json` and prints `tell_user` and `next_chat`.
- **Which folder:**
  - the chat's own folder;
  - a visible «مونتاجي» on the Desktop when the chat is on the home folder, a drive root, the Desktop, Documents, Downloads, Videos, Pictures or Music itself, or a system or temporary folder;
  - never the global `~/.claude/skills/`.
- With `--path <folder>`, it uses that folder as it is, without moving anything (1.5 users completing the folder they already use).
- **A new Desktop folder** (`move_chat: true`): move the chat into it with the app's folder tool (`change_directory`) when one is offered. Otherwise say its `next_chat` line (the app keeps recent folders).
- **A chat opened in another folder** has no skill, because the skill lives in its folder only. If the user installs it there too, that folder becomes a second workspace with its own memory.
- **Synced folders:** if the folder is synced by OneDrive, iCloud, Dropbox or Google Drive (`synced: true`), keep it: the user chose it. If a render fails on a locked or busy file, render into `~/.cache/khaam-motion/render-tmp/` and copy the final in.
- **Keep the path short.** Some tools stop at 260 characters on Windows (HyperFrames snapshots failed past it). If the chat's folder is already deep, say so in one line and suggest «مونتاجي» on the Desktop.

## 2. The user never makes or moves files
- **Their files:** «حط مقاطعك في خام، وأي شي يعجبك أو يخصك في إلهام، أو اسحبه للمحادثة».
  - A file dragged into the chat arrives as a local copy under `~/.claude/uploads/`. Copy it to the right place yourself.
  - Images pasted with Ctrl+V are not saved to disk: ask for the file instead.
- **Make each video folder yourself:**
  - `workspace.py --new-video "<العنوان العربي>" --slug <short-english-words>`.
  - Folder names stay ASCII (date + slug). The Arabic title lives in PROGRESS.md and the handoff.
- **Copy, never move,** from `خام/` and `إلهام/` into the project's `assets/` (with a `manifest.json` entry that keeps `source_path`).
- **Open things for the user:** `workspace.py --reveal <file>` (Explorer or Finder) for previews, `design.html` and finals. Never tell them to find a path.
- **Deliver each approved final** with `workspace.py --deliver <file> --title "<العنوان>"`. It copies to `جاهز/`, never overwrites, and bumps the version. Then reveal it.
- **Credits:** when a sound needs one (CC BY), put a «<العنوان> حقوق.txt» beside the video in `جاهز/`.
- **No config, ever:** never ask the user to edit config files, environment variables or keys. The shared toolkit is found by default (`~/.cache/khaam-motion/toolkit`). The ElevenLabs key goes through `key_setup.py`.

## 3. Memory: the handoff
- **How it loads:** `CLAUDE.md` imports `@SESSION_HANDOFF.md`, so the handoff is loaded at the start of every chat opened in the workspace (and again after compaction).
- **Start of a chat:** read the handoff, then the files its «كمّل من هنا» names: that video's `PROGRESS.md` and `TASTE.md`, plus `~/.cache/khaam-motion/user-taste.md`.
- **«كمّل»:** recap in three lines (the goal, where things stand, the next step), then wait for a go.
- **End of every reply:**
  - If anything changed, update the handoff, then end with `📌 حفظت وين وقفنا`.
  - If nothing changed, end with `📌 ما فيه جديد للحفظ`.
- **One home per fact:**

  | What | Where |
  |---|---|
  | A video's phase, versions, approvals and next step | its `PROGRESS.md` (it wins any conflict between notes; the video's own files win over a PROGRESS.md older than them, below) |
  | Look, sound and voice values | `TASTE.md` |
  | General rules the user gave | `user-taste.md` + TASTE §9 |
  | History | `LOG.md` |
  | Machine flags (voice offer, sounds, workspace path) | `onboarding.json` |
  | The list of videos, decisions about the whole workspace, open questions, the single next step | the handoff, which points to the files above and never copies them |

- **After a cut chat (since 1.7.0 of 11-12):** a chat can be cut mid-reply (a usage limit, a closed laptop), after the plan was approved and takes were paid for, before the end-of-reply save. So:
  - **Save mid-reply:** update the video's PROGRESS.md and its handoff line right after the plan is approved, right after every paid request (a voice design, a take), and before any render or mix longer than a minute.
  - **Resume from the files:** on «كمّل» or any return to a video, run `workspace.py --state` (the current video, or `--state <its folder>`). It is read-only and prints the step the files show (`voice recorded`, `picture timed from the voice`, `mixed`, `Gate C: preview rendered`, `final rendered`, `delivered`), the paid takes with their credits and whether their text is the script's, which files are newer than PROGRESS.md, and the rules that follow.
  - **The files win over an older PROGRESS.md:** rewrite PROGRESS.md and the handoff from them first, then recap. A take on disk was paid for, and the plan behind it was approved: never ask for the plan again, never generate the same narration again (`gen_tts_elevenlabs.py generate` refuses the same text and voice while a take of it is on disk, unless `--another-take`).
- **Merge, never overwrite:**
  - Re-read the handoff right before editing it.
  - Record this chat only.
  - Move answered questions into decisions.
  - Keep the handoff under about 1,500 words.
  - Never write keys, passwords or tokens.
- **Tell the user at install:** `--create` prints `tell_user`. Say it as it is (Arabic users), then the memory line. For a chat's own folder it reads:
  ```
  ثبّت المهارة في هذا المجلد «<اسم المجلد>»، وجهّزته لك ✅
  - خام: حط فيه مقاطعك اللي تصوّرها
  - إلهام: حط فيه أي فيديو أو صورة تعجبك، ومنها أتعلم ذوقك
  - جاهز: هنا تنزل فيديوهاتك النهائية
  - أتذكر كل دردشة: افتح نفس المجلد «<اسم المجلد>» في قسم Code، وقل «كمّل»
  📌 حفظت وين وقفنا
  ```
  For a new Desktop folder, the first line is «سويت لك مجلد «مونتاجي» في سطح المكتب، وثبّت فيه المهارة ✅», and the last one says to open «مونتاجي» from the Desktop.

## 4. Taste: honest from the first message
- **Say it once, at install and before the first plan:**
  «كلود ما يطلع اللي في بالك من أول مرة. علّمه ذوقك: حط ٣ فيديوهات أو صور تعجبك في «إلهام»، وقل وش يعجبك فيها. كل ملاحظة أحفظها، وكل فيديو يقرّب أكثر.»
- **Study the references:**
  1. Run `analyze_ref.py` on each reference.
  2. A pasted link goes through yt-dlp into `إلهام/`. It is for study only: never reuse its footage or sound.
  3. Write the look, motion and sound values into the project's `TASTE.md`.
- **After every round,** turn the user's general preference into a rule in `user-taste.md`. A one-off fix stays in that project.

## 5. Updating from 1.4 or 1.5
Those versions were installed globally, in `~/.claude/skills/khaam-motion/`.
1. Extract the new ZIP into a new empty temporary folder. Run its `workspace.py --plan --chat-folder "<the chat's folder>"`; add `--path "<that folder>"` when their videos live in a folder they name.
2. On a yes, run `--create --install-skill`:
   - The new skill goes into that folder.
   - The old global copy moves to `~/.cache/khaam-motion/backup/khaam-motion-<old version>-<date>/`. Left there, it would override the folder's copy.
   - The workspace is completed: the handoff lists their old projects, and nothing is moved.
   - Their projects and taste live outside the skill and stay untouched.
3. If the sound library isn't installed, offer it once.
4. Say what's new in 4 short lines.
