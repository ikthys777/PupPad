#!/usr/bin/env node
/**
 * CHECK 17 — the picker, in a real browser, pressed with a FINGER.
 *
 * PUP-WO-0201 §3. Every item on that acceptance list is a claim about a full-screen
 * surface a three-year-old operates by touch, and this project has already shipped one
 * control that every check called reachable while it was inert to a finger — a synthetic
 * mouse click is subject to neither the multi-touch rule nor touch slop, and both games
 * checks used one. So the tiles and the exit here are pressed with CDP touch points,
 * including the two gestures that used to fail: a tap with a second finger resting on the
 * glass, and a tap that slides.
 *
 * WHAT IT CANNOT DO IS ROADMAP P2 GATE 3. That gate covers every word on the screen and
 * asks a person who has not seen the app to name each tile. A model predicting what a
 * stranger would say is not evidence about a stranger, and PUP-WO-0201 §7 makes
 * simulating it a flag-and-stop. The gate stays open until a human runs it.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));

let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 17 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}
console.log(`CHECK 17 — the picker, pressed with a finger. subject ${COMMIT.slice(0, 12)}\n`);

/* The registry is read from the tree, never assumed — the same rule that stopped checks
 * 13 and 14 hard-coding whichever game happened to be first. */
const html = readFileSync(join(REPO, 'index.html'), 'utf8');
const reg = html.match(/var GAMES\s*=\s*\[([\s\S]*?)\n\];/);
if (!reg) { console.error('::error::CHECK 17 cannot find `var GAMES = [ ... ];` in index.html'); process.exit(1); }
const IDS = [...reg[1].matchAll(/id\s*:\s*'([^']+)'/g)].map((m) => m[1]);
if (!IDS.length) { console.error('::error::CHECK 17 found no registry entries'); process.exit(1); }
console.log(`  registry: ${IDS.join(', ')}\n`);

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
      'Service-Worker-Allowed': '/', 'Cache-Control': 'no-store' }).end(await readFile(full));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

const centreOf = (sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) };
}, sel);

/* A FINGER, not page.click. One point down, up, nothing else on the glass. */
async function fingerTap(sel, { slide = 0, extraFinger = null } = {}) {
  const c = await centreOf(sel);
  if (!c) return false;
  if (extraFinger) await touch('touchStart', [{ x: extraFinger.x, y: extraFinger.y, id: 9 }]);
  const pts = extraFinger ? [{ x: extraFinger.x, y: extraFinger.y, id: 9 }, { x: c.x, y: c.y, id: 1 }]
                          : [{ x: c.x, y: c.y, id: 1 }];
  await touch('touchStart', pts);
  await page.waitForTimeout(40);
  if (slide) {
    const moved = pts.map((p) => (p.id === 1 ? { x: p.x + slide, y: p.y + slide, id: 1 } : p));
    await touch('touchMove', moved);
    await page.waitForTimeout(40);
  }
  await touch('touchEnd', [{ x: c.x, y: c.y, id: 1 }]);
  if (extraFinger) { await page.waitForTimeout(60); await touch('touchEnd', []); }
  await page.waitForTimeout(250);
  return true;
}

const state = () => page.evaluate(() => ({
  picker: !!document.getElementById('gamesPicker'),
  tiles: [...document.querySelectorAll('.pickerTile')].map((t) => t.getAttribute('data-game')),
  host: !!document.getElementById('gameHost'),
  chrome: !!document.getElementById('gamesChrome'),
  consoleReachable: (() => {
    const p = document.querySelector('.pad-btn[data-id="7"]');
    if (!p) return false;
    const r = p.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!(e && p.contains(e));
  })(),
}));

const openConsole = async () => {
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
};

try {
/* ---------------------------------------------------------- 1. the gesture is one gesture */
console.log('--- 1. Games opens the CHOOSER, every time, even though a game could be launched ---');
await openConsole();
await fingerTap('.pad-btn[data-id="7"]');
let s = await state();
if (s.picker && !s.host) ok(`Games opened the picker and NOT a game — ${s.tiles.length} tile(s): ${s.tiles.join(', ')}`);
else bad('Games did not open the picker', JSON.stringify(s));
if (s.tiles.length === IDS.length) ok(`one tile per registry entry (${s.tiles.length}), rendered from GAMES with no knowledge of any game`);
else bad(`the picker rendered ${s.tiles.length} tile(s) for ${IDS.length} registry entries`, JSON.stringify(s.tiles));

const tileInfo = await page.evaluate(() => [...document.querySelectorAll('.pickerTile')].map((t) => {
  const r = t.getBoundingClientRect();
  const kids = [...t.children].map((c) => (c.textContent || '').trim());
  return { id: t.getAttribute('data-game'), w: Math.round(r.width), h: Math.round(r.height),
    onScreen: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    icon: kids[0] || '', word: kids[1] || '',
    hit: (() => { const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(e && t.contains(e)); })() };
}));
const small = tileInfo.filter((t) => t.w < 150 || t.h < 150);
const off = tileInfo.filter((t) => !t.onScreen || !t.hit);
const wordless = tileInfo.filter((t) => !t.icon || !t.word);
if (!small.length) ok(`every tile is at least 150x150 — ${tileInfo.map((t) => `${t.id} ${t.w}x${t.h}`).join(', ')}`);
else bad(`${small.length} tile(s) below a three-year-old's aim`, JSON.stringify(small));
if (!off.length) ok('every tile is fully on screen and is what a finger at its centre would hit');
else bad(`${off.length} tile(s) off-screen or covered`, JSON.stringify(off));
if (!wordless.length) ok(`every tile carries an icon AND its word — ${tileInfo.map((t) => `${t.icon} ${t.word}`).join(' · ')}`);
else bad(`${wordless.length} tile(s) missing an icon or a word`, JSON.stringify(wordless));

/* ---------------------------------------------------------- 2. a finger, and a bad finger */
console.log('\n--- 2. a tile opens its game — with a finger, with a second finger down, and sliding ---');
await fingerTap(`.pickerTile[data-game="${IDS[0]}"]`);
await page.waitForSelector('#gameHost', { timeout: 8000 }).catch(() => {});
s = await state();
if (s.host && !s.picker) ok(`tapping the '${IDS[0]}' tile opened its game and closed the picker`);
else bad('a plain finger tap on a tile did not open the game', JSON.stringify(s));

/* Back from a GAME goes to the console, not to the picker: invariant 5 is that the
 * console is one tap away from every reachable state, and a picker in between is two. */
await fingerTap('#gameBack');
s = await state();
if (!s.chrome && !s.picker && s.consoleReachable) ok('back from a game returns to the CONSOLE in one tap, not to the picker');
else bad('back from a game did not reach the console in one tap', JSON.stringify(s));

for (const [label, opts] of [
  ['with a second finger resting on the glass', { extraFinger: { x: 700, y: 600 } }],
  ['sliding 25px, which is what a small hand does', { slide: 25 }],
]) {
  await openConsole();
  await fingerTap('.pad-btn[data-id="7"]');
  await fingerTap(`.pickerTile[data-game="${IDS[0]}"]`, opts);
  await page.waitForSelector('#gameHost', { timeout: 8000 }).catch(() => {});
  s = await state();
  if (s.host) ok(`a tile tap ${label} opened the game`);
  else bad(`a tile tap ${label} did nothing`, JSON.stringify(s));
}

/* ---------------------------------------------------------- 3. §2.3, the §1.6 shape */
console.log('\n--- 3. §2.3 — tile rendering THROWS, and the way back still works ---');
console.log('    (PUP-WO-0000 §1.6: Draw, Camera and Map all append a full-bleed overlay');
console.log('     early and wire CLOSE last. Map is a live trap. This surface must not join them.)');
await openConsole();
await page.evaluate(() => { window.renderPickerTiles = function () { throw new Error('deliberate'); }; });
await fingerTap('.pad-btn[data-id="7"]');
s = await state();
const backThere = await centreOf('#pickerBack');
if (s.picker && s.tiles.length === 0 && backThere) {
  ok(`the renderer threw, no tile exists, and the way back is present at ${backThere.w}x${backThere.h}`);
} else {
  bad('the poisoned renderer did not produce the state under test', JSON.stringify({ s, backThere }));
}
await fingerTap('#pickerBack');
s = await state();
if (!s.picker && s.consoleReachable) ok('and ONE finger tap on it returned to a reachable console — the picker is not a trap');
else bad('a picker whose tiles failed to render STRANDED the child', JSON.stringify(s));

/* ---------------------------------------------------------- 4. the registry contract */
console.log('\n--- 4. the picker renders from the registry alone ---');
await openConsole();
const added = await page.evaluate(() => {
  GAMES.push({ id: 'probe', module: './games/probe.js', label: 'Probe', icon: '⭐',
    color: '#22C55E', glow: '#86EFAC', sound: 'ping', players: 1, params: {} });
  return GAMES.length;
});
await fingerTap('.pad-btn[data-id="7"]');
s = await state();
if (s.tiles.includes('probe') && s.tiles.length === added) ok(`an entry added to GAMES produced a tile with NO picker edit — ${s.tiles.join(', ')}`);
else bad('the picker did not render a newly added registry entry', JSON.stringify(s.tiles));

await openConsole();
await page.evaluate(() => {
  /* Each of these fails PUP-WO-0000 §9.1 in a different way: an id that is not the
   * required shape, a module outside games/, and a module with the wrong extension. */
  GAMES.push({ id: 'Bad Id', module: './games/x.js', label: 'A', icon: 'A', color: '#fff', glow: '#fff', sound: 'ping', players: 1, params: {} });
  GAMES.push({ id: 'escape', module: '../secrets.js', label: 'B', icon: 'B', color: '#fff', glow: '#fff', sound: 'ping', players: 1, params: {} });
  GAMES.push({ id: 'wrongext', module: './games/y.mjs', label: 'C', icon: 'C', color: '#fff', glow: '#fff', sound: 'ping', players: 1, params: {} });
});
await fingerTap('.pad-btn[data-id="7"]');
s = await state();
const leaked = s.tiles.filter((t) => ['Bad Id', 'escape', 'wrongext'].includes(t));
if (leaked.length === 0 && s.tiles.length === IDS.length) ok('three entries that fail §9.1 produced NO tile, and the valid ones still rendered — a tile the shell would refuse to load is a control that lies');
else bad('the picker rendered an invalid registry entry', JSON.stringify({ tiles: s.tiles, leaked }));

/* ---------------------------------------------------------- 5. §1a.1, the exit's geometry */
console.log('\n--- 5. §1a.1 — the exit shrinks its PAINT without shrinking its HIT BOX ---');
const geom = await page.evaluate(() => {
  const b = document.getElementById('pickerBack');
  if (!b) return null;
  const br = b.getBoundingClientRect();
  const disc = b.firstElementChild, dr = disc.getBoundingClientRect();
  const svg = disc.querySelector('svg'), sr = svg ? svg.getBoundingClientRect() : null;
  return {
    hit: [Math.round(br.width), Math.round(br.height)],
    paint: [Math.round(dr.width), Math.round(dr.height)],
    glyphOffset: sr ? [ +((sr.x + sr.width / 2) - (dr.x + dr.width / 2)).toFixed(2),
                        +((sr.y + sr.height / 2) - (dr.y + dr.height / 2)).toFixed(2) ] : null,
    hitAtCentre: (() => { const e = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2); return !!(e && (e === b || b.contains(e))); })(),
  };
});
if (geom && geom.hit[0] >= 44 && geom.hit[1] >= 44 && geom.hitAtCentre) ok(`the hit box is ${geom.hit.join('x')} and a finger at its centre lands on it`);
else bad('the exit is not a thumb target any more', JSON.stringify(geom));
if (geom && geom.paint[0] <= geom.hit[0] * 0.7) ok(`the paint is ${geom.paint.join('x')} inside a ${geom.hit.join('x')} hit box — ${Math.round(100 * (geom.paint[0] ** 2) / (geom.hit[0] ** 2))}% of the area it used to cover`);
else bad('the visible control still dominates the surface', JSON.stringify(geom));
if (geom && geom.glyphOffset && Math.abs(geom.glyphOffset[0]) <= 1 && Math.abs(geom.glyphOffset[1]) <= 1) ok(`the arrow is centred in its disc to within 1px (${geom.glyphOffset.join(', ')}) — it is a path, not a glyph`);
else bad('the arrow is not centred in the disc', JSON.stringify(geom));

if (pageErrors.length === 0) ok('no uncaught page error during the whole run');
else bad(`${pageErrors.length} uncaught page error(s)`, pageErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}

console.log('\n' + '='.repeat(78));
if (failures.length) {
  console.error(`::error::CHECK 17 FAILED — ${failures.length} — the picker does not do what PUP-WO-0201 §3 requires.`);
  console.error(`\nCHECK 17 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.d || ''}`);
  process.exit(1);
}
console.log(`CHECK 17 PASSED at ${COMMIT.slice(0, 12)} — PUP-WO-0201 §3, in a browser, by touch:`);
console.log('  Games opens the chooser every time · one tile per VALID registry entry, each');
console.log('  with an icon and its word, each big enough and reachable · a tile opens its');
console.log('  game with a plain finger, with a second finger down, and with a sliding tap ·');
console.log('  back from a game reaches the CONSOLE in one tap, not the picker · a renderer');
console.log('  that throws leaves a working exit · an added entry becomes a tile with no');
console.log('  picker edit and three §9.1 failures become none · and the exit paints small');
console.log('  inside a thumb-sized hit box with its arrow centred by geometry.');
console.log('\n  WHAT IT DOES NOT ESTABLISH: roadmap P2 gate 3. A stranger naming the tiles');
console.log('  with the text covered needs a stranger. Simulating one is a flag-and-stop.');
