# PupPad — Northstar

**Status:** ratified · 2026-08-31 · Scotty + Claude (chat architect)
**Gate:** Scotty ratifies. Changes here require re-ratification, never a work order.
**Supersedes:** nothing — first northstar for a repo that existed without one.
**Read next:** `docs/architecture.md` for shape, `docs/roadmap.md` for order.

---

## 1. The one sentence

**PupPad is a pretend command console a three-year-old can operate entirely on his
own, on a tablet, without reading a word and without reaching anything that is not
his.**

Note what it does not say: no framework, no host, no database. Replace every piece
of the stack and the sentence stands.

## 2. The problem, stated precisely

A three-year-old handed a tablet gets one of two things: an app built for someone
older, which he cannot operate alone, or an app built for his age, which is a
delivery vehicle for ads, accounts, and engagement mechanics. Buddy needs neither.
He needs a thing that is *his*, that responds to every tap, and that his father can
hand him without watching over his shoulder.

**Why existing tooling did not solve this.** Kids' apps optimise for retention,
which requires identity, progression, and a fail state — three things a
three-year-old does not need and one adult does not want. The gap was never "can
someone build a toy console"; it is that the toy has to be *ownable* by a
non-reader and *trustworthy* to the parent at the same time, and those two
constraints are usually traded against each other.

**The scar this addition comes from.** PupPad shipped and works — Buddy uses it.
What he does with it is press buttons and watch things happen. The console has no
sustained activity in it: every panel is a momentary effect. Gyre and Block Pop
exist as separate Grok-built web apps he cannot reach from the pad, which means
the thing he actually plays with lives somewhere he cannot navigate to alone. That
is the failure this phase closes.

## 3. End state

Buddy picks up the tablet. PupPad is already the home-screen icon; it opens
straight into the radar console, offline, no login. He taps the games button on the
right rail. A picker fills the screen with large tiles — one per game, picture and
word. He taps the particle field and it opens full-bleed; he drags sliders and the
field changes under his finger. He taps the paw to come back, taps the block game,
plays until he wanders off. Nothing he pressed asked him to read, sign in, or wait.

Meanwhile: his father merged four changes to the project that afternoon, and none
of them reached this tablet, because none of them had been promoted yet.

## 4. Invariants

Numbered because work orders cite them by number. Defined here and nowhere else.

| # | Invariant | How to falsify |
|---|---|---|
| **1** | Every control is operable by a non-reader. Text may label a control; it may never be the only way to know what the control does. *This invariant is the project.* | Cover all text on any surface. Find a control whose function cannot be inferred from its icon, colour, or immediate effect |
| **2** | From inside PupPad, no sequence of taps reaches another application, the device's settings, or an adult's data. | Starting at the console, reach any OS surface or non-PupPad content by tapping alone |
| **3** | Every core surface works with no network. Network may add capability; its absence may never remove a surface. | Cold-start from the home screen in airplane mode; find any surface that fails to open or renders unusable |
| **4** | The copy Buddy uses advances only when a human promotes it. Automated processes may publish for testing; they may never publish to him. | Land any commit through the automated path; observe the promoted copy change without a human action |
| **5** | No game can reach a state that ends play without a one-tap way back into it. | Play any game to any terminal state; find one where continuing requires an adult, a menu, or closing the app |
| **6** | Adding a game is a data change, not surgery. A new game touches its own module, one registry entry, and the asset manifest — nothing else. | Add a trivial game; count files changed outside those three |
| **7** | A device serves exactly one build's assets, never a mixture of two. | Load the promoted copy after the test copy has been cached; find any asset served from the other build |

## 5. Non-goals

Each carries its reason, because the reason is what stops it being re-proposed.

- **Accounts, profiles, or anything identifying Buddy.** This is a toy on a family
  tablet. An identity system creates a data-protection surface around a minor and
  buys nothing — there is no second user to distinguish him from.
- **Scores, leaderboards, streaks, or progression.** Every one of them imports a
  fail state, which invariant 5 forbids. This is the tempting-but-wrong version:
  progression is what makes a game feel finished to an adult designer, and what
  makes a three-year-old hand the tablet back upset.
- **Advertising, analytics, or any third-party network call.** Not a preference. A
  third-party call from a child's app is a category of thing this project will not
  contain.
- **Becoming a general kids-app platform.** PupPad is one child's console. The
  moment it is designed for other children it acquires configurability, and
  configurability is how invariant 1 dies.
- **Networked multiplayer, in this phase.** Deferred with intent, not rejected —
  see `docs/architecture.md` §7. A shared board needs authoritative state and
  conflict resolution; PupPad's existing realtime is fire-and-forget broadcast,
  where nobody is wrong if a message is late. Building it inside the first
  dual-CC pilot puts the hardest problem in the riskiest slot.

## 6. What would make this a failure

Each is plausible, not catastrophic — that is the point.

- Buddy needs an adult to get into or out of a game, so the console becomes a thing
  handed to him rather than a thing he owns.
- It breaks while he is playing, because a change reached his tablet before a human
  looked at it.
- Cold start slows as games accumulate until he taps the icon and waits, which for
  a three-year-old is the same as it not working.
- Adding a game turns out to require touching the console's core, so the second
  game gets added and the third never does.
- The games are technically excellent and he does not touch them, because they were
  designed against an idea of him rather than against watching him play.

## 7. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-08-31 | Document created. | Repo existed and shipped with no steering documents; first dual-CC pilot requires them as authority. |

## 8. Provenance

Written by Claude (chat architect) with Scotty, 2026-08-31, in a single planning
session covering the Gyre and Block Pop ports, the games surface, and the
dual-CC build process that will execute them.

Rests on: the running PupPad deployment (measured, see `docs/architecture.md` §3);
two Grok-generated source workspaces provided as uploads; and
`dual-cc-session-design-v2.md` (2026-08-29), which governs the build process and
is an input to these documents rather than one of them.

**Thin by admission:** §3's walkthrough describes intended behaviour that has not
been observed, because it does not exist yet. Everything in §4 is testable today
except invariants 4, 6, and 7, which describe structure this phase creates.
