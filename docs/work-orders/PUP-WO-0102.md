# PUP-WO-0102 — Cache correctness: a worker touches only what it owns

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0102`.
**Author:** CC-A · **Builder:** CC-EM (pup-b).
**Phase:** P1 · **Supersedes:** the `sw.js` half of `PUP-WO-0101` (see §9).
**Grounds:** `docs/northstar.md` invariants 3, 7 · `docs/architecture.md` §5, §6,
**§6.1** · `docs/roadmap.md` P1 · `docs/feedback/PUP-WO-0101.md` · `sw.js`.

> **What this is:** one file, one idea. `sw.js` must touch only the cache it owns —
> **on read, on write, and on reap.** It is **NOT** the publication workflow
> (`PUP-WO-0103`), not a fetch-strategy change, and not `index.html`. Why now:
> `PUP-WO-0101` tried to carry this and the publication workflow together, and two
> adversarial passes each found serious defects, the second of which — an
> origin-wide *read* — was invisible to every check because the work order was
> broad enough that its own harness went blind. This half is small enough to hold
> in one head.

**Cadence:** build. One PR, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0102 origin/main`.
Your local `main` is not fast-forwarded by anything.

**Carry your work forward.** `build/wo-0101 @ 151980b` holds real fixes. Reuse what
belongs here; leave the workflow behind for `PUP-WO-0103`. You are not starting over.

---

## 0. This one reaches Buddy — and it is now the only half that does

`sw.js` is served from `main:/`, Pages is still `legacy`, and Buddy's tablet is on
the root copy. A broken worker does not degrade the app; it can leave the tablet
unable to load it at all.

**That risk is the reason for the split.** `PUP-WO-0103` touches `.github/` only and
cannot reach him (architecture §6's bootstrap exception). So the entire
tablet-reaching surface of this phase is now this one file — small, single-concern,
and attackable in a bounded way. Nothing else in P1 needs to be reviewed at this
level of paranoia, and this does.

`PUP-WO-0100`'s checks are what stands under this merge. **Weakening, skipping, or
special-casing any of them to land this is a flag-and-stop.**

## 1. Scope

Four changes to `sw.js`, and nothing else in the file.

1. **The reap is prefix-bounded.** Each deploy carries a `CACHE_PREFIX`;
   `CACHE_NAME` begins with it; activate deletes only
   `name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME`. `caches.keys()` is
   **origin-scoped**, so an unbounded reap deletes the other copy's cache
   (architecture §6).

2. **The read is scoped to this worker's own cache.** `sw.js:40` is
   `caches.match(event.request)` — **`CacheStorage.match`, which searches every
   cache on the origin** — while the write beside it at `:35` is correctly scoped.
   Architecture **§6.1** is the authority and explains why this is the harder half:
   it makes the promoted copy serve the test build's bytes offline, falsifying
   invariant 7 *by the invariant's own stated test*, with every check green.

3. **The legacy cache is removed once, by exact literal string.** `pup-pad-v16`
   matches no new prefix, so a correct prefix-bounded reap orphans it on every
   existing device including Buddy's. **Never a pattern, wildcard, or prefix match** —
   a pattern is how the origin-wide reap returns, wearing cleanup's clothes. Name
   the exception in a comment with the condition for its removal.

4. **The root worker declines requests under `/stable/`.** Its scope covers
   `/stable/`, and the fetch handler caches unconditionally, so before the stable
   worker registers it can cache stable's assets under the root prefix — invariant 7
   failing with disjoint names and a green gate.

   **On normalisation, a steer rather than a spec.** A denylist of `/stable/`
   spellings is unbounded — `%73`, `%2F`, `//`, dot segments, unicode. Normalise
   once, then test, and prefer **inverting to an allowlist derived from the worker's
   own scope**. Note `//stable/` creates a *third* registration with a third cache
   neither worker ever reaps — the same orphan shape as item 3, produced by an
   otherwise-correct fix. **If you cannot bound it, that is a flag-and-stop and an
   architecture question, not a best-effort regex.**

5. **The checks that prove items 1–4, committed and registered.** A cache-isolation
   check asserting invariant 7's own falsification test; a cache-identity check that
   **evaluates** the worker rather than scraping its text (a regex against source is
   defeated by a second `var` line or a comment at column 0 — remove the class, not
   another instance of it); and check 4 asserting the worker state it already
   measures. `.github/ci/check-load.mjs:265` currently fails only when the state is
   none of `active`/`registered`/`installing`/`waiting`, so **a worker stuck in
   `installing`, with offline capability dead, passes green** — a value that is
   measured and printed reads, in a green run, exactly like one that is asserted.
   *(Moved here from `PUP-WO-0103` §1.8 on the seam in §2: it verifies the worker,
   not publication.)*

**Not in this work order:** the fetch *strategy*. It is network-first and that is
architecture §10's open question. Change identity and ownership; leave strategy alone.

## 2. Invariants — restated by number

- **3** — every core surface works with no network. `sw.js` *is* this invariant's
  mechanism, which is why §0 reads the way it does.
- **7** — a device serves exactly one build's assets, never a mixture. Items 1, 2
  and 4 are three independent mechanisms by which it fails; fixing one does not fix
  the others, and §6.1 exists because fixing the reap made the read look closed.

**Protected surfaces — must diff to empty:** `index.html`, `manifest.json`, both
icons, and **`.github/workflows/ci.yml`'s publication job and every publication
script**. Those are `PUP-WO-0103`.

**You MAY touch `.github/ci/` for the checks and harness that prove `sw.js`
correct**, and register them in `ci.yml`'s `checks` job. *(Corrected 2026-09-01
before dispatch: this section previously protected all of `.github/`, which
contradicted §3.3 and §3.7 — both require a committed harness, and a check that
asserts invariant 7 has nowhere else to live. CC-A's defect; found by mapping the
parked branch against the split.)*

**The seam, stated once so it settles every case:** a check that verifies **the
worker** is yours; a check that verifies **publication** is `PUP-WO-0103`'s. Both
work orders touch `ci.yml`, but sequentially and in disjoint jobs — `PUP-WO-0103`
branches from this one's merge, so there is never a second writer.

## 3. Acceptance — proven, not asserted

1. `git fetch origin && git diff origin/main --stat` shows `sw.js` and `docs/` only.
2. All `PUP-WO-0100` checks green, unmodified and un-special-cased.
3. **Invariant 7's own falsification test, run and failed-then-passed.** Cache the
   test build, load the promoted copy offline, and show no asset is served from the
   other build. **Demonstrate it RED first** by restoring the origin-wide read —
   architecture §6.1 records that this defect was invisible to a green suite, so the
   red demonstration is the only thing that proves the check sees it at all.
4. **Prefix-bounded reap demonstrated in a real browser:** populate both caches,
   force-activate one worker, show the other's cache still present.
5. **The legacy migration demonstrated on a device state that starts with
   `pup-pad-v16` present** — reaped by exact literal, new cache built, offline
   cold-load succeeds. *(This is the merge-day path. `PUP-WO-0101`'s second pass
   already simulated it green; carry that evidence here as an acceptance item rather
   than leaving it in a report.)*
6. **`/stable/` exclusion demonstrated**, including at least three non-canonical
   spellings, **and** a demonstration that legitimate traffic still works — see §5.
7. **Every harness stub must be shown able to fail.** Architecture §6.1: the stub
   whose `match()` returned `undefined` unconditionally is what blinded the check
   that was reporting on cache isolation. **A stub that cannot fail is not a test.**
   For each stub, show the failure it exists to detect being produced.

## 4. Scope fence — NOT in this work order

- The publication workflow, build stamp, invariant-4 verification, archive
  hardening — all `PUP-WO-0103`.
- `index.html`: the CDN loads and the un-closable overlay are `PUP-WO-0600`.
- The fetch strategy (§1).
- The publication job, build stamp, invariant-4 byte verification, archive
  hardening, the **two-tree** harness for the two *published* workers, and the
  rollback lever — all `PUP-WO-0103`.
- Generalising to N paths. Two copies today.

## 5. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only. **Freeze every file this
work order names as a deliverable — `sw.js`, the harness, and your feedback file.**
That rule paid for itself on `PUP-WO-0101`: findings cited the feedback file *by
line*, which was only possible because it was inside the freeze.

Probes:

- **Serve one build's bytes from the other copy.** The headline. Offline, online,
  mid-upgrade, during promotion lag, with one worker installing and one active.
- **Orphan a cache.** Find a name, scope, or spelling that produces a cache no
  worker will ever reap. `//stable/` is one; find others.
- **Make the legacy exception match something other than the literal.**
- **Ask of every fix: what legitimate behaviour does this now refuse?** *Architecture
  §5, ruled 2026-09-01 and aimed squarely at this work order.* The encoding fix on
  `PUP-WO-0101` closed an attack and refused `/my%20photo.png` — online fine,
  offline silently absent, invariant 3. **A fix that opens a violation while closing
  one is the normal result of testing only the attack you thought of.**
- **Attack every stub.** Can it produce the failure it screens for? If not, whatever
  it guards is unguarded.

## 6. Upward feedback

`docs/feedback/PUP-WO-0102.md`; verbatim exchange in
`docs/findings/PUP-WO-0102-adversarial.md`. Neither summarises the other's job.
Per entry: `finding · where (file:line) · type · recommendation · decision-needed`.
Required: the red demonstrations with captured output; what did not work and why;
what was deliberately not done; a gates line stating the protected-surface diff
status as a checkable fact.

## 7. Flag-and-stop

- **Any need to touch `index.html`, `manifest.json`, an icon, or the publication
  job/scripts** (§2). Adding checks and a harness under `.github/ci/` is expected,
  not a stop.
- **Any need to weaken a `PUP-WO-0100` check** to land this.
- **The `/stable/` normalisation not bounding** (§1.4).
- **A third adversarial pass finding serious defects.** Two passes each finding
  serious defects is what caused this split; a third on a work order this small
  means the problem is not size and I need to know that, not have it worked around.
- Any credential, repository setting, or push to `stable`.

## 8. Kickoff

Sent separately. **Do not dispatch without Scotty's word.**

## 9. Provenance

Written by CC-A 2026-09-01. `PUP-WO-0101` is **superseded, not renumbered** — its
document stands on `main` as written and is cited by the roadmap's reconciliation
table. This work order and `PUP-WO-0103` replace it, split along the seam that
matters: this half reaches Buddy's tablet and is one file; the other half cannot
reach him at all. The split was decided after `PUP-WO-0101`'s second adversarial
pass, on the evidence that its fixes had begun producing new defects.
