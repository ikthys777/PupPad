# PUP-WO-0113 — Check 11 must scan code, not English

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0113-check11`. **Author:** CC-A · **Builder:** the PupPad builder.
**Phase:** P7. **Subject SHA:** cite **symbols**.

**Grounds:** `docs/northstar.md` invariant 3 · `docs/roadmap.md` §4a's `PUP-WO-0113` row,
which holds the reproduction and both traps · `.github/ci/check-games-offline.mjs`.

> **What this is:** **check 11 is the fail-closed gate northstar invariant 3 rests on, and
> it fires on English prose.** It has now BLOCKED A LEGITIMATE PR — `PUP-WO-0704`'s, at
> `games/blockpop.js:12`, reporting `import '.bp-flash'` **in a file whose only
> module-level construct is `export default function mount`.** The match is stitched from
> the word *"imports"* in a comment and a quoted CSS class name elsewhere in the file.

**Cadence:** build. One PR, left unmerged. **This blocks `PUP-WO-0704`.**

## 0a. THE FENCE
**MAY change:** `.github/`, `docs/`.
**MUST diff to empty:** `index.html`, `sw.js`, `manifest.json`, both icons, **`games/`.**

**THE FENCE IS THE RULING.** The tempting fix is to reword the comment in `blockpop.js`
until the scanner stops matching. **That is forbidden, and it is forbidden even though it
would work.**

## 1. THE DEFECT — a comment describing a behaviour its function cannot have

`check-games-offline.mjs` says, at `imports()`:

> *"Runs on the STRIPPED source for position fidelity but reads the specifier from the raw
> text"*

**It does not.** The executing lines operate on **`raw`**, which is the function's **only
parameter**. *There is no stripped source inside `imports()` to run on.* The comment
describes a two-source design that was never wired, and it has been read as a description
of what the code does — for months, by everyone, including CC-A.

**This is architecture §6.1's family in the gate that enforces an invariant:** a record
trusted because it was never contradicted.

## 2. TWO TRAPS FOR WHOEVER FIXES IT — both are in the roadmap row and both are real

1. **DO NOT BOUND THE `[\s\S]*?` GAP.** It is unbounded *deliberately*, so that
   `import{x}` and a specifier on the following line are both seen — **both evaded the
   previous line-based detector.** Bounding the gap reintroduces the evasion it exists to
   close. **The defect is the SOURCE it scans, not the gap.**
2. **POSITION FIDELITY IS WHY IT READS RAW.** Scanning a stripped source must **preserve
   the reported line number**, or the diagnostic degrades into "somewhere in this file" and
   the next real finding costs an hour to locate.

## 3. AND THE COST IS NOT THE FALSE RED

**A fail-closed gate that fires on prose teaches the next builder to work around it, and
the obvious workaround is loosening the pattern — which is how a real evasion gets in
through the door built to stop one.**

**That pressure has already operated once: the builder reworded their own comments to get a
commit through.** It is operating again now, on a PR that is not defective. **Every day
this stays broken makes the eventual loosening more reasonable-looking.**

## 4. SCOPE

**Strip comments and string literals before matching, and keep the reported line.** A
scanner that cannot tell code from prose is not a scanner.

- **Strip block comments, line comments, and string/template literals** — then match.
- **Report the line the construct is on in the ORIGINAL file.** Blank the stripped regions
  rather than deleting them, so offsets are preserved by construction rather than by
  arithmetic that has to stay correct.
- **Leave the pattern itself alone** unless a finding forces otherwise. **If you change it,
  say what evasion the old one caught that the new one must still catch, and prove it.**

## 5. ACCEPTANCE — proven, not asserted

1. **The fence holds** — `games/` and `index.html` diff to empty, checked as a command.
   **`games/blockpop.js` is NOT edited. Not one character.**
2. **The exact false positive is gone:** check 11 green on `PUP-WO-0704`'s head with
   `games/blockpop.js` byte-identical.
3. **EVERY EVASION THE CURRENT PATTERN CATCHES IS STILL CAUGHT.** Named, planted and shown
   red individually: at minimum `import{x} from 'y'`, a specifier on the line after the
   `from`, a bare specifier, and a remote URL. *A repair is a new assertion and inherits
   none of the old one's credibility — plant it.*
4. **A construct inside a comment or a string is NOT reported**, planted both ways: prose
   that looks like an import, and **a real import on the same line as a comment that also
   looks like one.**
5. **Line numbers are preserved** — a real import at a known line reports that line.
6. **The controls file covers every new branch**, and the check is registered (it already
   is; check 25 enforces it).
7. Every demonstration asserts the commit and the failing step name.

## 6. SCOPE FENCE — NOT here
- **`games/blockpop.js`, or any game module.** See §0a.
- **The celebration** — `PUP-WO-0704`, which this unblocks.
- **`PUP-WO-0110`'s check 14 flake** — different check, still queued.

## 7. ADVERSARIAL PASS
Fresh subagent, `git archive` freeze, corrections held until it returns.
Probes: a real import the stripper swallows · a comment terminator inside a string literal
and a quote inside a comment · a regex literal containing `//` · a template literal
containing `${}` and a quote · **a plant that applies without reproducing** · the reported
line drifting by one.

## 8. FLAG-AND-STOP
- **Any need to touch `games/` or `index.html`.**
- **A pattern change you cannot pair with the evasion it must still catch.**
- A stripper that cannot preserve line numbers.

## 9. CLOSING SEQUENCE
**Build → freeze → adversarial pass → disposition → `FEEDBACK.md` → then:**
1. **Push.** 2. **Open the PR**, unmerged. 3. **VERIFY THE NUMBER RESOLVES.**
4. **`SendMessage` to CC-A citing that number — AS THE LAST ACTION OF THE TURN.**
