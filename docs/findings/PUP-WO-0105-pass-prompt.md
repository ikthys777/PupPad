# PUP-WO-0105 — the adversarial pass prompt, committed before dispatch

Committed rather than held in a session, so it survives a context boundary as an
artifact. Architecture §5 requires the verbatim exchange; this is the half that exists
before the pass runs.

---

You are running an ADVERSARIAL REVIEW of a frozen artifact. You are not its author.
Judge only what is in front of you.

REPO: /home/ikthys777/worktrees/PupPad/builder  (branch build/wo-0105, frozen at the commit named in the dispatch)

PupPad is an offline-first PWA — a pretend command console for a three-year-old who
cannot read. `sw.js` IS LIVE ON THE CHILD'S TABLET RIGHT NOW. This work order is ONE
GUARD in that file: the fetch handler wrote every resolved response into the cache, so
an HTTP error received while online replaced the precached app shell, and the child
then got the error page offline.

GROUND TRUTH — ratified, not under review:
  docs/northstar.md                 invariants, each with its own falsification test;
                                    3 and 5 are the ones this defect violates
  docs/architecture.md              §5 rulings, §6 runtime and deployment, §6.1 the
                                    verdict family and its four members
  docs/work-orders/PUP-WO-0105.md   the work order this artifact claims to satisfy
  docs/work-orders/PUP-WO-0104.md   the cache gate — DEFERRED. Read it so you do not
                                    spend the pass re-finding M9 and M7, which are
                                    known, accepted and scheduled

THE ARTIFACT:
  sw.js                                    the subject — one guard and one version bump
  .github/ci/check-error-caching.mjs       the new sandbox check
  .github/ci/demo-error-poisoning.mjs      the new real-browser demonstration
  docs/feedback/PUP-WO-0105.md             the builder's account — A CLAIM, NOT A RESULT

READ THE FEEDBACK FILE BEFORE PROBING, especially §2's four-class table and §5's
honest account of what acceptance 3 does NOT cover. Then attack both.

YOU MAY RUN THINGS. node v24.16.0; Chromium via playwright `channel: 'chromium'`
(or PUPPAD_CHROMIUM). Checks take a directory as argv[2]; `.github/ci/node_modules`
holds playwright. To compare against the unguarded worker:
`git show origin/main:sw.js`.
DO NOT MODIFY THE REPOSITORY — it is frozen. No commits, pushes, stashes or edits under
the repo path. Copy with `cp -r`, NEVER `cp -a`: this is a git WORKTREE and copying its
.git pointer file makes stray commits land on the frozen branch.

PROBES. Concrete attacks, not a restatement of the work order.

1. POISON THE CACHE SOME OTHER WAY. The guard is
   `if (response.ok || response.type === 'opaque')`. Get something harmful past it, or
   show a legitimate response it drops. Specifically: a 3xx and what `response.ok` and
   `response.type` are after a followed redirect; a 206 (`ok` is TRUE for 206, and
   `cache.put` REJECTS a 206 — where does that land?); `type: 'opaqueredirect'`;
   `type: 'error'`; a 200 whose BODY is an error page, which no status can catch; a
   200 with the wrong Content-Type; a cross-origin CORS (not no-cors) 404, whose type
   is `cors` and whose `ok` is false — is that the right call for the Map panel?

2. THE OPAQUE HOLE, WHICH THE BUILDER SAYS IS UNFIXABLE. He claims an opaque 200 and
   an opaque 404 cannot be told apart, so a failed tile is cached exactly as before.
   Is that true? Consider `response.body`, `bodyUsed`, byte length, `Response.type`
   after `cache.match`, and whether a `cors` request mode would have been available for
   these specific assets. If it IS distinguishable, the guard is weaker than it should
   be and the NOT ASSERTED line is an excuse rather than a limit.

3. ATTACK THE STUB — the acceptance criterion the work order says matters most. Can
   `check-error-caching.mjs`'s fixture resolve? With a non-OK status? As opaque? Does
   the assertion actually READ what it claims to read? Neuter each stub with an
   ORDINARY SUCCESS value — not an obviously broken one — and see whether anything goes
   red. Break `clone()` again in a different way. Make `FakeCacheStorage.put` a no-op.
   Make the flush loop too short. **If any assertion can pass while the property under
   test is false, that is the finding.** The builder's own first fixture failed this
   way and he wrote it up; find the next one.

4. THE VERSION BUMP. `CACHE_VERSION` v17 → v18 is claimed as part of the fix, for
   recovery on already-poisoned devices, and claimed safe because the reap is
   prefix-bounded and a failed precache leaves the old worker serving. Check both
   claims. What happens to a device mid-flight? To the `/stable/` copy? To a device
   that is offline for a week? Is there any state where the child has neither worker?

5. FIND ANOTHER BRANCH OF sw.js THAT NO CHECK EXECUTES. This defect survived because
   the one fixture reaching the online write path could not carry a status. That is a
   class, not an incident. Enumerate the handler's branches and ask, for each, which
   check executes it and with what fixture. `servesRequest`, `canonicalPath`, the reap,
   the legacy exception, install, the 504 miss path.

6. VERIFY THE BUILDER'S CLAIMS. The feedback file asserts a four-class measurement, a
   red-then-green demonstration, a byte-identical B7 failure set before and after, and
   that `main`'s check-mutations has zero `expectFail`. Reproduce them. A claim you
   cannot reproduce is a finding. Pay attention to acceptance 3, which he marks
   PARTIALLY met — is his argument that "no panel can lose an asset it previously had"
   actually supported by the matrix, or does it have a hole he did not look for?

OUT OF SCOPE, and please do not spend the pass here: M9 (a worker gated on both the
sandbox and the production origin) and M7 (cache-content corruption) — both known, both
disqualifying, both PUP-WO-0104's. The cache gate's SHAPE is 0104's. Publication and
ci.yml are PUP-WO-0103's and parked. The CDN loads in index.html are PUP-WO-0600's.
If you find a defect in sw.js OUTSIDE the guarded lines, that is worth reporting — it
is how this work order was created.

REPORT — one entry per finding, most serious first:
  finding · where (file:line) · type · why it matters · recommendation · decision-needed?

Rank by consequence to the CHILD'S TABLET, not cleverness. Say plainly which are
disqualifying, which real-but-tolerable, which cosmetic. If you find nothing serious,
say so and say what you tried — an empty result you stand behind beats a padded list.
Quote exact commands and exact output. State which findings you REPRODUCED yourself and
which you REASONED to.
