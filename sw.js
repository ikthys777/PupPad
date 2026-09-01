/* PupPad service worker.
 *
 * Two copies of this file are published to ONE origin — the newest build at the
 * site root and the promoted build at /stable/ (architecture §6). The file is
 * byte-identical at both paths; everything that must differ between them is
 * derived at runtime from the worker's own scope, so there is no build step and
 * no generated variant to keep in sync (architecture §5).
 */

/* === Cache identity ======================================================= */

/* WHY THE PREFIX IS DERIVED, AND WHY IT ENDS IN A DELIMITER.
 *
 * caches.keys() is ORIGIN-scoped, not scope-scoped, so each copy can see and
 * delete the other's caches. Naming alone does not fix that — it converts a
 * collision into mutual deletion (architecture §6). The reap must be bounded to
 * this worker's own prefix.
 *
 * That makes one property load-bearing: NO PREFIX MAY BE A PREFIX OF ANOTHER.
 * The paths themselves violate it — "/PupPad/" IS a prefix of "/PupPad/stable/",
 * so a naive prefix built from the raw path would let the root worker reap
 * stable's caches while looking correctly bounded. The fix is the trailing "|":
 * encodeURIComponent escapes "|" to %7C, so the delimiter can never occur inside
 * the encoded path, and the root prefix therefore ends where stable's name
 * continues. Root  "puppad|%2FPupPad%2F|"  is not a prefix of
 * stable "puppad|%2FPupPad%2Fstable%2F|v17".
 */
function cachePrefixFor(scopeUrl) {
  /* No default. An earlier version fell back to '/', which would hand BOTH deploy
   * paths the prefix "puppad|%2F|" — a shared prefix, i.e. the mutual deletion
   * this file exists to prevent. Returning null makes the caller cache nothing. */
  var path;
  try {
    path = new URL(scopeUrl).pathname;
  } catch (e) {
    return null;
  }
  if (path.charAt(path.length - 1) !== '/') path += '/';
  return 'puppad|' + encodeURIComponent(path) + '|';
}

function workerScope() {
  /* registration.scope is authoritative — a worker may be granted a scope wider
   * than its own directory via Service-Worker-Allowed. Fall back to this file's
   * directory only if it is unavailable. */
  try {
    if (self.registration && self.registration.scope) return self.registration.scope;
  } catch (e) {}
  return self.location.href.replace(/[^/]*$/, '');
}

/* A worker whose own scope cannot be parsed must not guess: it caches nothing. */
var SCOPE_URL = workerScope();
var SCOPE_PATH = null;
try {
  SCOPE_PATH = new URL(SCOPE_URL).pathname;
} catch (e) {
  SCOPE_PATH = null;
}
var CACHE_PREFIX = SCOPE_PATH === null ? null : cachePrefixFor(SCOPE_URL);

/* Bump when any cached asset changes. CI asserts this (check 3). */
var CACHE_VERSION = 'v17';
var CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

/* ONE-TIME EXCEPTION, and the only name deleted outside this worker's prefix.
 *
 * Every device that has ever loaded PupPad — Buddy's included — holds a cache
 * called exactly "pup-pad-v16". It matches no prefix, so a correctly bounded reap
 * would never clean it and it would leak forever.
 *
 * It is matched by EXACT EQUALITY, never by pattern, wildcard or prefix. A
 * pattern here is precisely how the origin-wide reap returns, and it would return
 * disguised as cleanup.
 *
 * REMOVE THIS when no device is plausibly still holding a pre-v17 cache — after
 * both deploy paths have been live long enough that any install has activated at
 * least once. Deleting it early costs one cache refill; keeping it forever costs
 * a standing exception to the rule the rest of this file exists to enforce.
 *
 * WHAT THIS EXCEPTION KNOWINGLY DOES NOT COVER, stated so the choice is visible.
 * Sixteen cache names have existed on main: pup-pad-v1, v3, and v4 through v16
 * (there was never a v2). Only v16 is listed here, so a device that last loaded
 * PupPad at v1-v15 and has not loaded since keeps that cache FOREVER — a bounded
 * reap cannot reach it, and no later worker will either.
 *
 * That is a leak, not a violation: such a cache is never read (the offline read is
 * scoped to CACHE_NAME) and never served, so invariants 3 and 7 hold regardless. It
 * is also self-limiting — the currently-live v16 worker reaps origin-wide, so every
 * device that has loaded since 2026-07-12 holds v16 and nothing older.
 *
 * It was left at ONE literal deliberately. ikthys777.github.io is a SHARED ORIGIN
 * across every one of this account's Pages repositories, so each name listed here
 * is another unconditional origin-wide deletion — and this exception is the single
 * place where that rule is broken. Trading a permanent, invisible, shrinking leak
 * for fifteen more origin-wide deletions is a widening of the one thing this file
 * warns returns "disguised as cleanup", and it is the architect's call, not the
 * builder's. Raised as decision-needed in docs/feedback/PUP-WO-0102.md.
 */
var LEGACY_CACHE_EXACT = 'pup-pad-v16';

/* === The /stable/ exclusion =============================================== */

/* The root worker's scope COVERS /stable/. Because the fetch handler below caches
 * every response it serves, the root worker can cache the promoted copy's assets
 * under the root prefix before stable's own worker ever registers — northstar
 * invariant 7 failing with disjoint cache names and a green gate. Prefix naming
 * does not address this; it is a separate mechanism (PUP-WO-0102 §1.4).
 */
var STABLE_SEGMENT = 'stable/';
var IS_STABLE_WORKER = SCOPE_PATH !== null &&
  SCOPE_PATH.length >= STABLE_SEGMENT.length &&
  SCOPE_PATH.slice(-STABLE_SEGMENT.length) === STABLE_SEGMENT;
var FOREIGN_SUBTREE = (SCOPE_PATH === null || IS_STABLE_WORKER) ? null : SCOPE_PATH + STABLE_SEGMENT;

/* CANONICAL FORM, THEN AN ALLOWLIST — not a denylist of encodings.
 *
 * URL.pathname is neither percent-decoded nor slash-normalised, but every static
 * server (GitHub Pages included) decodes and normalises before resolving. So
 * "/%73table/x", "/stable%2Fx" and "//stable/x" all reach the SAME file while
 * failing a naive `pathname.indexOf('/stable/') === 0` test. Enumerating those
 * encodings is unbounded — %73, %2F, //, dot segments, unicode, and whatever is
 * not yet thought of.
 *
 * So: RESOLVE the path the way the server will, then compare the result. The
 * comparison happens on the decoded, normalised form, which is what makes the rule
 * an allowlist — serve only paths that resolve INSIDE my own scope and NOT inside a
 * deeper deploy path — rather than a list of spellings to reject. Its safety does
 * not depend on having imagined every encoding, because every encoding of the same
 * file resolves to the same string.
 *
 * ONLY genuinely undecidable input is declined: a malformed escape, or a segment
 * that decodes to a separator and so invents structure the server would honour and
 * this worker would not. Ordinary encoding is decoded and compared on its real
 * name. THIS PARAGRAPH USED TO SAY THE OPPOSITE — that a path must have ARRIVED
 * canonical or be declined — and that is exactly the rule that refused
 * "/my%20photo.png": served online, silently absent offline, northstar invariant 3
 * (PUP-WO-0101 F7). The code was corrected and this comment was not, which is its
 * own lesson: the comment survived the fix that falsified it, three lines above the
 * function that no longer behaves that way. */
function canonicalPath(pathname) {
  /* Decode PER SEGMENT, never the whole string at once.
   *
   * Whole-string decoding cannot distinguish "%20" in a filename — legitimate, and
   * the browser sends it for any asset with a space or a non-ASCII character —
   * from "%2F", which invents a separator the server will honour and this worker
   * would not. Segment-wise decoding keeps the two apart: a segment whose decoded
   * form contains a separator, or which decodes to a dot-segment, is a structural
   * change this worker cannot predict the server's resolution of, so it declines.
   * Everything else decodes and is compared on its real name.
   *
   * An earlier version required the path to have ARRIVED canonical, which declined
   * "/my%20photo.png" — served fine online, silently absent offline (invariant 3). */
  var parts = pathname.split('/');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i];
    if (seg === '') { if (i === 0 || i === parts.length - 1) out.push(''); continue; }
    var d;
    try {
      d = decodeURIComponent(seg);
    } catch (e) {
      return null;                     /* malformed escape: undecidable */
    }
    if (d.indexOf('/') !== -1 || d.indexOf('\\') !== -1) return null;   /* invented separator */
    if (d === '.') continue;
    if (d === '..') { if (out.length > 1) out.pop(); continue; }
    out.push(d);
  }
  return out.join('/');
}

/** true when this worker may serve the request at all. */
function servesRequest(requestUrl) {
  if (SCOPE_PATH === null) return false;
  var u;
  try {
    u = new URL(requestUrl);
  } catch (e) {
    return false;
  }
  if (u.origin !== self.location.origin) return true;   /* cross-origin: not our subtree question */

  var canon = canonicalPath(u.pathname);
  if (canon === null) return false;              /* undecidable: decline */
  /* Outside our own scope entirely. */
  if (canon.indexOf(SCOPE_PATH) !== 0) return false;
  /* Inside a deeper deploy path that owns itself — INCLUDING the directory itself
   * with no trailing slash. A static host 301s "/stable" to "/stable/", and a
   * subresource fetch follows redirects, so serving the bare form caches the
   * promoted copy's bytes under this prefix just as surely as the slashed form. */
  if (FOREIGN_SUBTREE !== null) {
    if (canon.indexOf(FOREIGN_SUBTREE) === 0) return false;
    if (canon === FOREIGN_SUBTREE.slice(0, -1)) return false;
  }
  return true;
}

/* === Precache ============================================================= */

var urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  if (CACHE_PREFIX === null) return;      /* unusable scope: cache nothing */
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  /* A worker registered at a NON-CANONICAL scope — e.g. the "//stable/" a single
   * typo produces — is an orphan: its prefix nests under neither deploy path, so
   * no worker will ever reap its cache. It unregisters itself rather than leaving
   * a cache nothing can clean. */
  if (CACHE_PREFIX === null || canonicalPath(SCOPE_PATH) !== SCOPE_PATH) {
    event.waitUntil(
      caches.keys().then(function(names) {
        return Promise.all(names.filter(function(n) {
          return CACHE_PREFIX !== null && n.startsWith(CACHE_PREFIX);
        }).map(function(n) { return caches.delete(n); }));
      }).then(function() {
        return self.registration.unregister();
      }).catch(function() {})
    );
    return;
  }
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          /* The one exact-literal exception — and ONLY the root worker may take
           * it. pup-pad-v16 was created by the root copy; stable deleting it is a
           * cross-path deletion that leaves the root install with no cache at all
           * until it is next loaded online (northstar invariant 3). */
          if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT) return true;
          /* Otherwise: this worker's own prefix, and never outside it. */
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME;
        }).map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  /* Decline the other deploy path entirely: no response, no cache entry. Returning
   * without calling respondWith leaves the request to the browser, which is what
   * lets stable's own worker own it. */
  if (!servesRequest(event.request.url)) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      var clone = response.clone();
      /* cache.put rejects on a non-GET request, a 206, or an opaque redirect. The
       * response has already been returned, so there is nothing to recover — but
       * an unhandled rejection in a worker is now a CI failure, and an unguarded
       * one here would make routine traffic look like a defect. */
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.put(event.request, clone);
      }).catch(function() {});
      return response;
    }).catch(function() {
      /* SCOPED read. `caches.match(request)` is CacheStorage.match, which searches
       * EVERY cache on the origin — so the offline path would serve the other
       * deploy path's bytes. That is northstar invariant 7 falsified by its own
       * stated test ("load the promoted copy after the test copy has been cached;
       * find any asset served from the other build"), and it would have held while
       * every check was green. The reap being prefix-bounded is not enough if the
       * read is not. */
      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request);
      });
    })
  );
});
