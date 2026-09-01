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
      addAll: async () => {},
      put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res); },
      match: async (req) => store.get(typeof req === 'string' ? req : req.url),
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
 * @param {string} swPath   path to sw.js
 * @param {string} scope    the worker's registration scope URL
 * @param {FakeCacheStorage} cacheStorage  shared across both workers on purpose
 */
export function loadWorker(swPath, scope, cacheStorage) {
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

  const sandbox = {
    self, caches: cacheStorage, URL, console,
    fetch: async () => { throw new Error('network disabled in harness'); },
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
  };
}
