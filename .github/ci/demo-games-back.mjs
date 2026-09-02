#!/usr/bin/env node
/**
 * CHECK 13 — the way back exists before anything that can throw, in a real browser.
 *
 * PUP-WO-0200 §3.4 is a WORK-ORDER-FAILS condition, and it is the point of the work
 * order: "The back affordance is wired BEFORE mount() is called — never after.
 * Demonstrate it: make mount() throw on purpose and show the way back still works."
 *
 * WHY IT IS A FAILS CONDITION RATHER THAN A NICETY. docs/findings/PUP-WO-0000.md §1.6
 * records that all three existing openers append a full-bleed overlay EARLY and wire
 * CLOSE LAST — Draw 152 lines later, Camera 287, Map 189 — and that Map is a CONFIRMED
 * LIVE TRAP: if the Leaflet CDN is unreachable, the throw aborts openTreasureMap
 * before the CLOSE button is ever given a listener. There is no keydown, popstate or
 * visibilitychange handler anywhere in the file, so nothing can dismiss it. Recovery
 * requires killing and relaunching the app, with a three-year-old holding the tablet.
 *
 * A games host that reproduced that shape would take the one defect the shell already
 * has and hand it to every future game. So this asserts the property against the cases
 * that actually produce it, in a browser, rather than asserting that the source
 * contains an addEventListener call before a mount call — which would be satisfied by
 * a source that reads correctly and behaves otherwise.
 *
 * Each case gets its OWN ORIGIN (a fresh port) and its own browser context, because a
 * service worker registered by one case would otherwise serve a cached module to the
 * next and the mutation under test would never reach the page.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

/** A static server for one case. `override` maps a path to a body (or to null = 404),
 *  and `delay` maps a path to a millisecond hold before the response is written. */
async function serve({ override = {}, delay = {} } = {}) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    if (delay[p]) await new Promise((r) => setTimeout(r, delay[p]));
    if (Object.prototype.hasOwnProperty.call(override, p)) {
      const body = override[p];
      if (body === null) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Service-Worker-Allowed': '/' }).end(body);
      return;
    }
    try {
      const full = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!full.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
      await stat(full);
      res.writeHead(200, {
        'Content-Type': MIME[extname(full)] || 'application/octet-stream',
        'Service-Worker-Allowed': '/',
      }).end(await readFile(full));
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

const failures = [];
let cases = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

/* Architecture §5: a demonstration asserts the COMMIT it ran against. */
/* FAILS CLOSED. This used to initialise to 'unknown' and pass — architecture §5 says
 * every demonstration asserts the commit it ran against, and a green with no
 * identifiable subject is a claim about a tree nobody can name. PUP-WO-0300 fixed it in
 * one check and recorded the rest; PUP-WO-0201 is the next work order to open this
 * directory, which is where CC-A ruled the sweep belongs. PUPPAD_SUBJECT lets a tree
 * with no .git — a `git archive` export, which the freeze protocol hands a read-only
 * adversarial pass — state its own subject instead. */
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) {
  try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
}
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 13 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}
console.log(`  subject ${COMMIT.slice(0, 12)}\n`);

const browser = await chromium.launch({ channel: 'chromium' });

/** Open the console, press the Games button, and report what the DOM looks like. */
/* PUP-WO-0201 PUT A PICKER BETWEEN THE BUTTON AND THE GAME. The Games button now opens a
 * chooser; a TILE opens a game. This walks the whole path rather than reaching past it,
 * because the path is what the child walks — and the tile is selected by the first
 * registry entry's id, read from the registry, for the same reason the module path is. */
async function openGamesAndProbe(page, origin, { waitForHost = true } = {}) {
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await page.click('.pad-btn[data-id="7"]');
  await page.waitForSelector(`.pickerTile[data-game="${FIRST.id}"]`, { timeout: 5000 });
  await page.click(`.pickerTile[data-game="${FIRST.id}"]`);
  if (waitForHost) await page.waitForSelector('#gameHost', { timeout: 5000 }).catch(() => {});
  return page;
}
/* HIT-TEST, DO NOT MEASURE. The first version asked only whether the button was bigger
 * than 40x40, and called the field `backWired` — a name for a property it did not
 * measure. The pass showed four separate ways to leave a 64x64 button present and
 * unreachable (a body-level overlay, an unscoped stylesheet, the top layer, a transform
 * on body), all of which passed that gate. `elementFromPoint` at the button's centre
 * asks the question the child's finger asks. */
const probe = (page) => page.evaluate(() => {
  const b = document.getElementById('gameBack');
  let reachable = false, rect = null;
  if (b) {
    rect = b.getBoundingClientRect();
    const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
    const onScreen = rect.width > 0 && rect.height > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight;
    const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
    reachable = !!(hit && (hit === b || b.contains(hit)));
  }
  return {
    chrome: !!document.getElementById('gamesChrome'),
    host: !!document.getElementById('gameHost'),
    back: !!b,
    backWired: reachable && rect.width >= 44 && rect.height >= 44,
    rect: rect ? { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y) } : null,
    /* What the child would actually touch in the middle of the screen once the surface
     * is supposed to be gone. A leaked body-level node shows up here. */
    topAtCentre: (() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e ? (e.id || e.tagName) : 'none'; })(),
    consoleReachable: (() => {
      const pad = document.querySelector('.pad-btn[data-id="7"]');
      if (!pad) return false;
      const r = pad.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!(e && pad.contains(e));
    })(),
  };
});

async function runCase(label, { override = {}, delay = {}, expect }) {
  cases++;
  const { server, origin } = await serve({ override, delay });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await openGamesAndProbe(page, origin, { waitForHost: expect !== 'gone' });
    if (expect === 'gone') {
      /* The shell should have torn itself down. Give it a moment to do so. */
      await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 }).catch(() => {});
      const after = await probe(page);
      if (after.chrome) { bad(`${label} — an overlay is STILL PRESENT after the failure`, JSON.stringify(after)); return; }
      if (!after.consoleReachable) { bad(`${label} — the chrome went but the CONSOLE IS NOT REACHABLE`, JSON.stringify(after)); return; }
      ok(`${label} — the shell tore down by itself and the console is reachable`);
      return;
    }
    const before = await probe(page);
    if (!before.back || !before.backWired) {
      bad(`${label} — no usable way back while the surface is open`, JSON.stringify(before));
      return;
    }
    ok(`${label} — the way back is present and thumb-sized before anything else happens`);
    await page.click('#gameBack');
    await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 }).catch(() => {});
    const after = await probe(page);
    if (after.chrome) { bad(`${label} — pressing back did NOT remove the overlay`, JSON.stringify(after)); return; }
    /* THE ASSERTION THAT WAS MISSING, AND IT IS THE ONE THAT MATTERED. The first
     * version stopped at "#gamesChrome is gone" and never looked at what else was on
     * screen — so a module that appended a full-bleed node to document.body and forgot
     * it in teardown passed, while the child was left facing a solid rectangle with the
     * console unreachable. That is PUP-WO-0000 §1.6 reproduced through this host, green.
     * "The overlay is gone" is not the property. "The child can reach the console" is. */
    if (!after.consoleReachable) {
      bad(`${label} — back removed the chrome but the CONSOLE IS NOT REACHABLE`,
        `something is covering it: topAtCentre=${after.topAtCentre}. A module leaked a node outside its host.`);
      return;
    }
    ok(`${label} — pressing back returned to a reachable console`);
  } finally {
    await ctx.close();
    await new Promise((r) => server.close(r));
  }
}

/* WHICH MODULE THE GAMES BUTTON LOADS IS A FACT ABOUT THE REGISTRY, NOT A CONSTANT.
 * This file used to hard-code `/games/hello.js` in nine places, which was true only
 * while the placeholder happened to be first in GAMES. PUP-WO-0300 put Gyre first —
 * and every corruption case below would have gone on overriding a module the shell no
 * longer loads, so the shell would have loaded the REAL game, succeeded, and the cases
 * that must end with the surface torn down would have failed for a reason that has
 * nothing to do with what they test. A pointer that resolves in the author's head and
 * not in the tree is architecture §6.1 member 4; this resolves it in the tree.
 *
 * FAILS CLOSED. If the registry cannot be read, this check does not fall back to a
 * guess — a guess is how it would silently test nothing. */
function firstRegistryEntry() {
  const html = readFileSync(join(REPO, 'index.html'), 'utf8');
  const reg = html.match(/var GAMES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!reg) throw new Error('demo-games-back: cannot find `var GAMES = [ ... ];` in index.html');
  const m = reg[1].match(/module\s*:\s*'([^']+)'/);
  if (!m) throw new Error('demo-games-back: the first registry entry has no `module` field');
  const idm = reg[1].match(/id\s*:\s*'([^']+)'/);
  if (!idm) throw new Error('demo-games-back: the first registry entry has no `id` field');
  return { module: m[1].replace(/^\./, ''), id: idm[1] };
}
const FIRST = firstRegistryEntry();
const MODULE = FIRST.module;
const GOOD = await readFile(join(REPO, MODULE.replace(/^\//, '')), 'utf8');

console.log('CHECK 13 — the way back, in a browser, against the cases that produce §1.6\n');
console.log(`  the picker's first tile is '${FIRST.id}' and loads ${MODULE} — read from the registry, not assumed\n`);

console.log('--- 1. the ordinary path ---');
await runCase('the registry\'s first module, unmodified', { expect: 'back-works' });

console.log('\n--- 2. mount() THROWS — PUP-WO-0200 §3.4, stated as the demonstration ---');
await runCase('mount throws', {
  override: { [MODULE]: 'export default function mount(){ throw new Error("deliberate"); }\n' },
  expect: 'gone',
});

console.log('\n--- 3. the module 404s (offline with nothing cached lands here) ---');
await runCase('module missing', { override: { [MODULE]: null }, expect: 'gone' });

console.log('\n--- 4. the module will not parse ---');
await runCase('module is a syntax error', {
  override: { [MODULE]: 'export default function mount({ \n' },
  expect: 'gone',
});

console.log('\n--- 5. mount returns no teardown — a contract violation, not a crash ---');
await runCase('mount returns undefined', {
  override: { [MODULE]: 'export default function mount(){ }\n' },
  expect: 'gone',
});

console.log('\n--- 6. teardown() THROWS — the host must be removed ANYWAY ---');
console.log('    (§8.2 obligation 5: the removal belongs in a `finally`, never on the');
console.log('     line after the call. A teardown that throws before the host is removed');
console.log('     strands the child behind a full-bleed overlay — §1.6 reproduced by the');
console.log('     very contract written to prevent it.)');
await runCase('teardown throws', {
  override: { [MODULE]: 'export default function mount(host){ host.textContent="x"; return function(){ throw new Error("deliberate"); }; }\n' },
  expect: 'back-works',
});

console.log('\n--- 7. THE §1.6 SHAPE ITSELF: the module never arrives ---');
console.log('    Map appends its overlay and then throws before CLOSE is wired. Here the');
console.log('    equivalent is a module that hangs: if the way back were wired after the');
console.log('    await, this is the case that would strand a child indefinitely.');
await runCase('module hangs for 30s', {
  override: { [MODULE]: GOOD },
  delay: { [MODULE]: 30000 },
  expect: 'back-works',
});

console.log('\n--- 8. THE CASE THAT DEFEATED THIS CHECK: a body-level node the teardown forgets ---');
console.log('    A one-word bug — document.body instead of host — and the pattern the');
console.log('    shell\'s own three openers use. The first version of this check asserted');
console.log('    only that #gamesChrome was gone and passed while the child was stranded.');
await runCase('module leaks a full-bleed node to document.body', {
  override: { [MODULE]:
    'export default function mount(host, api) {\n' +
    '  const fx = document.createElement("div"); fx.id = "leaked";\n' +
    '  fx.style.cssText = "position:fixed;inset:0;background:#102040;z-index:400";\n' +
    '  document.body.appendChild(fx);\n' +
    '  host.textContent = "x";\n' +
    '  return function teardown() {};\n}\n' },
  expect: 'back-works',
});

console.log('\n--- 9. the same leak created BY teardown, after the chrome is already gone ---');
await runCase('teardown itself appends to document.body', {
  override: { [MODULE]:
    'export default function mount(host, api) {\n  host.textContent = "x";\n' +
    '  return function teardown() {\n' +
    '    const bye = document.createElement("div"); bye.id = "bye";\n' +
    '    bye.style.cssText = "position:fixed;inset:0;background:#301030;z-index:9999";\n' +
    '    document.body.appendChild(bye);\n  };\n}\n' },
  expect: 'back-works',
});

await browser.close();

console.log('\n' + '='.repeat(78));
if (failures.length) {
  console.error(`::error::CHECK 13 FAILED — ${failures.length} case(s) left a child with no way back.`);
  console.error(`\nCHECK 13 FAILED — ${failures.length}:`);
  for (const f of failures) console.error(`  ${f.m}\n    ${f.d || ''}`);
  console.error('\n  PUP-WO-0200 §3.4 is a WORK-ORDER-FAILS condition. A games host that');
  console.error('  reproduces PUP-WO-0000 §1.6\'s shape takes the one defect the shell');
  console.error('  already has and gives it to every future game.');
  process.exit(1);
}
console.log(`CHECK 13 PASSED at ${COMMIT.slice(0, 12)} — ${cases} cases against ${MODULE}, and in every one the child can get out.`);
console.log('  The way back is created, appended and WIRED before the module is fetched,');
console.log('  so mount throwing, the module 404ing, failing to parse, returning no');
console.log('  teardown, tearing down with a throw, or never arriving at all all leave a');
console.log('  usable exit. Case 7 is §1.6\'s own shape: an opener that hangs.');
