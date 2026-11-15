#!/usr/bin/env python3
# يبني ملفات المشاهد من المصدر: compositions/world.html + مشاهد العناوين + index.html
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
DUR = 36.6
rig = (ROOT / 'tools/rig.js').read_text()
rig = re.sub(r"if \(typeof module.*\n?", "", rig)
world = (ROOT / 'tools/world.js').read_text()
FONT = "@font-face { font-family: 'Lalezar'; src: url('assets/fonts/lalezar-arabic-400-normal.woff2') format('woff2'); }"

(ROOT / 'compositions/world.html').write_text(f"""<template>
  <style>
    {FONT}
    #root {{ position: absolute; inset: 0; }}
    #world-canvas {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
    @keyframes world-grain-shift {{ 0%, 100% {{ background-position: 0 0; }} 20% {{ background-position: -60px 40px; }} 40% {{ background-position: 50px -70px; }} 60% {{ background-position: -30px -20px; }} 80% {{ background-position: 70px 60px; }} }}
    #world-grain {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; pointer-events: none; opacity: 0.07; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); animation: world-grain-shift 0.6s steps(5) {int(DUR / 0.6)} both; }}
  </style>
  <div id="root" data-composition-id="world" data-width="1080" data-height="1920">
    <canvas id="world-canvas" class="clip" data-start="0" data-duration="{DUR}" width="1080" height="1920"></canvas>
    <div id="world-grain" class="clip" data-start="0" data-duration="{DUR}" data-layout-ignore></div>
  </div>
  <script>
    (function () {{
{rig}
{world}
      const tl = gsap.timeline({{ paused: true }});
      const clock = {{ t: 0 }};
      const build = () => {{
        tl.fromTo(clock, {{ t: 0 }}, {{ t: {DUR}, duration: {DUR}, ease: "none", onUpdate: () => renderAt(clock.t) }}, 0);
        renderAt(0);
        window.__timelines["world"] = tl;
      }};
      document.fonts.load("60px Lalezar", "أنا").then(build, build);
    }})();
  </script>
</template>
""")

RED, BLUE, GREEN = '#D23A22', '#1F63C4', '#1E8A4C'
# (scene id, host start, host end, [(text html, start, end, top px, size, extra class)])
SCENES = [
 ('t-hook', 0, 3.5, [('هو وصل <b style="color:%s">لفوق</b>...' % BLUE, 0, 3.3, 640, 104, ''), ('وأنا لسه <b style="color:%s">هنا؟</b>' % RED, 0.9, 3.3, 780, 104, 'tilt')]),
 ('t-s2', 3.5, 8.0, [('أنا لسه عند <b style="color:%s">٤</b>...' % RED, 4.7, 6.45, 340, 104, ''), ('وهو عند <b style="color:%s">٩٧</b>!' % BLUE, 5.2, 6.45, 475, 104, 'tilt'), ('عمري ما هوصل', 6.6, 8.0, 360, 104, 'sad')]),
 ('t-s3', 8.0, 18.4, [('استنى... <b style="color:%s">بُص كويس</b>' % RED, 8.05, 9.4, 360, 104, ''), ('هو كمان <b style="color:%s">وقع كتير</b>' % BLUE, 9.85, 11.55, 340, 104, ''), ('وقعد <b style="color:%s">نفس قعدتك</b> دي' % BLUE, 12.6, 14.4, 340, 96, 'tilt'), ('وهو نفسه...', 15.8, 18.3, 590, 104, ''), ('لسه <b style="color:%s">باصص لفوق</b>' % '#6D3FE0', 16.6, 18.3, 725, 104, 'tilt')]),
 ('t-s4', 18.4, 24.4, [('وفيه حد تحت...', 20.0, 23.0, 340, 104, ''), ('شايفك إنت «<b style="color:%s">فوق</b>»' % GREEN, 21.5, 24.0, 475, 104, 'tilt')]),
 ('t-s5', 24.4, 31.5, [('متقارنش <b style="color:%s">أولك</b>' % RED, 25.2, 28.3, 340, 108, ''), ('بنُص <b style="color:%s">غيرك</b>' % BLUE, 25.9, 28.3, 480, 108, 'tilt'), ('قارن نفسك <b style="color:%s">بامبارح</b>' % RED, 29.0, 31.4, 360, 104, '')]),
 ('t-end', 31.5, 36.6, [('درجتك النهارده <b style="color:%s">كام؟</b>' % '#A8230F', 32.9, 36.6, 600, 96, ''), ('اكتبها في التعليقات', 33.9, 36.6, 770, 62, 'chip')]),
]
hosts = []
for z, (sid, a, b, lines) in enumerate(SCENES, start=2):
    els, tw = [], []
    for k, (html, s, e, top, size, cls) in enumerate(lines, start=1):
        ls, ld = round(s - a, 3), round(e - s, 3)
        els.append(f'    <div id="{sid}-l{k}" class="clip line {cls}" data-start="{ls}" data-duration="{ld}" data-track-index="{k}" style="top: {top}px; font-size: {size}px"><span id="{sid}-l{k}s" class="w">{html}</span></div>')
        rot = -2.5 if 'tilt' in cls else 0
        if ls <= 0.001:
            tw.append(f'      tl.fromTo("#{sid}-l{k}s", {{ scale: 1.08, opacity: 1 }}, {{ scale: 1, opacity: 1, duration: 0.6, ease: "power3.out" }}, 0);')
        else:
            tw.append(f'      tl.fromTo("#{sid}-l{k}s", {{ scale: 0.55, opacity: 0, rotation: {rot - 5} }}, {{ scale: 1, opacity: 1, rotation: {rot}, duration: 0.3, ease: "back.out(1.9)" }}, {ls});')
        if e < b - 0.01 or sid != 't-end':
            tw.append(f'      tl.to("#{sid}-l{k}s", {{ scale: 0.86, opacity: 0, duration: 0.14, ease: "power2.in" }}, {round(ls + ld - 0.17, 3)});')
    (ROOT / f'compositions/{sid}.html').write_text(f"""<template>
  <style>
    {FONT}
    #root {{ position: absolute; inset: 0; }}
    .line {{ position: absolute; left: 110px; width: 770px; text-align: center; direction: rtl; font-family: 'Lalezar'; line-height: 1.15; color: #1F1E24; -webkit-text-stroke: 20px #FFF8EA; paint-order: stroke fill; }}
    .line .w {{ display: inline-block; white-space: nowrap; }}
    .line b {{ font-weight: 400; }}
    .line.sad {{ color: #6B6B76; }}
    .line.chip {{ -webkit-text-stroke: 0; }}
    .line.chip .w {{ background: #FFF8EA; border: 5px solid #1F1E24; border-radius: 60px; padding: 14px 44px 8px; }}
  </style>
  <div id="root" data-composition-id="{sid}" data-width="1080" data-height="1920">
{chr(10).join(els)}
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tw)}
      window.__timelines["{sid}"] = tl;
    }})();
  </script>
</template>
""")
    hosts.append(f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{a}" data-duration="{round(b - a, 3)}" data-track-index="{z}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: {z}"></div>')

# الصوت: (id, file, start, duration, volume, media-start)
AUD = [
 ('music', 'assets/music/bed.mp3', 0, DUR, 0.75, 0),
 ('sfx-push', 'assets/sfx/whoosh-cinematic.mp3', 0.13, 4.6, 0.5, 0),
 ('sfx-pop4', 'assets/sfx/pop.mp3', 4.47, 0.7, 0.7, 0),
 ('sfx-up1', 'assets/sfx/whoosh.mp3', 8.95, 0.57, 0.6, 0),
 ('sfx-tag1', 'assets/sfx/pop.mp3', 9.72, 0.7, 0.55, 0),
 ('sfx-up2', 'assets/sfx/whoosh.mp3', 11.72, 0.57, 0.5, 0),
 ('sfx-tag2', 'assets/sfx/pop.mp3', 12.42, 0.7, 0.55, 0),
 ('sfx-up3', 'assets/sfx/whoosh.mp3', 14.62, 0.57, 0.6, 0),
 ('sfx-300', 'assets/sfx/pop.mp3', 16.52, 0.7, 0.6, 0),
 ('sfx-drop', 'assets/sfx/whoosh-cinematic.mp3', 18.2, 3.6, 0.55, 1.6),
 ('sfx-bubble', 'assets/sfx/pop.mp3', 21.38, 0.7, 0.55, 0),
 ('sfx-riser', 'assets/sfx/riser.mp3', 26.5, 2.0, 0.5, 1.47),
 ('sfx-impact', 'assets/sfx/impact-bass-1.mp3', 28.42, 2.1, 0.8, 0),
 ('sfx-sparkle', 'assets/sfx/sparkle.mp3', 28.5, 1.8, 0.6, 0),
 ('sfx-out', 'assets/sfx/whoosh.mp3', 32.2, 0.57, 0.5, 0),
]
auds = []
for k, (aid, f, s, d, v, ms) in enumerate(AUD):
    extra = f' data-media-start="{ms}"' if ms else ''
    fade = ' data-fade-in="0.3" data-fade-out="1.2"' if aid == 'music' else (' data-fade-out="0.5"' if d > 1.5 else '')
    auds.append(f'      <audio id="{aid}" class="clip" src="{f}" data-start="{s}" data-duration="{d}" data-track-index="{20 + k}" data-volume="{v}"{extra}{fade}></audio>')

(ROOT / 'index.html').write_text(f"""<!doctype html>
<html lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #BFE6F5; }}
      #root {{ position: relative; width: 1080px; height: 1920px; overflow: hidden; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <div id="world" data-composition-id="world" data-composition-src="compositions/world.html" data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 1"></div>
{chr(10).join(hosts)}
{chr(10).join(auds)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
""")
print('built', len(SCENES) + 1, 'scenes, duration', DUR)
