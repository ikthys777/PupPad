/**
 * Load sw.js into a sandbox that behaves enough like a ServiceWorkerGlobalScope to
 * dispatch real events at it.
 *
 * WHY BEHAVIOURAL AND NOT TEXTUAL. The defect this exists to catch — an activate
 * handler that enumerates every cache on the origin and deletes by inequality —
 * is trivially disguised by rewriting the expression. A grep for `startsWith`
 * proves a token is present, not that a foreign cache survives. So the harness
 * runs the handler against a populated origin and asks what is left.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

/** A Cache API stand-in shared across "workers", because the real one is ORIGIN-scoped. */
export class FakeCacheStorage {
  constructor(names = []) {
    this.names = new Set(names);
    this.deleted = [];
    this.entries = new Map();          // cacheName -> Map(url -> response)
    /** Every url a worker ATTEMPTED to write, in order — including refused ones. */
    this.putAttempts = [];
    /** Every entry a worker DELETED, in order. Final cache state cannot answer
     *  "was a precache entry deleted?" — addAll re-provisions them immediately, so
     *  the symptom is erased before any assertion can see it. */
    this.entryDeletes = [];
    /** When set, the store holds at most this many entries ACROSS ALL CACHES; a
     *  write beyond it throws QuotaExceededError. Capacity rather than a counter,
     *  because the install path under test RECLAIMS and RETRIES — a cumulative
     *  counter cannot express "deleting entries made room", which is the whole
     *  behaviour being asserted. Verified against Chromium: a real addAll rejects
     *  with a QuotaExceededError DOMException, and an HTTP failure with a
     *  TypeError, so the two are separable exactly as modelled here. */
    this.capacityEntries = null;
    /** URLs for which addAll should reject with a TypeError, modelling a 404 or a
     *  network drop on a precached entry. Kept DISTINCT from capacityEntries on
     *  purpose: the install path must survive a quota failure and must NOT survive
     *  this one, and a check that cannot express both cannot assert the difference. */
    this.httpFailFor = null;
    /** Base for resolving relative keys, set by loadWorker from the worker's scope.
     *
     * THE REAL CACHE API STORES RESOLVED ABSOLUTE URLS. This fake stored the raw
     * string, so `addAll(['./index.html'])` keyed the entry as `./index.html` while
     * a real browser keys it `https://…/PupPad/index.html`. Any worker that looks up
     * its own precached entries by absolute URL — which is what `cache.keys()` hands
     * back in production — therefore saw them as FOREIGN. PUP-WO-0105's reclaim did
     * exactly that and deleted the entries it was provisioning, a defect that exists
     * only in the fixture. A stub whose keys do not match the real API's cannot be
     * used to reason about key-sensitive code. */
    this.baseUrl = null;
  }
  async keys() { return [...this.names]; }
  async delete(name) {
    this.deleted.push(name);
    return this.names.delete(name);
  }
  /** Resolve a key the way the real Cache API does. */
  _key(req) {
    const raw = typeof req === 'string' ? req : req.url;
    if (!this.baseUrl) return raw;
    try { return new URL(raw, this.baseUrl).href; } catch { return raw; }
  }

  async open(name) {
    this.names.add(name);
    if (!this.entries.has(name)) this.entries.set(name, new Map());
    const store = this.entries.get(name);
    return {
      /* addAll RECORDS. It used to be `async () => {}`, which made the entire
       * precache unobservable: a worker that precached the other deploy path — a
       * direct violation of "a worker touches only what it owns" — wrote nothing
       * this harness could see, so no check could assert anything about install.
       * A stub that swallows its input cannot fail. */
      /* addAll routes through put() so write attempts are counted and a simulated
       * quota applies to the precache too — the install path PUP-WO-0105 round 3
       * is about. Real addAll is atomic; this mirrors that by staging first. */
      addAll: async (urls) => {
        const staged = [];
        let novel = 0;
        for (const u of urls) {
          const url = this._key(u);
          if (this.httpFailFor && (this.httpFailFor.has(url) || this.httpFailFor.has(String(u)))) {
            throw new TypeError("Failed to execute 'addAll' on 'Cache': Request failed");
          }
          this.putAttempts.push(url);
          /* Only keys not already present consume capacity — an overwrite costs
           * nothing, as in real storage. Counting `staged.length` charged overwrites
           * too, which made this model reject a precache that a browser accepts. */
          if (!store.has(url)) { this._admit(store, url, novel); novel++; }
          staged.push(url);
        }
        for (const url of staged) store.set(url, 'PRECACHED');
      },
      add: async (u) => { store.set(this._key(u), 'PRECACHED'); },
      /* WRITE-ATTEMPT COUNTER. PUP-WO-0105 round 1 recommended this and it was
       * recorded rather than applied; round 2 then found the vacuity it predicted.
       * Without it a check can only infer "the worker did not write" from an
       * untouched seed — which is equally true when the worker was never asked to
       * write at all, and that is how an assertion passes about an error response
       * that never existed. Counting the ATTEMPT lets a check assert the PRESENCE
       * of a refusal instead of the ABSENCE of a symptom. */
      put: async (req, res) => {
        const url = this._key(req);
        this.putAttempts.push(url);
        this._admit(store, url);
        store.set(url, res);
      },
      match: async (req) => store.get(this._key(req)),
      /* Cache.delete — ABSENT UNTIL PUP-WO-0105 round 3, and its absence meant no
       * check could exercise a worker that deletes a single ENTRY. The reap deletes
       * whole caches (CacheStorage.delete, which did exist), so nothing had needed
       * it; the moment the install path reclaimed entries, every such worker died on
       * `cache.delete is not a function` — a stub that cannot represent the operation
       * at all, which is the same fixture-shape blindness this work order is about.
       * Found by an assertion that needed it, not by an audit. */
      delete: async (req) => {
        const k = this._key(req);
        this.entryDeletes.push(k);          // see putAttempts: assert the act, not the residue
        return store.delete(k);
      },
      /* REQUEST-LIKE, NOT BARE STRINGS. Real Cache.keys() resolves to Request
       * objects; this returned strings, so any worker reading `req.url` from them
       * got `undefined`. PUP-WO-0105's reclaim compares `req.url` against its
       * keep-list, so in the sandbox THE KEEP-LIST MATCHED NOTHING and the reclaim
       * deleted every precache entry — while the assertion guarding that bound
       * still printed ok, because addAll re-provisioned them a moment later.
       *
       * The comment above about `_key` claims this defect class was fixed. `_key`
       * was fixed; `keys()` was not. A comment claiming coverage it does not have,
       * in the fixture written to stop exactly that. */
      keys: async () => [...store.keys()].map((url) => ({ url })),
    };
  }
  /** Total entries across every cache — quota is per ORIGIN, not per cache. */
  _size() { let n = 0; for (const [, st] of this.entries) n += st.size; return n; }

  /** Throw QuotaExceededError if admitting one more entry would exceed capacity.
   *
   *  AN OVERWRITE IS TREATED AS FREE HERE AND THAT IS NOT WHAT A BROWSER DOES.
   *  Measured in Chromium with the quota capped at usage+8KB: writing 2 MB over a
   *  1-byte entry REJECTS with QuotaExceededError. A real quota charges the new body,
   *  not the delta. An earlier version of this comment claimed the opposite as if it
   *  had been measured; it had not. The simplification is kept because this model
   *  counts ENTRIES rather than bytes and cannot express a size at all — which is
   *  itself the limit worth knowing: no defect whose trigger is SIZE is visible here.
   *  PUP-WO-0108 needs a byte-aware model. */
  _admit(store, url, pending = 0) {
    if (this.capacityEntries === null) return;
    if (store.has(url)) return;
    if (this._size() + pending + 1 > this.capacityEntries) {
      const e = new Error('Quota exceeded.'); e.name = 'QuotaExceededError'; throw e;
    }
  }

  /**
   * CacheStorage.match — ORIGIN-WIDE, exactly like the real one. An earlier
   * version returned undefined unconditionally, which made check 5 structurally
   * incapable of seeing a worker that READS the other deploy path's cache. The
   * reap being prefix-bounded is worth nothing if the read is not, and a stub that
   * cannot fail is not a test.
   */
  async match(req) {
    const url = this._key(req);
    for (const [, store] of this.entries) if (store.has(url)) return store.get(url);
    return undefined;
  }
}

/**
 * F4 — A REQUEST STUB THAT CAN EXPRESS THE INPUT CLASSES A REAL REQUEST HAS.
 *
 * Every fake request used to be `{ url }` and nothing else. So a worker branching on
 * `request.mode`, `request.method` or `request.destination` was structurally
 * INVISIBLE to the sandbox — not a stub returning a wrong value, but a stub that
 * cannot represent the input at all. One clause,
 *
 *     if (!servesRequest(event.request.url) && event.request.mode !== 'navigate')
 *
 * exempts top-level navigations from the /stable/ decline, caches the promoted
 * copy's document under the root prefix, and passes all six checks.
 *
 * Defaults match what a browser sends for a subresource GET; a caller overrides only
 * what it is probing.
 */
export function swRequest(url, opts = {}) {
  return {
    url,
    method: 'GET',
    mode: 'no-cors',
    destination: '',
    credentials: 'same-origin',
    headers: new Map(),
    ...opts,
  };
}

/** The request shapes a worker must treat identically. Used to sweep every rule. */
export const REQUEST_SHAPES = [
  ['a subresource GET', {}],
  ['a top-level navigation', { mode: 'navigate', destination: 'document' }],
  ['a same-origin cors request', { mode: 'cors' }],
  ['a script subresource', { destination: 'script' }],
  ['a POST', { method: 'POST' }],
  ['a prefetch', { destination: 'empty', mode: 'cors' }],
];

/**
 * @param {string} swPath   path to sw.js
 * @param {string} scope    the worker's registration scope URL
 * @param {FakeCacheStorage} cacheStorage  shared across both workers on purpose
 */
export function loadWorker(swPath, scope, cacheStorage, extraGlobals = {}) {
  const listeners = new Map();
  const origin = new URL(scope).origin;

  const self = {
    location: { href: new URL('sw.js', scope).href, origin },
    registration: { scope },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };

  /* F6 — THE NETWORK FIXTURE IS OBSERVABLE, because it silently gated the headline
   * assertion. `fetch` rejecting is what forces the worker down its offline branch,
   * and that branch is the ONLY path the origin-wide-read assertion exercises. If
   * fetch resolved, the worker returned the network response, the offline branch
   * never ran, and the assertion passed because nothing happened — indistinguishable
   * from passing because the read was correctly scoped.
   *
   * It was not among the six stubs audited, and the reason it escaped is worth
   * keeping: the rule was "audit the stubs whose DEGENERATE value is also a
   * legitimate one", and a RESOLVING fetch is not degenerate at all — it is what an
   * online browser hands the worker on every request. The dangerous value here is
   * the NORMAL one. A caller can now assert the fixture actually fired. */
  const network = { attempted: 0, rejected: 0 };
  const sandbox = {
    self, caches: cacheStorage, URL, console,
    fetch: async () => {
      network.attempted++; network.rejected++;
      throw new Error('network disabled in harness');
    },
    Promise, Response: globalThis.Response, Request: globalThis.Request,
    /* TIMERS ARE PRESENT ON PURPOSE, and their absence was a hole.
     *
     * A real ServiceWorkerGlobalScope has them, so a worker may schedule a reap on
     * a timer — outside waitUntil, where the browser does not guarantee it stays
     * alive to finish (finding F9). Without setTimeout in this sandbox such a
     * worker dies on a ReferenceError instead of being EVALUATED, which means the
     * check could not have observed the defect it screens for: the same shape as
     * the stub that returned undefined unconditionally (architecture §6.1). A
     * sandbox that cannot host the defect is not a sandbox for it. */
    setTimeout, clearTimeout, setInterval, clearInterval,
    /* extraGlobals lets a caller evaluate the SAME source under a different
     * environment — used by check 3 to prove the cache identity does not depend on
     * which environment is reading it. Spread last so a caller can also override a
     * default deliberately. */
    ...extraGlobals,
  };
  /* Give the fake cache the worker's scope so its keys resolve like the real API's. */
  if (cacheStorage && cacheStorage.baseUrl == null) cacheStorage.baseUrl = scope;
  sandbox.self.self = sandbox.self;
  vm.createContext(sandbox);
  new vm.Script(readFileSync(swPath, 'utf8'), { filename: swPath }).runInContext(sandbox);

  return {
    sandbox,
    /** Dispatch an event and await whatever the handler passed to waitUntil. */
    async dispatch(type, event = {}) {
      const waits = [];
      const responses = [];
      const ev = {
        ...event,
        waitUntil: (p) => waits.push(p),
        respondWith: (p) => responses.push(p),
      };
      for (const fn of listeners.get(type) || []) await fn(ev);
      await Promise.all(waits);
      return { respondWithCalled: responses.length > 0, responses };
    },
    /** Read a top-level binding out of the loaded worker. */
    get(name) { return vm.runInContext(name, sandbox); },
    /** What the network fixture actually did — so a check can prove it fired. */
    network() { return { ...network }; },
  };
}
