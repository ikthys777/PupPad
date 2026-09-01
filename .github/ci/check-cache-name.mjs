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
 * Read the literal that identifies this cache generation.
 *
 * PUP-WO-0101 moved that literal. Before it, `CACHE_NAME = 'pup-pad-v16'` was the
 * whole identity. After it, the name is DERIVED per deploy path
 * (`CACHE_PREFIX + CACHE_VERSION`) so that one byte-identical sw.js can serve two
 * paths, and the part that must change when a cached asset changes is
 * `CACHE_VERSION`. Reading `CACHE_NAME` after that point reads a computed
 * expression and parses nothing.
 *
 * Both forms are accepted because this check compares two revisions and the BASE
 * revision legitimately predates the change — not as a fallback for sloppiness.
 * The assertion itself is unchanged: the identity literal must differ between base
 * and head whenever a cached asset changed, and an unparseable identity still
 * fails rather than passing quietly.
 */
function cacheName(src) {
  if (!src) return null;
  /* THREE THINGS ARE LOAD-BEARING HERE, and the first two were learned the hard
   * way when this check was weakened and the weakening was not noticed:
   *
   * 1. `^\s*var ` — the match must be an ASSIGNMENT, not any occurrence. Without
   *    the anchor, `String.match` returns the FIRST hit anywhere in the file, so
   *    the string `CACHE_VERSION = 'v99';` sitting inside a COMMENT satisfies the
   *    check while the real assignment says something else. This file's own
   *    explanatory prose was enough to defeat it.
   * 2. The derivation assertion below — reading a version literal proves nothing
   *    unless CACHE_NAME is actually built from it. A bumped CACHE_VERSION with
   *    `CACHE_NAME = CACHE_PREFIX + 'v17'` pinned would otherwise pass while the
   *    runtime cache identity is byte-identical and every client keeps the stale
   *    asset forever.
   * 3. The trailing `;` — otherwise `CACHE_VERSION = 'v' + (n)` matches the
   *    leading 'v' and a fragment is compared as if it were the identity.
   */
  const version = src.match(/^\s*var\s+CACHE_VERSION\s*=\s*(['"])([^'"]*)\1\s*;/m);
  if (version) {
    /* The identity is CACHE_PREFIX + CACHE_VERSION, and this check is only
     * meaningful if the code says so. Whitespace-tolerant, structure-strict. */
    if (!/^\s*var\s+CACHE_NAME\s*=\s*CACHE_PREFIX\s*\+\s*CACHE_VERSION\s*;/m.test(src)) return null;
    return version[2];
  }
  const legacy = src.match(/^\s*var\s+CACHE_NAME\s*=\s*(['"])([^'"]*)\1\s*;/m);
  return legacy ? legacy[2] : null;
}

const swHead = readAt(head, 'sw.js'), swBase = readAt(base, 'sw.js');
if (!swHead) fail('sw.js does not exist at HEAD.');
const listHead = urls(swHead), listBase = urls(swBase);
if (!listHead) fail('could not parse urlsToCache from sw.js at HEAD (sw.js:2-8).');
const nameHead = cacheName(swHead), nameBase = cacheName(swBase);
if (!nameHead) fail('could not establish the cache identity from sw.js at HEAD.\n' +
  '  Expected either `var CACHE_VERSION = \'…\';` TOGETHER WITH\n' +
  '  `var CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;`, or (pre-PUP-WO-0101)\n' +
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
