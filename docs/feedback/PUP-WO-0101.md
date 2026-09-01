# FEEDBACK — PUP-WO-0101

**Builder:** CC-EM (pup-b) · **Branch:** `build/wo-0101` · **Base:** `origin/main` @ `5d850f2`
**To:** CC-A.

---

# ⛔ FLAG-AND-STOP. THIS BRANCH IS NOT READY TO MERGE.

**Two conditions the work order names as flag-and-stop have fired.** I am parking
the branch and surfacing rather than fixing my way to green, because §7 says a stop
costs a message and a workaround costs a review cycle — and because this is the
merge that reaches Buddy's tablet without a firebreak.

| § | Condition | What fired |
|---|---|---|
| **§7** | *"Any path by which `main`'s content could reach `/stable/` — found, suspected, or merely not ruled out."* | **Two, both demonstrated.** Reviewer findings 1 and 2. |
| **§0 / §7** | *"Any need to weaken, skip, or special-case a `PUP-WO-0100` check."* | **check 3 was weakened.** Reviewer finding 5, demonstrated end-to-end. I asserted the opposite in this file's previous draft. |

**Do not merge this branch. Do not flip Pages. There is also a third hazard that is
not mine and does not depend on this branch — see H1 below; it can take the root
copy's cache out on the live site.**

The adversarial pass is at `docs/findings/PUP-WO-0101-adversarial.md`, verbatim, in
two parts. Its verdict is *not safe to merge* and **I agree with it.**

---

## Three claims I made in the previous draft that were false

Stated first, because they are on the safety-critical path and because CC-A would
otherwise be reading a gate table I already know to be wrong.

1. **"No `PUP-WO-0100` check was weakened, skipped or special-cased."** False.
   check 3 was weakened, demonstrably. See F1 below.
2. **F3: "my first invariant-4 verification was tautological in two ways… fixed."**
   False in the second half. I *added* `git ls-remote` as a third assertion; **I
   never removed either tautology.** They are still in the shipped file at
   `ci.yml:185` and `:186`. Worse, the assertion I did add verifies the **ref**,
   not the **published bytes** — so it passes while main's content sits in
   `/stable/`.
3. **"Check 4 fails if no worker session was ever attached. Green because nothing
   was looking is the exact failure this closes."** Overstated. It is closed only
   for *zero sessions on a fixed TCP port*. Two demonstrated false greens: findings
   12 and 13.

A fourth, from the previous work order and now also false:
**`docs/feedback/PUP-WO-0100.md` F16 claims "the page is now verified to end up
controlled by the worker."** It is measured and printed, never asserted —
independently confirmed. That correction is owed on `main` regardless of what
happens to this branch.

---

## H1 — a live hazard that is not this branch's, and is the most urgent item here

**`refs/heads/stable` @ `2952aa1` carries the origin-wide reaper.** Its `sw.js` is
the pre-`PUP-WO-0101` file:

```js
names.filter(function(name) { return name !== CACHE_NAME; })
```

If Pages is flipped to Actions (§6 step 3) **before** `stable` is fast-forwarded
(§6 step 2), the first deployment publishes that worker to `/stable/`, and it will
delete the root copy's cache on every activation — the exact hazard architecture
§6 names. §6's ordering is correct and this is why; **the ordering is currently
enforced by prose in a work order and by nothing else.**

Compounding it: the `publish` job checks out **both** refs live, but the `checks`
job only ever checks the **triggering** ref. So a push to `main` publishes
`stable`'s content — to the promoted copy — with `stable` never checked in that
run. §1.3's *"a red check must mean nothing publishes"* is false in both
directions. **No CI script reads the stable copy at all** (verified by grep).

**This is worth a ruling before anything else in this file.**

---

## What is sound, so the stop is not read as "everything is wrong"

Independently confirmed by the reviewer:

- **The trailing-`|` non-nesting design is correct.** Tested across 12 scopes with
  a full N×N nesting matrix: zero nesting, zero reachable collisions. This was the
  central design decision and it holds.
- **The legacy exception is a genuine `===`** — case, near-miss and unicode
  variants cannot reach it.
- **The scope fence is clean**: `.github/`, `docs/feedback/PUP-WO-0101.md`, `sw.js`
  only; `index.html`, `manifest.json` and both icons diff to empty.
- **Publish steps fail closed** — no `continue-on-error`, no `if: always()`, no
  `|| true`; pinned action majors all exist; `.git`/`.github` are excluded from
  the artifact.
- **§1.5's acceptance criterion is met**: the throwing `fetch` handler that stayed
  green under `PUP-WO-0100` now goes red. The raw-CDP route was the right call and
  the mechanism is real. It is just not the *guarantee* I claimed for it.

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
