# PUP-WO-0705 — upward feedback

**Branch `build/wo-0705-thirdparty`, based on `main` at `bf17859` (verified live).**

> **STATE OF THIS DOCUMENT: the measurement is complete and the check is NOT YET BUILT.**
> Committed at this point deliberately, per TEMPLATE.md §9d — the analysis below is the
> thing a compaction would destroy, and it is the thing the build depends on.

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
> Block `cdnjs.cloudflare.com` and you do not merely lose Leaflet — **you lose the basemap
> he deliberately kept**, which is the outcome the 2026-09-04 amendment exists to prevent.

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
