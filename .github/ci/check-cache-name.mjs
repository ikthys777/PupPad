#!/usr/bin/env node
/**
 * CHECK 3 — Cache identity (northstar invariant 7).
 * If a changed cached asset will NOT be refreshed by install's addAll — i.e. the
 * current urlsToCache does not list it — CACHE_NAME (sw.js:1) must change too.
 * A change to a STILL-LISTED asset needs no bump: addAll overwrites it. See the long
 * comment at the trigger block for the mechanism and for what a bump costs.
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

/* AN IDENTITY THAT DEPENDS ON WHO IS LOOKING IS NOT AN IDENTITY.
 *
 * Evaluating instead of scraping removed the regex-versus-parser class, but it
 * opened one the regex did not have: this sandbox is DETECTABLE. A single line —
 *
 *     var CACHE_VERSION = (typeof ExtendableEvent !== 'undefined') ? 'evil' : 'v17';
 *
 * evaluates to 'v17' here and to something else in Chromium, so the check would
 * compare a name the browser never uses. The old regex refused that source, though
 * only by accident: it accepted string literals ONLY, so it equally refused the
 * correct `CACHE_NAME = CACHE_PREFIX + CACHE_VERSION` this work order requires.
 * Narrower is not the same as stronger, and neither one was sound.
 *
 * So the source is evaluated TWICE — once bare, once under a browser-shaped global
 * set — and the two identities must agree. Any environment-dependent identity fails
 * loudly instead of being read in whichever environment happens to be convenient.
 * Check 6 does catch this class in a real browser, because it derives its expected
 * names from the sandbox and then looks for them in Chromium; that is a genuine
 * backstop but an incidental one, and a defect should fail at the check whose
 * subject it is. (Raised by the PUP-WO-0102 adversarial pass as F3.) */
const BROWSERISH_GLOBALS = {
  ExtendableEvent: function ExtendableEvent() {},
  FetchEvent: function FetchEvent() {},
  ServiceWorkerGlobalScope: function ServiceWorkerGlobalScope() {},
  Cache: function Cache() {},
  CacheStorage: function CacheStorage() {},
  Client: function Client() {},
  importScripts: function importScripts() {},
  navigator: { userAgent: 'Mozilla/5.0 Chrome', onLine: true },
  location: { href: IDENTITY_SCOPE + 'sw.js', origin: new URL(IDENTITY_SCOPE).origin },
};

function evaluateIdentity(src, extraGlobals) {
  const tmp = join(tmpdir(), `puppad-sw-${Math.random().toString(36).slice(2)}.js`);
  try {
    writeFileSync(tmp, src);
    const w = loadWorker(tmp, IDENTITY_SCOPE, new FakeCacheStorage(), extraGlobals);
    const name = w.get('CACHE_NAME');
    return typeof name === 'string' && name.length ? name : null;
  } catch {
    return null;                 /* unparseable or throws at load: not an identity */
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

function cacheIdentity(src) {
  if (!src) return null;
  const bare = evaluateIdentity(src, {});
  const browserish = evaluateIdentity(src, BROWSERISH_GLOBALS);
  if (bare !== null && browserish === null) {
    /* Not a case to skip past. A worker that loads bare and THROWS under a
     * browser-shaped environment is environment-dependent in the most direct way
     * there is, and an `x !== null` guard on the comparison below would let it
     * through by making the assertion silently not apply — the same shape as a
     * check that passes because it measured nothing. */
    fail('sw.js loads in a bare sandbox but FAILS under a browser-shaped one.\n' +
      '  The identity CI verified would not be the identity the tablet uses, and\n' +
      '  a worker that throws on load caches nothing at all (invariant 3).');
  }
  if (bare !== null && browserish !== null && bare !== browserish) {
    fail('the cache identity DEPENDS ON THE ENVIRONMENT evaluating it.\n' +
      `  bare sandbox:      ${bare}\n` +
      `  browser-shaped:    ${browserish}\n` +
      '  A worker that names its cache one thing for CI and another for Chromium\n' +
      '  defeats every check that derives an expected name from this source, and the\n' +
      '  name the child\'s tablet actually uses is the one nothing verified.');
  }
  return bare;
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

/* ================= THE RULE, REFINED — AND THE OLD ONE'S JUSTIFICATION WAS WRONG
 *
 * THIS CHECK USED TO REQUIRE A BUMP FOR *ANY* CHANGE TO A LISTED ASSET, AND FOR ANY
 * CHANGE TO THE LIST. Its stated reason was that "already-installed clients keep
 * serving the previous build's assets — invariant 7". THAT REASON IS NOT TRUE FOR
 * ASSETS THAT ARE THEMSELVES IN urlsToCache, and the mechanism says so:
 *
 *     install = caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))
 *
 * With the NAME UNCHANGED that opens the EXISTING cache and PUTS FRESH COPIES OVER
 * EVERY LISTED ENTRY. Any shipped byte-change to sw.js re-runs install, so after it
 * the cache holds the new copy of every listed asset. Nothing stale survives AMONG
 * LISTED ENTRIES, so there is no mixture and invariant 7 is not at risk.
 *
 * WHAT A BUMP *DOES* COST, measured rather than assumed: `activate` deletes the old
 * cache WHOLE, and the runtime cache lives in it. PUP-WO-0105 measured a bump at
 * **24 of 24 map tiles offline before, 0 of 24 after**. So requiring a bump where
 * addAll already refreshes the asset is strictly worse for the child, for no benefit.
 *
 * AND THE OLD RULE MADE NORTHSTAR INVARIANT 6 UNSATISFIABLE. Adding a game ALWAYS
 * adds a urlsToCache line, so "the list changed" fired on every game this project
 * will ever add — while invariant 6 says a game is "its own module, one registry
 * entry, and the asset manifest — NOTHING ELSE" and roadmap P2 gate 2 counts exactly
 * three things. A bump is a fourth. Check 3 and invariant 6 could not both stand.
 *
 * THE REFINED RULE — a bump is required for a changed asset that install's addAll
 * WILL NOT OVERWRITE, i.e. one the cache holds but the CURRENT urlsToCache does not
 * list:
 *   changed AND in listHead        -> addAll refreshes it        -> NO bump
 *   changed AND dropped from list  -> the old copy is stranded   -> BUMP
 *   an entry ADDED to the list     -> nothing stale exists yet   -> NO bump
 *   an entry REMOVED from the list -> its cached copy is stranded -> BUMP
 *
 * WHAT THIS CHECK STILL CANNOT SEE, said plainly rather than implied: entries the
 * RUNTIME cache holds that were never in urlsToCache — cross-origin CDN responses and
 * map tiles. Nothing in the repository names them, so no diff can reveal a change to
 * them. For SAME-ORIGIN assets that gap is closed by check 2, which requires every
 * local asset index.html references to be listed; an asset that is referenced and
 * unlisted is check 2's red, not this one's.
 *
 * (Ruled by CC-A 2026-09-02, flagged upward before landing because this check guards
 * invariant 7's mechanism and a change to an invariant is a decision, not a build
 * step. It corrects CC-A's own earlier reasoning — refusing the bump because 0200
 * "adds a NEW asset" was true of games/hello.js and incomplete, since 0200 also
 * MODIFIES the already-precached index.html — while keeping the conclusion, now on
 * the mechanism argument above rather than on PUP-WO-0000 §6.1's wording.) */
const watched = new Set([...(listBase || []), ...listHead]);

const changed = git('diff', '--name-only', base, head).split('\n').filter(Boolean);
const changedAssets = changed.filter(f => watched.has(norm(f)));
/* The two sets that decide it: refreshed by addAll, or stranded in the old cache. */
const refreshed = changedAssets.filter(f => listHead.has(norm(f)));
const stranded  = changedAssets.filter(f => !listHead.has(norm(f)));
const removedFromList = listBase ? [...listBase].filter(x => !listHead.has(x)) : [];
const addedToList = listBase ? [...listHead].filter(x => !listBase.has(x)) : [];

console.log(`  urlsToCache watched (${watched.size}): ${[...watched].join(', ')}`);
console.log(`  files changed in range: ${changed.length}${changed.length ? ' -> ' + changed.join(', ') : ''}`);
if (refreshed.length) console.log(`  changed AND still listed (addAll refreshes these): ${refreshed.join(', ')}`);
if (addedToList.length) console.log(`  added to urlsToCache (nothing stale can exist yet): ${addedToList.join(', ')}`);
console.log(`  CACHE_NAME: ${nameBase ?? '(absent at base)'} -> ${nameHead}`);

const triggers = [];
if (stranded.length) triggers.push(`changed asset(s) the current urlsToCache does NOT list, so addAll will not refresh them: ${stranded.join(', ')}`);
if (removedFromList.length) triggers.push(`entr(ies) REMOVED from urlsToCache, whose cached copies are now stranded: ${removedFromList.join(', ')}`);

if (!triggers.length) {
  console.log('\nCHECK 3 PASSED — every changed cached asset is still in urlsToCache, so');
  console.log('  install\'s addAll overwrites all of them and no bump is required.');
  if (refreshed.length || addedToList.length) {
    console.log('  A bump here would delete the whole old cache on activate, taking the runtime');
    console.log('  cache with it — measured at 24 of 24 map tiles offline before, 0 of 24 after');
    console.log('  (PUP-WO-0105) — for no invariant-7 benefit.');
  }
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
