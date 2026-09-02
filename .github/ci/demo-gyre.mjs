#!/usr/bin/env node
/**
 * CHECK 16 — Gyre, in a real browser, against PUP-WO-0300's acceptance list.
 *
 * WHY THIS FILE EXISTS AT ALL. PUP-WO-0300 §4 is headed "proven, not asserted", and
 * every item on it is a claim about a running canvas: a parameter changes the field
 * within a second, five randomize presses give five usable worlds, attract inverts,
 * settings survive a restart, teardown leaves nothing running. NONE of that is visible
 * to a static scanner, and a builder reporting it from a local browser session is
 * exactly the shape this project has already been burned by twice — a claim about an
 * artifact made without a mechanism that can contradict it. So the acceptance list is
 * a check, it runs on every PR, and it can go red.
 *
 * WHAT IT MEASURES AND WHAT IT CANNOT. It reads PIXELS off the canvas: how much ink,
 * how far that ink sits from a point, its mean hue, and what colour the background is.
 * Those are the terms the acceptance list is actually written in — "visibly", "a
 * different world", "inverts" — and they are the terms a three-year-old sees. What it
 * cannot do is tell you the toy is FUN. That judgement is Scotty's and it is item 5 of
 * the human-regardless list; a green here means the mechanisms respond, not that the
 * field is delightful.
 *
 * THE FRAME RATE IT PRINTS IS NOT THE DEVICE NUMBER. Headless chromium on a desktop
 * is not a tablet, and reporting its fps as though it were is the same defect as
 * naming a job for a count nothing recomputes. It is a REGRESSION baseline: a number
 * that must not fall, measured the same way each time. The device number is Scotty's
 * to take, and PUP-WO-0300 §3 asks for the trade to be stated — it is, in
 * docs/feedback/PUP-WO-0300.md.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));

let COMMIT = 'unknown';
try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
console.log(`CHECK 16 — Gyre's acceptance list, in a browser. subject ${COMMIT.slice(0, 12)}\n`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const full = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
    await stat(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      'Service-Worker-Allowed': '/' }).end(await readFile(full));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const notes = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

/* ---------------------------------------------------------------------------
 * INSTRUMENTATION, INSTALLED BEFORE THE PAGE'S OWN SCRIPTS RUN.
 * Wrapping rAF and the two EventTarget methods is how "teardown leaves nothing
 * running" becomes a measurement rather than a promise: a frame counter that keeps
 * climbing after teardown, or a listener the module added and never removed, both
 * show up as numbers. Asking the module whether it cleaned up would be asking the
 * suspect.
 * ------------------------------------------------------------------------- */
const INIT = () => {
  window.__probe = { frames: 0, live: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__probe.frames++; return cb(t); });

  /* window and document only. A listener on a node inside the host dies with the
   * node; one on window outlives the game, which is the leak worth counting. */
  const add = EventTarget.prototype.addEventListener;
  const rem = EventTarget.prototype.removeEventListener;
  const tag = (t) => (t === window ? 'window' : t === document ? 'document' : null);
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const w = tag(this); if (w) window.__probe.live.push(w + ':' + type + ':' + (fn && fn.name || 'anon'));
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    const w = tag(this);
    if (w) { const k = w + ':' + type + ':' + (fn && fn.name || 'anon');
      const i = window.__probe.live.indexOf(k); if (i !== -1) window.__probe.live.splice(i, 1); }
    return rem.call(this, type, fn, opts);
  };

  /* Every scheduled oscillator, with the pitch and the duration it was given. This is
   * how api.tone is demonstrated: not "the call did not throw", but "a note of that
   * frequency for that long was actually scheduled on the audio graph". */
  window.__tones = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const co = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () {
      const o = co.call(this);
      const s = o.start.bind(o), st = o.stop.bind(o);
      let t0 = 0;
      o.start = (t) => { t0 = t || 0; return s(t); };
      o.stop = (t) => {
        window.__tones.push({ hz: Math.round(o.frequency.value), ms: Math.round(((t || 0) - t0) * 1000), wave: o.type });
        return st(t);
      };
      return o;
    };
  }

  /* PIXEL FORENSICS. The background is taken as the per-channel MEDIAN of a strided
   * sample — the background is by far the commonest colour on a particle field, and a
   * median is not moved by the ink the way a mean is. "Ink" is any pixel far enough
   * from it to be a particle, a trail or a ring. */
  window.__sample = (originX, originY, radiusCss) => {
    const c = document.querySelector('#gameHost canvas');
    if (!c || !c.width) return null;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const d = ctx.getImageData(0, 0, W, H).data;
    const STEP = 4;
    const rs = [], gs = [], bs = [];
    for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
      const i = (y * W + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
    }
    const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
    const br = med(rs), bg = med(gs), bb = med(bs);
    const ox = originX === undefined ? W / 2 : originX * (W / c.clientWidth);
    const oy = originY === undefined ? H / 2 : originY * (H / c.clientHeight);
    const R = (radiusCss === undefined ? 0 : radiusCss) * (W / c.clientWidth);
    let ink = 0, total = 0, distSum = 0, hueX = 0, hueY = 0;
    let nearInk = 0, nearTotal = 0;
    let lumSum = 0, lumSq = 0;
    for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
      const i = (y * W + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      total++;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum; lumSq += lum * lum;
      const dOrigin = Math.hypot(x - ox, y - oy);
      const isNear = R > 0 && dOrigin <= R;
      if (isNear) nearTotal++;
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) < 40) continue;
      ink++;
      if (isNear) nearInk++;
      distSum += dOrigin;
      /* Mean hue as a unit vector, so 359 and 1 average to 0 rather than 180. */
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let hdeg = 0;
      if (mx !== mn) {
        const dd = mx - mn;
        if (mx === r) hdeg = ((g - b) / dd) % 6;
        else if (mx === g) hdeg = (b - r) / dd + 2;
        else hdeg = (r - g) / dd + 4;
        hdeg *= 60; if (hdeg < 0) hdeg += 360;
      }
      const rad = (hdeg * Math.PI) / 180;
      hueX += Math.cos(rad); hueY += Math.sin(rad);
    }
    const meanLum = lumSum / total;
    return {
      inkFrac: ink / total,
      meanDist: ink ? distSum / ink / Math.hypot(W, H) : 0,
      /* INK DENSITY IN A DISC AROUND THE POINTER. This is the metric that tells
       * attract from repel, and meanDist is not: the field WRAPS at every edge, so a
       * repelled particle re-enters on the far side and the average distance from the
       * centre settles at roughly what a wide attract orbit gives. The visible
       * difference is not where the field sits on average, it is whether there is a
       * KNOT under the finger or a HOLE. */
      nearFrac: nearTotal ? nearInk / nearTotal : 0,
      hue: ink ? (Math.atan2(hueY, hueX) * 180) / Math.PI : 0,
      bg: [br, bg, bb],
      lumSd: Math.sqrt(Math.max(0, lumSq / total - meanLum * meanLum)),
    };
  };
};

const browser = await chromium.launch({ channel: 'chromium' });
/* A TOUCH CONTEXT, AND THAT IS A MEASUREMENT DECISION, NOT A DETAIL. The tablet this
 * runs on is a coarse pointer, and the sim draws TWO THINGS ONLY FOR FINE POINTERS —
 * a large soft glow under the cursor and a dot at it. Both are decoration the child
 * never sees, and both sit in the exact middle of every reading taken near the
 * pointer: with a mouse context the glow alone saturated the disc this check measures,
 * so attract and repel came back identical while looking, to the eye, quite different.
 * `hasTouch` makes `(pointer: coarse)` match, which is the device's condition. */
const ctx = await browser.newContext({ viewport: { width: 900, height: 640 }, hasTouch: true });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

const openField = async () => {
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await page.click('.pad-btn[data-id="7"]');
  await page.waitForFunction(() => {
    const h = document.getElementById('gameHost');
    return !!(h && h.gyre && h.querySelector('canvas'));
  }, { timeout: 10000 });
};
const seam = () => document.getElementById('gameHost').gyre;
const setParam = (k, v) => page.evaluate(([a, b]) => document.getElementById('gameHost').gyre.set(a, b), [k, v]);
const readParams = () => page.evaluate(() => document.getElementById('gameHost').gyre.get());
const settle = (ms) => page.waitForTimeout(ms);
const sample = (x, y, r) => page.evaluate(([a, b, c]) => window.__sample(a, b, c), [x, y, r]);

try {
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await openField();
ok('the Games button opened Gyre and the field exposed its control seam');

/* ===================================================================== 1. api.tone
 * PUP-WO-0300 acceptance 3: "a tone at two different pitches and two durations, and
 * the twelve-cue bank still working unchanged." Both halves, because §2.1's whole
 * argument is that the bank and the primitive are different things and the bank is
 * what it must not break. */
console.log('\n--- 1. api.tone — the primitive built by §2.1, and the bank it must not break ---');
await page.evaluate(() => { window.__tones.length = 0; });
await page.evaluate(() => { playTone(440, 120, 'sine'); playTone(880, 600, 'triangle'); });
await settle(80);
let tones = await page.evaluate(() => window.__tones.slice());
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const hasTone = (hz, ms, wave) => tones.some((t) => near(t.hz, hz, 2) && near(t.ms, ms, 25) && t.wave === wave);
if (hasTone(440, 120, 'sine') && hasTone(880, 600, 'triangle')) {
  ok(`two pitches and two durations scheduled on the audio graph: ${tones.map((t) => `${t.hz}Hz/${t.ms}ms/${t.wave}`).join(', ')}`);
} else {
  bad('api.tone did not schedule the notes it was given', JSON.stringify(tones));
}

/* Clamping is not decoration: these are the values a game module can hand a live
 * AudioContext, and an unclamped 0 Hz throws while an unclamped 30 s note does not
 * stop. Asserted because §2.1's build is only as good as its bounds. */
await page.evaluate(() => { window.__tones.length = 0; });
await page.evaluate(() => { playTone(0, 50, 'sine'); playTone(99999, 99999, 'nonsense'); playTone(NaN, 100, 'sine'); });
await settle(80);
tones = await page.evaluate(() => window.__tones.slice());
const clamped = tones.length === 2
  && tones.every((t) => t.hz >= 40 && t.hz <= 4000 && t.ms >= 20 && t.ms <= 3000
    && ['sine', 'square', 'sawtooth', 'triangle'].includes(t.wave));
if (clamped) ok(`out-of-range arguments were clamped, not passed through or thrown: ${tones.map((t) => `${t.hz}Hz/${t.ms}ms/${t.wave}`).join(', ')}`);
else bad('api.tone did not clamp its arguments', JSON.stringify(tones));

await page.evaluate(() => { window.__tones.length = 0; doSound('chime'); });
await settle(80);
tones = await page.evaluate(() => window.__tones.slice());
const chime = [392, 523, 659, 784].every((hz) => tones.some((t) => near(t.hz, hz, 2)));
if (chime && tones.length === 4) ok(`the twelve-cue bank is unchanged — chime still schedules ${tones.map((t) => t.hz).join('/')}Hz`);
else bad('lifting mk()/sw() out of doSound changed the sound bank', JSON.stringify(tones));

/* And the game USES it — §2.1's "make Gyre use it". A tap high on the field and a tap
 * low on it must produce different pitches, because that mapping is the toy. */
await page.evaluate(() => { window.__tones.length = 0; });
const box = await page.evaluate(() => { const r = document.querySelector('#gameHost canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.12);
await settle(60);
await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.88);
await settle(80);
tones = await page.evaluate(() => window.__tones.slice());
if (tones.length >= 2 && tones[0].hz > tones[tones.length - 1].hz * 1.5) {
  ok(`a tap high on the field sounds higher than a tap low on it (${tones[0].hz}Hz vs ${tones[tones.length - 1].hz}Hz) — no reading required`);
} else {
  bad('tapping the field did not produce two different pitches', JSON.stringify(tones));
}

/* ============================================================ 2. every parameter
 * PUP-WO-0300 acceptance 4 and roadmap P3 gate 1: "every parameter changes the field
 * visibly within one second, demonstrated PER PARAMETER, not as a class."
 *
 * PER PARAMETER IS THE WHOLE INSTRUCTION. A test that drags one slider and concludes
 * "the sliders work" is architecture §6.1 member 1 with extra steps — it passes while
 * eight of the nine do nothing. Each one below is set to a LOW value and a HIGH value
 * and read back off the pixels through the metric that parameter actually controls,
 * with 900 ms between the set and the read so "within one second" is what is measured
 * and not merely what is hoped. */
console.log('\n--- 2. every parameter, one at a time, measured off the canvas ---');

/* WHAT EACH PARAMETER IS MEASURED BY, AND WHY THAT ONE.
 *
 * `extra` is the baseline the trial runs against, and where it is not empty it is
 * because the DEFAULT baseline hides the parameter. `tail` and `force` both change how
 * far a particle travels between two drawn points — and at the default linger of 60,
 * six seconds of accumulated trails are already covering the canvas, so the thing
 * under test is a rounding error on top of it. Turning linger off is not making the
 * test easy; it is removing the other variable that writes to the same metric.
 * Every threshold below is 30%, and the smallest margin any of these actually shows
 * is 79% — the numbers are in docs/feedback/PUP-WO-0300.md. */
const PARAMS = [
  { key: 'count',   lo: 300,  hi: 3000, extra: {}, metric: 'inkFrac', dir: 'up',
    why: 'more particles put more ink on the canvas' },
  { key: 'size',    lo: 0,    hi: 100,  extra: {}, metric: 'inkFrac', dir: 'up',
    why: 'a thicker stroke covers more pixels' },
  { key: 'linger',  lo: 0,    hi: 100,  extra: {}, metric: 'inkFrac', dir: 'up',
    why: 'a slower fade leaves more of the last frames behind' },
  { key: 'tail',    lo: 0,    hi: 100,  extra: { force: 1.85, linger: 0, count: 900 }, metric: 'inkFrac', dir: 'up',
    why: 'a longer trail is a longer line' },
  { key: 'force',   lo: 0.15, hi: 1.85, extra: { linger: 0 }, metric: 'inkFrac', dir: 'up',
    why: 'a stronger pull moves the field faster, and a faster particle draws a longer stroke' },
  /* POLARITY IS THE ONE ENTRY HERE WHOSE DIRECTION IS NOT FIXED, AND THAT IS A FACT
   * ABOUT THE FIELD RATHER THAN A WEAKER TEST. Measured at 900 ms the flip is
   * enormous — the knot attract had gathered is thrown outward, and every one of
   * those particles is moving fast and drawing a long stroke straight through the
   * disc, so the ink under the finger nearly DOUBLES. Measured once settled, the same
   * flip empties that disc completely. Both are true and they point opposite ways, so
   * this row asserts the magnitude, which is what "visibly, within one second" means,
   * and §4 below asserts the settled hole, which is what "inverts" means. Asserting a
   * direction here would have been asserting the transient. */
  { key: 'polarity', lo: 1,   hi: -1,   extra: { force: 1.85, count: 2400, linger: 30 }, metric: 'nearFrac', dir: 'differ', radius: 120,
    why: 'the flip throws the field through the disc under the finger inside a second' },
  { key: 'palette', lo: 'solar', hi: 'ice', extra: {}, metric: 'hue', dir: 'differ',
    why: 'the field wears a different colour' },
  { key: 'background', lo: 'void', hi: 'fog', extra: {}, metric: 'bg', dir: 'differ',
    why: 'the ground behind the field is a different colour' },
];

/* A fixed baseline for every trial, so one parameter's reading cannot be another
 * parameter's leftovers. */
async function baseline(extra) {
  const base = { count: 1600, force: 0.68, burst: 50, tail: 32, size: 40, linger: 60, palette: 'ice', background: 'void', polarity: 1 };
  await page.evaluate((s) => {
    const g = document.getElementById('gameHost').gyre;
    for (const k of Object.keys(s)) g.set(k, s[k]);
  }, Object.assign(base, extra || {}));
  /* THE POINTER IS THE CENTRE OF THE FIELD, so it has to be somewhere known before a
   * distance from it means anything. Section 1 left it where it last tapped; without
   * this line the force and polarity trials would be measuring a field gathered
   * somewhere else entirely. */
  await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
}

for (const p of PARAMS) {
  await baseline(p.extra);
  await setParam(p.key, p.lo);
  await settle(900);
  const a = await sample(undefined, undefined, p.radius);
  await baseline(p.extra);
  await setParam(p.key, p.hi);
  await settle(900);
  const b = await sample(undefined, undefined, p.radius);
  if (!a || !b) { bad(`${p.key}: could not sample the canvas`); continue; }

  let pass = false, shown = '';
  if (p.metric === 'bg') {
    const delta = Math.abs(a.bg[0] - b.bg[0]) + Math.abs(a.bg[1] - b.bg[1]) + Math.abs(a.bg[2] - b.bg[2]);
    pass = delta > 60;
    shown = `background rgb ${a.bg.join(',')} -> ${b.bg.join(',')} (delta ${delta})`;
  } else if (p.metric === 'hue') {
    let d = Math.abs(a.hue - b.hue); if (d > 180) d = 360 - d;
    pass = d > 25;
    shown = `mean hue ${Math.round(a.hue)}deg -> ${Math.round(b.hue)}deg (${Math.round(d)}deg apart)`;
  } else {
    const va = a[p.metric], vb = b[p.metric];
    const rel = va === 0 ? (vb > 0 ? Infinity : 0) : (vb - va) / va;
    pass = p.dir === 'up' ? rel > 0.3 : p.dir === 'down' ? rel < -0.3 : Math.abs(rel) > 0.4;
    shown = `${p.metric} ${va.toFixed(4)} -> ${vb.toFixed(4)} (${(rel * 100).toFixed(0)}%)`;
  }
  if (pass) ok(`${p.key}: ${shown} — ${p.why}`);
  else bad(`${p.key} did not visibly change the field within 900 ms`, `${shown}; expected ${p.dir}`);
}

/* BURST IS THE ONE PARAMETER WITH NOTHING TO SEE UNTIL A FINGER LANDS, so it is
 * demonstrated the way a child produces it — a tap — and read as the CHANGE a tap
 * makes to the ink under it.
 *
 * SAMPLED A FULL SECOND LATER, AND THAT DELAY IS THE MEASUREMENT. The tap also drops a
 * ring, and the ring is drawn whatever `burst` is set to: read at 200 ms it dominates
 * the disc completely and burst 0 and burst 100 come back within 0.0004 of each other,
 * which is the check measuring its own decoration. The ring dies at 550 ms. After it,
 * what is left in the disc is what the burst did. */
await baseline({ force: 0.15, linger: 50, count: 3000, size: 80, tail: 60 });
async function tapHole(burst) {
  await setParam('burst', burst);
  await settle(1200);
  const before = (await sample(box.w * 0.5, box.h * 0.5, 120)).nearFrac;
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.5);
  await settle(1000);
  const after = (await sample(box.w * 0.5, box.h * 0.5, 120)).nearFrac;
  return after - before;
}
const hole0 = await tapHole(0);
await baseline({ force: 0.15, linger: 50, count: 3000, size: 80, tail: 60 });
const hole100 = await tapHole(100);
if (hole100 < -0.02 && hole0 > hole100 * 0.25) {
  ok(`burst: a tap at burst 100 clears ${(-hole100 * 100).toFixed(1)}% of the ink under the finger; the same tap at burst 0 changes it by ${(hole0 * 100).toFixed(1)}%`);
} else {
  bad('burst did not change what a tap does to the field', `ink change under the touch: burst 0 ${hole0.toFixed(4)}, burst 100 ${hole100.toFixed(4)}`);
}

/* ================================================== 3. randomize, and "usable"
 * PUP-WO-0300 acceptance 5 and roadmap P3 gate 2: five consecutive taps, five visibly
 * different fields, ALL USABLE.
 *
 * FIVE IS THE GATE AND FIVE IS NOT ENOUGH. Five draws from a random generator prove
 * that five draws were fine; the bad worlds this generator must never produce — a
 * black screen, an empty one, a field flung off canvas — are rare by construction and
 * a five-sample test is exactly how a one-in-two-hundred all-black slips through and
 * lands on the tablet. So the gate's five are run against real pixels, and then two
 * thousand more are run against the bounds. Both, because neither alone is the claim. */
console.log('\n--- 3. randomize: the gate\'s five in pixels, and two thousand more in bounds ---');
const worlds = [];
for (let i = 0; i < 5; i++) {
  const chosen = await page.evaluate(() => document.getElementById('gameHost').gyre.randomize());
  await settle(700);
  const s = await sample();
  worlds.push({ chosen, s });
}
const unusable = worlds.filter((w) => !w.s || w.s.inkFrac < 0.004 || w.s.lumSd < 1.2);
if (unusable.length === 0) {
  ok(`five presses, five fields with ink on them: ${worlds.map((w) => `${w.chosen.palette}/${w.chosen.background} ink=${(w.s.inkFrac * 100).toFixed(1)}%`).join(' · ')}`);
} else {
  bad(`${unusable.length} of five randomize presses produced an unusable field`, JSON.stringify(unusable.map((u) => u.chosen)));
}
const pairs = [];
for (let i = 1; i < worlds.length; i++) {
  const a = worlds[i - 1].chosen, b = worlds[i].chosen;
  pairs.push(a.palette !== b.palette || a.background !== b.background);
}
if (pairs.every(Boolean)) ok('each press changed the palette or the background from the one before — a press that shows nothing is invariant 1\'s problem, not a cosmetic one');
else bad('two consecutive randomize presses produced the same colours', JSON.stringify(worlds.map((w) => [w.chosen.palette, w.chosen.background])));

const bulk = await page.evaluate(() => {
  const g = document.getElementById('gameHost').gyre;
  const bad = [];
  let prev = g.get();
  for (let i = 0; i < 2000; i++) {
    const s = g.randomize();
    if (s.count < 800 || s.count > 2600) bad.push(['count', s.count]);
    if (s.force < 0.35 || s.force > 1.35) bad.push(['force', s.force]);
    if (s.burst < 35 || s.burst > 100) bad.push(['burst', s.burst]);
    if (s.tail < 18 || s.tail > 88) bad.push(['tail', s.tail]);
    if (s.size < 26 || s.size > 86) bad.push(['size', s.size]);
    if (s.linger < 28 || s.linger > 92) bad.push(['linger', s.linger]);
    if (s.palette === prev.palette) bad.push(['palette repeated', s.palette]);
    if (s.background === prev.background) bad.push(['background repeated', s.background]);
    if (Math.abs(s.polarity) !== 1) bad.push(['polarity', s.polarity]);
    prev = s;
    if (bad.length > 8) break;
  }
  return bad;
});
if (bulk.length === 0) ok('2000 consecutive randomizes: every one inside the usable interior, and none repeated a colour');
else bad(`randomize can produce an unusable field — ${bulk.length} violation(s) in 2000`, JSON.stringify(bulk));

/* ATTRACT/REPEL VISIBLY INVERTS — roadmap P3 gate 3. Section 2 measured polarity as a
 * parameter; this measures it as the CHILD experiences it, with a finger held down,
 * because "held" multiplies the force by 2.35 and that is the state the flip is most
 * visible in. */
console.log('\n--- 4. attract/repel, with a finger held down ---');
await baseline({ force: 1.85, count: 2400, linger: 30 });
async function heldHole(polarity) {
  await setParam('polarity', polarity);
  await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
  await page.mouse.down();
  await settle(2000);
  const s = await sample(box.w * 0.5, box.h * 0.5, 120);
  await page.mouse.up();
  await settle(200);
  return s.nearFrac;
}
const knot = await heldHole(1);
await baseline({ force: 1.85, count: 2400, linger: 30 });
const hole = await heldHole(-1);
if (hole < knot * 0.4) ok(`a held finger keeps ${(knot * 100).toFixed(1)}% of the disc under it inked on ATTRACT and ${(hole * 100).toFixed(1)}% on REPEL — a knot becomes a hole`);
else bad('attract and repel do not visibly invert', `ink under a held finger: attract ${knot.toFixed(4)}, repel ${hole.toFixed(4)}`);

/* ============================================ 5. persistence across a real restart
 * PUP-WO-0300 acceptance 6 and roadmap P3 gate 4. "A full app restart" means the page
 * is loaded again, not that a variable was copied: the settings go out through
 * api.save into localStorage and come back through api.load, and the round trip is
 * where the two failures live — a debounced write that never flushed, and a load that
 * returns something other than what was stored.
 *
 * AND THE NULL CASE, WHICH IS THE ONE THAT ACTUALLY BREAKS FIRST. §8.3 says api.load()
 * may return null and the game must run correctly when it does; null is a first run,
 * private mode, a cleared store, or a store somebody wrote junk into. Three of those
 * four are ordinary. */
console.log('\n--- 5. settings across a restart, and every shape api.load() can return ---');
const WANT = { palette: 'grape', background: 'ember', count: 2200, force: 1.2, tail: 71, size: 63, linger: 44, burst: 88, polarity: -1 };
await page.evaluate((w) => { const g = document.getElementById('gameHost').gyre; for (const k of Object.keys(w)) g.set(k, w[k]); }, WANT);
/* Back, NOT a reload — the exit a child uses is also the flush path, and a debounce
 * that only survives an idle page is a debounce that loses the last thing he did. */
await page.click('#gameBack');
await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await openField();
let got = await readParams();
const kept = Object.keys(WANT).filter((k) => got[k] !== WANT[k]);
if (kept.length === 0) ok(`every setting survived a full reload: ${WANT.palette}/${WANT.background}, count ${WANT.count}, repel`);
else bad('settings did not survive a restart', `differs on ${kept.join(', ')}: ${JSON.stringify(got)}`);

const restartWith = async (raw) => {
  await page.click('#gameBack');
  await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
  await page.evaluate((v) => { if (v === null) localStorage.removeItem('pupgame:gyre'); else localStorage.setItem('pupgame:gyre', v); }, raw);
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await openField();
  await settle(400);
  return { params: await readParams(), frames: await page.evaluate(() => window.__probe.frames) };
};

let r = await restartWith(null);
const DEF = { count: 1600, force: 0.68, burst: 50, tail: 32, size: 40, linger: 60, palette: 'ice', background: 'void', polarity: 1 };
const defOff = Object.keys(DEF).filter((k) => r.params[k] !== DEF[k]);
if (defOff.length === 0) ok('api.load() returning null: the field came up on its defaults and ran');
else bad('a null api.load() did not produce the defaults', `differs on ${defOff.join(', ')}: ${JSON.stringify(r.params)}`);

r = await restartWith('this is not json at all');
if (Object.keys(DEF).every((k) => r.params[k] === DEF[k])) ok('unparseable storage: api.load() returns null and the field still came up');
else bad('unparseable storage did not fall back to the defaults', JSON.stringify(r.params));

r = await restartWith(JSON.stringify({ count: 'lots', force: null, tail: 9999, size: -40, palette: 'nope', background: 42, polarity: 7, linger: 'x' }));
const sane = r.params.count === DEF.count && r.params.force === DEF.force && r.params.tail === 100
  && r.params.size === 0 && r.params.palette === 'ice' && r.params.background === 'void'
  && r.params.polarity === 1 && r.params.linger === DEF.linger;
if (sane) ok(`a storage blob full of wrong types was clamped field by field: ${JSON.stringify(r.params)}`);
else bad('a malformed storage blob was not fully sanitised', JSON.stringify(r.params));
await settle(400);
const running = await page.evaluate(() => window.__probe.frames);
if (running > r.frames) ok(`and the field is running after every one of those (${running - r.frames} frames since)`);
else bad('the field is not animating after a malformed restore');

/* ==================================================================== 6. frame rate
 * PUP-WO-0300 §3: "record a frame-rate number for your defaults and SAY WHAT YOU
 * TRADED." The trade is written up in docs/feedback/PUP-WO-0300.md; this is the
 * measurement, and the second number is the cost of the top of the count slider. */
console.log('\n--- 6. frame rate (a regression baseline on this runner, NOT the tablet) ---');
async function fps(settings, ms) {
  await page.evaluate((s) => { const g = document.getElementById('gameHost').gyre; for (const k of Object.keys(s)) g.set(k, s[k]); }, settings);
  await settle(600);
  const a = await page.evaluate(() => window.__probe.frames);
  const t0 = Date.now();
  await settle(ms);
  const b = await page.evaluate(() => window.__probe.frames);
  return ((b - a) * 1000) / (Date.now() - t0);
}
const fpsDefault = await fps(DEF, 3000);
const fpsMax = await fps(Object.assign({}, DEF, { count: 5000, size: 100, tail: 100 }), 3000);
console.log(`  ....  defaults (count ${DEF.count}): ${fpsDefault.toFixed(1)} fps`);
console.log(`  ....  slider tops (count 5000, size 100, tail 100): ${fpsMax.toFixed(1)} fps`);
notes.push(`frame rate on this runner — defaults ${fpsDefault.toFixed(1)} fps, slider tops ${fpsMax.toFixed(1)} fps`);
if (fpsDefault >= 45) ok(`the defaults hold ${fpsDefault.toFixed(1)} fps here — the floor this check enforces is 45`);
else bad(`the defaults have fallen to ${fpsDefault.toFixed(1)} fps on this runner`,
  'a field that stutters is not delightful (PUP-WO-0300 §3). Either the defaults or the draw loop got more expensive.');
if (fpsMax >= 24) ok(`even every slider at its top holds ${fpsMax.toFixed(1)} fps — the extremes are reachable, not traps`);
else bad(`the top of the sliders drops to ${fpsMax.toFixed(1)} fps`, 'a child who drags a slider to the end must not land on a frozen toy');

/* ============================================== 7. teardown leaves nothing running
 * PUP-WO-0300 acceptance 7: "measured, not asserted." Both halves are counted by
 * instrumentation installed before the page's own scripts ran, so the module is not
 * being asked whether it tidied up — a stopped rAF loop is a frame counter that has
 * stopped climbing, and a removed listener is one that came off the window.
 *
 * A PARTICLE SIM THAT KEEPS ANIMATING AFTER TEARDOWN IS THE LEAK THE RETURNED-CLOSURE
 * DESIGN EXISTS TO PREVENT (§2.3), and it is invisible: the host is gone, the console
 * is back, and a canvas nobody can see is burning a tablet battery until reload. */
console.log('\n--- 7. teardown: measured, not asserted ---');
await page.click('#gameBack');
await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
const liveBefore = await page.evaluate(() => window.__probe.live.slice());
await openField();
await settle(800);
const liveDuring = await page.evaluate(() => window.__probe.live.slice());
await page.click('#gameBack');
await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
await settle(150);
const framesAtExit = await page.evaluate(() => window.__probe.frames);
await settle(900);
const framesLater = await page.evaluate(() => window.__probe.frames);
const liveAfter = await page.evaluate(() => window.__probe.live.slice());

if (framesLater === framesAtExit) ok(`the rAF loop stopped: ${framesLater - framesAtExit} frames in the 900 ms after teardown`);
else bad(`the animation is STILL RUNNING after teardown — ${framesLater - framesAtExit} frames in 900 ms`,
  'the host is gone and the console is back, so nothing on screen shows this. It burns battery until reload.');

const leaked = liveAfter.filter((k) => { const i = liveBefore.indexOf(k); if (i === -1) return true; liveBefore.splice(i, 1); return false; });
if (leaked.length === 0) ok(`every window/document listener the module added was removed (${liveDuring.length - liveAfter.length} added and taken back)`);
else bad(`${leaked.length} listener(s) outlived teardown`, leaked.join(', '));

const seamGone = await page.evaluate(() => {
  const h = document.getElementById('gameHost');
  return h === null || h.gyre === undefined;
});
if (seamGone) ok('the control seam is gone with the host — a stale reference cannot drive a dead session');
else bad('host.gyre survived teardown');

if (pageErrors.length === 0) ok('no uncaught page error during the whole run');
else bad(`${pageErrors.length} uncaught page error(s)`, pageErrors.slice(0, 3).join(' | '));

} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}

console.log('\n' + '='.repeat(78));
for (const n of notes) console.log(`  measured: ${n}`);
if (failures.length) {
  console.error(`::error::CHECK 16 FAILED — ${failures.length} — Gyre does not do what PUP-WO-0300 §4 requires.`);
  console.error(`\nCHECK 16 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.d || ''}`);
  console.error('\n  Do NOT relax a threshold to make this green. Every number here was chosen');
  console.error('  with margin against a measured value; a failure means the field changed,');
  console.error('  not that the check is fussy.');
  process.exit(1);
}
console.log(`CHECK 16 PASSED at ${COMMIT.slice(0, 12)} — PUP-WO-0300 §4, in a browser:`);
console.log('  api.tone schedules the pitch and duration it is given, clamps what it is not,');
console.log('  and left the twelve-cue bank alone · every parameter moves the pixels within');
console.log('  900 ms, one at a time · randomize gives five usable worlds and 2000 in-bounds');
console.log('  ones · attract and repel invert under a held finger · settings survive a real');
console.log('  restart and every shape api.load() can return · teardown stops the loop and');
console.log('  takes its listeners back.');
console.log('\n  WHAT IT DOES NOT ESTABLISH: that the toy is fun, and that it holds frame rate');
console.log('  on the tablet. The first is Scotty\'s and no check can take it; the second');
console.log('  needs the device, and the number above is a regression baseline on a desktop');
console.log('  runner, which is not the same measurement.');
