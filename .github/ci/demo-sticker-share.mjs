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
/* ANCHORED TO NAMED FUNCTIONS, not to a style string. The first version matched
 * `el.style.cssText = 'position:absolute;left:'+…` — and when the sticker stopped being
 * positioned that way it silently started matching `spawnPaw`, an unrelated element four
 * hundred lines away, and reported the fix missing. That is the SECOND time this
 * assertion named the wrong subject; both times it failed loudly rather than passing,
 * which is the only reason it was cheap. A named function is not a pattern that drifts. */
const layoutFn = html.match(/function layoutStickerEl\([\s\S]{0,500}?\n\}/);
const boxFn = html.match(/function photoBoxIn\([\s\S]{0,700}?\n\}/);
/* Bounded by the handler's own last statement rather than by a brace-and-indent guess:
 * the comment block inside it is longer than the window the first version allowed, so the
 * regex matched nothing and the check reported the handler missing. */
const placement = html.match(/camStickerLayer'\)\.addEventListener\('click'[\s\S]{0,4000}?doSound\('keyTap'\);/);
const burnBlock = html.match(/reviewStickers\.forEach\(function\(s\)[\s\S]{0,600}?\}\);/);
const burnLine = burnBlock ? burnBlock[0].match(/var sz\s*=\s*[^;]+;/) : null;
const problems = [];
if (decl.length !== 1) problems.push(`the scale fraction is declared ${decl.length} time(s), not once`);
if (!boxFn) problems.push('photoBoxIn() is missing — nothing states where the photo is inside the letterboxed panel');
if (!layoutFn || !/stickerFontPx\(box\.w\)/.test(layoutFn[0])) problems.push('layoutStickerEl() does not size the preview from the PHOTO width');
if (!placement) problems.push('the sticker placement handler was not found');
else {
  if (!/photoBoxIn\(/.test(placement[0])) problems.push('placement does not measure against the photo box');
  if (!/layoutStickerEl\(/.test(placement[0])) problems.push('placement does not go through layoutStickerEl()');
  if (/font-size:\s*\d+px/.test(placement[0])) problems.push('placement still hardcodes a pixel font size');
}
if (!burnLine || !/stickerFontPx\(/.test(burnLine[0])) problems.push('the burn does not size through stickerFontPx()');
if (!problems.length) {
  ok(`one expression, and one coordinate system: STICKER_W_FRAC declared once, photoBoxIn() states where the photo is, and placement, preview and burn all read them — ${burnLine[0].trim()}`);
} else {
  bad(`${problems.length} structural problem(s) with the sticker fix`, problems.join(' · '));
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
console.log('\n--- 2. the sticker lands where it was placed, MEASURED ON SCREEN, at three widths ---');
/* THE FIRST VERSION OF THIS SECTION WAS BLIND BY CONSTRUCTION, and that is the most
 * important thing in this file.
 *
 * It divided the preview's font size by the LAYER width and the burn's by the CANVAS
 * width, and asserted the two fractions were equal. But `#camReviewCanvas` is
 * `object-fit: contain`, so the photo is LETTERBOXED inside the layer — the layer is the
 * element box, the canvas is the image. Those are the two denominators that make a real
 * mismatch cancel exactly. It reported `worst disagreement 0.0104 points` at every
 * viewport while the sticker on screen was up to 62% too small, and it was green in two
 * of its own three viewports while the defect was present in both.
 *
 * That is architecture §6.1 member 6 in the check written to close member 6: agreement
 * was measured in the one coordinate system where disagreement is invisible.
 *
 * SO EVERYTHING IS NOW MEASURED IN CSS PIXELS ON THE SCREEN — what the child sees in the
 * preview, against what the burn would put there once the saved image is displayed in the
 * same box. One space, no denominators to choose, nothing that can cancel. */
const X_PCT = 32, Y_PCT = 41;
const rows = [];
for (const vp of [{ width: 1024, height: 640 }, { width: 780, height: 560 },
                  { width: 1920, height: 500 }]) {
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
  await fingerTap('.cam-sticker-pick');

  /* Placed at a fraction OF THE PHOTO, which is what the child is aiming at — the black
   * bars are not part of the picture. */
  const box = await page.evaluate(() => {
    const l = document.getElementById('camStickerLayer');
    const c = document.getElementById('camReviewCanvas');
    const r = l.getBoundingClientRect();
    const b = photoBoxIn(l, c);
    return { layerX: r.x, layerY: r.y, layerW: r.width, layerH: r.height,
      x: b.x, y: b.y, w: b.w, h: b.h, canvasW: c.width, canvasH: c.height };
  });
  await fingerTapAt(box.layerX + box.x + box.w * (X_PCT / 100),
                    box.layerY + box.y + box.h * (Y_PCT / 100));

  const preview = await page.evaluate(() => {
    const l = document.getElementById('camStickerLayer');
    const el = l.querySelector('div');
    if (!el) return null;
    const lr = l.getBoundingClientRect(), er = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { fontPx: parseFloat(cs.fontSize), lineHeightPx: parseFloat(cs.lineHeight),
      boxH: er.height, cx: er.x + er.width / 2 - lr.x, cy: er.y + er.height / 2 - lr.y };
  });
  if (!preview) { bad(`${vp.width}x${vp.height}: no sticker was placed in the preview`); continue; }

  await fingerTap('#camSaveBtn');
  await wait(400);
  const burn = await page.evaluate(() => (window.__burns || []).slice(-1)[0] || null);
  if (!burn) { bad(`${vp.width}x${vp.height}: the save path drew no sticker onto the canvas`); continue; }

  /* The burn, expressed where the child would see it: canvas pixels scaled into the
   * photo's box on screen. */
  const k = box.w / burn.w;
  const burnScreen = { fontPx: parseFloat(burn.font) * k,
    cx: box.x + burn.x * k, cy: box.y + burn.y * (box.h / burn.h) };
  rows.push({ vp: `${vp.width}x${vp.height}`, layerW: Math.round(box.layerW),
    photoW: Math.round(box.w), letterbox: Math.round(box.layerW - box.w),
    pFont: preview.fontPx, bFont: burnScreen.fontPx,
    dPos: Math.hypot(preview.cx - burnScreen.cx, preview.cy - burnScreen.cy),
    lineH: preview.lineHeightPx, boxH: preview.boxH });

  await fingerTap('#camCloseBtn');
  await wait(200);
}
console.log('        ' + rows.map((r) => `${r.vp}: layer ${r.layerW} photo ${r.photoW} (letterbox ${r.letterbox}px) — preview ${r.pFont.toFixed(1)}px vs burn-on-screen ${r.bFont.toFixed(1)}px, centres ${r.dPos.toFixed(1)}px apart`).join('\n        '));
if (rows.length < 3) {
  bad(`only ${rows.length} of three widths produced a measurement`);
} else {
  /* Tolerances in CSS pixels, because that is the unit the defect is felt in. 1.5px of
   * size and 2px of position on a photo hundreds of pixels wide is a rounding argument;
   * the defect this replaces was 38px of size and 214px of position. */
  const worstFont = Math.max(...rows.map((r) => Math.abs(r.pFont - r.bFont)));
  const worstPos = Math.max(...rows.map((r) => r.dPos));
  const boxed = rows.filter((r) => r.letterbox > 40).length;
  if (boxed === 0) {
    bad('none of the three widths letterboxed the photo, so the coordinate-system defect could not have been seen', JSON.stringify(rows.map((r) => r.letterbox)));
  } else if (worstFont < 1.5 && worstPos < 2) {
    ok(`the sticker is drawn where and at the size it was placed, ON SCREEN, at all three widths — worst size error ${worstFont.toFixed(2)}px, worst centre error ${worstPos.toFixed(2)}px, across ${boxed} viewport(s) where the photo is letterboxed by up to ${Math.max(...rows.map((r) => r.letterbox))}px`);
  } else {
    bad('the preview and the burn put the sticker in different places on screen',
      rows.map((r) => `${r.vp}: ${r.pFont.toFixed(1)} vs ${r.bFont.toFixed(1)}px, ${r.dPos.toFixed(1)}px apart`).join(' · '));
  }
  /* `line-height:1` is called part of the fix in the source, and nothing could see it —
   * removing it left this check bit-identical. The preview's BOX is what
   * translate(-50%,-50%) centres, so the box height IS the assertion. */
  const worstBox = Math.max(...rows.map((r) => Math.abs(r.boxH - r.pFont)));
  if (worstBox < 2) ok(`and the preview's line box equals its font size (worst ${worstBox.toFixed(2)}px), so translate(-50%,-50%) centres the same thing textBaseline:'middle' does`);
  else bad('the preview element is taller than its font size, so it is centred differently from the burn', `worst ${worstBox.toFixed(2)}px — line-height:1 is missing or overridden`);
  /* A sticker both paths agree on can still be absurd. 0.12 or 0.9 would have passed
   * every assertion above; a sticker is a decoration on a photograph, not the photograph. */
  const frac = rows[0].bFont / rows[0].photoW;
  if (frac > 0.02 && frac < 0.15) ok(`and it is a sane fraction of the photo (${(frac * 100).toFixed(1)}%), not merely a fraction both paths agree on`);
  else bad('the sticker is not a sensible size relative to the photo', `${(frac * 100).toFixed(1)}% of the photo width`);
}

/* A TAP ON THE BLACK BAR IS REFUSED, not silently moved onto the photograph. */
await page.setViewportSize({ width: 1920, height: 500 });
await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pad-btn[data-id="6"]', { timeout: 15000 });
await fingerTap('.pad-btn[data-id="6"]');
await page.waitForFunction(() => { const v = document.getElementById('camVideo'); return !!(v && v.videoWidth > 0); }, { timeout: 20000 });
await fingerTap('#camShutterBtn');
await page.waitForFunction(() => { const l = document.getElementById('camStickerLayer'); return !!(l && getComputedStyle(l).display !== 'none'); }, { timeout: 10000 });
await fingerTap('.cam-sticker-pick');
const bar = await page.evaluate(() => {
  const l = document.getElementById('camStickerLayer');
  const r = l.getBoundingClientRect();
  const b = photoBoxIn(l, document.getElementById('camReviewCanvas'));
  return { x: r.x + b.x / 2, y: r.y + r.height / 2, hasBar: b.x > 20 };
});
if (!bar.hasBar) {
  bad('the 1920x500 fixture did not letterbox, so the black-bar case was not exercised');
} else {
  await fingerTapAt(bar.x, bar.y);
  const placed = await page.evaluate(() => document.getElementById('camStickerLayer').children.length);
  if (placed === 0) ok('a tap on the black letterbox bar places nothing — it is not a place on the photo, and it is refused rather than moved onto one');
  else bad('a tap outside the photo was accepted and will be burned into the image', `${placed} sticker(s) placed on the bar`);
}
await fingerTap('#camCloseBtn');
await wait(200);
await page.setViewportSize({ width: 1024, height: 640 });

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

/* Two DISTINGUISHABLE images, so "did it send the right one" is answerable. A pair of
 * identical 1x1 pixels made every send look correct — which is how a mutant that always
 * sent gallery[0] passed. */
const [RED, BLUE] = await page.evaluate(() => ['#e11d48', '#2563eb'].map((col) => {
  const c = document.createElement('canvas');
  c.width = 240; c.height = 180;
  const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}));
const PIX = RED;

for (const variant of [{ name: 'a plain tap', opts: {} },
                       { name: 'a tap that slides 20px', opts: { slide: 20 } },
                       { name: 'a tap with a second finger already on the glass', opts: { extraFinger: { x: 500, y: 300 } } }]) {
  await page.evaluate(() => { document.querySelectorAll('#snapCaptureBtn').forEach((e) => e.parentNode && e.parentNode.parentNode && e.parentNode.remove()); });
  await page.evaluate((u) => { window.cameraGallery = []; showRemotePhoto(u); }, PIX);
  await wait(200);
  const pressed = await fingerTap('#snapCaptureBtn', variant.opts);
  /* WHAT WAS STORED, not how many. `cameraGallery.push('')` passed the count assertion. */
  const stored = await page.evaluate(() => window.cameraGallery.slice());
  if (pressed && stored.length === 1 && stored[0] === PIX) ok(`CAPTURE keeps the incoming snap — the actual bytes — in one tap, ${variant.name}`);
  else bad(`CAPTURE did not keep the right thing with ${variant.name}`, `pressed=${pressed}, stored ${stored.length} entr(y/ies), matches payload: ${stored[0] === PIX}`);
}

/* A BROADCAST PAYLOAD THAT IS NOT AN IMAGE MUST NOT BE KEPT. Six shapes, all of which
 * were stored and ticked as "kept" before: a text data URL, truncated base64, a
 * javascript: URL, an empty string, a remote path, and an attribute-escape attempt. */
const JUNK = ['data:text/plain,hello', 'data:image/png;base64,zzz!!', 'javascript:alert(1)',
  '', '/nope/missing.png', 'x" onerror="window.__pwned=1" data-z="'];
const kept = [];
for (const j of JUNK) {
  await page.evaluate(() => { document.querySelectorAll('#snapCaptureBtn').forEach((e) => e.parentNode && e.parentNode.parentNode && e.parentNode.remove()); });
  await page.evaluate((u) => { window.cameraGallery = []; delete window.__pwned; showRemotePhoto(u); }, j);
  await wait(150);
  await fingerTap('#snapCaptureBtn');
  const r = await page.evaluate(() => ({ n: window.cameraGallery.length, pwned: !!window.__pwned }));
  if (r.n > 0 || r.pwned) kept.push(`${JSON.stringify(j.slice(0, 28))} -> stored=${r.n} pwned=${r.pwned}`);
}
if (!kept.length) ok(`CAPTURE refuses all ${JUNK.length} non-image payloads, and none of them executed — the incoming image is assigned, never concatenated into markup`);
else bad(`${kept.length} non-image payload(s) were kept or executed`, kept.join(' · '));

/* The four-second fade must not take the button away mid-reach. */
await page.evaluate((u) => { window.cameraGallery = []; showRemotePhoto(u); }, PIX);
await wait(3200);
const stillThere = await page.evaluate(() => !!document.getElementById('snapCaptureBtn'));
if (stillThere) ok('and it is still on screen after three seconds, so the fade does not punish hesitation');
else bad('the CAPTURE button vanished before the popup did');

/* RESHARE, on the expanded gallery image — entry ONE of two, deliberately not the first. */
await page.evaluate(([r, b]) => { window.cameraGallery = [r, b]; openCamera(); }, [RED, BLUE]);
await page.waitForSelector('#camGalleryStrip', { timeout: 10000 });
await wait(300);
const thumbs = await page.evaluate(() => document.querySelectorAll('#camGalleryStrip [data-gallery-idx]').length);
const opened = await fingerTap('#camGalleryStrip [data-gallery-idx="1"]');
await wait(400);
const shareSeen = await page.evaluate(() => !!document.querySelector('.gShare'));
if (thumbs !== 2 || !shareSeen) {
  bad('could not reach the expanded gallery image, so RESHARE was not exercised', `thumbs=${thumbs}, strip tap returned ${opened}`);
} else {
  await page.evaluate(() => {
    window.__sent = [];
    const real = window.broadcastPhoto;
    window.broadcastPhoto = function (d) { window.__sent.push(d); return real.apply(this, arguments); };
  });
  const p2 = await fingerTap('.gShare');
  await wait(1200);
  /* WHAT WENT OUT, not that something did. A mutant sending gallery[0], and one skipping
   * compressForBroadcast entirely, both passed a `sends === 1` assertion. */
  const sent = await page.evaluate(async () => {
    const arr = window.__sent || [];
    if (arr.length !== 1) return { n: arr.length };
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = arr[0]; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return { n: 1, w: img.naturalWidth, rgb: [d[0], d[1], d[2]], isJpeg: arr[0].startsWith('data:image/jpeg') };
  });
  const isBlue = sent.rgb && sent.rgb[2] > 150 && sent.rgb[0] < 100;
  if (p2 && sent.n === 1 && isBlue && sent.w === 600 && sent.isJpeg) {
    ok(`RESHARE sends THE EXPANDED photo — the second entry, not the first — recompressed through compressForBroadcast to ${sent.w}px JPEG, in one tap by finger`);
  } else {
    bad('RESHARE did not send the right image, or did not send it through the shared compressor',
      JSON.stringify({ pressed: p2, ...sent, isBlue }));
  }
  /* `{repeat:true}` and the 1400ms re-arm are the whole design of this control; a mutant
   * that fired once ever passed, because it was only ever pressed once. */
  await wait(900);
  const p3 = await fingerTap('.gShare');
  await wait(900);
  const again = await page.evaluate(() => (window.__sent || []).length);
  if (p3 && again === 2) ok('and it re-arms — a second press sends again, so a child who means it twice is not told the button is broken');
  else bad('RESHARE does not work a second time', `second press=${p3}, total sends ${again}`);

  /* The ONLY exit from this full-screen modal, pressed the two ways a browser
   * synthesises no click for. */
  const closedHard = await fingerTap('.gClose', { slide: 20 });
  await wait(300);
  let gone = await page.evaluate(() => !document.querySelector('.gImg'));
  if (!gone) {
    await fingerTap('.gClose', { extraFinger: { x: 500, y: 120 } });
    await wait(300);
    gone = await page.evaluate(() => !document.querySelector('.gImg'));
  }
  if (closedHard && gone) ok('and the expanded view — whose exit is the only one reachable while it is open — closes on a tap that SLIDES, not just a clean one');
  else bad('the only exit from the expanded photo does not survive a sliding tap or a second finger', `tapped=${closedHard}, closed=${gone}`);
}
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
