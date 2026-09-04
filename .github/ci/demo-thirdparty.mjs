#!/usr/bin/env node
/**
 * CHECK 27 — the third-party allowlist.  PUP-WO-0705 §1.
 *
 * NAMED `demo-` RATHER THAN `check-`, AND THAT IS NOT COSMETIC. Check 25 derives the set
 * it enforces from `demo-*.mjs`, so a `check-*.mjs` file is NOT graded for registration —
 * and acceptance §6 of this work order assumes it would be. Every `check-*.mjs` in the
 * directory happens to be registered today, so that is a latent gap rather than a live
 * defect; it is raised in docs/feedback/PUP-WO-0705.md rather than widened here, because
 * changing what check 25 grades is its own change with its own controls. This file drives
 * a browser, which is what `demo-` means in this directory, so the convention and the
 * enforcement agree.
 *
 * WHAT THIS IS. Scotty ruled on 2026-09-04 that the Map panel's OpenStreetMap basemap
 * STAYS, knowingly, against three costed alternatives, and the northstar carries that as a
 * NAMED EXCEPTION to invariant 3 and to the third-party non-goal rather than as a
 * contradiction. THIS FILE IS THE OTHER HALF OF THAT RULING. Until the exception lives in
 * a mechanism, nothing distinguishes the approved origin from a new one, and nothing stops
 * a SECOND arriving — which is the failure the amendment itself names: a rule that lives
 * only in prose decays, and the decay is either a check that reds on approved behaviour or
 * a future builder who reads the invariant, sees the map contradicting it, and FIXES THE
 * MAP.
 *
 * IT MEASURES EGRESS AND MUST NOT PERFORM IT. Every non-local request is intercepted and
 * ABORTED. The check learns which origins the app WOULD contact without contacting one of
 * them, which also means it runs identically on a machine with no network — and a check
 * about third-party contact that itself makes third-party contact would be a fine joke to
 * find in a child's repository.
 *
 * THE ALLOWLIST IS DECLARED ONCE, BELOW, AND CITED. Two copies of an allowlist drift and
 * then one is wrong while both look authoritative — so the controls file does not restate
 * it, it asserts against this file's OUTPUT.
 *
 * ORIGINS ARE MATCHED BY AN ANCHORED HOSTNAME TEST, NEVER BY SUBSTRING. A substring rule
 * spelled `includes('openstreetmap.org')` is satisfied by
 * `evil-openstreetmap.org.attacker.net`, which is a real shape of attack and not a
 * hypothetical one. Every predicate here is `^...$`.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve, normalize } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(import.meta.dirname, '..', '..'));

/* FAILS CLOSED ON A TREE IT CANNOT NAME. Architecture §5: every demonstration asserts the
 * commit it ran against. PUPPAD_SUBJECT lets a `git archive` export — which the freeze
 * protocol hands a read-only adversarial pass — state its own subject. */
let COMMIT = process.env.PUPPAD_SUBJECT || '';
if (!COMMIT) {
  try { COMMIT = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
}
if (!/^[0-9a-f]{7,40}$/.test(COMMIT)) {
  console.error('::error::CHECK 27 cannot identify the commit it is testing.');
  console.error('  Run it inside the repository, or set PUPPAD_SUBJECT=<sha>.');
  process.exit(1);
}

/* ================================================================= *
 * THE ALLOWLIST. ONE DECLARATION. NOTHING ELSE IN THE REPOSITORY RESTATES IT.
 * ================================================================= */

/* EVERY PREDICATE TESTS A FULL ORIGIN — SCHEME, HOST AND PORT — AND THE FIRST VERSION
 * TESTED A HOSTNAME. The word "origin" is what the work order, the northstar and this
 * file's own header all say, and matching only the host quietly cleared two different
 * facts: `http://cdnjs.cloudflare.com/beacon.gif` (a PLAINTEXT downgrade from a child's
 * app, which is not the same security fact as the https one that was recorded) and
 * `https://cdn.jsdelivr.net:8443/beacon.gif` (a different service on a different port).
 * Both measured GREEN before this change. `new URL(u).origin` normalises case and drops
 * the default port, so these anchors are exact. */

/* RATIFIED — owner-approved, with the date the northstar records. */
const RATIFIED = [
  {
    label: 'https://{a,b,c}.tile.openstreetmap.org',
    /* Leaflet expands `{s}` to a/b/c, so three origins are one exception in intent. The
     * test is anchored at both ends: `evil-openstreetmap.org.attacker.net` fails it, and
     * so does `tile.openstreetmap.org.attacker.net`. */
    test: (o) => /^https:\/\/[a-c]\.tile\.openstreetmap\.org$/.test(o),
    date: '2026-09-04',
    why: 'the Map panel basemap — northstar invariant 3 and §5, ONE named exception, ruled by Scotty against three costed alternatives',
  },
];

/* UNRATIFIED — present in the shipped app, contacted on EVERY cold load before a child
 * touches anything, and NOBODY HAS RULED ON EITHER. Architecture §10 keeps the question
 * open and it is Scotty's, not this file's and not the builder's.
 *
 * THEY ARE LISTED SO THEY CANNOT BE FORGOTTEN, NOT SO THEY ARE APPROVED. Listing them is
 * what keeps this check GREEN on `main` — and the northstar's own amendment is the
 * argument for that: "a faithful check enforcing invariant 3 would go RED on approved
 * behaviour, and a red that is not a defect is how a suite gets ignored." A check that is
 * red from the day it lands teaches people to ignore it.
 *
 * SO THE PRICE OF LISTING THEM IS PAID ON EVERY RUN: the pass line NAMES them as OWED. A
 * reader of a green build learns that two origins are unruled; they do not have to open a
 * document to find out.
 *
 * AND THE MEASURED FACT THAT MAKES THIS MORE THAN BOOKKEEPING: with these two blocked,
 * opening the Map panel raises `L is not defined`, because the basemap is built by
 * `L.tileLayer(...)` at index.html:3227. THE EXCEPTION SCOTTY RATIFIED CANNOT FUNCTION
 * WITHOUT AN ORIGIN NOBODY RATIFIED. Ratifying the basemap implicitly ratified
 * cdnjs.cloudflare.com, and that is a decision he may not know he made. */
const UNRATIFIED = [
  { label: 'https://cdnjs.cloudflare.com', test: (o) => /^https:\/\/cdnjs\.cloudflare\.com$/.test(o),
    why: 'Leaflet 1.9.4 CSS and JS, index.html:12-13 — loaded on every cold start, and the ratified basemap DEPENDS ON IT' },
  { label: 'https://cdn.jsdelivr.net', test: (o) => /^https:\/\/cdn\.jsdelivr\.net$/.test(o),
    why: 'supabase-js v2 UMD, index.html:11 — loaded on every cold start whether or not a Supabase URL is configured' },
];

const ALLOWED = [...RATIFIED, ...UNRATIFIED];
const classify = (origin) => {
  for (const e of RATIFIED) if (e.test(origin)) return { kind: 'ratified', e };
  for (const e of UNRATIFIED) if (e.test(origin)) return { kind: 'unratified', e };
  return { kind: 'UNKNOWN', e: null };
};

/* THE INSTRUMENT'S OWN WITNESS. An origin nothing in the app will ever contact, fetched
 * deliberately so the recorder can be shown to work before any verdict rests on it. A
 * check that passes because NOTHING was fetched looks exactly like one that passes because
 * only allowed things were — see §2. `.invalid` is reserved by RFC 2606 and can never
 * resolve, and the request is aborted like every other. */
const WITNESS = 'https://puppad-ci-witness.invalid/probe';

const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, d) => { failures.push({ m, d }); console.log(`  FAIL  ${m}`); if (d) console.log(`        ${d}`); };
const info = (m) => console.log(`  ....  ${m}`);

const ONLY = (() => {
  const a = process.argv.find((x) => x.startsWith('--only='));
  return a ? new Set(a.slice(7).split(',').map(Number)) : null;
})();
const want = (n) => !ONLY || ONLY.has(n);
let asserted = 0;
const count = (f) => (...a) => { asserted++; return f(...a); };
const OK = count(ok), BAD = count(bad);

console.log(`CHECK 27 — the third-party allowlist. subject ${COMMIT.slice(0, 12)}\n`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const full = join(REPO, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
    await stat(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
       .end(await readFile(full));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const LOCAL = `http://127.0.0.1:${server.address().port}`;

const PADS = [[0, 'Voice'], [1, 'Map'], [2, 'Draw'], [3, 'Alert'], [4, 'Tools'], [5, 'Weather'], [6, 'Camera'], [7, 'Games']];

/* ONE DRIVE, SHARED BY §1 AND §2, AND THE FIRST VERSION OF THIS COMMENT SAID THE
 * OPPOSITE. It claimed "every section that needs the recorder builds its own context and
 * tears it down, so `--only` is the same measurement as a full run" — there is one
 * `drive()` call, one context, and `--only` was NOT the same measurement: §1's guards
 * lived in §2 and were skipped. A sentence asserting the acceptance criterion it sits
 * above, while the code did not meet it.
 *
 * It is one drive on purpose — walking eight pads twice doubles the slowest thing here —
 * and the guards are now computed OUTSIDE both sections, so §1 refuses to report when the
 * walk did not happen no matter which sections were selected. §3 needs no browser at all
 * and runs outside this block. */
async function drive(browser) {
  /* `serviceWorkers: 'block'` IS LOAD-BEARING AND THE WITNESS IS WHAT FOUND IT.
   *
   * PupPad is a PWA and its worker claims CROSS-ORIGIN requests too — `servesRequest`
   * returns true for them, deliberately, so third-party bytes land in the cache. AND
   * PLAYWRIGHT'S `context.route` DOES NOT INTERCEPT REQUESTS MADE BY A SERVICE WORKER
   * unless workers are blocked. So with the worker running, this recorder sees only what
   * the page issues before the worker takes control, and everything the worker fetches —
   * which is where the third-party traffic ends up on a warm load — IS INVISIBLE TO IT.
   *
   * Measured, both ways, on this app: with workers allowed the recorder saw 3 requests and
   * DID NOT SEE ITS OWN WITNESS. With workers blocked it saw 4, the witness among them.
   * An egress check that under-reports egress is the exact false green this project has
   * spent two work orders removing, and the only reason it was caught here is that the
   * instrument was made to prove it could see before anything rested on it.
   *
   * Blocking is also the RIGHT question rather than merely the answerable one: it forces
   * a cold cache, so this enumerates every origin the app would contact on a child's first
   * open, with nothing masked by something an earlier online session happened to store. */
  const ctx = await browser.newContext({ viewport: { width: 869, height: 412 }, hasTouch: true, serviceWorkers: 'block' });
  const seen = [];
  let phase = 'cold load';
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    /* BY ORIGIN, NOT BY PREFIX. `url.startsWith(LOCAL)` was the one substring test in a
     * file whose header forbids substring tests, and
     * `http://127.0.0.1:PORT@evil.example/x` starts with it. Chromium blocks embedded
     * credentials in subresources so I could not get a request through it — latent, not
     * live, and fixed anyway because the next reader should not have to re-derive that. */
    let origin;
    try { origin = new URL(url).origin; } catch { origin = null; }
    if (origin === LOCAL || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    seen.push({ origin: origin === null ? url : origin, url, phase, kind: route.request().resourceType() });
    return route.abort();   /* measured, never performed */
  });
  /* A WEBSOCKET IS NOT A REQUEST `route` CAN SEE, AND THIS FILE WAS PERFORMING THEM.
   * `context.route` does not intercept a WebSocket handshake. Measured: a planted
   * `new WebSocket('wss://realtime.example.net/socket')` was recorded NOWHERE, the check
   * printed PASSED — and a listener on the far end RECEIVED THE UPGRADE. So the header's
   * claim that every non-local request is intercepted and aborted was false, and the one
   * exception is the kind supabase-js realtime uses for the canvas, voice, map and camera
   * channels: `wss://<project>.supabase.co`.
   *
   * The witness proved the recorder sees a `fetch`. It could not prove the recorder sees
   * the KINDS THIS APP MAKES, which is a different claim — so `WebSocket` is replaced
   * before any page script runs, with a constructor that RECORDS AND REFUSES TO CONNECT.
   * Aborting is the same treatment every other third-party request gets. */
  await ctx.addInitScript(() => {
    const Real = window.WebSocket;
    window.__wsAttempts = [];
    function Recorded(url, protocols) {
      try { window.__wsAttempts.push(String(url)); } catch (e) {}
      if (String(url).startsWith('ws://127.0.0.1') || String(url).startsWith('ws://localhost')) {
        return protocols === undefined ? new Real(url) : new Real(url, protocols);
      }
      /* Not connected. The check measures egress and must not perform it. */
      throw new DOMException('blocked by check 27', 'SecurityError');
    }
    Recorded.prototype = Real.prototype;
    for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) Recorded[k] = Real[k];
    window.WebSocket = Recorded;
  });

  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const tap = async (sel) => {
    const r = await page.evaluate((q) => {
      const e = document.querySelector(q); if (!e) return null;
      const b = e.getBoundingClientRect();
      if (!(b.width > 0 && b.height > 0)) return null;
      return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    }, sel);
    if (!r) return false;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.cx, y: r.cy, id: 1 }] });
    await page.waitForTimeout(25);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(350);
    return true;
  };

  await page.goto(LOCAL + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.waitForSelector('.pad-btn[data-id="0"]', { timeout: 20000 });

  /* THE APP'S OWN REACTION, OBSERVED. Every pad handler calls `doSound(btn.sound)` before
   * it does anything else, so a recorded cue is proof the handler RAN — which is what
   * "the walk really happened" needs, and it does not drift the way a pasted list of
   * which pads open a surface would. Three pads (Alert, Tools, Weather) open nothing by
   * design; asserting an overlay for all eight graded the app against a wrong idea of it,
   * which is what the first version of this section did. */
  await page.evaluate(() => {
    window.__pad = [];
    const real = window.doSound;
    window.doSound = function (n) { window.__pad.push(n); try { return real.apply(this, arguments); } catch (e) {} };
  });

  /* THE WITNESS FIRES BEFORE ANY VERDICT DEPENDS ON THE RECORDER. */
  phase = 'instrument witness';
  await page.evaluate((u) => fetch(u).catch(() => {}), WITNESS);
  await page.waitForTimeout(250);

  const opened = [];
  for (const [id, label] of PADS) {
    phase = `pad ${id} (${label})`;
    /* THE DELTA FOR THIS PAD, NOT A RUNNING TOTAL. The first version asserted that the
     * cumulative cue count reached eight, and the control planted to break every pad
     * handler still passed it — the console plays cues for other things, so the total
     * cleared the bar with not one pad handler having run. A count that can be satisfied
     * by something other than its subject is not a measurement of its subject. */
    const cuesBefore = await page.evaluate(() => (window.__pad || []).length);
    const tapped = await tap(`.pad-btn[data-id="${id}"]`);
    await page.waitForTimeout(700);
    /* Did anything actually open? "No new origin" is what a pad that never opened
     * reports too, which is the arrange failing silently — §2 asserts on this. */
    const grew = await page.evaluate(() => document.querySelectorAll('[id$="Overlay"], .overlay, #gameHost').length);
    const cues = await page.evaluate(() => (window.__pad || []).length);
    opened.push({ id, label, tapped, grew, cues, delta: cues - cuesBefore });
    await page.evaluate(() => {
      for (const f of ['closeVoice', 'closeCanvas', 'closeCamera', 'closeTreasureMap', 'closeGames', 'closeGamePicker'])
        { try { if (typeof window[f] === 'function') window[f](); } catch (e) {} }
    });
    await page.waitForTimeout(200);
  }
  /* Fold the WebSocket attempts into the same record, so one verdict covers both. */
  const ws = await page.evaluate(() => (window.__wsAttempts || []).slice()).catch(() => []);
  for (const u of ws) {
    let origin; try { origin = new URL(u).origin; } catch { origin = u; }
    /* `wss://host` and `https://host` are the same origin for an allowlist's purpose —
     * the question is who is being contacted, not over which protocol family. */
    const asHttp = origin.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    seen.push({ origin: asHttp, url: u, phase: 'websocket', kind: 'websocket' });
  }
  await ctx.close();
  return { seen, opened };
}

const browser = await chromium.launch({ channel: 'chromium' });
try {
  /* ---------------------------------------------------------------- */
  if (want(1) || want(2)) {
    const { seen, opened } = await drive(browser);
    const witnessHits = seen.filter((s) => s.origin === 'https://puppad-ci-witness.invalid');
    const real = seen.filter((s) => s.origin !== 'https://puppad-ci-witness.invalid');
    /* THE GUARDS ARE COMPUTED HERE, OUTSIDE ANY SECTION, BECAUSE §1 NEEDS THEM AND
     * `--only=1` DOES NOT RUN §2. In the first version they lived inside `if (want(2))`,
     * so `--only=1` printed §1's green line for an app whose pad handlers never ran, and
     * for one that fetched nothing at all — and the controls file runs every scenario
     * with `--only=<section>`, so its GREEN control was graded in exactly the mode where
     * "only allowed things were fetched" and "nothing was fetched" are the same result.
     * A witness inherited from a neighbour is not a witness; one a flag skipped is worse. */
    const unvisited = opened.filter((o) => !(o.tapped && o.delta > 0));
    const guard = !witnessHits.length
      ? { m: 'the recorder never saw its own witness', d: 'the route handler is not installed, so an empty result means NOTHING — not "no third party was contacted"' }
      : unvisited.length
        ? { m: `the walk did not happen: ${unvisited.length} of ${PADS.length} pads were never visited`,
            d: `${unvisited.map((o) => `${o.id} ${o.label}`).join(', ')} — a pad that was never visited contacts no new origin, which is exactly what a clean result looks like` }
        : null;

    if (want(2)) {
      console.log('--- 2. the instrument can see, and the drive actually happened ---');
      /* AN INSTRUMENT MUST DEMONSTRATE IT WOULD HAVE SEEN THE THING. A recorder that is
       * never installed reports the same empty set as an app that contacts nobody, and
       * the second is the verdict this file exists to give. */
      if (!witnessHits.length) BAD('the recorder never saw its own witness request',
        `nothing at ${WITNESS} was intercepted, so the route handler is not installed and an empty result below would mean NOTHING — not "no third party was contacted"`);
      else OK(`the recorder sees egress: its own witness to an origin the app never uses was intercepted ${witnessHits.length} time(s) and aborted`);

      const missed = opened.filter((o) => !o.tapped);
      const silent = opened.filter((o) => !(o.delta > 0));
      const totalCues = opened.length ? opened[opened.length - 1].cues : 0;
      const map = opened.find((o) => o.id === 1);
      if (missed.length) BAD(`${missed.length} of ${PADS.length} pads could not be pressed`,
        `${missed.map((m) => `${m.id} ${m.label}`).join(', ')} — a pad that never opened contacts no new origin, which is exactly what a clean result looks like`);
      else if (silent.length) BAD(`${silent.length} of ${PADS.length} pad handlers made no sound of their own`,
        `${silent.map((o) => `${o.id} ${o.label}`).join(', ')} — every pad handler plays a cue before it does anything else, so a pad whose tap produced NO new cue was never actually visited, and "no unapproved origin" is exactly what an app nobody exercised reports`);
      else if (!map || !(map.grew > 0)) BAD('the Map pad was pressed and no surface opened',
        'the Map panel is the one pad whose origin this check exists for — if it did not open, the basemap could not have been requested and a clean result below means nothing');
      else OK(`all ${PADS.length} pads pressed with a finger, EACH producing at least one new cue of its own from the app's doSound (${totalCues} in total, since panels make their own too), and the Map panel opened — the walk is real, not an empty set wearing a green label`);
    }

    if (want(1)) {
      console.log('--- 1. every origin the app contacts is on the declared allowlist ---');
      const byHost = new Map();
      for (const s of real) {
        if (!byHost.has(s.origin)) byHost.set(s.origin, { n: 0, phases: new Set(), sample: s.url.slice(0, 100) });
        const e = byHost.get(s.origin); e.n++; e.phases.add(s.phase);
      }
      const unknown = [...byHost.keys()].filter((h) => classify(h).kind === 'UNKNOWN');
      const ratifiedSeen = [...byHost.keys()].filter((h) => classify(h).kind === 'ratified');
      const unratifiedSeen = [...byHost.keys()].filter((h) => classify(h).kind === 'unratified');

      if (guard) BAD(`§1 cannot report — ${guard.m}`, guard.d);
      else if (unknown.length) BAD(`${unknown.length} third-party origin(s) NOT on the allowlist: ${unknown.join(', ')}`,
        unknown.map((h) => {
          const e = byHost.get(h);
          return `${h} — ${e.n} request(s), first on "${[...e.phases][0]}", e.g. ${e.sample}`;
        }).join('\n        ')
        + '\n        The allowlist is ONE named exception (northstar invariant 3 and §5, ruled 2026-09-04) plus two recorded-but-UNRATIFIED CDNs. A new origin is not covered by any of them, and "no second exception" is the amendment\'s own wording.');
      else {
        /* THE RATIFIED ORIGIN IS NEVER CONTACTED IN THIS ENVIRONMENT, AND THAT IS THE
         * FINDING RATHER THAN A HOLE. Leaflet is aborted like every other third-party
         * request, `L` is therefore undefined, and `openTreasureMap` throws at
         * `L.map(...)` before it ever reaches `L.tileLayer`. So the tile origin cannot be
         * observed here — the ratified exception is downstream of an unratified one. The
         * allowlist entry for it is exercised by §3 against the predicate rather than
         * against live traffic, which is stated here instead of being papered over with a
         * fabricated Leaflet that would make this check green on traffic the app did not
         * make. */
        const rl = ratifiedSeen.length ? ratifiedSeen.join(', ') : 'NOT CONTACTED — Leaflet is blocked like every third party, so L is undefined and the Map panel throws before requesting a tile; the ratified origin is downstream of an unratified one';
        const ul = unratifiedSeen.length ? unratifiedSeen.join(', ') : 'none contacted in this run';
        OK(`every origin contacted is on the allowlist — RATIFIED: ${RATIFIED.map((e) => `${e.label} (${e.date}, ${e.why.split(' — ')[0]})`).join('; ')} [seen: ${rl}]. UNRATIFIED AND OWED, nobody has ruled on either: ${UNRATIFIED.map((e) => e.label).join(', ')} [seen: ${ul}]`);
        info('a green run means "only these", not "none" — the two UNRATIFIED origins above are shipped behaviour that no owner has approved (architecture §10), and the ratified basemap CANNOT LOAD without the first of them');
      }
    }

  }
  /* §3 IS PURE LOGIC AND NEEDS NO BROWSER, so it lives outside the drive block: it was
   * paying fifteen seconds for a walk it does not use, and a Chromium that failed to
   * start would have reddened a section about a regular expression. */
  if (want(3)) {
    console.log('--- 3. the allowlist matches an ORIGIN, never a substring of one ---');
    /* `evil-openstreetmap.org.attacker.net` contains the approved name. A rule written
     * with `includes` clears it. Every predicate in the declaration is anchored, and
     * this asserts that property against the predicates themselves rather than trusting
     * that whoever writes the next one remembers. */
    const HOSTILE = [
      /* the approved name is CONTAINED but the origin is somebody else's */
      'https://evil-openstreetmap.org.attacker.net',
      'https://tile.openstreetmap.org.attacker.net',
      'https://atile.openstreetmap.org',
      'https://cdnjs.cloudflare.com.attacker.net',
      'https://notcdn.jsdelivr.net',
      'https://a.tile.openstreetmap.org.evil.test',
      /* AND THE THREE THE ADVERSARIAL PASS FOUND, every one of which a hostname-only rule
       * cleared and which measured GREEN with a live request planted: a PLAINTEXT
       * downgrade is not the same security fact as the https load that was recorded, a
       * different port is a different service, and ws:// is neither. */
      'http://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net:8443',
      'http://a.tile.openstreetmap.org',
      'ws://cdn.jsdelivr.net',
    ];
    const cleared = HOSTILE.filter((h) => classify(h).kind !== 'UNKNOWN');
    /* And the positive half: the real names must still classify, or this clause would
     * pass on a predicate that matches nothing at all. */
    const REAL = ['https://a.tile.openstreetmap.org', 'https://b.tile.openstreetmap.org',
                  'https://c.tile.openstreetmap.org', 'https://cdnjs.cloudflare.com',
                  'https://cdn.jsdelivr.net'];
    const notCleared = REAL.filter((h) => classify(h).kind === 'UNKNOWN');
    if (cleared.length) BAD(`${cleared.length} hostile look-alike hostname(s) are accepted by the allowlist`,
      `${cleared.join(', ')} — an allowlist matched by substring is satisfied by any domain that CONTAINS the approved name`);
    else if (notCleared.length) BAD(`the allowlist does not recognise ${notCleared.length} of its own origins: ${notCleared.join(', ')}`,
      'the predicates match nothing, so the clause above passes by rejecting everything');
    else OK(`${HOSTILE.length} look-alike hostnames rejected and all ${REAL.length} declared ones still recognised — the match is an anchored hostname, not a substring`);
  }

} catch (e) {
  bad('check 27 could not complete', String(e && e.message ? e.message : e).split('\n')[0]);
} finally {
  await browser.close();
  server.close();
}

if (!asserted) {
  console.error(`\n::error::CHECK 27 asserted NOTHING${ONLY ? ` — --only=${[...ONLY].join(',')} selected no live section` : ''}.`);
  process.exit(1);
}
if (failures.length) {
  console.error(`\n::error::CHECK 27 FAILED — ${failures.length} — the app contacts an origin nobody approved.`);
  console.error(`\nCHECK 27 FAILED — ${failures.length} at ${COMMIT.slice(0, 12)}:`);
  for (const f of failures) { console.error(`  ${f.m}`); if (f.d) console.error(`    ${f.d}`); }
  process.exit(1);
}
/* THE FULL PROSE IS A CLAIM ABOUT A FULL RUN, and printing it after `--only` would be a
 * sentence asserting more than the run asserted — the same shape as a comment claiming
 * coverage that does not exist, which is what half this repository's findings have been. */
if (ONLY) {
  console.log(`\nCHECK 27 PASSED at ${COMMIT.slice(0, 12)} — sections ${[...ONLY].join(', ')}, ${asserted} assertion(s). NOT a full run: this says nothing about the sections it did not run.`);
} else {
  console.log(`\nCHECK 27 PASSED at ${COMMIT.slice(0, 12)} — ${asserted} assertion(s). Every origin this app contacts, on a cold load and across all eight pads, is on a list declared in exactly one place: ONE RATIFIED EXCEPTION, the Map panel's OpenStreetMap basemap, owner-approved 2026-09-04 against three costed alternatives; and TWO UNRATIFIED origins that ship today and that NOBODY HAS RULED ON — cdnjs.cloudflare.com and cdn.jsdelivr.net — recorded here so they cannot be forgotten rather than because they are approved. A third-party origin outside that list fails this check, which is the whole of what PUP-WO-0705 was for.`);
}
