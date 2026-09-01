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
