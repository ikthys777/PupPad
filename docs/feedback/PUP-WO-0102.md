# PUP-WO-0102 — upward feedback

**Builder:** CC-EM (pup-b) · **Branch:** `build/wo-0102`, from `origin/main @ 282c33c`.
**Verbatim adversarial exchange:** `docs/findings/PUP-WO-0102-adversarial.md`. Neither
file summarises the other's job.

---

## Gates — checkable facts, not assurances

| Gate | Status | How to check it yourself |
|---|---|---|
| Protected surfaces diff to empty | **EMPTY** | `git diff origin/main -- index.html manifest.json icon-192.png icon-512.png` prints nothing |
| No publication job, script, or permission | **NONE** | `grep -nE 'publish\|deploy-pages\|pages: write\|id-token' .github/workflows/ci.yml` matches only prose in comments; the workflow has one job, `checks`, and `permissions: contents: read` at the top with no job-level override |
| `.github/` touched only for checks + harness | **YES** | the ci.yml diff adds two steps to the `checks` job and edits comments; nothing else |
| PUP-WO-0100's four checks unmodified in intent | **STRENGTHENED, NEVER WEAKENED** | checks 1 and 2 are byte-identical to `main`; check 3 replaced a text-scrape with an evaluation; check 4 replaced a four-way permissive state test with `=== 'active'` **and** `controlled` |
| Diff scope | `sw.js`, `.github/ci/`, `ci.yml`'s `checks` job, `docs/` | `git diff --stat origin/main` |
| All six checks green on this branch | **6/6** | run each of `.github/ci/check-{syntax,assets,cache-name,load,cache-isolation}.mjs` and `demo-two-path-caches.mjs` against `.` |

**On the last row and §0.** No `PUP-WO-0100` check was weakened, skipped or
special-cased to land this. Checks 3 and 4 were made **stricter** — check 4 in
particular previously passed a worker stuck in `installing` with offline capability
dead. If you want the one-line version: nothing went green by being asked more
gently.

---

## §2 vs §3.1 — the correction did not reach the acceptance list

**Finding · `docs/work-orders/PUP-WO-0102.md:121` · work-order defect · already
settled by the dispatch, recorded so the document gets fixed · decision-needed: no**

§2 was corrected before dispatch to permit `.github/ci/`. §3.1 was not, and still
reads *"`git diff origin/main --stat` shows `sw.js` and `docs/` only."* Taken
literally, acceptance item 1 fails on the very files §2 requires. The dispatch
message settles it unambiguously — *"a check that verifies the worker is yours"* —
so I proceeded rather than stopping, and I am reporting it rather than quietly
reading past it.

It is the same defect CC-A found and fixed, one section further down. Worth noting
only because it is the shape that keeps recurring here: **a correction applied where
the contradiction was noticed rather than everywhere the belief was written.**

**Resolved, and CC-A's diagnosis is better than mine.** Raised, acknowledged as a
third copy of one wrong belief, and fixed in PR #6 (awaiting Scotty). The fence, as
CC-A restated it and as this branch was built against:

```
sw.js
.github/ci/
.github/workflows/ci.yml   — the `checks` job ONLY
docs/
```

Why it survived two corrections is the part worth keeping. CC-A fixed §2 and §7 by
searching for the string `.github/`. **§3.1 states the same fence positively** — an
allowlist of `sw.js` + `docs/` — so it contains no such string and no search for it
could ever have matched. *Searching for the token finds the copies that name the
thing; only searching for the belief finds the rest.*

That generalises past this document, and it is the same failure as my own finding 1
below: a stale comment describing a design the code no longer has could not be found
by grepping for the design's name either, because it described the design in
different words. **Both were found by reading for the claim, not for the token.**

---

## What I carried forward, and the seam judgement for each

`build/wo-0101 @ 151980b` is parked and now unreferenced by any branch that will
merge. Everything below was brought across; everything not listed was left there.

| File | Verdict | Why |
|---|---|---|
| `sw.js` | **0102** | the whole point |
| `check-cache-isolation.mjs` | **0102** | asserts invariant 7 against the worker |
| `lib/sw-harness.mjs`, `lib/sw-cdp.mjs` | **0102** | the harness that drives the worker |
| `check-cache-name.mjs` | **0102** | evaluates the worker instead of scraping it |
| `check-load.mjs` | **0102** | worker state; moved from 0103 §1.8 on the seam |
| `demo-two-path-caches.mjs` → **check 6** | **0102** | judged by the seam, see below |
| `ci.yml` `checks` job | **0102** | two step registrations |
| `ci.yml` publish job, F8 two-tree harness, F9 publication windows, F12 rollback | **0103** | left on `151980b` |
| `docs/feedback/PUP-WO-0101.md`, `docs/findings/PUP-WO-0101-adversarial.md` | **carried, unchanged** | the record of both passes, and the evidence for architecture §6.1 |

**The demo, judged by the seam rather than by where it came from.** It serves ONE
tree — the working copy — at both `/` and `/stable/`, and registers the same `sw.js`
twice. It needs no published trees and no build, so it verifies the *worker*, not
publication. That makes it a check, and it is registered as check 6. The **two-tree**
harness that drives the two genuinely different *published* workers (F8) is a
different thing and is not here.

---

## My own findings on the carried-forward artifact

Four, all found by reading and probing rather than by running the suite — which had
been green throughout.

### 1 · The comment above `canonicalPath` described the design that F7 killed

**`sw.js:120-140` · stale-comment defect · FIXED · decision-needed: no**

The block comment said the worker *"requires the request to have ARRIVED canonical"*
and declines anything else. That is precisely the rule `PUP-WO-0101`'s F7 identified
as an invariant 3 violation — it refuses `/my%20photo.png`, which works online and is
silently absent offline. The **code** was corrected; this comment was not. It sat
three lines above a function that no longer behaves that way, while a second comment
*inside* that function correctly described the fix.

I have been bitten by this exact shape twice before on this project (a comment
claiming coverage a check did not have; a comment claiming an ordering the file did
not have). Recording it a third time because the pattern is now unmistakable: **a fix
falsifies the prose around it, and prose does not go red.**

### 2 · The sandbox could not host the defect it screens for

**`.github/ci/lib/sw-harness.mjs:74-83` · harness blindness · FIXED · decision-needed: no**

The sandbox had no `setTimeout`. A real `ServiceWorkerGlobalScope` does. So a worker
that schedules its reap on a timer — outside `waitUntil`, where the browser makes no
promise to keep it alive — died on a `ReferenceError` instead of being **evaluated**.

That is architecture §6.1's shape exactly, one level down: not "a stub returned the
wrong answer" but "the harness could not represent the failure at all." I only found
it because I tried to demonstrate the F9 trap red and the mutant would not run.
**A sandbox that cannot host the defect is not a sandbox for it.**

### 3 · Two stubs failed SILENT, and they were the pair the headline assertion rests on

**`.github/ci/check-cache-isolation.mjs:208-226` · harness blindness · FIXED · decision-needed: no**

I neutered each of six harness stubs in turn while leaving a real defect in `sw.js`,
predicting all six would let the defect through green. **I was wrong on four**, and
the correction is the finding:

> **A stub fails silently exactly when its neutered return value is also a legitimate
> one.** `match() → undefined` and `put() → no-op` both mean *cache miss* — and a
> cache miss is what a PASS looks like there, so nothing contradicts them. `keys() →
> []`, a no-op `delete()`, a dropped `respondWith` and a wrong scope all produce
> states some *other* assertion already denies, so they fail loudly.

Elsewhere the check defends itself by **symmetry** — it asserts what must be deleted
as well as what must survive, what must be served as well as what must be declined —
so a neutered stub contradicts something. Assertion 8, the origin-wide **read**, had
no such counterweight: it is the one assertion whose only two supporting stubs are
both of the dangerous shape. **The check on the project's sharpest defect was its
least-defended assertion.**

Fixed with a positive control: the cross-path seed is proven *reachable* through the
store before its absence is accepted as evidence. Both stubs now fail LOUD.

**The generalisation worth keeping** — and it is narrower and more useful than "audit
every stub": *audit the stubs whose degenerate value falls inside their legitimate
range.* `undefined` from a cache lookup is legitimate. That is why §6.1 happened
there and not somewhere else.

### 4 · F9's reap-timing half, closed

**`.github/ci/check-cache-isolation.mjs:105-128` · carried-open finding · FIXED · decision-needed: no**

F9 was left open on `PUP-WO-0101` as *"check 5 has no window at all."* Half of it was
never real: `dispatch()` awaits every promise handed to `waitUntil`, so a reap inside
it is fully observed **however slow it is**. The real hole is a deletion scheduled
*outside* the event.

Rather than sleep-and-recheck — which only catches timers shorter than whatever sleep
is picked — a **trap** is installed on the store: from that point to the end of the
run, any deletion at all fails the check. **Stated limit:** a timer longer than the
remaining process lifetime still escapes. That bound is real and I am not claiming
otherwise.

### 5 · The assertion I added to prove the merge-day path could not fail

**`.github/ci/demo-two-path-caches.mjs:161-176` · a stub that cannot fail · FIXED · decision-needed: no**

This is the sharpest finding in the work order and it is against me, in this work
order, on the discipline this work order exists to enforce.

Check 6 did not test §3.5's second half at all. §3.5 does not end at "legacy reaped,
new cache built" — it ends **"offline cold-load succeeds"**, which is the half Buddy
experiences on merge day. A migration that deletes the old cache and cannot serve
from the new one is *strictly worse than no migration*: it turns a stale-but-working
tablet into a blank one, offline, with no adult able to tell why.

So I added it, using `context.setOffline(true)`. Then I tried to demonstrate it red
with a worker whose offline fallback returns `undefined` — serving **nothing at
all** — and:

```
  ok    offline cold-load served the console from cache after the legacy migration (item 5): "Pup Pad"
  ok    the offline page is controlled by the worker that served it
CHECK 6 PASSED
```

**The mutant passed.** `setOffline` does not stop a service worker's own `fetch`
reaching a loopback server, so the worker kept being handed live bytes and
"offline" tested nothing. I had written a green assertion about the most
safety-critical path in the work order, and it was incapable of going red.

Fixed by making offline unambiguous — the HTTP listener and its keep-alive sockets
are closed, so nothing can answer on that port and anything served came out of the
Cache API. Verified **red then green**: the mutant now fails on both assertions, the
real artifact passes both.

**Why I am writing this up rather than quietly fixing it.** §3.7 asks that every
stub be shown able to fail. I applied that rule to the six stubs I inherited and
found two real defects — and then wrote a *new* assertion and did not apply the rule
to it until the demonstration forced me. **The rule is not "audit the harness you
were given." It is "nothing counts as verified until it has been seen to fail."**
Every green in this document was produced by a check that has been watched going
red; this one is the reason I can say that.

---

## Decision needed — one, and it is a real fork

### Fifteen historical caches are stranded permanently by the bounded reap

**`sw.js:66-100` · consequence of the required fix · decision-needed: YES**

I asked §5's question of the reap fix — *what legitimate behaviour does this now
refuse?* — and the answer is: **it refuses to delete anything outside its own prefix,
and sixteen cache names have existed on `main`.**

```
pup-pad-v1, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16
                                                        (there was never a v2)
```

Only `v16` is excepted. A device that last loaded PupPad at **v1–v15** and has not
loaded since keeps that cache **forever** — a bounded reap cannot reach it, and no
later worker will either.

**Why I did not just fix it.** A list of exact literals would honour §1.3's "never a
pattern" rule exactly and cost nothing to write. But `ikthys777.github.io` is a
**shared origin across every one of this account's Pages repositories**, and each name
added is one more unconditional origin-wide deletion — widening the single place in
the file where the rule the whole file exists to enforce is deliberately broken. The
file's own comment calls that "how the origin-wide reap returns, disguised as
cleanup." Trading a permanent, invisible, shrinking leak for fifteen more origin-wide
deletions is an architect's call.

**The case for leaving it at one (my recommendation):** it is a leak, not a
violation. Such a cache is never read (the offline read is scoped to `CACHE_NAME`) and
never served, so invariants 3 and 7 hold regardless. It is also **self-limiting** —
the currently-live v16 worker reaps origin-wide, so every device that has loaded since
2026-07-12 holds v16 and nothing older. Realistically that is every device in play.

**The case for the list:** "realistically" is doing load-bearing work in that
sentence, and architecture §6's assertion that *every* device holds `pup-pad-v16` is
an assumption nobody can test from here.

The enumeration is committed in `sw.js`'s comment either way, so the decision is
informed rather than forgotten.

---

## Red demonstrations — §3.3 and §3.7

Run by a meta-check that **fails if any mutation escapes**: it asserts check 5 goes
RED when the defect is present, and classifies each neutered stub as SILENT (the stub
was the only defence) or LOUD (another assertion contradicts it).

Sixteen mutations, all as predicted. Full captured output is in
`docs/findings/PUP-WO-0102-adversarial.md`. The two that matter most:

- **A1 — invariant 7's own falsification test.** Restore the origin-wide read; check 5
  goes RED on *"the root worker SERVED the other deploy path's cached bytes when
  offline."* §3.3 asked for this specifically because architecture §6.1 records that
  the defect was invisible to a green suite — the red run is the only thing proving
  the check sees it at all.
- **B1 — the same `sw.js`, one stub apart.** Identical defect to A1, with the harness
  `match()` returned to the `undefined`-unconditionally form. Before the positive
  control: **GREEN**. That is architecture §6.1 point 2 reproduced on demand rather
  than described.

**A6** deserves naming too: it restores the F7 regression — requiring paths to arrive
canonical — and check 5 goes red on *"declined a legitimately encoded asset."* The
"what does this fix refuse?" discipline is now a mechanism in this repository, not a
question someone has to remember to ask.

**A11** is the one that justifies the F9 trap. A10 (reap deferred entirely) goes red
on the *pre-existing* assertions, so it does not prove the trap earns its place. A11 —
a perfectly correct prefix-bounded reap **plus** a deferred origin-wide sweep — passes
every assertion in sections 1–2, because at the moment they measure the worker has
behaved impeccably. It is caught by the trap and by nothing else.

---

## What did not work, and why

- **The red-demo harness is not committed.** It mutates `sw.js` and the harness into a
  scratch tree and runs the check against copies. Committing it would put a
  mutation engine in `.github/ci/`, which is scope the work order did not ask for and
  risk on the branch that reaches Buddy. **The consequence, stated plainly: these
  demonstrations rot.** The script is reproduced verbatim in the findings file so it
  can be re-run, but nothing makes it run again. *(Raised as a note, not a
  decision-needed: it is CC-A's to weigh against `PUP-WO-0103`, which touches
  `.github/` only and could host it safely.)*
- **`context.setOffline(true)` is not offline for a service worker.** Recorded as a
  fact about the tool, not only as finding 5: a worker's own `fetch` still reaches a
  loopback origin with the flag set. Anything asserting offline behaviour in this
  repository must remove the server, not the flag.
- **Playwright's own browser installer stalled for over three hours**, twice, with
  zero bytes transferred and no error — first behind an orphaned `__dirlock` from
  the previous session, then on its own. `curl` pulled the identical 182 MB build
  from the same CDN at 30 MB/s, so the network was never the problem. Resolved by
  fetching and unpacking the build directly. Recorded because "downloading" and
  "deadlocked" were indistinguishable from outside for hours — the same shape as a
  green check nobody is watching, and the same shape as the stall CC-A had to
  resume me from.
- **Three hours of the browser checks were blocked by a stale lock**, not by
  anything in the artifact: an orphaned `playwright install` from the previous
  session held `~/.cache/ms-playwright/__dirlock`, so every subsequent install queued
  behind it silently — no output, no error, no progress. Cleared by killing the
  orphan. Recorded because "it is downloading" and "it is deadlocked" looked
  identical for three hours, which is the same failure mode as a green check nobody
  is watching.

## What was deliberately not done

- **The publication workflow, in every part.** No publish job, no build stamp, no
  invariant-4 byte verification, no archive hardening, no rollback lever. `ci.yml`
  gained two step registrations in the `checks` job and nothing else.
- **The two-tree harness (F8)** — it needs two *published* workers, which is
  publication, which is `PUP-WO-0103`'s.
- **The fetch strategy.** Still network-first; architecture §10's open question.
  Identity and ownership changed, strategy untouched, per §1.
- **Generalising to N deploy paths.** Two copies today (§4).
- **A percent-encoded worker scope is not handled symmetrically.** `servesRequest`
  compares the *decoded* request path against the *raw* `SCOPE_PATH`, so a worker
  registered at e.g. `/PupPad%20x/` would decline everything. It also unregisters
  itself in `activate`, so the outcome is "unregisters" rather than "mis-serves" —
  and both live deploy paths are canonical. Left alone as §4's "generalising to N
  paths", flagged so it is a decision rather than an oversight.
