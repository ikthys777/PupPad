#!/usr/bin/env node
/**
 * CHECK 19 — Gyre's control panel, in a real browser, pressed with a FINGER.
 *
 * PUP-WO-0301 §3 is the acceptance list this file answers. Every item on it is a claim
 * about a surface a three-year-old operates by touch and cannot read, so:
 *
 *   NOTHING HERE IS PRESSED WITH `page.click`. A browser synthesises no `click` while a
 *   second finger is on the glass and none for a tap that slides more than ~15px, and
 *   both are Buddy's ordinary gesture. #gameBack was inert to both for two work orders
 *   while every check passed — architecture §6.1 member 6, and §5's first probe here is
 *   that founding case turned on the controls this work order adds.
 *
 *   THE SWEEP IS DRIVEN BY THE MANIFEST, NOT BY A LIST IN THIS FILE. `gyre.controls` is
 *   what the shell renders from; iterating it is what makes "per parameter, not as a
 *   class" (§3.2) stay true when a control is added, and what makes a control that is in
 *   the manifest but never reached the screen a failure rather than a silence.
 *
 * WHAT IT CANNOT DO IS §3.8. That gate covers the text and asks a person who has not
 * seen the app to operate the surface. A model predicting what a stranger would do is
 * not evidence about a stranger, and §7 makes simulating it a flag-and-stop. It stays
 * open until a human runs it. What this file CAN do is check the premise that gate
 * rests on: that there is no painted word anywhere on the surface. It does.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
import { requireSubject } from './lib/subject.mjs';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const COMMIT = requireSubject(REPO, 'CHECK 19');
console.log(`CHECK 19 — Gyre's controls, pressed with a finger. subject ${COMMIT.slice(0, 12)}\n`);

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
      'Cache-Control': 'no-store' }).end(await readFile(full));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

const browser = await chromium.launch({ channel: 'chromium' });
/* A TOUCH CONTEXT. `(pointer: coarse)` must match or this is measuring a device nobody
 * owns — and the glow, which §2.2b turns into a control, draws differently on each. */
/* THE FLEET, AND NOTHING ELSE. Architecture §3: three phones at 869x412, 915x412 and
 * 883x412. This file ran 1024x640 and swept 800x480 / 1024x600 / 640x480 — THE SHORTEST
 * IT HAD EVER SEEN WAS 480 AND THE FLEET IS 412 — which is exactly where the drawer's
 * `max-height:78vh` starts to bind, so every panel measurement this project has reported
 * was taken in the regime where the cap does not. That is the root cause of the picker
 * defect Scotty found and of the clipped dice, and it is architecture §5 in one line: a
 * number is only ever correct at the viewport it was measured at. */
const ctx = await browser.newContext({ viewport: { width: 869, height: 412 }, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const wait = (ms) => page.waitForTimeout(ms);

/* THE PIXEL SAMPLER. Deliberately GENERIC: check 16 owns the per-parameter physics and
 * has a tailored metric for each. What this file has to show is that pressing the
 * CONTROL moves the field at all, so one feature vector serves every parameter and the
 * distance between two of them is the evidence. */
const SAMPLER = () => {
  /* THE POINTER'S POSITION IS AN ARGUMENT NOW, and it had to become one. Three of these
   * controls are POINTER-LOCAL — `burst` is what a tap does under the finger, `ripple` is
   * a ring around it, `glow` is a halo around it — and all three were being averaged into
   * a 1024x640 frame where they are a few percent of the pixels. Worse, the one local
   * term this sampler had was centred on the CANVAS, while the finger is at 28% of its
   * height, so the "near the pointer" reading was taken somewhere the pointer was not.
   * A metric that looks in the wrong place is not a weak metric, it is a different one. */
  window.__cs = (pxCss, pyCss) => {
    const c = document.querySelector('#gameHost canvas');
    if (!c || !c.width) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height, STEP = 4;
    const rs = [], gs = [], bs = [];
    for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
      const i = (y * W + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
    }
    const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
    const br = med(rs), bg = med(gs), bb = med(bs);
    let ink = 0, total = 0, lum = 0, lum2 = 0, hx = 0, hy = 0, cx = 0, cy = 0;
    let nearInk = 0, nearTotal = 0, ringInk = 0, ringTotal = 0, ringLum = 0;
    const rect0 = c.getBoundingClientRect();
    const sc = c.width / rect0.width;
    const ox = pxCss === undefined ? W / 2 : (pxCss - rect0.left) * sc;
    const oy = pyCss === undefined ? H / 2 : (pyCss - rect0.top) * sc;
    /* Under the finger, and the halo around it. The glow's clear core runs to 126px and
     * its band to 210; the ripple crosses both on its way out. */
    const R = 100 * sc, R1 = 110 * sc, R2 = 240 * sc;
    for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
      const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      total++;
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      lum += L; lum2 += L * L;
      const dP = Math.hypot(x - ox, y - oy);
      const near = dP <= R;
      const ring = dP > R1 && dP <= R2;
      if (near) nearTotal++;
      if (ring) { ringTotal++; ringLum += L; }
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) < 40) continue;
      ink++; if (near) nearInk++; if (ring) ringInk++;
      cx += x; cy += y;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let h = 0;
      if (mx !== mn) {
        const dd = mx - mn;
        if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4;
        h *= 60; if (h < 0) h += 360;
      }
      hx += Math.cos(h * Math.PI / 180); hy += Math.sin(h * Math.PI / 180);
    }
    const mL = lum / total;
    return {
      ink: ink / total,
      lumSd: Math.sqrt(Math.max(0, lum2 / total - mL * mL)),
      meanLum: mL,
      hueX: ink ? hx / ink : 0,
      hueY: ink ? hy / ink : 0,
      near: nearTotal ? nearInk / nearTotal : 0,
      ringInk: ringTotal ? ringInk / ringTotal : 0,
      ringLum: ringTotal ? ringLum / ringTotal : 0,
      cx: ink ? cx / ink / W : 0.5,
      cy: ink ? cy / ink / H : 0.5,
      bg: [br, bg, bb],
    };
  };
};
await ctx.addInitScript(SAMPLER);

/* Distance between two field readings, each term scaled so no one term can dominate.
 * A parameter that moves none of these did not visibly change the field. */
function fieldDistance(a, b) {
  if (!a || !b) return 0;
  const t = [
    [a.ink, b.ink, 0.02],
    [a.lumSd, b.lumSd, 3],
    [a.meanLum, b.meanLum, 3],
    [a.hueX, b.hueX, 0.15],
    [a.hueY, b.hueY, 0.15],
    [a.near, b.near, 0.05],
    [a.ringInk, b.ringInk, 0.04],
    [a.ringLum, b.ringLum, 2],
    [a.cx, b.cx, 0.03],
    [a.cy, b.cy, 0.03],
  ];
  let m = 0;
  for (const [x, y, scale] of t) m = Math.max(m, Math.abs(x - y) / scale);
  return m;
}

const seamGet = () => page.evaluate(() => document.getElementById('gameHost').gyre.get());
/* The sampler is told where the finger is; every reading in the sweep is taken around
 * the same point the touch is held at. */
let PROBE = { x: undefined, y: undefined };
const sample = () => page.evaluate((p) => window.__cs(p.x, p.y), PROBE);
const rect = (sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}, sel);

/* --- FINGERS ------------------------------------------------------------- */
/* A TAP THAT LANDS. `rect()` alone answers "where is this element", which is not the
 * same question as "will pressing there press it" — the drawer scrolls, and a control
 * below the fold has a bounding rectangle off the bottom of the screen. This check spent
 * three runs reporting `spin` as a control that changes nothing while never once
 * touching it: architecture §6.1 member 6, in the file written to hold the line on
 * member 6. So the element is brought into view first, exactly as a finger on the drawer
 * would bring it, and the point about to be pressed is confirmed to BE the element. */
async function tapTarget(sel) {
  return page.evaluate((s2) => {
    const e = document.querySelector(s2);
    if (!e) return null;
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = e.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx, cy,
      onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      topmost: !!(top && (top === e || e.contains(top) || top.contains(e))) };
  }, sel);
}
async function fingerTap(sel, { slide = 0, extraFinger = null } = {}) {
  const r = await tapTarget(sel);
  if (!r || !r.onScreen || !r.topmost) return false;
  if (extraFinger) await touch('touchStart', [{ x: extraFinger.x, y: extraFinger.y, id: 9 }]);
  const pts = extraFinger
    ? [{ x: extraFinger.x, y: extraFinger.y, id: 9 }, { x: r.cx, y: r.cy, id: 1 }]
    : [{ x: r.cx, y: r.cy, id: 1 }];
  await touch('touchStart', pts);
  await wait(40);
  if (slide) {
    await touch('touchMove', pts.map((p) => (p.id === 1 ? { x: p.x + slide, y: p.y + slide, id: 1 } : p)));
    await wait(40);
  }
  await touch('touchEnd', extraFinger ? [{ x: extraFinger.x, y: extraFinger.y, id: 9 }] : []);
  if (extraFinger) { await wait(50); await touch('touchEnd', []); }
  await wait(120);
  return true;
}

/* A real drag along a slider track, in steps, as a finger does it. */
async function fingerDrag(sel, fromFrac, toFrac) {
  const r = await tapTarget(sel);
  if (!r || !r.onScreen || !r.topmost) return false;
  const y = r.cy;
  const x0 = r.x + r.w * fromFrac, x1 = r.x + r.w * toFrac;
  await touch('touchStart', [{ x: x0, y, id: 1 }]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [{ x: x0 + (x1 - x0) * (i / 8), y, id: 1 }]);
    await wait(16);
  }
  await touch('touchEnd', []);
  await wait(60);
  return true;
}

const openGyre = async () => {
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await fingerTap('.pad-btn[data-id="7"]');
  await page.waitForSelector('.pickerTile[data-game="gyre"]', { timeout: 10000 });
  await fingerTap('.pickerTile[data-game="gyre"]');
  await page.waitForFunction(() => {
    const h = document.getElementById('gameHost');
    return !!(h && h.gyre && h.querySelector('canvas'));
  }, { timeout: 10000 });
  await page.waitForSelector('#gameControls', { timeout: 5000 });
};

const consoleReachable = () => page.evaluate(() => {
  const p = document.querySelector('.pad-btn[data-id="7"]');
  if (!p) return false;
  if (document.getElementById('gamesChrome')) return false;
  const r = p.getBoundingClientRect();
  const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return !!(e && p.contains(e));
});

try {
await openGyre();

/* ================================================= 1. the manifest reached the screen */
console.log('--- 1. every control in the manifest is on the screen, and nothing else is ---');
const manifest = await page.evaluate(() => document.getElementById('gameHost').gyre.controls.map((c) => ({
  kind: c.kind, key: c.key || null, method: c.method || null, from: c.from || null,
  single: !!c.single, prominent: !!c.prominent, temporal: !!c.temporal,
  options: c.options ? c.options.map((o) => String(o.id)) : null,
})));
const rendered = await page.evaluate(() => {
  const root = document.getElementById('gameControls');
  const out = {};
  for (const el of root.querySelectorAll('[data-control]')) {
    const k = el.dataset.control;
    (out[k] = out[k] || []).push({ tag: el.tagName, value: el.dataset.value ?? null, hex: el.dataset.hex ?? null });
  }
  return out;
});
const missing = [];
for (const c of manifest) {
  const name = c.key || c.method;
  if (!rendered[name]) { missing.push(name); continue; }
  if (c.kind === 'choice' && !c.single) {
    const want = c.options ? c.options.length
      : (await page.evaluate((f) => document.getElementById('gameHost').gyre[f].length, c.from));
    if (rendered[name].length !== want) missing.push(`${name} rendered ${rendered[name].length} of ${want} options`);
  }
}
if (!missing.length) ok(`all ${manifest.length} manifest entries reached the screen, options included`);
else bad('the shell did not render every control the module published', missing.join(' · '));

/* NO PAINTED WORD. §3.8 asks a stranger to operate this surface with the text covered;
 * the premise underneath is that there is no text to cover. Asserted, not assumed: every
 * text node inside the panel must be a glyph the manifest itself supplied. */
const strayText = await page.evaluate(() => {
  const root = document.getElementById('gameControls');
  const allowed = new Set();
  for (const c of document.getElementById('gameHost').gyre.controls) {
    if (typeof c.icon === 'string') allowed.add(c.icon);
    if (c.options) for (const o of c.options) if (typeof o.icon === 'string') allowed.add(o.icon);
  }
  allowed.add('▾'); allowed.add('🎛️');
  const stray = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.trim();
    if (t && !allowed.has(t)) stray.push(t);
  }
  return stray;
});
if (!strayText.length) ok('no painted text anywhere on the panel — every text node is a glyph the manifest supplied');
else bad('the control panel paints text a non-reader cannot read', JSON.stringify(strayText.slice(0, 8)));

/* EVERY CONTROL CAN BE BROUGHT UNDER A FINGER. Rendering is not reachability: sixteen
 * controls with no words do not fit a short viewport, so the drawer scrolls — and a
 * drawer that scrolls only with a mouse wheel is a set of controls a child cannot reach.
 * The pan is performed with a touch point, and then every control is required to become
 * both on screen and the topmost thing at its own centre. */
const drawerScroll = await page.evaluate(() => {
  const d = document.getElementById('gameControlsDrawer');
  return { scrollH: d.scrollHeight, clientH: d.clientHeight };
});
/* NO SLOP. `+ 2` meant that a drawer overflowing by ONE pixel — which is exactly what it
 * did at 1024x640 — took the "everything fits" branch and the pan assertion below never
 * executed on any run. Two deliverables cited that assertion as proof the pan works. */
if (drawerScroll.scrollH > drawerScroll.clientH) {
  const dr = await rect('#gameControlsDrawer');
  await touch('touchStart', [{ x: dr.cx, y: dr.y + dr.h * 0.75, id: 1 }]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: dr.cx, y: dr.y + dr.h * 0.75 - i * 18, id: 1 }]);
    await wait(16);
  }
  await touch('touchEnd', []);
  await wait(250);
  const moved = await page.evaluate(() => document.getElementById('gameControlsDrawer').scrollTop);
  if (moved > 4) ok(`the drawer holds more than the screen (${drawerScroll.scrollH}px in ${drawerScroll.clientH}px) and a FINGER pans it: scrollTop 0 -> ${Math.round(moved)}`);
  else bad('the drawer overflows and a finger cannot pan it', `scrollHeight ${drawerScroll.scrollH}, clientHeight ${drawerScroll.clientH}, scrollTop stayed ${moved}`);
} else {
  ok(`every control fits with no scrolling at all (${drawerScroll.scrollH}px of content in ${drawerScroll.clientH}px)`);
}
const unreachable = [];
for (const c of manifest) {
  const name = c.key || c.method;
  const sels = [];
  if (c.kind === 'action') sels.push(`button[data-control="${name}"]`);
  else if (c.kind === 'slider') sels.push(`[data-control="${name}"][role="slider"]`);
  else if (c.single) sels.push(`button[data-control="${name}"]`);
  else {
    const opts = c.options || (await page.evaluate((f) => document.getElementById('gameHost').gyre[f].map((o) => String(o.id)), c.from));
    for (const o of opts) sels.push(`button[data-control="${name}"][data-value="${o}"]`);
  }
  for (const sel of sels) {
    const t = await tapTarget(sel);
    if (!t || !t.onScreen || !t.topmost) unreachable.push(`${sel} ${JSON.stringify(t)}`);
  }
}
if (!unreachable.length) ok('every control, and every option of every control, can be brought under a finger and is the topmost thing at its own centre');
else bad(`${unreachable.length} control(s) are painted but cannot be pressed`, unreachable.slice(0, 4).join(' · '));

/* ================================================= 2. gate 1, per parameter, by finger */
console.log('\n--- 2. P3 gate 1: every parameter, dragged or tapped with a FINGER, changes the field ---');
/* THE PROTOCOL IS ONE PROTOCOL FOR ALL OF THEM, and it holds a finger down before it
 * reads. Three of these parameters are invisible on a still field: `burst` is what a TAP
 * does, `ripple` is what a tap LEAVES, and `glow` draws only while a finger is on the
 * glass. Sampling a settled field would have reported all three as controls that do
 * nothing, which is §6.1 member 3 — a reading that fails for a reason other than the one
 * under test. */
/* A FIXED BASELINE BEFORE EVERY READING, and its absence is why this sweep's numbers
 * swung by a factor of twenty between runs. Each trial changes ONE control, so without
 * this every trial ran on whatever the previous trial had left — `shape` measured at
 * linger 98 because the linger trial had just dragged it there, and a canvas at linger 98
 * is a multi-second exposure in which nothing appears to change at all. `clear()` wipes
 * the trails too, so what is read is the field this setting produces rather than a
 * photograph of the last one still fading. This is check 16's `baseline()` rule, which
 * that file learned first and this one had to learn again. */
const SWEEP_BASE = { count: 1600, force: 0.68, burst: 50, tail: 32, size: 40, linger: 45,
  palette: 'ice', background: 'void', polarity: 1, ripple: 1, glow: 0, spin: 0, shape: 'streak' };
async function fieldUnder(setup) {
  await page.evaluate((b) => {
    const g = document.getElementById('gameHost').gyre;
    for (const k of Object.keys(b)) g.set(k, b[k]);
    g.clear();
  }, SWEEP_BASE);
  await setup();
  await wait(1100);
  const r = await rect('#gameHost canvas');
  PROBE = { x: r.x + r.w * 0.5, y: r.y + r.h * 0.28 };
  /* THE TRAILS ARE WIPED IMMEDIATELY BEFORE THE TAP, so the impulse reading is dominated
   * by what the tap DOES rather than by the several seconds of field already painted
   * over it. The ripple is drawn with `lighter` on top of a field that is already ink, so
   * against a full canvas it moves almost no pixel across the ink threshold and measured
   * 0.59 against its own noise of 0.39 — a control that plainly works, reported as one
   * that might not. `clear()` is a shipped control on this very panel; using it here is
   * asking the question the way a child asks it, on a clean screen. */
  await page.evaluate(() => document.getElementById('gameHost').gyre.clear());
  await touch('touchStart', [{ x: r.x + r.w * 0.5, y: r.y + r.h * 0.28, id: 1 }]);
  /* THREE MOMENTS, because the parameters are visible at different ones. `burst` is an
   * IMPULSE — what a tap does in the first few hundred milliseconds — and it is gone by
   * the time a settled reading is taken. `glow` exists only while a finger is down.
   * `linger` and `tail` are steady-state. One reading measured a third of them fairly.
   * The two held readings 500ms apart are also where the noise floor comes from. */
  await wait(300);
  const impulse = await sample();
  await wait(1100);
  const held = await sample();
  await touch('touchEnd', []);
  await wait(350);
  const after = await sample();
  return { impulse, held, after };
}

/* EVERY STATE IS READ TWICE, AND THAT IS WHAT MAKES THE COMPARISON HONEST.
 *
 * A particle field is different in every frame, so one reading of a setting is one draw
 * from a distribution. Two readings of the SAME setting is the field disagreeing with
 * itself, and it is the only defensible yardstick for "did the control change anything"
 * — check 16 reached the same conclusion about frame rate and takes the median of three.
 *
 * The first version compared a max over three moments (the signal) against a max over one
 * (the noise), which is not the same statistic: a maximum over more draws is larger for
 * no reason but arithmetic. Both numbers are now the same function of the same shape of
 * data — `pairSignal` between two states, and `pairSignal` between two repeats of one
 * state — so a ratio between them means something. */
async function fieldUnderTwice(setup) {
  const a = await fieldUnder(setup);
  const b = await fieldUnder(setup);
  const mean = {};
  for (const moment of ['impulse', 'held', 'after']) {
    mean[moment] = {};
    for (const k of Object.keys(a[moment])) {
      mean[moment][k] = typeof a[moment][k] === 'number' ? (a[moment][k] + b[moment][k]) / 2 : a[moment][k];
    }
  }
  return { mean, reps: [a, b] };
}
/* SIGNAL AGAINST THE FIELD'S OWN NOISE, not against a number I picked. A particle field
 * is different in every frame, so an absolute floor is a guess about how different
 * "different" has to be — and the same control measured 4.93 on one run and 0.42 on the
 * next while working perfectly on both. What is stable is the RATIO: two readings of the
 * same setting 500ms apart are the field disagreeing with itself, and a control that
 * moves it further than that has done something. A small absolute floor stays as a
 * second condition, so a frozen field cannot pass on ratio alone. */
function pairSignal(a, b) {
  return Math.max(fieldDistance(a.impulse, b.impulse), fieldDistance(a.held, b.held),
                  fieldDistance(a.after, b.after));
}
function pairNoise(a, b) {
  return Math.max(pairSignal(a.reps[0], a.reps[1]), pairSignal(b.reps[0], b.reps[1]), 0.05);
}
/* THE TWO FLOORS THAT USED TO BE DECLARED HERE ARE GONE, AND THAT IS THE CORRECTION.
 * They were left behind when section 2's assertion changed, referenced by nothing, while
 * four comments in this commit went on citing "a floor of 1.0" that no code contained —
 * a threshold that lived only in prose. The sweep's numbers are INFORMATION, printed on
 * every run; what this section asserts is the value each control puts into the seam, and
 * §2b asserts the field for the four parameters check 16 does not cover. Every threshold
 * that is enforced is written at the line that enforces it. */
const perParam = [];
for (const c of manifest) {
  if (c.kind === 'action') continue;
  const key = c.key;
  if (!key) continue;
  if (c.kind === 'slider') {
    const sel = `[data-control="${key}"][role="slider"]`;
    const lo = await fieldUnderTwice(async () => { await fingerDrag(sel, 0.5, 0.02); });
    const loV = (await seamGet())[key];
    const hi = await fieldUnderTwice(async () => { await fingerDrag(sel, 0.5, 0.98); });
    const hiV = (await seamGet())[key];
    /* THE VALUE, NOT MERELY A DIFFERENT VALUE. This asserted `loV !== hiV`, and an
     * adversarial pass inverted the slider's projection in one expression — dragging
     * right set the MINIMUM — and check 19 passed with 0 failures while printing the
     * defect in its own diagnostics. "Different" is not "the value the child pointed at".
     * A drag to 2% must land within a step or two of the bottom of the range and a drag
     * to 98% within a step or two of the top; that is a claim an inversion cannot satisfy.
     * The tolerance is 6% of the range, which is wider than any step this seam has and
     * far narrower than the 96% the drag covers. */
    /* `lo` and `hi` in this scope are the two READINGS, not the range bounds — the first
     * version of this assertion wrote `hi - lo` on two objects, got NaN, and reported all
     * six sliders as broken while printing 350->4900 beside the complaint. The bounds
     * come from the seam, by name. */
    const [rlo, rhi] = await page.evaluate((k) => document.getElementById('gameHost').gyre.ranges[k], key);
    const span = rhi - rlo;
    const moved = isFinite(Number(loV)) && isFinite(Number(hiV))
      && Math.abs(Number(loV) - rlo) <= span * 0.06
      && Math.abs(Number(hiV) - rhi) <= span * 0.06;
    perParam.push({ key, kind: 'slider', a: String(loV), b: String(hiV), moved,
      d: pairSignal(lo.mean, hi.mean), noise: pairNoise(lo, hi) });
  } else {
    /* `manifest` already carries option ids as strings — mapping `o.id` over them a
     * second time yielded `undefined`, every press went to a selector that matched
     * nothing, and four controls were reported inert having never been touched. That is
     * §6.1 member 3: a red for a reason other than the one under test, and it only
     * announced itself because the printed transition read `undefined->undefined`. The
     * press now REPORTS whether it found its control. */
    const opts = c.options
      || (await page.evaluate((f) => document.getElementById('gameHost').gyre[f].map((o) => String(o.id)), c.from));
    /* Two ENDS of the option list, which for a two-state control is both of them and for
     * a colour strip is the two furthest apart in the table. */
    const first = opts[0], last = opts[opts.length - 1];
    let pressedAll = true;
    const press = async (v) => {
      if (c.single) {
        /* One affordance: press it until it shows the wanted value, at most as many
         * times as it has states. §2.2 is explicit that this is ONE control. */
        let landed = false;
        for (let i = 0; i <= opts.length; i++) {
          if (String((await seamGet())[key]) === v) { landed = true; break; }
          if (!(await fingerTap(`button[data-control="${key}"]`))) break;
        }
        if (!landed) pressedAll = false;
      } else if (!(await fingerTap(`button[data-control="${key}"][data-value="${v}"]`))) {
        pressedAll = false;
      }
    };
    if (c.temporal) {
      /* A CONTROL WHOSE PROPERTY IS MOTION CANNOT BE MEASURED BY TWO STILLS. `spin`
       * drifts the whole palette's hue; two snapshots of it differ by however far it
       * happened to have turned between them, which is a coin flip and not evidence.
       * What is measured instead is DRIFT WITHIN one state: how far the field's mean hue
       * travels over two seconds with the control on, against the same reading with it
       * off. The manifest says which controls are like this; this file does not decide. */
      /* A BASELINE FIRST, and the first version did not have one. By the time the sweep
       * reaches `spin` the linger slider has been left at its top by its own trial, and
       * at linger 98 the canvas is a several-second exposure of every hue at once — a
       * mean hue that barely moves however fast the palette turns. The reading was 0.01
       * and the control was reported inert; the control was fine and the instrument was
       * looking at a long exposure. Short trails, one non-cycling palette, mid count. */
      await page.evaluate(() => {
        const g = document.getElementById('gameHost').gyre;
        const s = { count: 1400, force: 0.68, burst: 50, tail: 32, size: 40, linger: 22,
                    palette: 'lemon', background: 'void', polarity: 1, shape: 'streak' };
        for (const k of Object.keys(s)) g.set(k, s[k]);
      });
      const drift = async (v) => {
        await press(v);
        await wait(700);
        const a = await sample();
        await wait(2200);
        const b = await sample();
        /* THE ANGLE, NOT THE VECTOR. The first version took the distance between two
         * mean-hue unit vectors, and the magnitude of that distance is
         * `2*|mean|*sin(turn/2)` — it carries the palette's HUE SPREAD as well as the
         * drift. On a field whose hues are spread over sixty degrees the mean vector is
         * short, so a 57-degree turn measured 0.19 and the control was called inert. The
         * angle between the two means is the drift and nothing else. */
        const ang = (p) => (Math.atan2(p.hueY, p.hueX) * 180) / Math.PI;
        let d2 = Math.abs(ang(b) - ang(a)) % 360;
        return d2 > 180 ? 360 - d2 : d2;
      };
      const on = await drift(first), off = await drift(last);
      perParam.push({ key, kind: 'temporal', a: `hue turns ${on.toFixed(0)}deg in 2s`,
        b: `and ${off.toFixed(0)}deg with it off`, d: (on - off) / 18, noise: 0.05,
        moved: String((await seamGet())[key]) === last, pressed: pressedAll });
      continue;
    }
    const A = await fieldUnderTwice(async () => { await press(first); });
    const aV = String((await seamGet())[key]);
    const B = await fieldUnderTwice(async () => { await press(last); });
    const bV = String((await seamGet())[key]);
    perParam.push({ key, kind: 'choice', a: first, b: last,
      moved: aV === first && bV === last,
      d: pairSignal(A.mean, B.mean), noise: pairNoise(A, B), pressed: pressedAll });
  }
}
const unreached = perParam.filter((p) => p.pressed === false);
if (unreached.length) bad(`${unreached.length} control(s) could not be pressed at all`, unreached.map((p) => p.key).join(', '));
console.log('        ' + perParam.map((p) => `${p.key} ${p.a}->${p.b} signal ${p.d.toFixed(2)} / noise ${(p.noise || 0).toFixed(2)}`).join('  ·  '));
const notMoved = perParam.filter((p) => p.moved === false);
if (!notMoved.length) ok(`all ${perParam.length} controls put the value they promise into the seam when pressed with a finger, dragged or tapped`);
else bad(`${notMoved.length} control(s) did not set the value they are painted for`, notMoved.map((p) => `${p.key}: dragged/tapped to the far end and the seam holds ${p.b} (low end gave ${p.a})`).join(' · '));

/* WHAT THE LINE ABOVE IS AND IS NOT, STATED RATHER THAN LEFT TO A READER.
 *
 * It is the CONTROL's claim: the thing painted for `size` puts a size into the seam when
 * a finger drags it. That is deterministic and it is this work order's own subject.
 *
 * It is NOT roadmap P3 gate 1, which asks whether the FIELD visibly changes. The numbers
 * printed above are why that split exists, and they are worth reading: measured
 * apples-to-apples — the distance between two settings against the distance between two
 * readings of the SAME setting — `force` came back at signal 3.46 against noise 3.12.
 * A particle field disagrees with itself, at this instrument's resolution, by about as
 * much as some of these controls move it. Lowering the ratio until it passed would have
 * been fitting a threshold to a wish; the honest reading is that a whole-frame feature
 * vector is not a competent instrument for these seven parameters.
 *
 * A COMPETENT ONE ALREADY EXISTS AND IS ALREADY GREEN. Check 16 §2 measures count,
 * force, burst, tail, size, linger and polarity ONE AT A TIME, each against a metric
 * chosen for that parameter — ink under the finger for burst, stroke length for tail,
 * knot-versus-hole for polarity — and asserts every one. Gate 1 is answered there for
 * those seven, and duplicating it badly here would be a second, worse specification of a
 * claim that is already made well.
 *
 * What check 16 does NOT cover is the four parameters PUP-WO-0301 added, because they did
 * not exist when it was written. Those get their own tailored measurements below, on a
 * near-empty canvas where each is the only thing on the screen — which is the same
 * discipline check 16 uses, applied to the new half. */
console.log('\n--- 2b. the four parameters this work order added, each on a bare canvas ---');
/* `reset()` FIRST, AND IT IS WHAT MAKES THESE READINGS COMPARABLE. Settings can be set,
 * but the PARTICLE POSITIONS carry over from whatever ran before, and two readings of the
 * same setting from two different fields differ by as much as the setting does — the
 * `shape` fixture measured 1.8 points of drift on a parameter that is multiplied by zero
 * and therefore cannot have moved. `reset()` reseeds the field; the settings go on top of
 * it; `clear()` wipes the trails. Every reading in this section then starts from the same
 * place, using nothing but the three controls the panel itself ships. */
async function bare(extra) {
  await page.evaluate((o) => {
    const g = document.getElementById('gameHost').gyre;
    g.reset();
    const b = Object.assign({ count: 350, force: 0.68, burst: 50, tail: 20, size: 40, linger: 0,
      palette: 'ice', background: 'void', polarity: 1, ripple: 0, glow: 0, spin: 0, shape: 'streak' }, o);
    for (const k of Object.keys(b)) g.set(k, b[k]);
    g.clear();
  }, extra);
}
const cRect = await rect('#gameHost canvas');
PROBE = { x: cRect.x + cRect.w * 0.5, y: cRect.y + cRect.h * 0.22 };

/* `ripple` — what a tap LEAVES. Count at its floor and linger at zero, so the ring is
 * very nearly the only thing drawn. */
async function tapInk(on) {
  await bare({ ripple: on });
  await wait(500);
  await page.evaluate(() => document.getElementById('gameHost').gyre.clear());
  await touch('touchStart', [{ x: PROBE.x, y: PROBE.y, id: 1 }]);
  await wait(320);
  const s2 = await sample();
  await touch('touchEnd', []);
  await wait(200);
  return s2.ringInk;
}
const rip1 = await tapInk(1), rip0 = await tapInk(0);
if (rip1 > 0.04 && rip1 > rip0 * 3 + 0.02) ok(`the tap ripple: a tap draws ${(rip1 * 100).toFixed(1)}% of the ring around the finger with it on and ${(rip0 * 100).toFixed(1)}% with it off`);
else bad('the ripple toggle does not change what a tap leaves on the screen', `ring ink on ${(rip1 * 100).toFixed(2)}%, off ${(rip0 * 100).toFixed(2)}%`);

/* `glow` — what a HELD finger paints around itself, and only while it is held. */
async function heldRing(on) {
  await bare({ glow: on });
  await wait(500);
  await touch('touchStart', [{ x: PROBE.x, y: PROBE.y, id: 1 }]);
  await wait(1200);
  const s2 = await sample();
  await touch('touchEnd', []);
  await wait(200);
  return s2.ringLum;
}
const glow1 = await heldRing(1), glow0 = await heldRing(0);
if (glow1 > glow0 + 4) ok(`the finger glow: holding a finger lifts the halo around it from ${glow0.toFixed(1)} to ${glow1.toFixed(1)} mean luminance — and it is a RING, so repel's hole survives it (§5)`);
else bad('the glow toggle does not change what a held finger paints', `ring luminance on ${glow1.toFixed(2)}, off ${glow0.toFixed(2)}`);

/* `shape` — MEASURED THROUGH THE MECHANISM, NOT THROUGH COVERAGE.
 *
 * Total ink is a bad discriminator here and three protocols proved it: `dot` is 1.55x the
 * stroke WIDTH and `streak` is longer, so the two trade off and the ratio wandered
 * x1.58, x1.11, x1.03, x0.87 — the instrument reporting its own arrangement rather than
 * the setting. The last of those had dots covering MORE than streaks, which is true and
 * says nothing about whether the control works.
 *
 * What `shape` actually does is structural and unambiguous: `dot` multiplies the tail by
 * ZERO. So under `dot` the tail slider must be INERT, and under `streak` it must be live.
 * That is a claim about the mechanism, it needs no threshold chosen against a
 * measurement, and no width/length trade can fake it in either direction. */
/* REPEL, AND A THIN STROKE, because the tail's length is proportional to SPEED and every
 * earlier fixture measured a slow field. Attract gathers the particles into a knot under
 * the finger — high local density, low speed, and a tail of two or three pixels that no
 * slider setting can make interesting. Repel flings the whole field outward at once, so
 * every particle is moving; `size` at 25 keeps the stroke thin so its LENGTH is what the
 * ink is made of. This is the arrangement in which `tail` is a large effect, which is the
 * precondition for asking whether `shape` switches it off. */
async function inkAtTail(shape, tail) {
  await bare({ shape, tail, count: 2500, size: 25, linger: 20, force: 1.7, polarity: -1 });
  await wait(400);
  const r = await rect('#gameHost canvas');
  await touch('touchStart', [{ x: r.x + r.w * 0.5, y: r.y + r.h * 0.2, id: 1 }]);
  await wait(1400);
  const v = (await sample()).ink;
  await touch('touchEnd', []);
  await wait(200);
  return v;
}
const streakShort = await inkAtTail('streak', 2), streakLong = await inkAtTail('streak', 98);
const dotShort = await inkAtTail('dot', 2), dotLong = await inkAtTail('dot', 98);
const streakDelta = Math.abs(streakLong - streakShort);
const dotDelta = Math.abs(dotLong - dotShort);
if (streakDelta > 0.004 && streakDelta > dotDelta * 3) {
  ok(`particle shape: with streaks the tail slider moves the field by ${(streakDelta * 100).toFixed(2)} points of ink (${(streakShort * 100).toFixed(2)}% -> ${(streakLong * 100).toFixed(2)}%); with dots the same slider moves it by ${(dotDelta * 100).toFixed(2)} — the shape control is switching the tail off, which is what it is for`);
} else {
  bad('the shape control does not change the stroke',
    `streak tail 2->98: ${(streakShort * 100).toFixed(2)}% -> ${(streakLong * 100).toFixed(2)}% (delta ${(streakDelta * 100).toFixed(2)}); dot tail 2->98: ${(dotShort * 100).toFixed(2)}% -> ${(dotLong * 100).toFixed(2)}% (delta ${(dotDelta * 100).toFixed(2)})`);
}

/* `spin` is measured in the sweep above and is the one entry there with a metric built
 * for it — the ANGLE the mean hue turns through in two seconds. Restated here so the
 * four additions are answered in one place. */
const spinRow = perParam.find((p) => p.key === 'spin');
if (spinRow && spinRow.d >= 2) ok(`drifting colour: ${spinRow.a}, ${spinRow.b}`);
else bad('the drifting-colour toggle does not turn the palette', JSON.stringify(spinRow));

/* ================================================= 3. the controls do not lie */
console.log('\n--- 3. a swatch is the colour it selects, and a slider sits where its value is ---');
const swatchTruth = await page.evaluate(() => {
  const g = document.getElementById('gameHost').gyre;
  const out = [];
  for (const list of ['palettes', 'backgrounds']) {
    for (const entry of g[list]) {
      const key = list === 'palettes' ? 'palette' : 'background';
      const el = document.querySelector(`button[data-control="${key}"][data-value="${entry.id}"]`);
      if (!el) { out.push([entry.id, 'no swatch']); continue; }
      const painted = getComputedStyle(el).backgroundColor;
      const m = painted.match(/(\d+),\s*(\d+),\s*(\d+)/);
      const want = entry.hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
      if (!m) { out.push([entry.id, `unreadable ${painted}`]); continue; }
      const got = [Number(m[1]), Number(m[2]), Number(m[3])];
      const off = Math.abs(got[0] - want[0]) + Math.abs(got[1] - want[1]) + Math.abs(got[2] - want[2]);
      if (off > 3) out.push([entry.id, `paints ${painted}, selects ${entry.hex}`]);
    }
  }
  return out;
});
if (!swatchTruth.length) ok('every palette and background swatch is painted in exactly the colour it selects — §2.3, invariant 1 with no label');
else bad('a swatch is not the colour it selects', JSON.stringify(swatchTruth.slice(0, 6)));

await fingerTap('button[data-control="randomize"]');
await wait(400);
const geometry = await page.evaluate(() => {
  const g = document.getElementById('gameHost').gyre;
  const v = g.get(), out = [];
  for (const el of document.querySelectorAll('[role="slider"][data-control]')) {
    const key = el.dataset.control;
    const [lo, hi] = g.ranges[key];
    const want = (Number(v[key]) - lo) / (hi - lo);
    const fill = el.firstElementChild;
    const got = fill.getBoundingClientRect().width / el.getBoundingClientRect().width;
    if (Math.abs(want - got) > 0.02) out.push([key, v[key], want.toFixed(3), got.toFixed(3)]);
  }
  return out;
});
if (!geometry.length) ok('after a randomize every slider redrew to the value the seam actually holds — the subscribe path, not a poll');
else bad('a slider shows a position that is not its value', JSON.stringify(geometry));

/* ---- clear and reset: the two action buttons nothing pressed ---- */
/* An adversarial pass replaced `reset` with a function that returns the settings and
 * changes nothing, and this check passed. Neither action was exercised anywhere — and
 * `reset` is the button the acceptance-8 prediction hangs on ("put it back the way it
 * was" answered in one tap). Coverage that stops at the controls with sliders on them is
 * coverage shaped by what was easy to measure. */
await page.evaluate(() => {
  const g = document.getElementById('gameHost').gyre;
  const s2 = { count: 2000, force: 1.2, burst: 80, tail: 70, size: 70, linger: 85,
               palette: 'candy', background: 'plum', polarity: -1, shape: 'ribbon', spin: 1, ripple: 0, glow: 1 };
  for (const k of Object.keys(s2)) g.set(k, s2[k]);
});
await wait(1400);
const beforeClear = (await sample()).ink;
if (!(await fingerTap('button[data-control="clear"]'))) bad('the clear button could not be pressed with a finger');
await wait(60);
const afterClear = (await sample()).ink;
await wait(1200);
const recovered = (await sample()).ink;
if (beforeClear > 0.01 && afterClear < beforeClear * 0.5 && recovered > afterClear * 1.5) {
  ok(`clear trails: one tap wipes ${(beforeClear * 100).toFixed(1)}% of ink down to ${(afterClear * 100).toFixed(1)}%, and the field draws itself back to ${(recovered * 100).toFixed(1)}%`);
} else {
  bad('the clear button does not wipe the field, or the field does not come back', `${(beforeClear * 100).toFixed(2)}% -> ${(afterClear * 100).toFixed(2)}% -> ${(recovered * 100).toFixed(2)}%`);
}
const beforeReset = await seamGet();
if (!(await fingerTap('button[data-control="reset"]'))) bad('the reset button could not be pressed with a finger');
await wait(400);
const afterReset = await seamGet();
/* The defaults are not restated here — that would be a second copy of defaultsFor(). What
 * is asserted is that reset MOVED every setting that was off its default, and that a
 * second reset is then a no-op, which is what "start over" means and what a stub that
 * returns `read()` cannot do. */
const stillOff = Object.keys(beforeReset).filter((k) => afterReset[k] === beforeReset[k]);
await fingerTap('button[data-control="reset"]');
await wait(300);
const twice = await seamGet();
const stable = Object.keys(afterReset).every((k) => twice[k] === afterReset[k]);
if (stillOff.length <= 1 && stable) {
  ok(`reset: one tap moved ${Object.keys(beforeReset).length - stillOff.length} of ${Object.keys(beforeReset).length} settings off the deliberately-wrong state, and a second tap changed nothing`);
} else {
  bad('the reset button does not start over', `unchanged by reset: ${stillOff.join(', ')}; idempotent: ${stable}`);
}

/* ================================================= 4. P3 gate 2 — randomize by finger */
console.log('\n--- 4. P3 gate 2: five randomize taps, five usable fields ---');
const worlds = [];
for (let i = 0; i < 5; i++) {
  await fingerTap('button[data-control="randomize"]');
  await wait(800);
  worlds.push({ s: await seamGet(), px: await sample() });
}
const unusable = worlds.filter((w) => !w.px || w.px.ink < 0.004 || w.px.lumSd < 1.2);
if (!unusable.length) ok(`five finger taps on the dice, five fields with ink on them: ${worlds.map((w) => `${w.s.palette}/${w.s.background}/${w.s.shape} ${(w.px.ink * 100).toFixed(1)}%`).join(' · ')}`);
else bad(`${unusable.length} of five dice taps produced an unusable field`, JSON.stringify(unusable.map((u) => u.s)));
const distinct = worlds.slice(1).every((w, i) => fieldDistance(w.px, worlds[i].px) > 0.5);
if (distinct) ok('each press produced a visibly different field from the one before');
else bad('two consecutive dice taps produced the same field', worlds.map((w) => `${w.s.palette}/${w.s.background}`).join(' · '));

/* THE DICE MUST NOT SWITCH OFF THE TOY'S ANSWER TO A FINGER. randomize forces `ripple`
 * on and carries `glow` through rather than drawing them, and this is that decision
 * asserted rather than described — a child cannot read the panel to find out which
 * switch moved behind him. */
await page.evaluate(() => document.getElementById('gameHost').gyre.set('glow', 1));
const glowBefore = (await seamGet()).glow;
const rippleOff = worlds.filter((w) => w.s.ripple !== 1).length;
await fingerTap('button[data-control="randomize"]');
const afterDice = await seamGet();
if (!rippleOff && afterDice.ripple === 1 && afterDice.glow === glowBefore) {
  ok('the dice never switched the ripple off and never moved the glow the child had set');
} else {
  bad('a dice press changed a switch behind the child', `ripple off in ${rippleOff} of 5 worlds; glow ${glowBefore} -> ${afterDice.glow}`);
}

/* ================================================= 5. P3 gate 3 — one tap, and a second finger */
console.log('\n--- 5. P3 gate 3: attract/repel inverts in ONE tap, pressed with a second finger down ---');
/* FROM A FRESH SESSION, and that is a correction this measurement earned. Run straight
 * after the dice section it read 33% -> 19% and called the inversion invisible; from a
 * freshly seeded field the same code reads ~33% -> 0.0% three times running. The field
 * the previous section left was piled against the walls, and four seconds of attract is
 * not enough to gather it back into a knot — so the reading was about where the field
 * had BEEN. Measured with the glow both ways first: 32.7 / 30.6 / 33.2% attract and 0.0%
 * repel every time, so the glow was never the variable it looked like. */
await openGyre();
await page.evaluate(() => {
  const g = document.getElementById('gameHost').gyre;
  /* LINGER LOW, AND THAT IS THE MEASUREMENT'S OWN CORRECTION. At linger 60 the canvas
   * holds several seconds of exposure, so the ATTRACT knot is still painted on the frame
   * that is supposed to show the REPEL hole — the first version read 44.9% -> 30.1% and
   * called the inversion invisible while a person watching would have seen it plainly.
   * At linger 22 the trail clears in well under a second and what is measured is where
   * the field IS, not where it has been. */
  const s = { count: 2600, force: 1.45, burst: 50, tail: 34, size: 55, linger: 22, palette: 'ice',
              background: 'void', polarity: 1, glow: 1, ripple: 1, shape: 'streak', spin: 0 };
  for (const k of Object.keys(s)) g.set(k, s[k]);
});
const canvasBox = await rect('#gameHost canvas');
const holdPoint = { x: canvasBox.x + canvasBox.w * 0.5, y: canvasBox.y + canvasBox.h * 0.26 };
/* The held finger stays down THROUGHOUT, including while the second one presses the
 * control. That is §3.6's clause and §5's first probe in the same measurement. */
await touch('touchStart', [{ x: holdPoint.x, y: holdPoint.y, id: 1 }]);
await wait(4000);
const discInk = (p) => page.evaluate((q) => {
  /* INK IS DISTANCE FROM THE GROUND, not absolute brightness. The first version counted
   * any pixel whose channels summed above 60, and on `void` — which sums to 25 — that
   * counts the fade residue of a trail that has almost gone. Repel read 21% of the disc
   * still "inked" while the hole was plainly there. The L1-40 rule is the one every
   * other pixel assertion in this repo uses, and the ground is measured rather than
   * assumed so a background change cannot silently move the threshold. */
  const c = document.querySelector('#gameHost canvas');
  const r = c.getBoundingClientRect();
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const sx = c.width / r.width, sy = c.height / r.height;
  const rs = [], gs = [], bs = [];
  for (let y = 0; y < c.height; y += 8) for (let x = 0; x < c.width; x += 8) {
    const i = (y * c.width + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
  }
  const med = (a) => { const t = a.slice().sort((u, v) => u - v); return t[t.length >> 1]; };
  const br = med(rs), bgc = med(gs), bb = med(bs);
  const ox = (q.x - r.left) * sx, oy = (q.y - r.top) * sy, R = 100 * sx;
  let ink = 0, tot = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
    if (Math.hypot(x - ox, y - oy) > R) continue;
    const i = (y * c.width + x) * 4;
    tot++;
    if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bgc) + Math.abs(d[i + 2] - bb) >= 40) ink++;
  }
  return tot ? ink / tot : 0;
}, p);
const attract = await discInk(holdPoint);
const polRect = await rect('button[data-control="polarity"]');
await touch('touchStart', [{ x: holdPoint.x, y: holdPoint.y, id: 1 }, { x: polRect.cx, y: polRect.cy, id: 2 }]);
await wait(60);
/* THE SECOND FINGER IS THE ONE THAT LIFTS — this released id 1, the finger that is
 * supposed to STAY on the glass. */
await touch('touchEnd', [{ x: polRect.cx, y: polRect.cy, id: 2 }]);
const flippedUnderTwoFingers = (await seamGet()).polarity;
/* THE HAND IS RESET BEFORE THE FIELD IS READ, and the two claims are kept apart on
 * purpose. That the CONTROL fires while a second finger is on the glass is proved by the
 * line above — polarity changed with two points down, which is §3.6's clause and the case
 * #gameBack failed for two work orders. What the FIELD then does is a separate
 * measurement and it deserves a clean single hold: driven straight out of the multi-touch
 * sequence it read 20% of the disc still inked, where a plain hold reads 0.0% three times
 * running. Measuring the control and the physics through the same tangle of fingers was
 * measuring neither. */
await touch('touchEnd', []);
await wait(120);
await touch('touchStart', [{ x: holdPoint.x, y: holdPoint.y, id: 1 }]);
await wait(4000);
const repel = await discInk(holdPoint);
await touch('touchEnd', []);
const flipped = (await seamGet()).polarity;
if (flippedUnderTwoFingers === -1 && flipped === -1 && repel < attract * 0.2) {
  ok(`one tap on the control with a SECOND finger already on the glass flipped it, and the knot under the finger became a hole: ${(attract * 100).toFixed(1)}% of the disc inked becomes ${(repel * 100).toFixed(1)}% — with the glow ON`);
} else {
  bad('attract/repel did not visibly invert in one tap of the control',
    `polarity under two fingers=${flippedUnderTwoFingers}, at read time=${flipped}, disc ${(attract * 100).toFixed(1)}% -> ${(repel * 100).toFixed(1)}%`);
}

/* ================================================= 6. P3 gate 5 — one tap out, always */
console.log('\n--- 6. P3 gate 5: getting out is ONE tap, mid-drag, mid-randomize, second finger, drawer open or shut ---');
async function exitFrom(name, prepare, tapOpts) {
  await openGyre();
  if (prepare) await prepare();
  const okTap = await fingerTap('#gameBack', tapOpts || {});
  await wait(350);
  const back = await consoleReachable();
  if (okTap && back) ok(`out in one tap: ${name}`);
  else bad(`the child cannot get out in one tap: ${name}`, `tapped=${okTap}, console reachable=${back}`);
  /* Leave nothing behind for the next case. */
  await page.evaluate(() => { try { window.endGameSession(); } catch (e) {} });
}
await exitFrom('drawer open, nothing happening', null, {});
await exitFrom('drawer shut', async () => { await fingerTap('#gameControlsHandle'); });
await exitFrom('a tap that slides 20px', null, { slide: 20 });
await exitFrom('with a second finger resting on the field', null, {
  extraFinger: { x: canvasBox.x + canvasBox.w * 0.3, y: canvasBox.y + canvasBox.h * 0.3 } });
await exitFrom('mid-drag, with a finger still down on a slider', async () => {
  const r = await rect('[data-control="count"][role="slider"]');
  await touch('touchStart', [{ x: r.x + r.w * 0.2, y: r.cy, id: 5 }]);
  await touch('touchMove', [{ x: r.x + r.w * 0.7, y: r.cy, id: 5 }]);
}, { extraFinger: null });
await exitFrom('immediately after a dice press, while the field is still reseeding', async () => {
  await fingerTap('button[data-control="randomize"]');
});

/* ================================================= 7. P3 gate 4 — persistence */
console.log('\n--- 7. P3 gate 4: what he set survives a restart, and survives api.load() returning null ---');
await openGyre();
/* THE DRAWER'S OPEN STATE PERSISTS IN localStorage, AND SECTION 6 CLOSED IT. Every tap
 * below then went to a `display:none` element with a 0x0 rectangle at the origin, all
 * four returned false, all four return values were discarded, and the section asserted
 * that four settings nobody had changed came back unchanged — architecture §6.1 member 1,
 * an assertion that passes by not running, found by an adversarial pass that instrumented
 * the taps rather than trusting them. The drawer is opened first, and from here every tap
 * in this file is CHECKED. */
if (await page.evaluate(() => getComputedStyle(document.getElementById('gameControlsDrawer')).display === 'none')) {
  await fingerTap('#gameControlsHandle');
}
const tapped = [];
const mustTap = async (sel, fn) => { const okd = await (fn || fingerTap)(sel); if (!okd) tapped.push(sel); return okd; };
await mustTap('[data-control="size"][role="slider"]', (sel) => fingerDrag(sel, 0.5, 0.95));
await mustTap('button[data-control="shape"][data-value="dot"]');
await mustTap('button[data-control="ripple"][data-value="0"]');
await mustTap('button[data-control="palette"][data-value="candy"]');
if (tapped.length) bad(`${tapped.length} control(s) in the persistence fixture were never actually pressed`, tapped.join(' · '));
const chosen = await seamGet();
/* The fixture must have CHANGED something, or "it came back" is a claim about nothing. */
if (chosen.shape !== 'dot' || chosen.ripple !== 0 || chosen.palette !== 'candy') {
  bad('the persistence fixture did not set what it meant to set', JSON.stringify({ shape: chosen.shape, ripple: chosen.ripple, palette: chosen.palette }));
}
await fingerTap('#gameBack');
await wait(400);
await openGyre();
const restored = await seamGet();
const drift = ['size', 'shape', 'ripple', 'palette'].filter((k) => restored[k] !== chosen[k]);
if (!drift.length) ok(`what the panel set came back after leaving and re-entering: size=${restored.size} shape=${restored.shape} ripple=${restored.ripple} palette=${restored.palette}`);
else bad('a setting made through the panel did not survive', drift.map((k) => `${k}: ${chosen[k]} -> ${restored[k]}`).join(', '));

await page.evaluate(() => { try { window.endGameSession(); } catch (e) {} });
await page.evaluate(() => localStorage.clear());
await openGyre();
const fresh = await seamGet();
const panelAlive = await page.$('#gameControlsDrawer');
if (panelAlive && fresh && fresh.palette && fresh.shape) ok(`with nothing in storage — api.load() returning null — the toy and its panel come up on defaults: ${fresh.palette}/${fresh.background}/${fresh.shape}, glow ${fresh.glow}`);
else bad('the panel did not survive api.load() returning null', JSON.stringify(fresh));

/* ================================================= 8. the seam dies with the session */
console.log('\n--- 8. a control that outlived its session cannot reach back in ---');
const afterDeath = await page.evaluate(async () => {
  const held = document.getElementById('gameHost').gyre;
  const before = held.get();
  window.endGameSession();
  await new Promise((r) => setTimeout(r, 200));
  const setResult = held.set('count', 4999);
  const randomResult = held.randomize();
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('pupgame:gyre') || 'null'); } catch (e) {}
  return {
    panelGone: !document.getElementById('gameControls'),
    chromeGone: !document.getElementById('gamesChrome'),
    setResult, sameAfter: randomResult && randomResult.count === before.count,
    storedCount: stored ? stored.count : null, beforeCount: before.count,
  };
});
if (afterDeath.panelGone && afterDeath.chromeGone && afterDeath.setResult === false
    && afterDeath.sameAfter && afterDeath.storedCount === afterDeath.beforeCount) {
  ok('after the exit the panel is gone and a captured seam refuses set() and randomize() — the child\'s saved settings are untouched');
} else {
  bad('a control surface that outlived its session could still reach the module', JSON.stringify(afterDeath));
}

/* ================================================= 9. a module with no manifest */
console.log('\n--- 9. a module that publishes nothing gets no panel, and that is not an error ---');
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
/* THE FIXTURE IS SUPPLIED HERE, BECAUSE `hello` LEFT THE CHILD'S PICKER.
 * PUP-WO-0111 §3 removed its registry entry — Scotty does not want a third tile — while
 * keeping the FILE, which is still the only live proof of mountControlPanel's first
 * guard: a module that publishes nothing at all. `blockpop` cannot stand in, because it
 * publishes a seam and is refused at the FOURTH guard instead; that is a different branch.
 *
 * Pushing the entry rather than hiding the tile keeps THIS CHECK'S FINGER PATH END TO END
 * — it still waits for a real tile and taps it — on the exact surface where "a synthetic
 * click is not a finger" was learned. Mounting the module directly would have downgraded
 * that to an internals call. Precedent: demo-picker.mjs:351-355. */
await page.evaluate(() => {
  GAMES.push({ id: 'hello', module: './games/hello.js', label: 'Hello', icon: '\uD83D\uDC4B',
    color: '#8B5CF6', glow: '#A78BFA', sound: 'chime', players: 1, params: {} });
});
await fingerTap('.pad-btn[data-id="7"]');
await page.waitForSelector('.pickerTile[data-game="hello"]', { timeout: 10000 });
await fingerTap('.pickerTile[data-game="hello"]');
await wait(900);
const helloState = await page.evaluate(() => ({
  host: !!document.getElementById('gameHost'),
  panel: !!document.getElementById('gameControls'),
  back: !!document.getElementById('gameBack'),
}));
if (helloState.host && !helloState.panel && helloState.back) ok('hello mounted with no control panel and its exit intact — the shell asked for a manifest and took no for an answer');
else bad('a module with no manifest did not get the no-panel path', JSON.stringify(helloState));
const helloOut = await fingerTap('#gameBack');
await wait(300);
if (helloOut && await consoleReachable()) ok('and one tap still leaves it');
else bad('could not leave the module with no panel');

/* ============================ 10. THE SHAPE THE TOY ACTUALLY RUNS ON
 * Everything above runs at 1024x640, and an adversarial pass showed why that is not
 * enough: at 1024x480 — a tablet shape — FOUR CONTROLS WERE PAINTED AND COULD NOT BE
 * PRESSED, and the drawer would not pan with a finger because every control carried
 * `touch-action: none`, which forbids a gesture starting on it from scrolling an
 * ancestor. The controls are most of the drawer's surface. A child would have had to
 * find the 8px gaps between them.
 *
 * So the small screen is a first-class case now, not an afterthought, and it is tested
 * at three shapes rather than one. A check that only ever runs at the size where the
 * layout happens to fit is a check about the check's own viewport. */
console.log('\n--- 10. the same panel on the shapes this actually runs on ---');
for (const vp of [{ width: 869, height: 412 }, { width: 915, height: 412 }, { width: 883, height: 412 }]) {
  const ctx2 = await browser.newContext({ viewport: vp, hasTouch: true });
  await ctx2.addInitScript(SAMPLER);
  const p2 = await ctx2.newPage();
  const cdp2 = await ctx2.newCDPSession(p2);
  const t2 = (type, points) => cdp2.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const tap2 = async (sel) => {
    const r = await p2.evaluate((s2) => {
      const e = document.querySelector(s2);
      if (!e) return null;
      e.scrollIntoView({ block: 'nearest' });
      const b = e.getBoundingClientRect();
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return { cx, cy, w: b.width, h: b.height,
        onScreen: b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight,
        topmost: !!(top && (top === e || e.contains(top) || top.contains(e))) };
    }, sel);
    if (!r || !r.onScreen || !r.topmost) return null;
    await t2('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]);
    await p2.waitForTimeout(40);
    await t2('touchEnd', []);
    await p2.waitForTimeout(140);
    return r;
  };
  await p2.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await tap2('.pad-btn[data-id="7"]');
  await p2.waitForSelector('.pickerTile[data-game="gyre"]', { timeout: 10000 });
  await tap2('.pickerTile[data-game="gyre"]');
  await p2.waitForSelector('#gameControls', { timeout: 10000 });

  const geo = await p2.evaluate(() => {
    const d = document.getElementById('gameControlsDrawer');
    const c = document.querySelector('#gameHost canvas');
    return { scrollH: d.scrollHeight, clientH: d.clientHeight,
      covers: d.getBoundingClientRect().height / c.getBoundingClientRect().height };
  });
  /* If it overflows, a FINGER must be able to pan it. This is the assertion two documents
   * cited as proof and which had never once executed. */
  let panned = null;
  if (geo.scrollH > geo.clientH) {
    const dr = await p2.evaluate(() => {
      const b = document.getElementById('gameControlsDrawer').getBoundingClientRect();
      return { cx: b.x + b.width / 2, y: b.y, h: b.height };
    });
    /* STARTED ON A CONTROL, ON PURPOSE — that is where a child's finger lands, and it is
     * the case `touch-action: none` used to forbid. */
    await t2('touchStart', [{ x: dr.cx, y: dr.y + dr.h * 0.7, id: 1 }]);
    for (let i = 1; i <= 10; i++) {
      await t2('touchMove', [{ x: dr.cx, y: dr.y + dr.h * 0.7 - i * 14, id: 1 }]);
      await p2.waitForTimeout(16);
    }
    await t2('touchEnd', []);
    await p2.waitForTimeout(300);
    panned = await p2.evaluate(() => document.getElementById('gameControlsDrawer').scrollTop);
  }

  const manifest2 = await p2.evaluate(() => document.getElementById('gameHost').gyre.controls.map((c) => ({
    kind: c.kind, key: c.key || null, method: c.method || null, from: c.from || null, single: !!c.single,
    options: c.options ? c.options.map((o) => String(o.id)) : null })));
  const dead = [];
  for (const c of manifest2) {
    const name = c.key || c.method;
    const sels = c.kind === 'action' ? [`button[data-control="${name}"]`]
      : c.kind === 'slider' ? [`[data-control="${name}"][role="slider"]`]
      : c.single ? [`button[data-control="${name}"]`]
      : (c.options || await p2.evaluate((f) => document.getElementById('gameHost').gyre[f].map((o) => String(o.id)), c.from))
          .map((o) => `button[data-control="${name}"][data-value="${o}"]`);
    for (const sel of sels) {
      if (await tap2(sel)) continue;
      /* WHY it could not be pressed, not just that it could not. A bare selector in a
       * failure message is a second debugging session. */
      const why = await p2.evaluate((s2) => {
        const e = document.querySelector(s2);
        if (!e) return 'absent';
        const b = e.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return `${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.x)},${Math.round(b.y)} topmost=${t ? (t.dataset && t.dataset.control) || t.id || t.tagName : 'none'}`;
      }, sel);
      dead.push(`${sel} [${why}]`);
    }
  }
  /* THE EXIT MUST NOT COVER A CONTROL, which is the converse of the claim the panel's
   * own comments make and the one nothing asserted. #gameBack is fixed at the top-left
   * and wins every z-index tie by DOM order — correct, and it is exactly why it could
   * swallow the dice on a short screen. Named separately from the reachability loop so a
   * regression says which of the two rules broke. */
  /* ASKED AS A HIT TEST, NOT AS GEOMETRY. "Is this control's centre inside the exit's
   * rectangle" flags controls that are scrolled out of the drawer and clipped, which no
   * finger can reach either way — a false positive that would have made this assertion
   * noise and then made someone delete it. The question that matters is the one a finger
   * asks: press this control's own centre, and what answers? Checked at rest AND with the
   * drawer scrolled to its end, because scrolling is what slides the top rows upward. */
  const exitEats = await p2.evaluate(() => {
    const d = document.getElementById('gameControlsDrawer');
    const hit = [];
    for (const at of [0, d.scrollHeight]) {
      d.scrollTop = at;
      for (const el of document.querySelectorAll('#gameControls [data-control],#gameControlsHandle')) {
        const r2 = el.getBoundingClientRect();
        if (r2.width === 0 || r2.height === 0) continue;
        const cx = r2.x + r2.width / 2, cy = r2.y + r2.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
        /* A CONTROL SCROLLED OUT OF THE DRAWER IS CLIPPED AND NOBODY CAN SEE IT, so a
         * hit test at its notional centre answers a question no finger asks. Only points
         * inside the drawer's own visible box — or outside the drawer entirely, which is
         * the bar the dice and handle live in — are a real collision. */
        const inDrawer = d.contains(el);
        if (inDrawer) {
          const dr2 = d.getBoundingClientRect();
          if (cy < dr2.top || cy > dr2.bottom || cx < dr2.left || cx > dr2.right) continue;
        }
        const top = document.elementFromPoint(cx, cy);
        if (top && top.id === 'gameBack') {
          hit.push(`${el.dataset.control || el.id} (scrollTop ${Math.round(d.scrollTop)})`);
        }
      }
    }
    d.scrollTop = 0;
    return hit;
  });
  if (!exitEats.length) ok(`${vp.width}x${vp.height}: the exit covers the centre of no control`);
  else bad(`${vp.width}x${vp.height}: #gameBack swallows a control — a tap on it closes the toy`, exitEats.join(' · '));
  const panOk = geo.scrollH <= geo.clientH || panned > 4;
  if (!dead.length && panOk) {
    ok(`${vp.width}x${vp.height}: every control reachable and pressable by a finger (${geo.scrollH}px of content in ${geo.clientH}px${geo.scrollH > geo.clientH ? `, panned to ${Math.round(panned)} by a finger starting ON a control` : ', no scrolling needed'}); the drawer covers ${(geo.covers * 100).toFixed(0)}% of the field`);
  } else {
    bad(`${vp.width}x${vp.height}: the panel is not usable at this size`,
      `${dead.length} control(s) unpressable${dead.length ? ': ' + dead.slice(0, 4).join(' · ') : ''}; content ${geo.scrollH}px in ${geo.clientH}px; finger pan -> ${panned}`);
  }
  const outOk = await tap2('#gameBack');
  const home = await p2.evaluate(() => {
    const b = document.querySelector('.pad-btn[data-id="7"]');
    if (!b || document.getElementById('gamesChrome')) return false;
    const r = b.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!(e && b.contains(e));
  });
  if (outOk && home) ok(`${vp.width}x${vp.height}: and one tap still leaves it`);
  else bad(`${vp.width}x${vp.height}: the exit is not one tap`, `tapped=${!!outOk}, console reachable=${home}`);
  await ctx2.close();
}

if (pageErrors.length) bad(`${pageErrors.length} uncaught page error(s)`, pageErrors.slice(0, 3).join(' | '));
else ok('no uncaught page errors throughout');

} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n::error::CHECK 19 FAILED — ${failures.length} — the control surface does not do what PUP-WO-0301 §3 requires.`);
  console.error(`\nCHECK 19 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 19 PASSED at ${COMMIT.slice(0, 12)} — every control in Gyre's manifest is reachable by a finger, moves the field, tells the truth about its value, and never costs more than one tap to leave.`);
