# PUP-WO-0105 — upward feedback

**Branch:** `build/wo-0105`, forked from `main` @ `6283233`.
**Subject:** `sw.js`. **Change:** one guard, one version bump, two new tests.

---

## 1. What was wrong, reproduced rather than cited

The work order asked me to reproduce the poisoning myself rather than cite
`PUP-WO-0103`'s lens 1. I did, in real Chromium, against `origin/main`'s worker
(`demo-error-poisoning.mjs`, committed):

```
1. healthy                      {"status":200,"body":"<!DOCTYPE html>\n<html lang=\"en\">..."}
2. after one 404 while ONLINE   {"status":404,"body":"<!doctype html><title>SITE-NOT-FOUND..."}
3. OFFLINE, what the device serves {"status":404,"body":"...404 THIS IS THE ERROR PAGE"}
```

The same script against this branch returns status 200 at all three steps.

`fetch()` resolves on 4xx and 5xx — it rejects only on a network-layer failure — so
the handler's `.catch` offline branch never ran, and the error body was written over
the precached app shell under its own key.

---

## 2. §1.2 — WHAT THE GUARD REFUSES, ANSWERED BEFORE THE GUARD WAS WRITTEN

This is the part the work order made a precondition, and it changed the answer.

`index.html:1373` requests OpenStreetMap tiles, and `index.html:11-13` load supabase
and leaflet from two CDNs. All three arrive as `no-cors` requests. Measured in
Chromium, unguarded versus guarded, on the four classes that reach the handler:

| class | `.ok` | `.status` | `.type` | unguarded | guarded |
|---|---|---|---|---|---|
| same-origin 200 | `true` | 200 | `basic` | cached 200 | cached 200 |
| same-origin 404 | `false` | 404 | `basic` | **cached 404** | **NOT CACHED** |
| cross-origin opaque 200 | `false` | 0 | `opaque` | cached 0 | cached 0 |
| cross-origin opaque 404 | `false` | 0 | `opaque` | cached 0 | cached 0 |

**`response.ok` is FALSE for opaque.** The obvious predicate would have refused three
of the four classes, including the opaque 200 that every leaflet, supabase and map
tile response arrives as — the Map panel would have lost its offline assets. That is
invariant 3 traded against invariant 3, which §7 makes a ruling rather than a build
step, and I would have made it silently had §1.2 not required the measurement first.

**Chosen predicate: `response.ok || response.type === 'opaque'`.** Exactly one cell of
the matrix changes, and it is the cell the work order is about.

### What this does not fix, and cannot

**An opaque 200 and an opaque 404 are indistinguishable** — both `status: 0`, both
`type: 'opaque'`, both with an unreadable body. That is what opacity means. No
predicate can separate them, so a failed tile or a failed CDN asset is cached exactly
as it is today: **unchanged, not improved.** The check prints this as an explicit
`NOT ASSERTED:` line rather than letting the green imply coverage it does not have.
`PUP-WO-0600` vendors those assets and dissolves the question.

**This is not a §7 flag.** §7 fires on the guard *degrading* offline behaviour. It
degrades nothing — the opaque row is byte-identical before and after.

---

## 3. `CACHE_VERSION` v17 → v18 — flagged, because it is the one change that is not the guard

Check 3 does not *require* it: no cached asset changed. I did it anyway, and it is a
judgement about recovery rather than correctness, so it should be reviewed as one.

**Why.** The guard only stops a *new* poisoning. `CACHE_NAME` is what a worker adopts
on activate, so an unchanged name means **a device that already cached a 404 over its
shell keeps serving it after the fix ships** — until something re-fetches that exact
URL while online, which a three-year-old cannot cause. The defect is live now, so the
safe assumption is that some device already carries it.

**Why it is safe, checked in both directions rather than assumed:**

- the reap is `name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME`, so v18 retires
  v17 and touches nothing outside this worker's own prefix;
- install is `event.waitUntil(cache.addAll(...))`, so on a device that is **offline**
  when the new worker arrives the precache rejects, install fails, the new worker
  never activates, and the **old** worker keeps serving. There is no window in which
  the child has neither.

Cost: one re-download of five small assets on the next healthy online load.

---

## 4. §3.5 — the check, and why the obvious diagnosis was not enough

The work order was right that "the sandbox `fetch` always throws" is too coarse.
`check-mutations.mjs`'s B7 already makes it resolve. **The blindness is fixture
shape:**

```js
fetch: async () => { network.attempted++; return { clone: () => 'LIVE' }; }
```

no `status`, no `ok`, no `type`, and not a `Response`. Before this branch, the only
`new Response` occurrences anywhere in `.github/ci` were the two inside `sw.js`
*mutation text* in `check-mutations.mjs` — the offline 504, never a fetched response.

`check-error-caching.mjs` supplies both halves: **a real `Response` with a settable
status, and an assertion that reads the status of what was cached.** Against
`origin/main`'s worker:

```
  FAIL  A 404 RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5
          cached status=404 body="ERROR BODY 404"; offline, the device would serve this instead of the app
  FAIL  A 500 RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5
  FAIL  A 503 RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5
CHECK FAILED — 3 assertion(s):
```

Green on this branch. **The opaque assertion is green in BOTH runs**, which is what
shows the check discriminates this defect rather than merely noticing that something
changed.

### My first fixture failed the way B7 does

Recorded because it is the same defect one level down, met while building the fixture
for it. `Response.prototype.clone()` rebuilds from internal state and **drops
properties redefined on the instance.** The worker stores the *clone*, so the cache
received `status: 200` while the guard had correctly seen `status: 0` — and the check
went **red against a correct worker**. A real opaque response clones to an opaque
response, so the fixture must too. Fixed by making `clone()` return an equally shaped
Response, and written up in the file rather than quietly corrected.

I caught it only because the assertion read the *status* of the cached entry. Had it
asserted mere presence, it would have passed and I would have shipped a fixture that
proves nothing.

---

## 5. Acceptance

| # | Criterion | Status |
|---|---|---|
| 1 | diff shows `sw.js`, `.github/ci/`, `docs/` only | **met** — `.github/workflows` untouched; protected surfaces diff to empty |
| 2 | RED first in a real browser, clean after | **met** — §1 above, same script both sides |
| 3 | offline path still works | **partially met — see below** |
| 4 | §1.2's answer demonstrated | **met** — §2's table, and the opaque row is unchanged |
| 5 | a check that would have caught this | **met** — §4, red by named assertion on `origin/main` |
| 6 | demonstrations assert commit and failing step | **met** — subject blob `72f1699…` recorded in each run |

### Acceptance 3, stated honestly rather than claimed

What I verified: **cold start with the origin genuinely gone** — server closed and its
keep-alive sockets destroyed, because `context.setOffline(true)` does not stop a
worker's fetch to loopback. Result: HTTP 200, `title "Pup Pad"`, `#app`/`#root`/
`#settingsBtn` present, 120 KB of body, **zero same-origin console errors**.

What I did **not** verify: **panel-by-panel interaction.** The panel markup is
injected by JS (`index.html:463`, `:1327`), so those elements do not exist until a
panel is opened, and driving that is an interaction harness this work order does not
call for. The Map panel additionally needs leaflet, which the hermetic run aborts.

**Why I think the gap is acceptable rather than papered over:** the guard changes
exactly one cell of §2's matrix. Everything cached before is still cached, except
same-origin errors. **No panel can lose an asset it previously had** — which is a
stronger argument than driving the UI would be, and it is measured rather than
reasoned. If the reviewer disagrees, the missing evidence is a UI-interaction test and
I would rather be told than assume.

---

## 6. Upward feedback

### 6.1 B7 is red for the wrong reason, and always has been

Not mine to fix — `expectFail` is `PUP-WO-0103`'s and `PUP-WO-0104` owns the gate —
but it bears on this work order and I verified it in both directions.

B7's label is *"sandbox fetch RESOLVES, **WITH the origin-wide read**"*. Applying B7's
two mutations by hand and running check 5 directly:

```
  FAIL  the offline branch was NOT exercised — the assertion above passed vacuously
  FAIL  the promoted copy's offline branch was NOT exercised
CHECK 5 FAILED — 2 assertion(s):
```

**Both failures are the positive controls**, firing because the fetch resolves so the
offline branch never runs. The origin-wide read — the thing the label names — is never
exercised at all. B7's LOUD is real and means something else.

I ran the identical mutation against `origin/main`'s unguarded worker and got a
**byte-identical failure set**, so this predates my change and my guard did not alter
it. Recorded so nobody later reads B7's green as coverage of the origin-wide read.

### 6.2 On `main`, *nothing* in check 7 names the assertion that must fire

`PUP-WO-0103`'s record says PART A has 14 `expectFail` and PART B has none. That is
true **of the 0103 branch**. On `main`:

```
$ grep -c expectFail .github/ci/check-mutations.mjs
0
```

The mechanism does not exist here at all, so **all 21 mutations are verified by
`code !== 0` alone.** 0103 is parked, so this is the state any work order forking
`main` inherits — worth knowing when 0104 starts.

### 6.3 Neither new file is wired into `ci.yml`

Acceptance 1 fences the diff to `sw.js`, `.github/ci/` and `docs/`, and
`.github/workflows/` is `PUP-WO-0103`'s parked artifact. So both tests exist and are
demonstrable but **do not gate anything yet.** An unwired check is not a gate, and I
would rather say so than let the count of checks imply protection. Wiring is a handoff
item for whoever next owns the workflow.

### 6.4 A note on the work order itself

§1.2 as a precondition is the reason this came out right. My instinct was
`response.ok`, and it would have broken the Map panel offline — a regression traded
for a fix, in the same file, against the same invariant, and it would have passed
every check that exists today because nothing exercises opaque responses. The
requirement to answer *before* writing the guard is what turned that into a
measurement instead of a bug.
