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

/* Bump when any cached asset changes. CI asserts this (check 3).
 *
 * PUP-WO-0105 BUMPED THIS TO v18 AND THE ADVERSARIAL PASS REVERSED IT. Kept as a
 * comment because the reasoning is the useful part.
 *
 * The bump was meant to recover devices that had already cached a 404 over the app
 * shell, on the belief that an unchanged CACHE_NAME means the poisoned entry is
 * inherited. TWO MEASUREMENTS KILLED IT:
 *   - THE BUMP WAS NEVER NEEDED. `install` is
 *     `caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))`. With CACHE_NAME
 *     unchanged that opens the EXISTING cache and puts fresh copies over all five
 *     precached URLs, including the poisoned ones. Shipping a byte-different sw.js
 *     IS the re-fetch. Verified: poisoned /PupPad/index.html at 404, guard shipped
 *     with the version left alone, entry back to 200 and the runtime cache intact.
 *     It repairs the five urlsToCache keys and nothing else: a poisoned same-origin
 *     RUNTIME entry would survive, and no production URL is one today only because
 *     index.html has no relative `./` subresources. That is a fact about today's
 *     index.html, not a property of the design — see the LIMITS note below.
 *   - THE BUMP COST THE MAP PANEL ITS OFFLINE ASSETS. Everything cross-origin is
 *     runtime-cached into THIS SAME cache — leaflet, supabase, and every OSM tile —
 *     and the activate reap deletes the old cache whole, after which addAll restores
 *     five entries and nothing else. Measured by the falsification test northstar
 *     invariant 3 actually specifies, cold-start in airplane mode: 24 of 24 tiles
 *     rendered on v17, 0 of 24 on v18. A treasure map with no map.
 *
 * So the bump traded invariant 3 against invariant 3 — the exact trade §1.2 of the
 * work order exists to prevent, and which the guard below was carefully written to
 * avoid. The guard alone. Do not reintroduce a bump for this defect, and do not add
 * an activate-time addAll either: install already does it. */
var CACHE_VERSION = 'v17';
/* Guarded, because `null + 'v17'` is the STRING "nullv17" — a perfectly plausible
 * cache identity that no browser will ever create. It is unreachable today (install
 * returns early, servesRequest declines, activate takes the orphan branch), but
 * check 3 reads this value and would report "nullv17" as an identity rather than
 * failing. A name that cannot exist should not be expressible. */
var CACHE_NAME = CACHE_PREFIX === null ? null : CACHE_PREFIX + CACHE_VERSION;

/* THE ONLY NAME DELETED OUTSIDE THIS WORKER'S PREFIX.
 *
 * It is NOT a one-time migration, and an earlier version of this comment called it
 * one. The line below runs on EVERY activation of every non-stable worker, forever,
 * until this constant is removed — which is what makes the precondition at the
 * deletion site load-bearing rather than a merge-day footnote.
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
 * FIFTEEN cache names have existed on main: pup-pad-v1, v3, and v4 through v16
 * (there was never a v2). Only v16 is listed here, so a device that last loaded
 * PupPad at v1-v15 and has not loaded since keeps that cache FOREVER — a bounded
 * reap cannot reach it, and no later worker will either. That is FOURTEEN stranded
 * names. Verified against git rather than counted by hand, because an earlier
 * version of this comment said "sixteen" while enumerating fifteen, and the
 * architect is being asked to rule on the size of this trade:
 *     for c in $(git rev-list origin/main -- sw.js); do
 *       git show $c:sw.js | grep -oE "^var CACHE_NAME = 'pup-pad-v[0-9]+'"; done |
 *       grep -oE 'pup-pad-v[0-9]+' | sort -u | wc -l     ->  15
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
 * for fourteen more origin-wide deletions is a widening of the one thing this file
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
/* THE TWO-PATH ASSUMPTION, NAMED WHERE IT IS MADE (WO §4 fences generalising to N).
 *
 * Both of these are correct for exactly two deploy paths and quietly wrong for a
 * third: IS_STABLE_WORKER is a SUFFIX test, so a scope ending "/unstable/" reads as
 * the promoted copy; and FOREIGN_SUBTREE is SCOPE-RELATIVE, so a worker at
 * /PupPad/games/ would protect /PupPad/games/stable/ rather than the real
 * /PupPad/stable/. Neither is reachable in today's topology — index.html registers
 * with no explicit scope, so the only scopes that exist are the two deploy paths.
 * Written down so the third path finds this comment instead of the behaviour. */
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
      /* A MALFORMED ESCAPE IS NOT UNDECIDABLE, and declining it was an invariant 3
       * violation of the same shape as F7. The URL path encode-set does NOT escape
       * '%', so a browser sends "/100%off.png" verbatim; decodeURIComponent throws on
       * it, and a static host serves the file literally named "100%off.png". Refusing
       * it meant an asset that works online and is silently absent offline.
       *
       * So decode leniently instead — escape by escape, leaving invalid ones alone,
       * which is what a lenient server does. Safety is preserved because the check
       * below runs on the RESULT: if any valid escape in the segment decodes to a
       * separator it is still declined, so "%2Fstable%GG" cannot slip through on the
       * back of its own malformedness. */
      d = seg.replace(/%[0-9A-Fa-f]{2}/g, function (esc) {
        try { return decodeURIComponent(esc); } catch (e2) { return esc; }
      });
    }
    /* Only '/' invents structure. Backslash was rejected here too and should not have
     * been: it is not a path separator in a URL (RFC 3986) and not one on the host
     * serving these files, so "a%5Cb.png" is an ordinary filename that a static host
     * serves and this worker was refusing offline. */
    if (d.indexOf('/') !== -1) return null;   /* invented separator */
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
  /* Cross-origin. Not a subtree question — but saying only that understates what
   * happens next: the fetch handler CACHES what it serves, so third-party bytes land
   * in the child's cache keyed by URL, with no allowlist. It sits awkwardly beside
   * northstar §5's third non-goal. The three CDN loads themselves are PUP-WO-0600's
   * to remove; whether a worker should cache cross-origin responses AT ALL is an
   * architect's call, raised in docs/feedback/PUP-WO-0102.md. Recorded here so the
   * behaviour is a decision rather than a side effect of a comment about scoping.
   *
   * THIS LINE DOES NOT MAKE LEAFLET WORK OFFLINE, AND AN EARLIER VERSION OF THIS
   * COMMENT SAID IT DID — "deliberate for the Map panel (leaflet must work offline;
   * invariant 3)". That was a guarantee stated at the line that would have to provide
   * it, and the line does not provide it. What happens here is OPPORTUNISTIC: a
   * cross-origin asset is cached only if some earlier ONLINE load happened to fetch
   * it successfully. It is not precached, not asserted by any check, and has no
   * fallback. urlsToCache is same-origin only.
   *
   * WHAT THAT COSTS THE CHILD, measured rather than supposed: with leaflet absent,
   * index.html:1361 appends a full-screen overlay and index.html:1368 then throws
   * `ReferenceError: L is not defined` — 182 lines before its CLOSE button is wired
   * at :1550. The overlay stays up with no listeners, CLOSE is inert, and Draw and
   * Camera stop responding because it swallows every tap. Northstar invariant 5,
   * word for word: a state that ends play with no one-tap way back.
   *
   * And the route there is ordinary rather than exotic: Chrome charges ~8 MB of quota
   * per OPAQUE entry regardless of body size, so a plain load with the map never
   * opened already costs ~25 MB, opening it once costs ~178 MB, nothing calls
   * navigator.storage.persist(), and an eviction is followed by exactly this. The
   * quota cost and the trap are one failure. PUP-WO-0106 guards the panel;
   * PUP-WO-0600 vendoring leaflet into urlsToCache dissolves it, because install
   * would then fail loudly instead of half-provisioning the device. */
  if (u.origin !== self.location.origin) return true;

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
           * until it is next loaded online (northstar invariant 3).
           *
           * ITS PRECONDITION, STATED BECAUSE IT IS NOT SELF-EVIDENT AND IS NOT
           * ENFORCED HERE. This deletion is safe only while NO OTHER LIVE COPY IS
           * STILL RUNNING THE PRE-PUP-WO-0102 WORKER. refs/heads/stable is at
           * 2952aa1 as of 2026-09-01, and that worker's cache IS LITERALLY
           * `pup-pad-v16` — so if /stable/ were ever published from it, this line
           * would delete the promoted copy's live cache, and that worker's own
           * origin-wide reap would delete this one's. Mutual destruction, which is
           * architecture §6's hazard exactly.
           *
           * It cannot happen today: Pages is build_type `legacy` serving main:/, so
           * /stable/ does not exist. It is prevented once it does by architecture
           * §5's ruling — publication refuses any copy whose worker reaps or reads
           * outside its own prefix, and check-cache-isolation.mjs prints the remedy
           * ("fast-forward `stable` before publishing it") rather than dying on a
           * ReferenceError. That refusal is PUP-WO-0103's to wire into the publish
           * job. The precondition is recorded here, at the line that depends on it,
           * so it cannot be satisfied by accident and then quietly stop being true.
           * (Raised by this work order's adversarial pass.) */
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
      /* STORE ONLY WHAT SHOULD BE STORED — PUP-WO-0105.
       *
       * fetch() RESOLVES on 4xx and 5xx; it rejects only on a network-layer
       * failure. So without this guard an HTTP error received WHILE ONLINE is
       * written over the good copy, and the offline .catch below never runs
       * because nothing rejected. './' is in urlsToCache, so the poisoned entry
       * is the app shell: one 404 reload replaced /PupPad/, and the device then
       * served the error page OFFLINE. Northstar invariants 3 and 5.
       *
       * WHY NOT `response.ok` ALONE, which is the obvious predicate — measured in
       * Chromium against this worker, not reasoned (docs/feedback/PUP-WO-0105.md):
       *     same-origin 200          ok=true   status=200  type=basic
       *     same-origin 404          ok=false  status=404  type=basic   <- the defect
       *     cross-origin opaque 200  ok=false  status=0    type=opaque  <- the Map panel
       *     cross-origin opaque 404  ok=false  status=0    type=opaque
       * `ok` is FALSE for opaque, so `ok` alone would stop caching leaflet,
       * supabase and every OpenStreetMap tile (index.html:1373) — and the Map
       * panel would lose its offline assets. That is invariant 3 traded against
       * invariant 3, which §7 makes a ruling rather than a build step.
       *
       * WHAT THIS DOES NOT FIX, stated rather than glossed: an opaque 200 and an
       * opaque 404 are INDISTINGUISHABLE — both status 0, both type opaque, both
       * with an unreadable body. No predicate can separate them, so a failed tile
       * or CDN asset is cached exactly as it is today: unchanged, not improved.
       * PUP-WO-0600 vendors those assets and dissolves the question. Do not read
       * this guard as covering the cross-origin case.
       *
       * cache.put still rejects on a non-GET request or a 206, and `ok` is true
       * for a 206 — so the .catch stays. (It does NOT reject an opaque redirect:
       * measured, `put` ACCEPTED one. That clause was inherited from the previous
       * comment and restated here while editing the very lines it describes,
       * which is architecture §5's "a wrong comment is a claim" — and the same
       * shape as sw.js's own note about a comment surviving the fix that
       * falsified it. The guard below now refuses opaqueredirect anyway, since
       * its type is 'opaqueredirect' and its `ok` is false.) The response
       * has already been returned, so there is nothing to recover, but an
       * unhandled rejection in a worker is a CI failure and an unguarded one here
       * would make routine traffic look like a defect. */
      /* WHAT THIS GUARD DOES NOT COVER — written here because the next person to
       * read it will otherwise assume it covers more, which is how the defect it
       * fixes survived a rewrite of this very handler.
       *
       * IT REFUSES AN EXPLICIT 4xx OR 5xx. That is all it can do.
       *
       * A 200 WHOSE BODY IS AN ERROR PAGE IS NOT COVERED, AND CANNOT BE BY ANY
       * STATUS TEST — it is 2xx, so `ok` is true and it is stored. A soft-404 host,
       * an SPA catch-all, an ISP interception page: all indistinguishable here from
       * the real app. Catching that class needs CONTENT validation, which is a
       * different mechanism and a different work order.
       *
       * AND `install` IS A SECOND WRITE PATH INTO THIS SAME CACHE THAT THIS GUARD
       * DOES NOT SEE. `cache.addAll(urlsToCache)` accepts any 2xx, so a soft-404
       * received during install writes the error body over the app shell through a
       * SUCCESSFUL update. Measured. It is not permanent — this handler caches any
       * `ok` response, so one healthy online load overwrites it, and recovery is no
       * worse than before this guard existed — but the guard does not stop it, and
       * an earlier draft of this comment claimed there was no residual case at all.
       *
       * The opaque arm below is a third gap and is stated at its own line. */
      if (response.ok || response.type === 'opaque') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          return cache.put(event.request, clone);
        }).catch(function() {});
      }
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
      }).then(function(hit) {
        /* A MISS MUST NOT THROW. cache.match resolves to undefined when nothing is
         * stored, and respondWith(undefined) raises "Failed to convert value to
         * 'Response'" — an uncaught exception in the worker on every offline miss.
         * No user-visible difference (the request fails either way), but check 4 now
         * fails on ANY worker exception, and on a copy whose cache is empty or was
         * just reaped EVERY request produces one. Answer with a real response. */
        return hit || new Response('', { status: 504, statusText: 'Offline and not cached' });
      });
    })
  );
});
