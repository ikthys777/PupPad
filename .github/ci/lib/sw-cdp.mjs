/**
 * Observe a service worker's console errors and uncaught exceptions over raw CDP.
 *
 * WHY RAW, AND NOT PLAYWRIGHT. PUP-WO-0100 recorded three dead ends against
 * Playwright 1.56.1 and this exists because of them:
 *   worker.on('console')             — not an API on ServiceWorker
 *   context.on('console'|'weberror') — delivers page output only; verified silent
 *                                      for a console.error and a throw inside sw.js
 *   CDPSession.send(method, params)  — takes no sessionId, so browser-level
 *                                      Target.setAutoAttach attaches to the worker
 *                                      target but no domain command can be ROUTED
 *                                      to that session
 * A raw WebSocket to the browser endpoint can carry the sessionId, which is the
 * one thing the wrapper cannot do. Node 24 has a global WebSocket, so this adds no
 * dependency.
 *
 * The cost, stated: the browser must be launched with --remote-debugging-port, and
 * targets are auto-attached PAUSED. Every non-worker target must be released
 * immediately or the page never navigates.
 */

export async function attachServiceWorkerWatcher(port, { onError, originPrefix }) {
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('could not open a CDP socket')), { once: true });
  });

  let id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
    });

  const workerSessions = new Set();   // sessionId -> still open
  const workerUrls = new Map();       // sessionId -> the worker's real script URL
  let socketClosed = false;
  /* Findings 12 and 13: the handshake handlers below are {once:true}, so without
   * these a socket that drops mid-run leaves sessionCount() reporting the
   * sessions it saw ONCE and the run passing as though observation were live. */
  ws.addEventListener('close', () => { socketClosed = true; });
  ws.addEventListener('error', () => { socketClosed = true; });

  ws.addEventListener('message', (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }

    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      return m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }

    if (m.method === 'Target.attachedToTarget') {
      const sid = m.params.sessionId;
      const info = m.params.targetInfo;
      if (info.type === 'service_worker') {
        /* Finding 17: attribute by the worker's real URL, not a hardcoded name.
         * Combined with finding 12, a foreign browser's worker would otherwise be
         * reported as PupPad's own sw.js — misclassification toward green. */
        workerSessions.add(sid);
        workerUrls.set(sid, info.url || '(unknown worker)');
        send('Runtime.enable', {}, sid)
          .then(() => send('Log.enable', {}, sid).catch(() => {}))   /* finding 18: Log.entryAdded */
          .catch((e) => onError({ kind: 'harness', where: 'sw-cdp', text: `Runtime.enable failed: ${e.message}` }))
          .finally(() => send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {}));
      } else {
        // Release every other paused target, or navigation deadlocks.
        send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
      }
      return;
    }

    if (!m.sessionId || !workerSessions.has(m.sessionId)) return;

    const where = workerUrls.get(m.sessionId) || '(worker)';
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      onError({
        kind: 'service worker console.error',
        where,
        text: (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').trim(),
      });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      onError({
        kind: 'service worker uncaught exception',
        where,
        text: (d.exception?.description || d.text || 'uncaught exception').split('\n')[0],
      });
    }
    if (m.method === 'Log.entryAdded' && m.params.entry?.level === 'error') {
      onError({ kind: 'service worker log error', where, text: m.params.entry.text || '' });
    }
  });

  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

  return {
    close: () => { try { ws.close(); } catch {} },
    sessionCount: () => workerSessions.size,
    workerUrls: () => [...workerUrls.values()],

    /**
     * FINDINGS 12 AND 13 — the guarantee this watcher is supposed to provide.
     *
     * `sessionCount() > 0` proves an attach HAPPENED. It does not prove the
     * socket was still live, nor that it was pointed at the browser under test:
     * the debug port is a TCP port like any other, so a concurrent run, an
     * orphaned Chromium, or a developer's browser could answer instead — and the
     * run would print "1 session watched" as evidence it was looking while a
     * broken worker went green.
     *
     * So this asserts both, at the END of the observation window:
     *   - the socket is still open and answering;
     *   - the browser it answers for is OURS, proven by a live target carrying
     *     the run's unique origin (a random port, so no other browser has it);
     *   - each worker session still responds to a round-trip.
     */
    async assertLiveAndOurs() {
      if (socketClosed) throw new Error('the CDP socket closed during the run — observation was not live');
      let targets;
      try {
        ({ targetInfos: targets } = await send('Target.getTargets'));
      } catch (e) {
        throw new Error(`the CDP socket stopped answering: ${e.message}`);
      }
      if (originPrefix && !targets.some((t) => (t.url || '').startsWith(originPrefix))) {
        throw new Error(
          `the CDP endpoint is not the browser under test — no target carries ${originPrefix}. ` +
          'Another Chromium answered on this debug port.');
      }
      for (const sid of workerSessions) {
        try {
          await send('Runtime.evaluate', { expression: '1', returnByValue: true }, sid);
        } catch (e) {
          throw new Error(`worker session for ${workerUrls.get(sid)} stopped answering: ${e.message}`);
        }
      }
    },
  };
}
