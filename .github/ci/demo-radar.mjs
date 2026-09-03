#!/usr/bin/env node
/**
 * CHECK 23 — the radar's long press.  PUP-WO-0602.
 *
 * The app's central feature: press and hold the radar to drop an X. On the S10+ that
 * opens the BROWSER'S CONTEXT MENU; on the S25 Ultra it does nothing at all.
 *
 * WHAT THIS HARNESS CAN AND CANNOT DO, MEASURED BEFORE ANYTHING WAS BUILT — because
 * PUP-WO-0603 spent a day discovering the same class of gap after the fact.
 *
 *   IT CANNOT PRODUCE A LONG-PRESS CONTEXT MENU. A 1400ms touch hold yields ZERO
 *   `contextmenu` events — not on this app, and not on a plain page with selectable text
 *   and no `touch-action` at all. The control is the point: the harness does not decline
 *   to raise one HERE, it cannot raise one ANYWHERE, so a green on "no menu appeared
 *   after a long press" would be a statement about Chromium's synthetic input pipeline
 *   and not about the app.
 *
 *   IT CAN OBSERVE AND DELIVER ONE. A right-click raises a real `contextmenu` event at
 *   the same coordinates, and the app's handler sees it exactly as it would see the one
 *   Android raises from a finger.
 *
 * THAT ASYMMETRY IS WHY THIS CHECK IS WORTH MORE THAN PUP-WO-0603'S. The TRIGGER is not
 * reproducible, but the SUPPRESSION is: §1 delivers a real contextmenu to the radar and
 * asserts it is cancelled, delivers one to an adult surface and asserts it is NOT, and
 * both go red against plants. What remains unverified is narrow and named — that an
 * Android long press raises the event this handler is waiting for.
 *
 * §2 needs no such hedge. `pointercancel` is dispatchable, so the defect the S25 most
 * likely shows — a gesture the browser took away, leaving a timer that stamps an X the
 * child never finished — is reproduced and fixed under measurement.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 23 cannot identify the commit it is testing.');
  process.exit(1);
}
console.log(`CHECK 23 — the radar's long press. subject ${COMMIT.slice(0, 12)}\n`);

const ONLY = (() => { const a = process.argv.find((x) => x.startsWith('--only=')); return a ? new Set(a.slice(7).split(',').map(Number)) : null; })();
const want = (n) => !ONLY || ONLY.has(n);
const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };
const info = (m) => console.log(`  ....  ${m}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const PLAIN = `<meta name=viewport content="width=device-width,initial-scale=1">
<style>body{margin:0;font:16px sans-serif}#t{padding:40px}</style><div id=t>some selectable text</div>`;
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__plain.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(PLAIN); return; }
    const f = join(REPO, u.pathname === '/' ? '/index.html' : u.pathname);
    const b = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(0);
await new Promise((r) => server.once('listening', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* The S10+ in landscape — architecture §3, and the device that shows the defect. */
const S10 = { width: 869, height: 412 };
const LONG_PRESS_MS = 1000;   /* index.html:257. Read below rather than trusted. */

const browser = await chromium.launch({ channel: 'chromium' });

async function shape() {
  const ctx = await browser.newContext({ viewport: S10, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const open = async () => {
    await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#radarArea', { timeout: 15000 });
    await page.waitForTimeout(250);
  };
  const at = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, x: r.x, y: r.y, w: r.width, h: r.height };
  }, sel);
  /* COUNTED FROM THE LAYERS THE APP ACTUALLY APPENDS TO, read out of the source rather
   * than guessed: spawnX appends to #xMarkLayer and spawnPaw to #touchLayer, both as
   * bare <div>s with no class — so a class selector counts zero forever and every
   * assertion built on it is vacuous. The first version of this file did exactly that. */
  const marks = () => page.evaluate(() => {
    const x = document.getElementById('xMarkLayer');
    const p = document.getElementById('touchLayer');
    return { x: x ? x.children.length : -1, paws: p ? p.children.length : -1 };
  });
  return { ctx, page, cdp, touch, open, at, marks };
}

try {
/* ------------------------------------------------------------------ */
if (want(1)) {
  console.log('--- 1. the browser menu is refused ON THE RADAR and nowhere else ---');
  const s = await shape();

  /* THE HARNESS'S OWN LIMIT, MEASURED FIRST AND REPORTED WHETHER OR NOT IT IS
   * CONVENIENT. If a long press cannot raise a contextmenu even on a plain selectable
   * page, then "the long press raised no menu" is a fact about Chromium. */
  await s.page.goto(ORIGIN + '/__plain.html', { waitUntil: 'domcontentloaded' });
  await s.page.evaluate(() => { window.__c = 0; window.addEventListener('contextmenu', () => window.__c++, true); });
  const t = await s.at('#t');
  await s.touch('touchStart', [{ x: t.cx, y: t.cy, id: 1 }]);
  await s.page.waitForTimeout(1400);
  await s.touch('touchEnd', []);
  await s.page.waitForTimeout(250);
  const fromHold = await s.page.evaluate(() => window.__c);
  if (fromHold > 0) {
    info(`this harness CAN raise a contextmenu from a touch hold (${fromHold}) — the long-press path below is directly testable`);
  } else {
    info('this harness CANNOT raise a contextmenu from a touch hold: a 1400ms hold on a plain selectable');
    info('   page with no touch-action produced ZERO. So the TRIGGER is not reproducible here and no');
    info('   assertion below claims it is. The SUPPRESSION is, and that is what is asserted.');
  }

  await s.open();
  await s.page.evaluate(() => {
    window.__seen = [];
    /* BUBBLE PHASE AT `window`, NOT CAPTURE. A capture listener on window runs BEFORE the
     * radar's own handler, so `defaultPrevented` is always false there and the section
     * reports the suppression missing on a build that has it. The first version of this
     * file did exactly that and failed a correct fix. window is the LAST hop of the
     * bubble, so by here every author handler has run. */
    window.addEventListener('contextmenu', (e) => window.__seen.push({ id: (e.target.closest && e.target.closest('#radarArea')) ? 'radar' : 'other', prevented: e.defaultPrevented }));
  });

  /* A REAL contextmenu EVENT, delivered where a finger would raise one. */
  const r = await s.at('#radarArea');
  await s.page.mouse.move(r.cx, r.cy);
  await s.page.mouse.down({ button: 'right' });
  await s.page.mouse.up({ button: 'right' });
  await s.page.waitForTimeout(250);
  const onRadar = await s.page.evaluate(() => window.__seen.filter((v) => v.id === 'radar'));
  if (!onRadar.length) bad('no contextmenu event reached the radar at all — this section cannot measure the suppression');
  else if (!onRadar.every((v) => v.prevented)) bad('a contextmenu on the radar was NOT cancelled',
    'this is the S10+ symptom: the browser menu opens over the game and a non-reader cannot dismiss it');
  else ok(`a contextmenu raised on the radar is cancelled (${onRadar.length} event(s), all prevented)`);

  /* AND THE OTHER HALF, which is what stops this being the blanket suppression §5 names
   * as a flag-and-stop: an adult surface must KEEP its menu and its text selection. */
  await s.page.evaluate(() => { window.__seen = []; });
  const btn = await s.at('#settingsBtn') || await s.at('.pad-btn[data-id="0"]');
  if (!btn) info('no adult control found to test the scope against');
  else {
    await s.page.mouse.move(btn.cx, btn.cy);
    await s.page.mouse.down({ button: 'right' });
    await s.page.mouse.up({ button: 'right' });
    await s.page.waitForTimeout(250);
    const other = await s.page.evaluate(() => window.__seen.filter((v) => v.id === 'other'));
    if (!other.length) info('no contextmenu reached the adult surface, so the scope was not exercised');
    else if (other.some((v) => v.prevented)) bad('a contextmenu OFF the radar was also cancelled',
      'that is a document-level suppression — every adult surface loses text selection');
    else ok('a contextmenu away from the radar is left alone, so the adult surfaces keep selection');
  }
  await s.ctx.close();
}

/* ------------------------------------------------------------------ */
if (want(2)) {
  console.log('\n--- 2. an INTERRUPTED long press leaves no X, no timer, and the next tap still works ---');
  const s = await shape();
  await s.open();

  /* Timers are attributed to the page so a stuck one is visible. */
  await s.page.evaluate(() => {
    window.__timers = new Set();
    const sT = window.setTimeout.bind(window), cT = window.clearTimeout.bind(window);
    window.setTimeout = function (fn, ms) { const id = sT(function () { window.__timers.delete(id); return fn(); }, ms); window.__timers.add(id); return id; };
    window.clearTimeout = function (id) { window.__timers.delete(id); return cT(id); };
  });

  const r = await s.at('#radarArea');
  const before = await s.marks();
  /* OBSERVE the id the browser assigns this touch; do not assume it. */
  await s.page.evaluate(() => {
    window.__radarPid = -1;
    document.getElementById('radarArea').addEventListener('pointerdown', (e) => { if (window.__radarPid < 0) window.__radarPid = e.pointerId; }, true);
  });

  /* THE INTERRUPTION THE WORK ORDER CARES MOST ABOUT: the browser takes the gesture. */
  await s.touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]);
  await s.page.waitForTimeout(200);
  /* A REAL `touchCancel`, NOT A HAND-MADE PointerEvent. The first version of this
   * dispatched `new PointerEvent('pointercancel', {pointerId: 1})` — and the radar's
   * owner-guard REJECTED IT, correctly, because the browser had assigned the live touch a
   * different pointerId. The section then reported the fix missing on a build that has
   * it. Guessing an id is the same mistake as pasting a constant: ask the platform for
   * the gesture instead, and it cancels the pointer it actually created. */
  try {
    await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [{ x: r.cx, y: r.cy, id: 1 }] });
  } catch (e) {
    /* Fall back to a synthetic event carrying THE ID THE PAGE ACTUALLY SAW, recorded on
     * pointerdown above — never a guessed one. */
    await s.page.evaluate(() => {
      const el = document.getElementById('radarArea');
      el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: window.__radarPid }));
    });
  }
  await s.page.waitForTimeout(LONG_PRESS_MS + 400);
  const afterCancel = await s.marks();
  const armed = await s.page.evaluate(() => window.__timers.size);
  await s.touch('touchEnd', []);
  await s.page.waitForTimeout(200);

  if (afterCancel.x > before.x) bad('a cancelled long press still stamped an X',
    'the browser took the gesture away and the timer outlived it — the mark lands at a press the child never finished');
  else if (armed > 0) bad(`${armed} timer(s) still armed after the gesture was cancelled`);
  else ok('a long press the browser cancels leaves no X and no armed timer');

  /* AND THE NEXT ORDINARY TAP MUST STILL WORK — the half that proves the fix did not
   * simply disable the feature. */
  const mid = await s.marks();
  await s.touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]);
  await s.page.waitForTimeout(120);
  await s.touch('touchEnd', []);
  await s.page.waitForTimeout(300);
  const afterTap = await s.marks();
  if (!(afterTap.paws > mid.paws)) bad('after an interrupted long press the next ordinary tap does nothing',
    `paw count stayed ${afterTap.paws} — the radar is dead until reload, which is the S25 symptom`);
  else ok('the next ordinary tap after an interruption still leaves its paw');

  /* AND THE LONG PRESS ITSELF MUST STILL FIRE, or every assertion above is satisfied by
   * a feature that was removed. */
  const pre = await s.marks();
  await s.touch('touchStart', [{ x: r.cx, y: r.cy, id: 1 }]);
  await s.page.waitForTimeout(LONG_PRESS_MS + 350);
  await s.touch('touchEnd', []);
  await s.page.waitForTimeout(250);
  const post = await s.marks();
  if (!(post.x > pre.x)) bad('an UNINTERRUPTED long press no longer stamps an X — the feature is gone, not fixed',
    `X count stayed ${post.x}; every assertion above is vacuous against a radar that does nothing`);
  else ok('an uninterrupted long press still stamps its X, so the assertions above are not vacuous');
  await s.ctx.close();
}

/* ------------------------------------------------------------------ */
if (want(3)) {
  console.log('\n--- 3. a second finger does not move the mark or restart the press ---');
  const s = await shape();
  await s.open();
  const r = await s.at('#radarArea');
  const before = await s.marks();

  /* A THREE-YEAR-OLD ALWAYS HAS A SECOND CONTACT. It used to call pointerdown again,
   * restart the timer and overwrite the position, so the X landed under the SECOND
   * finger and the press he was actually holding was discarded. */
  await s.touch('touchStart', [{ x: r.x + r.w * 0.25, y: r.cy, id: 1 }]);
  await s.page.waitForTimeout(300);
  await s.touch('touchStart', [{ x: r.x + r.w * 0.25, y: r.cy, id: 1 }, { x: r.x + r.w * 0.75, y: r.cy, id: 2 }]);
  await s.page.waitForTimeout(LONG_PRESS_MS + 300);
  const after = await s.marks();
  await s.touch('touchEnd', []);
  await s.page.waitForTimeout(200);

  if (!(after.x > before.x)) bad('a long press with a second finger resting on the glass never fired at all',
    'the child holds the radar with one hand on the screen — this is his ordinary gesture');
  else if (after.x - before.x > 1) bad(`a two-finger hold stamped ${after.x - before.x} X marks`, 'one press, one mark');
  else ok('a long press survives a second finger landing, and stamps exactly one X');
  await s.ctx.close();
}

} finally { await browser.close(); server.close(); }

if (failures.length) {
  console.error(`\n::error::CHECK 23 FAILED — ${failures.length} — the radar's long press is not fixed.`);
  console.error(`\nCHECK 23 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
console.log(`\nCHECK 23 PASSED at ${COMMIT.slice(0, 12)} — a contextmenu raised on the radar is cancelled while one raised anywhere else is left alone, a long press the browser takes away leaves no X and no armed timer, the next ordinary tap still lands its paw, an uninterrupted long press still stamps its X, and a second finger neither moves the mark nor doubles it.`);
