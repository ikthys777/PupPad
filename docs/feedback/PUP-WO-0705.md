# PUP-WO-0705 — upward feedback

**Branch `build/wo-0705-thirdparty`, based on `main` at `bf17859` (verified live).**

> **The measurement below was committed BEFORE the check existed**, per TEMPLATE.md §9d —
> it is the thing a compaction would destroy and the thing the build depends on. The check
> is built, controlled and registered now; the header saying otherwise survived into a
> pushed commit and was caught by the adversarial pass, which is a small instance of
> exactly the defect this repository keeps finding: **a description that outlived what it
> described.**

---

# THE JUDGEMENT THE WORK ORDER ASKED FOR, LED WITH

**§1 asks whether the Leaflet and supabase-js CDN loads belong in the allowlist as
*recorded but unratified*, or whether the check should fail on them today.**

**Neither, quite — because the measurement says the two are not independent of the
approved exception, and that changes the question.**

## What the app actually contacts, measured

Every non-local request intercepted and **aborted**, so the measurement never performed the
egress it was measuring. Cold load, then each of the eight pads opened in turn:

| origin | requests | when | ratified? |
|---|---|---|---|
| `https://cdnjs.cloudflare.com` | 2 | **cold load**, before any panel | **NO** — Leaflet CSS + JS |
| `https://cdn.jsdelivr.net` | 1 | **cold load**, before any panel | **NO** — supabase-js UMD |
| `https://{s}.tile.openstreetmap.org` | **0** | never reached | **YES**, 2026-09-04 |

**Both unratified origins load unconditionally on every cold start, before a child touches
anything. The one ratified origin was never contacted at all.**

## And the reason it was never contacted is the finding

With the two CDNs blocked, opening the Map panel raises **`L is not defined`**, and
`window.L` is `undefined`. The basemap is built at `index.html:3227` by
`L.tileLayer('https://{s}.tile.openstreetmap.org/...')` — **Leaflet's constructor.**

> **The exception Scotty ratified cannot function without an origin nobody ratified.**
> On a cold cache, block `cdnjs.cloudflare.com` and you do not merely lose Leaflet — **you
> lose the basemap he deliberately kept**, which is the outcome the 2026-09-04 amendment
> exists to prevent.

**The qualifier matters and the first version of this paragraph omitted it.** `sw.js`
caches cross-origin opaque responses deliberately, so on a **warm** device Leaflet is
served from cache and the map works offline — **until a `CACHE_VERSION` bump reaps it**,
which the northstar's own 2026-09-04 row records taking the map from 24 of 24 tiles to 0
of 24. The dependency is real and the ratification question is unchanged; the urgency is
"on a cold cache and after every cache version bump", not "always".

**So ratifying the OSM basemap implicitly ratified `cdnjs.cloudflare.com`, and that is a
decision he may not know he made.** It is not mine to make either way; it is the thing to
put in front of him.

## Recommendation — for CC-A and Scotty, not settled here

1. **The allowlist stays exactly one RATIFIED origin**: `tile.openstreetmap.org`, dated
   2026-09-04. The work order's central claim survives intact.
2. **A second, closed, named list of UNRATIFIED origins — exactly two — declared in the
   same single place**, each carrying what it is and that nobody has ruled on it. It is not
   a way of approving them; it is a way of **making them impossible to forget**.
3. **Anything in neither list is RED.** That is the whole point of the work order and it is
   preserved: a new third-party origin fails, and growing the unratified list is a
   deliberate source change a reviewer sees.
4. **The check is GREEN today, and its pass line says both things** — it names the
   ratified exception with its date, and it names the two unratified origins as **OWED**.
   *A reader of a green run learns the exception exists AND that two more are unruled.*

**Why green rather than red on the unratified pair:** the northstar's own amendment says
*"a faithful check enforcing invariant 3 would go RED on approved behaviour, and a red that
is not a defect is how a suite gets ignored."* A check that is red on `main` from the day
it lands teaches people to ignore it, and it would be red on shipping behaviour that CC-A
explicitly says is Scotty's call and not mine.

**Why not silently allowlist them:** §1 says *"if including them makes the check green on
something nobody has ruled, say so rather than quietly allowlisting it."* **It does, and the
mechanism says so on every single run, by name, in the pass line — not only here in a
document that a green build does not make anyone open.**

**What I recommend Scotty is actually asked**, in one sentence: *the basemap you kept needs
Leaflet from a CDN to exist at all — do you ratify that origin too, or should the map ship
with Leaflet vendored locally so the exception costs one origin instead of two?*

---

# §5 — THE ADVERSARIAL PASS, AND ITS DISPOSITION

**Fresh subagent, `git archive` freeze of `ffa18cb`, corrections held until it returned.**
Six confirmed defects. **The two that mattered were both in the check, and one of them made
this file's central promise false.**

## The check was PERFORMING the egress it exists to measure

**`context.route` does not intercept a WebSocket handshake.** A planted
`new WebSocket('wss://realtime.example.net/socket')` was recorded nowhere, the check printed
PASSED — **and a listener on the far end received the upgrade.** The header claimed *"every
non-local request is intercepted and ABORTED … it runs identically on a machine with no
network."* **It did not, and the one exception is the kind supabase-js realtime uses for the
canvas, voice, map and camera channels.**

`WebSocket` is now replaced before any page script runs, by a constructor that **records and
refuses to connect**. The pass enumerated the other kinds — `fetch`, `img`, `script`,
`link`, XHR, EventSource, `sendBeacon`, iframe, `audio` — and every one was already seen and
aborted. **WebSocket was the sole miss, which is exactly why "the witness proved a `fetch`
is intercepted" is not the same claim as "the kinds this app makes are intercepted."**

## The allowlist said "origin" and implemented "hostname"

`http://cdnjs.cloudflare.com/beacon.gif` and `https://cdn.jsdelivr.net:8443/beacon.gif` both
measured **GREEN**. A plaintext downgrade from a child's app is not the same security fact
as the HTTPS load that was recorded, and a different port is a different service. Every
predicate tests a full origin now — scheme, host and port — and §3's hostile list carries
all three cases plus `ws://`.

## `--only=1` reported green on an app that was never walked

§1's guards lived inside `if (want(2))`. So `--only=1` printed §1's green line for an app
whose pad handlers never ran, **and for one that fetched nothing at all** — and the controls
file runs every scenario with `--only=<section>`, **so its GREEN control was graded in the
one mode where "only allowed things were fetched" and "nothing was fetched" are the same
result.** The guards are computed outside every section now, and §1 refuses to report
without them.

**And the comment above that code claimed the opposite of what the code did** — *"every
section that needs the recorder builds its own context … so `--only` is the same measurement
as a full run."* One drive, one context, and `--only` was demonstrably not the same
measurement. **A sentence asserting the acceptance criterion it sits above, while the code
did not meet it.**

## The GREEN control was a no-op, and no control demonstrated the thing it named

*"the shipped app, with the two CDN loads removed, is still GREEN"* removed **one** of three
tags. Both `cdnjs` tags survived, so the verdict was identical to the unmutated baseline.
Worse, its label — and the banner in both the controls file and `ci.yml` — claimed *"the
approved origin alone stays GREEN"*, and **the approved origin is never contacted in this
environment at all.** It now removes all three tags and issues a real tile request above the
first `L.` reference, so the fixture contacts the ratified origin and nothing else.

## Two smaller ones

**This document said the check did not exist** — the §9d state header survived into a pushed
commit. **And the headline over-claimed by one qualifier**: on a *warm* device the worker
serves Leaflet from cache, so the basemap works offline until a `CACHE_VERSION` bump reaps
it. Both corrected above.

---

# WHAT THIS CHECK CANNOT SEE — stated, not closed

**The walk reaches eight pads. It does not reach everything, and the pass mapped the gaps
precisely. Each is GREEN today with a planted third-party request:**

| blind region | why |
|---|---|
| **the Settings panel** | reached by a gear the drive never presses |
| **anything on a timer longer than the walk** | a 30 s beacon outlives a ~13 s drive |
| **~180 of `openTreasureMap`'s 261 lines** | it throws at `L.map(` because Leaflet is aborted, so everything below is dead code here |
| **the Supabase sync path** | gated on `localStorage` keys a fresh context never has; on a configured device it polls a **fourth** origin every 3 s |
| **`games/*.js`** | the drive taps pad 7 and never mounts a tile — correctly check 11's, per §2 |

**The third is the one to weigh, because it is created by the check's own design:** aborting
the unratified CDN is what makes 180 lines of the Map panel unreachable, so the check is
systematically blind to any origin in them. That is the same fact as the central judgement,
seen from the instrument's side.

**The Supabase one is the one I did not close and want ruled on.** Seeding a Supabase URL
would make the check RED, because an operator-supplied origin cannot be allowlisted — it is
different on every device. **I am not willing to invent that policy inside a work order that
says "not one byte of product behaviour".** It wants a decision: is a parent-configured sync
origin inside this allowlist's scope at all, or is it a separate class?

**And one assertion has no control and structurally cannot get one from this controls file:**
the witness itself. Check 28's only mutation surface is `index.html`, and nothing planted
there can break the route handler. *An assertion never shown red is not yet a check* — said
plainly rather than left for the next pass to find.
