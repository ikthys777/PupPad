#!/usr/bin/env node
/**
 * CHECK 15 — the positive controls for check 3.
 *
 * WHY THIS EXISTS. PUP-WO-0200 rewrote check 3's rule from "any change to a listed
 * asset needs a CACHE_NAME bump" to a FOUR-BRANCH rule about whether install's
 * `addAll` will refresh the asset. **A four-branch rule with no controls is an
 * assertion that can pass by not running** — architecture §6.1 member 1 — and the
 * demonstrations for that rewrite lived only in a commit message, which by this
 * project's own freeze finding is evidence about a tree that no longer exists.
 *
 * It is the same principle PUP-WO-0105 established one level up: a WORKER change must
 * be gated by a check for the class it changes, so a CHECK change must be
 * regression-guarded for the branches it introduces.
 *
 * WHAT IS UNDER TEST is not "check 3 passes". It is that check 3 **goes red for its own
 * named reason on each branch that must red, goes green on each that must not, and
 * fails closed when it cannot establish a base at all.** A red for the wrong reason is
 * not evidence (PUP-WO-0103 finding B), so every RED case asserts the text.
 *
 * Each case builds a THROWAWAY GIT REPOSITORY in a temp dir — never this one — with a
 * base commit and a head commit, and invokes check 3 as a subprocess with the
 * environment a pull_request gives it. That environment is the point: check 3 resolves
 * `merge-base(PR base, HEAD)` on a pull_request and falls back to `HEAD~1` otherwise,
 * and running it WITHOUT that environment is how PUP-WO-0200 reported a false negative
 * — the fallback compared a range in which the changed file had not changed, so the
 * check was never asked the question.
 */
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const CHECK = join(HERE, 'check-cache-name.mjs');
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
  console.error('::error::CHECK 15 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}

const results = [];
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Build a repo with a base commit, apply `mutate`, commit again, and run check 3. */
function scenario(label, { mutate, expect, expectText, sameCommit = false, badBase = false }) {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-c3-'));
  try {
    git(dir, 'init', '-q', '.');
    git(dir, 'config', 'user.email', 'controls@puppad');
    git(dir, 'config', 'user.name', 'controls');
    /* The REAL sw.js and index.html: check 3 EVALUATES the worker to derive CACHE_NAME
     * rather than scraping it, so a hand-written stub would test a different program. */
    for (const f of ['sw.js', 'index.html']) copyFileSync(join(REPO, f), join(dir, f));
    mkdirSync(join(dir, 'games'), { recursive: true });
    copyFileSync(join(REPO, 'games', 'hello.js'), join(dir, 'games', 'hello.js'));
    writeFileSync(join(dir, 'icon-192.png'), 'base\n');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'base');
    const base = git(dir, 'rev-parse', 'HEAD');

    if (!sameCommit) {
      mutate(dir);
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'head');
    }

    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, [CHECK, dir], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', PR_BASE_SHA: badBase ? '' : base },
      });
    } catch (e) { code = e.status ?? 1; out = (e.stdout || '') + (e.stderr || ''); }

    const observed = code === 0 ? 'GREEN' : 'RED';
    const matched = observed !== 'RED' || !expectText || out.includes(expectText);
    const pass = observed === expect && matched;
    if (observed === expect && !matched) console.log(`        RED, but NOT for the expected reason: wanted ${JSON.stringify(expectText)}`);
    results.push({ label, expect, observed, pass });
    console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} ${observed.padEnd(5)} ${label}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/* Helpers that edit the copied sw.js the way a real change would. */
const sw = (dir) => readFileSync(join(dir, 'sw.js'), 'utf8');
const writeSw = (dir, s) => writeFileSync(join(dir, 'sw.js'), s);
const dropEntry = (dir, entry) => writeSw(dir, sw(dir).replace(new RegExp(`\\s*'${entry.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}',?`), ''));
const addEntry = (dir, entry) => writeSw(dir, sw(dir).replace("  './icon-512.png'", `  './icon-512.png',\n  '${entry}'`));
const bump = (dir) => writeSw(dir, sw(dir).replace(/CACHE_VERSION = 'v(\d+)'/, (_, n) => `CACHE_VERSION = 'v${Number(n) + 1}'`));
const touch = (dir, f) => writeFileSync(join(dir, f), readFileSync(join(dir, f), 'utf8') + '\n<!-- changed -->\n');

console.log(`CHECK 15 — check 3's positive controls. subject ${COMMIT.slice(0, 12)}\n`);

console.log('=== PART A — fail closed. A base it cannot establish is not a comparison ===');
console.log('    (PUP-WO-0200 reported a FALSE NEGATIVE from check 3 by running it without');
console.log('     this environment: the HEAD~1 fallback compared a range in which the');
console.log('     changed file had not changed, so the check was never asked the question.)');
scenario('pull_request event with an unreachable base sha', {
  mutate: (d) => touch(d, 'index.html'), expect: 'RED', badBase: true,
  expectText: 'PR base sha is missing or unreachable',
});
scenario('base and head are the same commit', {
  mutate: () => {}, sameCommit: true, expect: 'RED',
  expectText: 'compare nothing',
});

console.log('\n=== PART B — the four branches of the rule, each RED or GREEN for its own reason ===');
scenario('1. a listed asset CHANGED and is STILL LISTED, no bump', {
  mutate: (d) => touch(d, 'index.html'), expect: 'GREEN',
});
scenario('2. an entry ADDED to urlsToCache, no bump', {
  mutate: (d) => { writeFileSync(join(d, 'extra.png'), 'x\n'); addEntry(d, './extra.png'); },
  expect: 'GREEN',
});
scenario('3. an entry REMOVED from urlsToCache, no bump', {
  mutate: (d) => dropEntry(d, './icon-192.png'), expect: 'RED',
  expectText: 'REMOVED from urlsToCache',
});
scenario('4. a CHANGED asset DROPPED from the list, no bump', {
  /* icon-192, not index.html. urlsToCache lists BOTH './' and './index.html', and
   * './' normalises to index.html — so dropping the explicit entry strands nothing and
   * check 3 is right to stay green. This control was written against index.html first
   * and MISPREDICTED, which is the harness catching the author rather than the check. */
  mutate: (d) => { touch(d, 'icon-192.png'); dropEntry(d, './icon-192.png'); }, expect: 'RED',
  expectText: 'does NOT list',
});

console.log('\n=== PART C — a bump satisfies exactly the cases that demand one ===');
console.log('    (a rule nothing can satisfy is not a rule; these are the same mutations');
console.log('     as 3 and 4 with the bump the check asks for)');
scenario('3 + a CACHE_VERSION bump', {
  mutate: (d) => { dropEntry(d, './icon-192.png'); bump(d); }, expect: 'GREEN',
});
scenario('4 + a CACHE_VERSION bump', {
  mutate: (d) => { touch(d, 'icon-192.png'); dropEntry(d, './icon-192.png'); bump(d); }, expect: 'GREEN',
});

console.log('\n=== PART D — what must stay GREEN, so the check can pass at all ===');
scenario('nothing relevant changed', { mutate: (d) => writeFileSync(join(d, 'README.md'), 'x\n'), expect: 'GREEN' });
scenario('a bump with no asset change at all', { mutate: (d) => bump(d), expect: 'GREEN' });
scenario('a NEW GAME: module + registry entry + one urlsToCache line, no bump', {
  /* THE CASE THAT MADE THE OLD RULE COLLIDE WITH NORTHSTAR INVARIANT 6. Adding a game
   * always adds a urlsToCache line, so the old "the list changed" trigger fired on
   * every game this project will ever add — while invariant 6 says "nothing else" and
   * roadmap P2 gate 2 counts exactly three things. A bump would be a fourth. */
  mutate: (d) => {
    writeFileSync(join(d, 'games', 'second.js'), 'export default function mount(h){h.textContent="x";return function(){};}\n');
    addEntry(d, './games/second.js');
    touch(d, 'index.html');   // the registry entry lives in index.html, which IS precached
  },
  expect: 'GREEN',
});

console.log('\n' + '='.repeat(78));
const bad = results.filter((r) => !r.pass);
if (bad.length) {
  console.error(`::error::CHECK 15 FAILED — ${bad.length} control(s) did not behave as predicted.`);
  console.error(`\nCHECK 15 FAILED at ${COMMIT.slice(0, 12)} — ${bad.length}:`);
  for (const r of bad) console.error(`  ${r.label}: expected ${r.expect}, got ${r.observed}`);
  console.error('\n  A control that stops working means check 3 is no longer known to behave as');
  console.error('  its rule says on that branch. Do NOT delete the control to make this green.');
  process.exit(1);
}
console.log(`CHECK 15 PASSED at ${COMMIT.slice(0, 12)} — ${results.length} controls, all as predicted.`);
console.log('  PART A  two fail-closed conditions on the base resolver — the mechanism that');
console.log('          produced a false negative during PUP-WO-0200.');
console.log('  PART B  all four branches of the refreshed-vs-stranded rule, each named.');
console.log('  PART C  a bump satisfies exactly the two cases that demand one.');
console.log('  PART D  three cases that must stay GREEN, including ADDING A GAME — the case');
console.log('          the old rule made impossible to satisfy alongside invariant 6.');
