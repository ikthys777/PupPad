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
  }
  async keys() { return [...this.names]; }
  async delete(name) {
    this.deleted.push(name);
    return this.names.delete(name);
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
      addAll: async (urls) => { for (const u of urls) store.set(String(u), 'PRECACHED'); },
      add: async (u) => { store.set(String(u), 'PRECACHED'); },
      put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res); },
      match: async (req) => store.get(typeof req === 'string' ? req : req.url),
      keys: async () => [...store.keys()],
    };
  }
  /**
   * CacheStorage.match — ORIGIN-WIDE, exactly like the real one. An earlier
   * version returned undefined unconditionally, which made check 5 structurally
   * incapable of seeing a worker that READS the other deploy path's cache. The
   * reap being prefix-bounded is worth nothing if the read is not, and a stub that
   * cannot fail is not a test.
   */
  async match(req) {
    const url = typeof req === 'string' ? req : req.url;
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
