# PUP-WO-0703 — upward feedback

**Branch `build/wo-0703-slots`, based on `main` at `b33ad20` (verified live).**
Disposition: `docs/findings/PUP-WO-0703-adversarial.md`.

**The fence holds** — `sw.js`, `manifest.json`, both icons and `games/` diff to empty,
checked as a command.

## The feedback design, built as specified

**One animation, two meanings.** The wave runs on the slot being recorded INTO and the slot
being played FROM, so the child learns one thing — *this slot is the live one*. Movement
means live and nothing else: an empty slot and a filled-but-idle slot are both still, and
check 26 §27 asserts that in both directions.

**Three states, and never on colour alone**: empty is a flat line with a dashed outline,
holding is a still wave with a solid one, live is a moving wave with a thick ring. Shape,
outline and the presence of a control carry it; colour is the fourth signal.

**Reduced motion stills the wave without erasing it** — full amplitude, thick ring,
brightest stroke.

## Two interpretations I made, both reversible

**1. THE LIVE SLOT IS ALSO THE STOP BUTTON.** Not in the work order. A probe found the
second tap on a recording slot was swallowed by the capturing guard, leaving the only stop
on the microphone button — **which is not where the child is looking, because the wave is
on the slot.** One line to revert.

**2. RECORD-OVER IS THE MICROPHONE BUTTON, not a mode.** With an empty slot it fills the
first one; with all three full it replaces the last-used one, and the wave starts on that
slot so the child sees which is being replaced. No confirm, no long press, no selection
state.

## THE SECOND AXIS ON up/down IS A SECOND MECHANISM, AND I AM NOT DRESSING IT UP

§3 says give each preset a second axis **where its mechanism honestly has one**.
Resampling has exactly one parameter — pitch and tempo move together, that *is* the effect
— so a second axis of that mechanism does not exist. The brightness slider is **a lowpass
stacked on top**: a different mechanism, chosen because it passes the only test that
matters (a 700 Hz → 8 kHz sweep is dramatically audible on a squeaky voice) and because a
preset with one slider beside three with two is worse for the child. **Robot's depth and
cave's wet mix are genuine second parameters of their own mechanisms.**

## What went wrong, because it is the useful part

**Eight product defects. One I found by reading; seven came from a probe or the pass.**

- **The delete control sat on the slot the microphone was filling**, and deleting it left
  the microphone open for fourteen seconds with the wave gone, the button repainted idle
  and the ring reset — then wrote the clip back into the slot the child had just emptied.
  **The work order's central acceptance, failing without even needing the words masked.**
- **The countdown ring — whose comment says the child can SEE the end coming — was painted
  entirely underneath the record button.** Pre-existing; this work order removed the last
  half-pixel of it.
- **My comment claimed a lowpass cannot boost.** `Q` defaults to **1**, read in dB: a
  +1.96 dB peak, measured 1.2533. **Not setting a parameter is not the absence of it.**
- **Double-tapping delete opened the microphone** — a control that *disappears* mid-gesture,
  the mirror of `PUP-WO-0404`'s.
- And **a comment of mine claimed a mechanism I had not written**: that the delete control
  stopped its tap reaching the slot. It stopped nothing.

**And four of my own assertions were blind**, including the central one: **§25 framed the
slot row, and the panel's only painted word is outside that frame** — so the mask changed
nothing in the compared image while the pass line said *"with 1 painted word(s) hidden"*.

## Acceptance

| # | state |
|---|---|
| 1 | **MET** — fence diffs to empty, checked as a command. |
| 2 | **MET** — §25 photographs the whole panel with words masked; empty / recording / holding / playing all differ, and the mask is proven to change the picture. |
| 3 | **MET** — §29: three slots recorded, recorded over and deleted with a finger. |
| 4 | **MET** — §26: the three states differ in border style, border width, wave amplitude and control presence, not colour. |
| 5 | **MET** — §27 samples the path at two times while recording and while playing. |
| 6 | **MET** — §28. |
| 7 | **MET** — §3 sweeps the full 144-position grid; worst peak 0.86, and §33 asserts no filter boosts. |
| 8 | **MET** — §4/§12/§15/§21/§30 kept and green; the pass measured 95 streams across 47 teardowns with 0 live tracks. |
| 9 | **MET** — §6. |
| 10 | every check asserts the commit and names its failing step. |
