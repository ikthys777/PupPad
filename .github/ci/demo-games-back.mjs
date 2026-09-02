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
import { join, extname, normalize, resolve } from 'node:path';
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
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };

const browser = await chromium.launch({ channel: 'chromium' });

/** Open the console, press the Games button, and report what the DOM looks like. */
async function openGamesAndProbe(page, origin, { waitForHost = true } = {}) {
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 15000 });
  await page.click('.pad-btn[data-id="7"]');
  if (waitForHost) await page.waitForSelector('#gameHost', { timeout: 5000 }).catch(() => {});
  return page;
}
const probe = (page) => page.evaluate(() => ({
  chrome: !!document.getElementById('gamesChrome'),
  host: !!document.getElementById('gameHost'),
  back: !!document.getElementById('gameBack'),
  backWired: (() => {
    const b = document.getElementById('gameBack');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.width > 40 && r.height > 40;   // present, and big enough for a thumb
  })(),
}));

async function runCase(label, { override = {}, delay = {}, expect }) {
  const { server, origin } = await serve({ override, delay });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await openGamesAndProbe(page, origin, { waitForHost: expect !== 'gone' });
    if (expect === 'gone') {
      /* The shell should have torn itself down. Give it a moment to do so. */
      await page.waitForFunction(() => !document.getElementById('gamesChrome'), { timeout: 5000 }).catch(() => {});
      const after = await probe(page);
      if (!after.chrome) ok(`${label} — the shell tore down by itself; nothing is left on screen`);
      else bad(`${label} — an overlay is STILL PRESENT after the failure`, JSON.stringify(after));
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
    if (after.chrome) bad(`${label} — pressing back did NOT remove the overlay`, JSON.stringify(after));
    else ok(`${label} — pressing back returned to the console`);
  } finally {
    await ctx.close();
    await new Promise((r) => server.close(r));
  }
}

const GOOD = await readFile(join(REPO, 'games', 'hello.js'), 'utf8');

console.log('CHECK 13 — the way back, in a browser, against the cases that produce §1.6\n');

console.log('--- 1. the ordinary path ---');
await runCase('unmodified placeholder', { expect: 'back-works' });

console.log('\n--- 2. mount() THROWS — PUP-WO-0200 §3.4, stated as the demonstration ---');
await runCase('mount throws', {
  override: { '/games/hello.js': 'export default function mount(){ throw new Error("deliberate"); }\n' },
  expect: 'gone',
});

console.log('\n--- 3. the module 404s (offline with nothing cached lands here) ---');
await runCase('module missing', { override: { '/games/hello.js': null }, expect: 'gone' });

console.log('\n--- 4. the module will not parse ---');
await runCase('module is a syntax error', {
  override: { '/games/hello.js': 'export default function mount({ \n' },
  expect: 'gone',
});

console.log('\n--- 5. mount returns no teardown — a contract violation, not a crash ---');
await runCase('mount returns undefined', {
  override: { '/games/hello.js': 'export default function mount(){ }\n' },
  expect: 'gone',
});

console.log('\n--- 6. teardown() THROWS — the host must be removed ANYWAY ---');
console.log('    (§8.2 obligation 5: the removal belongs in a `finally`, never on the');
console.log('     line after the call. A teardown that throws before the host is removed');
console.log('     strands the child behind a full-bleed overlay — §1.6 reproduced by the');
console.log('     very contract written to prevent it.)');
await runCase('teardown throws', {
  override: { '/games/hello.js': 'export default function mount(host){ host.textContent="x"; return function(){ throw new Error("deliberate"); }; }\n' },
  expect: 'back-works',
});

console.log('\n--- 7. THE §1.6 SHAPE ITSELF: the module never arrives ---');
console.log('    Map appends its overlay and then throws before CLOSE is wired. Here the');
console.log('    equivalent is a module that hangs: if the way back were wired after the');
console.log('    await, this is the case that would strand a child indefinitely.');
await runCase('module hangs for 30s', {
  override: { '/games/hello.js': GOOD },
  delay: { '/games/hello.js': 30000 },
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
console.log('CHECK 13 PASSED — 7 cases, and in every one the child can get out.');
console.log('  The way back is created, appended and WIRED before the module is fetched,');
console.log('  so mount throwing, the module 404ing, failing to parse, returning no');
console.log('  teardown, tearing down with a throw, or never arriving at all all leave a');
console.log('  usable exit. Case 7 is §1.6\'s own shape: an opener that hangs.');
