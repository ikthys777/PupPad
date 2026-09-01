# PUP-WO-0104 — The cache gate: a real browser at the production origin

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0104`.
**Author:** CC-A · **Builder:** a fresh session (see §0).
**Phase:** P1.
**Depends on:** `PUP-WO-0103` merged.
**BLOCKS:** `PUP-WO-0600` **and any future change to `sw.js` reaching publication.**
See §1.
**Grounds:** `docs/northstar.md` invariants 3, 7 · `docs/architecture.md` §5, §6.1 ·
`docs/feedback/PUP-WO-0103.md` (M7, M9, M10) ·
`docs/findings/PUP-WO-0103-adversarial.md` · `.github/ci/`.

> **What this is:** the cache gate, rebuilt at the right shape. `PUP-WO-0103`'s
> second-round mutants proved **three independent workers can harm the promoted
> copy's cache and pass all seven checks** — not because the checks have bugs, but
> because of what they are. It is **NOT** an `sw.js` change (that file is correct;
> `PUP-WO-0102` owns it), not publication (`PUP-WO-0103`), and not games.

**Cadence:** build. One PR, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0104 origin/main`.

---

## 0. Read this first

**This work order touches `.github/` only and cannot reach the tablet.** Pages does
not serve `.github/`, so architecture §6's bootstrap exception covers it whole.
**Push early and often and let real runs fail** — a check that has never run is a
hypothesis, and this work order is entirely about checks that were believed to work.

**You are a fresh session by design.** `PUP-WO-0103` reached the end of its
builder's context, and the escalation that produced this work order is the brief:
read `docs/feedback/PUP-WO-0103.md` and `docs/findings/PUP-WO-0103-adversarial.md`
before anything else. **Three rounds of fixes on that work order each closed a defect
and opened another on the way past.** That is why this is a separate work order with
a fresh context, and it is the thing most worth not repeating.

**`sw.js` is protected and correct.** If the gate appears to require a worker change,
that is a flag-and-stop and a dependency, not an edit.

## 1. Why this blocks `PUP-WO-0600`

Architecture §1.4's rule — publication refuses a copy whose worker reaps or reads
outside its own prefix — is currently asserted by **one check that is a detectable
Node sandbox**. It is one line of sandbox detection away from nothing.

That is survivable **today** only because the sequencing puts the correct worker on
both copies: `stable` is fast-forwarded to `main` before Pages is flipped, so no bad
worker exists to catch. **The gate is defence against a future bad worker** — which
means the next change to `sw.js` must not reach publication until this lands. State
that constraint in your feedback so it is not lost if this work order is split.

## 2. Scope

### 2.0 FIRST: check 5 is red by crash, not by assertion — G4

*Added 2026-09-01 from `PUP-WO-0103`'s second pass. **Do this before §2.1**, because
until it is done every other red in this check is of unknown provenance.*

A worker whose offline read **rejects** produces this from `check-cache-isolation`:
both invariant-7 assertions print as **passing**, `CHECK 5 PASSED` is printed, and
**then** node dies on an unhandled rejection. Exit 1 — for a reason that is not an
assertion at all.

**Reproduced by CC-A**: replacing `return cache.match(event.request)` with a
rejecting promise yields exactly that — `CHECK 5 PASSED` on stdout, two
invariant-7 lines reporting success, exit 1 from `Error: offline read rejects`.

**So the check is red by accident.** Add a `.catch()` anywhere on that path — which
is ordinary hardening someone will eventually do — and it goes **fully green with
the defect present.** This is family member 3 in its purest form: a failure whose
cause is not the one under test, where the cause is not a test at all.

Required: the offline-read path is exercised through an assertion that fails
**as an assertion**, with a named message, and an unhandled rejection anywhere in
the check is itself a failure with its own message rather than a bare stack trace.

### 2.0a Wire `PUP-WO-0105`'s two checks into `ci.yml`

*Added 2026-09-01, before dispatch.* `PUP-WO-0105` builds
`check-error-caching.mjs` and `demo-error-poisoning.mjs`, and correctly did **not**
wire them — `.github/workflows` was `PUP-WO-0103`'s parked artifact at the time and
touching it would have broken its fence. Its builder flagged it rather than letting
the count imply protection: **an unwired check is not a gate.**

Two `run:` lines, in an edit this work order must make anyway to register its own
checks. Not new surface — but it is the difference between two demonstrable checks
and two checks that guard something.

### 2.1 A real browser at the production origin — M9

Today there are **two separable gates**, and a payload conditioned on both is
invisible to everything:

| Check | Origin | Environment |
|---|---|---|
| `check-cache-isolation` | `https://ikthys777.github.io` | **Node sandbox — detectable** |
| `demo-two-path-caches` | `http://127.0.0.1` | real browser, **wrong origin** |
| `check-two-trees` | `http://127.0.0.1` | real browser, **wrong origin** |

M9 — a root worker that deletes `/stable/`'s entire cache **on the production
origin** — passes all seven checks by gating on both. Both gates were proven live
independently: removing the origin gate reddens `check-two-trees`, removing the
sandbox gate reddens `check 5`.

**`ci.yml` states in writing that check 6 catches this. It cannot — check 6 is not on
the site's origin.** Fix that comment too; a wrong comment is a claim.

**Required: a real browser serving the production origin.** Chromium's
`--host-resolver-rules=MAP ikthys777.github.io 127.0.0.1` with a locally-trusted or
ignored certificate is the suggested route — it makes the origin gate **inexpressible
rather than merely detected**, which is the difference between closing M9 and catching
it. Mechanism is yours; if this route fails, that is a finding and a flag-and-stop,
not a limit to declare.

### 2.2 Cache **content**, not just cache names — M7

Nothing asserts the promoted cache's contents beyond a single URL. M7 leaves
`/PupPad/stable/index.html` alone, replaces **every other entry** with an empty 200 —
both icons, the manifest, the `./` key, all three offline CDN libraries — and passes
everything. No sandbox detection, no origin detection, no timers. **Fully observed and
still invisible.**

Assert content for **every** entry in `urlsToCache`, not a representative one.

### 2.3 The two assertions `PUP-WO-0103` deleted

Deleted rather than repaired, deliberately, because an assertion that cannot fire is
false coverage. Each check currently prints what it does not assert. **Build them for
real:**

- navigation-poisoning of the root cache by `/stable/`;
- **survival of the promoted cache through the root worker's *first* activation.**

### 2.4 Name-existence is not survival

`PUP-WO-0103`'s F0 fix seeds the promoted cache, brings up root, then registers
stable — **whose install recreates the cache** — and asserts the name exists. **That
cannot distinguish "survived" from "deleted, then recreated by the next step."** A run
where the root worker demonstrably deleted it prints `ok`. Assert identity or content,
never mere presence, and order the steps so recreation cannot mask deletion.

### 2.5 Make M9 and M7 permanent — mutations, not memories

*Architecture §5: when a discipline keeps having to be remembered, find the mutation
that makes CI remember it.* Add M9, M7 and the §2.3 cases to `check-mutations.mjs`
so each is required to produce red. They are then regressions, not lessons.

**And repair PART B's verdict while you are in that file.** *(Found by
`PUP-WO-0103`'s pass; amended here 2026-09-01, before dispatch.)*
`check-mutations.mjs:106` reads `const matched = !expectFail || fails.some(...)`, and
**none of PART B's seven mutations carries an `expectFail`** — verified: 18
occurrences in the file, zero after PART B begins. So for all of PART B `matched` is
unconditionally true and the verdict collapses to *did check 5 go red at all*, which
is exactly what the comment above it says was fixed. A pure syntax error in a PART B
harness patch scores `ok`.

Its summary line therefore claims more than the run supports: **"every stub is
load-bearing"** is not established by a verdict that never discriminates which
assertion fired. **This is family member 1 inside the step `ci.yml` calls "the one
that makes green mean something"** — so it is not a tidy-up, it is the defect class
this project has spent the most effort on, living in the check built to prevent it.

Give every PART B mutation an `expectFail`, and make the summary claim only what the
verdict tests.

## 3. Acceptance — proven, not asserted

1. `git fetch origin && git diff origin/main --stat` shows `.github/` and `docs/`
   only. **`sw.js` and `index.html` diff to empty.**
2. **G4 first: every red this check produces is red BY ASSERTION.** Demonstrate that
   the rejecting-offline-read worker fails with a named assertion message, and that
   no path in the check can exit nonzero via an unhandled rejection. Until this
   holds, results 3–6 below cannot be trusted, because a red of unknown provenance
   proves nothing about what it was pointed at.
3. **M9, M7 and M10's cases each demonstrated RED**, by their own mutant, each
   reverted, each with captured output.
3. **Every demonstration asserts the commit and the step.** *Architecture §5, ruled
   after four false demonstrations in `PUP-WO-0103`.* Record `head_sha` against the
   commit under test **and the failing step's name** against the refusal claimed. **A
   red run is not evidence until both are checked.**
4. **Every stub shown able to fail** (architecture §6.1), including the new
   origin-mapped browser harness. A stub that cannot pose the question is not a test.
5. All `PUP-WO-0100`/`0102`/`0103` checks stay green, unmodified and un-special-cased.
6. The mutation engine covers §2.5, demonstrated by running it.

## 4. Scope fence — NOT in this work order

- **`sw.js`** — `PUP-WO-0102`'s, and correct. Flag-and-stop if the gate needs it.
- **`index.html`** — `PUP-WO-0600`.
- **Publication, the deploy path, invariant-4 byte verification** —
  `PUP-WO-0103`'s, merged. If a publication defect surfaces, report it; do not fix it
  here.
- Generalising beyond two deploy paths.

## 5. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only. **Freeze every file this
work order names as a deliverable, including your feedback file**, and dispatch one
pass against that frozen shape.

Probes:

- **Write a worker that harms the promoted copy's cache and passes.** The headline.
  Three already exist — M7, M9 and the M10 class — and they are the floor, not the
  target. Assume the gate is still the wrong shape and find where.
- **Attack the origin mapping.** Can a worker detect it and behave? If the answer is
  yes, §2.1 has not closed M9, only moved it.
- **Attack the content assertions.** What can be substituted that still compares
  equal?
- **Ask of every fix: what legitimate behaviour does this now refuse?** *(Architecture
  §5.)* An encoding fix in `PUP-WO-0101` closed an attack and opened an invariant 3
  violation.
- **Check that every red you were shown was red for the reason claimed** (§3.3).

## 6. Upward feedback

`docs/feedback/PUP-WO-0104.md`; verbatim exchange in
`docs/findings/PUP-WO-0104-adversarial.md`. Neither summarises the other's job.
Required: the red demonstrations with `head_sha` and failing step names; every stub
shown able to fail; what did not work and why; what was deliberately not done; a gates
line stating the protected-surface diff status as a checkable fact; and the §1
ordering constraint restated.

## 7. Flag-and-stop

- **Any need to change `sw.js`** to make the gate work.
- **The origin-mapped browser proving impossible or detectable** — a finding and a
  ruling, not a limit to declare.
- **A third adversarial pass finding serious defects.** `PUP-WO-0103` went three
  rounds and that is what produced this work order. If it happens again the problem is
  shape, not effort, and CC-A needs to hear it rather than have it absorbed.
- Any credential, repository setting, or push to `stable`.

## 8. Provenance

Written by CC-A 2026-09-01 from `PUP-WO-0103`'s second-round escalation. M7, M9 and
M10 are the builder's findings; M10 falsified a claim that builder had made to CC-A,
and it verified and reported it against its own interest. §2.4 and the §3.3
commit-and-step requirement are likewise its findings, generalised here into
acceptance criteria.
