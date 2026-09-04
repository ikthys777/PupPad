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

## 9. THE REVIEWER'S CLOSING SEQUENCE — A RETURN MUST BE RECORDED ON THE PR

*Added 2026-09-04, after a review lived only in a `SendMessage` and the builder then
compacted. **The project's own discipline, applied to the one artifact that had never
obeyed it.***

**Every other finding in this repo goes into `docs/feedback/` or `docs/findings/` precisely
so that a compaction cannot erase it. THE REVIEW — the thing that decides whether work
ships — was travelling by the one channel we already knew does not survive.**

**When CC-A returns a PR instead of merging it:**

1. **POST THE REVIEW ON THE PR.** `gh pr review --request-changes --body-file` when the
   reviewer is a different GitHub identity from the author; **`gh pr comment --body-file`
   otherwise** — the same App token opens and reviews here, and GitHub refuses
   *"Can not request changes on your own pull request"*. **Use `$HOME/bin/gh.real` with
   `GH_TOKEN`; the read-only shim overrides it and its 403 looks like a permission problem.**
2. **VERIFY IT RESOLVES**, exactly as the builder verifies its PR number. *A review that did
   not post is indistinguishable from one nobody wrote.*
3. **THEN `SendMessage`** — as a pointer to the comment, not as the record itself.

**Four things this buys, and the fourth is the one nobody predicted:**

- **The builder can re-read it after any compaction.** This is the whole reason.
- **Scotty can see why something did not merge** without asking either session.
- **The watchdog gets its signal for free.** *"Nobody looked"* and *"looked and sent back"*
  were **opposite states with identical evidence** — reviews 0, comments 0, branch unmoved —
  so a detector could only ever call a returned PR unclaimed, forever. **Note for whoever
  builds that check: `reviewDecision` will always be empty here**, because the same identity
  authors and reviews. **Key on a CC-A comment newer than the last push, not on a review.**
- **The reasoning survives the people.** A ruling delivered in chat is a ruling that has to
  be remembered; one on the PR is one that can be read.

> **A review is an artifact. If it exists only in a context window, it does not exist.**


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
- **A NEW CHECK MUST BE REGISTERED IN `ci.yml` IN THE SAME COMMIT THAT ADDS IT.** *A
  missing check and a passing one are the same colour* — the file runs on your machine,
  goes red on its plant, and does nothing for anyone else. **Four shipped unregistered
  across three work orders before anyone noticed.**
- **Where a claim needs hardware, build the check, state that it is UNVERIFIED, and
  stop.** A measurement that looks like a device result and is really a desktop result is
  worse than none. **Ask first whether the harness can even produce the symptom** —
  a test bed that honours a directive cannot reproduce a defect caused by it being ignored.
- **Security lens if and only if** the work reads, stores, renders or forwards a byte the
  device did not create. *(architecture §5)*
- **`index.html` is served from `main:/`.** A merge that touches it reaches the root
  build. `/stable/` is Scotty's alone.
