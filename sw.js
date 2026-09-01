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
  var path = '/';
  try {
    path = new URL(scopeUrl).pathname;
  } catch (e) {
    path = '/';
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

var SCOPE_PATH = new URL(workerScope()).pathname;
var CACHE_PREFIX = cachePrefixFor(workerScope());

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
 */
var LEGACY_CACHE_EXACT = 'pup-pad-v16';

/* === The /stable/ exclusion =============================================== */

/* The root worker's scope COVERS /stable/. Because the fetch handler below caches
 * every response it serves, the root worker can cache the promoted copy's assets
 * under the root prefix before stable's own worker ever registers — northstar
 * invariant 7 failing with disjoint cache names and a green gate. Prefix naming
 * does not address this; it is a separate mechanism (PUP-WO-0101 §1.2).
 */
var STABLE_SEGMENT = 'stable/';
var IS_STABLE_WORKER =
  SCOPE_PATH.length >= STABLE_SEGMENT.length &&
  SCOPE_PATH.slice(-STABLE_SEGMENT.length) === STABLE_SEGMENT;
var FOREIGN_SUBTREE = IS_STABLE_WORKER ? null : SCOPE_PATH + STABLE_SEGMENT;

function isForeignDeployPath(requestUrl) {
  if (FOREIGN_SUBTREE === null) return false;
  var u;
  try {
    u = new URL(requestUrl);
  } catch (e) {
    return false;
  }
  if (u.origin !== self.location.origin) return false;
  return u.pathname.indexOf(FOREIGN_SUBTREE) === 0;
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
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          /* The one exact-literal exception, documented above. */
          if (name === LEGACY_CACHE_EXACT) return true;
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
  if (isForeignDeployPath(event.request.url)) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(event.request, clone);
      });
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
