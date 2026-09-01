# PUP-WO-0105 — The service worker caches error responses

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0105`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P1.
**Priority:** ahead of `PUP-WO-0104` and `PUP-WO-0600`. See §0.
**Grounds:** `docs/northstar.md` invariants 3, 5 · `docs/architecture.md` §5, §6.1 ·
`docs/feedback/PUP-WO-0103.md` · `sw.js`.

> **What this is:** one guard, in the one file that is already on the child's tablet.
> `sw.js`'s fetch handler writes **every resolved response** into the cache with no
> status check, so an HTTP error received *while online* overwrites the good copy. It
> is **NOT** the cache gate (`PUP-WO-0104`), not publication (`PUP-WO-0103`), and not
> `index.html`.

**Cadence:** build. One PR, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0105 origin/main`.

---

## 0. This is live, and it is on the tablet now

Not a latent defect. `sw.js` on `main` is what Buddy's device is running.

**The mechanism.** `fetch()` **resolves** on 4xx and 5xx — it rejects only on network
failure. The handler does `fetch(...).then(response => cache.put(request, clone))`
with **no status or type guard anywhere in the file** (verified: zero occurrences of
`.ok`, `status ===`, `status >=`, `response.status`, `.type ===`). So a 404 or 503
received **while online** is stored under its own key, overwriting the good copy —
and the offline `.catch` branch never runs, because nothing rejected.

**`'./'` is in `urlsToCache`. That is the app shell.** Reproduced in real Chromium:
one reload against a 404ing origin poisoned `/PupPad/`, and offline the device then
served a 404 error page. **Buddy taps his icon and gets an error page he cannot tap
out of.** Northstar invariants 3 and 5.

**Severity, stated honestly:** it heals **per URL** on the next healthy *online*
fetch of that URL — so it is not permanent. But the window is "until an adult opens
it online against a healthy origin," and **a three-year-old cannot produce that
condition.** `/PupPad/` healed when navigated; `/PupPad/index.html` stayed poisoned
because nothing re-fetched it.

**Why it outranks `PUP-WO-0104`:** 0104 makes the *gate* able to see this class. This
makes the *worker* stop doing it. No CI check can stop a production 404 from
poisoning a live device, and 0104 explicitly forbids touching `sw.js`, so 0104
**cannot** fix it.

**Triggers are not limited to a deploy.** A Pages incident, a 503, a 429, or a
no-deployment gap all produce a non-200 while the device is online.

## 1. Scope

**One change, plus the tests that prove it.**

1. **Guard the cache write on response status.** Store only what should be stored.
   `response.ok` is the obvious predicate; **justify whatever you choose in the
   feedback file**, including what it does to opaque responses.

2. **Rule on opaque cross-origin responses, which `sw.js:225` already raises.** A
   `no-cors` response has `type: 'opaque'`, `status: 0`, and zero readable bytes.
   `response.ok` is `false` for opaque, so a naive guard **stops caching the CDN
   assets the Map panel needs offline** — and that is invariant 3, which is exactly
   the failure this project has ruled on three times: *what legitimate behaviour does
   this fix now refuse?* **Answer it before writing the guard, not after.**
   Note `PUP-WO-0600` may vendor those assets and dissolve the question; do not
   depend on that.

3. **Do not change anything else in `sw.js`.** Not the reap, not the prefix
   derivation, not the `/stable/` decline, not the legacy exception. They are correct
   and reviewed.

## 2. Invariants — restated by number

- **3** — every core surface works with no network. This defect makes the app shell
  itself fail offline, which is the strongest form of that failure.
- **5** — no state ends play without a one-tap way back. A poisoned shell has no tap
  out of it at all.

**Protected surfaces — must diff to empty:** `index.html`, `manifest.json`, both
icons. **`sw.js` is the subject.** `.github/ci/` may be touched **only** for the
tests in §3 — the cache gate's shape is `PUP-WO-0104`'s and must not be pre-empted.

## 3. Acceptance — proven, not asserted

1. `git fetch origin && git diff origin/main --stat` shows `sw.js`, `.github/ci/`
   and `docs/` only.
2. **Demonstrated RED first, in a real browser:** against an origin returning 404,
   show the app shell poisoned *before* the fix and clean *after*. `PUP-WO-0103`'s
   lens 1 reproduced the poisoning; reproduce it yourself rather than citing it.
3. **The offline path still works** — cold start, airplane mode, every panel.
4. **§1.2's answer demonstrated:** whatever you decide about opaque responses, show
   the Map panel's offline behaviour under it. If it degrades, that is a finding and
   a flag-and-stop, not a trade to make quietly.
5. **A check that would have caught this.** *This is the acceptance criterion that
   matters most, and the requirement is narrower than it first looks.*

   The obvious diagnosis — *the sandbox `fetch` always throws, so the `.then` branch
   never runs* — is true of the default stub and **too coarse**. One mutation, `B7`,
   already makes the fetch resolve. **The real blindness is the shape of what it
   resolves to:** a bare object `{ clone: () => 'LIVE' }`, with no `status`, no `ok`,
   and not a `Response`. Across the whole CI tree the only `new Response` occurrences
   are inside `sw.js` *mutation text* — the offline 504, never a fetched response.

   So **no check in this artifact can express "the worker cached an error
   response,"** and it is not because a branch is unreachable. **It is because the
   one fixture that reaches it cannot carry the property under test.** The fixture
   was built to prove the stub *fired*, never to carry a status.

   Required: a fixture that is a real `Response` with a settable status, **and an
   assertion that reads the status of what was cached.** A stub that cannot fail is
   not a test; a stub that can only fail is not one either; and **a stub that can
   neither carry nor be asked about the property under test is not one at all.**
   Demonstrate the check red against the unguarded worker.
   *(Corrected mid-authoring from `PUP-WO-0103`'s pass: CC-B overrode its own agent's
   "cannot express this at all" as too strong and supplied the sharper mechanism.)*
6. **Every demonstration asserts the commit and the failing step name**
   (architecture §5).

## 4. Scope fence — NOT in this work order

- **The cache gate's shape** — the origin-mapped browser, content assertions across
  `urlsToCache`, M9/M7. All `PUP-WO-0104`'s. You may fix the stub in §3.5 because
  this defect is invisible without it; do not build 0104's gate.
- **`index.html`**, including the CDN loads — `PUP-WO-0600`.
- **Publication and the deploy path** — `PUP-WO-0103`.
- **The reap, the prefix derivation, the `/stable/` decline, the legacy exception.**

## 5. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only. **Freeze every named
deliverable including the feedback file, then resolve every pointer the prompt cites
against the frozen tree** — and on a miss, print the surrounding lines of the cited
file, never the count (architecture §6.1, member 4).

Probes:

- **Poison the cache some other way.** A redirect, a 206, an opaque response, a
  response with the wrong `Content-Type`, a 200 whose body is an error page.
- **What does the guard now refuse?** The standing question, and here it has a known
  candidate: the offline CDN assets.
- **Attack the stub.** Can it resolve? With a non-OK status? An opaque response? If
  any of those is unreachable, the check is blind in that direction.
- **Find another branch of `sw.js` that no check executes.**

## 6. Upward feedback

`docs/feedback/PUP-WO-0105.md`; verbatim exchange in
`docs/findings/PUP-WO-0105-adversarial.md`.

## 7. Flag-and-stop

- **The guard degrading any panel's offline behaviour** — including the Map panel
  via opaque responses. A trade between invariant 3 in one place and invariant 3 in
  another is a ruling, not a build step.
- Any need to touch `index.html`, `manifest.json`, or an icon.
- Any need to build `PUP-WO-0104`'s gate to prove this.
- A second adversarial pass finding serious defects — this work order is one guard,
  and if it takes three rounds the problem is not the guard.

## 8. Provenance

Written by CC-A 2026-09-01, mid-`PUP-WO-0103` adversarial pass, on a defect found by
two independent lenses from opposite ends: one reproduced the poisoned shell in
Chromium, the other found the harness reason CI cannot see it. Neither read the
other. The defect predates `PUP-WO-0102` — the pre-0102 worker carries the identical
unguarded `put` — so 0102 rewrote this handler extensively and carried it through.

**The comment directly above the bug is the record of how it survived:** it
enumerates every way `cache.put` can *reject* — non-GET, 206, opaque redirect — and
handles each. The case never considered is the one where `cache.put` **succeeds and
stores the wrong thing.** The author verified against the failure he imagined.
