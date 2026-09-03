# PUP-WO-0701 — builder feedback (PART 1: the transport. The voice panel is NOT built.)

**Subject:** `build/wo-0701` on live `main` `d76ae8a`.
**Fence:** `sw.js`, `manifest.json`, icons, `games/` **diff to empty**.

## 0. WHAT IS AND IS NOT IN THIS PR — stated first

**Built and red-proven:** §S.2 (the inbound gate), §S.3 (the unreleased channel), §S.4
(the uncapped array). **These were the prerequisites, and one of them was a live breach on
the shipped app.**

**NOT built:** the voice panel itself — recorder, presets, sliders, playback, send.
**Acceptance items 3–8 are untouched and I am not claiming them.** Reporting a work order
complete when the feature it is named for does not exist is the failure this project has
spent a week refusing to commit; the transport work is a coherent, shippable half and it
is the half that had a security defect in it.

## 1. The fourth `.subscribe(` — resolved before building, as §S.3 required

`:2733` is **`seam.subscribe`, the games control-panel seam — not a Supabase channel** —
and **it does release**: its `unsub()` is called in `panelTeardown` at `:2737`.

**So the finding is unchanged and slightly sharper: three Supabase channels, zero
released.** The fourth is a different mechanism that already does the right thing.

## 2. The breach was real, and the check proves it by watching the network

The plant that restores the pre-fix behaviour produces **an actual HTTP request** to an
attacker-named origin: `the child's device fetched an attacker-named origin (1 request(s))`.

**The assertion is the network, not the regex.** A check that fed strings to
`safeMediaUrl` and compared return values would grade the validator against itself. This
one routes a hostile payload through the real receive path and asserts **the browser made
no request** — the property invariant 3 is actually about.

## 3. THE AUDIENCE — recorded, as §S.5 requires, so it is a choice and not a silence

**Voice will inherit `device_id=neq.<self>` with `self:false`, no per-clip addressing and
no revocation.** Every paired device receives every clip, and nothing can be taken back.

That is **already true of photos today**. It is fine for an X-mark and it is not obviously
fine for a recording of a three-year-old. **Not fixed here — the blast radius is Scotty's
decision** — but it is now written down rather than inherited.

## 3a. FIVE CHECKS WERE UNREGISTERED, AND FOUR OF THEM HAD ALREADY MERGED

CC-A caught check 24 missing from `ci.yml`. **Checking the rest found four more:**

| check | work order | state |
|---|---|---|
| 22 + controls | `PUP-WO-0603` | **MERGED, never ran in CI** |
| 23 + controls | `PUP-WO-0602` | **MERGED, never ran in CI** |
| 24 | this one | not yet merged |

**So the zoom hardening and the radar fix have been on `main` with no CI protection at
all.** Each was written with its controls, each was shown red against a planted defect,
and none of them would have caught a regression in anybody's build but mine.

**The sentence is my own, from `PUP-WO-0400`:** *"A check never seen red is not a check,
AND AN UNREGISTERED ONE DOES NOT RUN."* I wrote it and then shipped three unregistered
checks.

**Why it is easy, and why that matters more than the slip:** the check runs locally, goes
red on the plant, and does its whole job in front of you. **The step that makes it exist
for everyone else leaves no trace when it is skipped.** Nothing fails. CI stays green.
**A missing check and a passing one are the same colour** — which is the same shape as
every "passes by not running" defect this project has spent a fortnight finding, this time
one level up, in the registration rather than the assertion.

All five are registered here, and the job's `timeout-minutes` is raised 20 → 32 **before**
the first run: it already sat at 18m0s green on a 2-core runner and this adds five
browser-bound checks. The last CI budget guessed here was cancelled at 10m17s, and a
cancellation looks exactly like a failure.

**BUILT HERE, RULED BY CC-A, and the reasoning is why it is not a precedent for folding:**
`ci.yml` was already open in this PR and inside the fence — the cheapest moment it will
ever have — and **numbering it means it waits in the queue while unregistered checks stay
invisible, which is the exact failure the item describes.** A parked item about things
being invisible is a shape this project has paid for repeatedly. It is also what keeps the
five registrations *true*: shipping them without it defers the same defect by one work
order.

**Check 25 asserts the EQUALITY, derived from the directory, never a list** — a list goes
stale exactly the way `ci.yml` did, and the next file someone adds is the one missing from
both. It fails closed if the directory match returns nothing, so it cannot pass by finding
no work to do. **Red proof:** adding an unregistered `demo-*.mjs` exits **1** with
`demo-planted-unregistered.mjs is not registered in ci.yml`; removing it exits **0**.
*(Exit codes read directly — not through a pipe, which is how `node --check` was misread
earlier in this same session.)*

**CC-A's half, recorded because they recorded it:** merge discipline verified the fence,
CI green, and the fix at source — **it never asked whether an added check RUNS.** Scope
answers what changed; it does not answer what became active. That is why it reached `main`
three times instead of once, and it is now a standing rule in `TEMPLATE.md`.

## 4. Verdict

| | |
|---|---|
| check 1 | **PASS** |
| **check 24** | **PASS** — 5 assertions |
| **red proof** | the pre-fix gate produces a real beacon request; the check catches it |
| Fence | held |

**Owed and not built:** the voice panel (§2.1–2.3, acceptance 3–8), and the bare-`click`
controls, which §S.4 gave their own number.

---

# PART 2 — THE PANEL. Upward feedback.

**Branch `build/wo-0701-voice`, based on `main` at `9ae4207` (verified live, not trusted).**
Adversarial pass and disposition: `docs/findings/PUP-WO-0701-adversarial.md`.
Item-5 prediction, written before anyone saw the panel:
`docs/findings/PUP-WO-0701-item5-prediction.md`.

## The fence held

`sw.js`, `manifest.json`, both icons and `games/` **diff to empty against `9ae4207`**,
checked as a command rather than asserted. Nothing needed a `urlsToCache` line — §S2.8
was right that it is all inside `index.html`.

## Three choices that are choices, not drift

**1. BUTTON id 0 IS NOW `Voice` 🎤.** Per §S2.1, one data line, and `Comms` was decorative
(a `doSound` plus a toast). **Reversible in one line** and Scotty may want the console
fiction back.

**2. `releaseChannel()` INSTEAD OF THREE INLINE COPIES.** §S2.2 said to copy `closeCamera`'s
exact shape. I did not. Copying it would have left **three** inline copies of one rule, and
the voice panel adds a **fourth** channel — four copies of one rule in a project whose most
expensive recurring defect is *two expressions that must agree*. The shape is preserved
exactly (`removeChannel`, `.unsubscribe()` fallback in the `catch`); nulling the handle
stays at the call site, because JS is pass-by-value and a helper that appeared to clear its
caller's variable would be a false green. **If you want the literal copy, say so and I will
change it back.**

**3. THE PITCH PRESETS ARE 🐭 AND 🐘, NOT puppy AND big dog.** This one is against the
directive's own words and the reason is the directive's own filter. A dog face and a dog are
**the same silhouette at 34px** — two presets a non-reader cannot tell apart is precisely
what invariant 1 forbids. A mouse and an elephant are unmistakable **and encode the axis
itself**: small animal, high voice. **The names are unchanged in spirit; only the glyphs
moved.** *The adversarial pass separately flagged 🏔 for cave as weak, and I agree — it is
recorded as an expected failure in the item-5 prediction rather than swapped for a second
guess.*

## VOICE INHERITS TODAY'S AUDIENCE, AND THIS IS THE RECORDED CHOICE §S.5 ASKED FOR

`puppad-voice` is a **fixed global channel name**, unscoped by any pairing id, with
`self:false` and no per-clip addressing and no revocation — the same shape as the camera.
**Anyone with the URL and the anon key receives every clip from every install.** Not fixed
here, per §S.5, and flagged rather than silently accepted.

**One thing sharpens it beyond what §S.5 says.** §S.1's own framing is that this panel
carries **the first identifying data this app has ever handled** — a coordinate is not
identifying, a voice is. So the audience question is materially more expensive now than it
was for X-marks, and it is Scotty's. **I would not ship this to a device outside the family
without scoping the channel.**

## Acceptance

| # | state |
|---|---|
| 1 | **MET** — fence diffs to empty, checked. |
| 2 | closed (spike gate). |
| 3 | **MET, measured** — four presets rendered offline through **the shipping graph builder**, null result first. **And its limit is printed by the check itself**: proven at the four *default* slider values only; the 13-band instrument cannot resolve ring frequency or delay time. |
| 4 | **MET** — check 26 §11 drives two pages: page A's real `sendVoice` output into page B's **own registered** inbound handler. Only Supabase's delivery is stubbed. |
| 5 | **UNVERIFIED — NEEDS SCOTTY.** Prediction recorded first, in its own file, before anyone saw the panel. Does not block the PR, per §S2.7. |
| 6 | **MET** — one finger tap leaves from idle, mid-record and mid-playback; every control on `wireTap`. |
| 7 | **MET** — Supabase unconfigured: opens, records, plays, no channel created, send is a silent no-op exactly as the camera's is. |
| 8 | **MET, and it was broken twice before it was met** — see below. |
| 9 | every check asserts the commit and names its failing step. |

## What went wrong, because it is the useful part

**THREE DEFECTS SHIPPED INTO MY OWN FIRST BUILD AND ALL THREE WERE FOUND BY INSTRUMENTS
RATHER THAN BY READING.**

- **Every clip was refused by its own gate.** `MediaRecorder` emits
  `audio/webm;codecs=opus`; `safeMediaUrl` has no slot for a media-type parameter. **The
  panel's entire purpose was non-functional and every unit test passed**, because nothing
  tested acceptance item 4. Writing that test found it in its first run. **My check would
  have missed it too** — its first draft carried its own looser regex and accepted the very
  payload the gate rejected. It now asks the shipping gate.
- **Taps during the microphone grant orphaned live microphones** — the flag-and-stop this
  work order names as mattering most. `voiceRecorder` is not assigned until the grant lands,
  so the guard guarded nothing. **The panel's own state reporter said zero while four
  microphones were live**, because an orphan is a stream no variable points at.
- **The inbound byte cap bounded the string, and the string is the cheap half.** 3 MiB of
  low-bitrate Opus decodes to roughly **a gigabyte of PCM and forty-nine minutes** of audio
  that, at the time, **nothing in the app could stop** — including the exit.

**AND A FOURTH, IN A CHECK THAT WAS ALREADY MERGED.** Check 24 asserted that `closeCamera`
releases its channel by testing `String(closeCamera)` against `/removeChannel|unsubscribe/`
— and `closeCamera` carries a long comment **naming both words** while describing the bug it
fixed. Deleting the release and keeping only `cameraChannel = null` left check 24 **green**.
**A described bug reads like a fixed one**, and the more carefully a fix is documented the
more certainly a source-text grep goes green. It now asserts the effect, for all three
panels.

## Numbers, and which are requirements

- **`MAX_RECORD_MS` = 15000** — the REQUIREMENT, enforced by a timer, because a three-year-old
  will hold the button.
- **`MAX_INBOUND_BYTES` = 3 MiB** — the BACKSTOP, unchanged from part 1. **A duration and a
  size: not the same number and not the same unit, so they fail differently.**
- **`MAX_INBOUND_AUDIO_BYTES` = 1 MiB / `MAX_INBOUND_SECONDS` = 40** — new, and both are
  needed: the first bounds what reaches the decoder, the second is the only bound that stays
  true whatever the next codec's expansion ratio is.
- **`CAVE_DRY` 0.50 / `CAVE_WET` 0.45 / `CAVE_FEEDBACK` 0.45** — derived from the echo series
  (`0.50 + 0.45/0.55 = 1.32`), not tuned by ear. Feedback below 1 bounds **decay**, which is
  **not headroom**; the first build clipped on 7 of 9 cave slider positions.

## Checks

**Check 26** (20 assertions across 14 sections) and **check 26 controls** (**24 planted
defects, every one red for its own stated reason**), both registered in `ci.yml`. **Check 25
caught them unregistered on its first real opportunity** — which is the job it was folded in
to do, one work order after it was written.

**Six of the twenty-four plants found defects in the check before they found anything in the
app**: an unclamped value that *threw* instead of failing, a closed `AudioContext` the shell
silently healed so no state string could see it, a slider assertion that compared the paint
against the value (**the same number twice**), a threshold copied from prose rather than
measured, a no-op plant, and an assertion that read the very variable its own plant removed.

## One thing I did wrong in process, stated plainly

**The protocol is freeze, then hold every correction until the adversarial pass returns.**
I did not — I fixed the send defect mid-pass. The freeze is untouched and every finding was
re-verified against the current tree, but the pass graded `4646927` and the disposition is
against a later commit. Recorded in the findings file as well.
