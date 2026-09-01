# PUP-WO-0103 — adversarial pass, verbatim

**This file is the RECORD, not a summary.** Architecture §5. The builder's summary and
dispositions are in `docs/feedback/PUP-WO-0103.md`; neither file summarises the other's
job. `PUP-WO-0102`'s pass raised a blocking finding because this file did not exist and
its mutations were therefore unauditable; that is why it is written before anything is
fixed.

**Subject:** `build/wo-0103` frozen at `c8c8cf1a4dc291877b69d18648d491270d7836d3`.
**Method:** fresh-context subagent, black-box, with a delegated sub-audit of checks
4/6/7 whose findings are relayed with confidence markers. No GitHub credentials, so the
workflow was exercised by transcribing its shell line-for-line against a bare clone of
the real refs (`main`=30036e9, `stable`=2952aa1).
**Freeze:** the workflow, `.github/ci/`, both harnesses, and
`docs/feedback/PUP-WO-0103.md` were committed as `c8c8cf1` before dispatch.

**Verdict: three disqualifying findings.** Two of the three are in changes the builder
made during this work order, in response to real problems.

---

## 1. The prompt, exactly as given

```
You are running an ADVERSARIAL REVIEW of a frozen artifact. You are not its author and
have no knowledge of how or why it was built. Judge only what is in front of you.

REPO: /home/ikthys777/worktrees/PupPad/builder  (branch build/wo-0103, frozen at c8c8cf1)

PupPad is an offline-first PWA — a pretend command console for a three-year-old who
cannot read. It is published to GitHub Pages at TWO paths on ONE origin: the site root
(newest build, a test device) and /stable/ (the promoted build, the CHILD'S home-screen
icon). This work order builds the PUBLICATION pipeline. The service worker itself was
built by a previous work order, is already merged and live on the child's tablet, and
is PROTECTED here — sw.js must not differ from origin/main.

GROUND TRUTH — read first; ratified, not under review:
  docs/northstar.md                 invariants, each with its own falsification test
  docs/architecture.md              §5 rulings, §6 deploy topology, §6.1
  docs/work-orders/PUP-WO-0103.md   the work order this artifact claims to satisfy

THE ARTIFACT — all fair game:
  .github/workflows/ci.yml          the workflow, including the publish and deploy jobs
  .github/ci/check-two-trees.mjs    the two-published-workers harness (new)
  .github/ci/*.mjs, lib/*.mjs       the checks and harnesses
  docs/feedback/PUP-WO-0103.md      the builder's own account — A CLAIM, NOT A RESULT

YOU MAY RUN THINGS. node 24; a Chromium is at ~/.cache/ms-playwright/chromium-1194.
Checks take a directory as argv[2]. To test a mutation, COPY the tree to a scratch dir
under /tmp and mutate the copy.
DO NOT MODIFY THE REPOSITORY — it is frozen. Do not commit, push, stash, or change any
file under /home/ikthys777/worktrees/PupPad/builder. Copy with `cp -r`, never `cp -a`:
this is a git WORKTREE, and preserving its .git pointer file into a scratch copy makes
stray commits land on the frozen branch.
You have no GitHub credentials and cannot trigger CI. Reason about the workflow by
reading it and by simulating its shell locally.

PROBES — the work order names these; you are not limited to them.

1. GET main's CONTENT ONTO /stable/. THE HIGHEST-VALUE PROBE BY A WIDE MARGIN, and
   anything found here outranks everything else in the pass. Northstar invariant 4 is
   "the copy Buddy uses advances only when a human promotes it." Any path — found,
   suspected, or merely NOT RULED OUT — by which the root build's bytes could appear
   at /stable/ is the finding this review exists for. Consider: the archive path, the
   directory build, tar behaviour, the checkout refs, the workflow_dispatch inputs,
   concurrency and run ordering, artifact reuse between jobs and between runs.

2. ATTACK THE ROLLBACK LEVER as a publication path. It takes a 40-hex SHA and requires
   it to be an ancestor of refs/heads/stable. Can it publish content a human did not
   name? Can the ancestry test be defeated, raced, or made vacuous?

3. ATTACK THE ARCHIVE beyond .gitattributes and symlinks. `git archive` and the Pages
   artifact tar are the two places published bytes can differ from committed bytes.

4. FIND A CHECK THAT CANNOT GO RED, and a check MISSING from the publish path. The
   builder claims a specific list of which checks run against each published copy and
   why each is or is not there. Verify that list against what the workflow does.

5. ASK OF EVERY FIX: WHAT LEGITIMATE BEHAVIOUR DOES THIS NOW REFUSE? The probe that has
   caught the most on this project. The builder's own account records a validation step
   that failed the runs it existed to let through — look for more of that shape.

6. VERIFY THE BUILDER'S CLAIMS. docs/feedback/PUP-WO-0103.md asserts protected surfaces
   diff to empty, that publication permissions are confined to one job, that observation
   windows are justified, and that specific defects were found and fixed. Check them.
   Cite file:line. A claim you cannot reproduce is a finding.

REPORT — one entry per finding, most serious first:
  finding · where (file:line) · type · why it matters · recommendation · decision-needed?

Rank by consequence to the CHILD'S TABLET, not by cleverness. Say plainly which findings
are disqualifying, which are real-but-tolerable, and which are cosmetic. If you find
nothing serious, say so and say what you tried — an empty result you stand behind beats
a padded list. Quote exact commands and exact output. Do not speculate about intent.
```

---

## 2. The pass's report, unedited

# Adversarial review — PUP-WO-0103 @ c8c8cf1

**Complete record, restated in full.** Part I is the original report exactly as first written (F1–F15). Part II is the addendum exactly as first written (F0 and the relayed audit). Part III answers the three precision requests and the direct question, and is new material clearly marked as such so the verbatim record above it stays intact.

The repo is unmodified throughout: `git status --porcelain` is empty and HEAD is still `c8c8cf1a4dc291877b69d18648d491270d7836d3` at every checkpoint, including after the final run. All experiments ran in `/tmp/claude-1000/.../scratchpad`, against a bare clone of the real refs (`main`=30036e9, `stable`=2952aa1), driving a line-for-line transcription of the publish job's shell. Copies were made with `cp -r`, never `cp -a`; no `.git` pointer file was copied.

---
---

# PART I — the original report, verbatim

The repo is unmodified (`git status` clean, HEAD still `c8c8cf1`). All experiments ran in `/tmp/claude-1000/.../scratchpad`, against a bare clone of the real refs (`main`=30036e9, `stable`=2952aa1), driving a line-for-line transcription of the publish job's shell.

**Verdict: two disqualifying findings, both on the promoted copy.** The artifact is careful and most of it holds up under attack — the byte assertion is real, the ancestry gate is real, the archive refusals work. The failures are at the seams between mechanisms, not inside them.

---

## F1 — DISQUALIFYING · A rollback is erased by the next push to `main`, with no human action

**Where:** `ci.yml:26-32`, `ci.yml:300-311`, `ci.yml:645-647`

**Type:** invariant-4 violation / the emergency lever does not hold

A rollback dispatch deploys `/stable/` from a human-named SHA but **does not move `refs/heads/stable`**. Every subsequent run rebuilds the promoted copy from `refs/heads/stable`:

```yaml
ref: ${{ (... inputs.stable_sha != '') && github.event.inputs.stable_sha || 'refs/heads/stable' }}
```

and `ci.yml:29-32` states the behaviour explicitly: *"A push to either ref rebuilds BOTH copies from their own refs."* So the very next merge to `main` — which in an emergency is the fix-forward commit — silently republishes to Buddy's tablet the exact build the human just rolled away from. Northstar invariant 4's own falsification test ("land any commit through the automated path; observe the promoted copy change without a human action") passes.

The same mechanism makes a milder version routine: `build-stamp.json` is rewritten under `/stable/` on **every** push to `main` (`ci.yml:589-610`, `built_at` and `run` change every run), so bytes under the promoted copy change without a human promoting anything.

**Recommendation:** the lever must make its effect durable or refuse to exist. Either (a) require the human to move `refs/heads/stable` and let the lever be "republish the ref" (the lever then becomes unnecessary), or (b) persist the rollback pin — e.g. a `refs/heads/stable-pin` the publish job prefers over the tip, cleared only by a human — and fail the run loudly while a pin is live. Option (a) is smaller and removes a mechanism rather than adding one.

**decision-needed: yes.** There is a defensible counter-reading — after reversion `/stable/` equals the last human promotion, so "advances only when a human promotes" is arguably intact. But the lever exists precisely because that state is the emergency, and nothing warns that the fix expired.

---

## F2 — DISQUALIFYING under §7's own bar · `verify` builds and fully green-lights main's bytes at `/stable/`; one expression stands between that artifact and the site

**Where:** `ci.yml:238` (`DRY_RUN`), `ci.yml:350-362` (the verify branch that *skips* the equality test), `ci.yml:622-623`, `ci.yml:645-647`

**Type:** flag-and-stop not raised — §7: *"Any path by which `main`'s content could reach `/stable/` — found, suspected, or merely **not ruled out**."*

Acceptance item 3 says: *"put `main`'s bytes in the stable directory and show publication **refuses**."* It does not refuse. It passes, end to end. Reproduced exactly, including the builder's own hash:

```
$ EVENT=workflow_dispatch MODE=verify STABLE_SHA=30036e9c3aa4f630be18912b6184582b66fb0544 bash pub.sh
main:   checkout=30036e9c3aa4 remote=30036e9c3aa4
stable: checkout=30036e9c3aa4 remote=2952aa1a8443
stable: VERIFY against hypothetical promoted copy 30036e9c3aa4 (real tip 2952aa1a8443)
OK: both trees can only publish their own committed bytes.
root (/):            tree=b00e76ad5fd9fa30 published=b00e76ad5fd9fa30
promoted (/stable/): tree=b00e76ad5fd9fa30 published=b00e76ad5fd9fa30
OK: both published copies are byte-for-byte their own commit's tree.
```

Then every browser check on that artifact, run with the real scripts:

```
(the two published copies are byte-identical)
--- the named /stable/ call site (ci.yml:492) ---
  PASS  <-- main's worker accepted as the promoted copy
  check-syntax/check-assets/check-cache-isolation/demo-two-path-caches   dist         PASS
  check-syntax/check-assets/check-cache-isolation/demo-two-path-caches   dist/stable  PASS
  check-load dist  PASS      check-load dist/stable  PASS
TWO-TREE CHECK PASSED
```

This is the builder's own §3.2 headline evidence (`docs/feedback/PUP-WO-0103.md:91-93` — same `b00e76ad5fd9fa30` on both lines). The green run the feedback offers as proof that §1.2 works **is** the state §1.2 exists to forbid.

What stops it publishing is one boolean at `ci.yml:647`. There is no defence in depth: nothing marks the artifact, `dist` is left fully built, and the `deploy` job re-asserts nothing — it deploys whatever `github-pages` artifact the run produced. The "verify never deploys" invariant is written **twice, in two different forms** (`DRY_RUN` at `:238`; the `if` at `:647`) and neither derives from the other, so a future edit to one alone silently publishes a verify build.

**Recommendation, cheapest first:**
1. In verify mode, `rm -rf dist` after the last check, or write a `DO-NOT-DEPLOY` sentinel into `dist/` — a bypassed gate then deploys nothing usable.
2. Give the `deploy` job an independent re-assertion: download the artifact and require `stable/build-stamp.json`'s sha to equal `git ls-remote origin refs/heads/stable`. Today the deploy job trusts `publish` entirely.
3. Derive one condition from the other (a job output), so they cannot drift.

**decision-needed: yes** — whether verify may substitute `stable_sha` at all. The builder's justification (defect #4/#5: refusals were otherwise undemonstrable) is real, but `main_sha` alone already covers acceptance item 3's three refusals, which are all properties of *main*'s tree.

---

## F3 — SERIOUS · §1.4's mechanism inherits check 5's coverage, and check 5 barely exercises the promoted scope

**Where:** `check-cache-isolation.mjs:91-110` (six assertions, `ROOT_SCOPE` only) vs `:184-191` (stable scope: store is `[LEGACY, stableName]`, one assertion)

**Type:** the named call site asserts less than it appears to. *(Attribution: this file is PUP-WO-0102's and is byte-identical to `origin/main` — `git diff origin/main -- .github/ci/check-cache-isolation.mjs` is empty. But PUP-WO-0103 §1.4 makes it the whole mechanism, and `ci.yml:492-525` is the named call site.)*

The reap-survival matrix — root cache, other-path cache, adjacent prefix, unrelated cache — is dispatched only at `ROOT_SCOPE`. The one `activate` at `STABLE_SCOPE` is handed a two-entry store and asserts only that the legacy literal survives. A worker that reaps origin-wide **only when running at the stable scope** passes. `sw.js` already branches on scope (`IS_STABLE_WORKER`, the legacy exception), so a scope-conditional defect is the realistic shape, not a contrived one. A delegated audit independently constructed exactly that mutant and it went green; the code path is verifiable from the two line ranges above without running anything.

The same asymmetry holds for `install` (`:355-368` dispatches at `ROOT_SCOPE` only).

**Recommendation:** run the full `expectGone`/`expectKept` matrix, and the install inspection, at **both** scopes. Cheap — it is a loop over two scope constants.

**decision-needed:** whether this rides in 0103 (it is the mechanism 0103 claims) or goes back to 0102's file as a follow-up.

---

## F4 — SERIOUS · `check-two-trees.mjs`'s invariant-7 assertions never run during real promotion lag

**Where:** `check-two-trees.mjs:155-166` (`if (manufactured)`), verdict at `:204-205`

**Type:** a check that reports coverage it did not exercise — §1.5, the work order's "hardest acceptance item"

The cross-serving test — the one that quotes invariant 7's own falsification wording — is gated on `manufactured`, which is true only when the two published workers are **byte-identical**. When they genuinely differ, which the check's own docblock calls *"the normal condition of this deployment"* and *"the state that matters"*, the marker does not exist and nothing compares the two titles. They are computed, printed, and dropped — the exact §1.8 defect pattern this project already named: *"a value that is measured and printed reads, in a green run, exactly like a value that is asserted."*

Demonstrated with a realistic lag pair (root `v18` + changed title, stable `v17`, both otherwise the frozen `sw.js`):

```
$ node .github/ci/check-two-trees.mjs .../lag/root .../lag/stable
  the two published trees already carry different workers — real promotion lag
  offline: root title="Pup Pad NEWROOT"  stable title="Pup Pad"
  ok    both copies load offline, each from its own worker
TWO-TREE CHECK PASSED — two DIFFERENT published workers coexist on one origin:
  distinct caches, neither reaps the other, and each serves its own build offline.
```

No `served its own build offline, not the root's` line — compare `docs/feedback/PUP-WO-0103.md:146`, which quotes it from a *manufactured* run. The banner claims a property the run did not test.

**Two further defects in the same file, found by running it on the real pair** (root=main, `/stable/`=2952aa1):

```
  caches after both published workers installed: pup-pad-v16
  FAIL  the two published copies did not produce two caches
  ok    the two published copies' cache names are distinct        <-- vacuous, one element
  caches at end: pup-pad-v16, puppad|%2F|v17
  ok    cache survived the whole exercise: pup-pad-v16            <-- the destroyed cache was never in the baseline
```

- `:130-132` — `new Set(names).size === names.length` is trivially true for a one-element array, so it prints `ok ... distinct` on the input where one build's cache was destroyed.
- `:126-129` / `:187-190` — the survival baseline `names` is sampled **after both workers have activated**, so a reap that happens *during* the second activation is outside the observation window entirely. `puppad|%2F|v17` was destroyed and recreated; the check reported only survivals.

**Recommendation:** manufacture the marker unconditionally (append a distinct sentinel to *each* copy's `index.html` title in the scratch trees, whether or not the workers differ) so the cross-serving test always runs; gate `distinct` on `names.length >= 2`; capture the cache baseline *before* the second registration.

---

## F5 — SERIOUS · The new harness has no "can it go red" coverage, and check 7's scope is narrower than the workflow claims

**Where:** `check-mutations.mjs:57-105` (copies `sw.js` + `.github/ci`, re-runs **only** `check-cache-isolation.mjs`) vs `ci.yml:169-180`

**Type:** missing check on the publish path / §3.9 not met for this work order's own deliverable

`grep -n "two-trees\|check-load\|check-assets\|check-syntax" .github/ci/check-mutations.mjs` returns nothing. Check 7 mutates the worker and check 5's harness and asserts check 5 goes red. It says nothing about `check-two-trees.mjs` — the harness this work order built — nor about any workflow assertion. `ci.yml:169-180` describes check 7 as *"the step that makes green mean something"* without stating that its subject is one check.

F4 is what that gap costs: the new harness ships with a live branch (`if (manufactured)`) that disables its headline assertion in the deployment's normal state, and nothing in CI would have said so.

**Recommendation:** add mutations for `check-two-trees.mjs` — at minimum, one that makes the two trees differ and plants a cross-served asset, expecting RED. Amend `ci.yml:169-180` to state check 7's actual scope.

*(One thing verified good: check 7 copies to `mkdtempSync` and mutates only there — `check-mutations.mjs:58-62`, `rmSync` in `finally` at `:104`. The frozen tree is never touched.)*

---

## F6 — SERIOUS · Shell injection in the input-validation step, executing before the validation

**Where:** `ci.yml:251`, `:256`, `:268`, `:272`, and again at `:324-326`

**Type:** classic GitHub Actions script injection

Free-text `workflow_dispatch` inputs are pasted into `run:` source inside single quotes. Rendered and executed faithfully:

```
--- rendered step source (mode=rollback, main_sha=<payload>) ---
if [ -n 'x'; echo '>>> ARBITRARY SHELL RAN IN THE PUBLISH JOB'; touch /tmp/PWNED; :'' ] && [ 'rollback' != verify ]; then
--- executing it ---
/tmp/step.sh: line 2: [: missing `]'
>>> ARBITRARY SHELL RAN IN THE PUBLISH JOB
::error::main_sha is accepted in verify mode ONLY.
--- did the payload execute? ---
-rw-rw-r-- 1 ikthys777 ikthys777 0 /tmp/PWNED
```

The 40-hex validation at `:257-261` runs **after** the interpolation it is meant to make safe. The `for sha in '...' '...'` loop at `:256` and the assignments at `:324-326` carry the same hole.

**Honest limit on exploitability:** both injectable inputs double as `actions/checkout` `ref:` values (`:296`, `:309`), so a payload that survives to a deploy must also be a resolvable git ref — I could not construct one. So this is arbitrary code execution in a `contents: read` job by someone who already has write access, not a demonstrated publication path. It is still the shape §7 warns about: it can run before the ancestry check and write `$GITHUB_ENV`/`$GITHUB_PATH`, which is how "the ancestry test made vacuous" would look.

**Recommendation:** pass every input through `env:` and reference `"$MAIN_SHA"` / `"$STABLE_SHA"` / `"$MODE"` — never `${{ }}` inside `run:`. Four lines.

---

## F7 — REAL · `mode=rollback` with no `stable_sha` skips the guard that forbids it, and deploys

**Where:** `ci.yml:248` (the step's `if:`) vs `ci.yml:268-271` (the guard inside it)

**Type:** a check that cannot go red

The guard reads:

```yaml
if: github.event_name == 'workflow_dispatch' && (inputs.stable_sha != '' || inputs.main_sha != '')
...
if [ '...mode...' = rollback ] && [ -z '...stable_sha...' ]; then
  echo "::error::rollback requires stable_sha: a human must name the commit to publish."
```

Reaching that branch requires `stable_sha == ''`, which by the step's own `if:` requires `main_sha != ''`, which the *first* test at `:251` has already exited 1 on. **The branch is unreachable.** Confirmed:

```
$ EVENT=workflow_dispatch MODE=rollback MAIN_SHA= STABLE_SHA= bash pub.sh
### STEP: named-commit input validation
  (step SKIPPED by its if: condition)
...
OK: both published copies are byte-for-byte their own commit's tree.
### PIPELINE REACHED THE CHECKS
```

Consequence is bounded — with no `stable_sha` the run publishes both refs at their tips, so nothing unpromoted reaches `/stable/`. But `mode=rollback` is silently a "deploy now" button, and the guard the workflow advertises can never fire. This is the same trap the builder documented as defect #6, one step over.

**Recommendation:** move the mode/argument validation out of the conditional step, or drop the `if:` and run it on every dispatch.

---

## F8 — REAL · The rollback lever currently has **zero** valid targets, and cannot be used at all

**Where:** `ci.yml:365-388` (ancestor-of-stable rule) × `ci.yml:492-525` (the `/stable/` check-5 refusal)

**Type:** §5's own question — *what legitimate behaviour does this fix now refuse?*

The lever accepts only ancestors of `refs/heads/stable`. Every one of the 43 commits reachable from `refs/heads/stable` predates PUP-WO-0102, so every one is refused by the `/stable/` check:

```
  2952aa1 docs: PUP-WO-0000 …           sw.js has CACHE_PREFIX: NO -> check 5 refuses
  a4be019 docs: genesis documents …     sw.js has CACHE_PREFIX: NO -> check 5 refuses
  … (43 commits, all NO)
is PUP-WO-0102's merge (922c2dc) an ancestor of stable?  NO
```

§1.7 ruled that *"a promoted copy nobody can roll back is a safety mechanism you cannot use in the emergency it was built for."* Each mechanism is individually correct; together they reproduce exactly that condition for the whole first phase of the lever's life. After the fast-forward, the reachable set is only the post-0102 commits — on day one, at most one prior state.

The feedback states this as *"the lever's SUCCESS path is unexercised"* (`PUP-WO-0103.md:162-166`). That understates it: today it is **unexercisable**, and the reason is a second mechanism in the same file.

**Recommendation:** state it in the runbook (§6) — the lever becomes usable only once `stable`'s history holds ≥2 post-0102 commits — or let a rollback bypass the `/stable/` check when the named SHA was itself published green before (requires a published-history record).

**decision-needed: yes** — the builder already raised the adjacent question; this is the sharper form of it.

---

## F9 — REAL · A red `/stable/` masks every root-copy finding, permanently until the fast-forward

**Where:** `ci.yml:492` (named `/stable/` step) placed **before** `ci.yml:526` (per-copy loop)

**Type:** the fix for defect #3 created the inverse of defect #8

The named step was moved before the loop so acceptance 5a's call site always runs. Because a failed step aborts the job, the consequence is that **while `/stable/` is bad, no root-copy check ever executes.** That is today's permanent state: every push to `main` between this merge and the fast-forward will report only `THE /stable/ COPY'S WORKER IS NOT PREFIX-BOUNDED` and nothing about `main`. Verified:

```
--- /stable/ copy (stable @2952aa1) ---
check-cache-isolation    FAIL  →  CHECK 5 FAILED — this copy's sw.js defines no CACHE_PREFIX.
```

It is also the builder's own defect #8 with the sign flipped: *"a red run of mine proved nothing — the planted defect was never reached."*

**Recommendation:** `continue-on-error: true` on the named step plus a final gate step, or `if: always()` on the loop. Both copies should be judged in every run; the loop already accumulates `fail` rather than aborting.

---

## F10 — REAL · The "published bytes" assertion does not hash the published bytes, and is blind to symlinks

**Where:** `ci.yml:466` — `find . -type f -not -path './stable/*'`

**Type:** the last assertion before upload has two blind spots

**(a) Symlinks.** `-type f` excludes them, so a symlink at a path not in the commit's tree is invisible to the assertion — while `actions/upload-pages-artifact` tars with `--dereference` (confirmed in the action's own `action.yml`: `tar --dereference --hard-dereference …`). Demonstrated:

```
=== C) a SYMLINK added under dist/stable/ pointing at the runner filesystem ===
root (/): tree=b00e76ad… published=b00e76ad…
promoted (/stable/): tree=2a2923a9… published=2a2923a9…
  OK
  --- what upload-pages-artifact would publish: ---
root:x:0:0:root:/root:/bin/bash
```

Committed symlinks are refused at `:415-419`, so this only bites in combination with F6 or a future workflow edit — but it means the step the work order calls *"the work order"* cannot see the hazard the step above it exists to prevent.

**(b) The uploader strips files the assertion hashed.** `upload-pages-artifact@v4.0.0` is a documented breaking change: *"hidden files (specifically dotfiles) will not be included in the artifact"*, and the tar excludes `.git`, `.github`, and `.[^/]*`. So `dist` ≠ the published bytes. Today that is a strict subset and fails safe, but the mapping is set by a third-party action that changed it in a breaking way one major ago, and nothing verifies it. If a future asset ever needs a dotfile path, it will be silently absent from the site while this assertion stays green — the `/my%20photo.png` shape architecture §5 rules against.

**Recommendation:** add `-o -type l` to the find and fail on any symlink in `dist`; and either apply the uploader's exclusion set before hashing, or assert the tar's manifest after the upload step.

---

## F11 — REAL BUT TOLERABLE · Job-level concurrency repeats the eviction defect the builder just fixed

**Where:** `ci.yml:235-236` (`pages-publish`), `ci.yml:663-664` (`pages-deploy`), vs the workflow-level fix at `ci.yml:90-91`

The builder established empirically (feedback:63-70; `ci.yml:59-70`) that GitHub permits **one pending run per concurrency group** and a newly queued one evicts the pending one *regardless of* `cancel-in-progress`. Both new groups are `cancel-in-progress: false` and their comments assert the opposite of what was learned: *"deployments serialise"* (`:73-75`), *"Never cancel a deployment in flight"* (`:661-662`). In-flight is the half that is protected; **pending** is the half that was the defect. Three rapid merges should be expected to leave a middle run cancelled while pending — a run that is neither green nor red, which is exactly the outcome the builder describes as *"absence looked like completion."*

I could not test this (no CI access), so I state it as requiring confirmation, not as proven. Content impact is low — the following run republishes both refs from their tips — but the missing verdict is the same loss as `922c2dc`.

**Recommendation:** confirm the pending-eviction rule applies at job level; if so, key `pages-publish` and `pages-deploy` by `github.run_id` for dispatches, or accept and document it.

---

## F12 — REAL · The `§1.6` observation-window justification is false for check 5

**Where:** `docs/feedback/PUP-WO-0103.md:179-181` vs `check-cache-isolation.mjs:122-136`

The feedback states: *"250 ms post-settle trap. Bounded and stated: a timer longer than the remaining process lifetime still escapes. That limit is real and is not papered over."* The source comment at `:122-126` says the same: *"from here to the end of the run, any deletion at all is recorded and fails the check."*

Both are false. `grep -n afterSettle`:

```
127:const afterSettle = [];
129:store.delete = async (name) => { afterSettle.push(name); return realDelete(name); };
131:if (afterSettle.length === 0)
135:      `${afterSettle.join(', ')} …
```

It is read **once**, immediately after the 250 ms sleep, and never again. A pending timer also *extends* the process lifetime, so a long timer fires inside the run, is recorded, and is never looked at. The real window is 250 ms flat. §1.6 is this work order's own scope and explicitly required *"State each window and why it is long enough"* — the stated bound is wider than the real one by the entire remaining run.

**Recommendation:** re-read `afterSettle` immediately before the verdict at the end of the file, and correct the feedback's §1.6 entry. *(A delegated audit reproduced escape with a 300 ms and a 5000 ms delayed origin-wide reap; the read-once fact is verifiable from the four lines above without running anything.)*

---

## F13 — REAL BUT TOLERABLE · Two false refusals, one with a false invariant-4 alarm

Both demonstrated against synthetic commits pushed to the simulated remote.

**(a) A `stable/` directory inside the *stable* tree is refused, and the message blames invariant 4.** `ci.yml:466`'s `-not -path './stable/*'` filter is meaningful only for the root copy but is applied to both:

```
############ I — stable/ subdirectory inside the STABLE tree
OK: both trees can only publish their own committed bytes.
promoted (/stable/): tree=25832e11e0bb40dc published=2a2923a9b4f57cec
::error::promoted (/stable/) — the bytes about to be published are NOT the commit's tree.
```

Legitimate content, refused, under `REFUSING TO PUBLISH — northstar invariant 4`. **Fix:** apply the exclusion only in the root copy's call.

**(b) A file merely *ending* in `.gitattributes` blocks all publication.** `ci.yml:411`'s `grep -q '\.gitattributes$'` matches `notes.gitattributes`, which git does not honour:

```
############ J — notes.gitattributes-in-main
::error::main carries a .gitattributes. git archive honours it…
```

**Fix:** `grep -qE '(^|/)\.gitattributes$'`. (`docs/.gitattributes` is correctly caught and *should* be — verified.)

---

## F14 — COSMETIC · A blob named `stable` in `main` evades its dedicated guard

**Where:** `ci.yml:433` (`grep -q '^stable/'`)

A regular file named `stable` (not a directory) passes the guard and is then destroyed by `rm -rf dist/stable` at `:443`. Fail-closed, but only via the byte assertion, whose message says nothing about the collision:

```
############ H — file-named-stable-in-main
OK: both trees can only publish their own committed bytes.
root (/): tree=a542fc90fb9b7cf1 published=b00e76ad5fd9fa30
::error::root (/) — the bytes about to be published are NOT the commit's tree.
```

Same for a submodule (gitlink) at that path. **Fix:** `grep -qE '^stable(/|$)'`.

---

## F15 — DECISION-NEEDED · The `github-pages` environment's branch policy is doing unacknowledged security work

**Where:** `ci.yml:657-659`, and the builder's defect #1

`workflow_dispatch` runs the workflow file **from the dispatched ref**, so `ci.yml`'s deploy gate is only as strong as the ref selected. The thing that actually constrains this is the `github-pages` environment's `branch_policy` — a repository setting, discovered by accident (it rejected the publish job with `"steps":[]`) and then routed around rather than reasoned about. Nowhere is it recorded what that policy currently allows. If it permits all branches, a branch carrying an edited `ci.yml` deploys whatever it likes to `/stable/`.

**Recommendation:** record the policy's current value in `docs/architecture.md` §6 and confirm it is restricted to `main`. This is Scotty's to check (§7) but it belongs in the record, because "invariant 4 is enforced by the workflow" is only true for the workflow at the dispatched ref.

---

## Claims I verified — and one I could not

| Claim (`docs/feedback/PUP-WO-0103.md`) | Result |
|---|---|
| Protected surfaces diff to empty (`index.html`, `sw.js`, `manifest.json`, both icons) | **TRUE** — `git diff origin/main -- …` prints nothing |
| Diff scope is `.github/` and `docs/` only | **TRUE** — 4 files: `ci.yml`, `check-two-trees.mjs`, `check-mutations.mjs`, the feedback doc |
| `pages: write` + `id-token: write` in the deploy job alone | **TRUE** — top-level and `publish` are `contents: read` (`:52`, `:213`); elevated scope only at `:653-656` |
| The check list at `ci.yml:534-556` (1,2,5,6 per copy; 4 separately; 3 and 7 excluded, with reasons) | **TRUE** — matches the loop at `:559` and `:571-578` exactly |
| The four `demo/refuse-*` branches carry the real defects | **TRUE** — `2fddd80` (`index.html export-subst`), `8cb9387` (`leak.txt -> /etc/passwd`), `c72f478` (`stable/index.html`), `3d27d06` (sw.js mutation). None is an ancestor of `stable`; the lever cannot reach them |
| Defect #9 fixed — the two-tree check reports instead of crashing on its headline case | **TRUE** — run on root=main / `/stable/`=2952aa1 it exits 1 with two named FAILs, no stack trace (though see F4 for what it reported `ok` on) |
| `git archive` honours `.gitattributes`; the Pages artifact tars with `--dereference` | **TRUE** — confirmed in `actions/upload-pages-artifact@v4`'s own `action.yml` |
| All four pinned action majors exist (`checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v4`, `deploy-pages@v4`) | **TRUE** — verified against the GitHub API. Both Pages actions are now at v5; the v4/v4 pairing is compatible |
| "13 runs on this branch" | **UNVERIFIABLE** — no GitHub credentials. Not a finding, but not evidence either |

**What I attacked and could not break:** the ancestry gate (`main`'s tip correctly refused: `::error::30036e9c3aa4… is NOT an ancestor of refs/heads/stable`; the fetch-vs-`ls-remote` cross-check closes the TOCTOU window fail-closed); the byte assertion against real substitution (`cp dist/sw.js dist/stable/sw.js` → `tree=2a2923a9… published=a12ff931…` → refused); submodules and files-named-`stable` (fail-closed via the byte assertion); `tar | tar -x` merging (`rm -rf dist/stable` is correct); PR events reaching `publish` (excluded at `:204-207`); `demo-two-path-caches` leaking `dist/stable/` into its own `/stable/` route (it rewrites the path against one tree — `:54-57` — so it does not).

---

## Summary

| # | Finding | Severity |
|---|---|---|
| F1 | Rollback erased by the next push to `main` | **disqualifying** |
| F2 | `verify` green-lights main's bytes at `/stable/`; one expression is the gate | **disqualifying** (§7 flag-and-stop) |
| F3 | Check 5 barely exercises the promoted scope, and §1.4 rests entirely on it | serious |
| F4 | Two-tree check's invariant-7 assertions skipped during real lag; two vacuous `ok`s | serious |
| F5 | New harness has no mutation coverage; check 7's scope overstated | serious |
| F6 | Shell injection ahead of the input validation | serious |
| F7 | `rollback` with no `stable_sha` bypasses its own guard | real |
| F8 | The lever has zero valid targets today | real, decision-needed |
| F9 | A red `/stable/` masks all root-copy findings | real |
| F10 | Byte assertion blind to symlinks; hashes a different set than is published | real |
| F11 | Job-level concurrency repeats the pending-eviction defect | real, needs confirmation |
| F12 | §1.6's stated observation window is false for check 5 | real |
| F13 | Two false refusals, one with a false invariant-4 message | tolerable |
| F14 | A blob named `stable` evades its guard | cosmetic |
| F15 | Environment branch policy unrecorded | decision-needed |

F1 and F2 both land on the promoted copy and both are the shape §7 names. F2 in particular: the builder's headline green run *is* the forbidden state, and the report reads it as proof the mechanism works.

---
---

# PART II — the addendum, verbatim

## F0 — DISQUALIFYING, and now the most serious finding in the pass · Nothing in the publish path can observe the root worker eating the promoted copy's cache

**Where:** `demo-two-path-caches.mjs:90-94` and `:128-143` (check 6) · **`check-two-trees.mjs:120-126`** (this work order's own harness) · justified in `ci.yml:158-167` and `:544-547`

**Type:** invariant 3 and 7 falsified on the child's tablet, under a fully green gate — architecture §6.1's scar, repeating

### The mechanism

Check 6's item-4 assertion is the named roadmap P1 gate 4: *"THE /stable/ CACHE SURVIVED the root worker activating."* Two defects make it vacuous:

**(a) The root worker's only `activate` runs before the promoted cache exists.** The seed at `:90-94` plants `pup-pad-v16`, root's own `SEED_STALE`, and `some-other-app` — **not** `STABLE_CACHE`. Root registers at `:97-102`; stable registers *after*, at `:104-109`. So the root reap never once executes with `/stable/`'s cache on the origin.

**(b) The "force-activate" block is a no-op.** `:128-135` calls `r.update()` against a byte-identical `sw.js`. The browser byte-compares, installs nothing, and **no second `activate` fires**. The comment concedes what it needs — *"skipWaiting() in sw.js makes this take"* — but with no new worker there is nothing to skip to.

**And `check-two-trees.mjs` — PUP-WO-0103's own file, §1.5's "hardest acceptance item" — reproduces the same blindness:**

```js
const rootPage = await context.newPage();
await register(rootPage, `${ORIGIN}/index.html`);        // root activates: no stable cache yet
const stablePage = await context.newPage();
await register(stablePage, `${ORIGIN}/stable/index.html`);
const names = await keys(rootPage);                       // baseline sampled after the fact
```

Root activates first, stable second, baseline sampled last, and root is never re-activated. The harness built to backstop check 6 has check 6's defect.

### Reproduced end to end

A root worker that deletes `/stable/`'s caches on activate, planted in a scratch copy of the frozen `sw.js`:

```
$ node .github/ci/check-cache-isolation.mjs $S/killstable   -> PASS (exit 0)
$ node .github/ci/demo-two-path-caches.mjs  $S/killstable   -> PASS (exit 0)
  after both workers installed:            some-other-app, puppad|%2F|v17, puppad|%2Fstable%2F|v17
  after force-activating the ROOT worker:  some-other-app, puppad|%2F|v17, puppad|%2Fstable%2F|v17
  ok    THE /stable/ CACHE SURVIVED the root worker activating (item 4 — roadmap P1 gate 4)
```

Identical before and after — nothing activated. Then the **whole PUP-WO-0103 publish path**, on the deployed shape (the same committed `sw.js` at both paths):

```
--- named /stable/ call site (ci.yml:492) ---   check-cache-isolation dist/stable : PASS
--- per-copy loop (ci.yml:526) ---              all 8 (syntax/assets/cache-isolation/two-path × 2 copies) : PASS
--- check-load (ci.yml:571) ---                 dist : PASS      dist/stable : PASS
--- the two published workers as a pair (ci.yml:580) ---
  ok    cache survived the whole exercise: puppad|%2F|v17-rootlag
  ok    cache survived the whole exercise: puppad|%2Fstable%2F|v17
TWO-TREE CHECK PASSED — … distinct caches, neither reaps the other …
```

Every gate green. On the tablet: `/stable/`'s cache is deleted on every root activation, forever — Buddy's copy has no offline capability, which is invariant 3, and the pair is invariant 7. This is precisely the failure `ci.yml:492-525` says the named call site exists to prevent.

### Correction to the delegate's framing — and a third finding it uncovers

The delegate attributed the escape to `typeof ExtendableEvent` sandbox detection. **That is not the mechanism.** I removed the detector and re-ran:

```
GENERIC cross-prefix reaper (no sandbox detector), check 5: RED (caught)
  FAIL  reap DELETED the OTHER deploy path's cache — this is the origin-wide reap (architecture §6)
GENERIC cross-prefix reaper, check 6: PASS <-- NOT CAUGHT
```

So: **check 5 catches the general case correctly.** Check 6 catches it *never* — with or without a detector — because of (a) and (b). What escapes *everything* is a reap keyed to the **path literal**, and the reason is a third defect:

**The three cache checks disagree about what the deploy paths are.** `check-cache-isolation.mjs:26-27` uses the real Pages paths (`https://ikthys777.github.io/PupPad/`, `/PupPad/stable/` → prefixes `puppad|%2FPupPad%2F|`, `puppad|%2FPupPad%2Fstable%2F|`). `demo-two-path-caches.mjs` and `check-two-trees.mjs` serve on loopback `/` and `/stable/` → `puppad|%2F|`, `puppad|%2Fstable%2F|`. **Neither browser check ever exercises the deployed path shape** — and that shape is the one `sw.js:20-26` singles out as load-bearing: *"the paths themselves violate it — `/PupPad/` IS a prefix of `/PupPad/stable/`."* A predicate matching one shape is invisible to the checks using the other. My first mutant is exactly that and escapes all three.

**Recommendation (all cheap, all `check-two-trees.mjs` is 0103's to fix):**
1. Seed `STABLE_CACHE` before the root worker ever registers (check 6, `:90-94`), or register stable **first**.
2. Make the re-activation real: check-two-trees already builds a genuinely different `-rootlag` worker — register *that* after stable's cache exists, and assert stable's cache survives. In check 6, `:128-135` needs a byte change to install anything.
3. Capture the survival baseline **before** the second registration (`check-two-trees.mjs:126`).
4. Serve the browser harnesses under `/PupPad/` and `/PupPad/stable/` so all three checks agree with the deployment and with each other.
5. Add this mutant to check 7 (see F5 — check 7 only ever runs check 5, which is why this was never surfaced).

**decision-needed: yes.** Items 1–3 sit in `check-two-trees.mjs` (0103's, in scope). Items 1–2 for `demo-two-path-caches.mjs` and item 4 for both touch a PUP-WO-0102 file — a seam call.

---

## Relayed from the delegated audit — confidence stated

I did **not** reproduce these. I confirmed each mechanism by reading the cited lines; the runs are the delegate's.

| # | Finding | My check |
|---|---|---|
| **A** | **Check 6 hangs forever on a worker whose install fails** (one bad `urlsToCache` entry; checks 2 and 5 pass it). `demo-two-path-caches.mjs:100-103`/`106-109` — `await navigator.serviceWorker.ready` inside `page.evaluate`, which has **no Playwright timeout**. In the publish job the loop at `ci.yml:559` runs check 6 *before* `check-load` at `:571`, so it burns the whole `timeout-minutes: 20` and surfaces as a cancelled job, not a diagnostic. | Mechanism confirmed by reading; `page.evaluate` genuinely has no timeout. **Plausible and serious.** Fix: `Promise.race` with a deadline, or per-step `timeout-minutes` |
| **B** | **Check 7's verdict is exit-code-only.** `check-mutations.mjs:93` — `const red = code !== 0;`. `grep -n fails` shows the FAIL lines are collected at `:98`, stored at `:99`, printed at `:102-103` — **never compared to anything**. A mutation that merely breaks `sw.js` with a syntax error counts as "the defect was caught." | **Confirmed directly.** Fix: give each mutation an expected FAIL substring, as A11 (`:205`) already effectively does |
| **C** | **Check 7's PART B proves nothing about the paired defect.** Stripping the `sw` mutation from all seven B cases yields byte-identical verdicts and FAIL texts — the red comes entirely from check 5's positive controls noticing a broken harness. The `'SILENT'` branch at `:96` is structurally dead, so `:360`'s `${silent.length} of 7` prints a constant. | Mechanism consistent with B. The seven-case rerun is the delegate's. **The operational safety still holds** — a blinded harness cannot ship; it is the stated proof that is wrong |
| **D** | **`check-load.mjs`'s hermeticity claim (`:20-24`, "touches no network at all") is false** when the reload branch (`:239-248`) is taken: Playwright's `context.route` does not intercept service-worker-initiated requests, so the worker fetched three CDN assets off the real internet and cached them. Masked today only by `sw.js`'s `clients.claim()`. The printed `blocked: 3` count is also the first load's, understating by three | Latent, not live. Fix: block at the browser (`--host-resolver-rules`) |
| **E** | **`lib/inline-script.mjs:44-56` treats `<!--` inside a script body as an HTML comment**, so an unterminated one claims the rest of the file and every later `<script>` is skipped by `check-syntax.mjs:65`. A real syntax error in a second inline script passes green | Latent — today's `index.html` has no `<!--` and one inline script, and `check-syntax.mjs:91-93` still fires |
| **F** | `demo-two-path-caches.mjs:84` — `bad = (m) => …` takes one argument; `:162`, `:186-187`, `:189`, `:232`, `:234` pass a second diagnostic that is silently discarded, on every failure path | Cosmetic |

**Confirmed good, and worth recording:** check 4's `installing` gap really is fixed — `check-load.mjs:313-318` asserts `swState !== 'active'` → exit 1, and a hung install goes red (`CHECK 4 FAILED — the service worker never reached "active" (state: installing)`). Check 7 mutates only a `mkdtempSync` copy and cleans up in `finally` (`check-mutations.mjs:58-83`, `:104-106`) — I confirmed the frozen tree is untouched. All four checks genuinely read `argv[2]`; there is no "file missing ⇒ skip ⇒ green" path in any of them.

---

## Revised ranking

| # | Finding | Severity |
|---|---|---|
| **F0** | Nothing observes the root worker eating `/stable/`'s cache — whole publish path green | **disqualifying** |
| F1 | Rollback erased by the next push to `main` | **disqualifying** |
| F2 | `verify` green-lights main's bytes at `/stable/`; one expression is the gate | **disqualifying** (§7 flag-and-stop) |
| A | Check 6 hangs on a failed install, consuming the job timeout | serious |
| F3 | Check 5 barely exercises the promoted scope | serious |
| F4 | Two-tree check's invariant-7 assertions skipped during real lag; two vacuous `ok`s | serious |
| F5 / B / C | Check 7: no coverage of checks 4/6/two-trees; exit-code-only verdict; PART B's stated proof is wrong | serious |
| F6 | Shell injection ahead of the input validation | serious |
| F7–F15, D, E, F | as previously reported | real → cosmetic |

F0 changes the shape of the review. My original F4 said the two-tree harness skips its invariant-7 assertions during real lag; F0 is worse — the harness cannot observe the cross-path reap **in any mode**, and neither can check 6. The three cache checks are individually careful and jointly leave the exact hazard architecture §6 was written about unobserved, on the copy the child uses.

---
---

# PART III — the three precision statements, and the direct answer

New material, written in response to the coordinator's request. Nothing above was altered to produce it.

---

## THE DIRECT ANSWER · Is there a path by which `main`'s content reaches `/stable/` on an ordinary push to `main`, with no human dispatching anything?

**No. I found none, and I attacked it specifically.**

On a `push` to `refs/heads/main`, `github.event.inputs` is null, so every input expression evaluates to `''`. That collapses the pipeline to a single, tight path:

- `ci.yml:309` — `ref:` evaluates to the literal `'refs/heads/stable'`. The dispatch branch is unreachable.
- `ci.yml:320-327` — `named_sha`, `named_main` and `mode` are only assigned inside `if [ "${{ github.event_name }}" = workflow_dispatch ]`, so all three are empty. Every verify/rollback branch is skipped.
- `ci.yml:390-392` — control therefore always reaches the unconditional equality test: `[ "$head_sha" = "$remote_sha" ]` against `git ls-remote`, with no fallback. A mismatch exits 1.
- `ci.yml:443-444` — `/stable/` is written by `rm -rf dist/stable && mkdir -p dist/stable; git -C src/stable archive HEAD | tar -x -C dist/stable`, from that verified checkout and nothing else.
- `ci.yml:448-479` — the result is hashed and compared to `git ls-tree -r HEAD` of `src/stable`.

I could not defeat that. What I tried, and what happened:

| Attack | Result |
|---|---|
| `stable/index.html` committed in `main` | **refused** at `ci.yml:433` — `main carries a 'stable/' path` |
| A blob (not directory) named `stable` in `main` | evades `:433`, **caught** by the byte assertion (`tree=a542fc90fb9b7cf1 published=b00e76ad5fd9fa30`) |
| A submodule/gitlink at `stable` in `main` | fail-closed: `ls-tree` lists it, `find -type f` cannot, hashes diverge |
| `.gitattributes` with `export-subst` / `export-ignore` in either tree | **refused** at `ci.yml:411`, including `docs/.gitattributes` |
| A committed symlink in either tree | **refused** at `ci.yml:415-419` (mode `120000`) |
| Substituting main's `sw.js` into `dist/stable` after the archive | **caught**: `tree=2a2923a9b4f57cec published=a12ff93165f5648d` |
| Adding an extra file under `dist/stable` | **caught**: `tree=2a2923a9b4f57cec published=7be5a48fecab2369` |
| `tar \| tar -x` merging main's tree under stable's | not reachable — `rm -rf dist/stable` destroys before recreating |
| A pull request reaching `publish` | excluded by `ci.yml:204-207` |

**Three qualifications, stated because §7's bar is "not ruled out", not "not demonstrated":**

1. **F10(a) is a missing backstop on that path, not a live hole.** The byte assertion at `ci.yml:466` uses `find . -type f`, which cannot see a symlink at a path absent from the commit's tree — and `upload-pages-artifact` tars with `--dereference`. On an ordinary push nothing creates such a symlink (`git archive` of a symlink-free tree emits none, and the only write to `dist` between the archive and the upload is the stamp at `ci.yml:589-610`). So the path is closed today by the *tree-level* refusal, not by the assertion the work order calls its centrepiece. If that refusal is ever narrowed, nothing downstream catches it.

2. **F1 IS triggered by an ordinary push, but it does not put main's bytes at `/stable/`.** It republishes `refs/heads/stable`'s bytes over a human's rollback. That falsifies invariant 4 by its own stated test — *the promoted copy changes without a human action* — but by a different mechanism than the one this question asks about. I am keeping the two separate deliberately.

3. **F0 IS reachable on an ordinary push, and it is the one that reaches the child.** It is not main's *content* appearing at `/stable/`; it is main's *worker* destroying `/stable/`'s cache on the device, with the entire publish path green. If the question behind the question is "can an unpromoted merge harm Buddy's copy without a human acting", then the answer is **yes, via F0** — but as a gate defect, not a live compromise: today's committed `sw.js` is correct, and F0 is the statement that CI would not stop a future one that is not.

**Every other path I found is dispatch-mediated** and therefore requires a human with write access to deliberately trigger `workflow_dispatch`. That is F2, F6 and F7.

---

## 1 · F2 with maximum precision — the exact inputs, the exact expression, the exact reasoning

### The exact dispatch inputs

Three form fields on `workflow_dispatch`. The reproducing set is:

```
mode        = verify
main_sha    = (empty)
stable_sha  = 30036e9c3aa4f630be18912b6184582b66fb0544     <- refs/heads/main's tip
```

Nothing else. `stable_sha` is a `type: string`, `required: false` input (`ci.yml:44-47`); it accepts any 40-lowercase-hex value that resolves to a commit in the repository. `main`'s tip qualifies.

### The exact line that disables the invariant-4 test

`ci.yml:350-362`, verbatim:

```yaml
              # VERIFY against an explicitly named promoted commit. The equality test
              # below is deliberately NOT applied: the point is to stand in a commit
              # that is not the current tip, so the rest of this pipeline can be
              # exercised at all while refs/heads/stable is still behind PUP-WO-0102.
              # Otherwise every step after the /stable/ check is unreachable until a
              # human fast-forwards stable, which happens only AFTER this merges.
              # Safe because verify cannot deploy: the deploy job requires
              # mode == rollback. This names a copy to CHECK, never one to publish,
              # and it is checked exactly as a real one would be.
              [ "$head_sha" = "$named_sha" ] || {
                echo "::error::src/stable is ${head_sha}, not the requested ${named_sha}."; exit 1; }
              echo "stable: VERIFY against hypothetical promoted copy ${named_sha:0:12} (real tip ${remote_sha:0:12}); this run cannot deploy"
              continue
```

The `continue` on the last line is the whole of it. It jumps past `ci.yml:390-392`:

```bash
            [ "$head_sha" = "$remote_sha" ] || {
              echo "::error::src/${ref} is ${head_sha} but refs/heads/${ref} is ${remote_sha}"
              echo "::error::REFUSING TO PUBLISH — northstar invariant 4."; exit 1; }
```

That is the only assertion in the workflow that ties `/stable/`'s content to `refs/heads/stable`. In verify mode with a `stable_sha`, it is not executed. The comment's justification — *"Safe because verify cannot deploy"* — is a claim about a **different job**, asserted here, with no mechanism in this job enforcing it.

### The exact expressions that are the gate

Two, and only two.

**Gate 1 — `ci.yml:238`,** which suppresses the artifact upload:

```yaml
      DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.mode == 'verify' }}
```

consumed at `ci.yml:622-624`:

```yaml
      - name: Upload the site
        if: env.DRY_RUN != 'true'
        uses: actions/upload-pages-artifact@v4
```

**Gate 2 — `ci.yml:645-647`,** the deploy job's condition:

```yaml
    if: >-
      (github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/stable'))
      || (github.event_name == 'workflow_dispatch' && github.event.inputs.mode == 'rollback')
```

The operative sub-expression for a dispatch is `github.event.inputs.mode == 'rollback'`. That single string comparison is the last line between the artifact and the site.

### The exact reasoning — why this IS a path

- **The forbidden artifact is fully constructed.** Not partially, not in a scratch directory: `dist/stable/` contains `main`'s committed tree, and `dist/` and `dist/stable/` hash identically (`b00e76ad5fd9fa30` both). Verified by simulation and independently by the coordinator.
- **Every gate designed to stop it passes it.** The named `/stable/` call site (`ci.yml:492`), all four per-copy checks on both copies, both `check-load` runs, and `check-two-trees` — all PASS. I ran each with the real scripts.
- **The work order's own acceptance item 3 says this state must be refused**, and its §7 sets the bar at *"found, suspected, or merely **not ruled out**"*. A state that is constructed, validated, and stopped only by an `if` is by definition "not ruled out" — it is ruled out by one predicate with no second line.
- **The two gates are independent, not derived.** Gate 1 tests `mode == 'verify'`; gate 2 tests `mode == 'rollback'`. They are complementary only because the `choice` input happens to have exactly two options. Add a third mode, or edit either expression, and they diverge silently. The deploy job re-asserts nothing about the artifact it deploys.
- **The builder did not flag it.** §7 makes this a flag-and-stop. The builder instead used this exact configuration as its §3.2 headline green evidence (`docs/feedback/PUP-WO-0103.md:91-93`).

### The exact reasoning — why it is NOT a demonstrated path

State this too, because the wording matters and I could not close it into a working exploit:

- `mode` is `type: choice, options: [verify, rollback]` (`ci.yml:36-40`). GitHub validates choice inputs server-side against the option list, so a dispatch cannot supply an arbitrary `mode`.
- Even if it could, any value other than the exact string `rollback` fails gate 2. A value of `Verify`, `rollback ` (trailing space) or `ROLLBACK` would skip gate 1 (uploading the artifact) but still fail gate 2 (no deployment). **No single malformed input flips both gates.**
- `mode = rollback` with `stable_sha` = main's tip is refused by the ancestry test at `ci.yml:382`, demonstrated: `::error::30036e9c3aa4f630be18912b6184582b66fb0544 is NOT an ancestor of refs/heads/stable (2952aa1a8443c31f94ab5c4cd2b7199a6f749377).`
- The shell injection (F6) cannot bridge it, because the only injectable inputs double as `actions/checkout` `ref:` values.

**Net:** this is a **latent** path, closed today by two boolean expressions and nothing else, with the artifact fully built and every substantive check green. It is not a live exploit. Under §7's stated bar it is a flag-and-stop, and I concur with treating it as one.

---

## 2 · F1 with maximum precision — the exact sequence, the step that republishes, and demonstrated vs reasoned

### The exact sequence

1. `/stable/` is serving a bad build. `refs/heads/stable` points at commit **T**.
2. A human dispatches `mode = rollback`, `stable_sha = X`, where X is an ancestor of T.
3. `ci.yml:309` evaluates the dispatch branch and checks out X into `src/stable`. `ci.yml:382` verifies `merge-base --is-ancestor X T`. `ci.yml:443-444` writes X's bytes into `dist/stable`. `ci.yml:622-624` uploads. `ci.yml:645-647` matches on `mode == 'rollback'`, so `deploy` runs and `ci.yml:666-668` deploys. **The site now serves X at `/stable/`.**
4. **`refs/heads/stable` is still T.** The workflow never moves it. Verified:
   ```
   $ grep -n "git push\|update-ref\|push origin\|git branch -f\|gh api.*refs" .github/workflows/ci.yml
     (no matches — the workflow never moves refs/heads/stable)
   ```
   Nor could it: the `publish` job is `permissions: contents: read` (`ci.yml:213-214`) and the WO §4 fences pushing to `stable` out of the builder's scope entirely.
5. Any later `push` to `refs/heads/main` — in an emergency, the fix-forward merge itself. `github.event.inputs.stable_sha` is now empty.
6. `ci.yml:309` therefore evaluates to `'refs/heads/stable'` and checks out **T**:
   ```yaml
   ref: ${{ (github.event_name == 'workflow_dispatch' && github.event.inputs.stable_sha != '') && github.event.inputs.stable_sha || 'refs/heads/stable' }}
   ```
7. `ci.yml:390-392` asserts `head_sha == remote_sha`. Both are T. **It passes** — the assertion is working exactly as designed; T genuinely is what the ref names.
8. `ci.yml:443-444` writes T's bytes:
   ```bash
   rm -rf dist/stable && mkdir -p dist/stable
   git -C src/stable archive HEAD | tar -x -C dist/stable
   ```
9. `ci.yml:622-624` uploads; `ci.yml:645-647` matches the push branch and deploys. **The site serves T at `/stable/` again.** The rollback is gone. Nothing warned.

### Which step republishes the superseded content

Three, in order of causation:

- **`ci.yml:300-311` — "Check out stable".** This is the step that *re-selects* T. It is the root cause: the workflow's only notion of what belongs at `/stable/` is `refs/heads/stable`, and the rollback never changed that.
- **`ci.yml:443-444` — inside "Build the site from the COMMITS".** This is the step that *writes* T's bytes into the published directory.
- **`ci.yml:666-668` — "Deploy to GitHub Pages".** This is the step that *serves* them.

The design intent is stated plainly at `ci.yml:29-32`: *"A push to either ref rebuilds BOTH copies from their own refs, so publication is idempotent and neither copy goes stale because the other moved."* The rollback lever is the one operation that deliberately violates that idempotence, and nothing reconciles the two.

### Demonstrated or reasoned?

**Both halves demonstrated in simulation; the composition reasoned, not observed on a live site.** Precisely:

- **Demonstrated:** a run with no `stable_sha` builds `/stable/` from `refs/heads/stable` and passes. Simulated push to main:
  ```
  $ EVENT=push bash pub.sh $S/ws-push
  main: checkout=30036e9c3aa4 remote=30036e9c3aa4
  stable: checkout=2952aa1a8443 remote=2952aa1a8443
  root (/): tree=b00e76ad5fd9fa30 published=b00e76ad5fd9fa30
  promoted (/stable/): tree=2a2923a9b4f57cec published=2a2923a9b4f57cec
  OK: both published copies are byte-for-byte their own commit's tree.
  ```
- **Demonstrated:** a rollback builds `/stable/` from the named SHA and passes the ancestry gate.
  ```
  $ EVENT=workflow_dispatch MODE=rollback STABLE_SHA=a4be01999cb1061f05ab16d62d50273dcb2678fc bash pub.sh $S/ws-RB
  stable: checkout=a4be01999cb1 remote=2952aa1a8443
  stable: ROLLBACK to a4be01999cb1, verified an ancestor of 2952aa1a8443
  promoted (/stable/): tree=d48cb189307c6159 published=d48cb189307c6159
  ```
  Two different trees at `/stable/` from the two events — `2a2923a9b4f57cec` vs `d48cb189307c6159`.
- **Demonstrated by absence:** the `grep` above proves no step in the workflow moves any ref.
- **Reasoned, not observed:** I did not run the two in sequence against a live GitHub Pages deployment. I have no CI credentials and cannot trigger a run. The conclusion — that step 5's push overwrites step 3's deployment — follows from (i) both halves demonstrated, (ii) the ref never moving, and (iii) `actions/deploy-pages` replacing the entire site on each deployment rather than merging paths. Point (iii) is inherent to how Pages artifact deployment works, and is stated by the workflow's own comment at `ci.yml:661-662` (*"a cancelled deploy can leave the site serving a half-updated pair of copies"*), which presupposes whole-site replacement.

**Confidence: high on the mechanism, not observed end to end.** The one thing that could falsify it is if `deploy-pages` merged rather than replaced, which it does not.

---

## 3 · F6 with maximum precision — exact string, exact line, exact effect, exact prerequisite

### The exact vulnerable line

`ci.yml:251`, verbatim:

```yaml
          if [ -n '${{ github.event.inputs.main_sha }}' ] && [ '${{ github.event.inputs.mode }}' != verify ]; then
```

`${{ }}` expressions are substituted into the `run:` script *as text* before bash ever parses it. A single quote in the input value terminates the quoting.

Three more instances of the same pattern:
- `ci.yml:256` — `for sha in '${{ github.event.inputs.main_sha }}' '${{ github.event.inputs.stable_sha }}'; do`
- `ci.yml:268` — `if [ '${{ github.event.inputs.mode }}' = rollback ] && [ -z '${{ github.event.inputs.stable_sha }}' ]; then`
- `ci.yml:272` — the `echo` line
- `ci.yml:324-326` — `named_sha='${{ github.event.inputs.stable_sha }}'` and the two beside it, in the invariant-4 step

### The exact injection string

Supplied as the `main_sha` form field, with `mode = rollback`:

```
x'; echo '>>> ARBITRARY SHELL RAN IN THE PUBLISH JOB'; touch /tmp/PWNED; :'
```

### The exact rendered source and the exact effect

```
--- rendered step source (mode=rollback, main_sha=<payload>) ---
set -euo pipefail
if [ -n 'x'; echo '>>> ARBITRARY SHELL RAN IN THE PUBLISH JOB'; touch /tmp/PWNED; :'' ] && [ 'rollback' != verify ]; then
  echo "::error::main_sha is accepted in verify mode ONLY."
  exit 1
fi
for sha in 'x'; echo '>>> ARBITRARY SHELL RAN IN THE PUBLISH JOB'; touch /tmp/PWNED; :'' ''; do
  [ -n "$sha" ] || continue
  case "$sha" in
--- executing it ---
/tmp/step.sh: line 2: [: missing `]'
>>> ARBITRARY SHELL RAN IN THE PUBLISH JOB
::error::main_sha is accepted in verify mode ONLY.
step exit=1
--- did the payload execute? ---
-rw-rw-r-- 1 ikthys777 ikthys777 0 Sep  1 13:51 /tmp/PWNED
```

Effect: **`touch /tmp/PWNED` executed on the runner.** The `[: missing ']'` error is bash failing the malformed test — and, because it is inside an `if` condition, `set -euo pipefail` does not fire, so execution simply continues into the injected commands.

**The ordering is the finding.** The validation that makes the input safe is at `ci.yml:257-261`:

```bash
    case "$sha" in
      *[!0-9a-f]*) echo "::error::a named SHA must be 40 lowercase hex characters."; exit 1 ;;
    esac
```

That runs at line 257. The injection fires at line 251. **The check that rejects non-hex characters cannot protect the step that has already executed them.**

### What an attacker would need to be able to do first

- **`workflow_dispatch` permission on `ikthys777/PupPad`.** GitHub grants this to actors with **write** access. It cannot be triggered from a fork, by a pull request, by an unauthenticated request, or by any `pull_request`/`pull_request_target` path — none of which this workflow configures anyway.
- Therefore the actor is someone who can already push to the repository.

**What that bounds, and what it does not.** It does not widen *who* can affect the repository — that set is unchanged. It widens *what a form field can do inside the job*: arbitrary code execution with the runner's `GITHUB_TOKEN` (scoped `contents: read` at `ci.yml:213-214`), before any validation, in the job that constructs the promoted copy. The realistic threat models are (a) a paste of a value containing a quote — a mistyped SHA behaves unpredictably rather than being cleanly rejected, in the emergency lever, at 2am; and (b) a future change that grants `publish` more scope, at which point this becomes materially worse with no edit to this step.

**What I could NOT do with it, stated so nobody reads more into it than is there:** I could not turn it into a publication path. Both injectable inputs are also `actions/checkout` `ref:` values (`ci.yml:296`, `:309`), and a payload string is not a resolvable git ref, so the checkout fails and the job dies before building anything. The theoretical escalation — write `$GITHUB_PATH` to shim `git` and make `merge-base --is-ancestor` lie — needs `main_sha` non-empty, which breaks the main checkout. I tried and could not construct a working chain.

**Fix, four lines:**

```yaml
        env:
          MAIN_SHA:   ${{ github.event.inputs.main_sha }}
          STABLE_SHA: ${{ github.event.inputs.stable_sha }}
          MODE:       ${{ github.event.inputs.mode }}
```

then reference `"$MAIN_SHA"`, `"$STABLE_SHA"`, `"$MODE"` in the script. Never `${{ }}` inside `run:`. The same change is needed at `ci.yml:324-326`.

**decision-needed: no** — this is an unambiguous fix with no trade-off.

---
---

# SECOND PASS — subject `246c5f7`, dispatched 2026-09-01

**READ THIS BEFORE READING ANYTHING ABOVE.** The pass recorded above names its
subject as `c8c8cf1a4dc291877b69d18648d491270d7836d3`. ROUND 2 and ROUND 3 rewrote
the publish job between that commit and this one, so **every `ci.yml:NNN` citation
above lands on unrelated text and several are past end-of-file.** It also lists
`workflow_dispatch` as a live attack surface; that surface no longer exists. Treat
the first pass as a record of a different artifact, kept because its findings and
their dispositions are still traceable, not as a review of what merges.

That confusion was itself a finding of this pass (F-H below), and this divider is
its fix.

**Subject:** `246c5f7693ed611f5dab8342aacf962e2c4e2498`, branch `build/wo-0103`,
tree clean before and after. Protected surfaces (`index.html`, `sw.js`,
`manifest.json`, both icons) diff to empty against `origin/main`.

**Method.** Five independent reviewers, dispatched simultaneously, each reading its
instructions from `docs/findings/PUP-WO-0103-pass-prompt.md` in the frozen tree
rather than from the dispatcher — so that a dangling pointer would be hit by five
agents at once instead of silently worked around by one. Each verified `HEAD` and a
clean tree before starting and was told that a moved freeze is itself the finding.

    lens 1   probe 1 alone — /stable/ reachability
    lens 2   probes 2 + 6 — wrong-cause reds, and verifying the builder's claims
    lens 3   probes 3 + 4 — the find/prune re-attack, and assertions that cannot fire
    lens 4   probe 5 — what legitimate behaviour does each fix now refuse
    lens 5   UNASSIGNED — sent deliberately at the seams the partition does not cover,
             including at the prompt itself as part of the artifact

The fifth existed because the partition was written by the artifact's own author and
is therefore exactly the assumption §6.1 member 4 describes. It earned its place: two
of the four most serious findings below are its, and one of them is a hole in the
prompt's own probe list.

**Every reviewer was told the flip question outranked the report format,** and told
to try to BREAK the claim that the flip is safe rather than confirm it, with the
architect's basis quoted and attributed.

---

## THE FLIP — the pass's headline, and the architect's answer was wrong

Four of five lenses reached the same conclusion independently. The builder reproduced
every step of it before relaying any of it.

**The premise is TRUE.** `sw.js` is one blob across all three commits that matter:

    922c2dc:sw.js    72f1699197d9b94726cd52334464b45b8d1c89d3   (the merge on the tablet)
    origin/main:sw.js 72f1699197d9b94726cd52334464b45b8d1c89d3
    246c5f7:sw.js    72f1699197d9b94726cd52334464b45b8d1c89d3

**The conclusion does not follow, because `/stable/` is not built from `main`.** The
publish job builds the promoted copy from `refs/heads/stable` in every event — which
is correct and is the design — and that ref has never been fast-forwarded:

    refs/heads/main    db4e283
    refs/heads/stable  2952aa1     43 commits behind; does NOT contain 922c2dc

    $ git show origin/stable:sw.js | head -1
    var CACHE_NAME = 'pup-pad-v16';
    $ git show origin/stable:sw.js | sed -n '23p'
        names.filter(function(name) { return name !== CACHE_NAME; })

That is the unbounded reap `PUP-WO-0102` existed to remove: it deletes every cache on
the origin by inequality, with no prefix bound. The promoted copy today derives **no
prefix at all**, so "the two copies derive distinct non-nesting prefixes" is not a
statement about the two published copies — it is a statement about `main`'s worker
loaded at two scopes, which is the only configuration any check exercises.

**Do not carry that sentence forward as a standing fact.** If someone later relies on
it to relax check 5's refusal, they will be wrong.

### What actually protects the child, and it is not the prefixes

The pipeline refuses. Reproduced by the builder against the real refs, running the
transcribed `/stable/` call site (`ci.yml:471-481`):

    $ node .github/ci/check-cache-isolation.mjs dist/stable
    CHECK 5 FAILED — this copy's sw.js defines no CACHE_PREFIX.
      That is the pre-PUP-WO-0102 worker, whose activate handler reaps by inequality
      If this is the PROMOTED copy: fast-forward `stable` before publishing it.
    exit 1

Fail-closed and all-or-nothing: GATE refuses, the upload is skipped, `deploy` never
exists. **So the failure mode of flipping today is paralysis, not mutual cache
destruction** — no push can produce a successful deployment, including the push that
would fix it. The error message is the best in the artifact and names the remedy
outright, which is why this is a sequencing fact and not a defect.

### The consequence that moves the fast-forward earlier than the flip

`ci.yml:471` has **no event guard**. `publish` now runs on `pull_request`, and the
promoted copy is `refs/heads/stable` in every event — so the moment PR #10 merges,
**every pull request in the repository goes red at that call site**, for a reason
having nothing to do with the pull request. `PUP-WO-0104`'s own PR included.

The fast-forward is therefore a precondition of THE MERGE, not merely of the flip.

### The second precondition, which no probe in the prompt asked for

Found by lens 5, which was sent to look for exactly this kind of gap, and read from
the API by the builder rather than reasoned about:

    $ gh api repos/ikthys777/PupPad/environments/github-pages/deployment-branch-policies
    {"total_count":1,"branch_policies":[{"name":"main","type":"branch"}]}

    deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}

**Only `main`.** `deploy` carries `environment: github-pages` (`ci.yml:638`), and a
branch outside an environment's policy is rejected **before its first step**, with
`"steps":[]` and no log — the signature this file's own comments at `ci.yml:209-223`
record as unreadable, because the builder hit it once already.

So a human pushes `refs/heads/stable` to promote. `publish` runs and goes green.
`deploy` is rejected. **Nothing lands.** Then an unrelated merge to `main` arrives,
`deploy` is permitted, and both copies deploy — so the promoted copy advances
attached to a merge no human associated with promoting, at a moment no human chose.

**This lands directly on §1.7.** The rollback lever was removed on the finding that
"the human's promotion and rollback authority already existed structurally." The
ref-level authority does exist and the ruleset was verified in both directions. But
the DEPLOYMENT of that promotion is gated on an environment policy that excludes the
very branch, so **the authority stops at the ref and never reaches the published
site.** The case that matters is an emergency rollback: the human pushes `stable`
back to a known-good commit, watches `publish` go green, and believes Buddy is rolled
back. He is not — not until someone next merges to `main`. That is the sentence §1.7
used against fail-closed — *"a safety mechanism you cannot use in the emergency it
was built for"* — returning after the lever was deleted for being redundant with an
authority that turns out to be truncated.

Stated carefully, because the distinction matters: **this does not put `main`'s
content on `/stable/`.** What Buddy receives is still the commit the human named.
What is broken is WHEN, and whether the human can tell. The false confirmation is the
dangerous part.

### And the first pass asked for this and it was not done

`PUP-WO-0103-adversarial.md` F15 (first pass, above): *"Nowhere is it recorded what
that policy currently allows,"* recommending it be recorded in architecture §6.

    $ rg -n 'branch_policy|deployment branch|environment' docs/architecture.md \
          docs/northstar.md docs/roadmap.md
    (no matches)

F15 asked whether the policy permits **too much**. Nobody asked whether it permits
**enough**. And the builder closed F15 "by construction" on the strength of real CI
runs — **none of which ever pushed to `stable`.**

**A question closed by evidence that could not have exercised it.** That is §6.1
member 1 in new clothing, and it is the second instance in this project of a control
verified to REFUSE and never verified to PERMIT — architecture §6.2's finding about
the `stable` ruleset was the first. Two instances make it a pattern.

---

## F-LIVE · the shipped worker caches HTTP error responses over its own precache

**Found by lens 1, reproduced in real Chromium. The mechanism was then confirmed by
the builder by reading. This is in the code on Buddy's tablet right now.**

`sw.js:337`, and the whole of the online branch:

    event.respondWith(
      fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          return cache.put(event.request, clone);
        }).catch(function() {});
        return response;
      }).catch(function() { ...scoped offline read... })

    $ grep -n "\.ok\b|status ===|status >=|response.status" sw.js
    (none)

`fetch()` **resolves** for 4xx and 5xx — it rejects only on a network-layer failure.
So an HTTP 404 or 503 received while ONLINE is written into the precache under its
own key, overwriting the good entry, and the `.catch` offline branch is never taken
because nothing rejected.

Lens 1's Chromium run, one reload against a 404ing origin:

    === healthy ===
     "puppad|%2FPupPad%2F|v17 :: /PupPad/":           "200 91128B "
    === app assets 404 while ONLINE ===        <- one reload
     "puppad|%2FPupPad%2F|v17 :: /PupPad/":           "404 109B <<<POISONED>>>"
    === OFFLINE — what does the child get? ===
      /PupPad/  -> status 404  title "SITE-NOT-FOUND"  body "404 THIS IS THE ERROR PAGE"

`./` is in `urlsToCache`. That is the app shell. Buddy taps his icon and gets an
error page, offline, with no way to tap out of it. Northstar invariants 3 and 5.

**Severity, stated honestly, because lens 1 tested recovery instead of assuming the
worst:** it heals PER URL on the next healthy ONLINE fetch of that URL.

    === BACK ONLINE, origin healthy ===
     "/PupPad/":            "200 91128B "              <- healed, it was navigated to
     "/PupPad/index.html":  "404 109B <<<POISONED>>>"  <- still poisoned, nothing re-fetched it

Not permanent. But the window is "until an adult next opens it online against a
healthy origin," and any URL not re-navigated stays poisoned indefinitely. A
three-year-old cannot produce that condition.

**The comment directly above the bug is the tell:**

    /* cache.put rejects on a non-GET request, a 206, or an opaque redirect. ... */

Every one of `cache.put`'s REJECTION modes was enumerated and handled. The case never
considered is the one where `cache.put` **succeeds and stores the wrong thing.** That
is *ask what the fix refuses*, inverted: the author verified against the failure he
imagined. The pre-`0102` worker (`bd1b15f5`) carries the identical unguarded put, so
`PUP-WO-0102` rewrote this handler extensively and carried the defect through.

**This is the THIRD member of the M9/M7 family the prompt asked for,** and it is
distinct from both: M9 is a worker gated on the sandbox and the production origin;
M7 is cache-content corruption a check cannot see. This is the shipped worker
corrupting its own cache under an ordinary network condition, with no attacker and no
mutation.

### Why no check can see it — lens 5, from the opposite direction, and a correction

Lens 5 independently found the structural reason, without knowing lens 1's finding:

    .github/ci/lib/sw-harness.mjs:130
      fetch: async () => { network.attempted++; network.rejected++;
                           throw new Error('network disabled in harness'); }

The sandbox `fetch` **always throws**, so in check 5 the `.then(response => cache.put(...))`
branch is never executed. And check 7 — which `ci.yml:145` calls *"the step that makes
green mean something"* — drives exactly one check:

    check-mutations.mjs:87
      execFileSync(node, [dir + '/ci/check-cache-isolation.mjs', dir])

One of seven, and it is the one whose harness cannot reach the branch.

**Lens 5 said check 5 "cannot express this defect class at all." The builder verified
that and it is too strong; the real mechanism is sharper and worse.** `check-mutations.mjs:349`
is literally titled *"B7 sandbox fetch RESOLVES, WITH the origin-wide read (the audit's
own blind spot)"* — so a resolving fetch **is** exercised. But look at what it resolves to:

    fetch: async () => { network.attempted++; return { clone: () => 'LIVE' }; }

A bare stub object. No `status`, no `ok`, **not a `Response`.** And across all eight
checks and three lib files, the only `new Response` occurrences are the 504s inside
`sw.js` MUTATION TEXT — the offline-miss path, not a fetched response. Nothing
anywhere asserts on the status of a cached entry.

**So the accurate statement: the online write branch is reachable in exactly one
mutation, and the value it is fed cannot carry a status. No check in this artifact can
express "the worker cached an error response."** That is a fixture-shape blindness,
not a missing branch — the fixture was built to prove the stub FIRES, never to carry
the property under test.

The harness comment is the sharpest thing in this pass, and it shows the author one
step from the answer:

    /* the rule was "audit the stubs whose DEGENERATE value is also a legitimate one",
     * and a RESOLVING fetch is not degenerate at all — it is what an online browser
     * hands the worker on every request. The dangerous value here is the NORMAL one.
     * A caller can now assert the fixture actually fired. */

He saw that a resolving fetch was the dangerous case, and then fixed the wrong half:
added counters so a caller can assert the stub fired, while leaving it unable to ever
resolve with a real response. **A stub that cannot fail is not a test; a stub that can
only fail is not one either.**

### What this does to the flip, and what 0104 cannot do about it

It inverts it. Paralysis is inert. This is not: **the flip is precisely the operation
that makes the origin return a non-200 while the device may be online.** Every other
trigger is independent of whether Pages 404s during a source change specifically — a
Pages incident, a 503, a 429, or the no-deployment gap above.

Lens 1's mitigation costs nothing and the builder endorses it: **keep the tablet off
or in airplane mode from the moment the flip starts until both `/PupPad/` and
`/PupPad/stable/` are verified 200.** That converts this from a live risk to a
scheduled follow-up.

`PUP-WO-0104` **cannot** fix it — 0104 forbids touching `sw.js` ("if the gate appears
to require a worker change, that is a flag-and-stop and a dependency, not an edit").
Its M7 check would DETECT the class; no CI check can stop a production 404 from
poisoning a live device. The guard is one line, `if (response.ok)`, and it belongs to
`PUP-WO-0102`'s file. There is also an open question the file already raises at
`sw.js:225`: opaque cross-origin responses, stored as status 0 and zero bytes.

**Related, and already a recorded decision rather than a new finding:** `sw.js:224-231`
states plainly that the worker caches cross-origin bytes with no allowlist, that this
is deliberate so leaflet works offline (invariant 3), that it sits awkwardly beside
northstar §5's third non-goal, that the three CDN loads are `PUP-WO-0600`'s to remove,
and that whether a worker should cache cross-origin responses at all is an architect's
call. Lens 3 raised it; it is answered in the file.

---

## THE GATE IS WEAKER THAN THE FEEDBACK FILE CLAIMS

These do not put wrong bytes on the tablet today. They are why a FUTURE regression in
the worker would likely pass, which is the whole purpose of the gate.

### G1 · check 7's PART B verifies only "the child exited non-zero"
**Found independently by lens 2 and lens 3. Verified by the builder by reading.
This falsifies a claim in the builder's own feedback file.**

    check-mutations.mjs:106
      const matched = !expectFail || fails.some((f) => f.includes(expectFail));

`expectFail` appears 14 times, at lines 128-259. **PART B begins at line 266 and none
of its seven mutations declares one.** So `matched` is unconditionally `true` for all
of PART B and the verdict collapses to `observed === expect` — did check 5 go red AT
ALL — which is exactly what the comment eight lines above says was fixed. The fix
landed on PART A and missed PART B.

`docs/feedback/PUP-WO-0103.md:329` states, unqualified:

> Check 7's verdict names **which** assertion must fire, not just the exit code.

True for PART A. False for PART B. Stated without the qualifier.

It follows structurally, with no run needed, that any unrelated red scores as `ok`:
check 5 exits nonzero, `observed` becomes LOUD, `expect` is LOUD, `matched` is true.
Lens 2 demonstrated it with a pure syntax error in B1's harness patch:

      ok   B1  FakeCacheStorage.match() -> undefined, WITH the origin-wide read
    CHECK 7 PASSED — 21 mutations, all as predicted.

Lens 3 demonstrated it harder, and its version is the one that matters: it neutered
**both** positive controls and added one unrelated failing assertion. All seven B
cases scored `ok LOUD`, including B1 and B6 whose real defences it had just removed.
The only thing that caught the sabotage was the separate `baseline: sw.js as committed`
GREEN case — so had the unrelated red occurred only under mutation, check 7 would have
printed `PART B: every stub is load-bearing` with all seven undefended.

### G2 · PART B's summary line is a claim its own run does not support
Line 372: `PART B: every stub is load-bearing, and ${silent.length} of 7 now fail SILENT.`

Lens 2 stripped the paired real `sw:` defect from all seven B cases and re-ran:

    $ diff b_before.txt b_after.txt
    >>> BYTE-IDENTICAL <<<
      PART B: every stub is load-bearing, and 0 of 7 now fail SILENT.

PART B's header says *"neuter the STUB, keep a real defect. SILENT = the stub was the
only defence."* Removing the real defect from all seven changes nothing — verdicts,
FAIL texts and summary identical. **What PART B actually measures is "check 5's
positive controls notice a blinded harness."** That is true and useful. It is not
"every stub is load-bearing."

### G3 · `${silent.length}` is structurally always 0
**Lens 3.** Every B case expects `LOUD`, so any `SILENT` result sets `pass = false`,
lands in `escaped`, and `process.exit(1)` fires at line 367 — **before** line 372 can
print. The line can only ever read "0 of 7". A constant printed as a measurement, and
the builder quoted it as evidence.

### G4 · a rejecting offline read prints `ok` on BOTH invariant-7 assertions
**Lens 3, reproduced. The most serious gate finding.**

`check-cache-isolation.mjs:299` and `:346`:

    try { servedOffline = await offline.responses[0]; } catch { servedOffline = undefined; }
    if (servedOffline === 'BYTES FROM THE OTHER DEPLOY PATH') bad(...)
    else ok('offline fallback reads only this worker\'s own cache, not the origin');

Lens 3 made `sw.js`'s offline branch reject instead of resolve:

      ok    offline fallback reads only this worker's own cache, not the origin
      ok    the promoted copy, offline, reads only its own cache (invariant 7 in its
            own stated direction)
    CHECK 5 PASSED — prefixes differ and do not nest; the reap is bounded...
    sw.js:357
    Error: offline read failed
    [exit 1]

**The two assertions that carry invariant 7 — the point of the check — both went
green.** The step is red only by accident: an unhandled rejection from the un-awaited
`responses` array (`lib/sw-harness.mjs:167-168` awaits `waits`, never `responses`)
crashes Node AFTER the verdict line. A human reads `CHECK 5 PASSED` followed by a
stack trace. Handle that rejection anywhere, or change Node's default, and the check
goes fully green with the defect present.

`catch → undefined → else → ok` is the "catch block that turns a throw into a pass"
the prompt asked for, found in the check that carries the project's central invariant.

### G5 · item 6 catches the defect it names 3 times in 10 — and this corrects the builder
**Lens 3, measured. It overturns a conclusion lens 5 reached and the builder repeated.**

Lens 5 reported `demo-two-path-caches.mjs:186` as a dead assertion: the probe fetches
`origin + '/stable/manifest.json'` while `STABLE_BASE` is `/PupPad/stable/`, so the
URL is outside the root worker's scope, so the worker never sees it, so `probe.hit`
is necessarily false and the `ok()` is a guaranteed print. **The builder verified that
by reading and relayed it. Both were wrong on mechanism.**

Service-worker interception is by **controlling client**, not URL scope. A controlled
page's fetch to any URL reaches the worker's fetch handler — including cross-origin.
`sw.js:232` proves it in this very worker:

    if (u.origin !== self.location.origin) return true;   /* cross-origin: SERVED and CACHED */

So the request does reach the worker. `/stable/manifest.json` is then declined at
`sw.js:237` — the generic *"outside our own scope entirely"* branch — and **not** at
the `FOREIGN_SUBTREE` branch at `:242`, which is the dedicated `/stable/` exclusion
item 6 exists to test. The unread `stableBase` parameter is a real smell for that
reason: the probe exercises a URL production never serves.

**But the race is what kills the assertion.** `sw.js` stores fire-and-forget
(`caches.open(...).then(cache => cache.put(...))`, deliberately un-awaited), and the
probe samples the cache immediately after `await fetch(...)`. Lens 3 removed
`if (!servesRequest(event.request.url)) return;` — the exact defect item 6 exists to
catch — and ran the shipped probe ten times:

    run 1: CAUGHT   2: MISSED   3: MISSED   4: MISSED   5: MISSED
    run 6: CAUGHT   7: CAUGHT   8: MISSED   9: MISSED  10: MISSED
    === defect present, shipped code: CAUGHT=3  MISSED=7 out of 10 ===

Adding `await new Promise(r => setTimeout(r, 800))` after the fetch made it
deterministic — RED 3/3 with the defect, no false alarm on clean `sw.js` 3/3.

Line 265 prints `CHECK 6 PASSED — acceptance items 4, 5 and 6 hold in a real browser.`
It holds 30% of the time, **and a loaded CI runner biases toward green.** A flaky
assertion is worse than a dead one: it will eventually go green on a real regression
and be dismissed as flake.

### G6 · non-nesting between two genuinely different published prefixes is unasserted
**Lens 5; the grep verified by the builder.**

    $ grep -n "CACHE_PREFIX\|CACHE_NAME" .github/ci/check-two-trees.mjs
    (no matches)

`check-two-trees.mjs` is the only check that serves two DIFFERENT published builds —
the promotion-lag state it was written for — and it never reads either cache
identifier. Its distinctness assertion at `:183` is `new Set(names).size === names.length`,
which cannot be false: `CacheStorage` is keyed by name, so duplicates are impossible
by spec, and the `COLLIDE` branch at `:187` is dead code. The author caught the sibling
vacuity one line above (the `>= 2` comment) and missed this one.

So the **non-nesting property — the entire reason `sw.js` carries a trailing `|`
delimiter — is asserted only by `check-cache-isolation.mjs:67-76`, which loads ONE
`sw.js` at two scopes.** In the state where the two copies are genuinely different
builds, nothing asserts it. Architecture §6 requires CI to assert it.

### G7 · a copy whose worker cannot install hangs check 6 for the job timeout
**Lens 2, reproduced. This is first-pass finding A, unfixed and never dispositioned.**

`page.evaluate` has no Playwright timeout, and `await navigator.serviceWorker.ready`
sits inside one at `demo-two-path-caches.mjs:121,127` and `check-two-trees.mjs:133`.
The only bound is the job's `timeout-minutes: 20`.

Reachable because check 2 asserts *referenced ⊆ cached* and, by its own documented
design, not the reverse — so a `urlsToCache` entry that 404s passes it. One added
entry `'./sounds/missing.mp3'`:

    check 1 (syntax)          exit=0
    check 2 (assets)          CHECK 2 PASSED — all 5 local asset reference(s) are cached.
    check 5 (cache isolation) exit=0
    check 6, healthy copy:            exit=0   elapsed=6s
    check 6, same copy +1 bad entry:  exit=124 elapsed=90s  (killed, printed nothing)
    check-load (check 4) on the SAME copy:
      [service worker uncaught exception] TypeError: Failed to execute 'addAll' on
      'Cache': Request failed
      exit=1  elapsed=5s

Fail-closed, but the run's verdict is *"exceeded the maximum execution time of 20
minutes"* — no `::error::`, and **no GATE output at all, because a job timeout
terminates the job and `!cancelled()` never runs.** The human is told the runner was
slow, not that the promoted copy's worker cannot install — which is the failure mode
`ci.yml:318-319` itself names as the danger. The check that diagnoses it in 5 seconds
runs AFTER the one that hangs.

### G8 · first-pass findings C and F were never dispositioned
**Lens 2.** Neither appears in ROUND 2 or ROUND 3: not fixed, not deferred to 0104,
not disclosed. Finding C is G1/G2 above, raised once already. Finding F is
`demo-two-path-caches.mjs:98` — `const bad = (m) => ...` takes one parameter while
`:198`, `:258` and `:261` pass a second; `:258` is the assertion that reports *"the
tablet is blank with no network"* and it silently discards `coldErr`, the actual
exception. One-character fix.

---

## THE BYTE ASSERTION — five reviewers, one defect class, all false-RED

Every finding here is fail-closed. None can put wrong bytes on the tablet. All of them
wedge publication and blame the gravest invariant in the project for a filename.

### B1 · one side is C-quoted and the other is not
**Found by lenses 1, 2, 3 and 4 independently — the most-converged finding of the pass.**

`ci.yml:408` uses `git ls-tree -r HEAD --format='%(path) %(objectname)'` with no `-z`;
`ci.yml:415-418` uses `find -printf '%P\n'`, which emits raw bytes.

    $ git ls-tree -r HEAD --format='%(path) %(objectname)' | grep dok
    "dokument\303\266/a.png" c1b0730e…        <- expected side, C-quoted
    $ (cd dist && find . -type f -printf '%P\n' | grep dok)
    dokumentö/a.png                            <- actual side, raw

    root (/): tree=453226aed36c29f7 published=f663460168f94c85
    ::error::root (/) — the bytes about to be published are NOT the commit's tree.
    ::error::REFUSING TO PUBLISH — northstar invariant 4.

One `naïve.mp3` or one photo called `mamá.png` and the publish job is dead on every
trigger, forever.

**This is the same defect class the comment sixty lines above claims to have fixed.**
`ci.yml:326-329` and `:355` use `ls-tree -z | tr '\0' '\n'` with a comment explaining
precisely this hazard. The guard was applied to the two refusal greps — both verified
working, including a `.gitattributes` inside a non-ASCII directory — and missed at the
one site that is not a grep: the one that produces the invariant-4 verdict.

**The fix is `-z`, not `core.quotePath=false`.** Lens 3 tested all three:

    git ls-tree -r -z HEAD --format='%(path) %(objectname)'    -> "dokument\303\266.txt" STILL QUOTED
    git -c core.quotePath=false ls-tree -r -z ... --format=... -> dokumentö.txt OK, but
                                                                 "news\nline.txt" still quoted
    git ls-tree -r -z HEAD    (default format, no --format)    -> fully unquoted, both cases

### B2 · `git hash-object "$f"` has no `--`, and `%P\n` + `read -r` mangles three more classes
`ci.yml:417`. All reproduced:

    -icon.png            -> error: unknown switch `i'         -> invariant-4 refusal
    embedded newline     -> fatal: could not open 'dist/a'    -> invariant-4 refusal
    leading/trailing sp. -> read -r strips IFS whitespace     -> invariant-4 refusal

And the reason none of it trips `set -euo pipefail`: `:417` is
`printf '%s %s\n' "$f" "$(git hash-object "$f")"`. **A failing substitution used as a
printf argument is not a command failure** — an empty hash is written and the step
reports invariant 4. `ci.yml:578-583` documents this exact trap in a comment and
guards against it; the byte assertion two steps earlier does not.

Filenames with interior spaces and `$` are handled correctly — the array-prune fix
holds. Lens 3 tried to break it and could not.

### B3 · the hash depends on a third tree no gate examines
**Lens 1, reproduced at component level; lens 3 concurs.** `dist/` is created inside
`$GITHUB_WORKSPACE`, itself a git repository, so `git hash-object` applies attribute
rules from THAT tree — which the "Reject trees that can publish something other than
their own bytes" step never looks at, examining only `src/main` and `src/stable`.

    # workspace-root .gitattributes: *.html text eol=lf  (in NEITHER src tree)
    git hash-object index.html              -> 422c2b7ab3b3c668038da977e4e93a5fc623169c
    git hash-object --no-filters index.html -> c30dea8a3641ea99b125d04d599d843712292759  <- true bytes

This is the direction that lets the assertion say "these are the commit's bytes" about
bytes that are not. Reachability is narrow and it also covers `.git/info/attributes`
and `core.attributesFile` on a self-hosted runner. **The fix is one word: `--no-filters`.**

### B4 · a submodule outside `stable` gives the same false invariant-4 message
**Lenses 2 and 4.** Mode `160000` is listed by `ls-tree -r` and invisible to
`find -type f`; `git archive` writes an empty directory. Neither the
`.gitattributes`/symlink refusal nor the `^stable(/|$)` grep catches it. The first
pass tested a submodule AT `stable`; elsewhere was uncovered.

### B5 · the step is named for the published bytes and hashes a different set
**Lenses 1, 4 and 5; lens 3 resolved the disagreement by fetching the action.**

`actions/upload-pages-artifact@v4` tars with
`--exclude=.git --exclude=.github --exclude=".[^/]*"`. **The third exclusion is
v4-only** — v3 does not have it — and it drops every dotfile at any depth.

    hashed 43 · published 26 · published-but-not-hashed = EMPTY

So `published ⊂ hashed`, strictly: **nothing reaches the site unhashed, and there is
no hole.** But the step's closing line, `OK: both published copies are byte-for-byte
their own commit's tree`, is false as written — the published bytes are the commit's
tree minus `.github/**` and minus every dotfile. §6.1 member 2 is precisely a check
whose message overstates what it compared.

**The latent trap, and it is the one to act on:** a future legitimately-needed dotfile
is **silently dropped from publication while the assertion stays green**, because the
hash sees it on disk and in the tree. Lens 4 planted `.well-known/assetlinks.json` —
the Digital Asset Links file that binds an Android home-screen app to a web origin,
i.e. exactly what "the child's home-screen icon" is — and got `matches in artifact: 0`
with the gate still printing OK. A refusal with no message at all.

Also confirmed and worth knowing: **all of `docs/` is published at the public site
root** — every work order, finding and adversarial review.

### B6 · `find … -type l | head -5` under `pipefail` can exit 141 mute
**A DISAGREEMENT BETWEEN TWO REVIEWERS, SURFACED RATHER THAN AVERAGED.**

Lens 1 looked for this and reported it did **not** reproduce: at 300 symlinks, `find`
completes its write before `head` exits, because the output fits the 64 KiB pipe
buffer. Step `rc=0`, guard fired correctly.

Lens 3 reproduced it at **6000** entries: `head` closes the pipe, `find` takes SIGPIPE,
`pipefail` propagates 141, and the assignment kills the step before any `echo`:

    ================= STEP: assert published bytes =================
    [exit 141]

**Both are correct.** It is a pipe-buffer threshold, not a disagreement about
behaviour, and the honest statement is that it is real, fail-closed, mute, and
effectively unreachable in practice because committed symlinks are refused upstream.
Recorded because two reviewers reached opposite verdicts from sound method, and
averaging them would have produced a wrong answer in either direction.

---

## MESSAGES AND ATTRIBUTION — what a human reads when it goes red

### M1 · the `/stable/` call site attributes ANY nonzero exit to "NOT PREFIX-BOUNDED"
**Lens 2, 3/3 reproduced.** `ci.yml:471-481`'s `else` branch is unconditional on the
reason. Three unrelated failures — `sw.js` missing from the promoted copy, `dist/stable`
absent, `sw.js` present but unparseable — all print:

    ::error::THE /stable/ COPY'S WORKER IS NOT PREFIX-BOUNDED.
    ::error::If refs/heads/stable is still behind PUP-WO-0102, fast-forward it.

Its own comment at `:460` claims *"First, so its precise diagnostic is what a human
reads."* **It is the first `::error::` a human reads, and its prescribed remedy is to
perform the one act invariant 4 exists to protect, in response to a crash that has
nothing to do with it.** Mitigating: the per-copy loop still runs, so a correct message
appears later in the same log.

### M2 · check 7's anchor error is excellent prose delivered three wrong ways
**Lens 4.** The message itself — *"THIS IS MAINTENANCE, NOT FLAKINESS, AND THE FIX IS
NOT TO DELETE THIS CHECK…"* — does explain itself to a stranger, and lens 4 would not
change a word. But:

1. It arrives as an **uncaught Node stack trace, not a `::error::` annotation.**
   Measured: 22 `::error::` in `ci.yml`, **0 across all eight check scripts.** Check 7
   is run bare at `ci.yml:157` with no wrapper to re-emit, so the most-likely-to-fire
   refusal in the artifact is the one that never annotates.
2. It names `/tmp/puppad-red-8kxsKn/sw.js` — a tmpdir the `finally` has already
   deleted — and **not the file the human must edit.** "the anchor below" has no file
   or line.
3. It **throws**, aborting at the first broken anchor, so a refactor breaking five
   anchors is five sequential red runs.

Adding one entry to `urlsToCache` — the edit check 2 MANDATES whenever an asset is
added — breaks A14. Renaming a local `hit` to `cached` breaks A1. Bumping
`CACHE_VERSION` v17→v18 breaks nothing, which is well designed.

### M3 · `.gitattributes` and symlink refusals name the danger and never the remedy
**Lens 4.** Both refusals are CORRECT — `eol=` genuinely rewrites archived bytes, and
Pages tars with `--dereference`, so a relative symlink out of `dist` publishes runner
filesystem or the other copy's bytes. But a textbook-legitimate
`* text=auto eol=lf` gets an accusation with no instruction, and **the cheapest
response to a refusal you cannot diagnose is to delete the check.**

### M4 · the symlink scan has no prune, so `/stable/`'s symlinks are blamed on `/`
**Lenses 1 and 3.** `find dist -type l` at `ci.yml:401` descends into `dist/stable`.
Fail-closed, path printed, one line from the truth. Cosmetic.

### M5 · `ci.yml:167-178` describes a mode that no longer exists
**Lens 5.** It asserts *"On a pull request this job cannot run at all"* — twenty lines
above `# RUNS ON PULL REQUESTS TOO, AND THAT IS THE POINT` and the `if:` that does
exactly that. Architecture §5: a wrong comment is a claim.

### M6 · `ci.yml:500-504` asserts coverage the builder has already written down as false
**Lens 2.** The per-copy rationale states *"check 6 is the only thing that catches it"*;
`docs/feedback/PUP-WO-0103.md:459` says plainly *"`ci.yml`'s own written reasoning …
is wrong in the file."* It is still wrong in the frozen file.

---

## LIVENESS AND PRECISION — real, none of them a merge blocker

### O1 · `pages-publish` is one slot shared by pull requests and pushes
**Lenses 1, 4 and 5, all reasoned; none could execute it without CI.** GitHub keeps
one RUNNING plus one PENDING member per group, and a newly queued run evicts the
pending one **regardless of `cancel-in-progress: false`** — the mechanism this file's
own header at `ci.yml:42-57` documents, because it is how `922c2dc` lost its verdict.

The pair that loses work: push `main` → publish A running. Human fast-forwards
`stable` → publish B pending. Anyone pushes to any pull request → publish C queues →
**B is evicted** → B's `deploy` never runs. C is a PR, so it never deploys, and **no
later run rescues the promotion**, because the idempotence mitigation requires a
PUSH and a PR is not one.

The job comment at `:226-227` — *"Never cancelled in flight"* — is true and
irrelevant to a PENDING job. Adding `publish` to `pull_request`, correct for
demonstrating the refusals, is what put non-deploying runs into the deploying group.

Lens 4 found a documented one-line fix the artifact's long concurrency analysis
predates: the `queue` property, `max: Up to 100 jobs or workflow runs can be pending`,
legal with `cancel-in-progress: false` and illegal with `true`. **Unverified against
live docs by the builder — treat as a lead, not a fact.** The independent and
certainly-correct half is to keep PR verification out of the deploy group:

    group: ${{ github.event_name == 'push' && 'pages-publish'
               || format('pages-verify-{0}', github.ref) }}

### O2 · the workflow-level group collides for the promotion flow specifically
**Lens 4.** `ci-${{ ...github.sha }}` is the same for push-to-`main` and
push-to-`stable` **of the same commit** — which is exactly what a promotion is, since
the fast-forward moves `stable` to a commit already on `main`. So the stated guarantee
*"every commit that lands gets a verdict"* fails for the one flow it most matters for.

### O3 · every deployment rewrites `/stable/build-stamp.json`
**Lens 1, reasoned from the workflow with the stamp behaviour reproduced.** A push to
`main` deploys the whole artifact including `./stable/`. The promoted copy's APP bytes
are unchanged — rebuilt from `refs/heads/stable`, `CACHE_NAME` does not move, the
stamp is not in `urlsToCache`, so nothing reaches the tablet. But `ci.yml:575` names
this file as the instrument for **roadmap P1 gate item 3**, and that gate is worded as
a falsification of invariant 4: *"Land any commit through the automated path; observe
the promoted copy change without a human action."* An auditor curling that file before
and after a `main` merge sees the promoted copy change. Either drop `built_at`/`run`
from the promoted stamp, or state that gate 3 compares `.sha`.

### O4 · a PR based on `stable` is verified in the root position, never the promoted one
**Lens 1, reasoned.** `pull_request:` has no `branches:` filter, and `ci.yml:264` makes
the root copy the PR head unconditionally. A PR targeting `stable` is checked as "what
`/` would serve" and never once as "what `/stable/` would serve" — including
`check-two-trees`, which pairs the PR head against the CURRENT stable rather than
against `main`. No hole: the push-to-`stable` that merges it IS checked in the promoted
position. But the PR's green is weaker than it reads.

### O5 · until today, no adversarial pass existed against this artifact
**Lens 5, and it is the finding that triggers §7.** See the divider at the top of this
section. Additionally, the feedback file's ACCEPTANCE section still offers, as its
evidence, CI output from the DELETED dispatch surface — `VERIFY against hypothetical
promoted copy`, `is NOT an ancestor of refs/heads/stable`, `mode = verify` — none of
which exist in the frozen `ci.yml`. And acceptance item **8a** (*"a cancelled or absent
run does not publish, demonstrated — not reasoned"*) is neither demonstrated, flagged,
nor waived; on an actual cancellation the GATE step is SKIPPED, so the work order's
*"fail closed AND SAY SO"* says nothing.

---

## WHAT FIVE REVIEWERS ATTACKED AND COULD NOT BREAK

Recorded so the empty results carry weight. All reproduced unless marked.

- **No path from anything to `/stable/`.** Lens 1 enumerated the full event × job
  matrix rather than the intended ones. `on:` admits exactly four situations — PR from
  a same-repo branch, PR from a fork, push to `main`, push to `stable`. There is no
  `workflow_dispatch`, `workflow_run`, `deployment`, `repository_dispatch`, `schedule`
  or `pull_request_target`, and `ls .github/workflows/` shows **one file**, so nothing
  listens on the deployment events this one emits. On every PR shape `deploy`'s `if:`
  is false and `DRY_RUN` is `'true'`. A re-run preserves the originating event. Fork
  PRs get a read-only token and no secrets.
- **The workflow cannot move `stable` or any ref.** `grep -nE 'git +push|GITHUB_TOKEN|
  secrets\.|GH_TOKEN|token:'` across `ci.yml` and all of `.github/ci/**` returns only
  comments and the `id-token: write` line. Workflow-level `contents: read`; `publish`
  re-states it; `deploy` widens only to `pages: write` + `id-token: write`, neither of
  which can write a ref.
- **The PR-head checkout cannot supply the promoted copy.** `ci.yml:275` is
  `refs/heads/stable` with checkout's default `repository:`, which on a `pull_request`
  is the BASE repo. `:279-308` then asserts the checkout equals what `git ls-remote`
  says the server holds, with no fallback, and the `awk '$2 == r'` exact match at `:301`
  genuinely closes the `decoy/refs/heads/main` tail-match. The PR exemption applies to
  `main` only; `stable` is asserted on every event.
- **Nothing downstream of the byte assertion writes into `dist`** except the Stamp
  step, deliberately. Lens 1 ran the entire downstream chain and re-ran the byte
  assertion verbatim: `root tree=7e44d8eb… published=7e44d8eb…`, `promoted tree=…
  published=…`, `rc=0`, and a file-level diff showed NO FILE ADDED/REMOVED/RESIZED.
  Every check writes to `mkdtemp`; no write target derives from `argv[2]`.
- **`permissions: contents: read` on publish is correct and complete.** Lens 4 traced
  it: `upload-pages-artifact@v4` → `upload-artifact@v4.6.2`, which uses the Actions
  Results service with `ACTIONS_RUNTIME_TOKEN`, not `GITHUB_TOKEN`. What publication
  needs beyond read is exactly `pages: write` + `id-token: write`, and it lives only on
  the job that deploys. **Nothing publish legitimately needs is missing.**
- **The GATE / `continue-on-error` / conditional chain is sound.** Full inventory:
  `ci.yml:197, 448, 484, 485, 536, 595, 604, 628`. **No `always()` anywhere.**
  Enumerating all four `outcome` values against documented semantics, lens 2 found no
  way for a skip to be reported as a pass or a failure as a skip. `per_copy` keys on
  `.conclusion` (masked by `continue-on-error`) while GATE keys on `.outcome` (the real
  failure) — that asymmetry is deliberate and correct. Both `if: env.DRY_RUN …` steps
  inherit the implicit `success()`, so the upload cannot fire past a failed GATE.
- **The two DELETED assertions are honest.** Both `NOT ASSERTED:` lines actually print
  in a real green run — verified, not read. Nothing in `ci.yml`, the work order, the
  roadmap or the northstar reclaims either. Lens 2 checked the sharpest candidate:
  `demo-two-path-caches.mjs:177` cites roadmap P1 gate 4, and gate 4 is explicitly
  *"after force-activating the root worker"* — the SECOND activation, still asserted.
  The deleted assertion covered the FIRST, which the gate does not claim.
- **ROUND 3's demo-PR table reproduces exactly**, against the real commits:
  `pr-refuse-gitattributes ca69327` and `pr-refuse-symlink 4a54db5` both fail at
  *"Reject trees that can publish something other than their own bytes"*;
  `pr-refuse-stable-path 33b8c8f` fails at *"Build the site from the COMMITS"*. All
  three precede the byte assertion, so ROUND 3's *"the byte assertion was SKIPPED in
  all three"* is correct.
- **The B1/B6 claim survived attack from both sides.** Lens 3 confirmed that with both
  positive controls intact, B1's only failures are the two controls; and that with both
  neutered to ORDINARY SUCCESS values, B1 and B6 both return to `CHECK 5 PASSED` with
  the origin-wide read present. The controls are exactly what turned them loud.
- **The `-z` C-quoting fix works on both refusal greps**, including a `.gitattributes`
  inside a non-ASCII directory. `^stable(/|$)` correctly catches a `stable` file, a
  `stable` directory and a submodule named `stable` in `main`, and correctly passes
  `stable.txt` and `stablemates/`. A legitimate nested `stable/` inside the PROMOTED
  tree passes cleanly — the F13(a) fix is real.
- **`export-ignore` in `stable` would empty the promoted copy** (0 files) and the byte
  assertion catches it as a backstop. Defence in depth is real.
- **The array-prune fix holds.** Empty-array expansion under `set -u` is fine on
  bash ≥ 4.4; interior spaces and `$` in filenames pass. Lens 3 attacked it directly
  and could not break it.
- **Timeouts are not tight:** check-load 4.12s, demo-two-path-caches 5.39s,
  check-two-trees 3.96s, check-mutations 7.5s, against `timeout-minutes: 20`.
- All four pinned actions resolve; `v4`/`v4` is a compatible pairing.

---

## DISAGREEMENTS BETWEEN REVIEWERS — surfaced, not averaged

1. **`find | head` SIGPIPE.** Lens 1: did not reproduce at 300 symlinks. Lens 3:
   reproduced at 6000. Both correct; it is a pipe-buffer threshold. See B6.
2. **Item 6's mechanism.** Lens 5 and the builder: a dead assertion, out of scope.
   Lens 3: wrong — interception is by controlling client, and the real defect is a
   race it measured at 3-caught-in-10. **Lens 3 wins on evidence.** See G5.
3. **The third M-family member.** Lens 1 nominates the shipped `sw.js:337`; lens 5
   nominates the harness/mutation-coverage gap; lens 2 reports finding none. Not
   actually a conflict — lens 1 found the DEFECT, lens 5 found the BLINDNESS that hides
   it, and lens 2 searched a different surface. Both nominations stand, as one finding
   with two halves.
4. **The flip verdict, and this one would have been dangerous to average.** Lens 3
   answered *"safe, and I could not break the architect's claim."* Lenses 1, 4 and 5
   answered unsafe. Lens 3's verdict is scoped to PUBLICATION MECHANICS, and it says so
   — it explicitly notes the pipeline is inert until the fast-forward, and it never
   considered the live worker. **The scope of an answer is part of the answer.** A
   majority vote would have produced 3-1 unsafe and lost the reason; a naive averaging
   would have produced "mostly unsafe" and lost the fact that lens 3 is not
   contradicting anything.
5. **`upload-pages-artifact` tar flags.** Lens 1 caveated its flags as v3's, from
   memory. Lens 3 fetched and read v4 and found the additional `--exclude=".[^/]*"`.
   Lens 3 has the better evidence and lens 1 flagged its own uncertainty, which is
   exactly what made the conflict cheap to resolve.

---

## WHAT THE DISPATCHER GOT WRONG DURING THIS PASS

Recorded because the pass caught them and because two are the same shape as the
findings above.

**1. I relayed lens 5's item-6 mechanism after "verifying" it, and it was wrong.**
I read `demo-two-path-caches.mjs:186`, saw the probe fetch a URL outside the root
worker's scope, concluded the worker never sees it, and called the assertion dead.
Service-worker interception is by controlling client, not URL scope — `sw.js:232`
returns `true` for cross-origin in this very worker, which I had read. I confirmed the
hypothesis I arrived with instead of testing it. Lens 3 tested it and measured a race
where I had asserted a certainty. **Verified against the failure I imagined**, which is
a memory this project already carries, and the second instance of it in one day.

**2. My pointer resolver produced a false red on its first use.** It reported the
prompt's quotation of northstar invariant 4 as missing — 0 matches. The invariant is
present and materially identical at `docs/northstar.md:62`; my grep was case-sensitive
and the prompt embeds the quote mid-sentence with a lowercase "the". Member 3 inside
the check built to enforce member 4, about thirty seconds after member 4 was ratified.

The generalisation, now recorded in architecture: **member 4's enforcement is itself
subject to member 3, and not incidentally.** A pointer resolver's whole job is to turn
absence into red, so *every bug in it presents as a dangle* — it is the one check whose
false positives are indistinguishable from its true positives without opening the file.
Mitigation, one line: **when the resolver reports a miss, print the surrounding lines
of the cited file, not the count.**

**3. The freeze this pass ran against was six merges stale, and every freeze check
passed.** Head, clean tree, protected-surface diffs and green checks are four checks,
none of which opens a path the prompt names. Two of the prompt's twelve pointers —
`PUP-WO-0104.md` and architecture `§6.2` — existed on `main` and not on the branch, so
the M9/M7 fence was inert and the authority that removed the rollback lever was
unreadable. Caught by the architect before dispatch. This is §6.1 member 4 and it is
where the rule came from.

**4. I closed F15 "by construction" on evidence that could not have exercised it.**
See the flip section. Thirteen real CI runs, none of which ever pushed to `stable`.

---

## VERDICT

**Disqualifying for MERGING PR #10: nothing.** Five reviewers, one of them working the
full event × job matrix, found **no path** by which `main`'s content, a pull request's
head, a fork, a re-run, or any other event places unpromoted bytes on `/stable/`. Every
defect found in the publish path is fail-CLOSED. The central rule of the artifact
holds.

**Disqualifying for FLIPPING Pages today: three things, none of them code.**

1. `refs/heads/stable` must be fast-forwarded — **before PR #10 merges**, not merely
   before the flip, because `ci.yml:471` has no event guard and every PR in the repo
   goes red at that call site the moment #10 lands.
2. The `github-pages` environment's deployment branch policy must include `stable`, or
   promotion pushes will never deploy and the human will be told they did.
3. The tablet must be off or in airplane mode across the flip window, until both
   `/PupPad/` and `/PupPad/stable/` are verified 200 — because the LIVE worker caches
   whatever the origin returns, including a 404.

**Real, and blocking the next `sw.js` change reaching publication rather than this
merge:** G1, G2, G4, G5, G6, G7 and the F-LIVE blindness. The gate is weaker than the
feedback file claims, in ways that matter for the regression it exists to catch.

**Real-but-tolerable:** B1-B5, O1-O4, G3, G8.
**Cosmetic:** B6, M4, M5.
**Message quality, and worth more than its severity suggests:** M1, M2, M3 — a refusal
a human cannot diagnose is a refusal that gets deleted rather than satisfied.

**§7 IS INVOKED ON THREE COUNTS:** a need to modify `sw.js` (F-LIVE); repository
settings that publication depends on (the environment policy, and `refs/heads/stable`);
and the builder's own standing condition that **a third pass finding serious defects on
one work order is a scope signal to report rather than absorb.** Lens 5 reached that
conclusion independently and filed it as O5.

