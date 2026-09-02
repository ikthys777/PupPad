# PUP-WO-0200 — adversarial pass, the record

**Subject:** `build/wo-0200` frozen at `c6f01a9`, 27 deliverables hashed
(`PUP-WO-0200-freeze.sums`). **Three lenses**, black-box, fresh context: the way back;
defeating the offline check; a claims audit. Every finding below was reproduced by me
against the artifact before being written down — **two did not reproduce, and they are
recorded as not-reproducing rather than quietly dropped.**

---

## 0. THE PASS BROKE THE FREEZE, AND THE MECHANISM IS THE FINDING

A lens committed `945b67a "add second placeholder game (3 things)"` **on top of the
frozen HEAD** and reset it. Net effect nil — `945b67a` is dangling, reachable from no
ref, and all 27 hashes verify against the `c6f01a9` blobs, independently confirmed by a
second lens that pinned every measurement to the frozen blobs rather than the worktree.

**But the mechanism is worth more than the incident.** All three were told READ-ONLY and
told to copy to `/tmp` with `cp -r`. **In a worktree, `.git` is a POINTER FILE, so
`cp -r` copies the pointer and the copy still writes to the real repository.** The
instruction was a convention; nothing enforced it. That is the same shape as §8.3's
`fetch` convention — the defect this entire work order exists to close — committed by me
one level up, in the method rather than the code.

The enforcement, for next time: run the pass against a `git clone` (which gets its own
object store), or a `cp -r` of a non-worktree checkout, never against a worktree.

---

## 1. DISQUALIFYING — §1.6's trap reproduced THROUGH the new host, shipping green

A module that appends a full-bleed node to `document.body` and forgets it in `teardown`:

```
after pressing back: chromeGone=true, topAtCentre="sparkles", padReachable=false
bodyKids: ["portraitBlock","app","SCRIPT","sparkles"]
```

`gameSession` is `null`, so the shell believes it succeeded. The child faces a solid
rectangle, the console is unreachable, and there is no back button anywhere. **Recovery
is killing the app** — `PUP-WO-0000` §1.6 exactly, reached through the host built to
prevent it. **Check 13 exited 0 on it**, because it asserted `#gamesChrome` was gone and
never looked at what else was on screen.

A one-word bug — `document.body` instead of `host` — and it is the pattern the shell's
own three openers use.

**FIXED** by a sweep in `endGameSession`, and the check now asserts *the child can reach
the console* rather than *the overlay is gone*. **Proven non-vacuous:** with only the
sweep disabled, both new cases go RED.

## 2. CRITICAL — check 11 did not follow the module graph

`games/hello.js` importing `./sub/evil.js`, which fetches: **`EXIT=0`, "scanning 1
module(s)"**. The glob was flat and `.js`-only, so a subdirectory or a `.mjs` sibling was
never read while being perfectly loadable. Reproduced, then fixed: every module under
`games/` at any depth, and every relative import must resolve inside `games/`.

## 3. CRITICAL — 18 network vectors containing none of the twelve tokens

`const f = fetch; f(url)` · `new Image().src` · `Reflect.get(globalThis,'fet'+'ch')` ·
`<link rel=prefetch>` · `<iframe>` · `location.assign` · a Blob `Worker` · `new Audio` ·
`<form>.submit()` · a `<script>` element — all green, all silent, network reach measured
in Chromium.

**Half need no computed property access at all.** The check's closing paragraph said it
did not catch "a determined bypass through computed property access". What it did not
catch was **an `<img>` tag**.

**PARTLY FIXED, AND THE CLAIM IS NOW BOUNDED.** Tier 3 catches the accidental cases on a
non-relative literal; `fetch` is matched as an identifier. But the honest position is in
the check's own verdict: **this is not a sandbox.** A module runs in the shell's realm
with `window` in scope. The structural answers are a CSP or an iframe/worker — **§7,
below**.

## 4. CRITICAL — §9.1's registry regex was never enforced

The pass loaded, through this shell: a module with an `mjs` extension, one in a
subdirectory, one upper-case, one reached by a parent-directory traversal out of the
games folder, and **one named by a full remote URL, executing remote code** — with every
CI check green. `PUP-WO-0000` §9.1 constrains `module` to a regex; nothing enforced it.

**The same shape as §8.3's `fetch`, one section later: a spec only a document knows.**
FIXED — validated before import.

## 5. Also fixed, each reproduced

| | |
|---|---|
| the stripper swallowed the **second** `${}` substitution — the ordinary shape of a two-slot HTML template — tier-2 tokens included | rewritten as a state machine |
| `import{x}from'remote'` (no space) and a specifier on the next line | detector works on the whole source |
| `notes` covered tier 1 only, so a hidden tier-2 token left **no** trace, while the file claimed it was "not silently hiding it" | both tiers |
| false reds: `retrieval(`→`eval(`, `itself[0]`→`self[`; and local code-splitting `import('./levels/l2.js')` refused outright | word boundaries; local relative dynamic imports allowed |
| tier 3 matched the **stripped** source, where a URL — being a string literal — can never appear. **Dead on arrival** | matches comments-removed source |
| `api.close()` from inside `mount` discarded the teardown; an interval ticked forever with the host gone | teardown run immediately |
| a module removing its own host latched the Games button dead until reload | recovers |
| `deepFreezeEntry` froze two levels, named for more | genuinely recursive |
| the exit handler was late-bound to a mutable global, with a sound AHEAD of the exit | early-bound, exit first |
| `backWired` measured size and was named for wiring | hit-tests with `elementFromPoint` |

## 6. TWO REPORTED FINDINGS THAT DID NOT REPRODUCE, RECORDED AS SUCH

**(a) "The frozen deliverable is already CHECK-3 red."** It is not.
`node check-cache-name.mjs .` → **exit 0**, *"no cached asset changed, so no CACHE_NAME
bump is required."* The lens measured it in an isolated `git init` repo with no proper
merge-base.

**(b) "Gate 2 needs a CACHE_VERSION bump — a fourth thing."** Against a real clone, with
a second game added: **check 3 PASSES.** The bump is not required for a *new* asset,
exactly as `PUP-WO-0000` §6.1 says.

**But the same experiment found a fourth thing that IS real, and it was mine.** Check 7
went RED: my A14 re-anchor pinned the **last** `urlsToCache` entry, so adding a game
required editing `check-mutations.mjs` — a fourth edit, in a file `git diff --stat`
already counted, so *the gate's own instrument could not see the gate failing*.
**Re-anchored to the head of the list, which does not move. Gate 2 is three things
again, with CI green.**

## 7. §7 — FLAG AND STOP, FOR CC-A

1. **A token scanner cannot enforce invariant 3 against a module that wants the
   network.** 18 vectors proved it. The structural answers are a **Content-Security-
   Policy** (`default-src 'self'` would block img/script/iframe/fetch/websocket to other
   origins — and **would break the Map panel**, which loads Leaflet and Supabase from
   CDNs) or **running modules in an iframe or worker**. Both are architecture calls with
   real costs. Not smuggled in here.
2. **`api.tone(hz, ms, wave)` was RATIFIED and never built.** `architecture.md:129`:
   *"Yes — `api.tone(hz, ms, wave)` joins the module contract"*, with the cost corrected
   by CC-A on 2026-09-01. `grep -c tone index.html` → **0**. §8.3's table does not list
   it and the shell implements §8.3's table exactly, so no comment is false — but this
   is **a ratified ruling that did not become a commit, which is the exact failure mode
   §1.1 of this work order exists to celebrate catching**, one document over.
3. **Three of P2's five gates are worded against a picker that does not exist.** Gate 4
   says *"open picker"*, gate 2 *"to the picker"*, gate 3 *"a screenshot of the picker …
   what each tile does"*. The picker is `PUP-WO-0201`. Acceptance §3.5 is met; **gate 4
   as worded is not**, and gate 3 was silently recast from "each tile" to "the Games
   button". Same family as gate 1, which was reworded two days ago.
4. **`check-assets` cannot see an asset referenced only from a game module.** A module
   doing `img.src = './assets/ball.png'` with the file absent from `urlsToCache` gives
   `CHECK 2 PASSED` and a broken image on a cold offline device. Invariant 3, green board.
5. **A worktree defeats `cp -r` isolation** — §0. Method, not code.
