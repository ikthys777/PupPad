# PUP-WO-0100 — adversarial pass, verbatim record

**Artifact reviewed:** commit `413c833` on `build/wo-0100` — frozen before dispatch,
per architecture §5 and work order §5(a).
**Reviewer:** a fresh, context-isolated subagent given the artifact and the ground
truth and none of the builder's reasoning.
**Dispositions:** `docs/FEEDBACK.md`. This file is the evidence; that file is the
summary. Neither summarises the other's job (architecture §5, ratified 2026-09-01).

> **The freeze was partial, and the reviewer caught it.** `.github/` — the artifact
> under review — was byte-identical to `413c833` throughout, so the review's
> subject did not move. But `docs/FEEDBACK.md` was rewritten *during* the run, and
> at `413c833` that file was still `PUP-WO-0000`'s, which means the §3.3 red
> demonstrations and the §3.4 determinism justification **were not in the frozen
> artifact and the reviewer could not review them.** That is a builder error. The
> rule exists because I paid for it on `PUP-WO-0000` and asked for it to be
> ratified; I then half-kept it. Recorded here rather than in a footnote.

---

## The prompt, verbatim

````text
You are an adversarial reviewer. Your job is to find what is WRONG. You have no stake in this working and you did not write it. Nobody will explain their reasoning to you — you have the artifact and the ground truth, deliberately.

THE ARTIFACT IS FROZEN at commit 413c833e75773051a8e7c76786e40559a31bd3e2 in the git repository at /home/ikthys777/worktrees/PupPad/builder (branch build/wo-0100). It will not change while you work. Read it with `git show 413c833:<path>` or just read the working tree, which is identical to that commit — verify with `git status --short` (expect empty) and `git rev-parse HEAD`.

FILES UNDER REVIEW:
  .github/workflows/ci.yml            the workflow
  .github/ci/check-syntax.mjs         check 1
  .github/ci/check-assets.mjs         check 2
  .github/ci/check-cache-name.mjs     check 3
  .github/ci/check-load.mjs           check 4
  .github/ci/lib/inline-script.mjs    shared extractor used by check 1
  .github/ci/package.json + package-lock.json

GROUND TRUTH to check them against (read-only — do NOT modify any file in the repo):
  index.html      1942 lines, the app. All behaviour is in ONE inline <script> starting line 39.
  sw.js           43 lines, the service worker. CACHE_NAME on line 1, urlsToCache lines 2-8.
  manifest.json
  docs/work-orders/PUP-WO-0100.md     what was asked for. READ THIS — especially §1, §3, §3.4, §5.
  docs/northstar.md                   invariants, cited by number
  docs/architecture.md                §5 and §6 in particular
  docs/findings/PUP-WO-0000.md        prior investigation; §6 is the sw.js contract

CONTEXT: PupPad is a single-file offline PWA — a pretend console for a three-year-old who cannot read. It has NO build step and NO dependencies. Merging to main publishes straight to the child's tablet within a minute, because no CI exists yet. This workflow is the first half of the firebreak. index.html:11-13 load Supabase and Leaflet from third-party CDNs, and index.html:1373 fetches OpenStreetMap tiles — that is why check 4's determinism is hard.

The stakes: a check that cannot go red is worse than no check, because it looks like coverage. That is the thing you are hunting.

YOU MAY RUN THE CHECKS. They work locally:
  cd /home/ikthys777/worktrees/PupPad/builder
  node .github/ci/check-syntax.mjs .
  node .github/ci/check-assets.mjs .
  node .github/ci/check-cache-name.mjs .
  TMPDIR=$HOME/pw-tmp PUPPAD_CHROMIUM=/usr/bin/chromium-browser node .github/ci/check-load.mjs .
Check 4 takes ~15s. If you want to test a check against a broken tree, COPY the repo to a temp directory under /tmp and break the copy — never modify the real working tree. If you do accidentally modify it, restore with `git checkout -- <path>` and say so in your report.

RUN THESE PROBES. Report what you actually did for each.

**PROBE 1 — find a check that cannot go red. This is the highest-value attack.**
For each of the four checks: construct a defect of the class it claims to catch, confirm it catches that, and then find a defect OF THAT SAME CLASS THAT IT MISSES. Do not stop at the happy path — the author already tested the obvious breaks. Specifically:
- Check 1 claims to catch syntax errors in every .js and in the inline script. What syntactically-invalid thing does it not see? Consider: a second inline script, a script with an unusual type attribute, code inside an event-handler attribute, a file extension it doesn't walk, module-vs-script mode confusion.
- Check 2 claims every local asset referenced by index.html is in urlsToCache. WHAT ASSET-REFERENCE SHAPE DOES THE SCANNER NOT SEE? This is the one the work order calls out by name. Think about how a real change would introduce an asset.
- Check 3 claims CACHE_NAME changed whenever a cached asset changed. Find the commit/PR shape where a cached asset changes and it stays green.
- Check 4 claims to fail on errors in PupPad's own code. Find an error in PupPad's own code that it does not see.

**PROBE 2 — attack check 4's determinism (work order §3.4).**
It aborts every non-local request at the driver and judges console errors by origin. Attack that. Can it still be made to fail for a reason unrelated to the change under review? Is the origin classification correct in every case — what about errors with no location, errors from the service worker, errors thrown inside a blocked script's onerror handler, redirects, or a same-origin URL that isn't PupPad's code? It ignores /favicon.ico by exact URL match — is that sound or a hole? Does blocking the CDNs change the app's behaviour so much that the check is testing a configuration nobody ships?

**PROBE 3 — attack check 3's base ref.**
The author claims to have tested force-push, root commit, shallow clone, merge-base, and a moved base. Verify those claims by running them yourself in a temp repo. Then find the case they did NOT test. Consider: merge commits, a PR whose base branch is not main, `github.event.before` on a brand-new branch, a PR from a fork, squash-merge, and what happens when sw.js does not exist at the base.

**PROBE 4 — try to make the workflow publish, write, or leak.**
It declares `permissions: contents: read`. Can any step still write to the repo, push, open a PR, or exfiltrate anything? Look at the whole supply chain: pinned action versions, `npm ci`, `npx playwright install --with-deps` (what does --with-deps do, and does it need sudo?), the lockfile, and whether any step runs code from the PR branch itself. Note that a `pull_request` trigger on a public repo runs untrusted contributor code — is that a problem here, and does the workflow's trigger choice matter?

**PROBE 5 — the hostile inline script.**
Check the extractor in lib/inline-script.mjs against: a `</script>` inside a string literal, inside a regex literal, inside a template literal; `<script>` inside an HTML comment; nested template literals; a script with `type="module"`; two inline scripts; an unclosed script tag. The author claims a regex is CORRECT here because the HTML tokenizer does not understand JavaScript. Is that claim right? Test it — write the hostile cases into a temp HTML file and run the extractor on them.

ALSO report: anything in the workflow that would fail on a real GitHub runner but works locally; any claim in a code comment that the code does not actually do; scope violations against work order §4; and anywhere the author asserts something as verified that they appear to have assumed.

OUTPUT: findings first, most serious first. For each — what is wrong, where (file:line), why it matters, how confident you are, and whether you demonstrated it or reasoned it. Then a short record per probe of what you actually did. Then one line: is this workflow safe to merge and does it deliver four checks that can each go red?

Be blunt. Do not soften. Do not pad with praise. If a check is genuinely sound, say so in one line and move on.
````

---

## What it returned, unedited

Reproduced exactly as received, fenced so nothing in it can be confused with this
document's own structure. Its finding numbers **F1–F15 are the reviewer's own** and
are what `docs/FEEDBACK.md`'s disposition table refers to. They are a separate
numbering from that file's upward findings.

`````text
The real worktree's `.github/` artifact is intact. Note: `docs/FEEDBACK.md` became dirty during my run — **I did not write to the real repo at all** (every mutation went to `/tmp/adv/*`). Someone else edited it concurrently; flagged below.

---

# FINDINGS

## F1 — Check 1 parses the inline script in CommonJS mode, not classic-script mode. A real browser SyntaxError passes green. **DEMONSTRATED. Highest severity.**

`check-syntax.mjs:56,72` chooses `.cjs` for anything non-module. `.cjs` is not "script semantics" — it is the CommonJS **function wrapper**, which legalises constructs a browser classic script rejects. Top-level `return` is the concrete one.

```
D1: inserted `return;` at index.html:1939 (top level of the one inline script)
  CHECK 1 PASSED — 1 .js file(s) + 1 inline script(s) parse.        exit=0
Same tree, check 4:
  CHECK 4 FAILED — [uncaught exception] SyntaxError: Illegal return statement
```

Real Chromium refuses to execute the entire 1,902-line script; check 1 — whose *only* job is "the inline script parses", and which the WO §1.1 calls "the hard half" — says ok. The comment at `check-syntax.mjs:33` ("`ext` picks script (.js/.cjs) vs module (.mjs) semantics") asserts a distinction the code does not make. Same applies to `sw.js`, also parsed as `.cjs`.

Fix direction: `vm.Script` with `new vm.Script(src)` parses in true global-script mode, or `node --check` after wrapping the source so top-level `return` is illegal. Confidence: high, demonstrated on both sides.

## F2 — Check 4 is blind to the entire service worker. **DEMONSTRATED.**

`check-load.mjs:135-138`. The comment states the problem — *"Service worker script errors do not surface on the page"* — and then attaches a handler that only prints the worker's URL. Nothing is captured.

```
Run A: injected into sw.js:
  console.error('SW-CONSOLE-ERROR-CAN-YOU-SEE-ME');
  setTimeout(function(){ throw new Error('SW-UNCAUGHT-THROW'); }, 500);
  CHECK 4 PASSED — console clean of same-origin errors; service worker active.   exit=0
```

`sw.js` is one of exactly two code files in this repository and is the mechanism behind invariant 3. A comment that names a gap and mitigates nothing is the "looks like coverage" failure the WO is built to prevent. Playwright exposes `worker.on('console')` / `worker.on('pageerror')` on the `ServiceWorker` object the handler already receives.

**Credit where due:** I predicted a related hole and was wrong — a failing `install` (a `urlsToCache` entry pointing at a nonexistent file) **is** caught, via `swState === 'none'` at `check-load.mjs:185`. That guard is genuinely load-bearing.

## F3 — Check 2's extension allowlist and manifest coverage miss ~10 realistic asset shapes. **DEMONSTRATED.**

The WO (§5) asks specifically: *what asset reference shape does the scanner not see?* The author's header comment (`check-assets.mjs:21-28`) names exactly one — runtime-assembled paths. There are many more, and the most likely next asset for a toddler's sound-and-video console is in the list.

I injected 13 new local references. **5 caught, 8 silently missed:**

| Reference | Result |
|---|---|
| `<source src="intro.mp4">` | **MISSED** — `mp4` not in `ASSET_EXT` (`check-assets.mjs:48`) |
| `<source src="intro.webm">` | **MISSED** — `webm` absent (`webp` is present; easy to misread as covered) |
| `<audio src="sounds/bark.m4a">` | **MISSED** — `m4a` absent |
| `new Audio("sounds/woof.aac")` | **MISSED** — `aac` absent |
| `fetch("./config")` | **MISSED** — extensionless URLs are unrepresentable |
| `fetch("./levels.yaml")` | **MISSED** — `yaml`/`txt`/`csv`/`xml`/`wasm` absent |
| `manifest.json` → `shortcuts[].icons[].src` | **MISSED** — only `icons` and `start_url` read (`:87-88`) |
| `manifest.json` → `screenshots[].src` | **MISSED** — same |
| `srcset="hero-1x.png 1x, hero-2x.png 2x"` | **MISSED** — path is not the whole quoted string |
| `"sprites/" + "dog" + ".png"` | produced a bogus entry **`.png`** — false positive, real path missed |

`ASSET_EXT` covers `mp3|ogg|wav` — 1990s audio — and no video at all. Confidence: high, demonstrated.

## F4 — Check 3 passes green, and prints a false statement, whenever it cannot read the base's `sw.js`. **DEMONSTRATED.**

`check-cache-name.mjs:117`: `if (nameBase !== null && nameHead === nameBase)`. When `nameBase` is `null` the failure branch is skipped entirely and control falls to the success line, which then prints `CACHE_NAME changed to "<X>"` — a claim the code never established.

```
S1: sw.js absent at base; HEAD reintroduces it and changes index.html; CACHE_NAME never bumped.
  fatal: path 'sw.js' exists on disk, but not in 'bdd45133'
  CACHE_NAME: (absent at base) -> pup-v1
  CHECK 3 PASSED — cached asset(s) changed: index.html, and CACHE_NAME changed to "pup-v1".   exit=0
```

`nameBase` is `null` whenever `sw.js` is missing, empty, or its `CACHE_NAME` is not a plain-quoted literal at the base revision — e.g. a future `` const CACHE_NAME = `pup-v${N}` ``. Note the asymmetry: an unparseable `sw.js` at **HEAD** fails loudly (`:93`); the identical condition at **base** passes silently. That is backwards. The header comment's stated resolution order documents the root-commit pass but not this one.

## F5 — Check 4 sees nothing after 3 seconds. **DEMONSTRATED.**

`check-load.mjs:54,147`.
```
Run B: setTimeout(function(){ console.error('LATE-CONSOLE-ERROR'); throw new Error('LATE-THROW'); }, 6000);
  CHECK 4 PASSED    exit=0
```
`index.html:1931` calls `startPolling()` at boot. A throw on the second poll tick, or in any deferred timer, is invisible. The header's declared limit ("cannot see anything that needs interaction") does not cover this — no interaction is required, only patience. Not fatal, but it is an undeclared boundary on a check whose blind spots the WO required be stated.

## F6 — Check 2 will go **unfixably red** on the next work order. **DEMONSTRATED.**

Northstar invariant 6 is "adding a game touches its own module, one registry entry, one manifest line." The idiomatic dynamic import for that is a template literal:

```
D6: function loadGame(id){ return import(`./games/${id}.js`); }
  CHECK 2 FAILED — 2 local asset(s) referenced but not in urlsToCache:
    games/dig.js          <- correct
    games/${id}.js        <- cannot be satisfied; no urlsToCache entry can ever match
```

Rule (c) (`:78`) matches `[^'"`\n]*` inside backticks, so `${` and `}` sail straight through. The only ways to green are to delete the template literal or to add a literal `./games/${id}.js` line to `sw.js`. Per the WO's own logic ("a check that is red on arrival gets disabled, not fixed"), this is the muting pressure — arriving one work order late instead of on day one. Confidence: high.

## F7 — Check 1 goes red on a `<script>` inside an HTML comment. **DEMONSTRATED.**

```
D4: <!-- TODO(PUP-WO-0600): vendored bundle goes here
       <script>window.__vendored = ??? </script> -->
  CHECK 1 FAILED — index.html (inline script, line 40): SyntaxError: Unexpected token '??'
```
`lib/inline-script.mjs:19` scans for `<script` with no comment awareness. Commenting out a script block is an entirely ordinary thing to do in HTML, and it is a false red on code no browser will ever execute. Same class as F6: pressure to mute.

## F8 — The extractor's attribute matcher is prefix-blind; a `*-src` or `*-type` attribute silently unchecks a whole script. **DEMONSTRATED both sides.**

`lib/inline-script.mjs:29` builds `\bsrc\s*=` / `\btype\s*=`. `\b` matches after the hyphen, so `data-src=` reads as `src=` (skipped as external at `:54`) and `data-type="bootstrap"` reads as `type="bootstrap"` (skipped as non-JS at `:56`).

```
D3: a second inline script <script data-src="deferred-flags" data-type="bootstrap">
      containing `var FLAGS = ((( BROKEN`
  CHECK 1 PASSED    exit=0
Browser control: `<script data-src="x" data-type="y">window.__B=1;</script>` -> executed: true
```
Realism is moderate (it needs a `data-*` attribute whose name ends in `-src`/`-type`), but the fix is one character — `(?<![\w-])`. On the *current* single-script file the `inline.length === 0` guard at `check-syntax.mjs:66` would catch it; add a second script and the guard is satisfied by the first one and the hidden script is never parsed.

**Retracted finding, reported for honesty:** I initially had `type="application/javascript;charset=utf-8"` as a fourth hiding mechanism. I tested it in real Chromium — it does **not** execute (the spec requires an *essence* match, so MIME parameters disqualify it). The extractor's skip is correct. My reasoning was wrong; the code was right.

## F9 — `blob:` URLs are classified as third-party and ignored. **DEMONSTRATED.**

`check-load.mjs:103`, `isOurs = url.startsWith(ORIGIN)`. A blob URL is `blob:http://127.0.0.1:PORT/...` — the prefix does not match.
```
Run E: PupPad creates a script from a Blob that calls console.error
  ignored  blob:http://127.0.0.1:46699/7361... BLOB-SCRIPT-ERROR
  CHECK 4 PASSED    exit=0
```
Filed under the WO's "a same-origin URL that isn't PupPad's code" — this is its inverse, PupPad's own code at a URL the classifier calls foreign. `data:` URLs behave the same. Not currently triggered; a latent misclassification, and cheap to fix (`startsWith(ORIGIN) || url.startsWith('blob:' + ORIGIN)`).

## F10 — `cancel-in-progress: true` on `push: [main]`. Reasoned.

`ci.yml:23-25`. Two pushes to `main` in quick succession cancel the first run. A cancelled run is neither green nor red — the commit that is actually live on Buddy's tablet can end up with **no** CI verdict. Harmless while this workflow only reports; actively dangerous the moment PUP-WO-0101 gates publication on it. Recommend scoping cancellation to PR refs only.

## F11 — Check 1 crashes with a raw stack trace on a broken symlink. **DEMONSTRATED.**

`check-syntax.mjs:27` `statSync` is unguarded.
```
D5: ln -s /nonexistent/target docs/dangling.js
  ENOENT ... syscall: 'stat' ... Node.js v24.16.0     exit=1
```
Red for the wrong reason, with no check-branded message. Low likelihood, trivial fix.

## F12 — The CI-only browser path has never been executed. Demonstrated.

`check-load.mjs:92-94`: locally `PUPPAD_CHROMIUM` is always set (it is in the WO's own local command), so `channel: 'chromium'` — the branch CI takes — is dead code locally. I forced it:
```
channel:chromium FAILED -> Executable doesn't exist at .../chromium-1194/chrome-linux/chrome
```
That specific failure is a local artefact (`playwright install chromium` on the runner installs both the full Chromium and the headless shell, so it should work). But it is an untested branch on the single line that decides which browser CI drives, and the author cannot have verified it without a real run. Classify as "asserted, not verified."

## F13 — Two inline scripts sharing global lexical scope. Reasoned, not demonstrated.

`check-syntax.mjs:69-75` parses each inline script in an isolated temp file. In a browser, classic scripts share one global lexical environment, so `let x` in script A and `let x` in script B is a redeclaration SyntaxError. Check 1 cannot see it. Only relevant once a second script exists — but that is exactly when F8 also bites.

## F14 — Check 3 leaks a raw `fatal:` git line on a *passing* run. Demonstrated (see F4 output).

`readAt` at `:72` catches the exception but `execFileSync` is not given `stdio: [...,'pipe']`, so git's stderr passes straight through. A green run that prints `fatal:` trains the reader to ignore `fatal:`.

## F15 — The favicon exclusion is URL-shaped, not initiator-shaped. Reasoned. Minor.

`check-load.mjs:109` matches `${ORIGIN}/favicon.ico` exactly. It is narrow and it is reported, which is the right instinct. But it is keyed on the thing it should not be keyed on: if PupPad ever adds `<link rel="icon" href="favicon.ico">` and the file is absent, that is a genuine missing local asset and the check will call it browser-initiated. Prefer keying on "no `<link rel=icon>` in the document" or on the request's `resourceType`.

---

# PROBE RECORDS

**PROBE 1 — a check that cannot go red.** All four **can** go red; I demonstrated each. Controls: check 1 red on a broken paren; check 2 red on 5 uncached refs; check 3 red on index.html changed with no bump (S3, S5, S6); check 4 red on `console.error` in own code (Run D), on an unhandled rejection (Run C), and on a failed SW install (T1). Then I found a miss inside each check's own stated class: F1 (check 1), F3 (check 2), F4 (check 3), F2 + F5 (check 4). Note both check-2 misses I hunted for — a real change introducing a sound or video file, and a manifest shortcut icon — are more likely in this repo than the runtime-path case the author documented.

**PROBE 2 — check 4's determinism.** The hermetic claim **holds**. Every run blocked exactly the same 3 third-party URLs; `context.route('**')` at `:113` catches everything non-local including subresources. I could not make it red for a network reason. `SETTLE_MS=1` (Run F) still reached `service worker: active` — the 3s wait is not on a knife edge, so the timing flake I expected is not there. Origin classification is correct for the CDN cases and correct for same-origin 404s; it is wrong for `blob:`/`data:` (F9) and blind to the worker (F2). `isOurs` treats a location-less error as ours — biased toward red, the safe direction. On "is this a configuration nobody ships": with the CDNs blocked, `L` is undefined, so `L.map()` at `index.html:1368` — the whole map screen — is never exercised. That is the app's most complex surface *and* the one invariant 3 is most at risk on, and check 4 structurally cannot reach it. The author declares this (note 1); I am restating it with the line number because "check 4 is green" reads much broader than it is.

**PROBE 3 — check 3's base ref.** Built a scratch repo and ran 10 scenarios. The author's claims **verify**: root commit passes explicitly (S4); force-push with an unreachable `before` falls to first parent and still goes red (S5); shallow clone fails loudly rather than skipping (S9); a `pull_request` merge-ref checkout against a moved base resolves the right merge-base and goes red (S6); an unreachable or empty base sha refuses to fall back (S7, S8); `base === head` fails rather than comparing nothing (S10). This logic is the best-built part of the artifact. The case they did **not** test is **"`sw.js` does not exist at the base"** — F4, the one green hole. Two smaller ones: a `urlsToCache` entry carrying a cache-busting query (`./index.html?v=16`) is not normalised the way check 2's `note()` normalises it, so it would be blind if the bare `'./'` entry were ever dropped (S2 stayed red only because `'./'` maps to `index.html`); and `before == after` produces a red that is arguably a false positive rather than a defect.

**PROBE 4 — publish, write, leak.** **No path found.** `permissions: contents: read` at workflow level, no job-level override, no `id-token`, no `GITHUB_TOKEN` consumer, no `gh`, no upload/deploy/artifact action, no `${{ }}` interpolated into any `run:` (the two shas go through `env:`, which is injection-safe). Lockfile is clean: 3 packages, all `registry.npmjs.org`, all with integrity hashes; the only `hasInstallScript` is `fsevents`, darwin-only and optional. Choosing `pull_request` over `pull_request_target` is the correct call and the single most important security decision in the file — it means fork PRs get no secrets and a read-only token. Residual, and I judge it acceptable: the workflow *does* execute PR-branch code (`check-*.mjs`, the PR's `package-lock.json` via `npm ci`, and `npx playwright install --with-deps` which shells out to `sudo apt-get` on the runner). A fork PR therefore gets sudo-capable arbitrary execution on an ephemeral runner. With no secrets and a read-only token that is compute abuse, not compromise, and GitHub's first-time-contributor approval gate covers it. Worth one line in FEEDBACK.md; not worth blocking. Actions are pinned to mutable major tags (`@v5`) rather than SHAs — standard practice, noted not faulted.

**PROBE 5 — the hostile inline script.** Wrote 16 cases against `extractInlineScripts` directly. **The author's central claim is correct and I could not break it.** `</script>` inside a string literal (A) and inside a template literal (C) do terminate the element — in the extractor *and* in a real browser — so check 1's resulting parse error is a true report of a genuinely broken page. A regex literal written `/<\/script>/` (B) survives intact, correctly. Nested template literals (M) survive. Escaped `<\/script>` (L) survives. Two scripts (F) both extracted with correct line numbers. Unclosed tag (G) reads to EOF and fails loudly. The `<!--`-escaped case (N) is cut short and fails loudly, which is what the declared known-limit promises. What breaks is not the closing scan but everything around it: the attribute matcher (F8), comment blindness (F7), and `<script data-x="a>b">` where `[^>]*` at `:19` stops at the `>` inside the attribute value and the body is extracted starting mid-attribute. `type=" module "` is treated as a module; Chromium executes it as neither. `JS_TYPES` contains `'module/javascript'`, which is not a real MIME type — harmless, but it is the kind of entry that suggests the list was assembled from memory rather than from the spec.

---

# ALSO

**Scope (WO §4, §2 protected surfaces) — CLEAN, verified.** `git diff --stat $(git merge-base origin/main HEAD) 413c833` touches `.github/` only, 9 files, 725 insertions, zero deletions. `origin/main` is an ancestor of HEAD and is the merge-base, so §7's moved-base condition does not apply. `index.html`, `sw.js`, `manifest.json`, and both icons diff to empty. No root `package.json`. Tooling is confined to `.github/ci/` as §1 requires.

**Comment claims the code does not honour:** `check-load.mjs:135` (F2, the clearest case — the comment names the gap, the code does nothing); `check-syntax.mjs:33` ("script semantics", F1); `check-assets.mjs:21-28` ("what this scanner cannot see" understates by roughly ten shapes, F3); `check-cache-name.mjs:6-21` (the resolution-order block documents four base cases and omits the only one that passes green, F4).

**Asserted-as-verified but apparently assumed:** the CI browser path (F12) — every documented local run sets `PUPPAD_CHROMIUM`, so `channel: 'chromium'` cannot have been exercised; and `check-load.mjs:26-27`'s "the only script that executes is PupPad's own", which is fine for `pageerror` but is contradicted for the console path by Run E.

**Process, WO §5(a).** The freeze was partial. `git status --short` was empty at the start of this review and `docs/FEEDBACK.md` is `M` at the end — 555 lines deleted, 148 added — during my run. I wrote nothing to the real repository; every mutation went to `/tmp/adv/`. The reviewed artifact (`.github/`) is byte-identical to `413c833`, so this review's subject did not move, but ground truth did — the exact condition §5(a) was written to eliminate. Separately: at `413c833`, `docs/FEEDBACK.md` is still PUP-WO-0000's, so §3.3's four red demonstrations and §3.4's determinism justification are absent from the frozen artifact and I could not review them.

---

**Verdict: safe to merge on the axis that matters — it cannot write, publish, or leak, and the scope fence holds — and yes, all four checks demonstrably go red. But do not read them as delivering the coverage they claim: check 1 misses browser syntax errors in the one script it exists to guard (F1), check 4 is blind to half the code in the repository (F2), check 3 has a green-on-unreadable-base hole (F4), and checks 1 and 2 both carry a false-red that a routine future change walks straight into (F6, F7).**
`````
