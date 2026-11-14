#!/usr/bin/env python3
"""The cover is the hook frame - Khaam Motion.

Takes the frame where the hook reads best from the finished video and saves it as the cover image, plus a check
tile: the 3:4 crop a profile grid shows, shrunk to about 390 px wide (reference/hooks.md section 3). Read the
tile: if the title is not readable there, the cover needs a bigger title, not a different frame.

  python cover.py "<video>.mp4"                         frame 0 (the default thumbnail on social players)
  python cover.py "<video>.mp4" --at 1.4                that second
  python cover.py "<video>.mp4" --words "assets/vo/take1.words.json" --offset 0 --cue "فكرتك"
                                                        0.3 s after the hook's last word starts: the line is lit and
                                                        still on screen (":end" can land after it has faded)
The profile grid shows only the middle 3:4 of a 9:16 cover (y 240-1680 of 1920): keep the hook's text below y≈300.
Writes "<video stem> غلاف.jpg" and "<video stem> غلاف - شبكة.jpg" beside the video (or in --out-dir); never
overwrites (adds v2, v3...). Needs FFmpeg.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


class CoverError(Exception):
    pass


def tool(name):
    try:
        from khaam_paths import executable
        found = executable(name)
    except Exception:
        found = None
    found = found or shutil.which(name)
    if not found:
        raise CoverError('%s not found: install FFmpeg first (START-HERE protocol step 6).' % name)
    return str(found)


def free_name(folder, stem, suffix):
    p = folder / (stem + suffix)
    n = 2
    while p.exists():
        p = folder / ('%s v%d%s' % (stem, n, suffix))
        n += 1
    return p


def duration(video):
    r = subprocess.run([tool('ffprobe'), '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(video)],
                       capture_output=True, text=True, timeout=60)
    try:
        return float(json.loads(r.stdout)['format']['duration'])
    except (ValueError, KeyError, TypeError):
        raise CoverError('Cannot read the video\'s length: is it a finished MP4?') from None


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('video')
    p.add_argument('--at', type=float, help='seconds into the video')
    p.add_argument('--words', action='append', help='narration .words.json (as for cues.py)')
    p.add_argument('--offset', action='append', type=float, help='where that take starts in the video')
    p.add_argument('--cue', help='a spoken word (cues.py syntax); the cover is taken 0.3 s after it')
    p.add_argument('--out-dir')
    p.add_argument('--tile-width', type=int, default=390)
    a = p.parse_args(argv)
    video = Path(a.video).expanduser().resolve()
    if not video.is_file():
        raise CoverError('Video not found: %s' % video.name)
    length = duration(video)
    if a.cue:
        if not a.words:
            raise CoverError('--cue needs --words (the narration timings).')
        from cues import load_words, resolve, CueError
        try:
            t = resolve(load_words(a.words, a.offset), a.cue)[0] + 0.3
        except CueError as e:
            raise CoverError(str(e)) from None
    else:
        t = a.at if a.at is not None else 0.0
    if not 0 <= t < length:
        raise CoverError('%.2f s is outside the video (it is %.2f s long).' % (t, length))
    folder = Path(a.out_dir).expanduser().resolve() if a.out_dir else video.parent
    folder.mkdir(parents=True, exist_ok=True)
    cover = free_name(folder, video.stem + ' غلاف', '.jpg')
    tile = free_name(folder, video.stem + ' غلاف - شبكة', '.jpg')
    ff = tool('ffmpeg')
    r = subprocess.run([ff, '-v', 'error', '-ss', '%.3f' % t, '-i', str(video), '-frames:v', '1', '-q:v', '2', str(cover)],
                       capture_output=True, text=True, timeout=120)
    if r.returncode or not cover.is_file():
        raise CoverError('FFmpeg could not take the frame: %s' % (r.stderr.strip()[-300:] or 'unknown error'))
    # the profile grid shows a 3:4 crop from the middle of a 9:16 video
    r = subprocess.run([ff, '-v', 'error', '-i', str(cover), '-vf',
                        'crop=iw:iw*4/3:0:(ih-iw*4/3)/2,scale=%d:-2' % a.tile_width, '-q:v', '3', str(tile)],
                       capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise CoverError('FFmpeg could not make the grid tile: %s' % r.stderr.strip()[-300:])
    print(json.dumps({'cover': str(cover), 'grid_tile': str(tile), 'at_seconds': round(t, 3),
                      'next': 'Open the grid tile: the title must read at that size. Add the cover from the files '
                              'when posting; where an app only lets you pick a frame, pick this same second.'},
                     ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except CoverError as e:
        print('ERROR: ' + str(e), file=sys.stderr)
        sys.exit(1)
