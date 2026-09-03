# TEMPLATE — every PupPad work order

**This file exists because `SendMessage` appeared in ZERO work orders while being a line
in `architecture.md`.** The park-then-notify handoff was therefore a **convention**, and
this repository's entire history is a catalogue of conventions decaying. *A green PR once
sat unclaimed for three hours because the builder's park never woke the reviewer.*

**Copy this file when authoring. Do not reproduce it from memory** — *"I will remember to
include it"* is the same class of failure as the convention it replaces.

---

# <PREFIX>-WO-PSNN[a] — <one line: what this is>

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `<sha>`; **verify live HEAD**).
**Branch:** `build/wo-NNNN`. **Author:** CC-A · **Builder:** `<session>`.
**Phase:** `<roadmap phase>` · **Phase exit gate:** `<the gate this counts toward>`.
**Subject SHA:** every citation resolved at **`<sha>`**, paired with the symbol it sits
in. *(`index.html` moves constantly. **The symbol is the anchor; the number is a hint.**
Audit them before dispatch — the header's claim has to be earned each time.)*

**Grounds:** northstar invariants by number · architecture sections · the roadmap phase ·
the code seams this rests on, as **file paths and symbols**.

> **What this is:** one paragraph. What it is, what it is NOT, why now.

**Cadence:** spike-first (then STOP) | build. One PR, left unmerged for review.

## 0. Corrections to the material this inherits  *(when applicable)*
## 1. Scope — numbered, specific
## 2. Invariants — restated BY NUMBER from the northstar, only the slice this touches
## 3. Tests / acceptance — proven, not asserted
## 4. Scope fence — what is NOT in this work order
## 5. Adversarial pass
## 6. Upward feedback — `FEEDBACK.md`, parked with the work
## 7. Flag-and-stop conditions

## 8. CLOSING SEQUENCE — FOUR NUMBERED STEPS, AND THE FOURTH IS THE ONE THAT DECAYS

**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**

1. **Push.**
2. **Open the PR**, left unmerged.
3. **VERIFY THE NUMBER RESOLVES.** *A PR that did not open is indistinguishable from one
   nobody read.*
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**

**A parked PR that does not wake the reviewer is work that is finished and invisible,
which costs exactly what work not done costs.**

---

## STANDING RULES EVERY WORK ORDER INHERITS

*Written here so each work order does not restate them and no work order omits them.*

- **A number is only ever correct at the viewport it was measured at.** Prefer a
  relation; if a number is unavoidable, say which viewport it was measured at, at the
  line. *(architecture §5)*
- **A requirement and its backstop must not be the same number** — if they are, the
  backstop eats the requirement's teeth and the check cannot fail.
- **Check the effect, never the installation.** A rect comes from style, not from ink —
  **and so does an attribute.**
- **An instrument must be able to demonstrate it would have seen the thing.**
- **Every plant must be a REAL DEFECT THAT PARSES, and red for its OWN STATED REASON.**
  A plant that changes whether the file parses is testing the loader.
- **Which code is older than the rule?** When a rule is extracted into a helper, the code
  that predates the helper is exactly the code that will not have it — **and it is never
  the code anyone re-reads.**
- **Where a claim needs hardware, build the check, state that it is UNVERIFIED, and
  stop.** A measurement that looks like a device result and is really a desktop result is
  worse than none. **Ask first whether the harness can even produce the symptom** —
  a test bed that honours a directive cannot reproduce a defect caused by it being ignored.
- **Security lens if and only if** the work reads, stores, renders or forwards a byte the
  device did not create. *(architecture §5)*
- **`index.html` is served from `main:/`.** A merge that touches it reaches the root
  build. `/stable/` is Scotty's alone.
