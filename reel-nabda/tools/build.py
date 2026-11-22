#!/usr/bin/env python3
# يبني ريل نبضة: compositions/*.html + index.html (شغّله بعد أي تعديل هون)
import pathlib, random
ROOT = pathlib.Path(__file__).resolve().parent.parent
random.seed(14)  # بذرة ثابتة عشان القلوب تطلع بنفس الأماكن كل مرة

AR = "U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F"
LA = "U+0000-05FF,U+2010-2027"
def face(fam, slug, w):
    return "".join(
        f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('assets/fonts/{slug}-{sub}-{w}-normal.woff2') format('woff2');unicode-range:{rng}}}"
        for sub, rng in (("arabic", AR), ("latin", LA)))
FONT = (face("El Messiri", "el-messiri", 700) + face("Tajawal", "tajawal", 500) + face("Tajawal", "tajawal", 700)
        + face("Amiri", "amiri", 400) + face("Amiri", "amiri", 700) + face("Readex Pro", "readex-pro", 400) + face("Readex Pro", "readex-pro", 700))
BASE = FONT + """
#root{position:absolute;inset:0;overflow:hidden;direction:rtl}
.bg{position:absolute;inset:0}
.cap{position:absolute;left:60px;width:960px;text-align:center;line-height:1.25}
.in{display:inline-block;white-space:nowrap}
.ht{position:absolute}
"""
HEART = "M12 21s-7.5-4.6-9.5-9.2C1 8 3 4.5 6.5 4.5c2 0 3.6 1.1 5.5 3.3 1.9-2.2 3.5-3.3 5.5-3.3C21 4.5 23 8 21.5 11.8 19.5 16.4 12 21 12 21z"

def hearts(pfx, n, color, dur, ymin=180, ymax=1880):
    """قلوب زينة بتطفو لفوق؛ بترجع (html, js)."""
    h, j = [], []
    for i in range(n):
        s = random.randint(36, 110)
        x, y = random.randint(10, 1070 - s), random.randint(ymin, ymax)
        # بنبعدها عن نص الشاشة عشان ما تغطي الكلام
        if 168 < y < 1330 and 150 < x < 850:
            x = random.choice([random.randint(6, 60), random.randint(1010 - s, 1070 - s)])
        o = round(random.uniform(0.10, 0.32), 2)
        h.append(f'<svg id="{pfx}-h{i}" class="ht" viewBox="0 0 24 24" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px;opacity:{o}"><path d="{HEART}" fill="{color}"/></svg>')
        j.append(f'tl.fromTo("#{pfx}-h{i}",{{y:0,rotation:{random.randint(-18, 18)}}},{{y:{-random.randint(90, 260)},rotation:{random.randint(-18, 18)},duration:{dur},ease:"none",transformOrigin:"50% 50%"}},0);')
    return "\n".join(h), "\n".join(j)

def write(cid, css, html, js):
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
{js}
window.__timelines["{cid}"] = tl;
}})();
</script>
</template>
""")

def clip(i, s, d, cls, style, inner):
    return f'<div id="{i}" class="clip {cls}" data-start="{s}" data-duration="{round(d, 3)}" style="{style}">{inner}</div>'

# ───────── 1) الهوك: عيد الحب قرّب… ولسّا وردة؟ ─────────
D1 = 3.4
hh, hj = hearts("k", 14, "#e6456e", D1)
write("hook", """
.bg{background:radial-gradient(1000px 1000px at 50% 36%,#8a2450 0%,#4a1028 48%,#1e060d 100%)}
#k-l1{top:280px;font:700 132px 'El Messiri';color:#fbf0dc}
#k-l2{top:985px;font:700 92px 'El Messiri';color:#e6cc8f}
#k-l3{top:1108px;font:700 86px 'Tajawal';color:#ff9db9}
#k-rose{position:absolute;left:354px;top:452px;width:372px;height:520px}
""", f"""
<div class="bg"></div>
{hh}
{clip("k-l1", 0, D1, "cap", "", '<span id="k-l1i" class="in">عيد الحب قرّب…</span>')}
{clip("k-rose", 0, D1, "", "", '''<svg id="k-rs" viewBox="30 50 240 370" width="372" height="520" style="overflow:visible">
  <path d="M150 415 C150 330 142 260 150 190" stroke="#4d8f45" stroke-width="11" fill="none" stroke-linecap="round"/>
  <path d="M150 320 C110 300 84 312 74 340 C104 350 132 344 150 320Z" fill="#4d8f45"/>
  <path d="M151 270 C190 246 220 256 232 284 C200 296 172 292 151 270Z" fill="#5fa653"/>
  <circle id="k-p1" cx="96" cy="150" r="30" fill="#e0456e"/><circle id="k-p2" cx="204" cy="150" r="30" fill="#d13a63"/><circle id="k-p3" cx="150" cy="212" r="28" fill="#c2274f"/>
  <g id="k-bloom">
    <circle cx="112" cy="118" r="50" fill="#d13a63"/><circle cx="188" cy="118" r="50" fill="#e0456e"/><circle cx="118" cy="172" r="48" fill="#c2274f"/><circle cx="182" cy="172" r="48" fill="#d13a63"/>
    <circle cx="150" cy="140" r="52" fill="#b01f47"/><circle cx="150" cy="140" r="30" fill="#8f1638"/>
    <path d="M150 122 C168 126 170 150 152 154 C138 156 132 142 142 136" stroke="#e7809d" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle id="k-gray" cx="150" cy="144" r="96" fill="#3a2a2e" opacity="0"/>
  </g></svg>''')}
{clip("k-l2", 0.8, D1 - 0.8, "cap", "", '<span id="k-l2i" class="in">ولسّا بدك تجيب وردة؟</span>')}
{clip("k-l3", 1.9, D1 - 1.9, "cap", "", '<span id="k-l3i" class="in">بتذبل بعد يومين.</span>')}
""", f"""
{hj}
tl.fromTo("#k-l1i", {{ scale: 1.14, opacity: 1 }}, {{ scale: 1, opacity: 1, duration: 0.7, ease: "power3.out" }}, 0);
tl.fromTo("#k-rs", {{ scale: 0.9, y: 30, opacity: 1 }}, {{ scale: 1, y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }}, 0);
tl.fromTo("#k-l2i", {{ opacity: 0, scale: 1.7 }}, {{ opacity: 1, scale: 1, duration: 0.26, ease: "power4.in" }}, 0.8);
tl.fromTo("#k-rs", {{ rotation: 0 }}, {{ rotation: 4, duration: 0.07, repeat: 5, yoyo: true, ease: "sine.inOut" }}, 1.06);
tl.to("#k-bloom", {{ rotation: 62, svgOrigin: "150 200", duration: 0.9, ease: "power2.inOut" }}, 1.5);
tl.to("#k-gray", {{ opacity: 0.6, duration: 0.9 }}, 1.5);
tl.to("#k-p1", {{ x: -70, y: 250, opacity: 0.5, duration: 1.0, ease: "power1.in" }}, 1.55);
tl.to("#k-p2", {{ x: 60, y: 262, opacity: 0.5, duration: 1.1, ease: "power1.in" }}, 1.7);
tl.to("#k-p3", {{ x: 12, y: 200, opacity: 0.5, duration: 0.9, ease: "power1.in" }}, 1.85);
pop("#k-l3i", 1.9, {{ s: 0.6 }});
["#k-l1i", "#k-l2i", "#k-l3i"].forEach(s => bye(s, {D1 - 0.22}));
tl.to("#k-rs", {{ opacity: 0, scale: 0.8, duration: 0.2 }}, {D1 - 0.22});
""")

# ───────── 2) الديمو: الجوال بيفرجي الهدية خطوة خطوة ─────────
D2 = 15.6
T_LET, T_CARD, T_HEART = 8.0, 11.2, 13.8
dh, dj = hearts("d", 16, "#b8325e", D2)
CAPS = [  # (بداية، نهاية، سطر أول، سطر ثاني)
    (3.0, 5.6, "ما بينفتح إلا", "بتاريخكم"),
    (5.6, 8.0, "وأول ما ينفتح", "بتشتغل أغنيتكم"),
    (T_LET, T_CARD, "رسالة منك", "بظرف مختوم"),
    (T_CARD, T_HEART, "كروت بتنقلب", "وكل وحدة سبب"),
    (T_HEART, D2, "وخاتمة", "بقلب بينبض"),
]
caps_html = "".join(
    clip(f"d-c{i}", a, b - a, "cap", "top:280px", f'<span id="d-c{i}a" class="in c1">{l1}</span><br><span id="d-c{i}b" class="in c2">{l2}</span>')
    for i, (a, b, l1, l2) in enumerate(CAPS, start=1))
caps_js = "".join(
    f'pop("#d-c{i}a",{a},{{y:40,d:0.3}});pop("#d-c{i}b",{round(a + 0.12, 2)},{{s:0.6}});' + (f'bye("#d-c{i}a",{round(b - 0.2, 2)});bye("#d-c{i}b",{round(b - 0.2, 2)});' if b < D2 else "")
    for i, (a, b, _, _) in enumerate(CAPS, start=1))
REASONS = ["ضحكتك", "حنيّتك", "بتفهميني<br>من نظرة", "وجودك<br>أمان"]
cards_html = "".join(
    f'<div class="cd"><div id="d-cf{i}" class="cf"><svg viewBox="0 0 24 24" width="74" height="74"><path d="{HEART}" fill="#e6cc8f"/></svg></div><div id="d-cb{i}" class="cb">{r}</div></div>'
    for i, r in enumerate(REASONS))
cards_js = "".join(
    f'tl.to("#d-cf{i}",{{scaleX:0,duration:0.15,ease:"power2.in"}},{round(T_CARD + 0.4 + 0.4 * i, 2)});tl.fromTo("#d-cb{i}",{{scaleX:0}},{{scaleX:1,duration:0.2,ease:"back.out(2)"}},{round(T_CARD + 0.55 + 0.4 * i, 2)});'
    for i in range(4))
bars_html = "".join(f'<i id="d-b{i}"></i>' for i in range(11))
bars_js = "".join(
    f'tl.fromTo("#d-b{i}",{{scaleY:{round(random.uniform(0.15, 0.4), 2)}}},{{scaleY:{round(random.uniform(0.6, 1), 2)},duration:{round(random.uniform(0.2, 0.34), 2)},repeat:9,yoyo:true,ease:"sine.inOut",transformOrigin:"50% 100%"}},5.05);'
    for i in range(11))
write("demo", """
.bg{background:radial-gradient(1200px 800px at 50% -6%,#f6dbe1 0%,#faf5ef 62%)}
#d-c0{top:280px;line-height:1.22}
#d-k{font:700 30px 'Tajawal';letter-spacing:5px;color:#8a6624}
#d-t1{font:700 64px 'Tajawal';color:#6e1a3c}
#d-t2{font:700 100px 'El Messiri';color:#b8325e}
.c1{font:700 60px 'Tajawal';color:#7a5e68}
.c2{font:700 104px 'El Messiri';color:#b8325e}
#d-ph{position:absolute;left:302px;top:532px;width:476px;height:878px;transform:scale(1.1);transform-origin:50% 0}
#d-phi{position:absolute;inset:0;border:14px solid #2a1019;border-radius:66px;background:#fffdf8;overflow:hidden;box-shadow:0 50px 90px -30px rgba(74,16,40,.6)}
.scr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:30px;text-align:center}
.lk{width:128px;height:128px;border-radius:50%;display:grid;place-items:center;color:#b48a3c;box-shadow:0 0 0 2px #e6cc8f,0 0 0 12px #fffdf8,0 0 0 14px rgba(180,138,60,.35)}
#d-s1 b{font:700 40px 'El Messiri';color:#4a1028}
.dt{display:flex;gap:10px;direction:ltr;align-items:center}
.dt i{width:76px;height:90px;border:2.5px solid #eadcd2;border-radius:16px;display:grid;place-items:center;font:700 44px 'El Messiri';font-style:normal;color:#4a1028;background:#fff}
.dt em{font:700 48px 'El Messiri';font-style:normal;color:#e6cc8f}
.hint{font:500 32px 'Tajawal';color:#7a5e68}
#d-ring{position:absolute;left:138px;top:330px;width:200px;height:200px;border-radius:50%;border:8px solid #e6cc8f;opacity:0}
.to{font:500 36px 'Tajawal';color:#7a5e68}
.nm{font:700 168px 'El Messiri';color:#4a1028;line-height:1.1}
.sub{font:700 40px 'Amiri';color:#8a6624}
.eq{display:flex;gap:9px;align-items:flex-end;height:96px;direction:ltr}
.eq i{width:15px;height:96px;border-radius:8px;background:linear-gradient(#b8325e,#6e1a3c)}
.now{font:700 34px 'Tajawal';color:#6e1a3c}
#d-env{position:absolute;left:58px;top:300px;width:332px;height:226px;border-radius:16px;background:#6e1a3c;box-shadow:0 26px 40px -22px rgba(74,16,40,.7)}
#d-flap{position:absolute;left:0;top:0;width:332px;height:150px;background:#8f2a55;clip-path:polygon(0 0,100% 0,50% 100%)}
#d-seal{position:absolute;left:124px;top:104px;width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f0d99a,#b48a3c);display:grid;place-items:center}
#d-paper{position:absolute;left:24px;top:226px;width:400px;border-radius:20px;background:#fff;border:2px solid #eadcd2;padding:38px 32px;text-align:right;box-shadow:0 26px 44px -26px rgba(74,16,40,.6)}
#d-paper p{font:400 46px 'Amiri';color:#2f1520;line-height:1.75}
#d-paper p.sg{font-weight:700;color:#b8325e;text-align:left}
.q{font:700 44px 'El Messiri';color:#4a1028}
.grid{display:grid;grid-template-columns:196px 196px;gap:18px}
.cd{position:relative;width:196px;height:186px}
.cf,.cb{position:absolute;inset:0;border-radius:22px;display:grid;place-items:center}
.cf{background:linear-gradient(135deg,#6e1a3c,#4a1028);border:2px solid #e6cc8f}
.cb{background:#fff8ec;border:2px solid #b48a3c;font:700 36px 'El Messiri';color:#4a1028;line-height:1.3}
#d-hw{position:relative;width:280px;height:280px}
#d-hw svg{position:absolute;left:0;top:0}
.r{position:absolute;left:20px;top:20px;width:240px;height:240px;border-radius:50%;border:6px solid #b8325e;opacity:0}
.lv{font:700 60px 'El Messiri';color:#4a1028}
.sg2{font:700 38px 'Amiri';color:#8a6624}
""", f"""
<div class="bg"></div>
{dh}
{clip("d-c0", 0, 3.0, "cap", "", '<span id="d-k" class="in">— هدية ما بتنتسى —</span><br><span id="d-t1" class="in">هالسنة… اهديها</span><br><span id="d-t2" class="in">موقع كامل باسمها</span>')}
{caps_html}
<div id="d-ph" class="clip" data-start="0" data-duration="{D2}"><div id="d-phi">
  <div id="d-s1" class="scr">
    <div id="d-lk" class="lk"><svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9M12 14.6v2.2"/></svg></div>
    <b>هاد المكان إلك بس</b>
    <div class="dt"><i><span id="d-g0">1</span></i><i><span id="d-g1">4</span></i><em>/</em><i><span id="d-g2">0</span></i><i><span id="d-g3">2</span></i></div>
    <span class="hint">اكتبي التاريخ اللي بيعنيلنا كثير</span>
    <div id="d-ring"></div>
  </div>
  <div id="d-s2" class="scr"><span class="to">إلى أغلى الناس</span><span id="d-nm" class="nm">سارة</span><span class="sub">كل هاد… عشانك</span><div class="eq">{bars_html}</div><span class="now">أغنيتكم شغّالة</span></div>
  <div id="d-s3" class="scr">
    <div id="d-env"><div id="d-flap"></div><div id="d-seal"><svg viewBox="0 0 24 24" width="44" height="44"><path d="{HEART}" fill="#6e1a3c"/></svg></div></div>
    <div id="d-paper"><p id="d-p0">حبيبتي سارة،</p><p id="d-p1">من يوم ما عرفتك</p><p id="d-p2">وأنا كل يوم بحبك أكتر.</p><p id="d-p3" class="sg">حبيبك</p></div>
  </div>
  <div id="d-s4" class="scr"><span class="q">ليش غالية عليّ؟</span><div class="grid">{cards_html}</div></div>
  <div id="d-s5" class="scr"><div id="d-hw"><div id="d-r0" class="r"></div><div id="d-r1" class="r"></div><div id="d-r2" class="r"></div><svg id="d-hv" viewBox="0 0 24 24" width="280" height="280"><defs><linearGradient id="d-hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0456e"/><stop offset="1" stop-color="#6e1a3c"/></linearGradient></defs><path d="{HEART}" fill="url(#d-hg)"/></svg></div><span class="lv">بحبك… للأبد</span><span class="sg2">حبيبك</span></div>
</div></div>
""", f"""
{dj}
const scr = (a, b, t) => {{ tl.to(a, {{ opacity: 0, x: -70, duration: 0.22, ease: "power2.in" }}, t); tl.fromTo(b, {{ opacity: 0, x: 70 }}, {{ opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }}, t + 0.18); }};
tl.set(["#d-s2", "#d-s3", "#d-s4", "#d-s5", "#d-g0", "#d-g1", "#d-g2", "#d-g3", "#d-paper", "#d-p0", "#d-p1", "#d-p2", "#d-p3"], {{ opacity: 0 }}, 0);
pop("#d-k", 0.05, {{ y: 30, d: 0.3 }}); pop("#d-t1", 0.2, {{ y: 40, d: 0.35 }}); pop("#d-t2", 0.45, {{ s: 0.55, d: 0.5 }});
["#d-k", "#d-t1", "#d-t2"].forEach(s => bye(s, 2.8));
tl.fromTo("#d-phi", {{ y: 980, rotation: 7 }}, {{ y: 0, rotation: 0, duration: 0.9, ease: "power3.out" }}, 0.5);
{caps_js}
[0, 1, 2, 3].forEach(k => tl.fromTo("#d-g" + k, {{ opacity: 0, scale: 0.3 }}, {{ opacity: 1, scale: 1, duration: 0.16, ease: "back.out(3)" }}, 3.3 + 0.3 * k));
tl.to("#d-lk", {{ scale: 1.25, duration: 0.14, yoyo: true, repeat: 1 }}, 4.55);
tl.fromTo("#d-ring", {{ scale: 0.5, opacity: 0.9 }}, {{ scale: 3.4, opacity: 0, duration: 0.6, ease: "power2.out" }}, 4.6);
scr("#d-s1", "#d-s2", 4.85);
tl.fromTo("#d-nm", {{ scale: 0.4 }}, {{ scale: 1, duration: 0.5, ease: "back.out(2)" }}, 5.05);
{bars_js}
scr("#d-s2", "#d-s3", 7.85);
tl.to("#d-seal", {{ scale: 0, rotation: 90, duration: 0.25, ease: "back.in(2)" }}, 8.45);
tl.to("#d-flap", {{ scaleY: -1, transformOrigin: "50% 0%", duration: 0.35, ease: "power2.inOut" }}, 8.6);
tl.to("#d-env", {{ y: 330, opacity: 0, scale: 0.8, duration: 0.4, ease: "power2.in" }}, 8.95);
tl.fromTo("#d-paper", {{ opacity: 0, y: 120, scale: 0.7 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.5)" }}, 9.0);
[0, 1, 2, 3].forEach(k => tl.fromTo("#d-p" + k, {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.3 }}, 9.25 + 0.22 * k));
scr("#d-s3", "#d-s4", {T_CARD - 0.15});
{cards_js}
scr("#d-s4", "#d-s5", {T_HEART - 0.15});
[{T_HEART + 0.35}, {T_HEART + 0.85}, {T_HEART + 1.35}].forEach((t, k) => {{
  tl.to("#d-hv", {{ scale: 1.22, duration: 0.12, ease: "power2.out" }}, t); tl.to("#d-hv", {{ scale: 1, duration: 0.3, ease: "power2.inOut" }}, t + 0.12);
  tl.fromTo("#d-r" + k, {{ scale: 0.7, opacity: 0.8 }}, {{ scale: 2.1, opacity: 0, duration: 0.5, ease: "power2.out" }}, t);
  tl.to("#d-phi", {{ scale: 1.025, duration: 0.1, yoyo: true, repeat: 1 }}, t);
}});
""")

# ───────── 3) مش بس لحبيبتك: لأمك ولكل حدا غالي ─────────
D3 = 3.4
mh, mj = hearts("m", 12, "#b48a3c", D3)
ROWS = [(950, ["أمك", "أبوك", "أختك"]), (1052, ["أخوك", "صاحبك", "صاحبتك"]), (1154, ["حدا زعلان منك وبدك ترضيه"])]
chips_html, chips_js, n = "", "", 0
for top, words in ROWS:
    spans = ""
    for w in words:
        spans += f'<span id="m-ch{n}" class="chip">{w}</span>'
        chips_js += f'pop("#m-ch{n}",{round(0.9 + 0.13 * n, 2)},{{y:30,s:0.5,d:0.3}});'
        n += 1
    chips_html += clip(f"m-r{top}", 0, D3, "row", f"top:{top}px", spans)
write("mom", """
.bg{background:linear-gradient(180deg,#f6dbe1 0%,#faf5ef 55%,#f3e7dc 100%)}
#m-l1,#m-l2{top:280px;font:700 92px 'El Messiri';color:#4a1028}
#m-l2 b{color:#b8325e}
#m-card{position:absolute;left:150px;top:424px;width:780px;height:500px}
#m-ci{position:absolute;inset:0;border-radius:40px;background:#fffdf8;border:2px solid #eadcd2;box-shadow:0 44px 70px -34px rgba(74,16,40,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.tag{font:700 38px 'Tajawal';color:#fff;background:#8a6624;border-radius:99px;padding:6px 26px}
.mm{font:700 200px 'El Messiri';color:#4a1028;line-height:1.15}
.ms{font:700 66px 'Amiri';color:#b8325e}
.row{position:absolute;left:40px;width:1000px;display:flex;gap:18px;justify-content:center}
.chip{display:inline-block;white-space:nowrap;font:700 52px 'Tajawal';color:#4a1028;background:#fffdf8;border:3px solid #e6cc8f;border-radius:999px;padding:8px 40px}
""", f"""
<div class="bg"></div>
{mh}
{clip("m-l1", 0, 1.5, "cap", "", '<span id="m-l1i" class="in">ومش بس لحبيبتك…</span>')}
{clip("m-l2", 1.5, D3 - 1.5, "cap", "", '<span id="m-l2i" class="in">لكل حدا <b>غالي عليك</b></span>')}
<div id="m-card" class="clip" data-start="0" data-duration="{D3}"><div id="m-ci"><span class="tag">عيد الأم</span><span class="mm">ماما</span><span class="ms">ست الحبايب</span></div></div>
{chips_html}
""", f"""
{mj}
pop("#m-l1i", 0.05, {{ s: 0.6 }}); bye("#m-l1i", 1.3); pop("#m-l2i", 1.5, {{ s: 0.6 }});
tl.fromTo("#m-ci", {{ opacity: 0, y: 200, rotation: -9, scale: 0.8 }}, {{ opacity: 1, y: 0, rotation: -3, scale: 1, duration: 0.6, ease: "back.out(1.5)" }}, 0.1);
tl.to("#m-ci", {{ rotation: 2, duration: 2.6, ease: "sine.inOut" }}, 0.7);
{chips_js}
""")

# ───────── 4) العرض: 24 ساعة، أقل من بوكيه ورد، اطلب ─────────
D4 = 4.2
oh, oj = hearts("o", 14, "#e6456e", D4)
write("offer", """
.bg{background:radial-gradient(1000px 1000px at 50% 30%,#8a2450 0%,#4a1028 50%,#1e060d 100%)}
#o-l1{top:276px;font:700 80px 'Tajawal';color:#fbf0dc}
#o-l2{top:350px;font:700 330px 'Tajawal';color:#e6cc8f;line-height:1.15}
#o-l2 small{font:700 130px 'El Messiri';color:#fbf0dc}
#o-l3{top:740px;font:700 72px 'Tajawal';color:#f1d7de}
#o-l4{top:822px;font:700 132px 'El Messiri';color:#e6cc8f}
#o-l5{top:984px}
#o-l5i{font:700 46px 'Tajawal';color:#fbf0dc;border:2px solid #e6cc8f;border-radius:999px;padding:6px 44px}
#o-l6{top:1060px}
#o-l6i{font:700 66px 'El Messiri';color:#4a1028;background:linear-gradient(135deg,#f3e2b0,#d9b86c);border-radius:999px;padding:8px 80px;box-shadow:0 24px 44px -18px rgba(0,0,0,.6)}
#o-l7{top:1198px;font:700 40px 'Tajawal';color:#fbf0dc;direction:ltr}
""", f"""
<div class="bg"></div>
{oh}
{clip("o-l1", 0, D4, "cap", "", '<span id="o-l1i" class="in">هديتك جاهزة خلال</span>')}
{clip("o-l2", 0, D4, "cap", "", '<span id="o-l2i" class="in"><span id="o-n">24</span> <small>ساعة</small></span>')}
{clip("o-l3", 1.2, D4 - 1.2, "cap", "", '<span id="o-l3i" class="in">أقل من بوكيه ورد…</span>')}
{clip("o-l4", 1.7, D4 - 1.7, "cap", "", '<span id="o-l4i" class="in">وبتضل للأبد</span>')}
{clip("o-l5", 2.4, D4 - 2.4, "cap", "", '<span id="o-l5i" class="in">تبدأ من 299 ج.م</span>')}
{clip("o-l6", 2.8, D4 - 2.8, "cap", "", '<span id="o-l6i" class="in">اطلب هديتك هلأ</span>')}
{clip("o-l7", 3.1, D4 - 3.1, "cap", "", '<span id="o-l7i" class="in">nabda.nawahcore.org</span>')}
""", f"""
{oj}
pop("#o-l1i", 0.05, {{ y: 40, d: 0.3 }});
tl.fromTo("#o-l2i", {{ opacity: 0, scale: 2.2 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "power4.in" }}, 0.15);
const cnt = {{ v: 0 }}, num = document.getElementById("o-n");
tl.fromTo(cnt, {{ v: 0 }}, {{ v: 24, duration: 0.75, ease: "power2.out", onUpdate: () => {{ num.textContent = Math.round(cnt.v); }} }}, 0.15);
pop("#o-l3i", 1.2, {{ y: 40, d: 0.3 }}); pop("#o-l4i", 1.7, {{ s: 0.5, d: 0.5 }});
pop("#o-l5i", 2.4, {{ s: 0.6 }}); pop("#o-l6i", 2.8, {{ s: 0.5, d: 0.5 }}); pop("#o-l7i", 3.1, {{ y: 30, d: 0.3 }});
tl.to("#o-l6i", {{ scale: 1.07, duration: 0.25, yoyo: true, repeat: 1, ease: "sine.inOut" }}, 3.45);
""")

# ───────── 5) الخاتمة: مشروع من نواة… عندك فكرة؟ ─────────
D5 = 5.6
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
{clip("n-l1", 0, D5, "cap", "", '<span id="n-l1i" class="in"><b>نَبضة</b> · مشروع من</span>')}
<div id="n-logo" class="clip" data-start="0" data-duration="{D5}"><div id="n-lg">
  <div id="n-wm"><b>نَواة</b><small>NAWAH</small></div>
  <svg id="n-sp" viewBox="0 0 120 170" width="210" height="298">
    <ellipse cx="60" cy="140" rx="34" ry="24" fill="#CE9F26"/>
    <path id="n-st" d="M60 128 C60 100 56 80 60 54" stroke="#55A030" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path id="n-lf1" d="M60 84 C34 78 18 56 20 34 C46 38 60 58 60 84Z" fill="#55A030"/>
    <path id="n-lf2" d="M60 62 C84 54 100 34 98 12 C74 18 60 38 60 62Z" fill="#6dbb3f"/>
  </svg>
</div></div>
{clip("n-l2", 1.3, D5 - 1.3, "cap", "", '<span id="n-l2i" class="in">عندك <b>فكرة؟</b></span>')}
{clip("n-l3", 2.0, D5 - 2.0, "cap", "", '<span id="n-l3i" class="in">قدّمها بنواة</span>')}
{clip("n-l4", 2.6, D5 - 2.6, "cap", "", '<span id="n-l4i" class="in">احنا منبنيها… وإلك نسبة من إيراداتها</span>')}
{clip("n-l5", 3.0, D5 - 3.0, "cap", "", '<span id="n-l5i" class="in">nawahcore.org</span>')}
""", """
pop("#n-l1i", 0.05, { y: 40, d: 0.3 });
tl.fromTo("#n-wm", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.8)" }, 0.2);
tl.fromTo("#n-sp", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.3 }, 0.3);
tl.fromTo("#n-st", { scaleY: 0, svgOrigin: "60 128" }, { scaleY: 1, duration: 0.4, ease: "power2.out" }, 0.45);
tl.fromTo("#n-lf1", { scale: 0, svgOrigin: "60 84" }, { scale: 1, duration: 0.4, ease: "back.out(2.2)" }, 0.7);
tl.fromTo("#n-lf2", { scale: 0, svgOrigin: "60 62" }, { scale: 1, duration: 0.4, ease: "back.out(2.2)" }, 0.85);
tl.fromTo("#n-l2i", { opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1, duration: 0.28, ease: "power4.in" }, 1.3);
pop("#n-l3i", 2.0, { s: 0.55, d: 0.45 }); pop("#n-l4i", 2.6, { y: 40, d: 0.3 }); pop("#n-l5i", 3.0, { s: 0.5, d: 0.5 });
tl.to("#n-l5i", { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" }, 3.9);
""")

# ───────── الجذر: المشاهد + الصوت ─────────
SCENES = [("hook", D1), ("demo", D2), ("mom", D3), ("offer", D4), ("nawah", D5)]
t, hosts, starts = 0.0, [], {}
for z, (cid, d) in enumerate(SCENES, start=1):
    starts[cid] = t
    hosts.append(f'<div id="{cid}" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html" data-start="{round(t, 3)}" data-duration="{d}" data-track-index="{z}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: {z}"></div>')
    t = round(t + d, 3)
TOTAL = t
S = starts
SFX = [  # (ملف، وقت مطلق، مدة، صوت)
    ("impact-bass-2", S["hook"] + 1.04, 1.6, 0.7), ("whoosh", S["demo"] - 0.1, 0.57, 0.6), ("whoosh-short", S["demo"] + 0.6, 0.57, 0.45),
    *[("key-press", S["demo"] + 3.3 + 0.3 * k, 0.43, 0.7) for k in range(4)],
    ("chime", S["demo"] + 4.6, 2.5, 0.55), ("whoosh-short", S["demo"] + 7.85, 0.57, 0.4), ("pop", S["demo"] + 8.45, 0.7, 0.6),
    *[("pop", S["demo"] + T_CARD + 0.55 + 0.4 * k, 0.7, 0.5) for k in range(4)],
    *[("impact-bass-1", S["demo"] + t0, 0.5, 0.55) for t0 in (T_HEART + 0.35, T_HEART + 0.85, T_HEART + 1.35)],
    ("whoosh", S["mom"] - 0.05, 0.57, 0.6), ("pop", S["mom"] + 0.9, 0.7, 0.4), ("pop", S["mom"] + 1.3, 0.7, 0.4), ("pop", S["mom"] + 1.7, 0.7, 0.4),
    ("impact-bass-2", S["offer"] + 0.42, 2.0, 0.75), ("sparkle", S["offer"] + 1.75, 1.8, 0.6), ("pop", S["offer"] + 2.85, 0.7, 0.5),
    ("whoosh-cinematic", S["nawah"] - 0.15, 3.0, 0.5), ("impact-bass-1", S["nawah"] + 1.56, 2.0, 0.7), ("chime", S["nawah"] + 3.05, 2.2, 0.5),
]
audio = [f'<audio id="music" class="clip" src="assets/music/bed.mp3" data-start="0" data-duration="{TOTAL}" data-track-index="20" data-volume="0.5" data-fade-in="0.3" data-fade-out="1.2"></audio>']
for k, (f, at, d, v) in enumerate(SFX):
    d = round(min(d, TOTAL - at), 3)
    fade = ' data-fade-out="0.25"' if d > 1 else ""
    audio.append(f'<audio id="sfx{k}" class="clip" src="assets/sfx/{f}.mp3" data-start="{round(at, 3)}" data-duration="{d}" data-track-index="{21 + k}" data-volume="{v}"{fade}></audio>')
NL = "\n      "
(ROOT / "index.html").write_text(f"""<!doctype html>
<html lang="ar">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #4a1028; }}
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
print("built", TOTAL, "s;", len(SFX), "sfx")
