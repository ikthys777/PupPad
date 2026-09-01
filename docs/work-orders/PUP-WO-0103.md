# PUP-WO-0103 — Two-path publication

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0103`.
**Author:** CC-A · **Builder:** CC-EM (pup-b).
**Phase:** P1 · **Phase exit gate:** `docs/roadmap.md` → P1, items 3 and 4.
**Supersedes:** the publication half of `PUP-WO-0101` (see §9).
**Depends on:** `PUP-WO-0102` merged — publication asserts properties of the worker
that work order builds.
**Grounds:** `docs/northstar.md` invariants 3, 4, 7 · `docs/architecture.md` §5, §6,
§6.1 · `docs/roadmap.md` P1 · `docs/feedback/PUP-WO-0101.md` ·
`.github/workflows/ci.yml`, `.github/ci/`.

> **What this is:** `main` published at the site root, `stable` at `/stable/`, from
> one Pages deployment, with publication gated so that no unpromoted byte can reach
> the promoted copy. It is **NOT** a `sw.js` change (`PUP-WO-0102`) and not an
> `index.html` change. Why now: this is the second half of the firebreak, and the
> half that can be iterated safely.

**Cadence:** build. One PR, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0103 origin/main`.

**Carry your work forward.** `build/wo-0101 @ 151980b` holds the workflow and real
fixes to it. Reuse them; the `sw.js` half went to `PUP-WO-0102`.

---

## 0. This half cannot reach Buddy, and that is deliberate

Your diff touches `.github/` and `docs/` only. Pages under `build_type: legacy`
serves `main:/` as static files and does not serve `.github/`, so architecture §6's
bootstrap exception covers this work order whole.

**That is the point of the split, and it changes how you should work.** All the
tablet-reaching risk in this phase sits in `PUP-WO-0102`'s single file. Here you can
push, run real CI, watch it fail, and iterate — which is also how
`PUP-WO-0101`'s F15 ("no CI run has ever exercised any of this") closes: **by
construction, not by promise.** Push early and often. A workflow that has never run
is a hypothesis.

**One consequence to keep hold of:** the moment Pages is flipped, this workflow
*becomes* the thing that reaches Buddy, even though its diff never did. Everything
in §1.2 exists for that moment.

## 1. Scope

### 1.1 Publish both copies from one deployment

One Pages deployment carrying `main` at the site root and `stable` at `/stable/`.

**Emit a build stamp at each path** — ref name, commit SHA, path, build time. It
makes P1 gate item 3 a two-`curl` check and keeps invariant 4 auditable afterwards
rather than only at the gate.

### 1.2 The invariant-4 guarantee — verify the BYTES, not the ref

**This is the work order.** Northstar invariant 4 says the copy Buddy uses advances
only when a human promotes it. `PUP-WO-0101`'s attempt verified the *ref* and never
the *published tree*, and two of its three assertions were tautologies —
`stamp_ref` compared against the literal the workflow had just written, and
`stamp_sha` against `git rev-parse HEAD` of the very checkout under test. Its author
found this itself and named the reason precisely: *it tested the fix against the
attack it had imagined — a wrong ref, which `ls-remote` genuinely defeats — and
stopped, because it had already written the word "fixed."*

Required:

- **Assert the published tree.** Hash what is actually in the directory being
  uploaded and compare it against the tree of the ref it claims. The authority for
  what a ref points at is the **server** (`git ls-remote`), never the stamp, never
  the checkout, never this workflow's own assumptions. No fallback: if the remote
  tip cannot be established, publication fails.
- **`mkdir -p` and `tar | tar -x` merge; they do not replace.** Nothing forbids a
  `stable/` path in `main`, and §7's bar is *not ruled out*, not *unlikely*.
- **Harden the archive.** `git archive` does **not** emit "the commit's tree and
  nothing else" — it honours `.gitattributes` **from the archived tree**:
  `export-subst` can inject a commit message into a published file (arbitrary
  script on the tablet, with the tree reading clean in review and the payload
  living in `git log`, which no gate reads), and `export-ignore` silently drops
  files — **fail-open on a green build.** The Pages artifact also tars with
  `--dereference`, so symlinks are a second path. Refuse any tree carrying
  `.gitattributes` or a symlink. *(Reproduced by `PUP-WO-0101`'s builder.)*

### 1.3 Every copy a run publishes is checked in that run

*Architecture §5, ruled 2026-09-01.* `PUP-WO-0101`'s workflow ran checks against the
**triggering ref only** while publication checked out **both**, so a push to `main`
published `stable` unchecked. "A red check means nothing publishes" was false in
both directions, and no check ever read the stable copy at all.

**Fix the general property, not the instance.** Every copy in the deployment is
checked in the same run that publishes it. Also verify that every check is actually
in the publish path: `PUP-WO-0101` had one check missing from the publish loop,
leaving the sandbox hole open on exactly the path that publishes, while the report
said all six ran.

### 1.4 Refuse a copy whose worker is not prefix-bounded — ordering as mechanism

*Architecture §5, ruled 2026-09-01.* `PUP-WO-0101` §6 recorded the required
sequence — merge, fast-forward `stable`, flip Pages — **in prose, and prose is not a
mechanism.** `refs/heads/stable` still carries the origin-wide reaper, so flipping
Pages between the merge and the fast-forward publishes a worker that deletes the
root cache on every activation.

Publication refuses any copy whose worker reaps or **reads** outside its own prefix
(architecture §6.1 — the read is the half that was missed). Stated as a property, it
holds regardless of what order anyone performs anything in.

### 1.5 Two published workers, together

*`PUP-WO-0101` F8.* Nothing in CI has ever run the two **published** workers as a
pair. Loading one `sw.js` at two scopes is not the deployed pair during a promotion
lag, when the copies legitimately differ. **This work order's hardest acceptance
item** — it needs a two-tree harness.

### 1.6 Observation windows

*`PUP-WO-0101` F9.* Every check is time-bounded and the cache-isolation check had no
observation window at all, so a reap delayed past ~8s passed everything. **A check
that passes because it stopped looking** is the timing form of "looks like
coverage." State each window and why it is long enough.

### 1.7 The rollback lever

*`PUP-WO-0101` F12, raised by the builder against its own mechanism.* Publication is
all-or-nothing, so rolling `stable` **back** is blocked by the very copy being
rolled back, and an urgent root fix is blocked by a stale `/stable/`. Fail-closed is
correct and it welded the emergency exit shut.

**Ruling: fail-closed stays the default, and a rollback lever must exist and must be
human-operated** — a manual dispatch taking an explicit, previously-verified
`stable` ref. `/stable/` exists to protect Buddy; a promoted copy nobody can roll
back is a safety mechanism you cannot use in the emergency it was built for.
**Mechanism is yours to design.** It must not become a path by which anything
reaches `/stable/` without a human naming the commit — see §7.

### 1.8 Check 4 asserts the state it measures

`.github/ci/check-load.mjs:265` fails only when the worker state is none of
`active`, `registered`, `installing`, `waiting` — effectively never. **A worker
stuck in `installing`, with offline capability dead, passes green.** `:234` computes
the state and the run prints it; no branch consumes it. A value that is measured and
printed reads, in a green run, exactly like a value that is asserted. *(Correction
appended to `docs/feedback/PUP-WO-0100.md` 2026-09-01.)*

## 2. Invariants — restated by number

- **4** — **the copy Buddy uses advances only when a human promotes it.** §1.2 and
  §1.7 are this invariant. See §7: it is a flag-and-stop, not a check.
- **3** — every core surface works with no network. §1.4 is what stops publication
  shipping a worker that destroys the cache invariant 3 depends on.
- **7** — exactly one build's assets per device. §1.4, §1.5.

**Protected surfaces — must diff to empty:** `index.html`, `sw.js`,
`manifest.json`, both icons. **`sw.js` is protected again in this work order** —
`PUP-WO-0102` owns it, and one writer per file across work orders is the same rule
as one writer per tree.

## 3. Acceptance — proven, not asserted

1. `git fetch origin && git diff origin/main --stat` shows `.github/` and `docs/`
   only.
2. **Real CI runs, not local execution.** §0 makes this cheap: push and let it run.
3. **§1.2 demonstrated adversarially:** put `main`'s bytes in the stable directory
   and show publication **refuses**. Then do it again via the `.gitattributes`
   route, and via a symlink.
4. **§1.3 demonstrated:** a red check on *either* copy blocks the deployment, shown
   for each copy independently.
5. **§1.4 demonstrated:** a copy carrying the origin-wide reaper — `refs/heads/stable
   @ 2952aa1` is a real one — is refused.
6. **§1.5:** the two published workers exercised as a pair, with the copies
   deliberately differing, as they do during promotion lag.
7. **§1.8 demonstrated red:** a worker that hangs in `installing` fails check 4.
8. **Every new assertion demonstrated RED**, each by its own break, each reverted,
   each with captured output and the failing step name.
9. **Every stub shown able to fail** (architecture §6.1).

**P1 gate items 3 and 4 need a live site and are CC-A's and Scotty's to run after
merge and after the Pages flip.** Do not claim them; build the stamp that makes item
3 two `curl`s.

## 4. Scope fence — NOT in this work order

- **`sw.js`** — `PUP-WO-0102`. If publication needs a worker change, that is a
  flag-and-stop and a dependency, not an edit.
- `index.html` — `PUP-WO-0600`.
- Flipping the Pages build type, pushing `stable`, any repository setting — §6.
- Generalising beyond two paths.

## 5. Adversarial pass

Black-box, fresh subagent, ground truth only. **Freeze every deliverable — the
workflow, the CI scripts, the harness, and your feedback file.**

- **Get `main`'s content onto `/stable/`.** Highest value by a wide margin.
  Anything found here outranks the rest of the pass.
- **Attack the rollback lever** (§1.7) as a publication path: can it put unnamed
  content on the promoted copy?
- **Attack the archive** beyond `.gitattributes` and symlinks.
- **Find a check that cannot go red**, and a check missing from the publish path.
- **Ask of every fix: what legitimate behaviour does this now refuse?**
  *(Architecture §5.)* `PUP-WO-0101`'s encoding fix refused `/my%20photo.png` —
  online fine, offline silently absent, invariant 3.

## 6. Sequencing — human-track, not the builder's

Recorded so it is auditable; §1.4 exists so it is not load-bearing.

1. `PUP-WO-0102` merges (the worker becomes prefix-bounded on both read and reap).
2. This work order merges. Pages is still `legacy`, so nothing publishes yet.
3. **Scotty fast-forwards `stable`** — currently `2952aa1`, carrying the
   origin-wide reaper (architecture §6.1).
4. **Scotty flips Pages to the Actions build type.** Flipping before step 2 leaves
   the site with no publishing workflow at all.
5. P1 gate items 3 and 4 run against the live site; P1 closes.
6. Scotty re-points Buddy's tablet at `/stable/`, the test device at root.

## 7. Flag-and-stop

- **Any path by which `main`'s content could reach `/stable/`** — found, suspected,
  or merely not ruled out. Invariant 4, and the reason this phase exists. Not a
  check to tune. Includes any rollback-lever path that does not require a human to
  name the commit.
- Any need to modify `sw.js`, `index.html`, `manifest.json`, or an icon.
- **Publication requiring permissions beyond what it strictly needs.** It needs more
  than `contents: read`; state exactly what and why.
- **A third adversarial pass finding serious defects** — see `PUP-WO-0102` §7.
- Any credential, repository setting, or push to `stable`.

## 8. Kickoff

Sent separately, after `PUP-WO-0102` merges. **Do not dispatch without Scotty's
word.**

## 9. Provenance

Written by CC-A 2026-09-01, with `PUP-WO-0102`, replacing `PUP-WO-0101` after its
second adversarial pass. `PUP-WO-0101` is superseded and **not renumbered**; its
document stands on `main` and the roadmap's reconciliation table records the split.
§1.2 and §1.4 exist because that work order's own builder found and reported both
against its own deliverable.
