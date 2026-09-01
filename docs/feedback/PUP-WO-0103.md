# PUP-WO-0103 — upward feedback

**Builder:** CC-EM (pup-b) · **Branch:** `build/wo-0103`, from `origin/main @ 30036e9`.
**Verbatim adversarial exchange:** `docs/findings/PUP-WO-0103-adversarial.md`. Neither
file summarises the other's job.

---

## Gates — checkable facts

| Gate | Status | Check it yourself |
|---|---|---|
| Protected surfaces diff to empty — `index.html`, **`sw.js`**, `manifest.json`, both icons | **EMPTY** | `git diff origin/main -- index.html sw.js manifest.json icon-192.png icon-512.png` prints nothing |
| Diff scope | `.github/` and `docs/` only | `git diff --stat origin/main` |
| Publication permissions | `pages: write` + `id-token: write`, **in the deploy job alone** | the `publish` job is `contents: read`; grep the file |
| Real CI runs, not local execution | **13 runs on this branch** | `gh api repos/ikthys777/PupPad/actions/runs?branch=build/wo-0103` |

**`sw.js` is untouched.** It is `PUP-WO-0102`'s, merged and on a tablet. Nothing in
publication needed a worker change, so §4's flag-and-stop never fired.

---

## §0 paid for itself: nine defects, none findable by reading

The work order said to push early and let real CI fail, because this half cannot reach
the tablet. Every item below was found by a run, not by review. Several are in code
that came forward from `PUP-WO-0101` and had **never executed once** — which is F15,
and it closes here by construction.

| # | Defect | How it surfaced |
|---|---|---|
| 1 | `environment: github-pages` on the publish job gated **verification** behind the **deployment** branch policy | job rejected before step one: `{"name":"Publish both copies","steps":[]}` — no log at all |
| 2 | The browser was installed **after** the checks that drive it | check 6 failed for both copies: `Executable doesn't exist at .../chrome-linux/chrome` |
| 3 | The named `/stable/` call site sat **after** the general loop, so it was **skipped** exactly when it mattered | acceptance 5a's subject never ran |
| 4 | Refusing `stable` correctly made the entire green path unreachable | every step after the `/stable/` check skipped, and stays skipped until a human fast-forwards `stable` — which happens only *after* this merges |
| 5 | Acceptance item 3's refusals were unprovable without substituting `main` | they are properties of `main`'s tree; only the shell source could be read |
| 6 | **My input validator failed the runs it existed to let through** | all three refusal demos died at validation: `stable_sha must be a full 40-character…` when only `main_sha` was named |
| 7 | **My own concurrency fix had the same hole, one event kind over** | two of six dispatches came back `cancelled` |
| 8 | A red run of mine proved nothing — the planted defect was never reached | root-red demo failed at the `/stable/` check, not the loop |
| 9 | The two-tree check **crashed with a stack trace** on its own headline case | found locally, before CI |

### The three worth reading in full

**#1 — a protection working correctly, blocking the wrong thing.** The `github-pages`
environment carries a `branch_policy`. Binding the whole publish job to it meant every
*verification* step sat behind the *deployment* policy and could not run anywhere the
site cannot be deployed from. Backwards. The policy is a repository setting and
therefore not mine (§7), so the fix was on my side: `publish` verifies with
`contents: read` and no environment; a new `deploy` job holds the environment and the
elevated credential and does nothing but deploy. **Net effect worth naming: the
elevated credential now exists in one three-line job instead of across an
eighteen-step pipeline.**

**#6 and #8 are the same trap, and it caught me twice in one afternoon.** A run went
red, red was what I expected, and the step under test never executed. In #6 a
validation step rejected the very runs dispatched to exercise a refusal; in #8 the
`/stable/` check fired before the loop where I had planted a root-copy defect. **Both
would have been recorded as successful refusal demonstrations if I had read the
conclusion and not the failing step name.** This is why §3.8 asks for the failing step
name and captured output rather than a verdict, and I would not have understood why
until it happened to me.

**#7 is a correction to my own fix.** CC-A found that `922c2dc` — the merge that put
`sw.js` on Buddy's tablet — had a `cancelled` push run and no verdict of its own,
because GitHub permits one *pending* run per concurrency group and a newly queued run
evicts it regardless of `cancel-in-progress`. I keyed pushes by `github.sha` and
believed that closed it. It did not: for a `workflow_dispatch`, `github.sha` is the
SHA of the **branch head**, identical across every dispatch on that branch. Three
demos dispatched seconds apart shared a group and the middle was evicted. **The same
mechanism, one event kind over, reproduced by the fix for it.**

Three event kinds need three answers, and the general form is what I had missed:
`pull_request` by ref (supersede is what you want), `push` by commit (every commit
gets a verdict), `workflow_dispatch` by run (a deliberate act; none may evict
another). And note *how* it surfaced — my collection loop waited for "no incomplete
runs", then read three, one of which had been silently evicted. **Absence looked like
completion**, which is the finding's own subject.

---

## Acceptance — demonstrated, with the failing step named

All runs are on `build/wo-0103`; every one is retrievable from the Actions API.

### The full pipeline, green end to end (§3.2)

Run `33510869356`: `Seven checks: success` · `Publish both copies: success` (all 17
steps) · `Deploy to GitHub Pages: skipped`.

```
stable: VERIFY against hypothetical promoted copy 30036e9c3aa4 (real tip 2952aa1a8443); this run cannot deploy
root (/):            tree=b00e76ad5fd9fa30  published=b00e76ad5fd9fa30
promoted (/stable/): tree=b00e76ad5fd9fa30  published=b00e76ad5fd9fa30
```

That is §1.2's core assertion — the **published bytes**, hashed from the directory
about to be uploaded and compared against the commit's tree — passing in real CI. The
first time any of this pipeline had executed.

### §3.3 — the three refusals, against real commits carrying the real defect

Each was built on `origin/main`, pushed to a `demo/refuse-*` branch, and named to
`verify` as the root copy. They are **kept, not deleted**, so the demonstrations can
be re-run rather than believed.

| Commit | Branch | Failing step | Error |
|---|---|---|---|
| `c72f4786` | `demo/refuse-stable-path` | Build the site from the COMMITS | `main carries a 'stable/' path, which collides with the promoted copy's mount point` |
| `2fddd80d` | `demo/refuse-gitattributes` | Reject trees that can publish something other than their own bytes | `main carries a .gitattributes. git archive honours it…` |
| `8cb93873` | `demo/refuse-symlink` | Reject trees that can publish something other than their own bytes | `main contains a symlink. The Pages artifact is tarred with --dereference…` |

### §3.4 — a red check on **either** copy blocks the deployment, each shown alone

- **Promoted copy red:** `refs/heads/stable @ 2952aa1`, the real artifact.
  Step `Check 5 against the /stable/ copy specifically`, `##[error]THE /stable/ COPY'S
  WORKER IS NOT PREFIX-BOUNDED.` `Deploy: skipped`.
- **Root copy red:** `demo/refuse-origin-wide-reap @ 3d27d06d`, with `stable` named to
  a good commit so the loop is actually reached — see defect #8.
  Step `Check EVERY published copy`:
  ```
  ##[group]checking published copy: /
    FAIL  reap DELETED the OTHER deploy path's cache — this is the origin-wide reap
  ```

### §3.5 and 5a — §1.4's mechanism, on the live case

`2952aa1` is refused at the **named** step, whose message names the remedy:

```
##[error]THE /stable/ COPY'S WORKER IS NOT PREFIX-BOUNDED.
##[error]If refs/heads/stable is still behind PUP-WO-0102, fast-forward it.
```

Ordering is now a property, not prose: it holds whatever order the human steps run in.

### §3.6 — the two published workers as a pair

`check-two-trees.mjs`, run in CI inside the publish job. Where the two trees are
identical it **manufactures** promotion lag — advancing the root copy the way a merge
does, a changed `index.html` plus the `CACHE_VERSION` bump check 3 mandates — because
a check that only fires when the copies happen to differ would silently do nothing
most of the time, which is the timing form of the same defect F9 named.

```
promotion lag manufactured: root CACHE_VERSION v17 -> v17-rootlag
ok  the promoted copy served its own build offline, not the root's
```

### The rollback lever (§1.7), and the half of it I could not exercise

Refusals demonstrated:

```
stable: checkout=30036e9c3aa4 remote=2952aa1a8443
##[error]30036e9c3aa4… is NOT an ancestor of refs/heads/stable (2952aa1a8443…).
##[error]The rollback lever can only move the promoted copy backward along its own history.
```

That is §7's attack — using the lever to put `main`'s content on `/stable/` — refused
even with a human naming the SHA. A 40-hex SHA is necessary and **not sufficient**.

**Stated as a gap rather than left to read as coverage: the lever's SUCCESS path is
unexercised.** Running it deploys, and deploying is Scotty's after the Pages flip, not
mine (§7). So the lever reaches `main` with its refusals proven and its happy path
proven only by construction. **`decision-needed`: whether that is acceptable, or
whether the first rollback should be a rehearsed step in §6's sequencing.**

---

## §1.6 — observation windows, stated with their justification

- **`check-two-trees.mjs`, 1500 ms after each registration.** install → activate →
  claim is three event-loop hops plus `cache.addAll` over loopback, measured well
  under 400 ms on this runner; 1500 ms is ~4x the observed worst case. It is a floor
  on how long we **wait**, never a bound on what counts: every assertion re-reads live
  state at the moment it asserts, so a slow worker fails an assertion rather than
  passing because the check stopped looking.
- **`demo-two-path-caches.mjs`, 1200–1500 ms**, same reasoning, inherited unchanged.
- **`check-cache-isolation.mjs`, 250 ms post-settle trap.** Bounded and stated: a
  timer longer than the remaining process lifetime still escapes. That limit is real
  and is not papered over.
- **The publish job as a whole: `timeout-minutes: 20`.** A hung browser check fails the
  run rather than hanging the queue; publication is fail-closed, so a timeout
  publishes nothing.

---

## What did not work, and what was deliberately not done

- **The rollback success path** — above. Cannot be run without deploying.
- **`upload-pages-artifact` and `deploy-pages` themselves have never executed.** A
  `verify` run stops before them by design, and the `deploy` job cannot run from a
  branch. They first execute on the first push to `main` after this merges. The verify
  step says so in its own output rather than letting a green imply otherwise.
- **P1 gate items 3 and 4** need a live site and are CC-A's and Scotty's after the
  Pages flip. Not claimed. The build stamp exists so item 3 is two `curl`s.
- **`sw.js`, `index.html`, `manifest.json`, icons** — untouched, per §2 and §4.
- **The `demo/refuse-*` branches are left in the repository on purpose.** They carry
  real defects — including a symlink to `/etc/passwd` — and that is exactly why they
  are safe: publication refuses all four, demonstrably, and they are unreachable from
  `main` or `stable`. Deleting them would make the demonstrations unrepeatable, which
  is the failure mode `PUP-WO-0102`'s uncommitted mutation engine had. If CC-A would
  rather they went, deleting them costs nothing but the reproducibility.

---

# THE ADVERSARIAL PASS — AND A §7 FLAG-AND-STOP

**Verbatim in `docs/findings/PUP-WO-0103-adversarial.md`.** Three disqualifying
findings. **I have fixed none of them**, and that is deliberate: §7 makes F2 a
flag-and-stop, and its own words are *"Not a check to tune."*

## The flag-and-stop

**F2 · `verify` constructs `main`'s bytes at `/stable/`, passes every check, and is
stopped only by one boolean.** §7's bar is *"any path by which `main`'s content could
reach `/stable/` — found, suspected, or **merely not ruled out**."*

I reproduced it before reading the pass's reasoning, because it is mine:

```
mode = verify    stable_sha = 30036e9c3aa4…  (= refs/heads/main)
  root (/):            tree=b00e76ad5fd9fa30  published=b00e76ad5fd9fa30
  promoted (/stable/): tree=b00e76ad5fd9fa30  published=b00e76ad5fd9fa30
  publish: success
```

**That run is this document's own §3.2 headline evidence.** I offered it above as proof
that §1.2 works. It is the state §1.2 exists to forbid. The two identical hashes I
quoted as a success are the finding.

The verify branch `continue`s past the only assertion tying `/stable/` to
`refs/heads/stable`, and its comment justifies that with *"Safe because verify cannot
deploy"* — a claim about a **different job**, asserted here, enforced here by nothing.
Two independent expressions (`DRY_RUN`, and the deploy `if`) are complementary only
because the `choice` input happens to have exactly two options.

**I built that input.** Defect #4 was real — refusing `stable` made the green path
unreachable — and the fix I chose for it created a supported, fully green configuration
whose sole guard is one predicate. **A fix that opens a §7 violation while closing a
real problem is the shape that split `PUP-WO-0101`,** and it is mine again.

## The other two

**F0 · Nothing in the publish path can observe the root worker eating `/stable/`'s
cache.** Verified myself against a mutant that deletes the promoted copy's caches:

```
check 5 (sandbox)          RED (caught)
check 6 (browser)          PASS  <-- not caught
check-two-trees (§1.5)     PASS  <-- not caught
```

Root activates before stable's cache exists; the "force-activate" is a no-op against a
byte-identical worker; my baseline is sampled after both have activated. **The harness
I built as §1.5's "hardest acceptance item" reproduces the defect it was built to
backstop.** And the three cache checks disagree about the deploy paths — check 5 uses
`/PupPad/` and `/PupPad/stable/`, both browser checks use `/` and `/stable/` — so a
reap keyed to the real path literal is invisible to all three. That is
architecture §6.1's scar repeating: a green suite over the exact hazard §6 was written
about, on the copy the child uses.

**F1 · A rollback is erased by the next push to `main`.** The lever deploys a named
commit but never moves `refs/heads/stable`, so the next merge rebuilds `/stable/` from
the tip and silently republishes the build the human rolled away from. Invariant 4's
own falsification test — *the promoted copy changes without a human action* — passes.

## What the pass could NOT break, which is the part that matters most

**On an ordinary push to `main`, with no human dispatching anything, it found no path
by which `main`'s content reaches `/stable/`.** It attacked that specifically: a
`stable/` path in main, a blob named `stable`, a submodule at that path,
`.gitattributes` both directions, committed symlinks, post-archive substitution, extra
files under `dist/stable`, `tar | tar -x` merging, and PR events reaching `publish`.
Every one refused or caught. The invariant-4 `ls-remote` check, the ancestry gate, the
archive refusals and the byte assertion all hold under attack.

**So the disqualifying findings are: one dispatch-mediated latent path (F2), one gate
blindness (F0), and one lever defect (F1). The ordinary-push path is sound.**

## Dispositions — none applied

| # | Finding | Disposition |
|---|---|---|
| **F0** | Publish path cannot see the cross-path reap | **CC-A's.** Fixes 1–3 are in my file; 4 touches a 0102 file — a seam call. |
| **F1** | Rollback erased by the next push | **CC-A's.** Its two options differ in kind: remove the lever, or add a pin. |
| **F2** | `verify` green-lights main at `/stable/` | **FLAG-AND-STOP. Not mine to tune.** |
| F3 | Check 5 barely exercises the promoted scope | 0102's file; seam call |
| F4 | Two-tree assertions skipped in real lag; two vacuous `ok`s | mine, ready to fix on CC-A's word |
| F5/B/C | Check 7's scope and exit-code-only verdict | mine + 0102 seam |
| F6 | Shell injection ahead of its own validation | mine, unambiguous four-line fix, no trade-off |
| F7 | `rollback` with no `stable_sha` bypasses its guard | mine |
| F8 | The lever has **zero** valid targets today | sharper form of the gap I raised; CC-A's |
| F9 | A red `/stable/` masks all root-copy findings | mine — the inverse of my own defect #3 fix |
| F10 | Byte assertion blind to symlinks; hashes a different set than ships | mine |
| F11 | Job-level concurrency may repeat the eviction defect | unconfirmed; needs a CI run |
| F12 | §1.6's stated window is false — `afterSettle` read once | **mine, in this document.** The claim above is wrong. |
| F13/F14 | Two false refusals; a blob named `stable` | mine |
| F15 | Environment branch policy unrecorded | Scotty's; belongs in architecture §6 |

**F12 corrects this document.** My §1.6 entry says the 250 ms trap records *"from here
to the end of the run."* It does not — `afterSettle` is read once, immediately after the
sleep. The real window is 250 ms flat, and I stated a bound wider than the truth in the
section whose entire job was stating bounds honestly.

## What I am NOT claiming

The pass is the **first** on this work order, so §7's third-pass condition is not
tripped. But the *other* signal it names is present and I would rather say it than have
it noticed later: **two of the three disqualifying findings are in changes I made
during this work order, both in response to real problems the work order asked me to
solve.** F2 came from making the pipeline exercisable; F0 came from building the
two-tree harness. That is fixes generating defects, which is the evidence that split
`PUP-WO-0101` — and it is a scope signal for CC-A to weigh, not for me to absorb by
fixing quietly.

---

# ROUND 2 — fixes applied under CC-A's rulings

All eight checks green; protected surfaces still diff to empty. **Every fix below was
demonstrated red first with the mutant it exists to catch, then green.**

| # | Fix | Red demonstration |
|---|---|---|
| **F2** | The ancestry gate applies to **any** named `stable_sha`, in **every** mode. `verify` no longer takes a branch that skips it on the strength of a claim about a different job. | main's tip refused as a promoted copy |
| **F0** | Promoted copy comes up **first** so its cache exists before the root worker activates; baseline sampled **before** that activation; both browser harnesses serve `/PupPad/` and `/PupPad/stable/` | `THE ROOT WORKER DESTROYED THE PROMOTED COPY'S CACHE` in check-two-trees; `the /stable/ cache was DELETED by the root worker activating` in check 6 |
| **F3** | Check 5's full reap matrix and install inspection at **both** scopes | a reaper active only at the promoted scope — 5 assertions fire |
| **F5/B** | ~~Check 7's verdict names **which** assertion must fire, not just the exit code~~ **FALSE AS WRITTEN — see ROUND 4 / G1. True of PART A only; none of PART B's seven mutations carries an `expectFail`, so their verdict is the exit code and nothing else.** | wrong expected assertion → `RED, but NOT on the expected assertion` — PART A only |
| **F6** | Every dispatch input via `env:`; no expression interpolated into any `run:` | — (no trade-off; the payload no longer reaches a shell) |
| **F7** | The validation step runs on every dispatch, so its rollback guard is reachable | — |
| **F9** | Both copies judged every run: `continue-on-error` plus a fail-closed GATE | — |
| **F4** | Cross-serving markers unconditional; `distinct` not vacuous at n=1 | covered by F0's mutant |
| **F10a** | Symlinks refused in the directory about to be published | — |
| **F13/F14** | The two over-broad greps tightened | — |

**The three cache checks now agree with the deployment and with each other.** All use
`/PupPad/` and `/PupPad/stable/` — the shape whose nesting is the reason `sw.js` has a
trailing-`|` delimiter at all, and which neither browser check had ever exercised.

**On check 7's scope (F5, remaining half).** Its verdict is fixed but its *subject* is
still one check. Adding `check-two-trees` mutations means a browser launch per
mutation. Flagged rather than done: `decision-needed`.

**Not addressed, and why:** F1 and the lever await Scotty's ruling on whether
`refs/heads/stable` can be moved backward — Ruling 5 removes the lever entirely if it
can, which deletes F1 and F2's original cause. F8 and F15 are CC-A's and Scotty's.
F11 needs a CI run to confirm. F12's correction stands above, unedited.

## On the commit discipline — the sharp version is right, and I would go further

CC-A's version — *commit each coherent unit as you complete it, not when you are
done* — is correct, and the reasoning is the part worth keeping: **a rule that fires
when you decide to stop protects only the cases that were already safe.** A stall is
not a decision.

Where I would push: it should not be a discipline at all. Architecture §5 now says one
that keeps needing to be remembered is a candidate for something that remembers it
instead — and this is the clearest case yet, because the failure mode is *silence*.
Nothing announces an uncommitted tree; it looks exactly like a clean one until someone
runs `git status`. The detection half already exists. What is missing is anything that
acts on it, and it does not need to be clever: a checkpoint commit on a timer, or on
turn boundary, would have made this cost nothing.

I would rather that than be trusted to remember, because I have now demonstrated twice
that the moment I most need to remember is the moment I am least able to.

---

# ROUND 3 — the surface removed, and what that dissolved

## F1 and F2 were DISSOLVED, not dropped

A future reader will find F1 and F2 in the pass record marked **disqualifying**, with
no fix commit against either. That is deliberate and it is the whole story: **the
feature they lived in was deleted.**

CC-A ruled the rollback lever out after verifying the branch ruleset directly —
`Protect-stable`'s `bypass_actors` carries repository-admin at `bypass_mode: always`
while refusing every minted token with `GH013`. So the human's promotion and rollback
authority is **structural**, and a workflow lever was a second, weaker mechanism for an
authority already correctly implemented. F1 had already shown the lever never moved
`refs/heads/stable`, so the next push to `main` silently republished the tip and undid
it.

Removing `mode`, `main_sha`, `stable_sha`, the verify/rollback branching, the ancestry
gate and the deploy boolean deleted **both** findings at once.

**One thing I pushed back on, and CC-A adopted it.** The ruling's stated reasoning was
that the `demo/refuse-*` branches already demonstrate the archive refusals "through the
ordinary PR path." They did not and could not: **the publish job did not run on pull
requests**, so every one of those refusals had only ever been exercised by dispatch.
Removing the surface with no substitute would have *deleted* that evidence and left the
three steps between a poisoned tree and Buddy's tablet untested forever — F15 exactly.

The fix was better than either option: **let the publish job run on `pull_request`
without upload or deploy.** It costs nothing (`contents: read`; every publishing
credential lives on `deploy`, which is push-only) and it makes the original reasoning
true rather than aspirational.

## The first second-pass was killed against a superseded artifact

I froze at `62d0f01` and dispatched a pass; CC-A's ruling to remove the surface arrived
minutes later. I recommended killing it and did.

The reason is sharper than "it would waste a run": **~150 lines of what it was
attacking were about to cease to exist, and its silence on the new shape would read as
coverage.** That is the failure this project has spent more effort on than any other,
and it would have been self-inflicted. It is also the freeze problem in a different
tense — instead of the artifact moving under the reviewer mid-run, it moves out from
under the finished report.

**Three of its delegated children finished after the kill and returned real findings.**
I verified them rather than discarding them on a technicality: the kill was correct
about the *artifact*, and those findings were still true about the *code*. F-A came
from one of them and is the reason the publish job can run at all.

## The archive refusals moved from dispatch to the PR path — verified by CC-A

Item 4 was verified by CC-A rather than me, which is the right division: verification of
evidence is reviewer work. All three demo PRs, `head_sha` matched against the commit
under test rather than a stale run:

| Branch | Failing step |
|---|---|
| `demo/pr-refuse-gitattributes` | Reject trees that can publish something other than their own bytes |
| `demo/pr-refuse-symlink` | Reject trees that can publish something other than their own bytes |
| `demo/pr-refuse-stable-path` | Build the site from the COMMITS, not the working trees |

**The byte assertion was SKIPPED in all three**, so it was not the cause — which is what
distinguishes this from my earlier runs, where it was. **`deploy` was SKIPPED in all
three**, so publish-on-PR works in both directions: it verifies, and it cannot publish.

And the anomaly I flagged rather than assumed away — `#16` showing no publish job — was
the **stale run**, exactly as suspected. Worth recording that it was flagged as
unexplained rather than waved through, because the alternative was to report a green.

## The ordering constraint that outlives this work order

**§1.4 is currently asserted only by check 5**, which is one line of sandbox detection
away from nothing. That is acceptable **only** because the sequencing puts a correct
worker on both copies — Scotty fast-forwards `stable` before Pages flips — so there is
no live hazard today.

It is defence against a **future** bad worker. Therefore:

> **`PUP-WO-0104` MUST LAND BEFORE ANY FUTURE `sw.js` CHANGE REACHES PUBLICATION — i.e.
> before `PUP-WO-0600`.**

That is a hard dependency, not bookkeeping, and it is the single most important line in
this document for anyone sequencing later work.

## What moved to PUP-WO-0104, and why it is shape rather than patching

**M9** — a root worker deleting the promoted copy's cache on the production origin
passes all seven checks, because check 5 is the only check on `ikthys777.github.io` and
is a detectable sandbox, while both real browsers serve `127.0.0.1`. **Two separable
gates.** `ci.yml`'s own written reasoning — "check 6 is the only thing that catches
it" — is wrong in the file, because check 6 is not on the site's origin.

**M7** — nothing asserts cache *contents* beyond a single URL. Empty every entry except
`/stable/index.html` and all seven stay green.

Neither is a bug in a fix. They are shape, and the direction CC-A named is right: run
the real browser at the production origin (`--host-resolver-rules`) and the two gates
collapse into one, making M9 **inexpressible** rather than merely detected.

## Two assertions deleted rather than repaired

Per the ruling that false coverage is worse than none. Each check now **prints what it
does not assert**, so the absence is visible instead of silent:

```
NOT ASSERTED: navigation-poisoning of the root cache by /stable/ — see PUP-WO-0104
NOT ASSERTED: survival of the promoted cache through the root worker's FIRST activation
```

Both were mine. The first tested `startsWith('/stable/')` against a harness serving
`/PupPad/stable/` — it could not match any input, and the correct value was passed into
the evaluate and never read. **The stale literals survived the rename that made the file
serve the real paths, which is exactly why the fix looked complete: the serving agreed
with the deployment and the assertions did not.**

## The habit this work order cost the most to learn

**Four times a red run read as a successful demonstration:**

1. My input validator failed the runs it existed to let through.
2. My root-red demo was masked by the `/stable/` check firing first.
3. The demo PRs built `main` instead of the PR head, so the defect was never checked out.
4. I read a run whose `head_sha` was the *previous* demo commit.

Every one was caught by reading **which step failed** or **what commit ran** — never by
the conclusion. That is not four mistakes; it is one missing habit, and it is
mechanisable: **assert the run's `head_sha` and the failing step name, never the
conclusion alone.**

Recommended for architecture §6.1, beside the existing family. It is a distinct member:
0102's was *an assertion that passes by not running*; the §3.2 self-catch was *an
assertion that passes and certifies the forbidden state*; this is **a failure whose
cause is not the one under test**. All three look identical from the exit code.

---

# ROUND 4 — the second adversarial pass, and its disposition

Subject `246c5f7`. Five independent reviewers; full record in
`docs/findings/PUP-WO-0103-adversarial.md` under **SECOND PASS**. Every claim
below was reproduced by me against the artifact before being written down —
a subagent's summary is a claim, and two of them turned out to be wrong on
mechanism.

## LEADING THE REPORT, BECAUSE IT WAS ASKED AS A DECISION: THE FLIP IS NOT SAFE TODAY

**And the reason it was thought safe was a fact that could not have exercised the
question.** The premise — `sw.js` on `main` is byte-identical to what merged at
`922c2dc`, blob `72f1699` — is TRUE and I reproduced it. The conclusion does not
follow, **because `/stable/` is not built from `main`.** It is built from
`refs/heads/stable`, which is 43 commits behind, does not contain `922c2dc`, and
carries the pre-`0102` worker whose activate handler reaps every cache on the origin
by inequality. The promoted copy derives no prefix at all, so "the two copies derive
distinct non-nesting prefixes" describes `main`'s worker loaded at two scopes — the
only configuration any check exercises — and not the two published copies.

Three preconditions, none of them code, none of them mine:

| # | Precondition | Why, and when |
|---|---|---|
| 1 | **Fast-forward `refs/heads/stable`** | `ci.yml:471` has no event guard, so from the moment #10 merges every PR in the repo goes red at the `/stable/` call site — 0104's own included. **Before the merge, not merely before the flip.** |
| 2 | **Add `stable` to the `github-pages` environment's branch policy** | It currently lists `main` only. A promotion push runs `publish` green and then has `deploy` rejected before step one. The promotion silently does not land, then arrives later attached to an unrelated `main` merge. |
| 3 | **Tablet off or in airplane mode across the flip window**, until `/PupPad/` and `/PupPad/stable/` both verify 200 | The LIVE worker caches whatever the origin returns, including a 404 — see G-LIVE. |

Precondition 2 lands on §1.7. The lever was removed on the finding that the human's
promotion authority already existed structurally. The **ref-level** authority does
exist. The **deployment** of that promotion is gated on an environment policy that
excludes the very branch, so the authority stops at the ref and never reaches the
site. In an emergency rollback the human pushes `stable`, watches green, and believes
Buddy is rolled back. He is not. That is §1.7's own sentence — *"a safety mechanism
you cannot use in the emergency it was built for"* — returning after the lever was
deleted for being redundant with an authority that turns out to be truncated. It does
**not** put `main`'s content on `/stable/`; what is broken is WHEN, and whether the
human can tell.

**And the first pass asked for precondition 2 and I did not do it.** F15 said
*"nowhere is it recorded what that policy currently allows."* F15 asked whether the
policy permits TOO MUCH. Nobody asked whether it permits ENOUGH. I closed it "by
construction" on thirteen real CI runs, **none of which ever pushed to `stable`.** A
question closed by evidence that could not have exercised it — §6.1 member 1 in new
clothing, and the second instance in this project of a control verified to REFUSE and
never verified to PERMIT.

## DISPOSITION

Nothing below is fixed. The artifact is frozen and PR #10 is parked; §7 is invoked on
three counts and the shape question goes to CC-A before more code is written.

### Flag-and-stop — not mine, no fix attempted

| ID | Finding | Disposition |
|---|---|---|
| **G-LIVE** | `sw.js:337` caches HTTP error responses over its own precache. `fetch()` resolves on 4xx/5xx, so a 404 received while online overwrites the precached app shell; offline, the child gets the error page. Heals per-URL on the next healthy online fetch of that URL — so not permanent, but not something a three-year-old can cause. Reproduced in Chromium. | **§7: "any need to modify `sw.js`." NOT FIXED, NOT MINE.** One line — `if (response.ok)`. It is `PUP-WO-0102`'s file and predates it: the pre-`0102` worker has the identical unguarded put. **`PUP-WO-0104` cannot fix it** — 0104 forbids worker changes. Needs a work order or an amendment. Mitigated for the flip by precondition 3. |
| **S1** | `refs/heads/stable` at `2952aa1` | **§7: a push to `stable`.** Operator's. |
| **S2** | `github-pages` policy excludes `stable` | **§7: a repository setting.** Operator's. |

### The third member of the M9/M7 family — reported as the prompt asked

**G-LIVE is the defect; the blindness that hides it is the other half, and the two
were found independently from opposite directions.** `sw-harness.mjs:130`'s sandbox
`fetch` always throws, so check 5 never executes the online write branch; and check 7
— *"the step that makes green mean something"* — drives exactly one of the seven
checks, the one whose harness cannot reach it.

I corrected one of my own reviewers here, because the precise version is worse than
the dramatic one. It is **not** that the branch is unreachable: `check-mutations.mjs:349`
is literally *"B7 sandbox fetch RESOLVES."* But B7's fetch returns
`{ clone: () => 'LIVE' }` — a bare stub with no `status` and no `ok`, not a `Response`
— and nothing in any check asserts on the status of a cached entry. **The online write
branch is reachable in exactly one mutation, and the value it is fed cannot carry a
status.** A fixture-shape blindness, not a missing branch. The harness comment shows
the author one step away: he identified that a resolving fetch is the dangerous value,
then made the stub assert that it FIRED rather than letting it carry the property.

### Gate weaknesses — real, and they block the next `sw.js` change, not this merge

| ID | Finding | Disposition |
|---|---|---|
| **G1** | check 7 PART B declares no `expectFail`, so `matched` is unconditionally true and the verdict is the exit code alone. Two reviewers found it independently. | **My ROUND-2 claim was false as written and I have struck it in place above.** The fix landed on PART A and I described both halves as done. → 0104 §2.5. |
| **G2** | PART B's *"every stub is load-bearing"* is unsupported: stripping the paired real defect from all seven cases gives byte-identical output. What it measures is "the positive controls notice a blinded harness." | Reword or add `expectFail` per case. → 0104 §2.5. |
| **G3** | `${silent.length}` can only ever print 0 — any SILENT exits at line 367 before line 372 prints. I quoted that line as evidence. | Cosmetic; delete or compute honestly. |
| **G4** | `check-cache-isolation.mjs:299,346` — a rejecting offline read makes BOTH invariant-7 assertions print `ok`. The step is red only by an unhandled rejection that crashes Node AFTER `CHECK 5 PASSED`. | **The most serious gate finding.** `catch → undefined → else → ok`, in the check carrying the central invariant. → 0104. |
| **G5** | item 6 catches its own defect **3 times in 10**, measured. Fire-and-forget `cache.put` versus an immediate sample. | **This corrects me.** I called it a dead assertion on an out-of-scope argument. Interception is by controlling client, not URL scope. A flaky assertion is worse than a dead one — it goes green on a real regression and gets dismissed as flake. → 0104. |
| **G6** | `check-two-trees.mjs` never reads `CACHE_PREFIX`/`CACHE_NAME`; its distinctness check `new Set(names).size === names.length` cannot be false. So non-nesting between two genuinely different published prefixes — the reason `sw.js` carries a trailing `\|` — is asserted nowhere. | Architecture §6 requires CI to assert it. → 0104. |
| **G7** | `serviceWorker.ready` inside `page.evaluate` (no timeout) hangs the job for 20 minutes on a copy whose worker cannot install; the job timeout kills GATE too, so there is no `::error::` at all. check-load diagnoses it in 5s and runs afterwards. | **First-pass finding A, unfixed and never dispositioned.** → 0104. |
| **G8** | First-pass findings C and F never dispositioned — not fixed, not deferred, not disclosed. | Recorded here; C is G1/G2, F is a one-character fix. |

### Byte assertion — all fail-CLOSED, all false-red

**B1** the expected side C-quotes and the actual side does not, so one `mamá.png`
wedges publication forever and blames northstar invariant 4 — found by four of five
reviewers, and it is **the same class the comment sixty lines above fixed with `-z`**,
applied to the two greps and missed at the one site that is not a grep. `-z` fixes it;
`core.quotePath=false` fixes only the non-ASCII half. **B2** `git hash-object` without
`--`, plus `%P\n`/`read -r` mangling newline and leading-space names — and none of it
trips `set -e` because a failing `$(…)` inside a `printf` argument is not a command
failure, a trap `ci.yml:578` documents and guards two steps later. **B3** `git
hash-object` without `--no-filters` makes the hash depend on the workspace checkout's
attributes, which no gate examines. **B4** a submodule outside `stable` gives the same
false invariant-4 message. **B5** `published ⊂ hashed` strictly — no hole — but the
closing line *"byte-for-byte their own commit's tree"* is false as written, and a
future `.well-known/assetlinks.json` (exactly what an Android home-screen icon needs)
is silently dropped from publication with the gate still green. **B6** `find | head`
can exit 141 mute above the pipe-buffer threshold; two reviewers reached opposite
verdicts from sound method and both were right — recorded rather than averaged.

### Messages — lower severity than they deserve

**M1** the `/stable/` call site blames "NOT PREFIX-BOUNDED" for any nonzero exit and
prescribes fast-forwarding `stable` — an instruction to perform the act invariant 4
protects, in response to an unrelated crash. **M2** check 7's anchor error is
excellent prose delivered as a bare Node stack trace naming an already-deleted tmpdir
instead of the file to edit; **0 of 22 `::error::` annotations are in the check
scripts**, so the most-likely-to-fire refusal never annotates. **M3** the
`.gitattributes` and symlink refusals are correct and give no remedy — and a refusal a
human cannot diagnose is one that gets deleted rather than satisfied.

### Liveness

**O1** `pages-publish` is one slot shared by PRs and pushes, so PR churn can evict a
pending promotion's publish job and no later run rescues it. **O2** the workflow-level
group collides for push-to-`main` and push-to-`stable` of the same commit — which is
exactly what a promotion is. **O3** every deployment rewrites
`/stable/build-stamp.json`, and roadmap P1 gate 3 uses that file as a falsification of
invariant 4. **O4** a PR based on `stable` is only ever verified in the root position.

## WHAT HELD

No path was found by which `main`'s content, a PR head, a fork, a re-run or any other
event reaches `/stable/`. One reviewer worked the full event × job matrix, confirmed
there is exactly one workflow file so nothing listens on the deployment events this one
emits, confirmed the workflow holds no ref-write capability at all, and confirmed the
promoted checkout is asserted against `git ls-remote` with no fallback. `contents: read`
on publish is correct and complete. The GATE chain is sound with no `always()` anywhere.
Both deleted assertions are honest and nothing reclaims their coverage. ROUND 3's
demo-PR table reproduces exactly. The B1/B6 claim survived attack from both sides. The
array-prune fix could not be broken.

## §7 INVOKED, THIRD COUNT

My own standing condition was that **a third pass finding serious defects on one work
order is a scope signal to report rather than absorb.** It has. One reviewer reached
that conclusion independently: until this pass, no adversarial review existed against
this artifact at all — the recorded one names subject `c8c8cf1`, its `ci.yml`
citations land on unrelated text and several are past end-of-file, and it lists
`workflow_dispatch` as a live attack surface. The acceptance section still offers, as
evidence, CI output from the deleted dispatch surface; and acceptance item 8a — *"a
cancelled or absent run does not publish, demonstrated, not reasoned"* — is neither
demonstrated, flagged, nor waived.

**Parked for review. Not merging.**

---

# ROUND 5 — the dispatched fixes, and the pass that found two fail-opens in them

Subject frozen at `9e44be4`, 21 deliverables hashed
(`docs/findings/PUP-WO-0103-r5-freeze.md`). Four independent lenses. Every claim
below was reproduced by me against the artifact before being written down — two
lenses contradicted each other on one finding and one lens overturned a round-5
correction of mine, so this was not a formality.

## THE MERGE CONFLICTS WERE CODE, NOT DOC TEXT — and that assumption has been load-bearing

**"Additive, both sides kept" has been true of every conflict in this project until
today, and it stopped being true.** Merging `origin/main` into `build/wo-0103` produced
two conflicts and neither was prose:

- **`check-cache-isolation.mjs`** — this branch had wrapped the precache assertion in a
  `[root]`/`[stable]` loop; `PUP-WO-0105` had corrected the fixture so `cache.keys()`
  yields Request-**like** objects, as the real Cache API does, and normalised at that
  call site. **Taking either side alone reinstates the A14 false green that 0105
  caught**: without the normalisation, `precached` holds objects, every
  `new URL(u, scopeUrl)` stringifies one, no path can start with `scopePath`, and the
  precache-escape test passes on an empty filter. Resolved by keeping both, and the
  comment now says the normalisation is load-bearing for the scope test beneath it.
- **`ci.yml`** — the two sides were not alternatives but an ORDER. `HEAD` contributed
  the `publish` and `deploy` jobs; `main` contributed checks 8, 9 and 10, which are
  **steps of the `checks` job**. Resolved as checks 8–10 closing out `checks`, then
  `publish` (`needs: checks`), then `deploy` (`needs: publish`).

Verified after resolving rather than asserted: YAML parses, jobs are
`checks`(14 steps) → `publish` → `deploy`, `node --check` clean over every `.mjs` and
`sw.js`, check 5 green on both scope labels, and check 7 green at 21/21 — which is what
re-screens A14.

**Recorded here because CC-A merges on the additive assumption.** A semantic conflict
between a branch's own change and a fix that landed on `main` in the interval is now a
demonstrated shape in this repo, not a hypothetical.

## HOW TO READ THIS FILE'S OWN CITATIONS — the same treatment the findings file got

The `ROUND 4` section above was written against `246c5f7`. **Its seven line citations
no longer resolve**, and they now land on unrelated text rather than failing:
`ci.yml:471`, `ci.yml:578`, `sw.js:337`, `sw-harness.mjs:130`,
`check-mutations.mjs:349`, `check-cache-isolation.mjs:299` and `:346`. Each was
correct at `246c5f7` and is verifiable there with
`git show 246c5f7:<path> | sed -n '<N>p'`. They are **not re-anchored**, for the
reason the findings file gives: a record edited to stay convenient is not evidence.
Round 5's citation-marking block was applied to `PUP-WO-0103-adversarial.md` and NOT
to this file, which was itself an instance of the defect it was fixing. This
paragraph is the correction.

**Round-4 statements that are FALSE NOW, left standing above with the measurement here:**

| statement | measured 2026-09-01 |
|---|---|
| *"`refs/heads/stable` … is 43 commits behind"* (§ROUND 4) | **82** (`git rev-list --count 2952aa1..origin/main`). True when written. S1 itself still holds — `origin/stable` is still `2952aa1`. |
| **G6**: *"Architecture §6 requires CI to assert it [non-nesting]"* | `architecture.md:189` requires only *"that the two prefixes differ and that the reap is prefix-bounded."* **Non-nesting appears nowhere** — the sole `nest` substring in the file is inside `unestablished`. The finding may be sound; the authority cited is stronger than the authority. |
| `:498` — recommends a §6.1 addition *"beside the existing family. It is a distinct member"* | It is already **member 3**, verbatim: *"A failure whose cause is not the one under test."* Reads as an open recommendation for settled text. |

## THE HEADLINE: I OVERRULED A CORRECT ROUND-4 FINDING, AND ROUND 4 WAS RIGHT

Round 4 said a future `.well-known/assetlinks.json` would be silently dropped from
publication. Round 5 "corrected" that — *"It would NOT … run it and they are there"*.
**False.** `actions/upload-pages-artifact@v4` passes **three** excludes:
`--exclude=.git --exclude=.github --exclude=".[^/]*"`. The step is `shell: sh`, the
quotes strip, tar receives the glob, and **every dotfile at any depth is dropped**.

| invocation | assetlinks | `_headers` | `.gitkeep` |
|---|---|---|---|
| two excludes, as round 5 claimed | 1 | 1 | 1 |
| three excludes, as the action actually passes | **0** | 1 | **0** |

`_headers` has no leading dot and survives either way, so it **discriminates nothing**
— and round 5 cited it as corroboration. The discriminating file is a dotfile.

**How the wrong answer was reached, which is the part worth keeping:** the flags were
reasoned from memory and the "verification" then ran against the imagined flag list.
That is [ask what the fix refuses] failing in its purest form — I verified against the
failure I had invented. And the answer was already in this repository:
`PUP-WO-0103-adversarial.md:1512` states all three flags, notes the third is v4-only,
and records that a lens resolved that exact disagreement **by fetching the action**. I
contradicted evidence sitting in the file I was annotating.

**Live on this tree**, not hypothetical: `docs/findings/.gitkeep` and
`docs/work-orders/.gitkeep` are hashed, declared published, and never published.

Two further round-5 corrections were also false and are corrected in place: the
`-z --format` quoting claim (on git 2.43.0 `-z --format='%(path)'` and `-z --name-only`
are byte-identical and raw — the code is right and round 4's *"-z fixes it"* was right;
what is true is that a RICHER format quotes, and the claim recorded no git version),
and the count *"52 files, 18 under .github/, 34 published"* (published was **32** when
written; the tree is now 54/18/36).

## TWO FAIL-OPENS, BOTH IN CODE I WROTE THIS ROUND

| | mechanism | evidence |
|---|---|---|
| **LOCALE** | GNU grep in a UTF-8 locale (runners set `LANG=C.UTF-8`) treats a record containing an invalid byte as **binary**: warns to stderr, exits 0, and **omits the record**. Both manifests lost it identically, so `cmp` passed and a tampered Latin-1 `café.png` published under a green gate. | 1 of 2 records survived under `C.UTF-8`, 2 of 2 under `LC_ALL=C` |
| **UNANCHORED TAB** | `EX_REC`'s leading `\t` matched an embedded TAB **inside a filename**, so `logo<TAB>.git` read as separator + path `.git`, was dropped from both sides, and is **not** excluded by tar. | differential oracle: `PUBLISHED BUT UNVERIFIED: logo\t.git` |

Both closed: `export LC_ALL=C`, and the pattern anchored to the 40-hex oid.

## THE GATE WAS NOT THE LAST WORD ON THE ARTIFACT

The byte assertion is step 9; the upload is step 19. The stamp step writes **three
uncommitted files** in between — including one **into the promoted copy**, a file under
`/stable/` that no human promoted. Any step in that window could add arbitrary bytes
and nothing would notice. A new step 17 re-derives the published set from the directory
actually uploaded and requires it to equal *(verified set) + (exactly those three
declared paths)*. It runs on **every** trigger including pull requests, deliberately: a
step behind `DRY_RUN` is a step nobody has watched work, which is how two false greens
in this same job survived three rounds.

## VERIFIED AGAINST THE TOOL, NOT AGAINST MY MODEL OF IT

The exclusion model was checked with a differential oracle: run the action's own tar
line, extract it, walk raw bytes, compare to what the step says it verified. Fixture:
`mamá.png`, `-x.png`, `' lead.png'`, newline-in-name, `logo<TAB>.git`, Latin-1
`café.png`, `.well-known/assetlinks.json`, `_headers`, `.hidden`,
`deep/nested/.git/f`, plus the repo's 18 `.github` files and 2 `.gitkeep`.

```
real tar publishes: 41   step verified: 41
fail-open: none | over-claim: none
```

RED on every tamper: Latin-1 name, tab name, newline name, `_headers`, fifo, symlink,
file added after the gate, file added into the promoted copy after the gate, verified
file removed after the gate. GREEN on a stray dotfile, which is **correct** — the
uploader drops it, so it never reaches the site.

**And a hang I introduced and caught:** switching to `! -type d` to catch fifos made
`git hash-object` block forever on one — a 20-minute job timeout with no diagnostic,
strictly worse than the silent publish it fixed. Non-regular entries are refused
*before* hashing now.

## DISPOSITION OF THE DISPATCHED ITEMS

All thirteen fixed, each proven by execution. **B1** paths from `--name-only`;
**B2** NUL throughout with `--` and explicit status (four ordinary filenames each
wedged publication permanently under an invariant-4 message, and none tripped
`set -euo pipefail`, because a failing `$(…)` inside a `printf` argument is not a
command failure); **B3** `--no-filters`; **B4** submodules refused by name with a
remedy; **B5** above; **B6** capture-then-trim. **M1** the call site no longer
prescribes fast-forwarding `stable` for a crash — and **check 7 asserts** the exit-code
split rather than trusting a comment (PART A must exit 1, never 3; observed `{1}`).
**M2** annotations added, emitted unconditionally so check 7 exercises them; check 7's
anchor error now names a file in the repo instead of a deleted tmpdir. **M3** remedies,
now with *"and N more"* rather than a silent truncation under *"replace EACH"*.
**O1/O2** simulated across five event/ref/sha combinations. **O3** stamp is a pure
function of its commit, proven byte-identical across two runs a second apart.
**Acceptance 8a** left the third state: reasoned half labelled as reasoning, *"say so"*
half built, demonstration explicitly **waived** with the reason (cancelling is a
write-scoped call; `git`/`gh` here are read-only by design). **The stale adversarial
record** corrected by marking, citations deliberately not re-anchored.

## THREE CITATIONS I CREATED IN THE ACT OF CITING THEM

`PUP-WO-0109`, `PUP-WO-0600` and *"architecture §6.1 member 5"* each occurred **exactly
once in the repository** — in the sentence that invented it. All three corrected in
place and left unnumbered, because **a number reads as a reference**: it makes a reader
believe something tracks the defect when nothing does, which is strictly worse than
prose. `architecture.md:391` rebuts the `PUP-WO-0600` attribution *by name*, and the
freeze idea is real but **unnumbered** at `architecture.md:318`. Whether it becomes
member 5 is CC-A's call, not mine.

## A CROSS-LENS DISAGREEMENT, SURFACED RATHER THAN AVERAGED

One lens reported a SIGPIPE fail-open in the `.gitattributes` and `stable/` refusals —
`tr` dying of 141 under `pipefail` when `grep -q` exits early, skipping the refusal
silently — with a claimed 4–8 KB threshold. A second lens tested the same code and
found no fail-open. **I could not reproduce it at any size**: `PIPESTATUS` was `0 0 0`
at 16 KB, 82 KB and 166 KB, while a read-once consumer on the same pipeline gave
`141 141 0`. The mechanism is real; `grep -q` is empirically not such a consumer.
**Recorded as not-reproducible rather than quietly fixed.**

It pointed at a real defect anyway, from the other lens: `| tr '\0' '\n' |` undoes the
framing `-z` exists to provide. A tree containing `photo<NEWLINE>.gitattributes` and
`art<NEWLINE>stable` — and **neither** a real `.gitattributes` **nor** a real `stable/`
path — was refused by both steps, with remedies naming files that do not exist.
Reproduced, then fixed with `grep -zqE` on the raw stream; both false refusals gone,
both true refusals still fire. With `tr` gone the SIGPIPE question cannot be asked.

## §7 — FLAG AND STOP, FOR CC-A

**These are not builder calls and I have not attempted them.**

1. **`pages-publish-push` is one slot for every push, and GitHub's pending queue has
   depth 1.** O1 fixed the PR/push sharing it named and left the push/push sharing,
   which is the same slot. A promotion's publish job pending behind a running one is
   **evicted** by any third push. Usually the evicting run rescues it, because publish
   checks out live refs — but only if *that* run's publish succeeds, and publish
   carries refusals `checks` does not. Checks-green/publish-red on the evictor
   **destroys the promotion**, and it cannot be re-pushed because it is already at that
   SHA. **Not fixable by renaming the group:** serialising publications and never
   dropping one are not both obtainable from `concurrency:`.
2. **The `if: cancelled()` step cannot fire on the eviction in (1)** — a job evicted
   while pending never gets a runner. The one path O1/O2 exist to eliminate is the one
   path with no sentence in the log. Acceptance 8a's waived demonstration exercises the
   *manual* cancel and would pass without touching this.
3. **`pages-deploy` inherits the same depth-1 rule** and `deploy` has no
   `if: cancelled()` step at all — silent by construction, not by accident.
4. **The `ls-remote` race is now *more* reachable because of my O2 fix.** Under the old
   `ci-<sha>` key a merge and a promotion of that commit evicted each other; now they
   run in parallel, so `stable` moving between checkout and verification prints
   `REFUSING TO PUBLISH — northstar invariant 4` for what is actually *"a human
   promoted while I was building"* — the gravest message in the project, with no
   remedy, on the one event where a human is most primed to reach for a fast-forward.

## OUT OF SCOPE, RECORDED, NOT FIXED

**G3 stands and it is worse than "cosmetic".** `${silent.length}` can only ever print
`0` — a SILENT case exits at the escape check before the summary prints — so check 7's
verdict line *"0 of 7 now fail SILENT"* is **a constant presented as a measurement, in
the verdict of the check that exists to prove checks can fail.** It is dispositioned to
`PUP-WO-0104` and CC-A ruled G1–G8 out of round 5, so I have not touched it; recording
here that round 5 edited that file and left it, deliberately.

**`check-two-trees.mjs` crashes (`ENOENT` via `cpSync`) on a Latin-1 filename.** Found
because my adversarial fixture had one. No such file is in the tree, but the byte
assertion now handles such names, so the two checks disagree about what is publishable.
