# PUP-WO-0000 — Initial state and seam investigation

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `a4be019`; **verify live HEAD**).
**Branch:** `investigate/wo-0000`.
**Author:** CC-A (architect) · **Builder:** CC-EM (pup-b) with subagents.
**Phase:** P0 · **Phase exit gate:** see `docs/roadmap.md` → P0.
**Grounds:** `docs/northstar.md` invariants 1, 2, 3, 5, 6 · `docs/architecture.md`
§2, §3, §3.1, §4, §5, §7 · `docs/roadmap.md` P0 · `index.html`, `sw.js`, and the two
Grok source workspaces.

> **What this is:** an investigation, not a build. PupPad shipped with no documents,
> so `docs/architecture.md` describes its shape from a reading done in a chat
> session — good enough to plan against, not good enough to build against. This work
> order establishes the real contracts by reading the code, and produces the two
> specifications every later work order depends on: what a game module must export,
> and what a registry entry must contain. It is **NOT** a port, a refactor, or a
> button change. No behaviour changes. Why now: every P2–P4 work order cites
> contracts that do not exist yet, and inventing them mid-build is how the games
> host ends up shaped around whichever game was written first.

**Cadence:** investigate, then **STOP**. One PR, left unmerged for review.

**First act, before anything else:**
```
git fetch origin && git checkout -B investigate/wo-0000 origin/main
```
Your worktree may be behind and may not contain this file. You sync your own tree;
nobody reaches into it while you are running.

---

## 1. Scope

1. **Read `index.html` end to end** — all 1,942 lines — and document:
   - the panel lifecycle contract: exactly what `openX()`/`closeX()` do, what they
     assume about the DOM, how a panel is torn down, and what leaks if it is not;
   - the click router in `attachEvents()`: how `data-id` dispatch works and what
     adding a ninth id would require;
   - the `state` object: every field, who writes it, what survives a re-render;
   - the sound bank: how `doSound()` is called and the full list of available names;
   - the PIN/lock path, and confirm or refute architecture §3.1's finding that it
     gates no content and is memory-only.
2. **Read `sw.js`** and document exactly what a new cached asset requires.
3. **Read both Grok workspaces.** Sources are on the box at
   `~/PupPad-sources/blockpop/` and `~/PupPad-sources/gyre/` (see §9). Produce a
   **file-by-file disposition table** covering every **source** file — `src/`,
   configuration, and package manifests. `.grok/` agent metadata and `.vercel/` build
   output are generated noise: state their counts and exclude them wholesale rather
   than listing them. *(Ruled 2026-08-31; §3.4 governs.)* Mark each `port` (pure logic, moves
   near 1:1), `rewrite` (React rendering, needs a vanilla equivalent), or `discard`
   (auth, database, SSR, build scaffolding).
4. **Specify the game-module contract.** The exact function signature a game module
   exports, what the shell passes it, how it signals close, how it releases a
   `requestAnimationFrame` loop or audio context on teardown. Architecture §4
   describes this in the abstract; this makes it concrete.
5. **Specify the registry entry shape.** Exact fields, including what the picker
   needs to render a tile that satisfies northstar invariant 1, and the `players`
   field required by architecture §7 seam 4.
6. **Record every contradiction** found against `docs/architecture.md` §3. This is
   the single most valuable output of this work order. An empty list is an
   acceptable answer **only if stated explicitly as empty**.

## 2. Invariants — restated by number

From `docs/northstar.md`, which is authoritative. The slice this WO touches:

- **1** — every control operable by a non-reader. The registry shape you specify
  must make an unreadable-but-recognisable tile possible.
- **3** — every core surface works with no network. The module contract must not
  assume fetch, CDN, or Supabase.
- **5** — no game state ends play without a one-tap way back. The contract must
  give a game a way to return to the picker from anywhere.
- **6** — adding a game touches its own module, one registry entry, one manifest
  line. **Your contract either makes this true or it does not; that is the test.**

**Protected surfaces — must diff to empty in this WO:** `index.html`, `sw.js`,
`manifest.json`, both icons. **This work order changes no application code.**

## 3. Acceptance — what must be proven, not asserted

1. `git diff main --stat` shows changes under `docs/` only. Any other path fails.
2. `docs/findings/PUP-WO-0000.md` exists and contains, as named sections: the panel
   lifecycle contract; the router contract; the state inventory; the sound-name
   list; the PIN/lock finding; the `sw.js` requirement; the disposition table; the
   module contract; the registry shape; the contradictions list.
3. Every claim about `index.html` or `sw.js` cites `file:line`. A claim without a
   citation is not a finding.
4. The disposition table covers **every** source file in both workspaces. Files
   dismissed as scaffolding are still listed, marked `discard`.
5. The module contract is concrete enough that a later work order could implement
   two different games against it without amendment. **Demonstrate this**: sketch,
   in the findings doc, how Gyre's animation loop and Block Pop's turn-based
   interaction each satisfy the same contract. If they cannot, the contract is
   wrong and that is the finding.

## 4. Scope fence — NOT in this work order

Named because they are the things most reasonable to fold in, and all are out:

- Porting any game code, even a proof-of-concept.
- Touching the Power button or `BTNS_RIGHT`.
- Writing the picker overlay or any CSS.
- Creating the CI workflow — that is `PUP-WO-0100`.
- "Small obvious fixes" to `index.html` noticed while reading. Log them in
  `FEEDBACK.md` as findings. **The protected-surface rule outranks the improvement.**

## 5. Adversarial pass

Run by **you**, as a black-box task in your own workflow: a **fresh subagent with no
investment in the findings being sound**, given only the artifact and none of your
reasoning about it. Independence here comes from context isolation, not from who
dispatched it.

**`FEEDBACK.md` must record this exchange verbatim** — the exact prompt you gave the
subagent and its unedited output, not a summary. CC-A reviews whether the
adversarial pass *was any good*, which cannot be judged from a conclusion alone.

Probe:

- Take the module contract and try to build a game it cannot express. A contract
  that fits only the two games in hand is a description, not a contract.
- Check every `file:line` citation resolves to what the finding claims. A miscited
  line is worse than an uncited one.
- Attack the registry shape: what does the picker do with a missing icon, a very
  long name, twelve entries, one entry?
- Re-verify the PIN/lock finding independently rather than accepting the
  architecture's claim — architecture §3.1 asserts it, and this WO is the
  opportunity to catch that assertion being wrong.

## 6. Upward feedback

`FEEDBACK.md`, parked with the branch. Per entry:
`finding · where (file:line) · type (note|risk|scope-question|bug) · recommendation
· decision-needed (yes/no)`.

Required sections: **the verbatim adversarial exchange (§5)**; what did not work and
why; what was deliberately not done; a gates line stating the protected-surface diff
status as a checkable fact.

## 7. Flag-and-stop

Park the branch and surface to CC-A rather than working around:

- Any need to modify `index.html`, `sw.js`, or `manifest.json` to complete the work.
- A source workspace missing, unreadable, or not matching what §9 describes.
- The two games proving genuinely inexpressible under one contract — that is an
  architecture §4 problem, not a builder's call.
- Any credential, key, or token found in either Grok workspace. **Do not copy it,
  do not echo it, do not commit it.** Report that it exists and where.

## 8. Closing sequence

Adversarial pass → `FEEDBACK.md` → one PR, **left unmerged** → notify CC-A. The
builder never self-merges.

## 9. Source material

The two Grok workspaces are placed on the box at `~/PupPad-sources/` by the human
before kickoff. They are **reference material, not repository content** — nothing
from them is committed in this work order. `blockpop/` carries Block Pop
(`src/components/game/`, `src/lib/game/`); `gyre/` carries the particle field
(`src/components/field/`). `_incoming/` holds the original zips and is a transfer artifact, not a workspace —
ignore it; it is not an undescribed source under §7. Both are TanStack Start +
React 19 + Zustand exports
with Vercel build output and auth/database scaffolding that is not wanted.

## 10. Provenance

Amended 2026-08-31 before dispatch: added the first-act sync, and moved the
adversarial pass to a black-box task you own with a verbatim-record requirement
(`docs/architecture.md` §11). Written by Claude (chat architect) 2026-08-31, from the planning session that
produced the genesis documents. First work order in the repository and the opening
work order of the first dual-CC pilot.
