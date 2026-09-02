#!/usr/bin/env node
/**
 * CHECK 20 — the sticker anchor at three widths, and the two share buttons by finger.
 *
 * PUP-WO-0700 §3. Two claims, and the first is the one that matters:
 *
 * THE STICKER IS MEASURED THROUGH THE SHIPPED CODE PATH, AT THREE RENDERED WIDTHS.
 * The defect was that preview and burn each carried their OWN answer to "how big is a
 * sticker" — `font-size:36px` against `Math.round(w * 0.06)` — and those agree at a
 * rendered width near 600px and nowhere else. A test at one width therefore cannot
 * distinguish "correct" from "correct at 600px", which is why §3.2 asks for three and
 * why one of them is far away from 600.
 *
 * The burn is observed rather than inferred: `getContext` is wrapped before the app
 * loads so that every `ctx.font` assignment and every `fillText` is recorded. What is
 * asserted is what the shipped save handler actually asked the canvas to draw, at a
 * canvas width this check chose — not what a helper returns when called directly.
 *
 * NOTHING IS PRESSED WITH `page.click`. Architecture §6.1 member 6.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
import { requireSubject } from './lib/subject.mjs';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const COMMIT = requireSubject(REPO, 'CHECK 20');
console.log(`CHECK 20 — the sticker anchor, and the share buttons. subject ${COMMIT.slice(0, 12)}\n`);

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

/* ---- 1. ONE EXPRESSION, asserted structurally on the source ---------------
 * §3.3 suggests a grep for a second literal. A bare grep for `0.06` is useless in this
 * file — it matches a dozen `rgba(...,0.06)` alphas — so the claim is made precisely
 * instead: the fraction is declared once, and BOTH paths reach it through the one
 * function rather than through a number of their own. */
const html = readFileSync(join(REPO, 'index.html'), 'utf8');
const decl = html.match(/var STICKER_W_FRAC\s*=/g) || [];
const previewLine = html.match(/el\.style\.cssText\s*=\s*'position:absolute;left:'[\s\S]{0,400}?pointer-events:none'/);
/* ANCHORED TO THE BURN BLOCK, not to `var sz`. There are four `var sz` in this file and
 * the first version matched the wrong one — `scaledWidth(vsize)`, four hundred lines away
 * in an unrelated surface — and reported the fix missing while it was present. A check
 * that names the wrong subject is not a stricter check. */
const burnBlock = html.match(/reviewStickers\.forEach\(function\(s\)[\s\S]{0,600}?\}\);/);
const burnLine = burnBlock ? burnBlock[0].match(/var sz\s*=\s*[^;]+;/) : null;
if (decl.length !== 1) {
  bad(`the scale fraction is declared ${decl.length} time(s), not once`, 'two declarations is the defect this work order removed');
} else if (!previewLine || !/stickerFontPx\(/.test(previewLine[0])) {
  bad('the sticker PREVIEW does not read the shared scale function', previewLine ? previewLine[0].slice(0, 160) : 'preview style not found');
} else if (/font-size:\s*\d+px/.test(previewLine[0])) {
  bad('the sticker preview still hardcodes a pixel size', previewLine[0].slice(0, 160));
} else if (!burnLine || !/stickerFontPx\(/.test(burnLine[0])) {
  bad('the sticker BURN does not read the shared scale function', burnLine ? burnLine[0] : 'burn size not found');
} else {
  ok(`one expression: STICKER_W_FRAC declared once, and preview and burn both size through stickerFontPx() — ${burnLine[0].trim()}`);
}

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

/* A synthetic camera, so the real shutter path runs. */
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

/* Records what the app ASKS THE CANVAS TO DRAW. Installed before any app code runs. */
const SPY = () => {
  window.__burns = [];
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = real.call(this, type, ...rest);
    if (type !== '2d' || !ctx || ctx.__spied) return ctx;
    ctx.__spied = true;
    const canvas = this;
    /* The real accessor is taken from the prototype FIRST and still does the work; the
     * shadowing property only remembers the value on its way through. A spy that
     * replaces an effect instead of observing it is measuring itself. */
    const realFont = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'font');
    let lastFont = '';
    Object.defineProperty(ctx, 'font', {
      get() { return realFont.get.call(ctx); },
      set(v) { lastFont = v; realFont.set.call(ctx, v); },
      configurable: true,
    });
    const realFill = ctx.fillText.bind(ctx);
    ctx.fillText = function (text, x, y, ...more) {
      window.__burns.push({ text, x, y, font: lastFont, w: canvas.width, h: canvas.height });
      return realFill(text, x, y, ...more);
    };
    return ctx;
  };
};

const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: true,
  permissions: ['camera'] });
await ctx0.addInitScript(SPY);
const page = await ctx0.newPage();
const cdp = await ctx0.newCDPSession(page);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const wait = (ms) => page.waitForTimeout(ms);

async function fingerTapAt(x, y, { slide = 0, extraFinger = null } = {}) {
  if (extraFinger) await touch('touchStart', [{ x: extraFinger.x, y: extraFinger.y, id: 9 }]);
  const pts = extraFinger ? [{ x: extraFinger.x, y: extraFinger.y, id: 9 }, { x, y, id: 1 }] : [{ x, y, id: 1 }];
  await touch('touchStart', pts);
  await wait(40);
  if (slide) { await touch('touchMove', pts.map((p) => (p.id === 1 ? { x: x + slide, y: y + slide, id: 1 } : p))); await wait(40); }
  await touch('touchEnd', extraFinger ? [{ x, y, id: 1 }] : []);
  if (extraFinger) { await wait(40); await touch('touchEnd', []); }
  await wait(150);
  return true;
}
async function fingerTap(sel, opts) {
  const r = await page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return { cx, cy, topmost: !!(top && (top === e || e.contains(top) || top.contains(e))) };
  }, sel);
  if (!r || !r.topmost) return false;
  await fingerTapAt(r.cx, r.cy, opts);
  return true;
}
const consoleReachable = () => page.evaluate(() => {
  const b = document.querySelector('.pad-btn[data-id="6"]');
  if (!b) return false;
  const r = b.getBoundingClientRect();
  const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return !!(e && b.contains(e));
});

try {
/* ================= 2. THE STICKER, AT THREE RENDERED WIDTHS ================= */
console.log('\n--- 2. the sticker lands at the same proportion at three rendered widths ---');
const X_PCT = 32, Y_PCT = 41;
const rows = [];
for (const vp of [{ width: 1024, height: 640 }, { width: 780, height: 560 }, { width: 1440, height: 820 }]) {
  await page.setViewportSize(vp);
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="6"]', { timeout: 15000 });
  await page.evaluate(() => { window.__burns = []; });
  await fingerTap('.pad-btn[data-id="6"]');
  await page.waitForFunction(() => {
    const v = document.getElementById('camVideo');
    return !!(v && v.videoWidth > 0);
  }, { timeout: 20000 });
  await fingerTap('#camShutterBtn');
  await page.waitForFunction(() => {
    const l = document.getElementById('camStickerLayer');
    return !!(l && getComputedStyle(l).display !== 'none');
  }, { timeout: 10000 });

  /* Pick a sticker, then place it at a known proportion of the LAYER. */
  await fingerTap('.cam-sticker-pick');
  const layer = await page.evaluate(() => {
    const l = document.getElementById('camStickerLayer').getBoundingClientRect();
    return { x: l.x, y: l.y, w: l.width, h: l.height };
  });
  await fingerTapAt(layer.x + layer.w * (X_PCT / 100), layer.y + layer.h * (Y_PCT / 100));

  const preview = await page.evaluate(() => {
    const l = document.getElementById('camStickerLayer');
    const el = l.querySelector('div');
    if (!el) return null;
    const lr = l.getBoundingClientRect();
    return { fontPx: parseFloat(getComputedStyle(el).fontSize), layerW: lr.width,
      leftPct: parseFloat(el.style.left), topPct: parseFloat(el.style.top) };
  });
  if (!preview) { bad(`${vp.width}px viewport: no sticker was placed in the preview`); continue; }

  /* A canvas width this check chose, well away from anything the preview implies. */
  await fingerTap('#camSaveBtn');
  await wait(400);
  const burn = await page.evaluate(() => (window.__burns || []).slice(-1)[0] || null);
  if (!burn) { bad(`${vp.width}px viewport: the save path drew no sticker onto the canvas`); continue; }

  const previewFrac = preview.fontPx / preview.layerW;
  const burnFrac = parseFloat(burn.font) / burn.w;
  const posX = burn.x / burn.w * 100, posY = burn.y / burn.h * 100;
  rows.push({ vp: vp.width, layerW: Math.round(preview.layerW), canvasW: burn.w,
    previewFrac, burnFrac, posX, posY });

  await fingerTap('#camCloseBtn');
  await wait(200);
}
console.log('        ' + rows.map((r) => `layer ${r.layerW}px / canvas ${r.canvasW}px: preview ${(r.previewFrac * 100).toFixed(3)}% vs burn ${(r.burnFrac * 100).toFixed(3)}%`).join('\n        '));
if (rows.length < 3) {
  bad(`only ${rows.length} of three widths produced a measurement`);
} else {
  const worst = Math.max(...rows.map((r) => Math.abs(r.previewFrac - r.burnFrac)));
  const spread = Math.max(...rows.map((r) => r.layerW)) - Math.min(...rows.map((r) => r.layerW));
  const far = rows.some((r) => Math.abs(r.layerW - 600) > 200);
  if (worst < 0.002 && far) {
    ok(`the sticker is the same fraction of the image in both paths at all three widths — worst disagreement ${(worst * 100).toFixed(4)} points, across a ${spread}px spread of rendered width including one well away from 600px`);
  } else if (!far) {
    bad('all three widths sat near 600px, where the old defect is invisible', JSON.stringify(rows.map((r) => r.layerW)));
  } else {
    bad('the preview and the burn size the sticker differently', rows.map((r) => `layer ${r.layerW}: ${(r.previewFrac * 100).toFixed(3)}% vs ${(r.burnFrac * 100).toFixed(3)}%`).join(' · '));
  }
  const posOff = Math.max(...rows.map((r) => Math.max(Math.abs(r.posX - X_PCT), Math.abs(r.posY - Y_PCT))));
  if (posOff < 0.6) ok(`and it is burned at the proportion it was placed at — within ${posOff.toFixed(2)} percentage points of ${X_PCT}%/${Y_PCT}% at every width`);
  else bad('the sticker is burned at a different proportion than it was placed at', `worst ${posOff.toFixed(2)} points off`);
}

/* ================= 3. THE TWO BUTTONS, BY FINGER ================= */
console.log('\n--- 3. CAPTURE and RESHARE, one tap, pressed with a finger ---');
await page.setViewportSize({ width: 1024, height: 640 });
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="6"]', { timeout: 15000 });
/* Supabase configured, without a network: the gate reads config, and broadcastPhoto
 * returns early with no channel. What is under test is the button, not the transport. */
/* THE REAL KEY NAMES, read out of index.html rather than guessed. The first version
 * invented `supabaseUrl`/`supabaseKey`, the app read `puppad_sb_*`, isSupabaseConfigured()
 * stayed false, and every assertion below it failed for that reason instead of its own —
 * §6.1 member 3. It did at least prove the gate is load-bearing: with the app
 * unconfigured, CAPTURE refused and RESHARE was never painted. */
await page.evaluate(() => {
  localStorage.setItem('puppad_sb_url', 'https://example.supabase.co');
  localStorage.setItem('puppad_sb_key', 'test-key-not-a-secret');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="6"]', { timeout: 15000 });
const configured = await page.evaluate(() => isSupabaseConfigured());
if (!configured) bad('the fixture could not put the app into a configured state; sections below are vacuous');

const PIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC';
for (const variant of [{ name: 'a plain tap', opts: {} },
                       { name: 'a tap that slides 20px', opts: { slide: 20 } },
                       { name: 'a tap with a second finger already on the glass', opts: { extraFinger: { x: 500, y: 300 } } }]) {
  await page.evaluate(() => { document.querySelectorAll('#snapCaptureBtn').forEach((e) => e.parentNode && e.parentNode.parentNode && e.parentNode.remove()); });
  await page.evaluate((u) => { window.cameraGallery = []; showRemotePhoto(u); }, PIX);
  await wait(200);
  const before = await page.evaluate(() => window.cameraGallery.length);
  const pressed = await fingerTap('#snapCaptureBtn', variant.opts);
  const after = await page.evaluate(() => window.cameraGallery.length);
  if (pressed && after === before + 1) ok(`CAPTURE keeps an incoming snap in one tap — ${variant.name}`);
  else bad(`CAPTURE did not keep the snap with ${variant.name}`, `pressed=${pressed}, gallery ${before} -> ${after}`);
}
/* The four-second fade must not take the button away mid-reach. */
await page.evaluate((u) => { window.cameraGallery = []; showRemotePhoto(u); }, PIX);
await wait(3200);
const stillThere = await page.evaluate(() => !!document.getElementById('snapCaptureBtn'));
if (stillThere) ok('and it is still on screen after three seconds, so the fade does not punish hesitation');
else bad('the CAPTURE button vanished before the popup did');

/* RESHARE, on the expanded gallery image. */
await page.evaluate((u) => {
  window.cameraGallery = [u, u];
  openCamera();
}, PIX);
await page.waitForSelector('#camGalleryStrip', { timeout: 10000 });
await wait(300);
/* `[data-gallery-idx]` is what renderGallery writes, read from the source rather than
 * guessed. NOTE, and it is a finding rather than a fix: this strip is wired on bare
 * `click`, so a tap that SLIDES does not open a photo. That is PUP-WO-0106's surface —
 * Draw, Camera and Map are named there as not going through wireTap — and §4 fences it
 * out of this work order. A plain tap is used here so the strip is not what fails. */
const opened = await fingerTap('#camGalleryStrip [data-gallery-idx]');
await wait(400);
const shareSeen = await page.evaluate(() => !!document.querySelector('.gShare'));
if (!shareSeen) {
  bad('could not reach the expanded gallery image, so RESHARE was not exercised', `gallery strip tap returned ${opened}`);
} else {
  let sends = 0;
  await page.exposeFunction('__sent', () => { sends++; });
  await page.evaluate(() => {
    const real = window.broadcastPhoto;
    window.broadcastPhoto = function (d) { window.__sent(); return real.apply(this, arguments); };
  });
  const p2 = await fingerTap('.gShare');
  await wait(900);
  if (p2 && sends === 1) ok('RESHARE sends the expanded photo out again in one tap, pressed with a finger');
  else bad('RESHARE did not send in one tap', `pressed=${p2}, broadcastPhoto called ${sends} time(s)`);
  const backOut = await fingerTap('.gClose');
  await wait(250);
  if (backOut) ok('and one tap closes the expanded image');
  else bad('could not close the expanded image with a finger');
}
/* Left through the shipped control, with a finger, rather than by calling closeCamera()
 * — the claim is "one tap back from every state" (§3.6), and a function call is not a
 * tap. */
const leftByFinger = await fingerTap('#camCloseBtn');
await wait(400);
if (leftByFinger && await consoleReachable()) ok('one tap on the camera CLOSE leaves the console reachable, pressed with a finger');
else bad('the console is not reachable after leaving the camera', `tapped=${leftByFinger}`);

/* ================= 4. SUPABASE UNCONFIGURED ================= */
console.log('\n--- 4. with Supabase unconfigured, both degrade and nothing traps ---');
/* The same real key names, and a RELOAD — `supabaseUrl`/`supabaseKey` are module-scope
 * variables read once at startup, so clearing storage without reloading leaves the app
 * configured and this whole section testing the configured path twice. */
await page.evaluate(() => { localStorage.removeItem('puppad_sb_url'); localStorage.removeItem('puppad_sb_key'); });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="6"]', { timeout: 15000 });
const unconf = await page.evaluate((u) => {
  const out = { configured: isSupabaseConfigured() };
  window.cameraGallery = [u];
  openCamera();
  return out;
}, PIX);
await wait(500);
const noShare = await page.evaluate((u) => {
  const before = window.cameraGallery.length;
  showRemotePhoto(u);
  const cap = document.getElementById('snapCaptureBtn');
  let capturedAnyway = false;
  if (cap) { cap.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); cap.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); capturedAnyway = window.cameraGallery.length > before; }
  return { share: !!document.querySelector('.gShare'), capturedAnyway };
}, PIX);
await page.evaluate(() => { try { closeCamera(); } catch (e) {} });
await wait(250);
const reachable = await consoleReachable();
if (!unconf.configured && !noShare.share && !noShare.capturedAnyway && reachable) {
  ok('unconfigured: RESHARE is not painted, CAPTURE refuses through the same gate every other call site uses, and the console stays reachable');
} else {
  bad('a share control did not degrade with Supabase unconfigured', JSON.stringify({ ...unconf, ...noShare, reachable }));
}

if (pageErrors.length) bad(`${pageErrors.length} uncaught page error(s)`, pageErrors.slice(0, 3).join(' | '));
else ok('no uncaught page errors throughout');

} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n::error::CHECK 20 FAILED — ${failures.length} — PUP-WO-0700 §3 is not satisfied.`);
  console.error(`\nCHECK 20 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 20 PASSED at ${COMMIT.slice(0, 12)} — the sticker is one expression measured at three widths, and both share buttons answer a finger in one tap.`);
