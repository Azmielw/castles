#!/usr/bin/env python3
# يبني ريل نبتة: compositions/*.html + index.html (شغّله بعد أي تعديل هون)
# الأرقام داخل JS بتنحط بـ $name (string.Template) عشان ما نضيع بين أقواس JS وبايثون
import pathlib, random, subprocess
from string import Template
ROOT = pathlib.Path(__file__).resolve().parent.parent
random.seed(7)  # بذرة ثابتة: النجوم والمسارات بتطلع نفسها كل مرة

def vo_len(i):
    f = ROOT / f"assets/vo/vo{i:02d}.wav"
    if not f.exists():  # قبل ما يجهز التسجيل: مدد تقريبية للمعاينة
        return [3.4, 3.4, 2.0, 2.4, 2.4, 1.8, 4.6, 4.4, 4.6, 8.0][i - 1]
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]))
VO = [vo_len(i) for i in range(1, 11)]
beat = lambda i, lo: round(max(lo, VO[i - 1] + 0.35), 2)

AR = "U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F"
LA = "U+0000-05FF,U+2010-2027,U+2605"
def face(fam, slug, w):
    return "".join(f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('assets/fonts/{slug}-{sub}-{w}-normal.woff2') format('woff2');unicode-range:{rng}}}"
                   for sub, rng in (("arabic", AR), ("latin", LA)))
FONT = face("Baloo", "baloo-bhaijaan-2", 600) + face("Baloo", "baloo-bhaijaan-2", 800) + face("Readex Pro", "readex-pro", 400) + face("Readex Pro", "readex-pro", 700)
INK, SKY, YEL, MINT, PUR, PINK = "#2A2340", "#7FD3FF", "#FFD23F", "#4FD1A5", "#8E5CF6", "#FF7BAC"
BASE = FONT + f"""
#root{{position:absolute;inset:0;overflow:hidden;direction:rtl;font-family:'Baloo'}}
.bg{{position:absolute;inset:0}}
.cap{{position:absolute;left:60px;width:960px;text-align:center;line-height:1.15}}
.in{{display:inline-block;white-space:nowrap}}
.cap .in{{line-height:1.3 !important}}
.k1{{font:600 62px 'Baloo';color:{INK};opacity:.75}}
.k2{{font:800 104px 'Baloo';color:{INK}}}
.pill{{display:inline-block;white-space:nowrap;border-radius:999px;padding:6px 44px}}
"""
STAR = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"

def char(p, w, h=None):
    """الشخصية: نبتة صغيرة مدوّرة (رسم تمثيلي، مش من اللعبة)."""
    h = h or round(w * 140 / 120)
    return f'''<svg id="{p}" viewBox="0 0 120 140" width="{w}" height="{h}" style="overflow:visible">
  <g id="{p}-hat" opacity="0"><path d="M30 34 C34 8 86 8 90 34Z" fill="{PUR}"/><rect x="22" y="30" width="76" height="9" rx="4.5" fill="#6A3FE0"/><circle cx="60" cy="9" r="6" fill="{YEL}"/></g>
  <rect id="{p}-lg1" x="40" y="104" width="14" height="30" rx="7" fill="#2f9e7a"/>
  <rect id="{p}-lg2" x="66" y="104" width="14" height="30" rx="7" fill="#2f9e7a"/>
  <path d="M60 30 C60 20 58 14 60 6" stroke="#3a9a4a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M60 16 C46 14 38 4 40 -6 C54 -4 60 6 60 16Z" fill="#55b85c"/><path d="M60 12 C72 8 80 -2 78 -12 C66 -8 60 2 60 12Z" fill="#6fd06f"/>
  <circle cx="60" cy="72" r="44" fill="{MINT}"/><ellipse cx="60" cy="86" rx="26" ry="20" fill="#9eeccf"/>
  <circle cx="45" cy="64" r="7" fill="{INK}"/><circle cx="75" cy="64" r="7" fill="{INK}"/><circle cx="47" cy="62" r="2.4" fill="#fff"/><circle cx="77" cy="62" r="2.4" fill="#fff"/>
  <circle cx="36" cy="78" r="6" fill="{PINK}" opacity=".55"/><circle cx="84" cy="78" r="6" fill="{PINK}" opacity=".55"/>
  <path d="M50 80 Q60 90 70 80" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <g id="{p}-gl" opacity="0"><circle cx="45" cy="64" r="12" fill="none" stroke="{INK}" stroke-width="4"/><circle cx="75" cy="64" r="12" fill="none" stroke="{INK}" stroke-width="4"/><path d="M57 64h6" stroke="{INK}" stroke-width="4"/></g>
</svg>'''

def star(i, x, y, s, color=YEL):
    return f'<svg id="{i}" viewBox="0 0 24 24" width="{s}" height="{s}" style="position:absolute;left:{x}px;top:{y}px;overflow:visible"><path d="{STAR}" fill="{color}" stroke="#E8A800" stroke-width="1.2" stroke-linejoin="round"/></svg>'

def clip(i, s, d, cls, style, inner):
    return f'<div id="{i}" class="clip {cls}" data-start="{round(s, 3)}" data-duration="{round(d, 3)}" style="{style}">{inner}</div>'

def write(cid, css, html, js, **v):
    (ROOT / f"compositions/{cid}.html").write_text(f"""<template>
<style>{BASE}{css}</style>
<div id="root" data-composition-id="{cid}" data-width="1080" data-height="1920">
{html}
</div>
<script>
(function () {{
const tl = gsap.timeline({{ paused: true }});
const pop = (s, t, o = {{}}) => tl.fromTo(s, {{ opacity: 0, y: o.y ?? 70, scale: o.s ?? 0.8 }}, {{ opacity: 1, y: 0, scale: 1, duration: o.d ?? 0.42, ease: o.e ?? "back.out(1.7)" }}, t);
const bye = (s, t) => tl.to(s, {{ opacity: 0, y: -50, scale: 0.94, duration: 0.2, ease: "power2.in" }}, t);
{Template(js).substitute(**v)}
window.__timelines["{cid}"] = tl;
}})();
</script>
</template>
""")

def caps(prefix, rows):
    """سطرين فوق كل لقطة: (بداية، نهاية، صغير، كبير، لون الكبير)."""
    h, j = "", ""
    for i, (a, b, l1, l2, col) in enumerate(rows, start=1):
        h += clip(f"{prefix}{i}", a, b - a, "cap", "top:300px", f'<span id="{prefix}{i}a" class="in k1">{l1}</span><br><span id="{prefix}{i}b" class="in k2" style="color:{col}">{l2}</span>')
        j += f'pop("#{prefix}{i}a",{a},{{y:40,d:0.3}});pop("#{prefix}{i}b",{round(a + 0.12, 2)},{{s:0.6}});'
        if b < rows[-1][1] or i < len(rows):
            j += f'bye("#{prefix}{i}a",{round(b - 0.2, 2)});bye("#{prefix}{i}b",{round(b - 0.2, 2)});'
    return h, j

SKYBG = f"background:linear-gradient(180deg,{SKY} 0%,#BDEBFF 55%,#E9F8FF 100%)"
CLOUDS = "".join(f'<div id="cl{i}" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{round(w * .42)}px;border-radius:999px;background:#fff;opacity:.8;box-shadow:{round(w * .3)}px {round(w * .08)}px 0 -{round(w * .06)}px #fff,-{round(w * .28)}px {round(w * .1)}px 0 -{round(w * .1)}px #fff"></div>'
                 for i, (x, y, w) in enumerate([(70, 200, 150), (820, 330, 130), (120, 1480, 170), (800, 1600, 150)]))

# ───────── 1) الهوك: ماسك الجوال طول اليوم؟ ─────────
D1 = beat(1, 3.8)
T1b = round(min(D1 - 1.4, 1.9), 2)
write("hook", f"""
.bg{{{SKYBG}}}
#h-ph{{position:absolute;left:370px;top:590px;width:340px;height:520px;border:14px solid {INK};border-radius:56px;overflow:hidden;background:#1d1b2b;box-shadow:0 40px 70px -30px rgba(42,35,64,.6)}}
#h-tv{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}}
#h-play{{width:150px;height:110px;border-radius:30px;background:#ff3b3b;display:grid;place-items:center}}
#h-lbl{{font:600 34px 'Baloo';color:#b9b6cc}}
#h-cnt{{font:800 120px 'Baloo';color:#fff;direction:ltr;line-height:1}}
#h-game{{position:absolute;inset:0;{SKYBG};display:grid;place-items:center}}
#h-l3{{top:1132px}}
#h-l3i{{font:800 70px 'Baloo';color:{INK};background:{YEL};box-shadow:0 18px 30px -16px rgba(42,35,64,.5)}}
""", f"""
<div class="bg"></div>{CLOUDS}
{clip("h-l1", 0, D1, "cap", "top:300px", '<span id="h-l1i" class="in k1" style="font-size:76px;opacity:1">طفلك ماسك الجوال</span><br><span id="h-l2i" class="in k2" style="font-size:116px;color:#C2185B">طول اليوم؟</span>')}
<div id="h-ph" class="clip" data-start="0" data-duration="{D1}">
  <div id="h-tv"><div id="h-play"><svg viewBox="0 0 24 24" width="60" height="60"><path d="M8 5v14l11-7z" fill="#fff"/></svg></div><span id="h-lbl">وقت الشاشة اليوم</span><span id="h-cnt">0:00</span></div>
  <div id="h-game">{char("h-ch", 200)}</div>
</div>
{clip("h-l3", T1b, D1 - T1b, "cap", "", '<span id="h-l3i" class="in pill">خلّيه يتعلّم وهو بيلعب!</span>')}
""", """
tl.fromTo("#h-l1i", { scale: 1.12 }, { scale: 1, duration: 0.6, ease: "power3.out" }, 0);
pop("#h-l2i", 0.35, { s: 0.5, d: 0.45 });
tl.fromTo("#h-ph", { y: 60, rotation: -4 }, { y: 0, rotation: 0, duration: 0.6, ease: "power3.out" }, 0);
const cnt = { m: 0 }, el = document.getElementById("h-cnt");
tl.fromTo(cnt, { m: 0 }, { m: 270, duration: $Tb - 0.2, ease: "power1.in", onUpdate: () => { const m = Math.round(cnt.m); el.textContent = Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); } }, 0.1);
tl.to("#h-cnt", { color: "#ff5c5c", duration: 0.3 }, $Tb - 0.6);
tl.fromTo("#h-ph", { x: 0 }, { x: 10, duration: 0.05, repeat: 5, yoyo: true }, $Tb - 0.45);
tl.set("#h-game", { opacity: 0 }, 0); tl.set("#h-game", { opacity: 1 }, $Tb); tl.set("#h-tv", { opacity: 0 }, $Tb + 0.45);
tl.fromTo("#h-game", { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)", duration: 0.45, ease: "power2.inOut" }, $Tb);
tl.fromTo("#h-ch", { scale: 0.3, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2)", transformOrigin: "50% 90%" }, $Tb + 0.2);
tl.fromTo("#h-ch", { y: 0 }, { y: -26, duration: 0.22, repeat: 3, yoyo: true, ease: "power1.out" }, $Tb + 0.75);
pop("#h-l3i", $Tb, { s: 0.55, d: 0.45 });
""", Tb=T1b)

# ───────── 2) الديمو: جوال فيه اللعبة ─────────
T_RUN = beat(2, 3.0)
T_BLOCK = round(T_RUN + beat(3, 2.6), 2)
T_SAY = round(T_BLOCK + beat(4, 2.4), 2)
T_BURST = round(T_SAY + beat(5, 2.4), 2)
D2 = round(T_BURST + beat(6, 2.3), 2)
LANES = [97, 224, 351]          # مراكز المسارات الثلاثة جوّا شاشة الجوال
CHAR_Y, CHAR_W = 600, 116
STARS, lane, t = [], 1, T_RUN - 0.6   # (وقت الوصول للشخصية، المسار)
while t < T_BLOCK - 0.3:
    lane = random.choice([l for l in range(3) if l != lane]) if random.random() < 0.6 else lane
    STARS.append((round(t, 2), lane)); t += random.uniform(0.3, 0.42)
FALL = 1.1
stars_html = "".join(star(f"g-s{i}", LANES[l] - 28, -70, 56) for i, (_, l) in enumerate(STARS))
stars_js = "".join(
    f'tl.fromTo("#g-s{i}",{{y:0}},{{y:{CHAR_Y + 70},duration:{FALL},ease:"none"}},{round(a - FALL, 2)});'
    f'tl.to("#g-s{i}",{{scale:1.8,opacity:0,duration:0.14,transformOrigin:"50% 50%"}},{a});'
    f'tl.to("#g-ch",{{x:{LANES[l] - LANES[1]},duration:0.18,ease:"power2.out"}},{round(a - 0.32, 2)});'
    for i, (a, l) in enumerate(STARS))
SC0 = 12
BURST = "".join(star(f"g-b{i}", 196, 282, 56) for i in range(14))
burst_js = "".join(
    f'tl.fromTo("#g-b{i}",{{x:0,y:0,scale:0.4,opacity:1,rotation:0}},{{x:{round(190 * __import__("math").cos(i * 0.4488))},y:{round(190 * __import__("math").sin(i * 0.4488))},scale:1.1,rotation:{random.randint(-160, 160)},duration:0.7,ease:"power3.out"}},{round(T_BURST + 0.12, 2)});'
    f'tl.to("#g-b{i}",{{opacity:0,duration:0.3}},{round(T_BURST + 0.6, 2)});'
    for i in range(14))
c_html, c_js = caps("g-c", [
    (T_RUN, T_BLOCK, "طفلك بيركض", "وبيجمع نجوم", "#E8A800"),
    (T_BLOCK, T_SAY, "وفجأة…", "حرف بيسدّ الطريق!", "#6A3FE0"),
    (T_SAY, T_BURST, "بيقول الكلمة", "بصوته", "#E8466A"),
    (T_BURST, D2, "والحرف", "بينفجر نجوم!", "#E8A800"),
])
write("demo", f"""
.bg{{{SKYBG}}}
#g-c0{{top:300px}}
#g-c0 .in{{line-height:1.3 !important}}
#g-ph{{position:absolute;left:302px;top:600px;width:476px;height:878px;transform:scale(1.1);transform-origin:50% 0}}
#g-phi{{position:absolute;inset:0;border:14px solid {INK};border-radius:66px;overflow:hidden;background:#6BCB77;box-shadow:0 50px 90px -30px rgba(42,35,64,.55)}}
#g-sky{{position:absolute;left:0;top:0;width:448px;height:170px;{SKYBG}}}
#g-road{{position:absolute;left:34px;top:150px;width:380px;height:720px;background:#F6DFAE;border-left:8px solid #e9c98a;border-right:8px solid #e9c98a}}
.ln{{position:absolute;top:150px;width:10px;height:720px;background:repeating-linear-gradient(180deg,#fff 0 46px,transparent 46px 92px);opacity:.9}}
#g-hud{{position:absolute;right:16px;top:16px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.92);border-radius:999px;padding:2px 18px 2px 12px;font:800 34px 'Baloo';color:{INK};direction:ltr}}
#g-ch{{position:absolute;left:{LANES[1] - CHAR_W // 2}px;top:{CHAR_Y}px}}
#g-tile{{position:absolute;left:104px;top:186px;width:240px;height:240px;border-radius:44px;background:{YEL};border:8px solid #E8A800;display:grid;place-items:center;font:800 160px 'Baloo';color:{INK};line-height:1.25;box-shadow:0 22px 0 -6px rgba(0,0,0,.12)}}
#g-word{{position:absolute;left:124px;top:442px;width:200px;text-align:center;font:800 50px 'Baloo';color:#fff;background:{PUR};border-radius:999px;padding:2px 0}}
#g-bub{{position:absolute;left:206px;top:520px;display:flex;align-items:center;gap:10px;background:#fff;border-radius:30px;padding:4px 22px 4px 14px;font:800 46px 'Baloo';color:#E8466A;box-shadow:0 10px 24px -12px rgba(0,0,0,.4)}}
#g-mic{{width:52px;height:52px;border-radius:50%;background:#E8466A;display:grid;place-items:center}}
#g-ring{{position:absolute;left:150px;top:470px;width:150px;height:150px;border-radius:50%;border:6px solid #E8466A;opacity:0}}
""", f"""
<div class="bg"></div>{CLOUDS}
{clip("g-c0", 0, T_RUN, "cap", "", f'<span id="g-k" class="in k1" style="font-size:54px">لعبة الحروف للأطفال</span><br><span id="g-t" class="in k2" style="font-size:124px;color:#2f9e7a">هاي نَبتة</span><br><span id="g-a" class="in pill" style="font:800 44px Baloo;background:{YEL};color:{INK};padding:0 40px">من ٤ لـ ٩ سنين</span>')}
{c_html}
<div id="g-ph" class="clip" data-start="0" data-duration="{D2}"><div id="g-phi" data-layout-allow-overflow>
  <div id="g-sky"></div><div id="g-road"></div>
  <div id="g-ln1" class="ln" style="left:156px"></div><div id="g-ln2" class="ln" style="left:282px"></div>
  {stars_html}
  <div id="g-tile">أ</div><div id="g-word">أَرْنَب</div>
  <div id="g-ring"></div>
  <div id="g-bub"><span id="g-mic"><svg viewBox="0 0 24 24" width="30" height="30"><rect x="8" y="2" width="8" height="13" rx="4" fill="#fff"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg></span>أرنب!</div>
  {char("g-ch", CHAR_W)}
  {BURST}
  <div id="g-hud"><svg viewBox="0 0 24 24" width="34" height="34"><path d="{STAR}" fill="{YEL}" stroke="#E8A800" stroke-width="1.4"/></svg><span id="g-sc">{SC0}</span></div>
</div></div>
""", Template("""
tl.set(["#g-tile", "#g-word", "#g-bub", "#g-b0", "#g-b1", "#g-b2", "#g-b3", "#g-b4", "#g-b5", "#g-b6", "#g-b7", "#g-b8", "#g-b9", "#g-b10", "#g-b11", "#g-b12", "#g-b13"], { opacity: 0 }, 0);
pop("#g-k", 0.05, { y: 30, d: 0.3 }); pop("#g-t", 0.25, { s: 0.5, d: 0.5 }); pop("#g-a", 0.6, { s: 0.6 });
["#g-k", "#g-t", "#g-a"].forEach(s => bye(s, $T_RUN - 0.2));
tl.fromTo("#g-phi", { y: 1000, rotation: 7 }, { y: 0, rotation: 0, duration: 0.9, ease: "power3.out" }, 0.4);
CAPS_JS
// الطريق بيتحرك لحد ما يوقف الحرف، وبيرجع يمشي بعد الانفجار
const road = (a, b) => ["#g-ln1", "#g-ln2"].forEach(s => tl.fromTo(s, { backgroundPositionY: 0 }, { backgroundPositionY: Math.round((b - a) * 560), duration: b - a, ease: "none" }, a));
road(0.9, $T_BLOCK + 0.7); road($T_BURST + 0.45, $D2);
STARS_JS
// العدّاد والرجلين: دالة واحدة لوقت المشهد، عشان أي لقطة ترجع نفس الشكل
const ARR = ARRIVALS, sc = document.getElementById("g-sc"), l1 = document.getElementById("g-ch-lg1"), l2 = document.getElementById("g-ch-lg2");
const running = t => (t > 0.9 && t < $T_BLOCK + 0.7) || t > $T_BURST + 0.45;
const clock = { t: 0 };
tl.fromTo(clock, { t: 0 }, { t: $D2, duration: $D2, ease: "none", onUpdate: () => {
  const t = clock.t; let n = $SC0; for (const a of ARR) if (t >= a) n++; if (t >= $T_BURST + 0.15) n += 10;
  sc.textContent = n;
  const k = running(t) ? Math.sin(t * 19) * 7 : 0;
  l1.setAttribute("y", 104 + k); l2.setAttribute("y", 104 - k);
} }, 0);
tl.fromTo("#g-tile", { opacity: 0, y: -380, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: "bounce.out" }, $T_BLOCK + 0.05);
tl.fromTo("#g-word", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, $T_BLOCK + 0.65);
tl.to("#g-ch", { x: 0, duration: 0.25, ease: "power2.out" }, $T_BLOCK + 0.2);
tl.fromTo("#g-tile", { rotation: 0 }, { rotation: 4, duration: 0.07, repeat: 5, yoyo: true }, $T_BLOCK + 0.75);
tl.fromTo("#g-bub", { opacity: 0, scale: 0.3, transformOrigin: "20% 100%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.2)" }, $T_SAY + 0.3);
[0.35, 0.95, 1.55].forEach(d => tl.fromTo("#g-ring", { scale: 0.5, opacity: 0.9 }, { scale: 2.1, opacity: 0, duration: 0.6, ease: "power2.out", immediateRender: false }, $T_SAY + d));
tl.fromTo("#g-mic", { scale: 1 }, { scale: 1.18, duration: 0.18, repeat: 5, yoyo: true }, $T_SAY + 0.45);
tl.to("#g-bub", { opacity: 0, y: -20, duration: 0.2 }, $T_BURST - 0.05);
tl.to("#g-tile", { scale: 1.35, opacity: 0, duration: 0.25, ease: "power2.in" }, $T_BURST + 0.05);
tl.to("#g-word", { scale: 0.5, opacity: 0, duration: 0.2 }, $T_BURST + 0.05);
BURST_JS
tl.fromTo("#g-ch", { y: 0 }, { y: -90, duration: 0.28, yoyo: true, repeat: 1, ease: "power2.out" }, $T_BURST + 0.15);
tl.fromTo("#g-hud", { scale: 1 }, { scale: 1.35, duration: 0.15, yoyo: true, repeat: 1, transformOrigin: "100% 0%" }, $T_BURST + 0.15);
""").safe_substitute().replace("CAPS_JS", c_js).replace("STARS_JS", stars_js).replace("BURST_JS", burst_js).replace("ARRIVALS", str([a for a, _ in STARS])),
      T_RUN=T_RUN, T_BLOCK=T_BLOCK, T_SAY=T_SAY, T_BURST=T_BURST, D2=D2, SC0=SC0)

# ───────── 3) شو بيتعلّم + الملابس ─────────
D3 = beat(7, 4.6)
T3b = round(D3 * 0.45, 2)
GROUPS = [("أ ب ت", "العربية ٢٨", MINT, "rtl"), ("A B C", "English 26", SKY, "ltr"), ("ق ـ ة", "التهجئة", PUR, "rtl")]
tiles, tj, n = "", "", 0
for gi, (letters, lbl, col, d) in enumerate(GROUPS):
    x0 = 135 + (2 - gi) * 290
    for k, ch in enumerate(letters.split()):
        tiles += f'<div id="f-t{n}" class="tl" style="left:{x0 + k * 86}px;background:{col};color:{"#fff" if col == PUR else INK}">{ch}</div>'
        tj += f'tl.fromTo("#f-t{n}",{{opacity:0,y:-160,rotation:{random.randint(-25, 25)}}},{{opacity:1,y:0,rotation:0,duration:0.45,ease:"bounce.out"}},{round(0.35 + 0.09 * n, 2)});'
        n += 1
    tiles += f'<div id="f-g{gi}" class="gl" style="left:{x0 - 10}px;direction:{d}">{lbl}</div>'
    tj += f'pop("#f-g{gi}",{round(0.75 + 0.25 * gi, 2)},{{y:20,s:0.7,d:0.3}});'
write("learn", f"""
.bg{{background:linear-gradient(180deg,#F3EEFF 0%,#E9F8FF 100%)}}
#f-l1{{top:300px}}
.tl{{position:absolute;top:448px;width:78px;height:78px;border-radius:20px;display:grid;place-items:center;font:800 48px 'Baloo';line-height:1.3;color:{INK};box-shadow:0 8px 0 -2px rgba(0,0,0,.14)}}
.gl{{position:absolute;top:540px;width:270px;text-align:center;font:800 40px 'Baloo';color:{INK}}}
#f-l2{{top:640px}}
#f-ch{{position:absolute;left:380px;top:790px}}
#f-cost{{position:absolute;left:640px;top:800px;font:800 54px 'Baloo';color:#E8A800;direction:ltr;background:#fff;border-radius:999px;padding:2px 26px;box-shadow:0 10px 20px -12px rgba(0,0,0,.35)}}
#f-row{{position:absolute;left:0;top:1176px;width:1080px;display:flex;justify-content:center;gap:18px}}
.it{{font:800 40px 'Baloo';color:{INK};background:#fff;border:4px solid {YEL};border-radius:999px;padding:0 30px}}
""", f"""
<div class="bg"></div>
{clip("f-l1", 0, D3, "cap", "", f'<span id="f-l1i" class="in k2" style="font-size:96px">عربي · إنجليزي · تهجئة</span>')}
{tiles}
{clip("f-l2", T3b, D3 - T3b, "cap", "", f'<span id="f-l2a" class="in k1" style="font-size:66px;opacity:1">وبنجومه بيشتري</span><span id="f-l2b" class="in k2" style="font-size:96px;color:{PUR}"> ملابس</span>')}
<div id="f-chw" class="clip" data-start="0" data-duration="{D3}" style="position:absolute;inset:0">{char("f-ch", 320)}<div id="f-cost">-30 ★</div>
<div id="f-row"><span id="f-i0" class="it">قبعات</span><span id="f-i1" class="it">نظارات</span><span id="f-i2" class="it">أكثر من 50 قطعة</span></div></div>
""", Template("""
pop("#f-l1i", 0.05, { s: 0.6, d: 0.45 });
TILES_JS
pop("#f-l2a", $Tb, { y: 40, d: 0.3 }); pop("#f-l2b", $Tb + 0.15, { s: 0.5, d: 0.45 });
tl.fromTo("#f-ch", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)", transformOrigin: "50% 90%" }, 0.5);
tl.fromTo("#f-ch-hat", { opacity: 0, y: -170 }, { opacity: 1, y: 0, duration: 0.5, ease: "bounce.out" }, $Tb + 0.35);
tl.fromTo("#f-ch-gl", { opacity: 0, scale: 2.2, svgOrigin: "60 64" }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, $Tb + 0.95);
tl.fromTo("#f-cost", { opacity: 0, y: 30 }, { opacity: 1, y: -30, duration: 0.45, ease: "power2.out" }, $Tb + 0.4);
tl.to("#f-cost", { opacity: 0, y: -80, duration: 0.3 }, $Tb + 1.5);
[0, 1, 2].forEach(i => pop("#f-i" + i, $Tb + 0.7 + 0.15 * i, { y: 30, s: 0.6, d: 0.3 }));
""").safe_substitute(Tb=T3b).replace("TILES_JS", tj))

# ───────── 4) للأم: تقرير + بدون إعلانات ─────────
D4 = beat(8, 4.4)
T4b = round(D4 * 0.55, 2)
ROWS = [("أ", 0.95, MINT, "ممتاز"), ("ب", 0.82, MINT, "ممتاز"), ("ث", 0.34, "#FF9F43", "بدها تدريب"), ("ج", 0.7, MINT, "منيح")]
rows_html = "".join(f'<div class="rw" style="top:{120 + 96 * i}px"><b>{ch}</b><div class="tr"><i id="p-bar{i}" style="background:{col};width:{round(p * 100)}%"></i></div><span style="color:{"#E8701A" if p < .5 else "#2f9e7a"}">{lab}</span></div>' for i, (ch, p, col, lab) in enumerate(ROWS))
write("parents", f"""
.bg{{background:linear-gradient(180deg,#E3FAF2 0%,#F4FFFB 100%)}}
#p-l1{{top:300px}}
#p-card{{position:absolute;left:150px;top:556px;width:780px;height:520px;background:#fff;border-radius:44px;box-shadow:0 40px 70px -40px rgba(42,35,64,.5);border:3px solid #d8f3e9}}
#p-hd{{position:absolute;right:44px;top:30px;font:800 50px 'Baloo';color:{INK}}}
#p-hd small{{font:600 34px 'Baloo';color:#8a86a0;margin-right:12px}}
.rw{{position:absolute;right:44px;left:44px;height:80px;display:flex;align-items:center;gap:20px}}
.rw b{{width:70px;height:70px;border-radius:18px;background:#F3EEFF;display:grid;place-items:center;font:800 46px 'Baloo';color:{PUR}}}
.tr{{flex:1;height:24px;border-radius:12px;background:#eef1f6;overflow:hidden;direction:rtl}}
.tr i{{display:block;height:100%;border-radius:12px}}
.rw span{{width:210px;font:800 36px 'Baloo';text-align:left}}
#p-row{{position:absolute;left:0;top:1106px;width:1080px;display:flex;flex-wrap:wrap;justify-content:center;gap:16px 18px;padding:0 110px}}
.bd{{font:800 44px 'Baloo';color:{INK};background:#fff;border:4px solid {MINT};border-radius:999px;padding:0 34px}}
""", f"""
<div class="bg"></div>
{clip("p-l1", 0, D4, "cap", "", f'<span id="p-l1a" class="in k1">وإلِك…</span><br><span id="p-l1b" class="in k2" style="color:#2f9e7a">تقرير بالحروف</span>')}
<div id="p-card" class="clip" data-start="0" data-duration="{D4}"><div id="p-hd">تقرير ليان<small>(مثال)</small></div>{rows_html}</div>
<div id="p-roww" class="clip" data-start="{T4b}" data-duration="{round(D4 - T4b, 3)}" style="position:absolute;inset:0"><div id="p-row"><span id="p-b0" class="bd">بدون ولا إعلان</span><span id="p-b1" class="bd">بدون اشتراك</span><span id="p-b2" class="bd">بتشتغل بدون إنترنت</span></div></div>
""", Template("""
pop("#p-l1a", 0.05, { y: 30, d: 0.3 }); pop("#p-l1b", 0.2, { s: 0.6, d: 0.45 });
tl.fromTo("#p-card", { opacity: 0, y: 160, rotation: 4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.55, ease: "back.out(1.5)" }, 0.25);
[0, 1, 2, 3].forEach(i => tl.fromTo("#p-bar" + i, { scaleX: 0, transformOrigin: "100% 50%" }, { scaleX: 1, duration: 0.55, ease: "power2.out" }, 0.75 + 0.18 * i));
tl.fromTo("#p-bar2", { opacity: 1 }, { opacity: 0.35, duration: 0.2, repeat: 3, yoyo: true }, 1.7);
[0, 1, 2].forEach(i => pop("#p-b" + i, $Tb + 0.15 * i, { y: 30, s: 0.6, d: 0.3 }));
""").safe_substitute(Tb=T4b))

# ───────── 5) العرض: جرّبيها ببلاش، والكاملة 10$ ─────────
D5 = beat(9, 4.6)
T5b = round(D5 * 0.42, 2)
write("offer", f"""
.bg{{background:radial-gradient(1000px 1000px at 50% 34%,#7C4DFF 0%,#5B33C9 45%,#3A1E8C 100%)}}
#o-l1{{top:296px;font:800 92px 'Baloo';color:#fff}}
#o-l2{{top:410px;font:800 190px 'Baloo';color:{YEL};line-height:1.15}}
#o-l3{{top:650px;font:800 72px 'Baloo';color:#fff}}
#o-l4{{top:735px;font:800 200px 'Baloo';color:{YEL};direction:ltr;line-height:1.1}}
#o-l5{{top:990px}}#o-l5i{{font:800 48px 'Baloo';color:#fff;border:4px solid {YEL}}}
#o-l6{{top:1084px}}#o-l6i{{font:800 70px 'Baloo';color:{INK};background:{YEL};box-shadow:0 20px 34px -16px rgba(0,0,0,.55)}}
#o-l7{{top:1196px;font:700 38px 'Readex Pro';color:#fff;direction:ltr}}
""", f"""
<div class="bg"></div>
{"".join(star(f"o-s{i}", x, y, s, "#ffe680") for i, (x, y, s) in enumerate([(70, 300, 70), (930, 420, 56), (110, 900, 50), (900, 1050, 76), (520, 1440, 60), (200, 1600, 46), (820, 1700, 54)]))}
{clip("o-l1", 0, D5, "cap", "", '<span id="o-l1i" class="in">جرّبيها</span>')}
{clip("o-l2", 0.3, D5 - 0.3, "cap", "", '<span id="o-l2i" class="in">ببلاش!</span>')}
{clip("o-l3", T5b, D5 - T5b, "cap", "", '<span id="o-l3i" class="in">والنسخة الكاملة</span>')}
{clip("o-l4", T5b + 0.3, D5 - T5b - 0.3, "cap", "", '<span id="o-l4i" class="in">10$</span>')}
{clip("o-l5", T5b + 0.8, D5 - T5b - 0.8, "cap", "", '<span id="o-l5i" class="in pill">مرة وحدة بس · مدى الحياة</span>')}
{clip("o-l6", T5b + 1.2, D5 - T5b - 1.2, "cap", "", '<span id="o-l6i" class="in pill">جرّبيها هلأ</span>')}
{clip("o-l7", T5b + 1.5, D5 - T5b - 1.5, "cap", "", '<span id="o-l7i" class="in">nabta.nawahcore.org</span>')}
""", Template("""
[0, 1, 2, 3, 4, 5, 6].forEach(i => tl.fromTo("#o-s" + i, { rotation: 0, scale: 0.85 }, { rotation: 40, scale: 1.1, duration: $D, ease: "sine.inOut", transformOrigin: "50% 50%" }, 0));
pop("#o-l1i", 0.05, { y: 40, d: 0.3 });
tl.fromTo("#o-l2i", { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power4.in" }, 0.3);
pop("#o-l3i", $Tb, { y: 40, d: 0.3 });
tl.fromTo("#o-l4i", { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power4.in" }, $Tb + 0.3);
pop("#o-l5i", $Tb + 0.8, { s: 0.6 }); pop("#o-l6i", $Tb + 1.2, { s: 0.5, d: 0.5 }); pop("#o-l7i", $Tb + 1.5, { y: 30, d: 0.3 });
tl.to("#o-l6i", { scale: 1.07, duration: 0.25, yoyo: true, repeat: 1, ease: "sine.inOut" }, $Tb + 1.9);
""").safe_substitute(Tb=T5b, D=D5))

# ───────── 6) الخاتمة: مشروع من نواة… عندك فكرة؟ (نفس خاتمة ريل نبضة) ─────────
D6 = beat(10, 5.6)
write("nawah", """
#root{font-family:'Readex Pro'}
.bg{background:radial-gradient(1000px 1000px at 50% 30%,#0f7a4c 0%,#095534 52%,#053520 100%)}
#n-l1{top:276px;font:400 58px 'Readex Pro';color:#c9dccf}
#n-l1 b{font-weight:700;color:#FAF6F1}
#n-logo{position:absolute;left:140px;top:366px;width:800px;height:340px}
#n-lg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:34px}
#n-wm{text-align:center;line-height:1}
#n-wm b{display:block;font:700 220px 'Readex Pro';color:#FAF6F1}
#n-wm small{display:block;font:700 40px 'Readex Pro';letter-spacing:20px;color:#E3C067;margin-top:14px;direction:ltr}
#n-l2{top:716px;font:700 150px 'Readex Pro';color:#FAF6F1}
#n-l2 b{color:#E3C067}
#n-l3{top:900px;font:700 104px 'Readex Pro';color:#E3C067}
#n-l4{top:1040px;font:400 50px 'Readex Pro';color:#dbe8df;line-height:1.5}
#n-l5{top:1138px}
#n-l5i{font:700 60px 'Readex Pro';color:#063d26;background:#CE9F26;border-radius:999px;padding:12px 64px;direction:ltr}
""", f"""
<div class="bg"></div>
{clip("n-l1", 0, D6, "cap", "", '<span id="n-l1i" class="in"><b>نَبتة</b> · مشروع من</span>')}
<div id="n-logo" class="clip" data-start="0" data-duration="{D6}"><div id="n-lg">
  <div id="n-wm"><b>نَواة</b><small>NAWAH</small></div>
  <svg id="n-sp" viewBox="0 0 120 170" width="210" height="298">
    <ellipse cx="60" cy="140" rx="34" ry="24" fill="#CE9F26"/>
    <path id="n-st" d="M60 128 C60 100 56 80 60 54" stroke="#55A030" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path id="n-lf1" d="M60 84 C34 78 18 56 20 34 C46 38 60 58 60 84Z" fill="#55A030"/>
    <path id="n-lf2" d="M60 62 C84 54 100 34 98 12 C74 18 60 38 60 62Z" fill="#6dbb3f"/>
  </svg>
</div></div>
{clip("n-l2", 1.6, D6 - 1.6, "cap", "", '<span id="n-l2i" class="in">عندك <b>فكرة؟</b></span>')}
{clip("n-l3", 2.5, D6 - 2.5, "cap", "", '<span id="n-l3i" class="in">قدّمها بنواة</span>')}
{clip("n-l4", 3.3, D6 - 3.3, "cap", "", '<span id="n-l4i" class="in">احنا منبنيها… وإلك نسبة من إيراداتها</span>')}
{clip("n-l5", 4.0, D6 - 4.0, "cap", "", '<span id="n-l5i" class="in">nawahcore.org</span>')}
""", """
pop("#n-l1i", 0.05, { y: 40, d: 0.3 });
tl.fromTo("#n-wm", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.8)" }, 0.2);
tl.fromTo("#n-sp", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.3 }, 0.3);
tl.fromTo("#n-st", { scaleY: 0, svgOrigin: "60 128" }, { scaleY: 1, duration: 0.4, ease: "power2.out" }, 0.45);
tl.fromTo("#n-lf1", { scale: 0, svgOrigin: "60 84" }, { scale: 1, duration: 0.4, ease: "back.out(2.2)" }, 0.7);
tl.fromTo("#n-lf2", { scale: 0, svgOrigin: "60 62" }, { scale: 1, duration: 0.4, ease: "back.out(2.2)" }, 0.85);
tl.fromTo("#n-l2i", { opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1, duration: 0.28, ease: "power4.in" }, 1.6);
pop("#n-l3i", 2.5, { s: 0.55, d: 0.45 }); pop("#n-l4i", 3.3, { y: 40, d: 0.3 }); pop("#n-l5i", 4.0, { s: 0.5, d: 0.5 });
tl.to("#n-l5i", { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" }, 4.9);
""")

# ───────── الجذر: المشاهد + الصوت ─────────
SCENES = [("hook", D1), ("demo", D2), ("learn", D3), ("parents", D4), ("offer", D5), ("nawah", D6)]
t, hosts, S = 0.0, [], {}
for z, (cid, d) in enumerate(SCENES, start=1):
    S[cid] = t
    hosts.append(f'<div id="{cid}" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html" data-start="{round(t, 3)}" data-duration="{d}" data-track-index="{z}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: {z}"></div>')
    t = round(t + d, 3)
TOTAL = t
SFX = [  # (ملف، وقت مطلق، مدة، صوت)
    ("notification", S["hook"] + T1b - 0.6, 1.2, 0.6), ("sparkle", S["hook"] + T1b + 0.2, 1.6, 0.6),
    ("whoosh", S["demo"] - 0.1, 0.57, 0.6), ("whoosh-short", S["demo"] + 0.5, 0.57, 0.45),
    *[("click-soft", S["demo"] + a, 0.3, 0.55) for a, _ in STARS],
    ("impact-bass-2", S["demo"] + T_BLOCK + 0.5, 1.6, 0.8), ("ping", S["demo"] + T_SAY + 0.3, 1.0, 0.55),
    ("pop", S["demo"] + T_BURST + 0.05, 0.7, 0.7), ("sparkle", S["demo"] + T_BURST + 0.1, 1.8, 0.75),
    ("whoosh", S["learn"] - 0.05, 0.57, 0.6), *[("pop", S["learn"] + 0.4 + 0.18 * k, 0.7, 0.35) for k in range(0, 9, 2)],
    ("pop", S["learn"] + T3b + 0.75, 0.7, 0.5), ("sparkle", S["learn"] + T3b + 0.95, 1.6, 0.5),
    ("whoosh", S["parents"] - 0.05, 0.57, 0.55), ("chime", S["parents"] + 0.8, 2.0, 0.45), ("pop", S["parents"] + T4b, 0.7, 0.4),
    ("impact-bass-2", S["offer"] + 0.55, 2.0, 0.7), ("impact-bass-1", S["offer"] + T5b + 0.55, 1.6, 0.7), ("sparkle", S["offer"] + T5b + 1.2, 1.8, 0.5),
    ("whoosh-cinematic", S["nawah"] - 0.15, 3.0, 0.5), ("impact-bass-1", S["nawah"] + 1.86, 2.0, 0.7), ("chime", S["nawah"] + 4.05, 1.9, 0.5),
]
audio = [f'<audio id="music" class="clip" src="assets/music/bed-long.mp3" data-start="0" data-duration="{TOTAL}" data-track-index="20" data-volume="0.2" data-fade-in="0.3" data-fade-out="1.2"></audio>']
for k, (f, at, d, v) in enumerate(SFX):
    d = round(min(d, TOTAL - at), 3)
    fade = ' data-fade-out="0.25"' if d > 1 else ""
    audio.append(f'<audio id="sfx{k}" class="clip" src="assets/sfx/{f}.mp3" data-start="{round(at, 3)}" data-duration="{d}" data-track-index="{21 + k}" data-volume="{round(v * 0.55, 2)}"{fade}></audio>')
VO_AT = [S["hook"] + 0.15, S["demo"] + 0.15, S["demo"] + T_RUN + 0.1, S["demo"] + T_BLOCK + 0.1, S["demo"] + T_SAY + 0.1, S["demo"] + T_BURST + 0.1,
         S["learn"] + 0.15, S["parents"] + 0.15, S["offer"] + 0.15, S["nawah"] + 0.15]
for k, at in enumerate(VO_AT, start=1):
    if not (ROOT / f"assets/vo/vo{k:02d}.wav").exists():
        continue
    assert at + VO[k - 1] <= TOTAL + 0.01, f"vo{k} runs past the end"
    audio.append(f'<audio id="vo{k}" class="clip" src="assets/vo/vo{k:02d}.wav" data-start="{round(at, 3)}" data-duration="{round(min(VO[k - 1], TOTAL - at), 3)}" data-track-index="{80 + k}" data-volume="1"></audio>')
NL = "\n      "
(ROOT / "index.html").write_text(f"""<!doctype html>
<html lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: {SKY}; }}
      #root {{ position: relative; width: 1080px; height: 1920px; overflow: hidden; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1080" data-height="1920">
      {NL.join(hosts)}
      {NL.join(audio)}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
""")
print("built", TOTAL, "s;", len(SFX), "sfx;", len(STARS), "stars")
