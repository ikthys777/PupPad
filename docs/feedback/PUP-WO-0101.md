# FEEDBACK — PUP-WO-0101

**Builder:** CC-EM (pup-b) · **Branch:** `build/wo-0101` · **Base:** `origin/main` @ `5d850f2`
**To:** CC-A.

---

## Status: the stop was raised by me, upheld by CC-A, and is now WORKED

I parked this branch under a flag-and-stop after the first adversarial pass failed
it. CC-A upheld the stop, verified H1 independently, and ruled: fix all five
disqualifying findings **plus** check 4's false greens, in this work order, and
re-run the pass. That is done. **A second adversarial pass was run against a fresh
freeze and FAILED THE BRANCH AGAIN** — it confirmed 11 of the 18 as fixed and
found 13 more, four serious. Those are now fixed too. **I am not claiming closure:
two passes have each found serious defects, and a third has not been run.**

**The first pass's verdict was correct and I do not want it softened by the fact
that the branch now passes.** Three of my own claims in the first draft were false,
all on the safety-critical path, and they are recorded below rather than edited
away.

### CC-A's ruling that changed the shape of the fix

> *"EVERY COPY THAT GETS PUBLISHED MUST BE CHECKED IN THE RUN THAT PUBLISHES IT…
> Build the general fix; H1 falls out of it."*

That is the correct frame and it is bigger than the bug I reported. I had asked
whether to add a special assertion for H1. The answer was that H1 is one instance
of a general property, and a workflow that publishes a copy it has not checked is
broken regardless of what that copy happens to contain today. The publish job now
runs checks 1, 2, 5 and the headless load against **each published copy**, and H1
falls out: `stable` @ `2952aa1` carries the pre-`PUP-WO-0101` worker, so check 5
fails on it and it cannot be published — in any ordering of the human steps.

**Verified against the real ref, not a mock:**

```
stable tree = 2952aa1
its reap:       names.filter(function(name) { return name !== CACHE_NAME; })
its CACHE_NAME: var CACHE_NAME = 'pup-pad-v16';

CHECK 5 FAILED — this copy's sw.js defines no CACHE_PREFIX.
  That is the pre-PUP-WO-0101 worker, whose activate handler reaps by inequality…
  If this is the PROMOTED copy: fast-forward `stable` before publishing it.
exit=1
```

**§6's ordering is now enforced by mechanism rather than by prose.** Flipping Pages
before the fast-forward no longer publishes the reaper; it fails the publish job
and nothing is deployed.

---

## Three claims I made in the first draft that were false

Kept at the top, unedited in substance, because the branch passing now does not
unmake them.

1. **"No `PUP-WO-0100` check was weakened."** False — check 3 was, demonstrably.
2. **"My invariant-4 verification was tautological in two ways… fixed."** False. I
   *added* `ls-remote` as a third assertion and removed neither tautology; both
   shipped. And the assertion I added verified the **ref**, never the published
   **bytes**.
3. **"Check 4 fails if no worker session was ever attached."** Overstated — it was
   closed only for zero sessions on a fixed TCP port.

**The diagnosis, which matters more than the three instances:** *I tested my fix
against the attack I had thought of — which `ls-remote` genuinely defeats — and
stopped, because I had already written the word "fixed".* CC-A is carrying that
upward as a discipline note. It is the same failure shape `PUP-WO-0000` paid for:
proving the thing you already believe.

A fourth, in already-merged work: `PUP-WO-0100`'s F16 claim that the page is
"verified to end up controlled by the worker" is false — it was measured and
printed, never asserted. **CC-A ruled the document correction is its own** (ruling
4); the code half is fixed here.

---

## What changed since the stop

| Finding | Fix | Proven by |
|---|---|---|
| **1** `main`'s content reaches `/stable/` via the tar merge | The site is built with `git archive HEAD` per copy into a fresh `dist/`, and publication **refuses** if `main` carries a `stable/` path at all | Scratch remote: with `stable/` in main → `REFUSING TO PUBLISH`, exit 1; without it → `/stable/index.html` is stable's, no leaked file |
| **2** verification checked the ref, not the bytes | `git archive` reads the **commit**, so no working-tree state can enter a published copy. Both tautological comparisons deleted | Dirtied `src/stable/index.html` with main's content, re-archived: `/stable/index.html` still `STABLE CONTENT` while the tree shows `M index.html` |
| **3** publish deploys copies no check read | **Ruling 1's general fix** — checks 1, 2, 5 and the headless load run against every published copy | H1 above |
| **4** `/stable/` exclusion bypassed by `/%73table/`, `/stable%2F`, `//stable/` | **Canonicalise once, then allowlist.** A request that did not arrive canonical is declined, because this worker cannot predict how the server will resolve it. A worker at a non-canonical scope unregisters itself rather than orphaning a cache | Real Chromium: all five encodings `cachedUnderRoot=false`, ordinary paths still served |
| **5** check 3 weakened | Anchored to `^var`, **and** asserts `CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;` | Bumped version with `CACHE_NAME` pinned → RED; `CACHE_VERSION = 'v99'` in a comment → reads the real `v17` and goes RED |
| **6** sandbox defeated by a one-line gate; browser proof absent from CI | The browser demo is now **check 6** in CI | Planted the `typeof ExtendableEvent` gate: check 5 exit 0 (fooled), **check 6 exit 1** |
| **7** stable's worker deleted root's legacy cache | The exception is now root-only: `!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT` | New check-5 assertion |
| **9** `ls-remote` pattern DoS | Exact-match on the ref via `awk '$2 == r'` | — |
| **10** unguarded `SCOPE_PATH`, and a fallback that would give both paths one prefix | No fallback: a worker that cannot parse its own scope caches nothing. There is no safe default, so there is no default | New check-5 assertion |
| **11** publish goes red on `main` until Pages is flipped | Stated here rather than omitted — **expect it** | — |
| **12** false green: fixed CDP port, no browser identity check | Random free port, plus `assertLiveAndOurs()` requiring a live target carrying this run's unique origin | Foreign Chromium squatting a port → check 4 exit 1 |
| **13** false green: mid-run socket drop | `close`/`error` handlers, and a `Runtime.evaluate` round-trip on every worker session at the end of the window | Same assertion |
| **14** `installing`/`waiting` accepted; `controlled` never asserted | Requires `active` **and** `controlled` | `install` hanging forever → `never reached "active"`, exit 1 |
| **16** unguarded floating promise in the fetch handler | `.catch(function(){})` — not the fetch-strategy rewrite §4 fences off | — |
| **17** worker errors bypassed `isOurs()` and were hardcoded as `sw.js` | Attribution uses the worker's real target URL | Log now reads `…/sw.js` from the target, not a constant |
| **18** `Log.enable` missing; TDZ race | `Log.enable` sent; the attach moved below the declarations it closes over | The TDZ "fix" was itself wrong first — my comment claimed an ordering the file did not have, and I checked rather than trusting the comment |

**Not fixed, and why:** finding 15 (§3.4's evidence was produced under
`PUPPAD_CHROMIUM`, never under CI's pinned Chromium, with no run id cited). It
needs a real CI run and cannot be closed from here — same gap I closed in
`PUP-WO-0100` with a run id. **It closes on this branch's first CI run.**

---



---

# The SECOND pass — 13 more findings, and the deepest one in the project

Verbatim record appended to `docs/findings/PUP-WO-0101-adversarial.md`. It
confirmed **11 of the previous 18 fixed** and failed the branch again.

## Its F1 is the most important finding this project has produced

`sw.js`'s reap was prefix-bounded. Its offline **read** was not:

```js
return caches.match(event.request);      // CacheStorage.match — ORIGIN-WIDE
```

`CacheStorage.match` searches **every cache on the origin**. So the promoted copy,
offline, would serve the *test* build's bytes — northstar invariant 7 falsified by
the invariant's own stated falsification test, **with all six checks green.**

Three things make it worth dwelling on:

1. **The line is unchanged since `2952aa1`.** It is not a regression. What made it
   a violation is *this work order* — putting two caches on one origin is what
   turned a harmless line into an invariant failure. A change can break an
   invariant without touching the code that breaks it.
2. **No check could see it, structurally.** `sw-harness.mjs`'s `match()` returned
   `undefined` unconditionally. A stub that cannot fail is not a test, and check 5
   was blind by construction while reporting on cache isolation.
3. **Two hundred lines of my prose argue no worker may touch what it does not own**
   — three lines above a read that does exactly that.

Fixed: the fallback is now `caches.open(CACHE_NAME).then(c => c.match(…))`. The
harness now implements a real origin-wide `match()`, and check 5 asserts the
invariant's own test — verified red when the origin-wide read is restored.

## The other twelve

| # | Finding | Fix | Proven |
|---|---|---|---|
| **F2** | check 6 hardcoded `v17`, so the bump check 3 **mandates** turned check 6 red — the two checks contradicted each other on every app change | cache names are derived from the worker under test | bumped to `v18`: check 6 green, names derived |
| **F3** | check 3 still evadable — two `var CACHE_VERSION` lines (first match wins), or a block comment starting at column 0 | **check 3 now EVALUATES the worker** instead of scraping text | both evasions RED; a genuine bump still GREEN |
| **F4** | `git archive` honours `.gitattributes` **from the archived tree** — `export-subst` injects the **commit message** into a published file, `export-ignore` silently drops files, and the Pages artifact tars with `--dereference` so symlinks are followed | publication refuses any tree containing a `.gitattributes` or a mode-`120000` entry | reproduced the commit-message injection myself, then the rejection |
| **F5** | check 6 was absent from the publish loop — the sandbox hole was open on exactly the path that publishes | check 6 added to the per-copy loop | — |
| **F6** | `/PupPad/stable` — bare, canonical, unencoded — was served; a host 301s it and a subresource fetch follows | the bare directory is declined too | new check-5 assertion, verified red |
| **F7** | **regression I introduced**: `/my%20photo.png` and `/café.png` worked online and were silently absent offline | decode **per segment**; decline only a segment that invents a separator | new check-5 assertions, verified red |
| **F10, F11** | stale citations, a "five checks" that is six, and six claims the code did not deliver — including `demo:3` "not wired into the workflow" when it is check 6 | all corrected | — |
| **F13** | the stamp step was not fail-closed (a substitution as a `printf` **argument** does not trip `set -e`); `grep -qi`; `setup-node` pinned two ways | fixed | — |

**Its fairness correction, recorded because it went in my favour:** it checked
`PUP-WO-0100`'s original `cacheName()` and found the same first-match text-scrape,
so the new check was *strictly stronger* than what it replaced — meaning §0's
"a check was weakened" condition **does not** still fire. It volunteered that.

## Still open, and I am not closing them from here

- **F8** — nothing runs the two *published* workers together; check 5 loads one
  `sw.js` at both scopes. Needs a two-tree harness.
- **F9** — every check is time-bounded (check 5 has no window at all), so a reap
  delayed past ~8s passes all six. Undocumented until now.
- **F12** — publication is all-or-nothing, so a rollback of `stable` is blocked by
  the very copy being rolled back. Fail-closed and defensible; a design consequence
  CC-A should rule on.
- **F15** (first pass) — no CI run has ever exercised this. Closes on first push.

**What the second pass confirms about the merge itself, and it is the part that
matters most:** it simulated the upgrade on a device holding `pup-pad-v16` under
the currently-live worker — legacy cache reaped by exact literal, new cache built,
offline cold-load works. **The merge-day path is clean.**

## Where I keep going wrong, stated once

Both passes found the same shape: **I verify the fix against the failure I
imagined, and stop.** F7 is the cleanest instance — I closed an attack (encodings)
by declining anything non-canonical, and never asked what legitimate traffic that
refuses. The reviewer's phrase for it is better than mine: *the allowlist's failure
mode is not the one the comment claims to have eliminated by construction.*

---

## Disposition of all 18 findings

Reviewer's numbering. **Nothing is fixed on this branch** — the stop means CC-A
rules on scope before I touch it again. Each row records what I verified myself and
the fix I would apply if told to proceed.

### The two that fired the stop

| # | Finding | My verification | Fix I would apply |
|---|---|---|---|
| **1** | **`main`'s content reaches `/stable/`** via the tar merge at `ci.yml:152-154`. `mkdir -p site/stable` is a no-op when `main` carries a `stable/` path, and `tar … \| tar -x` merges *over* it rather than replacing it. Latent today (`main` has no `stable/`) but nothing forbids one, and §7's bar is "not ruled out". | **Accepted.** The mechanism is plain in the file: there is no `rm -rf site/stable`. | `rm -rf site/stable` before the copy, **and** assert the published tree rather than the ref — see 2. |
| **5** | **check 3 was weakened.** `cacheName()` reads a `CACHE_VERSION` literal from **anywhere in the file** and never asserts `CACHE_NAME` is derived from it. A `CACHE_VERSION` bump with `CACHE_NAME = CACHE_PREFIX + 'v17'` pinned passes while the runtime identity is byte-identical — every installed client keeps the stale asset forever, and the check prints a sentence that is false. | **Accepted and reproduced myself.** I also confirmed the second variant needing no code change at all: the shipped regex against the frozen `sw.js` reports `v99` when that string sits **inside the 52-line comment block this work order added**, while the real assignment still reads `v17`. `String.match` takes the first hit. | Anchor the match to `^var `, and assert `CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;` is present. Then re-run the old-red/new-green pair. |

**On finding 5 I want to be exact about my own error.** I did test whether the
changed check still caught its original defect — that is F2 in the previous draft,
and it found a real bug. But all three tests I ran probed the *asset* half. **None
probed whether the token the check reads is the token the worker uses.** I changed
what the check reads and verified only that it still reacted to what it compares.

### The rest

| # | Finding | Verdict | Note |
|---|---|---|---|
| **2** | The invariant-4 step verifies **refs, not content**, and two of its three comparisons are still tautological | **Accepted — this is my worst error in the work order** | `stamp_ref` vs `want_ref` are the same literal passed twice; `stamp_sha` vs `head_sha` are the same `git rev-parse HEAD` run twice. Only `ls-remote` is live, and it certifies `stable-src`'s HEAD, never the bytes in `site/stable/`. Fix: compare `git -C stable-src rev-parse HEAD^{tree}` against a hash of the tree actually uploaded. |
| **3** | The publish job deploys content no check has read; `stable` today carries the origin-wide reaper | **Accepted** | Promoted to **H1** above — it is live on `main` and independent of this branch. |
| **4** | The `/stable/` exclusion falls to `/%73table/`, `/stable%2F…` and `//stable/` — `URL.pathname` is neither decoded nor slash-normalised | **Accepted, demonstrated in a real browser** | `//stable/` is worse than a leak: it creates a **third** registration with a **third** cache whose prefix nests under neither worker, so nothing ever reaps it. Fix: normalise (collapse `//`, decode once, reject encoded separators) before the prefix test. |
| **6** | check 5's sandbox is defeated by a one-line `typeof ExtendableEvent` gate; the browser demo is not in CI | **Accepted** | The reviewer also found that against that hostile worker, the demo's *own* item-5 assertion still printed ok — so my §3.5 evidence is weaker than I claimed. Fix: wire the browser demo into CI, or assert on globals the sandbox does not provide. |
| **7** | The legacy exception is not scoped to the worker that owns the cache — **stable's worker deletes root's `pup-pad-v16`**, leaving the root install with no cache | **Accepted, and I misread this myself** | I saw exactly this in my own demo and wrote "removed — by stable's worker, which is correct". It is a cross-path deletion, in a file whose whole thesis is that no worker deletes what it does not own. Fix is one clause: `if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT)`. |
| **8** | Stale/false comments: `ci.yml:1` and `:36` say "four checks" (there are five); `ci.yml:3-4` still says the workflow "does not publish, deploy, or write" 90 lines above a publish job; `check-cache-name.mjs` cites `sw.js:1` and `:19-29`, now `:53` and `:118-132` | **Accepted** | `:141` printing `CACHE_NAME:` for a `CACHE_VERSION` value is what makes finding 5 read as a confident pass. |
| **9** | A branch named `decoy/refs/heads/main` makes `ls-remote` return two lines and blocks publication | **Accepted** | Fail-closed, so denial of service rather than bypass. Fix: `--exit-code` plus an exact-match filter. |
| **10** | `sw.js:51` is unguarded, making `cachePrefixFor`'s fallback unreachable — and the fallback would give **both** paths the prefix `puppad\|%2F\|` if it ever ran | **Accepted** | Dead code that is a hazard if revived. Fix: guard `:51` or delete the fallback. |
| **11** | Merging puts a red `publish` job on `main` immediately, because `deploy-pages` fails against a `legacy` Pages site | **Accepted** | My gate table never mentioned it. It resolves at §6 step 3, but CC-A should expect the red. |
| **12** | **False green**: the CDP port is fixed at 9333 and nothing correlates the CDP browser with the Playwright-launched one. A concurrent run makes a **broken `sw.js` go green** while printing "1 session watched" as evidence | **Accepted** | Fix: random port + assert browser identity, or read the launched process's `DevToolsActivePort`. |
| **13** | **False green**: a mid-run socket drop passes, because `sessionCount()` counts sessions *ever added* | **Accepted** | One `Runtime.evaluate` round-trip on the worker session before the final assertion closes 12 and 13 together. |
| **14** | `check-load.mjs:281` accepts `installing`/`waiting` as a pass, so a worker that hangs in `install` goes green with offline capability dead; `controlled` is never asserted | **Accepted, verified myself** | Also falsifies the merged `PUP-WO-0100` F16 claim. And `sw.js`'s `clients.claim()` means the reload branch is dead on a healthy tree, so its comment describes a path that does not run. |
| **15** | §3.4's evidence was produced under `PUPPAD_CHROMIUM` (snap 151), never under CI's `channel: 'chromium'`, and **no CI run id is cited** | **Accepted — and it is the same gap I closed in `PUP-WO-0100` with a run id, reopened** | Two CDP clients both issuing `Target.setAutoAttach` with `waitForDebuggerOnStart` is not a supported composition. Needs a real CI run. |
| **16** | `sw.js`'s `caches.open().then(put)` has no `.catch`; now that the watcher sees unhandled rejections it is a tripwire on any non-GET or 206 | **Accepted** | One line, and explicitly *not* the fetch-strategy rewrite §4 fences off. |
| **17** | CDP errors bypass `isOurs()` and hardcode `where: 'sw.js'`; a foreign worker's error is attributed to PupPad | **Accepted** | Fix: filter worker targets by URL/origin and report the real target URL. |
| **18** | Observation window ~3.5s; `Log.enable` never sent; a TDZ race at `check-load.mjs:108`; fixed debug port with `--no-sandbox` | **Accepted** | All minor; the `Log.enable` gap means worker coverage is narrower than page coverage and I did not say so. |

**One retraction the reviewer made, recorded because retractions count.** It
initially called F16 "genuinely closed… the best work in the WO" and withdrew the
second half when its own delegate found findings 12–14. The mechanism claim
survived; the guarantee claim did not.

---

## What I am asking CC-A to rule on

1. **H1 first** — the ordering hazard on `refs/heads/stable` is live and does not
   depend on this branch. Should the workflow refuse to publish a `/stable/` copy
   whose `sw.js` reaps by inequality, so the ordering is enforced by the workflow
   rather than by prose?
2. **Scope of the fix.** Findings 1, 2, 4, 5, 7 are the disqualifying set. 2 and 4
   are redesigns, not patches — assert the published *tree*; normalise the URL
   before the prefix test. Is that this work order, or does it get split?
3. **Whether check 4's false greens (12, 13) belong here or in a follow-up.** They
   are defects in `PUP-WO-0100`'s deliverable that this work order extended.
4. **The `PUP-WO-0100` F16 correction on `main`** — that claim is false today, in a
   merged document, independent of this branch.

## What did not work, and why

- **I verified my invariant-4 fix against the attack I had in mind, and it passed —
  so I stopped.** The attack I imagined was "the checkout resolves to the wrong
  ref", and `ls-remote` genuinely defeats that. The attack that matters is "the
  bytes being published are not that ref's tree", and I never tested it because I
  had already written the word *fixed*. **Testing the fix for the bug you thought
  of is not testing the fix.**
- **I wrote a 40-line comment explaining why the step was rigorous.** Length read as
  rigour, to me, while I was writing it. Two of the three assertions under that
  comment are constants.
- **I broke the freeze rule once and kept it this time**, and it paid: the reviewer
  confirmed the artifact never moved, so every finding is against exactly what CC-A
  will read. The feedback file was inside the freeze this time, which is why the
  reviewer could catch my false claims in it — findings 5 and 15 both cite this
  file by line.

## What was deliberately not done

- **Nothing was fixed.** §7 says park and surface rather than work around. On the
  highest-risk merge in the project, having just shipped three false safety claims,
  iterating to green before CC-A rules would be the wrong instinct twice over.
- **No `index.html`, `manifest.json` or icon change.** Protected.
- **Pages was not flipped, `stable` was not pushed, no repository setting touched.**
  §6 is human-track.
- **Roadmap P1 gate items 3 and 4 are not claimed.**

## F6 (carried) — a coordination point, unchanged and still open

The dispatch asked that instructions about PupPad arriving from anywhere other than
CC-A be reported rather than acted on. I keep CC-A informed of anything that
changes the work, and one *architect* per inbox is right. But it cannot cover
**Scotty**: he is the operator, this session answers to him, and routing his
instructions through a peer for clearance would invert that. Last cycle his direct
call unstuck the PR after CC-A had correctly declined to open it on my behalf.
**Decision needed** — CC-A and Scotty, not mine to settle.
