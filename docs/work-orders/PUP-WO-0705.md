# PUP-WO-0705 — The tile exception lives in the mechanism, not only in prose

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0705-thirdparty`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P7. **Subject SHA:** cite **symbols**.

**Grounds:** `docs/northstar.md` invariant 3 and §5, **both amended 2026-09-04** with one
named exception · `docs/architecture.md` §5, §10 · Scotty's ruling.

> **What this is:** Scotty ruled that the OpenStreetMap basemap stays, and the northstar
> now carries that as a **named exception** rather than a contradiction. **This work order
> is the other half of his ruling: the exception must live in a check, not only in a
> document.** Until it does, nothing stops a SECOND third-party origin arriving, and
> nothing distinguishes the approved one from a new one.

**Cadence:** build. One PR, left unmerged. **Small and self-contained by design.**

## 0a. THE FENCE
**MAY change:** `.github/`, `docs/`.
**MUST diff to empty:** `index.html`, `sw.js`, `manifest.json`, both icons, `games/`.
*(This work order changes no product behaviour. If you believe it must, that is a
flag-and-stop.)*

## 1. SCOPE — an allowlist of exactly one, asserted

**A new check that enumerates every origin the app contacts on a cold load and on opening
each panel, and asserts the set equals a declared allowlist.**

- **The allowlist is DECLARED IN ONE PLACE and cited, never duplicated.** Two copies of an
  allowlist drift, and then one is wrong while both look authoritative.
- **`tile.openstreetmap.org` is IN it, with the northstar amendment date beside it.**
- **A NEW third-party origin must go RED**, and that is the whole point of the work order.
- **The Leaflet and supabase-js CDN loads are NOT approved** — architecture §10 keeps them
  open. **Decide and say plainly** whether they belong in the allowlist as *recorded but
  unratified* or whether the check fails on them today. **If including them makes the
  check green on something nobody has ruled, say so rather than quietly allowlisting it.**
  *This is the one genuine judgement in the work order; bring it back with a
  recommendation rather than deciding it silently.*

## 2. INVARIANTS

- **3 — every core surface works with no network, EXCEPT the Map panel's basemap** by the
  2026-09-04 amendment. **A check that reds on the basemap is testing the exception, not a
  defect.** Do not "fix" the map.
- **6 — a game is a data change.** No game reaches a third-party origin; check 11 already
  covers that and this does not replace it.

## 3. ACCEPTANCE

1. **The fence holds** — `index.html`, `sw.js`, `manifest.json`, icons and `games/` diff
   to empty, checked as a command.
2. **The check goes RED on a planted second third-party origin**, and red **for its own
   stated reason**.
3. **The check goes GREEN on the tile origin alone** — and its pass line **names the
   exception and its date**, so a reader of a green run learns the exception exists.
4. **A control demonstrates the plant reproduces**, not merely that it applies.
   *A plant that applies is not a plant that reproduces* — architecture §5.
5. **The check installs and restores its own witnesses** and passes under `--only`.
   *A witness inherited from a neighbour is not a witness* — architecture §5.
6. **Registered in `ci.yml` in the same commit that adds it**, with its controls. Check 25
   enforces the equality; do not make it do so after the fact.
7. Every demonstration asserts the commit and the failing step name.

## 4. SCOPE FENCE — NOT here
- **Changing what the app fetches.** Not one byte of product behaviour.
- **Bundling tiles, lowering `maxZoom`, or removing the basemap** — all three were costed
  and **Scotty chose to keep it as is.** Do not reopen.
- **Resolving the Leaflet / supabase CDN question** — architecture §10, and it is Scotty's.
  Surface it; do not settle it.
- **The voice panel and Block Pop** — `PUP-WO-0703`, `0704`.

## 5. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze, corrections held until it returns.
Probes: a second origin added on a path the drive never walks · an origin reached only
after a panel opens · the allowlist satisfied by a substring rather than an origin
(`evil-openstreetmap.org.attacker.net`) · a check that passes because nothing was fetched
at all rather than because only the allowed thing was · the arrange failing silently.

## 6. UPWARD FEEDBACK — `docs/feedback/PUP-WO-0705.md`
**Lead with the Leaflet/supabase judgement and your recommendation.**

## 7. FLAG-AND-STOP
- **Any need to change `index.html`, `sw.js`, `manifest.json`, an icon, or `games/`.**
- A check that cannot be made to fail on a second origin.

## 8. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**

---

# §A — AMENDED 2026-09-10 BY SCOTTY'S RULING. **READ BEFORE JUDGING PR #70.**

**The spike this work order asked for was answered, and the answer changed the spec.** PR #70
was built to a question that is now settled — **judge it against this section, not §1.**

## A.1 THE MEASUREMENT THAT FORCED IT

`index.html` loads Leaflet from **cdnjs** and the basemap is built by **`L.tileLayer`**,
Leaflet's own constructor. Measured with every non-local request aborted: **cdnjs twice and
jsdelivr once on the COLD LOAD, and `tile.openstreetmap.org` — the one origin Scotty ratified
— ZERO TIMES.** **The ratified exception could not function without an origin nobody had
ratified.**

## A.2 THE RULING: VENDOR LEAFLET. DO NOT RATIFY cdnjs.

**Scotty, 2026-09-10.** Copy Leaflet into the repo and drop the CDN origin entirely. **Three
reasons, recorded so nobody reopens it:**

1. **It removes a third-party origin PERMANENTLY** rather than trusting a CDN not to serve
   altered JavaScript into a child's app.
2. **It makes the map's own code work offline** — moving the panel **toward** invariant 3
   rather than further from it.
3. **It leaves the allowlist with EXACTLY ONE entry.** *An allowlist of one is a far stronger
   assertion than an allowlist of two: a second entry appearing is unambiguous, where a third
   among two is a judgement call.*

**Cost: a one-time vendoring and owning updates, for a ~40 KB library stable for years.**

## A.3 THE SECOND ORIGIN — RAISED, NOT ASSUMED

**Scotty's ACTION names Leaflet. His REASON — "exactly one entry" — is not achieved by that
action alone**, because `cdn.jsdelivr.net` still serves **supabase-js** from the same
unconditional `<head>`. **Vendoring only Leaflet leaves the allowlist at TWO: the tile server
and jsdelivr.**

> **PUT TO SCOTTY, NOT DECIDED HERE:** *does the ruling extend to supabase-js?* Every one of
> his three reasons applies to it identically — **and the third reason is only true if it
> does.** *(It is a larger library and a network client rather than a renderer, which is the
> only thing that makes it a separate question rather than an oversight.)*

## A.4 WHAT PR #70 MUST BECOME — AND WHY IT IS NOT SIMPLY MERGED

**cdnjs and jsdelivr are no longer "unratified, awaiting a ruling." They are RULED FOR
REMOVAL.** That is a different state and the check must say so.

- **They stay in the pending list for now** — making them RED today would put CI red on `main`
  for work that has not landed yet, *and a red that is not a defect is how a suite gets
  ignored.*
- **But relabel them from OWED to `RULED FOR REMOVAL — tracked by PUP-WO-0707`.** An open
  question and a tracked debt are not the same thing, **and only one of them is a ruling.**
- **When `PUP-WO-0707` lands, the entries come out and the allowlist is the shape §1 was
  written for.**

## A.5 THE OPERATOR-CONFIGURED ORIGIN — CONFIRMED OUT OF SCOPE, AND SAY SO OUT LOUD

**Scotty: out of scope. It is operator-supplied CONFIGURATION, not a vendor the code chose** —
and his own framing on the wider question was that a second household would run its own
backend entirely.

**NAME IT AS EXCLUDED, IN THE CHECK AND IN THE DOC, NEVER BY SILENCE.** *A future reader must
be able to tell "considered and excluded" from "never thought about", and only one of those is
a ruling.* **That is `TEMPLATE.md` §9a applied to a check's own output** rather than to a
review — the same rule, one surface over.
