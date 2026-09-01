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

export async function attachServiceWorkerWatcher(port, { onError }) {
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

  const workerSessions = new Set();

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
        workerSessions.add(sid);
        send('Runtime.enable', {}, sid)
          .catch((e) => onError({ kind: 'harness', where: 'sw-cdp', text: `Runtime.enable failed: ${e.message}` }))
          .finally(() => send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {}));
      } else {
        // Release every other paused target, or navigation deadlocks.
        send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
      }
      return;
    }

    if (!m.sessionId || !workerSessions.has(m.sessionId)) return;

    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      onError({
        kind: 'service worker console.error',
        where: 'sw.js',
        text: (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').trim(),
      });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      onError({
        kind: 'service worker uncaught exception',
        where: 'sw.js',
        text: (d.exception?.description || d.text || 'uncaught exception').split('\n')[0],
      });
    }
  });

  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  return { close: () => { try { ws.close(); } catch {} }, sessionCount: () => workerSessions.size };
}
