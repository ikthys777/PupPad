# PUP-WO-0100 — CI workflow: four checks that can go red

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `1690617`; **verify live HEAD**).
**Branch:** `build/wo-0100`.
**Author:** CC-A (architect) · **Builder:** CC-EM (pup-b) with subagents.
**Phase:** P1 · **Phase exit gate:** see `docs/roadmap.md` → P1. This work order
satisfies gate items **1 and 2 only**; items 3 and 4 belong to `PUP-WO-0101`.
**Grounds:** `docs/northstar.md` invariants 3, 4, 6, 7 · `docs/architecture.md`
§3, §3.1, §5, §6, §9 · `docs/roadmap.md` P1 · `docs/findings/PUP-WO-0000.md`
§6 (`sw.js` contract), §1.6 (the trap), §9.1 (registry shape) · `sw.js`,
`index.html`.

> **What this is:** the first half of the firebreak — a GitHub Actions workflow
> carrying four checks, each of which must be **demonstrated going red**. It is
> **NOT** the two-path publication (`PUP-WO-0101`), it does **not** change the Pages
> build type (Scotty's, architecture §6), it does **not** publish anything, and it
> changes no application code. Why now: architecture §3.1 measured that no CI
> exists, so `main` publishes straight to Buddy's tablet. Every later phase merges
> against a firebreak this phase builds, and roadmap §3 names P1 as the phase to
> over-review for exactly that reason.

**Cadence:** build. One PR, left unmerged for review.

**First act, before anything else:**
```
git fetch origin && git checkout -B build/wo-0100 origin/main
```
You sync your own tree; nobody reaches into it while you are running.

---

## 0. Why merging this is safe without a firebreak

Architecture §6's bootstrap exception permits a P0/P1 merge because the diff is
confined to paths GitHub Pages does not serve. `PUP-WO-0000` relied on `docs/`.
**This work order extends that property to `.github/`, and the extension is the
thing that makes it safe — not a convenience.** Pages under `build_type: legacy`
serves `main:/` as static files; it does not execute or expose `.github/`.

**Therefore: your diff must touch `.github/` and `docs/` only.** Any change to
`index.html`, `sw.js`, `manifest.json`, or either icon publishes to a live tablet
the moment this merges, with no firebreak in place. That is not a style rule; it
is the reason this work order can merge at all.

## 1. Scope

Build `.github/workflows/ci.yml`, running on **every pull request and every push
to `main`**, carrying four checks. Each check gets its own named step, so a red
run names which check failed without reading a log.

1. **Syntax.** Parse every `.js` in the repo **and the inline script of
   `index.html`** for syntax validity. The inline script is the hard half: it is
   ~1,880 lines inside one `<script>` tag with no `src`, and it is where a syntax
   error would actually land. Extract and parse it; do not skip it because it is
   awkward. Parse-only — no execution, no linting, no style opinions.

2. **Asset manifest.** Assert every **local** asset referenced by `index.html`
   appears in `sw.js`'s `urlsToCache` (`sw.js:2-8`). Local means same-origin and
   relative; the three third-party `<script>`/`<link>` tags at `index.html:11-13`
   are **not** local and must be excluded, not flagged. This check must **pass on
   the current tree** — today's five entries already cover the referenced assets.
   *(A check that is red on arrival gets disabled, not fixed.)*

3. **Cache identity.** Assert `CACHE_NAME` (`sw.js:1`) changed whenever any asset
   listed in `urlsToCache` changed. **Specify the base ref explicitly** — on a pull
   request compare against `git merge-base`, on a push to `main` against the
   previous commit — because an unstated base is how this check silently compares
   nothing. Northstar invariant 7.

4. **Headless load.** Serve the repo over HTTP (not `file://` — the service worker
   will not register otherwise, `index.html:1935`), open the console, and fail on a
   console error. See §3.4 for the determinism requirement, which is the whole
   difficulty of this check.

**Tooling placement.** The headless check needs a browser driver, which means
dependencies — and PupPad's defining property is that the shipped app has none
(architecture §5). **Confine all CI tooling to `.github/`** (e.g.
`.github/ci/package.json`). Do not create a root `package.json`: the repository
root is the deployed artifact, and a package manifest there makes "no build step,
no dependencies" false for the thing that ships. Pin `actions/setup-node` to
**Node 24**.

## 2. Invariants — restated by number

From `docs/northstar.md`, which is authoritative. The slice this WO touches:

- **3** — every core surface works with no network. Check 2 is what keeps the
  offline asset set honest as files are added.
- **4** — the copy Buddy uses advances only when a human promotes it. **This
  workflow must not publish, deploy, or write to any branch.** It reports; it does
  not act.
- **6** — adding a game touches its own module, one registry entry, one manifest
  line. Check 2 is the mechanical half of that promise.
- **7** — a device serves exactly one build's assets. Check 3 is its early warning.

**Protected surfaces — must diff to empty:** `index.html`, `sw.js`,
`manifest.json`, `icon-192.png`, `icon-512.png`. See §0 for why this one is
load-bearing rather than hygiene.

**Permissions.** The workflow declares `permissions:` explicitly and minimally —
`contents: read` unless a check demonstrably needs more. A workflow that inherits
write scope it does not use is a credential sitting in the blast radius of every
future edit to this file.

## 3. Acceptance — what must be proven, not asserted

1. `git diff main --stat` shows changes under `.github/` and `docs/` only.
2. **All four checks are green on the unmodified tree**, in a real run on the PR.
3. **Every one of the four checks is demonstrated RED**, each by its own
   deliberate break, and each break then reverted. This is the acceptance
   criterion of this work order — roadmap P1's gate items 1 and 2 require it for
   checks 1 and 2, and **I am extending it to all four**, because the lesson
   `PUP-WO-0000` paid for is that a demonstration against the cases in hand is
   necessary and not sufficient. Record, per check: the exact break, the run URL or
   captured output, the failing step name, and the revert. A check nobody has
   watched go red is indistinguishable from one that cannot.
4. **Check 4 is deterministic** — see §3.4. State plainly which failure modes it
   can and cannot distinguish.
5. The workflow file is readable by someone who did not write it: each step named
   for what it proves, not for the command it runs.

### 3.4 The determinism requirement on check 4

`index.html:11-13` load Supabase and Leaflet from two third-party CDNs, and
`index.html:1373` requests OpenStreetMap tiles at runtime. So a naive "fail on any
console error" check goes red when a CDN is slow, rate-limits a CI IP, or is
briefly down — **failures that have nothing to do with the change under review.**

This matters more than it looks. Architecture §5 ruled for a check that "cannot be
persuaded" precisely because two judgment-based reviewers correlate. A check that
goes red at random gets muted or ignored, and a muted check is worse than no check:
it looks like coverage. **A flaky check does not satisfy this work order.**

Requirement: check 4 must fail on errors originating in **PupPad's own code** and
must not fail on third-party fetch failures. Choose your mechanism and justify it
in `FEEDBACK.md` — blocking third-party origins at the driver and asserting the
console is clean of same-origin errors is one route; there are others. **State the
residual risk honestly rather than claiming determinism you did not achieve.**

Note the root cause is not yours to fix: those three CDN dependencies also
contradict northstar §5 and threaten invariant 3, and they are `PUP-WO-0600`'s
subject (roadmap P6). When that lands, this check gets simpler. Do not pre-empt it.

## 4. Scope fence — NOT in this work order

Named because they are the things most reasonable to fold in, and all are out:

- **Publication of any kind.** No `actions/deploy-pages`, no `gh-pages`, no branch
  writes. That is `PUP-WO-0101`.
- **Changing the Pages build type.** Scotty's, in repository settings; the
  Precision's `gh` is read-only (architecture §3).
- **`CACHE_PREFIX` and prefix-bounded reaping.** Architecture §6 names it and
  `PUP-WO-0101` owns it. Check 3 asserts `CACHE_NAME` *changed*; it does not
  restructure how caches are named or reaped.
- **Linting, formatting, or style checks.** Four checks, each of which can go red
  for one reason. A style check bundled in makes every red ambiguous.
- **Vendoring the CDN libraries, or touching the third-party loads.** `PUP-WO-0600`.
- **Fixing the un-closable-overlay trap** (`docs/findings/PUP-WO-0000.md` §1.6).
  Real, confirmed, and `PUP-WO-0600`'s. Log anything new you notice; fix nothing.
- **"Small obvious fixes" to `index.html` noticed while working.** Log them in
  `FEEDBACK.md`. **The protected-surface rule outranks the improvement** — and
  under §0, outranks it for a reason that reaches a three-year-old's tablet.

## 5. Adversarial pass — and a changed record format

Run by **you**, as a black-box task: a fresh subagent with no investment in the
work being sound, given only the artifact and the ground truth, and none of your
reasoning about either. Independence is context isolation, not who dispatched it.

**Two changes from `PUP-WO-0000`, both earned by it:**

**(a) Freeze the artifact first.** Commit the branch, or write the artifact to a
scratch path, and hand the subagent *that* ref. `PUP-WO-0000`'s pass reviewed a
~1,150-line document that was 1,437 lines by the time it was recorded. CC-B
declared the drift, which is why it cost nothing — but a reviewer whose subject
moved underneath it cannot answer "did it see the whole artifact," and that is the
question `CC-A` has to answer. Freeze, then dispatch.

**(b) Two artifacts, not one.** `docs/FEEDBACK.md` carries a **summary** of the
pass — findings, dispositions, what you disputed and why. The **verbatim record**
— the exact prompt and the unedited output — goes to
`docs/findings/PUP-WO-0100-adversarial.md`, committed. Ratified in architecture §5;
see §11 for why. In `PUP-WO-0000` the transcript was 341 of `FEEDBACK.md`'s 582
lines, burying the upward findings under the evidence for them. Splitting keeps the
summary readable and makes the transcript durable and citable by later work orders.
**Neither artifact may summarise the other's job:** the transcript is unedited, and
the summary states dispositions rather than reproducing the exchange.

Probe, for this work order specifically:

- **Find a check that cannot go red.** The highest-value attack here. For each of
  the four, construct a defect of the class it claims to catch and confirm it
  catches it — then look for a defect of that same class it *misses*. Check 2 in
  particular: what asset reference shape does the scanner not see?
- **Attack check 4's determinism.** Make the third-party origins fail and confirm
  the check stays green. Make PupPad's own code error and confirm it goes red.
- **Attack check 3's base ref.** Force-push, merge commit, first commit on a
  branch, a PR with no `sw.js` change, a squashed history. Which of these makes the
  comparison compare nothing?
- **Try to make the workflow publish or write.** It must not be able to.
- **Check the syntax extractor against a hostile inline script** — a `</script>` in
  a string literal, a regex containing `</script>`, nested template literals.

## 6. Upward feedback

`docs/FEEDBACK.md`, parked with the branch. **Note the path** — the root fails §3.1,
and under §0 that gate is what makes this merge safe. Ratified in `PUP-WO-0000`
review; architecture §5.

Per entry: `finding · where (file:line) · type (note|risk|scope-question|bug) ·
recommendation · decision-needed (yes/no)`.

Required sections: the four red demonstrations from §3.3 with their evidence; the
check-4 determinism justification and its residual risk (§3.4); **what did not work
and why**; what was deliberately not done; a gates line stating the
protected-surface diff status as a checkable fact.

## 7. Flag-and-stop

Park the branch and surface to CC-A rather than working around:

- **Any need to modify `index.html`, `sw.js`, or `manifest.json`** to make a check
  pass. If a check can only go green by changing the app, the check is wrong or the
  app has a defect — either way it is a ruling, not a build step. §0 explains what
  it would cost.
- A check you cannot make go red. Say so plainly rather than shipping it; an
  undemonstrable check is the failure mode this work order exists to prevent.
- Check 4 flaky and you cannot make it deterministic within scope. **Do not ship a
  flaky check and note it** — park and ask. A muted check is worse than none.
- Any need for a credential, token, or repository setting change.
- The workflow requiring `permissions:` beyond `contents: read`.

## 8. Kickoff prompt

Sent separately, thin, pointing at this file. **Do not dispatch this work order
without Scotty's word** — he reviews CC-A's first authored work order before it
goes anywhere.

## 9. Provenance

Written by CC-A (architect) 2026-09-01, the first work order authored inside the
repository rather than in the planning session. Scope is roadmap P1's
`PUP-WO-0100` line, unchanged. Three things came from `PUP-WO-0000`'s review and
are new here rather than inherited: §3.3's extension of the prove-it-red
requirement from two checks to four, §3.4's determinism requirement, and §5's
frozen-artifact and two-artifact rules.
