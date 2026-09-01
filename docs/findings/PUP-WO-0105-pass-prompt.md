# PUP-WO-0105 — the adversarial pass prompt

> **NOTE, ADDED AT MERGE.** This branch ships **`sw.js` alone**. The two test files it
> describes — `.github/ci/check-error-caching.mjs` and `.github/ci/demo-error-poisoning.mjs`
> — were **stripped and moved to `PUP-WO-0106`** by the architect's ruling after the
> second pass, because the demonstration printed `DEMO GREEN` over a poisoned shell and
> the check passed when the error response never existed. They are unwired today, but
> `PUP-WO-0104` wires them, and shipping a check that will later be wired while it
> prints green over the exact defect it names is the "looks like coverage" failure with
> a delayed fuse. **Ship what is verified: the guard is, the evidence is not.**
> References to those two paths below are therefore historical — they describe what was
> reviewed, not what merges.

Committed rather than held in a session, so it survives a context boundary as an
artifact. Architecture §5 requires the verbatim exchange; this is the half that exists
before the pass runs.

**This is ROUND 2 of the prompt, rewritten rather than appended to.** Round 1 described
a `CACHE_VERSION` bump that the first pass reversed and that no longer exists, and its
probe 4 asked four questions about that bump *all of which were about failure to
update* — so all four could only answer "safe", and none asked what a **successful**
update costs, which was the only state where the bump did anything. A prompt describing
a removed thing is a dangling pointer of its own kind, and a probe that can only return
good news is worse than no probe. Both are fixed below.

---

You are running an ADVERSARIAL REVIEW of a frozen artifact. You are not its author.
Judge only what is in front of you.

REPO: /home/ikthys777/worktrees/PupPad/builder  (branch build/wo-0105, frozen at the commit named in the dispatch)

PupPad is an offline-first PWA — a pretend command console for a three-year-old who
cannot read. `sw.js` IS LIVE ON THE CHILD'S TABLET RIGHT NOW. This work order is ONE
GUARD in that file: the fetch handler wrote every resolved response into the cache, so
an HTTP error received while online replaced the precached app shell, and the child
then got the error page offline.

CITATIONS TO READ — ratified ground truth, not under review. (Everything in this block
is a file you should open. Path-shaped strings elsewhere in this prompt are ENVIRONMENT
ADVICE, not citations — do not treat them as pointers to resolve.)
  docs/northstar.md                       invariants; 3 and 5 are the ones at stake
  docs/architecture.md                    §5 rulings, §6 runtime, §6.1 the verdict family
  docs/work-orders/PUP-WO-0105.md         the work order this artifact claims to satisfy
  docs/work-orders/PUP-WO-0104.md         the cache gate — DEFERRED. Read it so you do
                                          not spend the pass re-finding M9 and M7

THE ARTIFACT:
  sw.js                                   the subject — ONE guard, no version change
  .github/ci/check-error-caching.mjs      the sandbox check
  .github/ci/demo-error-poisoning.mjs     the real-browser demonstration
  docs/feedback/PUP-WO-0105.md            the builder's account — A CLAIM, NOT A RESULT
  docs/findings/PUP-WO-0105-adversarial.md  THE FIRST PASS, and what it reversed

READ THE FIRST PASS BEFORE PROBING. A `CACHE_VERSION` bump shipped in round 1, was found
to delete the Map panel's offline assets, and was reverted. Knowing what was removed and
why is most of your job — and the builder's ROUND 2 section marks four of his own earlier
claims as struck. Check the corrections as hard as the code.

YOU MAY RUN THINGS. node v24.16.0; Chromium `channel: 'chromium'`, verified at version
141.0.7390.37. Checks take a directory as argv[2]. Compare against the unguarded worker
with `git show origin/main:sw.js`.

**`playwright` resolves from `.github/ci/`, NOT the repo root.** A script written
elsewhere dies with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`, which
looks like a missing dependency and is not one. Put your script there, or symlink that
directory's `node_modules` beside it. This cost the builder two cycles.

DO NOT MODIFY THE REPOSITORY — it is frozen. No commits, pushes, stashes or edits under
the repo path. Copy with `cp -r`, NEVER `cp -a`: this is a git WORKTREE and copying its
.git pointer file makes stray commits land on the frozen branch.

PROBES. Concrete attacks, not a restatement of the work order.

1. WHAT DOES A SUCCESSFUL UPDATE COST? Not what happens if the update fails — round 1's
   prompt asked only that, and it is why the worst defect in round 1 was invisible.
   Devices carrying today's worker will receive this one. Walk the transition in the
   state where it WORKS: install runs `cache.addAll(urlsToCache)` into the SAME cache,
   activate reaps nothing, `skipWaiting` and `clients.claim()` fire. What changes for a
   device mid-session? For a page controlled by the old worker while the new one claims
   it? What is overwritten, what survives, and is anything the child had a moment ago
   now gone? Answer it by measuring a real v-old → v-new transition, not by reading.

2. FOR EVERY CLAIM IN THE FEEDBACK FILE, WHAT WAS ACTUALLY VARIED TO PRODUCE IT? This
   is the highest-value probe in this list. Round 1's headline evidence was a four-class
   matrix of response types — and it varied THE RESPONSE and nothing else, which is
   exactly why it could not see a defect that lived in the cache version. For each
   table, each measurement and each "verified" in `docs/feedback/PUP-WO-0105.md`: what
   was held fixed? What conclusion is drawn that ranges over something never varied?
   A true measurement supporting a wider claim than its own variable is the defect.

3. AIMED AT THE CHECKS, NOT THE WORKER. For each assertion in
   `check-error-caching.mjs` and `demo-error-poisoning.mjs`: what mutant does it catch
   that NO OTHER assertion catches? An assertion with no unique mutant is decoration.
   Round 1 shipped a demonstration that printed DEMO GREEN for a worker that cached
   nothing, and a check whose cross-origin assertion never took the cross-origin path —
   both would have surfaced faster from this question than from any probe about `sw.js`.
   Neuter each stub with an ORDINARY SUCCESS value, not an obviously broken one.

4. POISON THE CACHE SOME OTHER WAY. The guard is
   `if (response.ok || response.type === 'opaque')`. Get something harmful past it, or
   show a legitimate response it drops: a 3xx and what `.ok`/`.type` are after it; a 206
   (`ok` is TRUE for 206, and `cache.put` rejects it); `opaqueredirect`; `type: 'error'`;
   a 200 whose BODY is an error page, which no status can catch; a cross-origin CORS 404
   (`type: 'cors'`, `ok` false — is refusing it right for the Map panel?); 304, 401, 429.

5. THE OPAQUE HOLE. The builder claims an opaque 200 and an opaque 404 are
   indistinguishable, so a failed tile is cached exactly as before, and prints that as a
   `NOT ASSERTED:` line. Round 1 attacked this across twelve observables and could not
   dent it — but also found the worker CHOOSES opacity by passing `event.request`
   through, and that all three hosts serve `ACAO: *`. Re-attack both halves: is the
   claim still true, and is the deferral still honest?

6. FIND ANOTHER BRANCH OF sw.js THAT NO CHECK EXECUTES. Round 1 found the cross-origin
   branch at coverage count 0, and mutating it left every check green. That is a class,
   not an incident. Enumerate the handler's branches and ask, for each, WHICH check
   executes it and WITH WHAT FIXTURE: `servesRequest`, `canonicalPath`, install, the
   reap, the legacy exception, the 504 miss path, the `CACHE_PREFIX === null` family.

7. QUOTA. Round 1 measured opaque cache entries at ~8 MB each against 1,324 bytes for
   same-origin — a 6,109× padding factor — making map panning a quota-exhaustion path,
   and a full device unable to install this or any future fix because `addAll` rejects.
   That is recorded and NOT this work order's to fix. Confirm or refute the numbers, and
   if you can reach the lockout state, say what the child sees. Do not propose a design.

OUT OF SCOPE: M9 (a worker gated on both the sandbox and the production origin) and M7
(cache-content corruption) — both PUP-WO-0104's, along with the cache gate's SHAPE.
Publication and ci.yml are PUP-WO-0103's and parked. The CDN loads in index.html are
PUP-WO-0600's. **A defect in sw.js OUTSIDE the guarded lines IS worth reporting** — that
is how this work order came to exist, and how round 1 found the cross-origin gap.

REPORT — one entry per finding, most serious first:
  finding · where (file:line) · type · why it matters · recommendation · decision-needed?

Rank by consequence to the CHILD'S TABLET, not cleverness. Say plainly which are
disqualifying, which real-but-tolerable, which cosmetic. If you find nothing serious,
say so and say what you tried — an empty result you stand behind beats a padded list.
Quote exact commands and exact output. State which findings you REPRODUCED yourself and
which you REASONED to.
