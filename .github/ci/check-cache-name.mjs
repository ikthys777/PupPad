#!/usr/bin/env node
/**
 * CHECK 3 — Cache identity (northstar invariant 7).
 * If any asset listed in urlsToCache changed, CACHE_NAME (sw.js:1) must change too.
 *
 * THE BASE REF IS THIS CHECK. An unstated or unreachable base is how a check like
 * this silently compares nothing and passes forever, so the base is resolved
 * explicitly, VALIDATED, and printed — and if it cannot be established the check
 * FAILS rather than skips. A skip here is indistinguishable from a pass.
 *
 * Resolution order:
 *   pull_request  -> merge-base(base.sha, HEAD)   (the fork point, not the tip:
 *                    comparing against a moving base.sha reports other people's
 *                    merged commits as this PR's changes)
 *   push          -> github.event.before
 *   fallback      -> HEAD~1
 *   root commit   -> pass, explicitly: nothing precedes it, so nothing can differ.
 *
 * Requires full history: actions/checkout with fetch-depth: 0. A shallow clone
 * makes merge-base fail, which this check reports as a failure rather than
 * papering over — see FEEDBACK.md.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FakeCacheStorage, loadWorker } from './lib/sw-harness.mjs';

const REPO = process.argv[2] || process.cwd();
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();
const gitOk = (...a) => { try { git(...a); return true; } catch { return false; } };

const fail = (msg) => { console.error(`\nCHECK 3 FAILED — ${msg}`); process.exit(1); };

// ---------- resolve the base ----------
const ev = process.env.GITHUB_EVENT_NAME || 'local';
const prBase = process.env.PR_BASE_SHA || '';
const pushBefore = process.env.PUSH_BEFORE_SHA || '';
const ZERO = /^0{40}$/;

const reachable = (sha) => sha && !ZERO.test(sha) && gitOk('cat-file', '-e', `${sha}^{commit}`);

let base = null, how = null;
if (ev === 'pull_request' || ev === 'pull_request_target') {
  if (!reachable(prBase)) {
    fail(`event is ${ev} but the PR base sha is missing or unreachable (got "${prBase}").\n` +
         `  Most likely cause: actions/checkout without fetch-depth: 0.\n` +
         `  Refusing to fall back — a base this check cannot verify is a comparison against nothing.`);
  }
  try { base = git('merge-base', prBase, 'HEAD'); how = `merge-base(${prBase.slice(0,8)}, HEAD)`; }
  catch { fail(`no merge-base between ${prBase} and HEAD — histories are unrelated or the clone is shallow.`); }
} else if (reachable(pushBefore)) {
  base = pushBefore; how = `push event "before" (${pushBefore.slice(0,8)})`;
} else {
  // Force-push and first-push-of-a-branch both land here: "before" is zeros or gone.
  const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).slice(1);
  if (parents.length === 0) {
    console.log('  base: none — HEAD is a root commit, nothing precedes it.');
    console.log('\nCHECK 3 PASSED — no predecessor to compare against.');
    process.exit(0);
  }
  if (pushBefore && !reachable(pushBefore)) {
    console.log(`  note: push "before" (${pushBefore.slice(0,8)}) is unreachable — force-push or a rewritten`);
    console.log('        history. Falling back to the first parent, which is still a real comparison.');
  }
  base = parents[0]; how = `first parent of HEAD (${parents[0].slice(0,8)})`;
}

const head = git('rev-parse', 'HEAD');
console.log(`  event: ${ev}`);
console.log(`  base:  ${base}  via ${how}`);
console.log(`  head:  ${head}`);
if (base === head) fail('base and head are the same commit — this would compare nothing.');

// ---------- what counts as a cached asset ----------
const readAt = (ref, path) => {
  try {
    return execFileSync('git', ['-C', REPO, 'show', `${ref}:${path}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { return null; }   // absent at that revision; the caller decides what that means
};
const norm = (p) => p.replace(/^\.\//, '').replace(/^\//, '');
function urls(src) {
  if (!src) return null;
  const m = src.match(/urlsToCache\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  // './' is the directory index; it is served as index.html.
  return new Set([...m[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map(x => norm(x[1])).map(x => (x === '' ? 'index.html' : x)));
}
/**
 * Determine the cache identity a revision's sw.js would ACTUALLY use.
 *
 * This does not read a literal — it EVALUATES the worker at a fixed scope and asks
 * what CACHE_NAME comes out. Every regex attempt at this has been defeated, and
 * each time by something more ordinary than the last:
 *
 *   - reading `CACHE_VERSION` from anywhere, so a value in a COMMENT won.
 *   - anchoring to `^\s*var`, which is a LINE start, not code — so a block comment
 *     whose lines begin at column 0 still won.
 *   - and with or without an anchor, `String.match` returns the FIRST hit, so two
 *     `var CACHE_VERSION = …;` lines are enough: the check reads one, the worker
 *     uses the other.
 *
 * A regex is answering "does this text appear?" when the question is "what will
 * this code compute?". `check-cache-isolation.mjs` already evaluates the worker at
 * two scopes; this uses the same harness. A cache identity that cannot be
 * evaluated fails loudly rather than being guessed at from its spelling.
 */
const IDENTITY_SCOPE = 'https://ikthys777.github.io/PupPad/';

function cacheIdentity(src) {
  if (!src) return null;
  const tmp = join(tmpdir(), `puppad-sw-${Math.random().toString(36).slice(2)}.js`);
  try {
    writeFileSync(tmp, src);
    const w = loadWorker(tmp, IDENTITY_SCOPE, new FakeCacheStorage());
    const name = w.get('CACHE_NAME');
    return typeof name === 'string' && name.length ? name : null;
  } catch {
    return null;                 /* unparseable or throws at load: not an identity */
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}


const swHead = readAt(head, 'sw.js'), swBase = readAt(base, 'sw.js');
if (!swHead) fail('sw.js does not exist at HEAD.');
const listHead = urls(swHead), listBase = urls(swBase);
if (!listHead) fail('could not parse urlsToCache from sw.js at HEAD (sw.js:2-8).');
const nameHead = cacheIdentity(swHead), nameBase = cacheIdentity(swBase);
if (!nameHead) fail('could not establish the cache identity from sw.js at HEAD.\n' +
  '  Expected either `var CACHE_VERSION = \'…\';` TOGETHER WITH\n' +
  '  `var CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;`, or (pre-PUP-WO-0102)\n' +
  '  `var CACHE_NAME = \'…\';`. Reading a version literal that CACHE_NAME does not\n' +
  '  use would compare a number nothing depends on.');

// Union of both revisions: an asset REMOVED from the list still changed what a
// client caches, so it must still trigger a bump.
const watched = new Set([...(listBase || []), ...listHead]);

const changed = git('diff', '--name-only', base, head).split('\n').filter(Boolean);
const changedAssets = changed.filter(f => watched.has(norm(f)));
const listChanged = listBase && (
  listBase.size !== listHead.size || [...listHead].some(x => !listBase.has(x))
);

console.log(`  urlsToCache watched (${watched.size}): ${[...watched].join(', ')}`);
console.log(`  files changed in range: ${changed.length}${changed.length ? ' -> ' + changed.join(', ') : ''}`);
console.log(`  CACHE_NAME: ${nameBase ?? '(absent at base)'} -> ${nameHead}`);

const triggers = [];
if (changedAssets.length) triggers.push(`cached asset(s) changed: ${changedAssets.join(', ')}`);
if (listChanged) triggers.push('the urlsToCache list itself changed');

if (!triggers.length) {
  console.log('\nCHECK 3 PASSED — no cached asset changed, so no CACHE_NAME bump is required.');
  process.exit(0);
}
// The base may be unreadable in two very different ways, and they must not be
// collapsed — an earlier version guarded the failure on `nameBase !== null` and
// so fell through to the success line, printing "CACHE_NAME changed to X" without
// ever having established it.
if (swBase === null) {
  // sw.js did not exist at the base: there was no service worker, therefore no
  // previous cache generation to invalidate. Nothing to bump. Say exactly that.
  console.log(`\nCHECK 3 PASSED — ${triggers.join('; ')}, but sw.js does not exist at the base,`);
  console.log('  so there is no previous cache generation to invalidate. Nothing was compared.');
  process.exit(0);
}
if (nameBase === null) {
  // sw.js EXISTS at the base but its CACHE_NAME could not be read — a previous
  // cache generation does exist and this check cannot tell whether it changed.
  // Symmetric with the HEAD case at the top, which already fails.
  fail(`sw.js exists at the base (${base.slice(0,8)}) but its CACHE_NAME could not be parsed,\n` +
       `  while ${triggers.join('; ')}.\n` +
       `  A previous cache generation exists and this check cannot verify it was invalidated.\n` +
       `  Failing rather than guessing: CACHE_NAME must be a plain quoted literal on sw.js:1.`);
}
if (nameHead === nameBase) {
  fail(`${triggers.join('; ')}, but CACHE_NAME is still "${nameHead}".\n` +
       `  Bump CACHE_NAME in sw.js:1. Without it the activate handler (sw.js:19-29) reaps nothing\n` +
       `  and already-installed clients keep serving the previous build's assets — northstar invariant 7.`);
}
console.log(`\nCHECK 3 PASSED — ${triggers.join('; ')}, and CACHE_NAME changed from "${nameBase}" to "${nameHead}".`);
