# PUP-WO-0105 — round 3 pass prompt

**Scope is narrow on purpose and the narrowing is a ruling.** Two passes have already
worked the guard, the reap, the prefix derivation and the `/stable/` decline. A third
sweep across them costs a cycle and will not pay.

---

You are running an ADVERSARIAL REVIEW of a frozen artifact. You are not its author.

REPO: /home/ikthys777/worktrees/PupPad/builder (branch build/wo-0105, frozen at the commit named in the dispatch)

PupPad is an offline-first PWA for a three-year-old who cannot read. `sw.js` is LIVE on
the child's tablet. Rounds 1–2 added a guard so an HTTP error cannot be cached over the
app shell. **Round 3 is about whether that fix can ARRIVE**: on a device with no quota
headroom, `install`'s `addAll` rejected, the new worker went `redundant`, and the OLD
unguarded worker stayed activated — so the fix missed the devices that most need it.

**YOUR SCOPE IS THE INSTALL PATH AND ITS CHECKS.** Do not re-attack the guard, the
reap, `canonicalPath`, `servesRequest` or the `/stable/` decline. If you find something
outside the install path, REPORT IT WITH ITS SEVERITY AND SAY IT IS OUT OF SCOPE — it
does not reopen this work order unless it is live-on-the-tablet severity.

CITATIONS TO READ (path-shaped strings elsewhere are environment advice, not pointers):
  docs/work-orders/PUP-WO-0105.md   §0a is the brief; note it may lag the branch
  docs/feedback/PUP-WO-0105.md      the builder's account — A CLAIM, NOT A RESULT
  docs/northstar.md                 invariants 3 and 5
  docs/architecture.md              §5, §6.1, §6.4

THE ARTIFACT:
  sw.js                                the install path: isQuotaError, precacheUrls,
                                       reclaimRuntimeEntries, and the install handler
  .github/ci/check-error-caching.mjs   check 8 — sandbox
  .github/ci/demo-quota-install.mjs    check 10 — real browser, lifecycle
  .github/ci/lib/sw-harness.mjs        the fixture: putAttempts, capacityEntries,
                                       httpFailFor, Cache.delete, key resolution
  .github/workflows/ci.yml             where 8, 9 and 10 are wired

PROBES.

1. CAN THE RECLAIM DELETE SOMETHING IT MUST NOT? It is bounded to `CACHE_NAME`, must
   never touch a `urlsToCache` entry, and must never reach another prefix or another
   cache. Attack the keep-list: `precacheUrls()` resolves against `SCOPE_URL` — what
   if a precache entry has a query string, a fragment, a trailing-slash variant, a
   percent-encoded form, or resolves differently than the key `addAll` wrote? What if
   `SCOPE_URL` is null or odd? What does it delete on the `/stable/` copy?

2. CAN A BAD DEPLOY GET THROUGH THE QUOTA DISCRIMINATION? The rule is: quota is
   survivable, a fetch/HTTP failure is not. Find a failure that presents as
   `QuotaExceededError` but is really a bad deploy, or one that should be survivable
   and is not. What about a mixed batch — one URL 404s AND the quota is exhausted?
   What about an `AbortError`, a `SecurityError`, a rejection with no `name`, a
   cross-realm DOMException, a string throw?

3. CAN THE RETRY LOOP? It is meant to be exactly one retry. Prove it, or break it.
   What if the reclaim itself throws? What if `cache.keys()` rejects? What if the
   second `addAll` throws something that is not a quota error?

4. WHAT DOES THE HARNESS'S QUOTA CONSTRAINT FAIL TO EXPRESS? `capacityEntries` counts
   ENTRIES; a real quota counts BYTES, and Chrome pads an opaque entry to ~7 MB
   regardless of body size. What defect is invisible to an entry-counting model? Does
   check 8 assert anything that would be false in a browser? The builder claims the
   sandbox model is anchored by check 10 — test that claim.

5. THE CHECKS THEMSELVES. For each assertion in checks 8 and 10, what mutant does it
   catch that no other assertion catches? An assertion with no unique mutant is
   decoration. Neuter each stub with an ORDINARY SUCCESS value. **This artifact's
   author has produced seven false greens in one day, every one of them an assertion
   satisfied by nothing having happened — look for the eighth.**

RUN THINGS. node v24.16.0; Chromium `channel: 'chromium'` (141.0.7390.37). Checks take
a directory as argv[2]. **`playwright` resolves from `.github/ci/`, NOT the repo root**
— a script written elsewhere dies with ERR_MODULE_NOT_FOUND, which looks like a missing
dependency and is not. Prior workers: `git show origin/main:sw.js` (no guard, no
reclaim), `git show b87fd8c:sw.js` (guard, no reclaim).

DO NOT MODIFY THE REPOSITORY — frozen, and a git WORKTREE. Copy with `cp -r`, NEVER
`cp -a`.

REPORT — most serious first:
  finding · where (file:line) · type · why it matters · recommendation · decision-needed?
Rank by consequence to the CHILD'S TABLET. Say which are disqualifying, which
real-but-tolerable, which cosmetic, and which are OUT OF SCOPE but worth recording.
Quote exact commands and output. Mark every finding REPRODUCED or REASONED-TO. An
empty result you stand behind beats a padded list.
