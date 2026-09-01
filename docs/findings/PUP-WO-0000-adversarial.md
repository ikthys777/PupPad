# PUP-WO-0000 — adversarial pass, verbatim

**Recovered 2026-09-01 by CC-A.** This transcript was originally written inline in
`docs/FEEDBACK.md` on branch `investigate/wo-0000`, under the ruling then in force
that the verbatim exchange lives in `FEEDBACK.md`. `PUP-WO-0100` then rewrote
`FEEDBACK.md` for its own work order — correctly, per that same ruling — and this
record survived only in git history at `c57b627`.

**That was CC-A's defect, not the builder's.** The two-artifact ruling
(`docs/architecture.md` §5, 2026-09-01) made *new* transcripts durable and per-WO
but left `FEEDBACK.md` a single rolling file, so the first application of it
destroyed the previous work order's record at the tip. `PUP-WO-0101` closes the
rule; this file closes the instance.

Reproduced byte-for-byte from `c57b627:docs/FEEDBACK.md` lines 120–456. Nothing is
edited, summarised, or re-ordered. The reviewer's finding numbers F1–F25 are its
own and are separate from `PUP-WO-0000`'s upward findings F1–F13.

**Why this one is worth keeping.** It returned *"not safe to build against as
written"* and found two defects that were structurally invisible from the two games
the contract was demonstrated against — the absence of any configuration channel
from a registry entry into a module, and the inexpressibility of sustained or
pitched audio. It also caught the findings document about to write a factually
false PIN claim into a ratified document. It is the evidence for the lesson every
later work order now inherits: **a demonstration against the cases in hand is
necessary and not sufficient.**

---

## The adversarial pass — verbatim (WO §5, architecture §5 and §11)

Run as a black-box task in my own workflow: a **fresh subagent with no investment
in the findings being sound**, given the artifact and the ground truth and **none
of my reasoning about either**. Independence here is context isolation, not who
dispatched it.

**It found nine defects I would not have found, one of which was a false claim
this document proposed writing into a ratified document.** I did not wave any of
them off. Every finding is answered below the transcript, with the resulting edit
named. Both the prompt and the output are reproduced unedited, as architecture §11
requires — a summary written by the party being audited is where a weak pass
hides.

### Timeline, stated because it affects what the record proves

The artifact should have been frozen when the pass was dispatched. It was not: two
edits landed while the pass was running — §6.1's `CACHE_NAME` claim gained git
evidence, and I separately noticed the "four PIN outcomes" miscount and held it
rather than patching mid-review. Neither was prompted by the pass, both are
declared here, and everything else in the document is as the reviewer saw it.

### What I gave it, verbatim

````text
You are an adversarial reviewer. Your job is to find what is WRONG with a document. You have no stake in it being sound and you did not write it. Nobody has explained their reasoning to you and nobody will — you have the artifact and the ground truth, and that is deliberate.

THE ARTIFACT — read it in full, all of it, before doing anything else:
  /home/ikthys777/worktrees/PupPad/builder/docs/findings/PUP-WO-0000.md   (~1150 lines)

GROUND TRUTH you can check it against (all read-only — do NOT modify any file anywhere):
  /home/ikthys777/worktrees/PupPad/builder/index.html      (1942 lines — the app)
  /home/ikthys777/worktrees/PupPad/builder/sw.js           (43 lines — the service worker)
  /home/ikthys777/worktrees/PupPad/builder/manifest.json
  /home/ikthys777/worktrees/PupPad/builder/docs/northstar.md      (invariants, cited by number)
  /home/ikthys777/worktrees/PupPad/builder/docs/architecture.md   (the doc it claims to contradict)
  /home/ikthys777/worktrees/PupPad/builder/docs/work-orders/PUP-WO-0000.md  (what it was asked to produce)
  ~/PupPad-sources/blockpop/   and   ~/PupPad-sources/gyre/   (the two source workspaces it classifies)

CONTEXT: PupPad is a single-file offline PWA — a pretend console for a three-year-old who cannot read. The document is an investigation that produces two specifications later work orders will build against: what a game module must export, and what a registry entry must contain. If either spec is wrong, work built on it is wrong.

RUN THESE FOUR PROBES. Do not skip any. Report what you actually did for each.

**PROBE 1 — break the module contract (§8).**
Take the contract in §8 and try to design a game it CANNOT express. Do not be gentle and do not settle for the two games the document already discusses — those are the ones it was built around, so they prove little. Think of games a three-year-old toy console might plausibly want, and find one whose lifetime, state, input, or exit needs the contract has no place for. Candidates worth trying: something with sound that must survive across a pause; something with a countdown or a timer; something that needs two children touching the screen at once; something that must ask before discarding progress; something that streams or decodes an asset; something that wants to be resumed exactly where it left off days later; something with more than one screen inside itself. For each one you try, state whether the contract expresses it, and if it does, say concretely HOW. A contract that fits only the two games in hand is a description, not a contract — your job is to determine which this is. If you cannot break it, say so plainly; a clean bill of health is a legitimate result but only if you genuinely tried.

**PROBE 2 — verify every citation.**
The document makes claims of the form `index.html:1234` and `sw.js:31-43`, and also cites the two source workspaces (`sim.ts:69`, `store.ts:156`, `engine.ts:174`, and so on). Check them. Open the cited file, go to the cited line, and confirm it says what the document claims it says. A miscited line is a worse defect than an uncited claim, so be thorough: work through the document section by section and check every citation you encounter, not a sample. Report every citation that does not resolve, is off by one or more lines, or resolves to something that does not support the claim being made. Also flag any substantive claim about the code that carries NO citation. Report how many you checked.

**PROBE 3 — attack the registry shape (§9).**
Try to break it. What does the picker do with: an entry missing an icon; a very long name; twelve entries; exactly one entry; zero entries; two entries with the same `id`; an `id` that does not match its module filename; a `sound` name that is not in the bank; a `players` value of 0 or 2.5 or "two"; an `icon` containing raw HTML or a script tag; a `module` path pointing outside the games directory? §9.4 pre-answers some of these — judge whether those answers are adequate or whether they wave the problem away. Look especially for cases the document did not consider at all. Also judge §9.2's central argument — that every field is required and that this is what protects the non-reader — on its merits: is it right, or does it just move the failure somewhere else?

**PROBE 4 — re-verify the PIN/lock finding from scratch.**
The document's §5 and §10.2 make claims about the lock button, the PIN, and what they do and do not gate. `docs/architecture.md` §3.1 makes an overlapping claim. Do NOT take either document's word for it. Go to `index.html` yourself, trace the lock button from its click handler through to every consequence, and determine independently what the lock actually does and does not do. Then say whether the document's account is correct, incorrect, or incomplete. If the document claims something the code does not support, that is your most important finding of the four probes.

ALSO, beyond the four probes, report anything else you find: internal contradictions between sections, claims that overreach the evidence, a specification that is ambiguous enough that two builders would implement it differently, arithmetic that does not add up, and anywhere the document asserts something as measured that it appears to have assumed.

OUTPUT FORMAT — findings first, ordered most-serious first. For each: what is wrong, where (file and section/line), why it matters, and how confident you are. Then a short section for each of the four probes recording what you did. Then a one-line overall verdict: is this document safe to build against?

Be blunt. Do not soften findings, do not pad with praise, and do not describe something as a minor nitpick if you think it is real. If a section is fine, say so in one line and move on. NEVER print, echo, or quote any credential value you encounter in the source workspaces — refer to it by file and line only.
````

### What it returned, unedited

Reproduced exactly as received, inside a fence so that nothing in it can be
confused with this document's own structure. Its finding numbers F1–F25 are
the reviewer's own and are referenced by the disposition table below. They are
a **separate numbering** from this document's F1–F12 upward findings above.

`````text
I've read the artifact in full, verified against the code, and run all four probes. Findings below, most serious first.

---

# FINDINGS

## F1 — §9.3 specifies something §8.1 and §9.1 cannot express. There is no channel from a registry entry into a game. *(critical; confidence high)*

`docs/findings/PUP-WO-0000.md` §9.3 rules that Block Pop's `easy`/`classic` "ship as two registry entries, **each passing its own mode**." Nothing in the document lets an entry pass anything:

- §8.1's signature is `mount(host, api)` — no config/options parameter.
- §8.3's `api` surface is fixed at six members: `close`, `sound`, `vibrate`, `save`, `load`, `prefersReducedMotion`. No `api.entry`, `api.mode`, `api.players`.
- §9.1 fixes "**eight required fields and no optional ones**" with no `mode`/`params`, and rules `id` "MUST equal the module basename" — so two entries force **two module files**, not two entries against one module.
- §8.4's own Block Pop demonstration hardcodes `const mode = 'easy';`, silently contradicting §9.3.

Consequences that propagate: §9.5's three-file table ("**one entry** appended") is false for the second of the two games the document is built around; and §8.7's claim that architecture §7 seam 4 is "**Installed by §9**, at a cost of one integer per entry" is wrong — a module can never read `players`, so the seam terminates at a picker badge and is not a seam into the game at all. Two later work orders (P4 especially) cite §8.1 and §9.1 as authoritative; whichever a builder follows, the other is wrong. This is the single defect most likely to cause built-wrong work.

## F2 — The contract cannot release the one resource §8.1 requires it to release: sound *(critical; confidence high)*

§8.1: after teardown "the module must hold no live `requestAnimationFrame`, interval, timeout, event listener, observer, capture, **or media resource**."

The only sound channel §8.3 permits is `api.sound(name)` → `doSound` (`index.html:59-92`). Verified: it returns nothing, builds a fresh switch table per call (`:76-89`), and schedules oscillators with hard `o.stop(t+dur)` (`:67`, `:74`). **There is no handle, no stop, no pitch parameter.** §8.3 simultaneously forbids the game its own `AudioContext`. So:

- A sound started by a game keeps playing after teardown, over the picker, with nothing able to stop it — §8.1's own guarantee is unsatisfiable for audio.
- Any game whose core is *sustained* sound (aquarium, ocean, lullaby, white-noise) is **inexpressible**.
- A musical-instrument toy — arguably the most obvious next three-year-old toy after a drawing pad — is **inexpressible**: twelve fixed cues, no note/pitch argument.

The document's escape hatch ("voices are added to the bank at `index.html:76-89`, which is a shell change **and should be**") puts a per-game edit into a switch table ~1,500 lines from the registry — structurally the same defect §2 condemns in `attachEvents`, and it breaks §9.5's "Nothing else." §8.6 lists what the contract deliberately does not do; this is not on the list, so it reads as an oversight rather than a ruling.

## F3 — §5 and §10.2's headline PIN claim is factually wrong, and §10.2 recommends writing the wrong claim into a ratified document *(serious; confidence high)*

§5 item 3: "**The unlock check cannot reject.** … The lock is not merely non-gating; **it does not reject a wrong PIN**." §10.2 recommends appending to `docs/architecture.md` §3.1: *"so it also does not reject a wrong PIN."*

The code says otherwise. `index.html:1910-1919`:

```
1915      if (pin === state.storedPin) {
1916        state.isLocked = false; state.storedPin = null;
1917        doSound('unlock'); exitFullscreen(); render();
1918      } else { doSound('error'); render(); }
```

On a wrong PIN: `isLocked` stays `true`, `storedPin` is preserved, `exitFullscreen()` is not called. **The wrong PIN is rejected.** What is true is narrower and the document conflates the two: `closePinOverlay()` at `:1901` runs *before* the comparison, so a wrong PIN **dismisses the dialog instead of re-prompting** — no retry, no lockout, no rate limit.

This is the WO's designated highest-value probe (WO §5, §1.5) and the one place §5 claims to go beyond architecture §3.1. The addition it contributes is false, and §10.2 proposes to amend a ratified document with it.

## F4 — §8.2 obligation 3's `z-index:80` does not put the game host above the shell's own surfaces, and §1.5 says those surfaces will fire while a game is open *(serious; confidence high)*

Obligation 3 surveys only the three panel overlays (`index.html:452`, `:782`, `:1310`, all `z-index:80`) and concludes "the shell's game chrome sits above it." Full inventory, verified:

| surface | line | z-index |
|---|---|---|
| `#portraitBlock` | `:25` | 9999 |
| remote-photo popup (`showRemotePhoto`) | `:711` | 200 |
| gallery full-image viewer | `:1050` | 200 |
| `settingsOverlay` | `:1801` | 100 |
| `pinOverlay` | `:1863` | 100 |
| `#alertFlash` | `:1672` | 90 |

The document's own §1.5 finding is that the three realtime channels are **never left**, so while a game is mounted a remote photo still fires `showRemotePhoto` (z-index 200) and a remote alert still fires `triggerAlertEffect` (z-index 90, up to 4s of full-screen red, `:131-146`). Both paint over the game *and* over the back affordance obligation 2 exists to guarantee. The document found both halves and never joined them.

## F5 — §1.6 clears `openCanvas` and `openCamera` of the un-closable-overlay trap on incomplete evidence *(serious; confidence high on structure)*

§1.6: "`openCanvas` and `openCamera` do not have this trap." The trap is structural, not Leaflet-specific — all three openers append the full-bleed `z-index:80` overlay early and wire the CLOSE listener last:

- draw: append `:493` → close wired `:645` (152 lines)
- camera: append `:825` → close wired `:1112` (**287 lines**, including a synchronous `startCameraStream(...)` call at `:844`, `document.querySelectorAll('.filter-pick')` at `:869`, and `renderGallery()` at `:1109`)

Any synchronous throw in those spans reproduces §1.6 exactly. The clearance rests on enumerating each opener's *known* failure modes, which is not the same as showing no path exists. This weakens the document's own case: §8.2 obligation 5's justification is that this is a general hazard — which it is.

## F6 — `api.close()` has no legal caller under the contract's own rules, and "exactly one close path" is self-contradicted *(serious; confidence high)*

- §8.3: `api.close()` is for "a *game-initiated* exit only. **The shell's own back affordance does not route through it.**" → two paths reach teardown.
- §8.2 ob. 4: "**Exactly one close path.** One shell function calls `teardown()`, then removes `host`, **and is the only thing that does.**"
- §8.4: `api.close()` "exists for a future game with a genuine self-ending flow."
- §8.5: a terminal state "must **not** call `api.close()`. Ending a game must never eject the child to the picker." — forbidding the exact use §8.4 reserves it for.

Two builders will implement this differently, and one of them will wire a second path into teardown — which is precisely the `openCanvas` defect §1.3 exists to make unwriteable.

## F7 — §8.1's "observable test" is forbidden by §8.2 obligation 6 *(serious; confidence high)*

§8.1: "two instances of the same game can be mounted simultaneously without interfering … it is **the observable test** that no module-level state exists." §8.2 ob. 6: "`teardown()` completes before any other game mounts. **No two games are ever live at once.**" Obligation 3's host is `position:fixed; inset:0`, so two hosts fully occlude each other anyway. The stated test for architecture §7 seam 1 is unobservable under the obligations in the same section. Separately, "`mount` … Called exactly once per session" never defines "session."

## F8 — §8.3 presents honour-system absences as structural enforcement *(serious; confidence high)*

"No `fetch`, no network, no Supabase … A game cannot reach the network through the contract, **which is stronger than asking it not to**," and "**No DOM access outside `host`**."

A `<script type="module">` has full ambient access to `window.fetch`, `XMLHttpRequest`, `<img src>`, `document.body`, `localStorage`, and every one of the 127 shell globals §3.2 itself inventories. Withholding `fetch` from `api` is *exactly* asking it not to. §8.1's returned-closure argument genuinely is structural; §8.3's is not, and the document gives them equal standing. This matters because architecture §5's "games are strictly offline" and invariant 3 are asserted (§10.3, §8.3) to be made structural by this.

## F9 — `teardown` is not exception-safe, and the document's own Gyre sketch ends it with a throwing call *(serious; confidence high)*

§8.2 ob. 5 wraps `mount` in `try`/`catch`; nothing wraps `teardown`. Obligation 4 calls `teardown()` **then** removes `host` — a throwing teardown leaves the child in a full-bleed overlay with no exit: §1.6 reproduced by the contract designed to prevent it. §8.4's Gyre sketch ends `teardown` with `api.save(settings)`; `localStorage.setItem` throws on quota exhaustion and in some privacy modes — the shell itself wraps every `localStorage` call in `try`/`catch` (`index.html:156-164`, `:170-174`), and §8.3's spec for `api.save` says nothing about failure.

## F10 — §9.2's central argument is wrong on its own terms *(serious; confidence high)*

§9.2 claims required fields "move 'unreadable-but-recognisable' from a review checklist **into the data schema**, where `PUP-WO-0100`'s CI can assert it."

CI can assert a non-empty string. It cannot assert that `icon:'A'`, `icon:'🔤'`, or two tiles both `🎮` on `#10B981` and `#11B892`, are distinguishable by a non-reader. The schema has **no uniqueness constraint** on `icon` or `color`, no contrast constraint, and no stated validation of `color`/`glow` as hex. Worse, `btnHTML` (`index.html:1585-1592`) — which §9.1 nominates as "the working reference for how a tile renders" — interpolates `btn.color` **unescaped into a `style` attribute**, so a present-but-malformed colour silently destroys the tile's CSS with nothing red.

And the killer: a *present but invalid* `sound` produces exactly the quiet failure §9.2 says required fields prevent. `doSound` no-ops on unknown names (`index.html:90` — which §4 verifies as a *feature*), so the tile taps silently and CI passes. **Requiredness buys presence, not recognisability.** §9.2 relocates the failure from review to a CI check that cannot see the property that matters.

## F11 — §9.4 omits six cases and waves away a seventh *(serious; confidence high)*

Not considered at all:

| case | what actually happens |
|---|---|
| duplicate `id` | §8.3 namespaces `api.save` "per game id" — two games silently share one save store. Unaddressed. |
| `id` ≠ module basename | §9.1 says MUST; §9.4 never lists the check, and §9.5's CI list doesn't either. |
| `sound` not in the bank | Silent tile, nothing red — see F10. |
| `players: 0 / 2.5 / "two"` | §9.2 makes the badge "a comparison": `2.5 > 1` badges a 2.5-player game; `"two" > 1` is false. No validator specified. |
| `icon` containing raw HTML/script | §9.1 **explicitly permits** "inline SVG markup", which forces `innerHTML`, making `icon` (and `label`) unescaped markup sinks — and makes `icon` un-regex-validatable, undercutting §9.2's CI argument. |
| `module` outside `games/` | §9.1 says only "path relative to `index.html`". A `../` or `https://` module path is a dynamic `import()` = a third-party network call (invariant 3, northstar §5), and would not be in `urlsToCache`. |

Waved away: "`module` fails to load → the picker stays up and the tile reports nothing — the child taps something else." Dynamic `import()` failure is **asynchronous**, and by the document's *own* §6.2 finding `sw.js` is network-first — so on a flaky network the tap does nothing for the full fetch timeout. A tile that does nothing when tapped is indistinguishable from a broken tablet to a non-reader; that is invariant 1's failure mode answered with a shrug. It also never defines "reports nothing" (silent, or `api.sound('error')`) — two builders will differ.

"Zero entries … Should be unreachable" — nothing in the spec makes it unreachable; the games button (architecture §5, replacing Power) always exists.

Adequate as written: over-long label (clamp + `<=12` CI, though the 12 is asserted, never measured), twelve entries (scrolling grid, and the warning not to copy the rails' layout is the right instinct), one entry.

## F12 — §7's headline arithmetic is wrong and stale *(confidence high, verified against disk)*

"The whole of the wanted material is **26** files. The other **460** of the **486** classified-or-excluded files are platform scaffolding."

- 242 + 245 = **487**, not 486.
- 487 − 26 = **461**, not 460.
- After §7.1's own correction (gyre rewrite 10→6), port+rewrite is **22**, not 26. The sentence sits *above* the correction and is never restated, so the document's headline is stale by its own ruling. §11's summary table repeats "26 files of 486."

Everything else in §7's counting is exact: 242/245 totals, every exclusion cell (92/36/15, 87/52/19), both sums (143/158), both classified remainders, both disposition sums, §7.1's correction arithmetic, and all 22 table line-counts to the line.

## F13 — §7.1's ruling is argued from a false premise *(confidence high)*

"Nothing in either file is Gyre-specific or Block Pop-specific — they are **identical boilerplate from the same template**." The two `button.tsx` files diff by **86 lines** over 44/49. Blockpop's uses hand-rolled `Record<Variant,string>` lookup tables with **no `cva` and no Radix Slot**; gyre's uses `cva` + `@radix-ui/react-slot` + `VariantProps`. The variant vocabularies do not overlap (`primary|secondary|ghost|soft` × `sm|md|lg|xl` vs `default|secondary|outline|ghost` × `default|sm|icon|icon-sm`). Blockpop's carries game-specific toy styling — `font-display`, `active:not-disabled:scale-[0.96]`, a `0 3px 0` hard shadow, `accent`/`ink`/`surface` tokens. `discard` may still be the right call; the reason given for it is not true. This is presented as the document's most careful piece of adjudication.

## F14 — §7's own quality claim is not sustainable *(confidence high)*

"I spot-checked 33 of their `file:line` citations against the sources; **all 33 resolved to what was claimed.**" Five source citations do not resolve as claimed:

- **`sim.ts:76`** (§8.4, "`sim.ts:76`'s pointer capture is never released in the source") — `sim.ts` contains **zero** `setPointerCapture`; line 76 is blank. The capture is at `particle-canvas.tsx:76`, which the *same paragraph* cites correctly two sentences earlier.
- **`store.ts:244`** (§8.4 table, "terminal state | board full") — line 244 is `const gameOver = !anyTrayFits(cleared.board, tray);`. The predicate is *no tray piece fits*, not board-fullness. §8.4's sketch then branches on `if (g.boardFull)`, which does not exist.
- **`GameOver.tsx:36-42`** (§8.5, "**three equally-weighted buttons**") — the source already weights them: `size="lg"` default / `size="md" variant="soft"` / `size="md" variant="ghost"`. They span 36-**44**. §8.5's contract obligation is argued from a hierarchy problem the source does not have.
- **`BlockPopGame.tsx`** "21 selector subscriptions, 7 effects" — actual **29** and **8**.
- gyre `store.ts` "13 bound constants" — 9 bounds + 7 defaults = 16; nothing gives 13.

## F15 — §8.4's "sixteen" is 19, and two of its components are wrong *(confidence high)*

1 rAF + 6 `Float32Array` + 1 `ResizeObserver` + 4 listeners + 2 subscriptions + 1 `matchMedia` + 3 timeouts + 1 capture = **19**. "Sixteen" appears twice. Of the components: only **two** of the three timeouts are uncleaned (`controls.tsx:67` is cleared at `:70`), and there are **five** window/document listeners once `controls.tsx:68` is counted. The number is doing rhetorical work ("the contract has a place for all sixteen").

## F16 — §3.2's global inventory does not sum, and three group counts are wrong *(confidence high)*

The headline is exact: 64 `var` bindings + 63 function declarations = **127** names. The table beneath it sums to **63** — `canvasChannel` (`:261`) falls in no group. "Console state + timers `:116-121`, `:124` → 8" is neither the statement count (7) nor the binding count (10). "Draw panel `:262-276`, `:332-334` → 18" is **17** (reaches 18 only if the range starts at `:261`). "Map panel `:1129-1146` → 18" is **17**.

## F17 — repeated count errors in the exhaustive tables *(confidence high)*

- "**all four PIN outcomes** (`:1913`, `:1917`, `:1918`)" — §1.4 *and* §8.2 ob. 1. Three citations for four. There are **three** `render()` calls in the PIN path; the fourth outcome (confirm-mismatch, `:1894`) calls `buildOverlay()`, not `render()`.
- §3.1's `pop` row: "**3** gate-failure paths" followed by **four** line numbers. `:862` is not a gate — it is the camera *retry* `.catch`, reached only after the panel is already open. §1.5 item 2 lists only the correct three (`:438`, `:770`, `:1294`).
- §4 `keyTap` "18 call sites" — actual **19** (`:546, :589, :597, :609, :620, :632, :638, :875, :888, :938, :947, :958, :1419, :1497, :1503, :1513, :1523, :1530, :1881`), and "every tool/colour/size/emoji pick" omits zoom, camera flip, filter pick, and the PIN keypad.
- §4 `blip` row omits **`:778`** — `openCamera()` plays `blip` on *open*, so "all three panel closes … shutter" is not exhaustive, in a section whose entire value is exhaustiveness.
- §7.2 `src/lib/auth/**` "(18" — blockpop's auth tree holds **16** files; §7.2's own "37 under `src/`" only reconciles with 16.
- §1.1 "The other five … **play a sound** and set a toast (`index.html:1690-1698`)" — the sound is at `:1685`, outside the cited range.

## F18 — four misattributed cross-document citations, two inside tables headed "verified" *(confidence high)*

- **§10.5**: "**§3's** `sw.js:19-27` citation for the activate handler." That citation is at `architecture.md:160`, inside **§6**; architecture §3's table contains no such citation. The findings document's own §6.3 calls it "architecture **§6**'s amended hazard" — §10.5 contradicts §6.3.
- **§10.4** row: "**§5** — `powerUp` is reachable only from the Power button … | confirmed." Architecture §5 makes no reachability claim; that is the findings document's own claim, listed in a table of the architecture's claims it verified. (The underlying fact is true — `powerUp` occurs only at `index.html:84` and `:105`.)
- **§9.3**: "the picker must stay ignorant of any game's internals (**architecture §5**)" — that sentence is architecture **§4** (`architecture.md:94-95`).
- **§8.2 ob. 2**: "This is what makes northstar **invariant 5** structural." Invariant 5 (`northstar.md:63`) is about *resuming* play after a terminal state, not about exiting to the picker; the exit concern is northstar §6 and invariant 2. §8.5 uses invariant 5 correctly, so the document is internally inconsistent about what it cites.

Also: §10.1 presents architecture §3's "Cached assets" row as a block quote and **adds bold emphasis** to the second clause — the one clause the entire §10.1 contradiction turns on. Wording is otherwise verbatim.

## F19 — three citation errors in §6 / §10.2 *(confidence high)*

- **`index.html:190` is WRONG** (§6.2 claim 3, "the app issues `POST`s to Supabase"). `:190` is a header ternary `'Prefer': method === 'POST' ? 'return=minimal' : ''`. The fetch is at `:194`; the method default at `:185`. `:202`/`:210` are exact, and the underlying mechanism is correct.
- **§10.2**: "`:1915` then only selects a sound" — `:1915` is the comparison `if (pin === state.storedPin) {`; the sounds are at `:1917`/`:1918`.
- **§6.1**: `caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))` cited as `sw.js:11-14`; that expression is `:12-13`.

## F20 — §6.2 claim 1 is imprecise in a way that matters for §6.1's own recommendation *(confidence high)*

"Every **successful** response is written into the cache." There is no success filter in `sw.js:33-37`. `fetch()` resolves for 404 and 500, so **error responses are cached**. Directly load-bearing: a mistyped `games/<id>.js` path fetched once online caches a 404 body, which is then served offline as a successful-looking cached miss rather than failing — which is the case §6.1's asserted asset check exists to catch.

Related and unstated: `sw.js` is registered at the bottom of `index.html` (`:1935-1937`), so on the very first load the page is uncontrolled and the head's CDN requests (`:11-13`) are **not** intercepted. §10.1's "anything fetched once while online **is** cached" holds from the second load, not the first.

## F21 — §6.2 claim 3 states the unhandled rejection unconditionally *(minor)*

Both POST paths are gated on `isSupabaseConfigured()` (`:183`, `:201`, `:209`), so it occurs only on a configured device.

## F22 — §9.1's "same field names, same value shapes" is not quite true *(minor)*

The button records (`index.html:95-106`) use **`emoji`**, not `icon`, and store escaped surrogate pairs (`'📡'`) where §9.1's example uses a literal glyph; they also carry `bg` and `msg`. `color`/`glow`/`label`/`sound` do match. Also §9.4's citation `index.html:1629`/`:1665` for "the rails' fixed four-per-side layout" resolves to two generic `justify-content:space-evenly` flex columns — the four-per-side fact lives in `BTNS_LEFT`/`BTNS_RIGHT` at `:95-106`.

## F23 — §7's exclusion citation over-reaches *(minor)*

WO §1.3 names only `.grok/` and `.vercel/` as excludable wholesale, and WO §3.4 says the *opposite* of a wholesale exclusion: "the disposition table covers **every** source file … Files dismissed as scaffolding are still listed, marked `discard`." Neither section rules `screenshots/` (15/19) or `attachments/` (2) excludable. Both WO sections exist; the exclusion is defensible on the merits; the cited authority does not grant it.

## F24 — a gate conflict the document's §11 will trip *(observation)*

§11 asserts "`git diff main --stat` for this branch shows changes under `docs/` only." Verified true right now against `origin/main` @ `4329c0c` (the header's base claim is correct; the local `main` ref is the stale one). But `FEEDBACK.md` is currently untracked at the **repo root** — WO §6 requires it "parked with the branch," while WO acceptance §3.1 says "changes under `docs/` only. **Any other path fails.**" Committing `FEEDBACK.md` where WO §6 asks makes §11's checkable fact false.

## F25 — limits §8.6 should state and does not *(confidence high)*

§8.6 exists to state the contract's edges "so the limits are known rather than discovered." Three are missing:

- **No confirmation before discard.** `teardown` is synchronous, has no veto and no async form, and the shell's back affordance gives the game no notice. A build-a-castle toy cannot ask. (For this audience that is probably the *right* answer — which is why it should be a ruling, not an omission.)
- **No safe-area / chrome inset.** `host` is `inset:0` (full viewport) with the shell's back affordance painted on top; nothing tells the game where the chrome is, so a game can draw a control under an unpressable region.
- **No asset channel.** §8.3 gives no `fetch`; §9.2 rejects a per-game asset outright ("a **second** asset per game, breaking invariant 6's 'one manifest line'"). Note this narrows invariant 6, which actually reads "its own module, one registry entry, and **the asset manifest**" (`northstar.md:64`) — plural assets in one manifest are not obviously forbidden. The document's reading excludes an entire class of games by construction.

## Operational note

One verification subagent, while measuring line lengths in `~/PupPad-sources/*/src/lib/auth/preview.ts`, ran a redaction that did not fire on line 21 (a continuation line with no `=`), so the 64-character literal was echoed into that subagent's tool output. It is not reproduced anywhere in this report, was not written to any file, and no file was modified. The §7.4 facts themselves check out: the two `preview.ts` files are byte-identical (same SHA-256), line 19 carries a 12-character client identifier and line 21 a 64-character literal, the value appears in exactly one file per workspace and **zero** files under `.vercel/` or `.grok/`, and `git ls-files` returns 0 matches for `preview.ts`.

---

# PROBE RECORDS

## Probe 1 — break the module contract (§8)

Nine games designed against §8.1/§8.3/§8.5. Four cannot be expressed; three more only with limits §8.6 does not list.

| game | verdict | how / why |
|---|---|---|
| Aquarium / lullaby (sustained sound across a pause) | **CANNOT** | `api.sound` is fire-and-forget with no handle and no stop; §8.3 forbids an own `AudioContext`; `<audio>` needs an asset §9.2 rejects. See F2. |
| Xylophone / piano (8 pitches) | **CANNOT** | Bank is 12 fixed cues, no pitch argument. Adding voices is a shell edit to a switch table 1,500 lines from the registry. |
| Musical statues (30s countdown, freeze) | expressible | `setInterval` created in `mount`, cleared in `teardown`; wall-clock via `Date.now()` to survive background throttling. Any cue it plays still cannot be stopped (F2), and §8.6 admits there is no host pause hook. |
| Two children touching at once | **partially** | Input is expressible (`pointerdown` + `pointerId` on `host`). Configuration is not: the module cannot read `players` (F1), so a 2-player variant needs a second module file. |
| Build-a-castle, ask before discarding | **CANNOT** | `teardown` is synchronous, has no veto, and the shell's back path gives no notice. Only mitigation is continuous `api.save`, which §8.3 scopes as "preference state, never identity, never required." |
| Sprite-sheet / sampled-audio / custom-font game | **CANNOT** | No `fetch` in `api`; §9.2 rejects a per-game asset. See F25. |
| Resume exactly where it left off, days later | expressible | `api.save`/`api.load` are synchronous, per-id `localStorage`; a board serializes fine. Two unspecified edges: no failure semantics on `save` (F9), no size bound. |
| Level-select → level (two screens inside itself) | expressible | Game swaps DOM inside `host`. Unstated: the shell's back is one-way to the picker with no hook to intercept, so a child on screen 3 lands in the picker. |
| Self-ending game | **CANNOT, by contradiction** | §8.4 reserves `api.close()` for exactly this; §8.5 forbids it. See F6. |

**Judgement.** The lifetime/teardown core is genuinely general, not a description of the two games in hand — §8.1's returned-closure argument (teardown must close over the scope that created the handles) is the strongest thing in the document and I could not break it. What the contract lacks is a **parameter channel** (F1) and a **resource handle for sound** (F2). Both holes are invisible from Gyre and Block Pop specifically, because neither needs configuration and neither needs sustained audio — which is exactly the failure mode WO §5 warned about.

## Probe 2 — verify every citation

Worked section by section. **≈272 `file:line` citations into `index.html`/`sw.js` checked** (201 in §§0-4, 71 in §6/§8-§11), plus ~24 citations into the two source workspaces and ~105 quantitative claims. Each was opened at the cited line and judged against the claim.

**Line-level discipline into `index.html` and `sw.js` is genuinely good.** Every `§1.2` acquire/release pair, every `§1.3` monkey-patch line, the `§2` code block (character-accurate, not a paraphrase), all twelve sound-name lines, every `§3.1` read/write list, all five never-read globals, the `§6.2` `sw.js:33-41` block (every per-line annotation exact), and `§1.1`'s three opener spans (262/218/348 — verified as opener-function length, arithmetic correct) all resolve exactly. `index.html` = 1,942 and `sw.js` = 43 confirmed. Zero `window.addEventListener` / `document.addEventListener` / inline `on*=` in 1,942 lines — §0 and §1.6 are exact. All 22 source-workspace line counts exact to the line.

Failures found: **1 outright wrong** (`index.html:190`, F19), **3 off-by/padded** (`sw.js:11-14`, `index.html:1915`, `sim.ts:76` — the last is wrong-file, F14), **1 partially supported** (`index.html:1629`/`:1665`, F22), **4 misattributed cross-document references** (F18), and **5 source-workspace citations that do not support their claim** (F14). Substantive claims with no citation: §8.2 ob. 2's invariant-5 attribution, §9.5's "1,600 lines" (measured ≈1,580, approximately right). The failure mass is not in `file:line` discipline — it is in **counts, cross-document section references, and citations into the source workspaces**, i.e. exactly the places §7's "all 33 resolved" self-audit claimed to have covered.

## Probe 3 — attack the registry shape (§9)

Ran every case listed, plus the ones §9.4 does not consider. Results in **F10** (§9.2's central argument fails on its own terms — requiredness buys presence, not recognisability, and a present-but-invalid `sound` reproduces the exact quiet failure it claims to prevent), **F11** (six unconsidered cases, one wave-away, one "unreachable" that nothing makes unreachable), **F1** (the `mode`-passing hole), and **F22** (the button-record vocabulary is not actually reused). §9.4's answers for over-long label, twelve entries, and one entry are adequate; the twelve-entry answer's warning against copying the rails' layout is the right instinct even though its citation is weak.

## Probe 4 — re-verify the PIN/lock from scratch

Traced independently, without relying on either document. `#lockBtn` markup at `index.html:1623` (inside `#app`, so destroyed and rebuilt by every `render()`) → its only binding at `:1730-1734` in `attachEvents()` → `showPinOverlay('set'|'unlock')` at `:1843` → keypad handler `:1878-1906` → `onPinComplete` `:1910-1920` → `goFullscreen`/`exitFullscreen` `:1787-1795`. Enumerated every read: `state.isLocked` at `:1605`, `:1623` (×3), `:1732`; `state.storedPin` at `:1915` only.

**What the lock actually does:**
1. Set: stores 4 chars in `state.storedPin`, `isLocked = true`, `doSound('lock')`, `goFullscreen()`, `render()`.
2. Unlock, correct PIN: clears both, `doSound('unlock')`, `exitFullscreen()`, `render()`.
3. Unlock, **wrong** PIN: `doSound('error')`, `render()`. `isLocked` stays `true`, `storedPin` preserved, fullscreen not exited. The dialog is already gone, closed at `:1901` before the comparison.
4. Every `isLocked` read is cosmetic (icon colour `:1605`; background, `lockPulse` animation, and open/closed padlock glyph `:1623`) or mode-selecting (`:1732`).
5. No opener, no `.pad-btn` handler (`:1680-1699`), no radar handler, no settings handler consults it. All eight buttons and all three panels stay fully operable.
6. Nothing persists — `localStorage` holds exactly three keys (`:158-163`, `:172-173`), none PIN-related. Reload re-evaluates `:116`; the app silently unlocks.

**Verdict on the document's account: correct on architecture §3.1's two claims, incorrect on the one thing it adds beyond them, and incomplete in two further ways.**

- Correct and independently confirmed: memory-only PIN lost on reload; gates no content; settings reachable while locked (`#settingsBtn` bound unconditionally at `:1736-1737`) with the Supabase anon key in a plain-text input at `:1818` (`value="'+keyVal+'"`).
- **Incorrect**: "the unlock check cannot reject" / "it does not reject a wrong PIN" (F3). It rejects. What it does not do is *re-prompt*.
- **Incomplete (a)**: the accurate version of what §5 was reaching for is that there is **no retry, no lockout, and no rate limit** — the wrong-PIN path dismisses the dialog and the lock button stays live, so the PIN is brute-forceable with unbounded attempts.
- **Incomplete (b)**: the lock's "only functional effect", fullscreen, is **not enforceable** — any system gesture exits fullscreen, leaving `isLocked === true` while nothing whatsoever is different, red pulsing padlock and all. Conversely, fullscreen is the only thing in the app doing anything at all for invariant 2 (hiding browser/system chrome), so "it contains nothing" overshoots in the other direction too. §5's ruling for later WOs is right in substance; its supporting statement is not.

---

**Verdict: not safe to build against as written.** §8's lifetime core is sound and worth keeping, but §9.1/§9.3 are mutually unimplementable (F1), §8.3 cannot release sound (F2), §5/§10.2 would amend a ratified document with a false claim (F3), and §8's obligations contradict each other in three places (F6, F7, F9) — fix those seven before any P2–P4 work order cites these specifications.
`````
