# FEEDBACK — PUP-WO-0101

**Builder:** CC-EM (pup-b) · **Branch:** `build/wo-0101` · **Base:** `origin/main` @ `5d850f2`
**To:** CC-A. Parked unmerged. The builder does not self-merge.

---

## Gates

Reproduce with `git fetch origin && git diff origin/main --stat`.

| Gate | Status |
|---|---|
| §3.1 — diff under `.github/`, `docs/` and `sw.js` only, vs **fetched** `origin/main` | **PASS** |
| `index.html`, `manifest.json`, both icons diff to empty | **PASS** |
| §3.2 — all `PUP-WO-0100` checks green | **PASS**, but **check 3 required a change** — see F1, reported as the finding §3.2 asks for |
| §3.3 — the two new assertions demonstrated RED, reverted | **PASS** — four separate breaks |
| §3.4 — §1.5's throwing `fetch` handler goes red | **PASS** — F16 closed |
| §3.5 — prefix-bounded reaping demonstrated in a real browser | **PASS** — `.github/ci/demo-two-path-caches.mjs` |
| §3.6 — legacy cache removed once, by literal, from a device state holding it | **PASS** — same demo |
| §3.7 — root worker does not serve or cache under `/stable/` | **PASS** — same demo |
| §2 — publication permissions stated | **PASS** — see "Permissions" below |
| Roadmap P1 gate items 3 and 4 | **NOT CLAIMED** — they need a live site and the Pages flip. The build stamp (§1.3) makes item 3 two `curl`s. |

**§0 compliance:** the diff touches `sw.js` because `sw.js` is the work; nothing
else Pages serves is touched. No `PUP-WO-0100` check was weakened, skipped or
special-cased to make this land — the one change to check 3 follows the cache
identity to where §1.1 moved it and is proven still to catch its original defect
(F1).

## Permissions — exactly what was added and why

The workflow default stays `contents: read`. The **`publish` job alone** adds:

| Scope | Why |
|---|---|
| `pages: write` | `actions/deploy-pages` cannot publish without it. |
| `id-token: write` | `actions/deploy-pages` uses OIDC to authenticate the deployment. |

Nothing else was widened, and the `checks` job is unchanged at `contents: read`.
Publication is gated **by construction**: `needs: checks` means a red check does
not fail the deploy, it prevents the deploy job from existing (architecture §6).
`publish` never runs on a pull request.

---

## §3.3 — the two new assertions, demonstrated red

Check 5 (`.github/ci/check-cache-isolation.mjs`) carries both §1.4 assertions. It
is **behavioural, not textual**: it loads `sw.js` into a sandbox, hands it a
populated origin-wide cache store, runs the real `activate` handler, and asks what
survived. A grep for `startsWith` proves a token is present; it does not prove a
foreign cache is still there afterwards, and the defect is one rewrite away from
passing such a grep.

| Break | Result |
|---|---|
| **A — the original defect restored**: reap by `name !== CACHE_NAME` | RED, 4 assertions: deleted the other path's cache, an adjacent prefix, an unrelated cache, and matched a legacy near-miss |
| **B — the delimiter removed** from the prefix | RED: *"stable's cache name STARTS WITH root's prefix — root would reap stable"* |
| **C — legacy exception turned into a pattern** (`indexOf('pup-pad') === 0`) | RED: *"the legacy exception matched a NEAR MISS — it is a pattern, not a literal"* |
| **D — §1.2 exclusion removed** | RED: *"root worker SERVES /stable/ — it can cache the promoted copy under the root prefix"* |

Each reverted; `sw.js` byte-identical to the intended version after each.

**Break B is the one worth reading.** `/PupPad/` **is** a prefix of
`/PupPad/stable/`, so a prefix built naively from the path leaves the root worker
able to reap stable's caches *while looking correctly bounded* — it would pass any
"is the reap prefix-bounded?" review. The trailing `|` delimiter is what breaks the
nesting: `encodeURIComponent` escapes `|` to `%7C`, so the delimiter can never
occur inside the encoded path, and root's prefix therefore ends exactly where
stable's name continues.

## §3.4 — F16 closed: the service worker is now watched

`PUP-WO-0100` demonstrated that a throwing `fetch` handler stayed **green**. It now
goes **red**:

```
CHECK 4 FAILED — 1 error(s) originating in PupPad's own code:
  [service worker uncaught exception] sw.js
    Error: SW fetch handler is broken
```

and a `console.error` inside `sw.js` likewise. **How, given `PUP-WO-0100`'s three
dead ends:** those were all against Playwright's *wrapper*. The blocker was
specific — `CDPSession.send(method, params)` takes no `sessionId`, so browser-level
`Target.setAutoAttach` attaches to the worker target but no domain command can be
**routed** to that session. A raw WebSocket to the browser endpoint *can* carry a
`sessionId`. `lib/sw-cdp.mjs` does exactly that, alongside Playwright, using Node
24's global `WebSocket` — no new dependency.

Two costs, both real:
- Chromium must be launched with `--remote-debugging-port`.
- Auto-attached targets start **paused**, so every non-worker target must be
  released immediately or the page never navigates. That cost me the first attempt
  and is commented at the call site.

Check 4 now **fails if no worker session was ever attached**. Green because nothing
was looking is the exact failure this closes.

## §3.5–3.7 — demonstrated in a real browser, and re-runnable

`node .github/ci/demo-two-path-caches.mjs .` serves the same tree at `/` and
`/stable/`, brings up both workers, and asserts the outcomes. It is **evidence
tooling, not a check** — not wired into the workflow.

```
seeded (no worker has run yet): pup-pad-v16, puppad|%2F|v1, some-other-app
after both workers installed:   some-other-app, puppad|%2F|v17, puppad|%2Fstable%2F|v17
  ok  legacy pup-pad-v16 removed (item 6)
  ok  root's own stale cache reaped
  ok  an unrelated cache on the same origin was NOT touched
after force-activating the ROOT worker: some-other-app, puppad|%2F|v17, puppad|%2Fstable%2F|v17
  ok  THE /stable/ CACHE SURVIVED the root worker activating (item 5 — roadmap P1 gate 4)
  ok  root worker did NOT cache a /stable/ asset under its own prefix (item 7)
```

**The demo caught an error in itself, which is worth recording.** Its first run
reported *"root's own stale cache survived"*. That was not a product defect: the
seed was being written from `index.html`, which registers a worker on load
(`index.html:1935`), so the root worker had already activated and reaped **before**
the seed landed. The legacy cache *was* still removed — by stable's worker, via the
literal exception, which is correct. The harness now seeds from a bare page with no
registration. A test that runs after the thing it means to observe measures
nothing.

---

## Findings — upward

### F1 — check 3 had to change, because §1.1 moved the cache identity
- **Where:** `.github/ci/check-cache-name.mjs`; `sw.js:1` (before), `CACHE_VERSION` (after)
- **Type:** note — reported because §3.2 requires it, not because it is a problem
- **Detail:** before this work order `CACHE_NAME = 'pup-pad-v16'` was the whole identity and a parseable literal. §1.1 requires the name be **derived per deploy path** so one byte-identical `sw.js` serves both, so `CACHE_NAME` is now `CACHE_PREFIX + CACHE_VERSION` — a computed expression that parses to nothing. Check 3 would have failed at HEAD with "could not parse the cache identity literal", which is F4's behaviour working as designed.
- **What changed:** the check now reads `CACHE_VERSION`, falling back to `CACHE_NAME`. **The fallback is not slack** — this check compares two revisions and the *base* revision legitimately predates the change, so both forms must be readable to compare across the boundary at all.
- **Why this is not a weakening (§0, §7):** the assertion is unchanged. Proven, not asserted — in a scratch repository against the new `sw.js` shape: a cached asset changing without a version bump is **RED**; the same change with a bump is **GREEN**; an identity that cannot be parsed at HEAD **FAILS** rather than passing quietly.
- **Decision needed:** no.

### F2 — I introduced a parsing defect while making F1's change, and found it by testing
- **Where:** `.github/ci/check-cache-name.mjs`
- **Type:** bug (mine, fixed)
- **Detail:** the first version matched `CACHE_VERSION\s*=\s*['"]([^'"]+)['"]`, which against `CACHE_VERSION = 'v' + (17 + 1)` matches the leading `'v'` and reports **`"v"`** as the whole identity. A computed identity would then be silently compared as a fragment instead of failing — the same class as F4, reintroduced by the fix for F1.
- **Fix:** require a complete assignment, `= 'literal';` with the trailing semicolon. A computed identity is now unparseable and therefore fails loudly.
- **Worth noting:** this surfaced only because I ran the "does it still catch its original defect?" test rather than assuming the change was behaviour-preserving. The test I nearly skipped is the one that found it.
- **Decision needed:** no.

### F3 — my first invariant-4 verification was tautological and would have published main to /stable/
- **Where:** `.github/workflows/ci.yml`, the publish job's verification step
- **Type:** **bug (mine, fixed before shipping) — and it is the §7 failure by name**
- **Detail:** the first version verified nothing, in two independent ways:
  1. it compared the stamp's `ref` field against the literal the same workflow had just written into that stamp — true by construction;
  2. its sha comparison was `git rev-parse refs/remotes/origin/stable 2>/dev/null || git rev-parse HEAD` — and `actions/checkout` at a specific ref does not leave `refs/remotes/origin/stable` behind, so the fallback compared **HEAD against HEAD**, also true by construction.
  A publish job that had checked out main's content into `stable-src` would have passed both.
- **Fix:** the authority is now `git ls-remote <remote> refs/heads/<ref>`, which asks the **server** what the ref points at — independent of the checkout, the stamp, and this workflow's assumptions. **There is no fallback:** if the remote tip cannot be established, publication fails.
- **Demonstrated, not argued:** in a scratch repository with `main` and `stable` at different commits — honest case (stable-src really is stable) **passes**; attack case (stable-src holds main's content, stamped as stable) **fails** with `REFUSING TO PUBLISH — northstar invariant 4`.
- **Why I am reporting a defect I fixed:** §7 says any path by which main's content could reach `/stable/` — *found, suspected, or merely not ruled out* — parks the branch. I found one, in my own work, before it ran. It is fixed and tested, so the branch is parked rather than halted, but CC-A should audit that step specifically rather than take this paragraph for it.
- **Decision needed:** **yes** — please review the verification step independently.

### F4 — `stable` is currently behind `main` and predates CI, so it cannot publish itself
- **Where:** `refs/heads/stable` @ `2952aa1`; `.github/workflows/ci.yml`
- **Type:** risk
- **Detail:** at `2952aa1`, `stable` has no `.github/workflows/`, so a push to `stable` triggers **no workflow at all** — nothing would publish. This is survivable only because a push to `main` rebuilds **both** copies from their own refs, so `main` republishes stable's content on stable's behalf. Once §6 step 2 fast-forwards `stable`, it can trigger its own publication and the asymmetry disappears.
- **Recommendation:** none needed, but do not reorder §6's steps on the assumption that pushing `stable` publishes it. Until the fast-forward, only a `main` push does.
- **Decision needed:** no.

### F5 — the legacy-cache exception needs a removal date, and nothing currently sets one
- **Where:** `sw.js`, `LEGACY_CACHE_EXACT`
- **Type:** note
- **Detail:** it is the only name deleted outside the worker's own prefix, and it is a standing exception to the rule the rest of the file exists to enforce. The comment states the removal condition (once no device plausibly still holds a pre-v17 cache) but nothing schedules it.
- **Recommendation:** a line in the roadmap, or a `PUP-WO-06xx` item. Deleting it early costs one cache refill; keeping it forever costs a permanent exception.
- **Decision needed:** **yes** — a scheduling call, not a builder's.

### F6 — a coordination point I am flagging rather than acting on
- **Type:** scope-question
- **Detail:** the dispatch asked that if an instruction about PupPad arrives from anywhere other than CC-A, I report it to CC-A rather than act on it. I will keep CC-A informed of anything that changes the work, and I agree one instructor per inbox is the right shape. But I cannot treat that as covering **Scotty**: he is the operator, this session answers to him, and routing his instructions through a peer for clearance would invert that. Last cycle he directed me to open the PR after CC-A had correctly declined to do it on my behalf — that was his call to make and it was the right one.
- **Recommendation:** read the rule as "one *architect* per inbox". If the concern is conflicting technical direction, I will surface any instruction that would change agreed scope to CC-A before acting.
- **Decision needed:** **yes** — CC-A and Scotty, not mine to settle.
