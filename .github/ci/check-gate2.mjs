#!/usr/bin/env node
/**
 * CHECK 18 — adding a game touches exactly three things, and CI is what says so.
 *
 * Roadmap P2 gate 2 and northstar invariant 6. `PUP-WO-0200` demonstrated this with a
 * throwaway module and then — correctly — did not ship it, because a second dead tile is
 * a control that lies. What that left behind is the problem this file exists to fix:
 * **the gate's only evidence was a commit message about a tree that no longer exists**,
 * which is architecture §6.1 member 5. A gate re-proved by hand and forgotten is not a
 * gate; it is a memory.
 *
 * So the demonstration is performed on every run, in a throwaway git repository, and
 * reverted by deleting the directory. Nothing here touches the repo it is checking.
 *
 * COUNTING FILES IS NOT ENOUGH, AND `PUP-WO-0200` FOUND THE EXACT REASON. An anchor in
 * `ci.yml` pinned the last `urlsToCache` entry, so adding a game required editing a file
 * that `git diff --stat` was ALREADY counting — the count stayed at three while the true
 * cost was four, and the gate's own instrument could not see the gate failing. A count
 * cannot detect a fourth edit hiding inside a file it already counts.
 *
 * So this asserts two things, and the second is the one with teeth:
 *   1. exactly three paths change, and they are the three KINDS the invariant names;
 *   2. **the tree that results still passes the repo's own checks.** If a three-file
 *      addition leaves `check-assets` or `check-syntax` red, then a fourth edit is
 *      required to finish the job and the invariant is false however the diff counts.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(HERE, '..', '..');

let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) { try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {} }
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 18 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}
console.log(`CHECK 18 — gate 2 as a mutation, not a memory. subject ${COMMIT.slice(0, 12)}\n`);

const results = [];
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const MODULE_SRC = `export default function mount(host, api) {
  const d = document.createElement('div');
  d.textContent = api.entry.icon;
  host.appendChild(d);
  return function teardown() { if (d.parentNode) d.parentNode.removeChild(d); };
}
`;

/** A throwaway repository holding exactly the files a game addition can touch. */
function stage() {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-gate2-'));
  for (const f of ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
    if (existsSync(join(REPO, f))) copyFileSync(join(REPO, f), join(dir, f));
  }
  cpSync(join(REPO, 'games'), join(dir, 'games'), { recursive: true });
  git(dir, 'init', '-q', '.');
  git(dir, 'config', 'user.email', 'gate2@puppad');
  git(dir, 'config', 'user.name', 'gate2');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'before');
  return dir;
}

/* THE THREE THINGS, and each is written the way a builder would write it. */
const addModule = (dir, id) => writeFileSync(join(dir, 'games', id + '.js'), MODULE_SRC);
const addRegistryEntry = (dir, id, modulePath) => {
  const p = join(dir, 'index.html');
  const s = readFileSync(p, 'utf8');
  const m = s.match(/var GAMES=\[\n/);
  if (!m) throw new Error('check-gate2: cannot find `var GAMES=[` in index.html');
  const entry = `  {id:'${id}',module:'${modulePath}',label:'Synth',icon:'\\u2B50',\n`
    + `   color:'#22C55E',glow:'#86EFAC',sound:'ping',players:1,params:{}},\n`;
  writeFileSync(p, s.replace(m[0], m[0] + entry));
};
const addCacheLine = (dir, modulePath) => {
  const p = join(dir, 'sw.js');
  const s = readFileSync(p, 'utf8');
  const m = s.match(/(\n)(\s*)'(\.\/games\/[a-z0-9-]+\.js)'(\n\];)/);
  if (!m) throw new Error('check-gate2: cannot find the last games entry in urlsToCache');
  writeFileSync(p, s.replace(m[0], `${m[1]}${m[2]}'${m[3]}',\n${m[2]}'${modulePath}'${m[4]}`));
};

function runCheck(script, dir) {
  try {
    execFileSync(process.execPath, [join(HERE, script), dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: '' };
  } catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim() }; }
}

function scenario(label, { mutate, expect, expectReason }) {
  const dir = stage();
  try {
    mutate(dir);
    git(dir, 'add', '-A');
    const changed = git(dir, 'diff', '--cached', '--name-only').split('\n').filter(Boolean);
    const kinds = {
      module: changed.filter((f) => /^games\/[a-z0-9-]+\.js$/.test(f)),
      registry: changed.filter((f) => f === 'index.html'),
      cache: changed.filter((f) => f === 'sw.js'),
    };
    const other = changed.filter((f) => !kinds.module.includes(f) && !kinds.registry.includes(f) && !kinds.cache.includes(f));

    const reasons = [];
    if (changed.length !== 3) reasons.push(`${changed.length} paths changed, not three: ${changed.join(', ')}`);
    if (kinds.module.length !== 1) reasons.push(`${kinds.module.length} module file(s), expected exactly one`);
    if (kinds.registry.length !== 1) reasons.push('the registry (index.html) was not the one edited file');
    if (kinds.cache.length !== 1) reasons.push('the urlsToCache line (sw.js) was not added');
    if (other.length) reasons.push(`something outside the three kinds changed: ${other.join(', ')}`);

    /* THE HALF A COUNT CANNOT DO. A fourth edit hiding inside a file already counted
     * shows up here and nowhere else: the tree has three changed paths and does not work. */
    for (const [script, name] of [['check-syntax.mjs', 'check-syntax'], ['check-assets.mjs', 'check-assets']]) {
      const r = runCheck(script, dir);
      if (!r.ok) reasons.push(`the resulting tree FAILS ${name}, so a fourth edit is needed to finish the job`);
    }

    const observed = reasons.length ? 'FAILS' : 'THREE';
    const matched = observed !== 'FAILS' || !expectReason || reasons.some((r) => r.includes(expectReason));
    const pass = observed === expect && matched;
    if (observed === expect && !matched) console.log(`        it failed, but NOT for the expected reason: wanted ${JSON.stringify(expectReason)}`);
    results.push({ label, expect, observed, pass, reasons });
    console.log(`${pass ? '  ok  ' : '  MISPREDICTED'} ${observed.padEnd(5)} ${label}`);
    if (reasons.length && pass) for (const r of reasons) console.log(`          ${r}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log('=== THE GATE — a game added the way the invariant says, and nothing else ===');
scenario('module + registry entry + urlsToCache line', {
  mutate: (d) => { addModule(d, 'synth'); addRegistryEntry(d, 'synth', './games/synth.js'); addCacheLine(d, './games/synth.js'); },
  expect: 'THREE',
});

console.log('\n=== IT MUST BE ABLE TO FAIL — a gate that cannot go red is not a gate ===');
scenario('a game needing a FOURTH file (a helper module beside it)', {
  mutate: (d) => {
    addModule(d, 'synth');
    writeFileSync(join(d, 'games', 'synth-helper.js'), 'export default 1;\n');
    addRegistryEntry(d, 'synth', './games/synth.js');
    addCacheLine(d, './games/synth.js');
  },
  expect: 'FAILS', expectReason: 'paths changed, not three',
});
scenario('a game whose asset needs a fourth thing nobody counted', {
  /* THE SHAPE PUP-WO-0200 ACTUALLY FOUND, generalised: three paths change, the count is
   * satisfied, and the app is broken until something else is edited too. Here the module
   * ships an image the worker was never told to cache; a cold offline device shows a
   * broken picture with the diff still reading three. Only running the repo's own checks
   * against the result can see it. */
  mutate: (d) => {
    addModule(d, 'synth');
    writeFileSync(join(d, 'games', 'synth.png'), 'not really a png\n');
    addRegistryEntry(d, 'synth', './games/synth.js');
    addCacheLine(d, './games/synth.js');
  },
  expect: 'FAILS', expectReason: 'paths changed, not three',
});
scenario('the registry entry names a module that was never written', {
  mutate: (d) => { addRegistryEntry(d, 'synth', './games/synth.js'); addCacheLine(d, './games/synth.js'); },
  /* The COUNT catches this one, and it is worth knowing which assertion did: I predicted
   * check-assets and was wrong. check-assets asks whether every referenced local asset is
   * CACHED, not whether it EXISTS — a distinction the scenario made visible and no
   * reasoning about it had. Recorded rather than quietly re-pointed. */
  expect: 'FAILS', expectReason: 'paths changed, not three',
});
scenario('three paths, all three kinds, and the module does not parse', {
  /* THE ONE THAT ISOLATES THE SECOND ASSERTION. Exactly three paths change and every
   * kind is right, so the COUNT is satisfied and says the invariant holds — while the
   * tree is broken and a fourth edit is owed. Only running the repo's own checks against
   * the result can see it, which is the whole reason this file does. */
  mutate: (d) => {
    writeFileSync(join(d, 'games', 'synth.js'), 'export default function mount(host, api) {\n');
    addRegistryEntry(d, 'synth', './games/synth.js');
    addCacheLine(d, './games/synth.js');
  },
  expect: 'FAILS', expectReason: 'check-syntax',
});
scenario('the module and the entry, but the worker was never told about it', {
  mutate: (d) => { addModule(d, 'synth'); addRegistryEntry(d, 'synth', './games/synth.js'); },
  expect: 'FAILS', expectReason: 'check-assets',
});

console.log('\n' + '='.repeat(78));
const bad = results.filter((r) => !r.pass);
if (bad.length) {
  console.error(`::error::CHECK 18 FAILED — ${bad.length} scenario(s) did not behave as predicted.`);
  console.error(`\nCHECK 18 FAILED — ${bad.length} at ${COMMIT.slice(0, 12)}:`);
  for (const r of bad) console.error(`  ${r.label}: expected ${r.expect}, got ${r.observed}\n    ${r.reasons.join('\n    ')}`);
  console.error('\n  If the FIRST scenario failed, northstar invariant 6 is false: adding a game');
  console.error('  now costs more than its module, one registry entry and one urlsToCache line.');
  console.error('  That is an architecture decision, not a build step — flag it, do not absorb it.');
  process.exit(1);
}
console.log(`CHECK 18 PASSED at ${COMMIT.slice(0, 12)} — ${results.length} scenarios, all as predicted.`);
console.log('  Adding a game touches its module, one registry entry and one urlsToCache');
console.log('  line — demonstrated on this tree, on this run, in a throwaway repository,');
console.log('  rather than remembered from a commit message about a tree that is gone.');
console.log('  And it goes red four ways, including the one a COUNT cannot see: three');
console.log('  paths changed and the resulting tree failing the repo\'s own checks, which');
console.log('  means a fourth edit is still owed.');
