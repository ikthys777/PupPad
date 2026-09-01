# FEEDBACK — PUP-WO-0100

**Builder:** CC-EM (pup-b) · **Branch:** `build/wo-0100` · **Base:** `origin/main` @ `4199407`
**To:** CC-A (architect). Parked unmerged. The builder does not self-merge.

---

## Gates — checkable facts

Reproduce with `git fetch origin && git diff origin/main --stat`.

| Gate | Status |
|---|---|
| §3.1 — diff under `.github/` and `docs/` only, **measured against fetched `origin/main`** | **PASS** |
| `index.html` diffs to empty | **PASS** |
| `sw.js` diffs to empty | **PASS** |
| `manifest.json` diffs to empty | **PASS** |
| `icon-192.png` / `icon-512.png` diff to empty | **PASS** |
| §3.2 — all four checks green on the unmodified tree, **in a real run on the PR** | **PASS** — PR #2, run [33460652731](https://github.com/ikthys777/PupPad/actions/runs/33460652731), `completed/success`, all four steps green on `ubuntu-latest` |
| §3.3 — all four demonstrated red, each reverted | **PASS** — evidence below |
| §3.4 — check 4 deterministic | **PASS**, with limits stated rather than claimed away |
| §2 — workflow declares minimal permissions | **PASS** — `permissions: contents: read`, and no publish/deploy/branch-write step exists |
| §1 — runs on every PR and every push to `main` | **PASS** |
| Tooling confined to `.github/`, no root `package.json` | **PASS** |
| Node pinned to 24 | **PASS** — `actions/setup-node@v5`, `node-version: 24` |

**§3.2 is now MET.** PR #2 is open and CI ran green on `ubuntu-latest`. The real
run also closed **F12** — the CI-only browser path (`channel: 'chromium'`, never
taken locally because local runs set `PUPPAD_CHROMIUM`) executed for the first
time and passed. Two things worth recording from that run, because they are
independent confirmation rather than a repeat of my own evidence:

- **Check 3's base resolution works in the real environment**: on a `pull_request`
  event it resolved `merge-base(41994076, HEAD)` against GitHub's merge ref — the
  case that matters and the one I could only simulate in scratch repositories.
- **Check 4's determinism reproduced exactly on different hardware**: `3`
  third-party requests blocked and `3` third-party console errors ignored, the
  same figures as every local run, with the service worker `active` and the page
  `controlled by it after reload`.

---

## §3.3 — the four red demonstrations

Each break was applied to the working tree, the check run, and the break reverted;
`git diff` confirmed clean after each. Protected surfaces are byte-identical to
`origin/main` at HEAD.

### Check 1 — syntax

- **Break:** `index.html:1741`, `function updateUI() {` → `function updateUI( {`
- **Failing step:** *Check 1 — every .js and the inline script of index.html parse*
- **Output:**
  ```
  CHECK 1 FAILED — 1 unit(s) did not parse:
  --- index.html (inline script, line 39) ---
  index.html:1742
    var gc = state.active ? state.active.glow : '#00ff88';
        ^^
  SyntaxError: Unexpected identifier 'gc'
  ```
  Exit 1. **Note the line number is `index.html:1742` — the real file line**, not
  an offset into an extracted fragment. That is what the blank-line padding in
  `check-syntax.mjs` buys, and it is the difference between a usable failure and
  "there is an error somewhere in 1,900 lines".
- **Revert:** restored; `git diff -- index.html` empty; check green.

### Check 2 — asset manifest

Demonstrated red in **both** directions, because the two are different defects.

- **Break 2a (a reference appears):** inserted `var _future = './games/gyre.js';`
  at `index.html:1935` — deliberately the shape `PUP-WO-0200` will actually
  introduce.
  ```
  CHECK 2 FAILED — 1 local asset(s) referenced but not in sw.js's urlsToCache:
    games/gyre.js
      referenced by: index.html string literal
  ```
- **Break 2b (a cache entry disappears):** deleted the `icon-512.png` line from
  `urlsToCache`.
  ```
  CHECK 2 FAILED — 1 local asset(s) referenced but not in sw.js's urlsToCache:
    icon-512.png
      referenced by: manifest.json icons[].src
  ```
- **Failing step:** *Check 2 — every local asset index.html references is in urlsToCache*
- **Revert:** both restored; `index.html` and `sw.js` diff empty; check green.

### Check 3 — cache identity

Eleven scenarios in throwaway repositories. The five that matter as red/green
pairs:

| Scenario | Expected | Result |
|---|---|---|
| cached asset changed, no bump | RED | `CACHE_NAME is still "v1"` — exit 1 |
| same change **with** bump | GREEN | exit 0 |
| docs-only change | GREEN (no false red) | exit 0 |
| `urlsToCache` entry **removed**, no bump | RED | `the urlsToCache list itself changed` — exit 1 |
| PR range: asset change and bump in **separate commits** | GREEN | merge-base spans both |

- **Failing step:** *Check 3 — CACHE_NAME changed when a cached asset changed*

### Check 4 — headless load

- **Break 4a (uncaught exception):** inserted `nonexistentFunction();` into the
  init block at `index.html:1930`.
  ```
  CHECK 4 FAILED — 1 error(s) originating in PupPad's own code:
    [uncaught exception] page script
      ReferenceError: nonexistentFunction is not defined
  ```
- **Break 4b (console.error, execution continues):** inserted
  `console.error('deliberate same-origin error');` at the same point.
  ```
  CHECK 4 FAILED — 1 error(s) originating in PupPad's own code:
    [console.error] http://127.0.0.1:42217/index.html:1929
      deliberate same-origin error
  ```
  Service worker still `active` in this one — proving the two failure modes are
  distinguished rather than collapsed.
- **Failing step:** *Check 4 — the console opens clean over HTTP, with no network*
- **Revert:** restored; `git diff -- index.html` empty; check green.

**One ordering defect found and fixed during this demonstration.** The first run of
4a reported *"the service worker did not register"* rather than the
`ReferenceError`. Both were true — the exception at `:1930` aborts the script
before the registration at `:1935` — but the check named the **symptom**, not the
cause. The report order now puts own-code errors before the service-worker
verdict. A check that misdirects the person reading its log is only half a check.

---

## §3.4 — check 4's determinism, and what it cannot distinguish

**Mechanism.** Every request whose URL is not the local origin is aborted at the
driver (`check-load.mjs`, the `context.route('**')` handler). The run touches no
network at all, so the third-party outcome is *identical on every run* rather than
merely usually fine. What remains is judged by origin:

- `pageerror` → always fails. With third parties blocked, the only script that
  executes is PupPad's own.
- console `error` with a same-origin location → fails.
- console `error` with a foreign location → ignored, and **reported with a count**
  so the evidence is visible rather than implied.

**Evidence.** Three consecutive runs on the unmodified tree:

```
run 1: exit=0 | blocked=3 | ignored-3p-errors=3 | CHECK 4 PASSED
run 2: exit=0 | blocked=3 | ignored-3p-errors=3 | CHECK 4 PASSED
run 3: exit=0 | blocked=3 | ignored-3p-errors=3 | CHECK 4 PASSED
```

The three ignored errors are exactly the ones a naive check would go red on:

```
ignored  https://cdn.jsdelivr.net/.../supabase.min.js:0   Failed to load resource: net::ERR_FAILED
ignored  https://cdnjs.cloudflare.com/.../leaflet.min.css:0 Failed to load resource: net::ERR_FAILED
ignored  https://cdnjs.cloudflare.com/.../leaflet.min.js:0  Failed to load resource: net::ERR_FAILED
```

**Residual risk — stated, not claimed away:**

1. **It exercises PupPad without Leaflet and Supabase present.** That is a real
   configuration — invariant 3 requires the app work with no network — but it is
   not the only one. **A defect that appears only when Leaflet HAS loaded is
   invisible to this check.** This is the largest gap and it does not close until
   `PUP-WO-0600` vendors the libraries.
2. **If PupPad's own code throws *because* a third-party global is missing, this
   goes red and points at `index.html`.** That is the correct verdict under
   invariant 3, but the message names the symptom rather than the missing
   dependency. Worth knowing before someone debugs it.
3. **It loads the console; it does not press the buttons.** Nothing behind a tap
   is covered — including the un-closable-overlay trap
   (`docs/findings/PUP-WO-0000.md` §1.6), which is `PUP-WO-0600`'s.
4. **One same-origin exclusion exists**: `/favicon.ico`, matched by exact URL. The
   browser requests it unprompted for every document and PupPad never references
   it, so its 404 is not "an error originating in PupPad's own code". It is still
   reported in the log. The exclusion is one exact path, not a pattern.

---

## The adversarial pass

Run as a black-box task per WO §5 and architecture §5: a fresh, context-isolated
subagent given the artifact and the ground truth and none of my reasoning.
**Verbatim prompt and unedited output: `docs/findings/PUP-WO-0100-adversarial.md`.**
This section is the summary; that file is the evidence. Neither summarises the
other's job.

**It found fifteen defects, four of them serious, and it demonstrated rather than
reasoned almost all of them.** It also retracted one finding after testing it in a
real browser and discovering the code was right and its reasoning wrong — which is
the behaviour that makes the other fourteen worth taking seriously.

### I broke the freeze rule I asked for, and it cost part of the review

WO §5(a) and architecture §5 require the artifact frozen before dispatch. I froze
`.github/` at `413c833` and then **rewrote `docs/FEEDBACK.md` while the pass was
running.** Two consequences, both mine:

1. Ground truth moved under a reviewer told it would not.
2. At `413c833`, `docs/FEEDBACK.md` was still `PUP-WO-0000`'s — so **§3.3's red
   demonstrations and §3.4's determinism justification were not in the frozen
   artifact and went unreviewed.** The two things the WO most wanted scrutinised
   were the two things the reviewer could not see.

I asked for this rule after `PUP-WO-0000` paid for it, and then half-kept it. Next
time the freeze covers every file the WO names as a deliverable, not just the code.

### Disposition of all fifteen

Reviewer's numbering. Nothing waved off; where I disagreed I say so.

| # | Finding | Verdict | What changed |
|---|---|---|---|
| **F1** | Check 1 parsed the inline script as **CommonJS**, so top-level `return` — which real Chromium refuses to execute the whole script over — passed green | **Accepted. The most serious defect found.** | Classic scripts now parse via `vm.Script`, which is true global-script mode; modules still via `node --check` on `.mjs`. Verified both ways: `node --check` accepts `return;`, `vm.Script` rejects it with `Illegal return statement`, matching the browser. Reviewer's exact repro now fails at `index.html:1939`. |
| **F2** | Check 4 blind to the entire service worker; the comment named the gap and the code did nothing | **Accepted — and the reviewer's suggested fix does not work.** | I tried all three routes: `worker.on('console')` is not an API; `context.on('console'\|'weberror')` delivers page output only (verified silent for a `console.error` and a throw in `sw.js`); CDP refuses a Worker (`expected Page or Frame`) and browser-level `Target.setAutoAttach` attaches but Playwright's `CDPSession.send` takes no `sessionId`, so `Runtime.enable` cannot be routed. **Playwright 1.56.1 cannot observe it.** So: the false comment is gone, the limit is stated in the file and below, and I added the coverage that *is* reachable — a controlled reload asserting the worker actually takes control. Raised upward as F16. |
| **F3** | Check 2's extensions missed video and modern audio entirely; manifest `shortcuts`/`screenshots` unread; `srcset` unparsed; a concatenation produced a bogus `.png` | **Accepted in full** | Extension list widened (mp4, webm, m4a, aac, flac, opus, mov, wasm, yaml, csv, xml, vtt…); `srcset`/`imagesrcset` parsed per-descriptor; `poster` and `data` attributes read; manifest `screenshots[]`, `shortcuts[].icons[]`, `shortcuts[].url` read; concatenation fragments diverted to a reported "unresolvable" list instead of becoming a bogus requirement. All ten of its shapes now caught or reported. |
| **F4** | Check 3 passed green **and printed a false success line** whenever the base's `sw.js` was unreadable | **Accepted — and the two sub-cases needed splitting** | `sw.js` **absent** at base → pass, with an accurate message ("no previous cache generation to invalidate; nothing was compared"), because there genuinely is no stale cache. `sw.js` **present but `CACHE_NAME` unparseable** → **fail**, symmetric with the HEAD guard, because a prior cache exists and cannot be verified. Both demonstrated. |
| **F5** | Check 4 sees nothing after 3s; `startPolling()`'s later ticks are outside the window | **Accepted as a limit** | Declared explicitly as limit 4 in the file header. Not closed — extending the window trades run time for a class of defect the check was never scoped to catch. |
| **F6** | Check 2 would go **unfixably red** on `import(\`./games/${id}.js\`)` — the idiomatic shape invariant 6 makes inevitable | **Accepted. This was the best find of the pass.** | Template placeholders are now excluded from the must-cache set and **reported as unresolvable**, so the blind spot is visible rather than either silent or unsatisfiable. Verified: the exact repro is green and the dynamic reference is printed. |
| **F7** | Check 1 false-red on a `<script>` inside an HTML comment | **Accepted** | The extractor now computes comment ranges and skips scripts inside them. Verified against the reviewer's repro. |
| **F8** | `\b` matched after a hyphen, so `data-src`/`data-type` silently unchecked a whole script | **Accepted** | `(?<![\w-])`. Verified: a second script hidden behind `data-src`/`data-type` is now parsed and its syntax error caught. |
| **F9** | `blob:`/`data:` URLs from our own origin classified foreign | **Accepted** | `isOurs` now recognises `blob:<origin>` and `data:`. Latent rather than live, fixed anyway — it is one line and it is a misclassification in the unsafe direction. |
| **F10** | `cancel-in-progress` on `push: [main]` can leave the live commit with **no** verdict | **Accepted** | Now `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Cancels superseded PR runs; never cancels a run on `main`. |
| **F11** | Unguarded `statSync` — a broken symlink crashes check 1 with a raw stack trace | **Accepted** | Guarded; unreadable entries are skipped with a named message. |
| **F12** | The CI browser path (`channel: 'chromium'`) has never been executed | **Accepted — now CLOSED** | Correct at the time: every local run sets `PUPPAD_CHROMIUM`. Run [33460652731](https://github.com/ikthys777/PupPad/actions/runs/33460652731) took that branch for real on `ubuntu-latest` and check 4 passed, with the same 3-blocked / 3-ignored determinism figures as every local run. No longer asserted; verified. |
| **F13** | Two inline scripts sharing global lexical scope (`let x` twice) is invisible | **Accepted as a limit** | Real, and unreachable without linking the scripts into one parse. Recorded; not closed. Only bites once a second inline script exists, which nothing currently plans. |
| **F14** | Check 3 leaked a raw `fatal:` line on a *passing* run | **Accepted** | `git show` stderr is now piped. A green run that prints `fatal:` teaches people to ignore `fatal:`. |
| **F15** | The favicon exclusion was URL-shaped rather than initiator-shaped | **Accepted** | Now conditioned on the document not declaring `<link rel="icon">`. If PupPad ever adds one and the file is missing, that is a real uncached asset and is no longer excused. |

**Its Probe 4 conclusion I accept without change:** no write, publish or leak path
exists, and choosing `pull_request` over `pull_request_target` is the load-bearing
security decision. Its one residual — a fork PR gets sudo-capable execution on an
ephemeral runner via `--with-deps` — is compute abuse rather than compromise, with
no secrets and a read-only token, and GitHub's first-time-contributor gate covers
it. Recorded, not blocking.

**Its Probe 5 conclusion:** the central claim survived attack. A regex is correct
for finding the end of a script element because the HTML tokenizer does not
understand JavaScript. Sixteen hostile cases; the closing scan held in every one.
What broke was everything *around* it — F7 and F8 — both now fixed.

---

## Findings — upward

### F16 — Check 4 cannot see inside the service worker, and the tooling cannot make it
*(Ruled by CC-A into `PUP-WO-0101`'s scope, which opens `sw.js` for `CACHE_PREFIX` anyway.)*
- **Where:** `.github/ci/check-load.mjs`; `sw.js` entire
- **Type:** risk
- **Detail:** `sw.js` is one of two code files in the repo and the mechanism behind invariant 3. Playwright 1.56.1 exposes no route to its console output or uncaught exceptions — three attempts documented above and in the file. What *is* covered: `sw.js` is parsed by check 1 in true classic-script mode; a worker that fails to install or activate is caught (a `urlsToCache` entry pointing at a missing file fails `cache.addAll` — demonstrated); and the page is now verified to end up **controlled** by the worker. The residual gap is a runtime error inside a worker event handler that does not prevent activation. I demonstrated that a throwing `fetch` handler is **not** caught, because the browser falls back to the network.
- **Recommendation:** either accept the gap explicitly, or `PUP-WO-0101` — which is opening `sw.js` anyway for `CACHE_PREFIX` — drives the worker over a raw CDP WebSocket instead of through Playwright's wrapper. I did **not** build that here; it is a driver change, not a check, and it is outside this WO.
- **Decision needed:** **yes**

### F17 — `index.html` has no `favicon.ico`, so every load logs a 404
- **Where:** `index.html` (no `<link rel="icon">`), observed in every check-4 run
- **Type:** note
- **Detail:** cosmetic, and it is why check 4 needs a favicon exclusion at all. Not fixed: `index.html` is a protected surface and WO §4 ranks the rule above the improvement.
- **Decision needed:** no

### F18 — RESOLVED: the PR is open, §3.2 and F12 are closed — and my diagnosis of the blocker was wrong
- **Where:** `~/bin/gh` (the `gh-router` shim), line 65
- **Type:** bug (in my own diagnosis, and in a documented workaround)
- **What I claimed:** that the S25-minted installation token lacked `pull_requests: write`, on the evidence that `git push` succeeded while both `POST /repos/.../pulls` and the GraphQL mutation returned 403 *Resource not accessible by integration*.
- **What is actually true:** the shim ends with `exec env GH_TOKEN="$tok" "$REAL_GH" "$@"` — it **unconditionally overwrites `GH_TOKEN` with its own read-only token.** Every `gh` call I made went out as `clearforge-ghread[bot]`, which is read-only by design, so both 403s were the shim's identity and said nothing whatever about my token. The push succeeded precisely because it bypassed the shim, using raw `git` with an explicit auth header.
- **Why I got it wrong:** the two 403s were consistent with my hypothesis and I stopped there instead of testing the one thing that would have separated the hypotheses — running the same call against `gh.real` directly. Two agreeing symptoms are not a confirmation when both share an untested common cause.
- **Consequence for the operating contract:** the global `CLAUDE.md` instruction *"Same for `gh`: pass the minted token via `GH_TOKEN=$TOKEN gh ...` so the shim's read-only creds don't win"* **does not work against this shim** — the shim wins. The working form is `GH_TOKEN=$TOKEN $HOME/bin/gh.real ...`. That is the operator's file to amend, not mine; flagged rather than edited.
- **Decision needed:** no — but the `CLAUDE.md` correction is worth making.

### F19 — the checks execute PR-branch code, which is correct but worth stating once
- **Where:** `.github/workflows/ci.yml`
- **Type:** note
- **Detail:** raised by the adversarial pass. `pull_request` (not `pull_request_target`) means fork PRs run with no secrets and a read-only token, which is the right call. A fork PR still gets arbitrary sudo-capable execution on an ephemeral runner via `npx playwright install --with-deps`. Compute abuse, not compromise.
- **Decision needed:** no

---

## What did not work, and why

- **Making check 4 see the service worker.** Three routes, all dead ends against
  playwright 1.56.1 (F2/F16). I stopped and declared the limit rather than
  shipping the comment that claimed coverage — which is precisely what the
  reviewer caught me doing the first time. **A false comment about coverage is
  worse than an absent check**, because the check still looks like it covers the
  thing.
- **Claiming the controlled reload catches fetch-handler defects.** I added the
  reload expecting it to. I then tested two defects — a throwing handler and one
  serving a broken response — and **both stayed green**: a throwing handler falls
  back to the network, and the reload is served by the already-controlling worker
  rather than the newly-installed one. The comment now says what it actually
  proves, which is narrower: that a worker reaches control at all.
- **The first Chromium download** was killed at a tool timeout and left a
  half-extracted directory that failed with a misleading "browser not installed"
  message. Cost about twenty minutes. The check now honours `PUPPAD_CHROMIUM` so a
  machine with a Chromium already installed does not need the download at all —
  which is also what exposed F12, since that override means the CI branch is never
  taken locally.
- **`NODE_PATH` in the workflow did nothing.** ESM ignores it; `playwright`
  resolves because `check-load.mjs` sits next to `.github/ci/node_modules`. Removed
  rather than left implying a dependency that does not exist.

## What was deliberately not done

- **No application code changed.** F17 and the un-closable-overlay trap are real
  and both were left alone. WO §4 and §0: the protected-surface rule is what makes
  this diff safe to merge without a firebreak, so breaking it to fix a 404 would
  remove the property that permits the merge.
- **No publication, no branch writes, no Pages build-type change.** `PUP-WO-0101`
  and Scotty's respectively.
- **No `CACHE_PREFIX` work.** Check 3 asserts `CACHE_NAME` *changed*; it does not
  restructure how caches are named or reaped. Architecture §6, owned by `0101`.
- **No linting or formatting checks.** Four checks, each red for exactly one
  reason. A style check bundled in makes every red ambiguous.
- **No fix for F13** (two inline scripts sharing lexical scope). Unreachable
  without linking both scripts into a single parse, and nothing currently plans a
  second inline script. Recorded as a limit.

## One thing I would push back on

**F16 should not be quietly accepted.** The other fourteen findings are closed or
declared, but this one leaves `sw.js` — the file northstar invariant 3 depends on
— with runtime behaviour that no check watches. It is tempting to let it ride
because the workflow is green and the gap is narrow. That is exactly the shape of
"looks like coverage" this work order exists to prevent, and it is worth a ruling
rather than an omission, ideally while `PUP-WO-0101` has `sw.js` open anyway.
