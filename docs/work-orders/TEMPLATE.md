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

### 9c. CHECK THE FENCE WITH THREE DOTS, NOT TWO

*Added 2026-09-04, after the builder found and disclosed that every fence check they had run
used the wrong comparison.*

**`git diff origin/main..branch` compares two MOVING TIPS.** While a branch is open, `main`
advances — and the two-dot diff then reports **the reviewer's own commits as the builder's
deletions.** It was harmless the first two times only because `main` happened not to have
moved yet.

```
git diff --stat origin/main...branch -- <fenced paths>     # three dots: from the MERGE BASE
```

**It fails in the direction that matters:** a fence violation can be masked by an unrelated
change on `main` touching the same file, and a clean branch can be accused of deleting work
it never saw. **The co-architect skill already says two questions need two refs — *what is in
this PR* against the live base, *what did the builder touch* against `git merge-base`. This
is that rule, as a command.**

*Disclosed by the builder unprompted, having found it while re-verifying something else.*

### 9b. THE DISPATCH IS AN ARTIFACT TOO

*Added 2026-09-04, after a dispatch was delivered to a live session that was not the one
doing the work.*

**The work order file has always been the artifact. What was still travelling by message was
the DIRECTIVE TO ACT ON IT** — which round, which findings, what changed since.

- **Put the instruction where the work is:** a PR comment for a returned PR, the work-order
  file for a new one. **Addressed to the work, so any session, fork or restart finds it.**
- **`SendMessage` carries the NUDGE and a pointer.** Nothing in it may be information that
  cannot be reconstructed from the artifact.
- **NEVER treat a send receipt as arrival.** `SendMessage` returning `success` means it was
  delivered to the session that name resolved to — **which is not necessarily the session in
  the pane.** A session that has forked keeps its name on the PARENT.
- **Confirm arrival by an effect**, on the next cycle: a push, a comment, a PR that moved.
  *If nothing moved, assume it did not arrive rather than that the builder is slow.*
- **When you mean "whoever is working in that pane", address the PANE**, not a name.

### 9a. RECORD WHAT WAS EXAMINED AND UPHELD, NOT ONLY WHAT WAS CHANGED

*Added 2026-09-04, same ruling.*

**A review that lists only requested changes makes the builder's judgment invisible.** Every
design call the builder made and the reviewer examined and KEPT belongs in the record by
name, with the reason it survived — **not merely left unmentioned.**

Three reasons, and the third is the one that pays:

- **Silence is ambiguous.** *"Not mentioned"* reads identically as *not noticed*, *noticed
  and tolerated*, and *examined and endorsed.* Only one of those is a ruling.
- **It protects a good decision from the next reader.** An upheld call that is written down
  survives the reviewer; one that is merely un-objected-to gets re-litigated by whoever comes
  next, usually against the work order's original wording rather than the reasoning that
  beat it.
- **UPHOLDING JUDGMENT ON THE RECORD IS WHAT MAKES THE NEXT FLAG-AND-STOP CREDIBLE.** A
  builder who is only ever corrected learns that raising a deviation costs something. A
  builder whose deviations are examined and sometimes ratified **in writing** learns that
  the channel works — and that is the channel this whole arrangement depends on.

**The builder's `FEEDBACK.md` records the deviation; the reviewer's PR comment records the
ruling on it. Both, every time.**



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
