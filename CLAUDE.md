## Khaam Motion workspace (read in every chat)
This folder is the user's video workspace for the khaam-motion skill, made by its `scripts/workspace.py`.

- **The skill lives in this folder only:** `.claude/skills/khaam-motion/`. Keep it here; never copy it to the global `~/.claude/skills/`, which would load it in every project on the computer.

- **The user only uses three folders:**
  - `خام/`: clips and recordings they made.
  - `إلهام/`: videos, pictures, links, logo, fonts, colours and sounds they like or own.
  - `جاهز/`: finished videos.
- **They can also drag files into the chat.** Never ask them to create, move, rename or open files, folders, settings or keys. Do it yourself, and say what you did in one line.
- **Each video lives in its own folder** under `.khaam/projects/`, using the khaam-motion project layout.
  - Run every command from that video's folder.
  - Copy files from `خام/` and `إلهام/`; never move them.
  - Send each approved final to `جاهز/` with `workspace.py --deliver`, which never overwrites, then open it for the user.
- **Use the khaam-motion skill for anything about videos here:** a video request, a change, a question about these videos, or «كمّل».
- **Reply in the user's language.** Arabic speakers get short, simple Gulf Arabic, one step at a time.

## Memory between chats (every chat, every reply)
@SESSION_HANDOFF.md
- **Start of every chat:**
  - The line above loads `SESSION_HANDOFF.md`. If it isn't in your context, read it in full before your first answer.
  - Then read what its «كمّل من هنا» section names: that video's PROGRESS.md and TASTE.md.
  - Also read `~/.cache/khaam-motion/user-taste.md`, if it exists.
- **«كمّل», «continue» or «where were we»:** give a three-line recap (the goal, where things stand, the next step), then wait for a go. The step comes from the files, not from memory (below).
- **End of every reply that changed something** (a file, a decision, a plan, a video, or the next step):
  - Re-read `SESSION_HANDOFF.md` and update it. Merge into it; never overwrite it.
  - A video's details live in its PROGRESS.md; the handoff only points to it.
  - Make your last line `📌 حفظت وين وقفنا`.
- **When nothing changed:** make the last line `📌 ما فيه جديد للحفظ`.
- Never write API keys, passwords or tokens in any file here.

## After a cut chat (every chat, before the recap)
- **Save mid-reply, not only at the end:** a chat can be cut at any moment. Update the video's PROGRESS.md (and its line in `SESSION_HANDOFF.md`) right after the plan is approved, right after every paid request (a voice design, a narration take), and before any render or mix that takes more than a minute.
- **On «كمّل» or any return to a video:** run `python ".claude/skills/khaam-motion/scripts/workspace.py" --state` (or with the video's folder). It reads where the video really is from its files: paid takes, the tightened voice, `timing.js`, the mix, previews, finals.
- **The files win over a PROGRESS.md older than them.** When `--state` says PROGRESS.md is stale, rewrite it and the handoff from the files first, then recap. Takes on disk were paid for and the plan behind them was approved: never ask for the plan again, never generate the same narration again.
