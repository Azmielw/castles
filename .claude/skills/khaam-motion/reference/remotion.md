<!-- Khaam Motion · reference file, loaded on demand from SKILL.md -->
# Remotion: only when the job needs it

[Remotion](https://github.com/remotion-dev/remotion) writes video as React components. It complements HyperFrames rather than competing with it. Use it when React pays off:
- real 3D through `@remotion/three` (React Three Fiber);
- a data-driven video, or a templated series with typed props;
- many variants rendered in one batch.

Everything else starts in HyperFrames (`reference/hyperframes.md`).

## Before you start (say these to the user in one or two lines)
- **Licence:** free for individuals, for companies of up to 3 employees, and for non-profits. A company of 4 or more needs a paid Company License (remotion.pro/license). Ask once if it matters for this user.
- **Weight:**
  - Each project installs its own `node_modules`: about 1 GB with the 3D packages.
  - It downloads Chrome Headless Shell once.
  - Windows on ARM is a problem: that Chrome is x64-only there.
- Install only with the user's OK, inside the video's folder in `.khaam/projects/`, never globally.

## Setup in a video folder
```
npm init -y
npm install remotion @remotion/cli @remotion/three three @react-three/fiber --save-exact
npx remotion browser ensure
```
- **Optional:** the official Remotion skills for Claude (`npx skills add remotion-dev/skills`). They are in English and know nothing about Arabic, so our rules below still apply.
- **Render:** `npx remotion render <entry> <CompositionId> "renders/final/<name> v1.mp4"`.

## Arabic in Remotion
- Same rules as HyperFrames:
  - `direction: rtl` on rows of separate words;
  - whole words only;
  - Arabic fonts loaded with `@remotion/fonts` or `@font-face` from `assets/fonts/`;
  - the IBM Plex «تى» check.
- **Captions:** Remotion's Whisper example uses an English-only model. For Arabic, use the narration helper's word timings or a multilingual Whisper model.

## Render habits that kept 3D renders clean
- A few lights. No MSAA when motion blur is on.
- Render long films in chunks with a fresh browser.
- Check memory and other renders before a long job.
- Preview stills first (`npx remotion still`), then the full render.
