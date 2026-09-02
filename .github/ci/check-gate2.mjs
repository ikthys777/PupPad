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
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* `resolve`, not `join(cwd, arg)`, which turned an ABSOLUTE path into
 * /cwd/abs/repo and died inside cpSync rather than reporting a bad argument.
 * Every sibling check already did it this way. */
const REPO = resolve(process.argv[2] || join(HERE, '..', '..'));

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

/** THE WHOLE TREE, NOT THE FILES A GAME ADDITION IS SUPPOSED TO TOUCH.
 *
 * The first version staged only index.html, sw.js, the manifest, the icons and games/.
 * That made the check STRUCTURALLY BLIND to the one defect it was commissioned to catch:
 * PUP-WO-0200's fourth thing did not live in any of those files, it lived in
 * .github/ci/check-mutations.mjs, whose A14 anchor had been pinned to the LAST
 * urlsToCache entry — so every added game moved the anchor and required editing that
 * file. A path the staging never copies is a path the count can never name, and an
 * adversarial pass replayed exactly that: this check printed PASSED, "three,
 * demonstrated on this tree, on this run", while check 7 was red on the same tree for
 * the fourth edit that was owed.
 *
 * So everything is staged except .git and node_modules, and the checks run below include
 * the one that holds the anchors. */
function stage() {
  const dir = mkdtempSync(join(tmpdir(), 'puppad-gate2-'));
  cpSync(REPO, dir, {
    recursive: true,
    filter: (src) => !/(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(src.slice(REPO.length)),
  });
  /* An isolated git identity AND an isolated global config: a core.excludesFile on the
   * runner silently changes what `git add -A` stages, and therefore what the count sees.
   * An adversarial pass made a four-path addition report as THREE that way. */
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(dir, '.gitconfig-none'), GIT_CONFIG_SYSTEM: join(dir, '.gitconfig-none') };
  writeFileSync(join(dir, '.gitconfig-none'), '');
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env }).trim();
  g('init', '-q', '.');
  g('config', 'user.email', 'gate2@puppad');
  g('config', 'user.name', 'gate2');
  g('add', '-A');
  g('commit', '-qm', 'before');
  return { dir, git: g };
}

/** An id that provably collides with nothing, so a repo that one day ships a game called
 *  `synth` cannot turn a NEGATIVE CONTROL GREEN — which is what a hard-coded id did when
 *  an adversarial pass added exactly that game: the four-file addition was reported as
 *  THREE, and the operator was told to escalate an architecture decision over a name. */
function freeId() {
  const taken = new Set(readdirSync(join(REPO, 'games')).map((f) => f.replace(/\.js$/, '')));
  const html = readFileSync(join(REPO, 'index.html'), 'utf8');
  for (let n = 0; n < 500; n++) {
    const id = 'gate2probe' + (n || '');
    if (!taken.has(id) && !html.includes(`'${id}'`)) return id;
  }
  throw new Error('check-gate2: could not find a game id that collides with nothing');
}

/* THE THREE THINGS, each written the way a builder writes it TODAY.
 *
 * Both anchors moved after an adversarial pass, and in opposite directions, for reasons
 * that are not symmetric:
 *
 *   THE REGISTRY ENTRY GOES LAST. index.html's own comment says the position in GAMES is
 *   what the Games button opens — inserting at the head displaced Gyre from slot 0, which
 *   is not what a builder adding a third game would do and is a change nothing here could
 *   see. (After the picker it matters less; it still is not the realistic edit.)
 *
 *   THE urlsToCache LINE GOES AFTER THE FIRST GAME ENTRY, NOT AFTER THE LAST. Anchoring
 *   to the tail is the exact pattern PUP-WO-0200 REMOVED from check-mutations for this
 *   reason: a tail anchor moves every time a game is added, and any future non-game
 *   precache asset appended after the games — a sprite, a font, the vendored leaflet
 *   PUP-WO-0600 plans — made the old regex match nothing and killed this file with a raw
 *   stack trace before a single negative control ran.
 *
 * A missing anchor is now an ::error:: that says the anchor moved, not a stack trace that
 * invites the reader to relax the check. */
function anchorFail(what) {
  console.error(`::error::CHECK 18 cannot find ${what}.`);
  console.error('  This check MUTATES the tree, so it holds anchors into it, and an anchor that');
  console.error('  no longer matches is a fact about the tree rather than a reason to loosen the');
  console.error('  anchor. Update it to point at what the file now says.');
  process.exit(1);
}
const addModule = (dir, id) => writeFileSync(join(dir, 'games', id + '.js'), MODULE_SRC);
const entryText = (pad, id, modulePath) =>
  `${pad}{id:'${id}',module:'${modulePath}',label:'Probe',icon:'\\u2B50',\n`
  + `${pad} color:'#22C55E',glow:'#86EFAC',sound:'ping',players:1,params:{}}`;

const addRegistryEntry = (dir, id, modulePath, where) => {
  const p = join(dir, 'index.html');
  const src = readFileSync(p, 'utf8');
  const list = src.match(/(var GAMES\s*=\s*\[\n)([\s\S]*?)(\n\];)/);
  if (!list) anchorFail('`var GAMES = [ ... ];` in index.html');
  const pad = (list[2].match(/^(\s*)/) || ['', '  '])[1];
  const body = where === 'head'
    ? entryText(pad, id, modulePath) + ',\n' + list[2]
    : list[2] + ',\n' + entryText(pad, id, modulePath);
  writeFileSync(p, src.replace(list[0], list[1] + body + list[3]));
};

const addCacheLine = (dir, modulePath, where) => {
  const p = join(dir, 'sw.js');
  const src = readFileSync(p, 'utf8');
  const list = src.match(/(var urlsToCache = \[\n)([\s\S]*?)(\n\];)/);
  if (!list) anchorFail('`var urlsToCache = [ ... ];` in sw.js');
  const pad = (list[2].match(/^(\s*)/) || ['', '  '])[1];
  const line = `${pad}'${modulePath}'`;
  const body = where === 'head' ? line + ',\n' + list[2] : list[2] + ',\n' + line;
  writeFileSync(p, src.replace(list[0], list[1] + body + list[3]));
};

/* EVERY PATH THE TREE PROMISES MUST EXIST, and this is the assertion that closes the
 * sharpest hole an adversarial pass found. Three paths changed, one per kind, both other
 * checks green — and the registry named `./games/synth-v2.js` while the file written was
 * `./games/synth.js`. `install` does `cache.addAll(urlsToCache)`, one 404 rejects the
 * whole call, install fails and the new worker goes redundant. The old check called that
 * tree THREE. check-assets asks whether a referenced asset is CACHED, never whether it
 * EXISTS, and check-syntax only parses the files that are there. */
function missingPaths(dir) {
  const out = [];
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  const reg = html.match(/var GAMES\s*=\s*\[([\s\S]*?)\n\];/);
  for (const m of (reg ? [...reg[1].matchAll(/module\s*:\s*'([^']+)'/g)] : [])) {
    const rel = m[1].replace(/^\.\//, '');
    if (!existsSync(join(dir, rel))) out.push(`the registry names a module that does not exist: ${m[1]}`);
  }
  const list = sw.match(/var urlsToCache = \[([\s\S]*?)\];/);
  for (const m of (list ? [...list[1].matchAll(/'([^']+)'/g)] : [])) {
    const raw = m[1];
    const rel = raw === './' ? 'index.html' : raw.replace(/^\.\//, '');
    if (!existsSync(join(dir, rel))) out.push(`urlsToCache names a file that does not exist: ${raw} — install's addAll would reject and the worker would go redundant`);
  }
  return out;
}

function runCheck(script, dir) {
  try {
    execFileSync(process.execPath, [join(HERE, script), dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: '' };
  } catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim() }; }
}

function scenario(label, { mutate, expect, expectReason, deep = false }) {
  const staged = stage();
  const dir = staged.dir;
  try {
    mutate(dir);
    staged.git('add', '-A');
    const changed = staged.git('diff', '--cached', '--name-only').split('\n').filter(Boolean)
      .filter((f) => f !== '.gitconfig-none');
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

    /* THE HALF A COUNT CANNOT DO — a fourth edit hiding inside a file already counted, or
     * a three-path change that leaves the app broken. Three assertions, and each closes a
     * hole an adversarial pass drove through the previous version. */
    for (const m of missingPaths(dir)) reasons.push(m);
    const scripts = [['check-syntax.mjs', 'check-syntax'], ['check-assets.mjs', 'check-assets']];
    /* check-mutations HOLDS THE ANCHORS. It is where PUP-WO-0200's real fourth thing
     * lived — an A14 anchor pinned to the last urlsToCache entry, which every added game
     * moved. Run only on the positive scenario, because it costs eight seconds and the
     * negative controls are already decided by cheaper reasons. */
    if (deep) scripts.push(['check-mutations.mjs', 'check-mutations']);
    for (const [script, name] of scripts) {
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
const ID = freeId();
const MOD = `./games/${ID}.js`;
console.log(`    (using the game id '${ID}', derived so it collides with nothing in games/ or GAMES)\n`);
/* BOTH ENDS OF BOTH LISTS, AND THAT IS NOT THOROUGHNESS FOR ITS OWN SAKE.
 *
 * The first version inserted the registry entry at the head and the cache line after the
 * first game — and an adversarial pass showed that a check which only ever inserts at one
 * end CANNOT DISTURB AN ANCHOR PINNED TO THE OTHER. It replayed PUP-WO-0200's defect
 * exactly: A14 re-anchored to the TAIL of urlsToCache, a game added, check 7 red on that
 * tree, and this check still printing PASSED because its own insertion never moved the
 * tail. I watched it happen after the first fix and it is why there are two runs here.
 *
 * A builder appends. PUP-WO-0300 appended Gyre after the placeholder, so `tail` is the
 * realistic edit and `head` is the one that catches an anchor pinned the other way. The
 * invariant has to hold wherever the line is put, so both are asserted. */
for (const where of ['tail', 'head']) {
  scenario(`module + registry entry + urlsToCache line, added at the ${where.toUpperCase()} of both lists`, {
    mutate: (d) => { addModule(d, ID); addRegistryEntry(d, ID, MOD, where); addCacheLine(d, MOD, where); },
    expect: 'THREE', deep: true,
  });
}

console.log('\n=== IT MUST BE ABLE TO FAIL — a gate that cannot go red is not a gate ===');
scenario('a game needing a FOURTH file (a helper module beside it)', {
  mutate: (d) => {
    addModule(d, ID);
    writeFileSync(join(d, 'games', ID + '-helper.js'), 'export default 1;\n');
    addRegistryEntry(d, ID, MOD, 'tail'); addCacheLine(d, MOD, 'tail');
  },
  expect: 'FAILS', expectReason: 'paths changed, not three',
});
scenario('a game that also ships an asset file', {
  /* Four paths, so the COUNT catches this one — and saying so is the point. An earlier
   * version of this scenario claimed to be "the shape PUP-WO-0200 actually found: three
   * paths change, the count is satisfied, only the checks can see it", and every clause
   * was false of what it did. A comment claiming coverage the case does not deliver is
   * the defect this whole file exists to prevent, so the claim moved to the scenarios
   * that actually demonstrate it — the two marked ISOLATES below. */
  mutate: (d) => {
    addModule(d, ID);
    writeFileSync(join(d, 'games', ID + '.png'), 'not really a png\n');
    addRegistryEntry(d, ID, MOD, 'tail'); addCacheLine(d, MOD, 'tail');
  },
  expect: 'FAILS', expectReason: 'paths changed, not three',
});
scenario('the registry entry names a module that was never written', {
  mutate: (d) => { addRegistryEntry(d, ID, MOD, 'tail'); addCacheLine(d, MOD, 'tail'); },
  expect: 'FAILS', expectReason: 'paths changed, not three',
});
scenario('ISOLATES the tree assertion — three paths, three kinds, module does not parse', {
  mutate: (d) => {
    writeFileSync(join(d, 'games', ID + '.js'), 'export default function mount(host, api) {\n');
    addRegistryEntry(d, ID, MOD, 'tail'); addCacheLine(d, MOD, 'tail');
  },
  expect: 'FAILS', expectReason: 'check-syntax',
});
scenario('ISOLATES check-assets — three paths, three kinds, sw.js edited but no cache line', {
  /* The control the file did not have. Four of five negative controls were decided by the
   * COUNT, so the check-assets branch was never exercised on a tree the count would pass —
   * nothing here would have noticed if it stopped working. §6.1 member 1. */
  mutate: (d) => {
    addModule(d, ID); addRegistryEntry(d, ID, MOD, 'tail');
    writeFileSync(join(d, 'sw.js'), readFileSync(join(d, 'sw.js'), 'utf8') + '\n/* touched, but the game was never added to urlsToCache */\n');
  },
  expect: 'FAILS', expectReason: 'check-assets',
});
scenario('ISOLATES path existence — three paths, three kinds, the module path is WRONG', {
  /* THE SHARPEST HOLE THE PASS FOUND, and the one that had nothing to catch it. The
   * registry and urlsToCache name ./games/<id>-v2.js while the file written is
   * ./games/<id>.js. Three paths, one per kind, check-syntax green, check-assets green —
   * and install's addAll rejects on the 404, install fails, and the new worker goes
   * redundant. The old check called this tree THREE. */
  mutate: (d) => {
    addModule(d, ID);
    addRegistryEntry(d, ID, `./games/${ID}-v2.js`, 'tail');
    addCacheLine(d, `./games/${ID}-v2.js`, 'tail');
  },
  expect: 'FAILS', expectReason: 'does not exist',
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
const reds = results.filter((r) => r.expect === 'FAILS').length;
console.log(`CHECK 18 PASSED at ${COMMIT.slice(0, 12)} — ${results.length} scenarios, all as predicted.`);
console.log('  Adding a game touches its module, one registry entry and one urlsToCache');
console.log('  line — demonstrated on this tree, on this run, in a throwaway repository,');
console.log('  rather than remembered from a commit message about a tree that is gone.');
console.log(`  And it goes red ${reds} ways — a count computed here rather than typed, because`);
console.log('  a hand-written one next to a list that changes is this repo\'s own recurring');
console.log('  defect. Three of those are cases a COUNT cannot see: three paths changed and');
console.log('  the resulting tree broken, which means a fourth edit is still owed.');
