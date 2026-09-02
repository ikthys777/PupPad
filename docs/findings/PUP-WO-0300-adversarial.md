# PUP-WO-0300 — adversarial pass, findings and disposition

**Frozen subject:** `3052c36f8c2bc913c4514a25265972ea396d6cc0` · frozen 2026-09-02T05:17:06Z
**Protocol:** `PUP-WO-0300` §6 as revised — a `git archive` export with **no `.git`**, so
committing on the frozen tree is inexpressible rather than forbidden. Never `cp -r` of a
worktree. Six lenses, each black-box against the artifact and the project's own
ground-truth documents, each told to treat the builder's feedback as a thing to falsify.

**Freeze SHA-256** (`games/gyre.js` `8472622b…`, `index.html` `b720dc84…`, `sw.js`
`46e9df93…`, `docs/feedback/PUP-WO-0300.md` `d0948813…`, `demo-gyre.mjs` `42e2b998…`,
`demo-games-back.mjs` `be5d918a…`, `demo-games-offline.mjs` `1b2c0d24…`, `ci.yml`
`6b18e6c6…`).

**Result: three DISQUALIFYING findings, eight SERIOUS, and a long tail.** Every
DISQUALIFYING one was **reproduced independently by the builder before anything was
changed** — a lens's summary is a claim, and two of the three had a mechanism the
builder's first hypothesis got wrong.

---

## The three that would have shipped

### D1 — the way back was dead with a second finger on the glass, and dead for any tap that slid

`index.html`, the `#gameBack` handler. It was wired on **`click` alone**, and Chromium
synthesises no click in two situations that are a three-year-old's ordinary gesture:

- **another finger is already down anywhere.** `pointerdown`, `touchstart`, `pointerup`
  and `touchend` all fire on the button; `click` does not. With a thumb resting on the
  field the exit is inert, and a game canvas is `touch-action:none`, so that resting
  touch is never converted to a scroll and cancelled. It stays down.
- **the tap slides more than ~15 px.** Touch slop turns it into a pan. Measured on the
  64 px button: **8 px closed the game, 20 px did not, 40 px did not.**

**And the project's own reachability test passed throughout.** `elementFromPoint` at the
button's centre returned `#gameBack`, 64×64, in every failing case — because both games
checks press it with a **synthetic mouse click**, which is subject to neither rule. Across
check 13's nine cases and the thirty probes `PUP-WO-0200` cites, **the button had never
once been pressed with a finger.**

There is no fallback: no `keydown`, `popstate` or Escape handler anywhere in `index.html`,
and `manifest.json` is `display: fullscreen`, so Android's system back leaves the app
rather than the game. **This is live on the tablet today** through the `hello` placeholder.

**Disposition — fixed.** Wired on `pointerdown`/`pointerup` with an `armed` flag so the
press must have started on the button, `used` for idempotence, `click` kept for keyboard.
Verified: all three gestures now close it.

### D2 — the exit sat on top of the adult Settings button

`#gameBack` occupied (10,10)–(74,74); `#settingsBtn` occupies (10,6)–(48,34). Tap one
closed the game; tap two, ~120 ms later — which is what a child does when the first tap
appears not to work — landed on the console and opened **"Pup Pad Sync Settings"**: two
text inputs holding the Supabase URL and anon key, and two exits labelled `Save` and
`Close`. No tap-outside-to-dismiss, no icon. **A non-reader cannot leave it**, and a
mis-tap on `Save` writes config.

**Disposition — fixed.** The exit moved 52 px clear. Verified: the double-tap no longer
opens the panel and the console stays reachable.

### D3 — randomize produced an all-black, touch-unrecoverable screen on half of all presses

`games/gyre.js`. `randomize()` draws `polarity` freely — measured **99,993 repel in
200,000 draws**. Left alone, a repelled field went to the background colour:

```
t = 3 s   6.4% of pixels lit      t = 30 s   0.0%, max luminance 9  (= the background)
t = 10 s  0.9%                    t = 45 s   0.0%
one tap: a 400 ms flash, then black again. Dragging into the corners: nothing.
```

**The mechanism was not dimness, and the builder's first fix was aimed at the wrong
thing.** A floor was put under the stroke length on the theory that speed-proportional
strokes had fallen below a pixel. It did not help. Instrumenting the module showed
**particle 0 sitting at exactly (920, 660) on a 900×640 canvas** — `w+20, h+20`. The
entire field had migrated into the **twenty-pixel margin outside the canvas that the wrap
needs to hide its seam**: repel pushes a particle past `w+20`, it teleports to `-20`, and
it is immediately outside on the other side where the force points outward again. 1200
strokes a frame, every coordinate finite, all drawn off-screen.

The comment above that wrap said *"the wrap is what makes repel safe — nothing can be
flung off-canvas and lost."* Nothing is lost. Everything ends up where nobody can see it.

**Disposition — fixed.** Repel does not wrap; it has **walls**, with a small bounce.
Attract keeps the torus and is unchanged. Verified: 45 s of repel now leaves 0.22–0.77% ink
at maximum luminance 255, and one tap restores it. **A check that goes red on the old code
is in place** (`demo-gyre.mjs` §3b, a 20-second settle) and was confirmed red against it.

---

## SERIOUS

### S1 — check 16 could not see the leaks it claimed to measure

Its probe wrapped `requestAnimationFrame` and `addEventListener`, and its `tag()` returned
`null` for anything that was not `window` or `document` — so a listener on `document.body`
could never be recorded at all. `setTimeout`, `setInterval`, all three observer kinds and
pointer capture were uninstrumented. It then printed **one `ok` line covering all five
resource words** `PUP-WO-0000` §8.1 names.

Planted: a 60 Hz interval driving the sim, a `document.body` listener, an undisconnected
`ResizeObserver`. **CHECK 16 PASSED**, printing `ok the rAF loop stopped: 0 frames`, while
the page ran **882 canvas draw calls a second after the first close and 4205 after five**.

Two more inside its own declared category: listener identity used `fn.name` and **threw
the `opts` away**, so the commonest removal bug there is — dropping the `capture` flag —
recorded as a clean removal while the listener stayed attached; and the section measured
**one** open/close cycle, so a leak that is invisible on cycle 1 and linear thereafter was
out of reach by construction.

**Disposition — fixed.** Every resource word is instrumented, listeners are keyed on
target + type + function + capture, every target is labelled, and the section runs **five
cycles** and asserts flat deltas. Verified red on all four planted leaks, with the linear
growth visible in its own printed table.

### S2 — check 16 §3 could not see an unusable randomize either

It sampled 700 ms after a reseed — the field at its most spread — so it **structurally
could not observe any steady state**, which is where D3 lives. Its usability filter was an
ink-*presence* test against the median colour, not an ink-versus-ground *contrast* test;
and its difference filter asserted that two **strings** differ, which `pickOther`
guarantees by construction. Two planted defects passed **8 of 8 runs**: a palette made
invisible (`sat: 0, lit: 3`), which the check rendered, sampled and called usable at
`ink=2.1%`; and two palettes made byte-identical twins, which it reported as two different
worlds.

**Disposition — partly fixed.** §3b adds a late sample (20 s) with an inversion assertion.
**Not fixed: the contrast term.** The check still measures ink presence, not ink-versus-
ground contrast, so a palette that renders near-black on a dark ground would still pass.
Recorded as open — see the flags below.

### S3 — `api.tone` broke a precondition §8.6 relies on, and clamped one call while the sum was unbounded

`docs/findings/PUP-WO-0000.md` §8.6 rules that each cue *"hard-stops itself via
`o.stop(t + dur)` **in under a second** — so nothing can outlive `teardown`, and §8.1's
release guarantee is satisfiable."* `api.tone` raised that ceiling to **3000 ms**, and
`endGameSession` touched no audio at all — verified, it had no oscillator, tone or sound
reference. §8.1 lists **"media resource"** among what teardown must release.

Separately: gain is fixed at 0.12 with no master gain and no compressor, so **~8.3
simultaneous notes reach full scale and ten peak at 1.16 — hard clipping**, rendered
offline. Ten fingers landing together is a child drumming, and Gyre plays a note per touch.
And the 4000 Hz ceiling sat at the **peak of the ear's sensitivity**, making it the
loudest-perceived note the primitive could produce — the opposite of what a bound described
as "a child's ears" is for.

**Disposition — fixed.** A voice registry capped at six, stopped at teardown, ceiling
lowered to 3000 Hz. **Two attempts at the pruning went permanently silent before the third
worked**: `onended` never fires on a suspended `AudioContext`, and neither does its clock
advance, so both an event-based and an audio-clock-based expiry left the registry full and
the toy mute. It prunes on the **wall clock**, and the check asserts **exactly six** rather
than at most six, precisely because a number under the cap is the silent failure.

### S4 — `host.gyre` was not inert after teardown, and both the comment and the check said it was

`delete host.gyre` removes the **name**. A captured reference — a slider handler, a
subscription, a timer — still holds a frozen object whose methods all work. Driven after
teardown: `set` mutated the settings, `scheduleSave` created a fresh 300 ms timer no
teardown will ever clear, `subscribe` refilled the watcher array teardown had just
emptied, `randomize` reseeded a detached canvas, and **localStorage was overwritten after
the child had left**, silently changing the settings the toy comes back on.

The check's assertion was `h.gyre === undefined` and its message was *"a stale reference
cannot drive a dead session"* — architecture §6.1 member 2 in its exact shape: it ran, it
compared what it was told to compare, and that was not the thing the message certified.

**Disposition — fixed.** A `dead` flag every method checks; the assertion now drives a
captured reference and asserts it is inert, including that the saved settings are untouched.

### S5 — `burst` was invisible in repel, and repel is half of every dice roll

Measured: a tap moved the ink under the finger by **18% in attract and 0.0% in repel** —
the disc is empty, which is the point of repel, so there was nothing to push. Roadmap P3
gate 1 is **per-parameter**, so an invisible one is a failed gate.

**Disposition — fixed.** The burst follows the polarity: in repel a tap **gathers**,
briefly filling the hole before the field pushes it back out. One multiplier, and a nicer
toy than a shove.

### S6 — a palette change wiped 80% of the field, and the source never did

`set('palette', …)` called `clearTrails()`, a full-opacity repaint. Measured at linger 90:
ink 0.0170 → **0.0034 in one frame**. The source bumps no clear token on a palette change;
only its explicit "clear trails" button did. `PUP-WO-0301`'s swatch strip fires `set` on
every `pointermove` of a drag, which would have strobed the field to bare background all
the way along the strip.

**Disposition — fixed.** A partial fade for `palette`, and **nothing at all** for
`background` — `step()` already repaints on the next frame when it sees the id change, so
the old code asked for the same paint twice.

### S7 — the seam was missing two controls the source shipped

`controls.tsx` binds a **clear trails** button and a **reset field** button. Neither was
exposed, so `PUP-WO-0301` could not have rebuilt them without editing `games/gyre.js` —
making the control surface touch a second thing.

**Disposition — fixed.** `clear()` and `reset()` added to the seam.

### S8 — three defects in check 11, all mine

- **A concatenated `.src` was silent.** `i.src = 'https:' + '//evil/x.png'` matched neither
  TIER 3's literal pattern (which needs the `//` inside one literal) nor the non-literal
  **note**, whose regex required an identifier after the `=`. The file's own header
  promises that a non-literal assignment *"becomes a NOTE, visible to a reviewer"*.
  Demonstrated fetching off-origin from a module the check passed green.
- **The regex-literal note fired on ordinary division** — `count * (1 + size / 100 + tail /
  100)` — so it was lit on every green run of this repo's own game module, which contains
  **no regex literal at all**. A note lit unconditionally carries no information, and it
  was the only signal that would have surfaced a token hidden from the stripper.
- **`PUP-WO-0300` §3 says the check "will red on" a remote font. It did not**, by either
  form: a `@font-face` in a `<style>` and `new FontFace(…, 'url(https://…)')` both matched
  nothing, and both were demonstrated fetching. So did `style.backgroundImage`.

**Disposition — all three fixed**, with controls in check 12 (48 now), including two in a
new PART E that assert a note **stays quiet**.

---

## The stale-count and citation findings, which landed on the builder's own prose

- **The gate-2 diffstat and the fence file list were measured against the parent commit
  and pasted forward** — inside the same commit that added 41 lines to `gyre.js` and wrote
  the feedback file. The document's §4 cites the `Ten checks` rule three sections below the
  stale number. **Fixed:** both recomputed at HEAD, and the recomputation is the standing
  instruction.
- **`ci.yml` line 1 said "ten checks" while the job ran sixteen**, and a comment said the
  job was "fourteen steps". Check 12's summary carried four hand-maintained per-part
  counts. **Fixed by removal, not by refresh.**
- **Checks 13/14 were labelled architecture §6.1 member 4.** Member 4 is a *dangling*
  pointer; `hello.js` resolved, it was simply no longer the file under test. The document's
  own sentence three lines earlier describes member 3. **Fixed.**
- **`PUP-WO-0000 §8.1`** was cited bare, and **two files carry that name** — the findings
  document and a work order, and the work order has a §8 and a §9 with no subsections.
  **Fixed:** every citation now names `docs/findings/`.
- *"lifted out with their bodies unchanged"* — each body gained a `var c = getAudioCtx();`.
  The substantive claim (timings unaffected) is right and was verified; the word was not.
- *"the five originals are byte-for-byte their source values"* — the **sim-relevant** fields
  are, all twenty verified. `hex` and `cycle` are new; `palettes.ts` has no `hex` at all.
- The ring's life is **550 ms**, not the "quarter-second" one sentence called it.
- **Acceptance 10 was never answered.** `demo-gyre.mjs` initialised its commit to
  `'unknown'` and passed — a green with no identifiable subject. **Fixed: it fails closed**,
  with `PUPPAD_SUBJECT` for a tree that has no `.git` by design. The sibling checks share
  the pattern and are **not** changed here; flagged.

---

## Named trades, which §6's last probe asked for and the first feedback did not give

- **The light backgrounds cost roughly half the contrast, on 20% of presses.** All 110
  palette × background pairs rendered: every one of the 22 light-ground pairs occupies the
  bottom 22 places, worst `lemon/fog` at **CR 2.26** against `lemon/plum` at 5.86. Chroma
  is roughly halved. **Nothing is invisible** — minimum ink 0.6% over 330 renders — but
  `lemon` on `fog` reads as a swarm of flies rather than as "lemon".
- **Repel is no longer one quantity with attract.** Its radial term is ×2.4 with swirl
  ×0.4, so above force 0.77 repel's push exceeds anything attract can reach at maximum, and
  the source's *gentle* outward drift is unreachable at every slider position.
- **Randomize refuses the extremes of five sliders** — the sparse field, the hard flicker,
  the 5000-particle blizzard are outside the surprise. For a non-reader whose only
  zero-effort control is the dice, that is a real part of the toy he reaches only by
  dragging.
- **The sliders are not bounded by the draw budget**, deliberately: the worst field
  reachable by dragging measures **6.8 fps** on a 6× throttled proxy. The dice cannot get
  there; a child who dragged there chose it and can drag back.
- **The ring costs every future burst measurement 550 ms.** Decoration that has to be
  excluded from a measurement will mislead the next person measuring.
- **Two cycling palettes cannot be held at a colour**, so "I want the green one" is
  unavailable for two of eleven.

## Open, and flagged rather than fixed

1. **Check 16 §3 still measures ink presence, not ink-versus-ground contrast.** A palette
   that renders near-black on a dark ground passes. The fix is a real metric change and is
   named here rather than half-built.
2. **A tier-1 token hidden from the stripper is a note on the passing path.** Promoting it
   to red reverses a design decision check 12's PART D pins — a module could then not
   mention the ban in a comment. **CC-A's ruling, not a build step.**
3. **`supabaseFetch` is a global, pre-authenticated network client in every game module's
   scope.** Not new, not Gyre's, and squarely inside the CSP/iframe question — but it is
   the strongest single argument for it and was written down nowhere.
4. **The portrait block covers the exit at any number of taps, and the game keeps running
   behind it.** The app's global posture, identical with no game open; the battery cost
   while a tablet lies sideways is new with Gyre.
5. **Two consecutive randomizes can be visually near-identical** — 13 of 4,950 legal
   transitions inside a just-noticeable margin. The guarantee is over **identifiers**;
   roadmap P3 gate 2 is over **appearance**. They coincide by luck of the tables today.
6. **The sibling checks all fall open on an unresolvable commit.** Only check 16 was fixed.
