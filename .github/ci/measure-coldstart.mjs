#!/usr/bin/env node
/**
 * Roadmap P2 gate 5's instrument.
 *
 * The gate requires "cold-start time to interactive console recorded as a baseline
 * NUMBER" — the threshold is architecture §10's open question, so this measures and
 * does not judge.
 *
 * IT EXISTS BECAUSE THE CLAIMS AUDIT FOUND THE NUMBER HAD NO INSTRUMENT. The feedback
 * file quoted five timings and a median, and nothing in the 27 frozen deliverables
 * produced them — `git diff | grep` for those figures returned exactly one hit: the
 * sentence claiming them. A measurement a reviewer cannot re-run is not measured, it
 * is asserted, which is the property "measured" is supposed to buy.
 *
 * THIS IS NOT GATE 5's NUMBER. Gate 5 says "on the test device" — a tablet. This runs
 * on whatever box invokes it, so it is a reference point and a regression tripwire.
 * The device measurement is the operator's.
 *
 * Deliberately NOT wired into CI: it would measure the runner, vary with load, and a
 * threshold is exactly what architecture §10 has not decided. Run it by hand:
 *     node .github/ci/measure-coldstart.mjs <repo>
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const REPO = resolve(process.argv[2] || join(import.meta.dirname, '..', '..'));
const RUNS = Number(process.env.RUNS || 5);
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
  console.error('::error::measure-coldstart cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!f.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
    await stat(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Service-Worker-Allowed': '/' }).end(await readFile(f));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chromium' });
const runs = [];
for (let i = 0; i < RUNS; i++) {
  /* A FRESH CONTEXT each time: same browser, no memory cache, no service worker, no
   * storage. Reloading one page would measure a warm cache and report a number that is
   * not a cold start at all. */
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pad-btn[data-id="7"]', { timeout: 20000 });
  runs.push(Date.now() - t0);
  await ctx.close();
}
await browser.close();
server.close();

runs.sort((a, b) => a - b);
const median = runs[Math.floor(runs.length / 2)];
console.log(`cold start to interactive console — subject ${COMMIT.slice(0, 12)}`);
console.log(`  ${runs.length} fresh contexts (ms): ${runs.join(', ')}`);
console.log(`  median: ${median} ms   min: ${runs[0]}   max: ${runs[runs.length - 1]}`);
console.log('  THIS IS NOT GATE 5\'s NUMBER. Gate 5 says "on the test device"; this is');
console.log('  whatever box ran it. Reference point and regression tripwire only.');
