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

/* PUP-WO-0300 acceptance 10: every demonstration asserts the COMMIT it ran against.
 * FAILS CLOSED, which the sibling checks do not — they initialise COMMIT to 'unknown'
 * and pass, so a green with no identifiable subject is a claim about a tree nobody can
 * name, which is architecture §6.1 member 1 wearing a provenance line. A tree with no
 * .git (a `git archive` export, which is what §6's freeze protocol hands a read-only
 * pass) can state its subject explicitly instead. */
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) {
  try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
}
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 16 cannot identify the commit it is testing.');
  console.error('  `git rev-parse HEAD` failed and PUPPAD_SUBJECT is unset. A demonstration');
  console.error('  that cannot name its subject proves nothing about any particular tree.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}
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
  const P = { frames: 0, recs: [], timers: new Set(), intervals: new Set(), observers: 0, captures: 0, released: 0 };
  window.__probe = P;

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { P.frames++; return cb(t); });

  /* EVERY RESOURCE WORD THE CONTRACT NAMES, NOT JUST THE ONE THAT WAS EASY.
   * PUP-WO-0000 §8.1 and PUP-WO-0300 §2.3 both say a module must hold no live
   * "requestAnimationFrame, interval, timeout, event listener, observer, capture, or
   * media resource" after teardown. The first version of this probe wrapped rAF and
   * addEventListener and printed an ok line covering all of it. The adversarial pass
   * planted three leaks it could not see — a 60 Hz interval driving the sim, a
   * document.body listener, an undisconnected ResizeObserver — and this check passed
   * while measuring 4205 canvas draw calls a second on invisible canvases. An
   * instrument that cannot see the defect is architecture §6.1 member 1 with a
   * measurement's face on. */
  const st = window.setTimeout, ct = window.clearTimeout;
  const si = window.setInterval, ci = window.clearInterval;
  window.setTimeout = function (fn, ms) {
    const args = Array.prototype.slice.call(arguments, 2);
    let id;
    id = st.call(window, function () { P.timers.delete(id); if (typeof fn === 'function') return fn.apply(this, args); }, ms);
    P.timers.add(id); return id;
  };
  window.clearTimeout = function (id) { P.timers.delete(id); return ct.call(window, id); };
  window.setInterval = function () { const id = si.apply(window, arguments); P.intervals.add(id); return id; };
  window.clearInterval = function (id) { P.intervals.delete(id); return ci.call(window, id); };

  for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
    const C = window[name];
    if (!C) continue;
    window[name] = class extends C {
      observe() { if (!this.__live) { this.__live = true; P.observers++; } return super.observe.apply(this, arguments); }
      disconnect() { if (this.__live) { this.__live = false; P.observers--; } return super.disconnect(); }
    };
  }

  if (window.Element && Element.prototype.setPointerCapture) {
    const sp = Element.prototype.setPointerCapture, rp = Element.prototype.releasePointerCapture;
    Element.prototype.setPointerCapture = function () { P.captures++; return sp.apply(this, arguments); };
    Element.prototype.releasePointerCapture = function () { P.released++; return rp.apply(this, arguments); };
  }

  /* LISTENERS KEYED ON IDENTITY, INCLUDING THE CAPTURE FLAG. The first version keyed on
   * `fn.name` and threw `opts` away — but `capture` is PART of a listener's identity, so
   * `removeEventListener(type, fn)` does not remove one added with `capture: true`. That
   * is the commonest removal bug there is, and the probe recorded it as a clean removal
   * while the listener stayed attached and kept firing. Every target is recorded, not
   * just window and document: a listener on document.body is not inside the host and
   * does not die with it, and the old `tag()` returned null for it, so it could never
   * appear in a report at all. */
  const add = EventTarget.prototype.addEventListener;
  const rem = EventTarget.prototype.removeEventListener;
  const capOf = (o) => !!(o === true || (o && typeof o === 'object' && o.capture));
  const label = (t) => t === window ? 'window' : t === document ? 'document'
    : (t && t.nodeType === 1) ? (t.id ? '#' + t.id : t.tagName.toLowerCase()) : String(t && t.constructor && t.constructor.name || t);
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    P.recs.push({ t: this, type: type, fn: fn, cap: capOf(opts), label: label(this) + ':' + type + (capOf(opts) ? ':capture' : '') });
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    const cap = capOf(opts);
    for (let i = 0; i < P.recs.length; i++) {
      const r = P.recs[i];
      if (r.t === this && r.type === type && r.fn === fn && r.cap === cap) { P.recs.splice(i, 1); break; }
    }
    return rem.call(this, type, fn, opts);
  };

  /* What is still attached to something that OUTLIVES a game: window, document, or any
   * node still in the document. A listener on a node inside the host really does die
   * with the host — that part of the old comment was true — and `isConnected` is how to
   * tell those apart without assuming which nodes those are. */
  window.__liveListeners = () => P.recs
    .filter((r) => r.t === window || r.t === document || (r.t && r.t.isConnected === true))
    .map((r) => r.label);

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
        /* `immediate` marks a stop with no argument — which is what stopGameTones()
         * issues at teardown, as opposed to the scheduled stop every note gets when it
         * is created. Distinguishing them is how "the shell actually silenced it" is
         * measured rather than assumed. */
        window.__tones.push({ hz: Math.round(o.frequency.value), ms: Math.round(((t || 0) - t0) * 1000), wave: o.type, immediate: t === undefined });
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
    /* PUP-WO-0301 §2.4, second obligation. RELATIVE luminance (sRGB linearised, the
     * WCAG definition), histogrammed over the INKED pixels only, so the section below
     * can ask what fraction of the ink actually stands out from the ground it is drawn
     * on rather than merely differing from it by an L1 threshold. 256 buckets. */
    const RL = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const relLum = (r, g, b) => 0.2126 * RL(r) + 0.7152 * RL(g) + 0.0722 * RL(b);
    const inkHist = new Uint32Array(256);
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
      inkHist[Math.min(255, Math.max(0, Math.round(relLum(r, g, b) * 255)))]++;
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
    /* A PERCENTILE, NOT A MAXIMUM. A single bright speck is not a visible field, and a
     * maximum is a one-pixel claim. p10 and p90 each describe a TENTH of the ink. */
    const pct = (frac) => {
      if (!ink) return 0;
      let want = Math.max(1, Math.round(ink * frac)), seen = 0;
      for (let b2 = 0; b2 < 256; b2++) { seen += inkHist[b2]; if (seen >= want) return b2 / 255; }
      return 1;
    };
    const bgLum = relLum(br, bg, bb);
    const ratio = (a, b2) => (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05);
    /* THE FIELD MAY BE BRIGHTER OR DARKER THAN ITS GROUND — two of the ten backgrounds
     * are light, and on those the draw flips to `multiply` and the strokes are DARKER
     * than what they sit on. Taking the better of the two tails is what makes one
     * number describe both draw paths; taking only the bright tail would report a light
     * background as invisible while a child looks straight at it. */
    const contrast = ink ? Math.max(ratio(pct(0.9), bgLum), ratio(bgLum, pct(0.1))) : 1;
    return {
      inkContrast: contrast,
      inkLumP90: pct(0.9),
      inkLumP10: pct(0.1),
      bgLum: bgLum,
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
  /* PUP-WO-0201 put a picker between the button and the game. Gyre's tile is named
   * explicitly rather than taken by position — this check is about Gyre by definition, so
   * naming it is stating the subject, while `the first tile` would be assuming an
   * ordering that the picker exists precisely to stop mattering. */
  await page.waitForSelector('.pickerTile[data-game="gyre"]', { timeout: 10000 });
  await page.click('.pickerTile[data-game="gyre"]');
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

/* THE CONTROL PANEL IS ON SCREEN NOW (PUP-WO-0301) AND THIS CHECK MEASURES THE ENGINE.
 * The drawer ships open — Scotty's direction is that the controls ARE the toy — and it
 * covers the bottom of the viewport, which is where several readings below press. So
 * this check closes it, THROUGH THE HANDLE, which is a state a child reaches with one
 * tap and not a state manufactured for the test: no style is overridden, no node is
 * removed, and the panel is still mounted and still subscribed for everything that
 * follows. Its own behaviour is check 19's subject, not this one's.
 *
 * Asserted rather than assumed, because "the panel is out of the way" is a premise
 * every pixel reading below depends on, and a premise nobody checks is how a whole
 * section comes back green about nothing. */
const panelPresent = await page.$('#gameControls');
if (panelPresent) ok('the shell built a control panel from the module\'s manifest');
else bad('no control panel was built', 'PUP-WO-0301: #gameControls is absent, so every control assertion below is vacuous');
await page.click('#gameControlsHandle');
const drawerShut = await page.evaluate(() => {
  const root = document.getElementById('gameControls');
  if (!root) return null;
  const c = document.querySelector('#gameHost canvas');
  const r = c.getBoundingClientRect();
  /* Anything of the panel still standing between this check and the canvas, expressed
   * as the lowest point it can press without hitting a control. */
  let lowest = 1;
  const els = root.querySelectorAll('button,[role="slider"]');
  for (const el of els) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    /* Only what overlaps the horizontal middle, which is the column every reading uses. */
    const midX = r.left + r.width * 0.5;
    if (b.left <= midX && b.right >= midX) lowest = Math.min(lowest, (b.top - r.top) / r.height);
  }
  const dr = document.getElementById('gameControlsDrawer');
  return { open: !!dr && getComputedStyle(dr).display !== 'none', lowest };
});
if (drawerShut && drawerShut.open === false && drawerShut.lowest > 0.9) {
  ok(`one tap on the handle put the drawer away; nothing of the panel now sits above ${(drawerShut.lowest * 100).toFixed(0)}% of the canvas in the column this check reads`);
} else {
  bad('the control drawer did not close, or a control still covers the field this check measures',
    JSON.stringify(drawerShut));
}

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

/* THE SUM, NOT JUST THE CALL. Each voice is a gain of 0.12 straight to `destination`,
 * so about 8.3 simultaneous notes reach full scale and ten peak at 1.16 — hard clipping,
 * audible as a crack. Ten fingers landing together is a three-year-old drumming, and
 * Gyre plays a note per touch, so the cap is the thing that keeps a clamp per call from
 * being a false promise about loudness. */
/* Wait out the 3-second note the clamp test above deliberately scheduled, so this
 * measures the cap rather than the leftovers of the previous assertion — a failure
 * whose cause is not the one under test is the defect family this file exists to
 * avoid, and the first run of this block hit it. */
await settle(3200);
await page.evaluate(() => { window.__tones.length = 0; });
await page.evaluate(() => { for (let i = 0; i < 24; i++) playTone(600 + i, 2500, 'sine'); });
await settle(80);
const voices = await page.evaluate(() => window.__tones.filter((t) => !t.immediate).length);
/* EXACTLY six, not "at most six". A registry that never drains also reports a number
 * under the cap — and that is a permanently SILENT toy, not a safe one. Two earlier
 * versions of the pruning failed exactly that way and this assertion is what caught
 * both: `onended` never fires on a suspended context, and neither does its clock
 * advance, so the first two attempts expired nothing. */
if (voices === 6) ok(`24 notes fired at once produced ${voices} voices — the cap holds the sum under full scale instead of clipping, and the registry drains`);
else bad(`the voice cap did not behave: ${voices} simultaneous oscillators, expected 6`,
  voices < 6 ? 'FEWER than the cap means the registry is not draining — the toy goes silent, which is worse than loud'
             : 'roughly 8.3 voices at gain 0.12 reach full scale; ten peak at 1.16 and clip');

/* AND A NOTE MUST NOT OUTLIVE THE GAME. findings §8.6 rules that a cue stops "in under
 * a second — so nothing can outlive teardown, and §8.1's release guarantee is
 * satisfiable". api.tone raised that to three seconds, so the guarantee needs a handle
 * rather than an argument. §8.1 lists "media resource" among what teardown must release. */
await page.evaluate(() => { window.__tones.length = 0; playTone(300, 3000, 'sine'); });
await settle(120);
await page.click('#gameBack');
await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
await settle(200);
const silenced = await page.evaluate(() => window.__tones.some((t) => t.immediate));
if (silenced) ok('a three-second note in flight was stopped when the child pressed back — audio does not play over the console');
else bad('a note scheduled by a game kept playing after teardown', 'PUP-WO-0000 §8.1 lists "media resource" among what teardown must release');
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await openField();

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
  /* PINNED EXPLICITLY, INCLUDING THE FIVE PUP-WO-0301 ADDED. A baseline that leaves a
   * parameter to whatever the previous trial left is the leftovers defect this function
   * exists to stop, and `glow` in particular is decoration that sits on the exact spot
   * the polarity trial reads. This check measures the ENGINE; check 19 measures what
   * happens when a child turns these on. */
  const base = { count: 1600, force: 0.68, burst: 50, tail: 32, size: 40, linger: 60, palette: 'ice', background: 'void', polarity: 1,
                 ripple: 1, glow: 0, spin: 0, shape: 'streak' };
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
    if (s.count < 800 || s.count > 1800) bad.push(['count', s.count]);
    /* THE DRAW BUDGET, ASSERTED. Before it existed randomize could draw count 2600 with
     * size 86 and tail 88, which measured 17.9 fps on a throttled runner — a stutter
     * nobody chose, produced by the one control a child presses for a surprise. §3
     * lists performance among the things the latitude does not relax. */
    if (s.count * (1 + s.size / 100 + s.tail / 100) > 3400) bad.push(['over the draw budget', [s.count, s.size, s.tail]]);
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

/* ================================ THE STEADY STATE, NOT THE TRANSIENT
 * The five presses above are all sampled 700 ms after a reseed — the field at its most
 * spread — and that is structurally unable to see the defect this section exists to
 * prevent. A reviewer found an ALL-BLACK screen reachable from an ordinary randomize
 * result: repel, left alone, migrated the entire field into the twenty-pixel margin
 * outside the canvas that the wrap needs to hide its seam. Thirty seconds, maximum
 * luminance equal to the background, and a tap bought a 400 ms flash before it went
 * black again. Half of every randomize press sets repel.
 *
 * "No all-black" (PUP-WO-0300 §3) is a claim about where the field ENDS UP, so it has
 * to be measured late. Twenty seconds of CI time is what that costs. */
console.log('\n--- 3b. left alone in repel for 20 seconds: the state the transient cannot see ---');
await baseline({ count: 1200, force: 1.35, tail: 53, size: 56, linger: 60, palette: 'ice', background: 'void' });
await setParam('polarity', -1);
await settle(20000);
const settled = await sample();
if (settled && settled.inkFrac > 0.0015 && settled.lumSd > 2) {
  ok(`after 20 s of repel with nobody touching it, the field is still on screen: ${(settled.inkFrac * 100).toFixed(2)}% ink, luminance spread ${settled.lumSd.toFixed(1)}`);
} else {
  bad('repel left alone empties the screen', `ink ${(settled ? settled.inkFrac * 100 : 0).toFixed(3)}%, lumSd ${(settled ? settled.lumSd : 0).toFixed(2)} — the field has left the canvas or stopped being drawn`);
}
await page.mouse.click(box.x + box.w * 0.35, box.y + box.h * 0.35);
await settle(300);
const revived = await sample();
if (revived && revived.inkFrac > settled.inkFrac * 1.5) ok(`and one tap brings it back — ${(settled.inkFrac * 100).toFixed(2)}% to ${(revived.inkFrac * 100).toFixed(2)}%`);
else bad('a tap does not revive a settled repel field', `${(settled.inkFrac * 100).toFixed(3)}% -> ${(revived ? revived.inkFrac * 100 : 0).toFixed(3)}%`);

/* ============================== 3c. INK AGAINST GROUND, NOT INK
 * PUP-WO-0301 §2.4, second obligation, and it is architecture §6.1 MEMBER 6 — the
 * member this project named: an assertion that measures PRESENCE where the property is
 * something else. Everything above counts "ink", and ink is defined as a pixel whose
 * channels differ from the background's by an L1 total of 40. That is a PRESENCE test.
 * A palette drawn in near-black on a dark ground clears it comfortably and is invisible
 * to a child looking at the tablet — 40/765 of the way from the ground is a difference
 * a sampler can see and an eye cannot.
 *
 * The property is CONTRAST AGAINST THE GROUND THAT WAS CHOSEN, and 0301 is where it
 * becomes testable because 0301 is where a child picks a palette and a background
 * independently, from two strips, with no adult reading the combination first. Eleven
 * palettes and ten backgrounds is a hundred and ten pairs, and the child can reach
 * every one of them in two taps.
 *
 * So: every pair, measured. The floor is a WCAG contrast ratio computed from RELATIVE
 * luminance, between the ground and the tenth of the ink furthest from it — better of
 * the bright and dark tails, because two of the ten backgrounds are light and flip the
 * draw to `multiply`. 1.0 is invisible; 3.0 is WCAG's floor for a graphical object.
 * These are not text and a particle field is not a UI icon, so the bar is set where a
 * field is unmistakably there rather than where a glyph would be legible — and the
 * measured worst pair is printed on a green so the margin is a fact and not a hope. */
console.log('\n--- 3c. every palette on every background: ink-versus-GROUND, not ink ---');
const CONTRAST_FLOOR = 1.9;
const combos = await page.evaluate(() => {
  const g = document.getElementById('gameHost').gyre;
  return { p: g.palettes.map((x) => x.id), b: g.backgrounds.map((x) => x.id) };
});
const contrasts = [];
for (const pid of combos.p) {
  for (const bid of combos.b) {
    await baseline({ palette: pid, background: bid, count: 1600, size: 40, tail: 32, linger: 60, polarity: 1 });
    /* Long enough for the trails to build to their steady density at linger 60 — the
     * frame right after a palette change is a fade, and a fade is a transient. */
    await settle(420);
    const sm = await sample();
    contrasts.push({ pid, bid, c: sm ? sm.inkContrast : 0, ink: sm ? sm.inkFrac : 0 });
  }
}
contrasts.sort((a, b) => a.c - b.c);
const dim = contrasts.filter((x) => x.c < CONTRAST_FLOOR);
if (dim.length === 0) {
  const w = contrasts[0];
  ok(`all ${contrasts.length} palette/background pairs clear a ${CONTRAST_FLOOR}:1 ink-to-ground contrast ratio; the worst is ${w.pid} on ${w.bid} at ${w.c.toFixed(2)}:1 with ${(w.ink * 100).toFixed(1)}% ink`);
} else {
  bad(`${dim.length} palette/background pair(s) draw ink that does not stand out from the ground a child chose`,
    dim.slice(0, 6).map((x) => `${x.pid}/${x.bid} ${x.c.toFixed(2)}:1 (ink ${(x.ink * 100).toFixed(1)}%)`).join(' · '));
}
/* THE ASSERTION MUST BE ABLE TO FAIL, and "presence passes where contrast does not" is
 * exactly the claim being made, so it is measured rather than asserted: a palette
 * forced to the ground's own colour is INKED by the old test and invisible by the new
 * one. If this ever stops holding, the floor above is measuring nothing. */
const camo = await page.evaluate(async () => {
  const c = document.querySelector('#gameHost canvas');
  const ctx = c.getContext('2d');
  /* Drawn directly: a field of strokes 40/765 away from the ground in L1 — which is
   * what "ink" means to every other assertion in this file — on the ground itself. */
  const bg = [7, 8, 10];
  /* THE COMPOSITE STATE IS THE SIM'S, NOT THIS FIXTURE'S. draw() leaves the context on
   * `lighter` (or `multiply` on a light ground), so a fillRect here ADDS to the field
   * instead of replacing it and the fixture paints something other than what it says it
   * paints. Reset explicitly — a fixture that inherits state is a fixture whose subject
   * is whatever ran last. */
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
  ctx.fillRect(0, 0, c.width, c.height);
  /* FILLED RECTANGLES ON WHOLE PIXELS, not strokes: an antialiased stroke lands most of
   * its pixels BETWEEN the two colours, and the first version of this fixture measured
   * 0.00% ink — a red demonstration that failed for its own reasons rather than the one
   * under test, which is §6.1 member 3. +20 per channel is an L1 distance of 60, half as
   * far again as the 40 every other assertion in this file calls ink. */
  ctx.fillStyle = `rgb(${bg[0] + 20},${bg[1] + 20},${bg[2] + 20})`;
  for (let i = 0; i < 6000; i++) {
    const x = Math.round(Math.random() * (c.width - 8));
    const y = Math.round(Math.random() * (c.height - 6));
    ctx.fillRect(x, y, 8, 6);
  }
  const out = window.__sample(undefined, undefined, undefined);
  /* The fixture reports what it actually painted, so a red here can be told apart from a
   * red caused by the fixture failing to paint at all. */
  const px = ctx.getImageData(0, 0, 4, 1).data;
  return Object.assign({ corner: [px[0], px[1], px[2]] }, out);
});
if (camo && camo.inkFrac > 0.01 && camo.inkContrast < CONTRAST_FLOOR) {
  ok(`the new assertion can fail where the old one cannot: a field drawn at the presence threshold reads ${(camo.inkFrac * 100).toFixed(1)}% INK and only ${camo.inkContrast.toFixed(2)}:1 contrast`);
} else {
  bad('the contrast assertion could not be shown red against a field that is present but invisible',
    `inkFrac ${(camo ? camo.inkFrac * 100 : 0).toFixed(2)}%, contrast ${(camo ? camo.inkContrast : 0).toFixed(2)}:1, ground read as ${JSON.stringify(camo && camo.bg)}, corner pixel ${JSON.stringify(camo && camo.corner)} — presence and contrast are not being measured differently`);
}

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
const DEF = { count: 1200, force: 0.68, burst: 50, tail: 32, size: 40, linger: 60, palette: 'ice', background: 'void', polarity: 1 };
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
/* THE MEDIAN OF THREE, NOT ONE READING, AND THE FLOORS ARE SET FOR A SLOW RUNNER.
 * A reviewer measured identical settings varying 27% run to run on one machine, and the
 * same throttled default reading 49.7 fps on the author's box and 39.9 on his. The
 * first version of this check reported one sample to a tenth of a frame and set its
 * floors 3-4% under the author's reading, while telling the next reader "every number
 * here was chosen with margin against a measured value". That would have gone red on a
 * slower runner for a reason unrelated to what it tests — a failure whose cause is not
 * the one under test, which is architecture §6.1 member 3.
 *
 * THE NUMBER TO WATCH IS THE ONE PRINTED, NOT THE PASS. The floors catch a collapse;
 * the printed values are the regression signal a human reads. */
async function fpsOnce(settings, ms) {
  await page.evaluate((s) => { const g = document.getElementById('gameHost').gyre; for (const k of Object.keys(s)) g.set(k, s[k]); }, settings);
  await settle(500);
  const a = await page.evaluate(() => window.__probe.frames);
  const t0 = Date.now();
  await settle(ms);
  const b = await page.evaluate(() => window.__probe.frames);
  return ((b - a) * 1000) / (Date.now() - t0);
}
async function fps(settings, ms) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await fpsOnce(settings, ms));
  runs.sort((x, y) => x - y);
  return { median: runs[1], spread: runs[2] - runs[0], runs };
}
const fpsDefault = await fps(DEF, 2000);
const fpsMax = await fps(Object.assign({}, DEF, { count: 5000, size: 100, tail: 100 }), 2000);
const fmt = (r) => `${r.median.toFixed(1)} fps (3 runs, spread ${r.spread.toFixed(1)})`;
console.log(`  ....  defaults (count ${DEF.count}): ${fmt(fpsDefault)}`);
console.log(`  ....  slider tops (count 5000, size 100, tail 100): ${fmt(fpsMax)}`);
notes.push(`unthrottled — defaults ${fmt(fpsDefault)}, slider tops ${fmt(fpsMax)}`);
if (fpsDefault.median >= 35) ok(`the defaults hold ${fmt(fpsDefault)} — the floor is 35, set for a runner slower than this one`);
else bad(`the defaults have fallen to ${fmt(fpsDefault)}`,
  'a field that stutters is not delightful (PUP-WO-0300 §3). Either the defaults or the draw loop got more expensive.');
if (fpsMax.median >= 18) ok(`even every slider at its top holds ${fmt(fpsMax)} — the extremes are reachable, not traps`);
else bad(`the top of the sliders drops to ${fmt(fpsMax)}`, 'a child who drags a slider to the end must not land on a frozen toy');

/* AND THE SAME NUMBERS ON A SLOW MACHINE, WHICH IS THE ONE THAT MATTERS. Unthrottled,
 * this runner sits at the vsync cap for every setting up to 5000 particles — a number
 * that says the runner is fast, not that the field is cheap, and a regression could
 * hide entirely underneath it. A 6x CPU throttle is a crude, arbitrary, REPEATABLE
 * stand-in for a cheap tablet: it is not the device and it is not claimed to be, but
 * it is the only place on this runner where the cost of a change is visible at all.
 *
 * The randomize case is the one that found a real defect. Before the draw budget
 * existed the randomizer could land on count 2600 with size 86 and tail 88 — 17.9 fps,
 * a stutter nobody chose, from the one control a child presses precisely because he is
 * not choosing. */
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
const slowDefault = await fps(DEF, 1800);
/* THE HEAVIEST FIELD RANDOMIZE CAN ACTUALLY PRODUCE, which is a point ON the budget
 * line and not the corner of the bounds. count 1800 with size 86 and tail 88 costs
 * 4932 against a budget of 3400 — randomize cannot draw it, so testing it would be
 * measuring a state the code refuses and calling the number a fact about the game. */
const slowWorst = await fps(Object.assign({}, DEF, { count: 1200, size: 86, tail: 88, linger: 92 }), 1800);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log(`  ....  6x throttled, defaults: ${fmt(slowDefault)}`);
console.log(`  ....  6x throttled, the heaviest field randomize can draw: ${fmt(slowWorst)}`);
notes.push(`6x throttled — defaults ${fmt(slowDefault)}, randomize's heaviest ${fmt(slowWorst)}`);
if (slowDefault.median >= 28) ok(`throttled 6x the defaults still hold ${fmt(slowDefault)} — the floor is 28`);
else bad(`throttled 6x the defaults fall to ${fmt(slowDefault)}`, 'the default count is too high for a slow device, or the draw loop got more expensive');
if (slowWorst.median >= 20) ok(`throttled 6x, the heaviest field randomize can produce still holds ${fmt(slowWorst)} — the draw budget is doing its job`);
else bad(`throttled 6x, randomize can produce a ${fmt(slowWorst)} fps field`, 'DRAW_BUDGET in games/gyre.js is too generous, or the draw loop got more expensive');

/* ============================================== 7. teardown leaves nothing running
 * PUP-WO-0300 acceptance 7: "measured, not asserted." Every claim below is a number
 * taken by instrumentation installed before the page's own scripts ran, so the module
 * is not being asked whether it tidied up.
 *
 * FIVE CYCLES, NOT ONE, AND THAT IS THE POINT. The first version opened the game once,
 * closed it once, and asserted the counters were zero. A leak that is invisible on the
 * first cycle and linear thereafter — which is the shape of every leak that matters
 * here, because the cost of one is that it REPEATS — was out of its reach by
 * construction. A child opens and closes a toy twenty times in an afternoon. */
console.log('\n--- 7. teardown: measured over five open/close cycles, not asserted once ---');
await page.click('#gameBack');
await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });

const snapshot = () => page.evaluate(() => ({
  listeners: window.__liveListeners(),
  timers: window.__probe.timers.size,
  intervals: window.__probe.intervals.size,
  observers: window.__probe.observers,
  frames: window.__probe.frames,
  captures: window.__probe.captures,
  released: window.__probe.released,
}));

const base = await snapshot();
const cycles = [];
for (let c = 0; c < 5; c++) {
  await openField();
  await settle(700);
  /* Real interaction, so the cycle acquires everything a session can: a pointer
   * capture, a burst, a ring, a tone, and a pending debounced save. */
  await page.mouse.move(box.x + box.w * 0.4, box.y + box.h * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.6, box.y + box.h * 0.45);
  await settle(150);
  await page.mouse.up();
  await setParam('count', 1500 + c * 50);
  await page.click('#gameBack');
  await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
  await settle(150);
  const atExit = await page.evaluate(() => window.__probe.frames);
  await settle(700);
  const after = await snapshot();
  cycles.push({ c: c + 1, framesAfter: after.frames - atExit, after });
}

const last = cycles[cycles.length - 1].after;
/* The filter SPLICES its way through a copy — an earlier version drained `base` itself
 * and then printed its length as the baseline, reporting 0 listeners for a page that
 * had 26. A measurement that its own reporting line destroys is worse than no line. */
const baseRemaining = base.listeners.slice();
const baseCount = base.listeners.length;
const leaked = last.listeners.filter((k) => { const i = baseRemaining.indexOf(k); if (i === -1) return true; baseRemaining.splice(i, 1); return false; });
const stillAnimating = cycles.filter((c) => c.framesAfter > 0);

console.log(`  ....  baseline: ${baseCount} listeners, ${base.timers} timers, ${base.intervals} intervals, ${base.observers} observers`);
for (const c of cycles) {
  console.log(`  ....  cycle ${c.c}: frames after teardown ${c.framesAfter}, listeners ${c.after.listeners.length}, timers ${c.after.timers}, intervals ${c.after.intervals}, observers ${c.after.observers}`);
}

if (stillAnimating.length === 0) ok('the rAF loop stopped in every cycle: 0 frames in the 700 ms after each teardown');
else bad(`the animation is STILL RUNNING after teardown in ${stillAnimating.length} of 5 cycles`,
  `frames per cycle: ${cycles.map((c) => c.framesAfter).join(', ')} — the host is gone and the console is back, so nothing on screen shows this.`);

if (leaked.length === 0) ok(`no listener on window, document or any node still in the page outlived teardown, over five cycles (${last.listeners.length} live, baseline ${baseCount})`);
else bad(`${leaked.length} listener(s) outlived teardown`, leaked.join(', '));

if (last.intervals === base.intervals) ok(`no interval outlived teardown (${last.intervals}, unchanged over five cycles)`);
else bad(`${last.intervals - base.intervals} interval(s) outlived teardown`, 'an interval keeps running with the host gone — step() does not consult `running`, so a timer-driven sim draws forever');
if (last.timers <= base.timers + 1) ok(`no timeout accumulated (${last.timers} live against a baseline of ${base.timers}) — the save debounce is cleared and flushed`);
else bad(`${last.timers - base.timers} timeout(s) outlived teardown`, 'the save debounce or another timer is not cleared');
if (last.observers === base.observers) ok(`no observer outlived teardown (${last.observers}, unchanged over five cycles)`);
else bad(`${last.observers - base.observers} observer(s) outlived teardown`, 'a ResizeObserver on a removed host still fires on viewport changes');

/* Pointer capture is REPORTED, NOT ASSERTED, and the distinction is deliberate. The
 * browser releases a capture implicitly on pointerup and on node removal, so a live
 * count is not a defect signal — it would be a flaky assertion dressed as a measurement.
 * What is worth seeing is that the module now releases by name rather than relying on
 * that side effect. */
console.log(`  ....  pointer captures taken ${last.captures}, released by name ${last.released} (implicit release also occurs; not asserted)`);

/* THE SEAM, TESTED FOR WHAT THE MESSAGE CLAIMS. The old assertion read
 * `host.gyre === undefined` and printed a line about stale references — the property
 * being gone says nothing about a reference somebody captured, and the adversarial pass
 * drove every method on one after teardown: it mutated the settings, created a fresh
 * unowned 300 ms timer, refilled the watcher array, and overwrote the child's saved
 * settings AFTER he had left. This drives a captured reference and asserts it is inert. */
await page.evaluate(() => { window.__stale = null; });
await openField();
await settle(400);
await page.evaluate(() => { window.__stale = document.getElementById('gameHost').gyre; });
await page.click('#gameBack');
await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 });
await settle(200);
/* The sentinel goes in AFTER teardown has flushed. Written before, teardown's own
 * flushSave legitimately overwrites it and the test fails for the wrong reason — which
 * is what the first version of this did, and is the defect family it is testing for. */
await page.evaluate(() => localStorage.setItem('pupgame:gyre', JSON.stringify({ count: 2450, palette: 'jade', background: 'pine' })));
const stale = await page.evaluate(() => {
  const g = window.__stale;
  const before = window.__probe.timers.size;
  let fired = 0;
  const out = { prop: document.getElementById('gameHost') === null || document.getElementById('gameHost').gyre === undefined };
  out.setReturned = g.set('count', 4321);
  g.subscribe(() => { fired++; });
  g.randomize();
  g.toggle();
  out.subFired = fired;
  out.newTimers = window.__probe.timers.size - before;
  return out;
});
await settle(500);
const stored = await page.evaluate(() => localStorage.getItem('pupgame:gyre'));
const inert = stale.prop && stale.setReturned === false && stale.subFired === 0 && stale.newTimers === 0 && /"count":2450/.test(stored || '');
if (inert) ok('a reference CAPTURED before teardown is inert: set refused, subscribe refused, randomize refused, no timer created, and the saved settings were not touched');
else bad('a stale reference to a dead session can still drive it', JSON.stringify({ ...stale, stored }));

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
console.log('  restart and every shape api.load() can return · and over five open/close');
console.log('  cycles teardown left no rAF, no listener on anything that outlives the host,');
console.log('  no interval, no timeout and no observer, and a reference captured before');
console.log('  teardown could not drive the dead session.');
console.log('\n  WHAT IT DOES NOT ESTABLISH: that the toy is fun, and that it holds frame rate');
console.log('  on the tablet. The first is Scotty\'s and no check can take it; the second');
console.log('  needs the device, and the number above is a regression baseline on a desktop');
console.log('  runner, which is not the same measurement.');
