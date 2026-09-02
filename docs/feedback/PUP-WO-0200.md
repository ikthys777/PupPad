# PUP-WO-0200 — upward feedback

**Branch** `build/wo-0200`, based on `origin/main` `13acf9f`.
**Verbatim adversarial exchange:** `docs/findings/PUP-WO-0200-adversarial.md`.

---

## GATES — as checkable facts, not assertions

| | fact |
|---|---|
| **Fence** | **Files outside `index.html`, `games/`, `sw.js`, `.github/`, `docs/`: 0.** That is the property and it is stable. *(A raw file COUNT is not: the first version of this row said "9 files", which was true one commit earlier and 12 at the SHA that shipped it — the count excluded the feedback file making the claim. Stated as a property, plus a count that names its own subject: **14 files at `e3d1763`**.)* |
| **`manifest.json`** | diffs to empty |
| **`icon-192.png`, `icon-512.png`** | diff to empty |
| **`sw.js`** | `2` insertions, `1` deletion — one added `urlsToCache` entry and the comma before it. **`CACHE_VERSION` occurrences in that diff: 0.** |

```
-  './icon-512.png'
+  './icon-512.png',
+  './games/hello.js'
```

**Gate 1 (property, as reworded 2026-09-02).** `grep -ri power index.html` → **2**
matches: the sound-bank definition at `:84` and the deliberate `sound:'powerUp'`
reassignment at `:105`. No button label, icon, handler or registry entry names Power.

**Gate 2, run as written. The count is the evidence:**

```
 games/shapes.js | 10 ++++++++++
 index.html      |  4 +++-
 sw.js           |  3 ++-
 3 files changed, 15 insertions(+), 2 deletions(-)
```

**Exactly three things** — its own module, one registry entry, one `urlsToCache` line —
with `CACHE_VERSION` untouched. Both checks stayed green at two modules
(`scanning 2 module(s) in games/`). The second placeholder was then **reverted**: §1.4
ships one, and gate 2 is a measurement rather than a deliverable.

**Gate 4 / acceptance §3.5** — cold start, no network, proven in a browser as check 14.

**Gate 5 baseline — and it is NOT the gate's number.** Run
`node .github/ci/measure-coldstart.mjs .`; at `171083b` it reported
`116, 135, 142, 204, 224 ms`, **median 142**, five fresh contexts.

*The instrument is committed, and it was not before.* The claims audit found the first
version of this line quoted five timings and a median produced by **nothing in the
tree** — grepping the diff for those figures returned exactly one hit, the sentence
claiming them. **A measurement a reviewer cannot re-run is asserted, not measured**,
which is the whole property the word is supposed to buy.

Gate 5 asks for the number *"on the test device"* — a tablet, not this box — so this is
a reference point and a regression tripwire, and **the device measurement is Scotty's**.
The threshold stays architecture §10's open question; the gate requires the measurement,
not a verdict.

**Gate 3 — the icon — is NOT run.** See below; it needs a person.

---

## THE ICON PREDICTION, STATED BEFORE THE TEST (§1.2)

The button is 🎮 (U+1F3AE, video game controller), label `Games`, on the existing
`id:7` colours.

**My prediction:** a person who has not seen the app, shown a screenshot with all text
covered, will call it *"games"* or *"the game controller"*.

**What the naive viewer actually said: NOT YET KNOWN.** Gate 3 is a person, and I am
not one. This is recorded as an open item rather than as a pass, because the whole
point of §1.2 is that the prediction is falsifiable and the test is what settles it.

**The prediction I am least sure of, said plainly:** 🎮 is unambiguous *to an adult*.
Buddy is three and may never have seen a game controller. The label is text he cannot
read, so the icon carries the whole signal for him — and an icon that an adult names
instantly is not the same thing as an icon a non-reader recognises. If the naive
viewer says "games", gate 3 passes and invariant 1 may still be weakly served for the
actual user. The honest alternatives, if it fails: 🧩 (puzzle) or 🎲 (die), both of
which name a *kind of play* rather than a *device for playing*.

---

## §1.1 — THE CHECK INVARIANT 3 RESTS ON, AND WHY IT WAS BUILT FIRST

`PUP-WO-0000` §8.3 says, as a correction its own adversarial pass forced (F8), that
omitting `fetch` from the `api` object is *a convention and not enforcement*, and that
*"invariant 3 and architecture §5's 'strictly offline' rest on that check."* **It was
never built.** Nobody noticed because `games/` did not exist, so it would have scanned
nothing and reported success — a false green arriving before there was anything to be
green about.

### The red demonstrations — permanent CI, not a paragraph here

Written and demonstrated red **before** the first module existed. The demonstration is
**check 12**, which runs on every commit, because a demonstration written into a
feedback file is evidence about a tree that no longer exists — the architecture's freeze finding
(`architecture.md:317`) applied to itself.

**Failing step names: `Check 11 — a game module cannot reach the network` and
`Check 12 — check 11 can actually go red, on each construct separately`. Every one of
checks 11-14 now PRINTS ITS SUBJECT COMMIT — the claims audit found acceptance §3.7
("every demonstration asserts the commit") was obeyed by ONE of the four, with the
others' commits living only in this file's prose, which architecture §5 says is not
evidence.** Check 12's own failing step name is `Check 12 — check 11 can actually go
red, on each construct separately`.

**PART A — fail closed. Scanning nothing is a FAILURE, never a pass:**

| condition | verdict |
|---|---|
| no `games/` directory at all | RED — `games/ cannot be read` |
| `games/` exists, holds no modules | RED — `games/ contains no modules` |
| a module that does not parse | RED — `does not parse as an ES module` |

**PART B — 21 constructs, each ALONE, each RED and each NAMED.** Alone, so the check is
shown to detect **each** rather than **any**; named, because *a RED for the wrong reason
is not evidence* — a fixture with a typo would be red too and would score as proof
(`PUP-WO-0103` finding B, one work order on).

**PART B2 — seven cases the adversarial pass got through the first version**, now
pinned: an unscanned subdirectory, a `.mjs` sibling, an import escaping `games/`, a
second template substitution, two static-import evasions, and a non-literal dynamic
specifier.

**PART C — the removal ladder.** Removing one construct retires **exactly** its finding
and leaves the other three standing. *(Four rungs, not five: `import(` left tier 1 when
a local relative dynamic import became legal.)*

**PART D — six cases that must stay GREEN**, because a check that cannot pass is not a
check either, **and because a check that refuses legitimate game code has a real cost**:
a clean module; a token inside a comment or string only; a relative static import; local
code-splitting via `import('./levels/l2.js')`; a local image `img.src = './ball.png'`;
and `retrieval(` / `itself[` — a dog game, not `eval(` and `self[`.

*(An earlier version of this section said "four cases that must stay GREEN" and then
listed four of which one was deliberately RED — a table contradicting its own header.)*

**41 controls in total**, up from 25.

### Beyond §8.3's five, labelled as mine — two HOLES, more than two tokens

§8.3's enumeration is **defective, not merely short**, and both holes were reachable in
the time it took to write the check:

1. The scanner strips string literals to avoid false reds — so a module could hide
   `fetch(` in a string and hand it to `eval`. Forbidding the things that execute
   strings closes what removing strings opens.
2. **A STATIC import of a remote specifier reaches the network containing none of the
   five tokens.** §8.3 names `import(` — the *dynamic* form — only.

**AND THE ADVERSARIAL PASS PROVED THAT UNDERSTATED IT BADLY.** The first version said it
did not catch "a determined bypass through computed property access". What it did not
catch was **an `<img>` tag** — 18 working vectors, half needing no computed access at
all. The check's verdict now says the true thing: **this raises the cost, IT IS NOT A
SANDBOX**, a module runs in the shell's own realm, and the structural answers are a CSP
or an iframe/worker. Both are §7 flags below.

### A standing note that reaches past this work order

**`node --check` is not a reliable parse gate for module syntax in a `.js` file**, and
the measurement is narrower than I first reported it. On Node 24:

```
node --check x.js   containing `export default function f({`  -> exit 0   (MISSES it)
node --check x.mjs  containing the same bytes                 -> exit 1   (correct)
```

The hole is **extension-dependent**. `games/*.js` are `.js` files carrying module
syntax — exactly the case it gets wrong — so check 11 uses `vm.SourceTextModule`, which
also parses **without executing**, the property that matters when the file under test
is untrusted by construction.

**I reported this to CC-A as reaching past check 11 before measuring the `.mjs` half.
It does not.** `check-syntax.mjs` writes module sources to a `.mjs` temp file before
calling `--check`, deliberately, with a comment saying why. The correction is recorded
in both comments rather than the claim quietly narrowed.

---

## §3.4 — THE WAY BACK, WHICH IS THE POINT OF THE WORK ORDER

`PUP-WO-0000` §1.6: all three existing openers append a full-bleed overlay **early** and
wire CLOSE **last** — Draw 152 lines later, Camera 287, Map 189 — and Map is a
**confirmed live trap**: an unreachable Leaflet CDN aborts the opener before CLOSE is
ever given a listener, and there is no `keydown`, `popstate` or `visibilitychange`
handler anywhere in the file. Recovery is killing the app, with a three-year-old
holding the tablet.

**Check 13, in a real browser, subject `0d353b5`, seven cases, all passing:**

| case | result |
|---|---|
| ordinary path | back present, thumb-sized, returns to console |
| **`mount()` throws** | the shell tore down by itself; nothing left on screen |
| module 404s | tore down by itself |
| module will not parse | tore down by itself |
| `mount` returns no teardown | tore down by itself |
| **`teardown()` throws** | the host is removed **anyway** — the removal is in a `finally`, never on the line after the call |
| **the module never arrives** (hangs 30s) | back present and working throughout |

The last case is **§1.6's own shape**: if the way back were wired after the `await`,
that is the case that would strand a child indefinitely.

**Asserting instead that the source contains an `addEventListener` before a `mount`
call would be satisfied by source that reads correctly and behaves otherwise.** So the
property is asserted against the cases that actually produce it.

The z-index band is **500** (host) / **501** (back), assigned here per finding F4 —
above every shell surface (200 remote photo and gallery, 100 settings and PIN, 90
`alertFlash`, 80 panels) and below `#portraitBlock` at 9999, which must stay on top
because a rotated tablet is a real state. §1.5 establishes that a remote photo or alert
can fire **while a game is open**, and either would otherwise paint over the game *and*
over the way back.

---

## WHAT DID NOT WORK, AND WHY

**I asked for a `CACHE_VERSION` bump I should not have asked for.** I cited
`PUP-WO-0000` §6.1's "two edits" **without reading §6.1's own next paragraph**, which
says edit 2 is *not* what makes a new asset land — the bump evicts stale copies of
**changed** assets, and a new asset has none. CC-A refused it and supplied a second,
independent reason I had missed entirely: **gate 2 counts three things and a bump is a
fourth**, so bumping would have falsified invariant 6 by the very test this work order
exists to make pass. Same shape as the tar-flags error one work order ago: **quoting a
document without reading its qualification.**

**My first gate-2 count said two things, not three**, because `git diff` does not see
an untracked file. `git add -N` first — otherwise the gate measures whatever git
happens to be tracking rather than what a change consists of.

**Three test-harness bugs of my own, all of which made a green look real:**

1. I measured `$?` through a pipe — again — so a run where all 13 constructs *were*
   detected printed `GREEN` for every one of them. Third time today.
2. A bash function's internal `for i` clobbered the caller's `i`, because bash
   functions share scope, so five removal-ladder iterations all removed the same token
   and four of them printed a misleading verdict.
3. My first differential oracle was newline-framed, which is the exact defect the thing
   under test exists to prevent.

**`playwright` resolves from `.github/ci/`, not the repo root**, so a measurement script
run from `/tmp` died with `ERR_MODULE_NOT_FOUND` that reads like a missing dependency.

---

## WHAT WAS DELIBERATELY NOT DONE

- **The picker overlay** — `PUP-WO-0201`. The Games button mounts `GAMES[0]` directly.
  That is a wire-up, not a chooser, and the code comment says so; with a second entry
  present, the second is unreachable until 0201 renders tiles.
- **Any real game** — P3, P4.
- **The three existing openers' trap** — `PUP-WO-0106`. Not fixed here, and
  deliberately not copied.
- **`PUP-WO-0104`, `0106`, `0108`, the cross-origin tiles question, the
  publication-concurrency redesign** — all parked behind this phase.
- **The naive-viewer icon test** — gate 3 needs a person.

---

## ONE THING FOR CC-A THAT IS NOT A DEFECT

`PUP-WO-0200` §2 now ends with `manifest.json` and both icons are also protected.
twice — once at the top of the amended block and once as the original trailing line.
Harmless and the meaning is unambiguous; noted only because the amendment that fixed a
duplicated constraint left a duplicated sentence.

---

## THE ADVERSARIAL PASS — three lenses, and it found a DISQUALIFYING defect

Full record: `docs/findings/PUP-WO-0200-adversarial.md`. The headline:

**§1.6's trap reproduced THROUGH this host, shipping green.** A module that appends a
full-bleed node to `document.body` and forgets it in `teardown` left the child facing a
solid rectangle with the console unreachable and no back button anywhere — *after a
teardown the shell recorded as clean*. Check 13 exited 0, because it asserted
`#gamesChrome` was gone and never looked at what else was on screen. **A one-word bug,
`document.body` instead of `host`, and it is the pattern the shell's own three openers
use.** Fixed by a sweep; the check now asserts *the child can reach the console* rather
than *the overlay is gone*, and the fix is proven non-vacuous — with only the sweep
disabled, both cases go RED.

**Check 11 was defeated comprehensively** and has been rewritten: the module graph was
never followed (a subdirectory or a `.mjs` sibling was invisible), 18 network vectors
contained none of the twelve tokens, the template stripper swallowed the second `${}`
substitution, and tier 3 matched the *stripped* source where a URL — being a string
literal — could never appear, so it was **dead on arrival**.

**`PUP-WO-0000` §9.1's registry regex was never enforced.** The pass loaded a remote URL
as a module through this shell and executed remote code, with every CI check green. That
is *a spec only a document knows* — the same shape as §8.3's `fetch`, one section later.
Now validated before import.

**Two reported findings did NOT reproduce and are recorded as such**, not dropped: that
the frozen tree was already check-3 red, and that gate 2 needs a `CACHE_VERSION` bump.
Both measured green against a real clone. **But the same experiment found a fourth thing
that WAS real and was mine** — my A14 re-anchor pinned the *last* `urlsToCache` entry, so
adding a game required editing `check-mutations.mjs`: a fourth edit, in a file
`git diff --stat` already counted, so **the gate's own instrument could not see the gate
failing**. Re-anchored to the head of the list. Gate 2 is three things again.

**The pass broke the freeze, and the mechanism matters more than the incident.** A lens
committed to the frozen branch and reset it (net nil; all 27 hashes verify). All three
were told READ-ONLY and told to copy to `/tmp` with `cp -r` — **but in a worktree `.git`
is a POINTER FILE, so `cp -r` copies the pointer and the copy still writes to the real
repository.** The instruction was a convention and nothing enforced it: the same shape
as §8.3, committed by me in the method rather than the code. Next pass runs against a
`git clone`.

---

## §7 — FLAG AND STOP, FOR CC-A

1. **A token scanner cannot enforce invariant 3 against a module that wants the
   network.** The structural answers are a **CSP** (`default-src 'self'` — which **would
   break the Map panel**, since the shell loads Leaflet and Supabase from CDNs) or
   **running modules in an iframe/worker**. Architecture calls, not smuggled in here.
2. **`api.tone(hz, ms, wave)` was RATIFIED and never built.** `architecture.md:129`,
   with the cost corrected by CC-A on 2026-09-01. `grep -c tone index.html` → **0**. The
   shell implements §8.3's table exactly and §8.3 does not list it, so no comment is
   false — but **this is a ratified ruling that did not become a commit, the exact
   failure mode §1.1 of this work order exists to catch**, one document over.
3. **Three of P2's five gates are worded against a picker that does not exist.** Gate 4
   *"open picker"*, gate 2 *"to the picker"*, gate 3 *"a screenshot of the picker … each
   tile"*. Acceptance §3.5 is met; **gate 4 as worded is not**, and I silently recast
   gate 3 from "each tile" to "the Games button". Same family as gate 1.
4. **`check-assets` cannot see an asset referenced only from a game module** —
   `img.src = './assets/ball.png'` absent from `urlsToCache` gives CHECK 2 PASSED and a
   broken image on a cold offline device.
5. **`PUP-WO-0106` and `PUP-WO-0600` both claim the un-closable-overlay trap**, and
   neither document knows about the other. Pre-existing, not introduced here.
