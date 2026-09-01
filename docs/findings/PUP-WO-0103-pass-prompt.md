# PUP-WO-0103 — the adversarial pass prompt, committed before dispatch

Committed rather than held in a session, so it survives a context boundary as an
artifact. Architecture §5 requires the verbatim exchange; this is the half that exists
before the pass runs, and writing it is the part that most needs depth — every pass this
project has run has been worth what its probes were worth.

---

You are running an ADVERSARIAL REVIEW of a frozen artifact. You are not its author. Judge only what is in front of you.

REPO: /home/ikthys777/worktrees/PupPad/builder  (branch build/wo-0103, frozen at the commit named in the dispatch)

PupPad is an offline-first PWA — a pretend command console for a three-year-old who cannot read. It is published to GitHub Pages at TWO paths on ONE origin: the site root (newest build, a test device) and /stable/ (the promoted build, the CHILD'S home-screen icon). This work order builds the PUBLICATION pipeline. sw.js belongs to a previous work order, is merged and live on the child's tablet, and is PROTECTED — it must not differ from origin/main.

GROUND TRUTH — ratified, not under review:
  docs/northstar.md                 invariants, each with its own falsification test
  docs/architecture.md              §5 rulings, §6 deploy topology, §6.1, §6.2
  docs/work-orders/PUP-WO-0103.md   the work order this artifact claims to satisfy
  docs/work-orders/PUP-WO-0104.md   what was DEFERRED — read it, so you do not spend
                                    the pass re-finding M9 and M7, which are known,
                                    accepted and scheduled

THE ARTIFACT:
  .github/workflows/ci.yml          checks, publish and deploy jobs
  .github/ci/*.mjs, lib/*.mjs       the checks and harnesses
  docs/feedback/PUP-WO-0103.md      the builder's account — A CLAIM, NOT A RESULT
  docs/findings/PUP-WO-0103-adversarial.md   the FIRST pass, verbatim

READ THE FIRST PASS AND THE ROUND-3 FEEDBACK BEFORE PROBING. Much has been deleted rather than fixed, and knowing which is which is most of your job.

YOU MAY RUN THINGS. node 24; Chromium at ~/.cache/ms-playwright/chromium-1194. Checks take a directory as argv[2].
DO NOT MODIFY THE REPOSITORY — it is frozen. No commits, pushes, stashes or edits under the repo path. Copy with `cp -r`, NEVER `cp -a`: this is a git WORKTREE and copying its .git pointer file makes stray commits land on the frozen branch.
No GitHub credentials; you cannot trigger CI. Reason about the workflow by reading it and by transcribing its `run:` blocks and executing them locally — the first pass did this and it is what found the defects that mattered.

PROBES. These are concrete attacks, not a restatement of the work order.

1. GET main's CONTENT ONTO /stable/. Highest value by a wide margin; anything here outranks everything else. Northstar invariant 4: "the copy Buddy uses advances only when a human promotes it." Any path — found, suspected, or merely NOT RULED OUT.
   The dispatch surface that produced the last two disqualifying findings is GONE: no workflow_dispatch, no mode/main_sha/stable_sha, no ancestry gate. Publish now runs on pull_request and builds the PR HEAD as the root copy; the promoted copy is refs/heads/stable in every event; deploy is push-to-main-or-stable only.
   So attack THAT shape: can a pull request's head reach /stable/? Can the PR-head checkout be made to supply the promoted copy? Can `deploy` be reached from a PR, a fork, or a re-run? Does anything downstream of the byte assertion write into dist/stable? Check artifact reuse between jobs and between runs.

2. FIND A STEP WHOSE FAILURE IS ATTRIBUTED TO THE WRONG CAUSE. This artifact's most expensive recurring defect is a red run that reads as a successful demonstration — four instances, all recorded in the feedback file. Look for: a step that aborts before the step under test; a guard whose precondition excludes its own subject; a message naming an invariant the failure has nothing to do with; a `continue-on-error` whose gate misreports why it fired.

3. THE find/PRUNE FIX. `ci.yml`'s byte assertion passes a prune as a bash array after a previous version glob-expanded it and killed the publish job on every trigger. Re-attack it: word splitting, filenames with spaces or newlines, `git ls-tree` C-quoting of non-ASCII paths, `find -printf '%P'` versus what `git hash-object` receives, and whether the hashed set equals the set `upload-pages-artifact` actually publishes (it excludes dotfiles).

4. ASSERTIONS THAT CANNOT FIRE. Two were deleted rather than repaired and each check now PRINTS what it does not assert. Verify those deletions are honest — that nothing still claims coverage it lost — and find the next one. Grep for values computed, passed into an `evaluate`, and never read; comparisons of lengths where sets are meant; `catch` blocks that turn a throw into a pass.

5. ASK OF EVERY FIX: WHAT LEGITIMATE BEHAVIOUR DOES THIS NOW REFUSE? The probe that has caught the most on this project, and it caught the publish job aborting on every run. The tightened greps, the symlink refusals, the GATE step, the PR-head checkout and the `!cancelled()` guards are all new refusals.

6. VERIFY THE BUILDER'S CLAIMS. The feedback file's ROUND 2 and ROUND 3 sections assert specific red demonstrations and specific step names. Reproduce them. A claim you cannot reproduce is a finding. Pay particular attention to any claim of the form "X now agrees with Y" — one such claim was half-true last time, because the serving agreed and the assertions did not.

OUT OF SCOPE, and please do not spend the pass here: M9 (a worker gated on both the sandbox and the production origin) and M7 (cache-content corruption). Both are known, both are disqualifying, both are PUP-WO-0104's, and the ordering constraint is recorded. If you find a THIRD member of that family, that is worth reporting.

REPORT — one entry per finding, most serious first:
  finding · where (file:line) · type · why it matters · recommendation · decision-needed?

Rank by consequence to the CHILD'S TABLET, not cleverness. Say plainly which are disqualifying, which real-but-tolerable, which cosmetic. If you find nothing serious, say so and say what you tried — an empty result you stand behind beats a padded list. Quote exact commands and exact output. State which findings you reproduced yourself and which you reasoned to.
