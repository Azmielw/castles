// render.js — يخرج الإطارات بزمن ثابت (30fps) عبر Chromium/Playwright
// الاستخدام: node src/render.js <outDir> [fps] [from] [to] [workers] [--stills t1,t2,...]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const args = process.argv.slice(2);
  const stillsIdx = args.indexOf('--stills');
  const stills = stillsIdx >= 0 ? args[stillsIdx + 1].split(',').map(Number) : null;
  const out = args[0] || 'previews/frames';
  const fps = +(args[1] || 30);
  const timing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'timing.json'), 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const url = 'file://' + path.join(__dirname, 'index.html');
  const mk = async () => { const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } }); await p.goto(url); const info = await p.evaluate(t => boot(t), timing); return { p, info }; };
  const first = await mk();
  const dur = first.info.dur;
  fs.writeFileSync(path.join(out, 'info.json'), JSON.stringify(first.info, null, 1));
  console.log('duration', dur.toFixed(3), 'fonts', first.info.fonts);
  const save = async (p, t, file) => { const d = await p.evaluate(t => frame(t), t); fs.writeFileSync(file, Buffer.from(d.split(',')[1], 'base64')); };
  if (stills) {
    for (const t of stills) await save(first.p, t, path.join(out, `still_${t.toFixed(2)}.png`));
    await browser.close(); return;
  }
  const from = +(args[2] || 0), to = args[3] ? +args[3] : Math.ceil(dur * fps);
  const nw = +(args[4] || 3);
  const pages = [first]; for (let i = 1; i < nw; i++) pages.push(await mk());
  let next = from, done = 0;
  await Promise.all(pages.map(async ({ p }) => {
    while (next < to) {
      const i = next++; const f = path.join(out, `f${String(i).padStart(5, '0')}.png`);
      if (fs.existsSync(f)) { done++; continue; } // استئناف
      await save(p, i / fps, f); done++;
      if (done % 150 === 0) console.log('frames', done, '/', to - from);
    }
  }));
  await browser.close();
  console.log('done', done);
})();
