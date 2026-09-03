# PUP-WO-0701 acceptance item 5 — the prediction, recorded BEFORE the test

**Written 2026-09-03 at `4646927`, before any person has seen the voice panel.**

Acceptance item 5: *"Every preset and every slider operable with all text covered, tested
by a **real person who has not seen the app**. Prediction recorded first. **Do not
simulate it.**"* — `PUP-WO-0201` §7's rule.

**This is worth writing down for exactly one reason: a prediction written after the
result is not a prediction.** It is recorded here so it can be wrong in public.

## What I predict

**The panel has four preset tiles, one slider, and three round transport buttons
(play · record · send), plus the shell's exit at the top left. No word is painted
anywhere in it.** With all text covered the panel is unchanged, because there is no text
in it to cover — the only strings are `aria-label`s, which a screen reader speaks and a
tester's tape cannot hide.

| # | prediction | confidence |
|---|---|---|
| 1 | The **record** button is found first and pressed without instruction. It is the largest control, centred, and carries a microphone. | **high** |
| 2 | **Play** is understood immediately. A right-pointing triangle is the most over-learned glyph in consumer software. | **high** |
| 3 | The **slider** is discovered by accident, not by intent — a finger lands on it while reaching for a preset, the sound changes, and *then* it becomes interesting. Scotty's own observation is that Buddy likes moving a control and hearing what changed, so once found it is used heavily. | **medium** |
| 4 | 🐭 and 🐘 are correctly predicted as "small squeaky" and "big rumbly" **before** being pressed. This is the substitution I made against the directive and it is the prediction most worth falsifying. | **medium** |
| 5 | 🤖 is identified as a robot but its **sound** is not predicted. Ring modulation has no everyday referent. | **medium** |
| 6 | 🏔 is the **weakest glyph in the set** and I expect it to fail. A mountain does not say *echo* to anyone who has not shouted in a canyon, and a three-year-old has not. I expect a tester to press it, hear the effect, and only then attach a meaning to the icon. | **low — expected to fail** |
| 7 | **Send** (📡) is the least discoverable control. It has no local effect a tester can perceive unless a second device is in the room, so it will read as "the button that does nothing". | **medium** |
| 8 | Nobody is stranded. One tap on the exit leaves from every state. | **high** |

## What would falsify each, and what I would change

- **1 or 2 wrong** → the transport row is wrong and the layout needs rethinking, not retouching.
- **4 wrong** → my invariant-1 argument for substituting mouse/elephant for puppy/big dog was
  wrong, and CC-A's original naming should be restored with better glyphs than 🐶/🐕.
- **6 wrong in the other direction** (a tester *does* read 🏔 as echo) → I was too pessimistic
  and the preset stands as written.
- **6 wrong as predicted** → 🏔 needs replacing. **I do not have a candidate I believe in**,
  which is why it is recorded as an expected failure rather than pre-emptively swapped:
  guessing twice is not better than guessing once and measuring.
- **7 wrong** → send needs a local confirmation a non-reader can perceive.

## Status

**UNVERIFIED. This needs Scotty and a person who has not seen the app.** Per §S2.7 it does
**not** block the PR: build it, predict it, say it is unverified, open the PR anyway.

**It is the one claim in this work order that no check can settle**, and building a check
that appeared to settle it would be worse than leaving it open.
