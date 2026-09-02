/* GYRE — the particle field, ported from the React/Zustand original into a PupPad
 * game module. PUP-WO-0300.
 *
 * WHAT THIS FILE IS. `sim.ts`, `palettes.ts`, `backgrounds.ts` and `store.ts` from
 * ~/PupPad-sources/gyre/src/components/field/, collapsed into ONE module. One file is
 * not tidiness: PUP-WO-0000 section 9.1 constrains a registry `module` to a flat
 * `games/<name>.js`, and roadmap P2 gate 2 counts the things adding a game touches.
 * Splitting palettes into their own file would add a second module AND a second
 * urlsToCache line, turning the gate's three into five for no gain a child can see.
 *
 * WHAT IT IS NOT. It is not the control surface. PUP-WO-0301 builds that, and the
 * seam it attaches to is `host.gyre` at the bottom of mount() — deliberate, documented
 * and the same object the demonstrations drive. See the block comment there.
 *
 * THE THREE THINGS THIS FILE MUST NEVER DO, and each is a CI check, not a promise:
 *   - reach the network (check 11; northstar invariant 3),
 *   - leave anything running after teardown (PUP-WO-0000 section 8.1),
 *   - need reading to operate (northstar invariant 1). Everything here is colour,
 *     motion and sound. There is not one word of text in what it draws.
 */

/* ============================ COLOUR ========================================
 * PUP-WO-0300 section 3: "more colour, everywhere". The work order says six palettes
 * and six backgrounds exist today; THE SOURCE HAS FIVE OF EACH — counted, not
 * recalled (PALETTE_IDS and BACKGROUND_IDS in the originals). Reported rather than
 * quietly matched, because a count in prose that nothing recomputes is exactly the
 * defect this project has already ruled on twice.
 *
 * Eleven palettes and ten backgrounds ship here. The five originals are byte-for-byte
 * their source values, so a like-for-like comparison is still possible; everything
 * after the marked line is new.
 *
 * `cycle` IS NEW AND IT IS THE ONE THAT CARRIES INVARIANT 1. A palette with
 * `cycle: n` rotates its whole hue base n degrees per second, so the field drifts
 * through the spectrum on its own with nobody touching anything. A non-reader does
 * not need to be told the toy is alive; it demonstrates it. */
const PALETTES = [
  /* --- the five from palettes.ts, unchanged --- */
  { id: 'ice',     hueBase: 188, hueSpan:  64, sat: 78, lit: 64, cycle: 0, hex: '#5fd8f0' },
  { id: 'aurora',  hueBase: 168, hueSpan: 150, sat: 76, lit: 66, cycle: 0, hex: '#5ff0b0' },
  { id: 'solar',   hueBase:  28, hueSpan:  38, sat: 84, lit: 62, cycle: 0, hex: '#f0a640' },
  { id: 'jade',    hueBase: 148, hueSpan:  36, sat: 70, lit: 60, cycle: 0, hex: '#4fc98c' },
  { id: 'silver',  hueBase: 210, hueSpan:  16, sat:  8, lit: 80, cycle: 0, hex: '#cdd2da' },
  /* --- new in PUP-WO-0300 --- */
  { id: 'rainbow', hueBase:   0, hueSpan: 300, sat: 88, lit: 66, cycle: 16, hex: '#ff6ec7' },
  { id: 'candy',   hueBase: 322, hueSpan:  74, sat: 90, lit: 70, cycle: 0, hex: '#ff7ad0' },
  { id: 'sunset',  hueBase:   8, hueSpan:  84, sat: 90, lit: 64, cycle: 0, hex: '#ff7a52' },
  { id: 'lagoon',  hueBase: 176, hueSpan: 100, sat: 84, lit: 62, cycle: 6, hex: '#3fe0d0' },
  { id: 'grape',   hueBase: 272, hueSpan:  70, sat: 82, lit: 68, cycle: 0, hex: '#b98cff' },
  { id: 'lemon',   hueBase:  52, hueSpan:  46, sat: 92, lit: 66, cycle: 0, hex: '#ffe14d' },
];

/* Backgrounds. `light: true` flips the compositing from `lighter` to `multiply` and
 * darkens the particles, which is why a light background is not simply a pale colour:
 * it is a different draw path. Two of the ten are light, deliberately — a child who
 * lands on one should still see a field, not a white rectangle. */
const BACKGROUNDS = [
  /* --- the five from backgrounds.ts, unchanged --- */
  { id: 'void',    rgb: [  7,   8,  10], light: false, hex: '#07080a' },
  { id: 'abyss',   rgb: [ 10,  18,  32], light: false, hex: '#0a1220' },
  { id: 'pine',    rgb: [  8,  20,  15], light: false, hex: '#08140f' },
  { id: 'ember',   rgb: [ 22,  10,   8], light: false, hex: '#160a08' },
  { id: 'fog',     rgb: [216, 212, 204], light: true,  hex: '#d8d4cc' },
  /* --- new in PUP-WO-0300 --- */
  { id: 'plum',    rgb: [ 22,   9,  28], light: false, hex: '#16091c' },
  { id: 'cocoa',   rgb: [ 26,  17,  11], light: false, hex: '#1a110b' },
  { id: 'deepsea', rgb: [  5,  22,  30], light: false, hex: '#05161e' },
  { id: 'night',   rgb: [ 14,  12,  34], light: false, hex: '#0e0c22' },
  { id: 'shell',   rgb: [230, 222, 232], light: true,  hex: '#e6dee8' },
];

const PALETTE_MAP = {};
for (const p of PALETTES) PALETTE_MAP[p.id] = p;
const BACKGROUND_MAP = {};
for (const b of BACKGROUNDS) BACKGROUND_MAP[b.id] = b;

/* ============================ PARAMETERS ====================================
 * Ranges are store.ts's unchanged. ONE DEFAULT IS NOT: `count` ships at 1200 against
 * the source's 1800, which is a measured decision made twice — the first commit on this
 * branch shipped 1600 and a throttled measurement lowered it again. The reasoning and
 * both numbers are in docs/feedback/PUP-WO-0300.md section 6. `polarity` is new. Every one of them
 * is clamped on the way in from BOTH directions — a control in PUP-WO-0301 and a
 * saved blob from api.load() — because `api.load()` returns whatever localStorage
 * holds, and localStorage is a place a previous version, a corrupted write or a
 * curious adult can leave anything at all. */
const COUNT_MIN = 250, COUNT_MAX = 5000, COUNT_STEP = 50;
const FORCE_MIN = 0.15, FORCE_MAX = 1.85;
const RANGE_MIN = 0, RANGE_MAX = 100;

/* ATTRACT / REPEL — PUP-WO-0300 section 3, addition 1, and the largest visible change
 * available from one control. In sim.ts the pointer force term is
 *   vx += (nx * attract + -ny * swirl) * fall * dt / m
 * and `polarity` is a multiplier on `attract` alone. +1 pulls the field into the
 * finger, -1 pushes it away; the swirl term keeps its sign either way, so repel is a
 * fountain rather than a plain shove, which reads better and is the whole point.
 * PUP-WO-0301 puts a control on this. It needs exactly one two-state affordance —
 * no slider, no label; see the note at `host.gyre`. */
const POLARITY_ATTRACT = 1, POLARITY_REPEL = -1;

/* Defaults. count is the one measured decision in this file — see the frame-rate
 * numbers in docs/feedback/PUP-WO-0300.md. The original shipped 900 on a narrow
 * viewport and 1800 otherwise; the tablet this runs on is neither a phone nor a
 * desktop, and the trade is stated there rather than implied here. */
const DEFAULT_COUNT_NARROW = 900;
const DEFAULT_COUNT_WIDE = 1200;

/* THE DRAW BUDGET, AND IT IS MEASURED. §3 lists performance among the things the
 * latitude does NOT relax — "a field that stutters is not delightful" — and the
 * randomizer is the one control that can walk into a stutter with nobody choosing it.
 *
 * Cost is dominated by three parameters together, not by `count` alone: every particle
 * is a stroke, `size` is how wide that stroke is and `tail` is how long, so what the
 * GPU pays tracks `count * (1 + size/100 + tail/100)` closely. Measured on a CI runner
 * throttled 6x, which is a crude but repeatable stand-in for a cheap tablet:
 *
 *     count 1200  size 86  tail 88   ->  37.8 fps      product 3288
 *     count 1600  size 60  tail 55   ->  33.7 fps      product 3440
 *     count 1500  size 70  tail 70   ->  31.6 fps      product 3600
 *     count 1800  size 50  tail 40   ->  31.5 fps      product 3420
 *     count 1300  size 86  tail 88   ->  29.2 fps      product 3562
 *     count 2600  size 86  tail 88   ->  17.9 fps      product 7124   <- unusable
 *
 * The last line is what randomize could produce before this existed. So the count it
 * draws is bounded by the budget rather than by a fixed ceiling, and a randomize that
 * picks a fat, long-tailed field gets fewer particles to draw it with. THE SLIDERS ARE
 * NOT BOUNDED BY THIS: a child dragging count to 5000 is exploring and gets to. The
 * difference is that he chose it and can drag it back. */
const DRAW_BUDGET = 3400;
const drawCost = (count, size, tail) => count * (1 + size / 100 + tail / 100);

/* `shape` (PUP-WO-0301 section 2.2b) scales the stroke, and therefore the cost. These
 * three numbers are the ONLY home for the multipliers: draw() reads them and so does
 * randomize's budget. Writing them twice is what this file already warns PUP-WO-0301
 * not to do with the ranges, and the cost model is exactly the kind of thing where a
 * second copy is invisible until a field stutters. `dot` draws no tail, so it is
 * cheaper than its width alone suggests. */
const SHAPE_WIDTH = { streak: 1, dot: 1.55, ribbon: 1.9 };
const SHAPE_TAIL  = { streak: 1, dot: 0,    ribbon: 1.35 };
const SHAPE_COST  = { streak: 1, dot: 1.25, ribbon: 1.6 };

const clampNum = (n, lo, hi, fallback) => {
  const v = typeof n === 'number' && isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
};
/* EVERY CLAMP TAKES THE FALLBACK FROM ITS CALLER. An earlier version hard-coded a
 * factory value inside `clampCount` and `clampForce` while the range clamps fell back
 * to the CURRENT value, so `set('count', someInput.value)` on a non-numeric string
 * silently reset the field to 1200 while `set('tail', …)` on the same garbage held its
 * ground. Two behaviours for one mistake, and PUP-WO-0301 will make that mistake the
 * first time it passes an <input>'s value through. Now a bad write is always a no-op. */
const clampCount = (n, fallback) => {
  const base = clampNum(n, COUNT_MIN, COUNT_MAX, fallback);
  return clampNum(Math.round(base / COUNT_STEP) * COUNT_STEP, COUNT_MIN, COUNT_MAX, fallback);
};
const clampForce = (n, fallback) => clampNum(n, FORCE_MIN, FORCE_MAX, fallback);
const clampRange = (n, fallback) => Math.round(clampNum(n, RANGE_MIN, RANGE_MAX, fallback));
const clampPolarity = (n) => (n === POLARITY_REPEL ? POLARITY_REPEL : POLARITY_ATTRACT);
/* THESE TWO TAKE THE FALLBACK FROM THE CALLER TOO, and until PUP-WO-0301 they did
 * not. `set('palette', anythingElse)` snapped the field to `ice` — a RESET on a bad
 * write, which is the exact behaviour the numeric clamps above were fixed to stop
 * doing and which docs/feedback/PUP-WO-0300.md section 9 states as a rule this seam
 * obeys: "a bad value is a no-op, not a reset". Two of nine setters did not obey it.
 * A swatch strip cannot send a bad id, so nothing observable changed for the control
 * this work order builds — the point is that the rule is now true of every setter
 * rather than of seven of them, and a later control that passes a stale id through
 * gets a no-op instead of a silent jump to ice. */
const clampPalette = (v, fallback) => (typeof v === 'string' && PALETTE_MAP[v] ? v
  : (typeof fallback === 'string' && PALETTE_MAP[fallback] ? fallback : 'ice'));
const clampBackground = (v, fallback) => (typeof v === 'string' && BACKGROUND_MAP[v] ? v
  : (typeof fallback === 'string' && BACKGROUND_MAP[fallback] ? fallback : 'void'));

/* ---- THE EFFECT SWITCHES — PUP-WO-0301 section 2.2b ------------------------
 * "Every effect you can reasonably expose as a toggle or a slider, expose. The ripple
 * is the first example, not the exception." These five are the effects that were
 * hard-coded constants in PUP-WO-0300 and are now settings, which means they are
 * clamped, persisted, randomised and exposed on exactly the same footing as `count`.
 *
 * EVERY DEFAULT IS TODAY'S BEHAVIOUR. `ripple: 1, glow: 1, spin: 0, edge: 'wrap',
 * shape: 'streak'` is the field PUP-WO-0300 shipped, so a child who never opens the
 * panel sees no change at all and a saved blob from before this work order sanitises
 * to the look it was saved from. The one exception is deliberate and is the work
 * order's own finding: the ripple itself is redrawn (section 2.2a). */
const SHAPES = ['streak', 'dot', 'ribbon'];
/* `edge` — wrap versus walls under ATTRACT — WAS BUILT, MEASURED AND REMOVED, and the
 * removal is the finding rather than the code. It read well on paper: the branch already
 * existed for repel, so exposing it added no mechanism, and "the field piles into the
 * corners instead of wrapping" is a difference a child could notice.
 *
 * Check 19 measured it at 0.60 against a floor of 1.0 that every other control clears by
 * between 1.6x and 100x. It is not a threshold problem. Under attract the field is
 * GATHERED AT THE FINGER, so almost nothing is at an edge for the boundary rule to act
 * on; the difference is real but it takes tens of seconds to accumulate, and roadmap P3
 * gate 1 says "visibly within one second of being dragged".
 *
 * §2.2b says do not trim for tidiness and §7 says a control that cannot be made operable
 * by a non-reader does not ship, "better absent than present-and-uninterpretable". A
 * control that does nothing a child can see in a second is uninterpretable in the way
 * that matters — he presses it, nothing happens, and he learns the panel lies. So it
 * goes, and it goes on a number rather than on taste. Walls remain bound to repel, where
 * PUP-WO-0300 proved they are load-bearing. */
/* A flag is 0 or 1 and NOT a boolean, because it goes through `api.save` into JSON,
 * comes back through `sanitise`, and is compared with `===` in `set`. One type in,
 * one type out, one comparison. `true`/`false` are accepted on the way in because a
 * control surface written against this seam will reasonably send them. */
const clampFlag = (n, fallback) => (n === 1 || n === true ? 1
  : n === 0 || n === false ? 0
  : (fallback === 1 || fallback === true ? 1 : 0));
const clampOneOf = (list, v, fallback) => (list.indexOf(v) !== -1 ? v
  : (list.indexOf(fallback) !== -1 ? fallback : list[0]));

function defaultsFor(width) {
  return {
    count: width > 0 && width < 640 ? DEFAULT_COUNT_NARROW : DEFAULT_COUNT_WIDE,
    force: 0.68, burst: 50, tail: 32, size: 40, linger: 60,
    palette: 'ice', background: 'void', polarity: POLARITY_ATTRACT,
    /* `glow` DEFAULTS OFF, and that is the faithful default rather than the tidy one.
     * Until now the glow drew only for a FINE pointer, so on the tablet this app runs on
     * there has never been one. Defaulting it to 1 would have been "today's behaviour"
     * on a desktop and a new thing appearing under Buddy's finger — the opposite of what
     * every other default here does. It is a control, and he can turn it on. */
    ripple: 1, glow: 0, spin: 0, shape: 'streak',
  };
}

/* Every field, named once, so `sanitise` cannot silently drop one that a later
 * addition forgets to list. */
function sanitise(raw, width) {
  const d = defaultsFor(width);
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    count: clampCount(typeof o.count === 'number' ? o.count : d.count, d.count),
    force: clampForce(typeof o.force === 'number' ? o.force : d.force, d.force),
    burst: clampRange(o.burst, d.burst),
    tail: clampRange(o.tail, d.tail),
    size: clampRange(o.size, d.size),
    linger: clampRange(o.linger, d.linger),
    palette: clampPalette(o.palette, d.palette),
    background: clampBackground(o.background, d.background),
    polarity: clampPolarity(o.polarity),
    ripple: clampFlag(o.ripple, d.ripple),
    glow: clampFlag(o.glow, d.glow),
    spin: clampFlag(o.spin, d.spin),
    shape: clampOneOf(SHAPES, o.shape, d.shape),
  };
}

/* ============================ RANDOMIZE EVERYTHING ==========================
 * PUP-WO-0300 section 3, addition 2: the highest joy-per-tap control available to a
 * non-reader. No reading, no aiming, a different world every press.
 *
 * THE HARD PART IS NOT THE RANDOMNESS, IT IS THE WORD "USABLE". A uniform draw over
 * the declared ranges produces unusable fields regularly, and each of these was
 * reachable before the bounds below were narrowed:
 *   count at 250 with size at 0        -> a nearly empty screen
 *   force at 0.15 with burst at 0      -> a field that does not respond to a touch
 *   force at 1.85 with linger at 0     -> a hard flicker, and the reason `linger`
 *                                         has a floor here that the slider will not
 *   the same palette AND background    -> a press that visibly did nothing, which
 *   drawn twice in a row                  is invariant 1's problem, not a cosmetic one
 *
 * So randomize does NOT sample the full slider ranges. It samples the USABLE
 * interior of each and guarantees a visible difference. The sliders keep their full
 * range — a child dragging one to an extreme is exploring, and gets to; a child
 * pressing the dice is asking for a surprise, and a surprise that shows nothing is a
 * broken toy. The two are different promises. */
const RANDOM_BOUNDS = {
  count: [800, 1800],
  force: [0.35, 1.35],
  burst: [35, 100],
  tail: [18, 88],
  size: [26, 86],
  linger: [28, 92],
};

const randIn = ([lo, hi]) => lo + Math.random() * (hi - lo);
const pickOther = (list, current) => {
  /* `list[0]` on a one-element list returns the CURRENT value, and on an empty list
   * returns undefined — which becomes PALETTE_MAP[undefined] and a throw in draw().
   * Unreachable from the shipped tables, both of which are non-empty literals, but the
   * guard read as though it handled those cases and it did not. */
  if (!list || !list.length) return current;
  if (list.length < 2) return list[0];
  let v = current;
  /* Bounded, not a while(true): a PRNG that returns the same value forever is a
   * hang, and a hang inside a tap handler is a child staring at a frozen toy. */
  for (let i = 0; i < 12 && v === current; i++) v = list[(Math.random() * list.length) | 0];
  return v === current ? list[(list.indexOf(current) + 1) % list.length] : v;
};

const PALETTE_IDS = PALETTES.map((p) => p.id);
const BACKGROUND_IDS = BACKGROUNDS.map((b) => b.id);

/* Returns a WHOLE new settings object. Palette and background are both forced to
 * change, so "five consecutive taps, five visibly different fields" (roadmap P3 gate
 * 2) holds by construction rather than by luck. Polarity is drawn freely: it changes
 * how the field answers a finger, which is visible the moment one lands. */
function randomSettings(current) {
  const size = clampRange(randIn(RANDOM_BOUNDS.size), 40);
  const tail = clampRange(randIn(RANDOM_BOUNDS.tail), 32);
  /* THE EFFECT SWITCHES ARE DRAWN TOO — but not all five, and the two that are held
   * fixed are held fixed for the same reason `linger` has a floor here that the slider
   * does not (see RANDOM_BOUNDS): randomize promises a surprise that SHOWS something.
   *
   *   `shape`, `spin`, `edge`  are drawn. Each changes the field on sight.
   *   `ripple` and `glow`      are forced ON. They are the toy's two answers to a
   *                            finger. A dice roll that silently removed the feedback
   *                            for touching the screen would be a press that made the
   *                            toy less responsive, with nothing on screen saying why —
   *                            and the child cannot read the panel to find out which
   *                            switch moved. The switches stay reachable in the panel;
   *                            the dice will not turn them off behind him. */
  const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
  /* count is drawn LAST because its ceiling depends on how expensive the stroke it
   * has to draw already is — see DRAW_BUDGET. The floor is the bounds' own floor: a
   * budget that could starve the field down to nothing would be trading one unusable
   * result for another. */
  /* Solved through `drawCost` itself rather than by re-inlining the formula. An earlier
   * version wrote the expression twice and left `drawCost` unreferenced — two
   * specifications of one cost model, which is the exact thing this file warns
   * PUP-WO-0301 not to do with the ranges. */
  /* `shape` MULTIPLIES THE STROKE, so it multiplies the cost, and the budget has to
   * see it or the ceiling it computes is a ceiling on a cost model that no longer
   * describes the draw. `ribbon` is ~1.9x the line width of `streak` and `dot` is
   * ~1.55x with no tail at all; these are the measured width multipliers from draw(),
   * referenced rather than restated — SHAPE_COST is the single home for them. */
  const countHi = Math.max(RANDOM_BOUNDS.count[0], Math.min(RANDOM_BOUNDS.count[1], DRAW_BUDGET / (drawCost(1, size, tail) * SHAPE_COST[shape])));
  /* FLOORED TO THE STEP, not rounded. `clampCount` rounds to the nearest 50, so a
   * ceiling of 1240.9 became 1250 and a cost of 3425 against a stated budget of 3400 —
   * a bound the code was described as respecting and did not. */
  const countMax = Math.max(COUNT_MIN, Math.floor(countHi / COUNT_STEP) * COUNT_STEP);
  return {
    count: clampCount(randIn([RANDOM_BOUNDS.count[0], countMax]), RANDOM_BOUNDS.count[0]),
    force: clampForce(randIn(RANDOM_BOUNDS.force)),
    burst: clampRange(randIn(RANDOM_BOUNDS.burst), 50),
    tail: tail,
    size: size,
    linger: clampRange(randIn(RANDOM_BOUNDS.linger), 60),
    palette: pickOther(PALETTE_IDS, current.palette),
    background: pickOther(BACKGROUND_IDS, current.background),
    polarity: Math.random() < 0.5 ? POLARITY_ATTRACT : POLARITY_REPEL,
    ripple: 1,
    /* NOT DRAWN, AND NOT FORCED EITHER — carried through. The glow is the one effect
     * that sits ON TOP of the finger, and the finger is where attract and repel differ:
     * roadmap P3 gate 3 is "attract/repel visibly inverts in one tap", and a bright halo
     * over the hole repel digs is a decoration that hides a control. A dice press must
     * not switch that on behind the child; if he chooses it, that is his trade to make. */
    glow: current.glow,
    spin: Math.random() < 0.4 ? 1 : 0,
    shape: shape,
  };
}

/* ============================ SOUND =========================================
 * PUP-WO-0300 section 2.1's payoff. `api.tone(hz, ms, wave)` is the shell primitive
 * built by this work order; this is a game using it, which is the half that makes the
 * primitive worth having.
 *
 * A TAP MAKES A PITCH, AND THE PITCH IS THE HEIGHT OF THE TAP. High on the screen is
 * a high note, low is a low note. That mapping needs no explanation and no reading —
 * it is the same one a xylophone teaches in one go, and PUP-WO-0000's escalation
 * named a xylophone as the thing the twelve-cue bank cannot express.
 *
 * QUANTISED TO A PENTATONIC SCALE so it cannot sound wrong. Any sequence of taps
 * anywhere on the screen is consonant; a chromatic mapping would let a child produce
 * a semitone clash by accident and learn that the toy sometimes sounds bad. */
const PENTATONIC = [0, 2, 4, 7, 9];
const TONE_ROOT = 220;      /* A3 */
const TONE_STEPS = 18;      /* three and a half octaves of the scale */

function toneForHeight(fraction) {
  const f = Math.min(1, Math.max(0, isFinite(fraction) ? fraction : 0.5));
  const step = Math.min(TONE_STEPS - 1, Math.max(0, Math.round((1 - f) * (TONE_STEPS - 1))));
  const semitones = PENTATONIC[step % PENTATONIC.length] + 12 * Math.floor(step / PENTATONIC.length);
  return TONE_ROOT * Math.pow(2, semitones / 12);
}

/* ============================ THE SIMULATION ================================
 * sim.ts, near 1:1. It was already framework-free apart from its typing, which is why
 * this is a port and not a rewrite. What changed, and only these:
 *
 *   1. `polarity` multiplies the attract term AND, when it is negative, the swirl
 *      term is cut as well — see the block in step(). The first version of this list
 *      said only "the attract term", which understated what the code does.
 *   2. `pal.cycle` rotates hueBase with time            (section 3, "more colour")
 *   3. tap RINGS — a coloured ring expands from every touch
 *   4. `reduced` comes from api.prefersReducedMotion rather than a second
 *      matchMedia call, because the shell already answered that question and two
 *      sources for one fact is how they drift
 *   5. `stop()` is idempotent and clears the handle, so a double teardown cannot
 *      cancel a frame id that has since been reissued to somebody else
 *   6. a tap RE-SEEDS THE FIELD FROM A ZERO-SIZED START. `resize()` reseeds if the
 *      first layout it saw was 1x1, which the original never recovered from
 *   7. a burst follows the polarity: in repel it PULLS particles to the tap instead of
 *      pushing them away, because in repel there are none under the finger to push
 *   8. a ring is drawn even at `burst: 0`, where the original did nothing at all. That
 *      is deliberate — the ring answers "did I do that?", and a tap that registers
 *      should say so whether or not the burst parameter moves anything
 *
 * RINGS ARE ADDITION 3 AND THE REASON IS CAUSATION. A three-year-old's tap moves a
 * few hundred particles a few pixels; that is a consequence he can miss. A ring is
 * unmissable, it starts exactly under the finger, and it costs one arc per ring per
 * frame with at most eight alive. It answers "did I do that?" with yes. */
const TAU = Math.PI * 2;
const HUE_BUCKETS = 16;
const MAX_DPR = 2;
/* THE TAP RIPPLE — PUP-WO-0301 section 2.2a, and this is a LIVE FINDING from Scotty
 * on the real device: it "reads as a HARSH FLASH rather than a ripple".
 *
 * What made it a flash, measured against the numbers it shipped with: a 2-to-8px hard
 * stroke at alpha 0.55 under `lighter` compositing, appearing at full brightness on
 * the frame of the tap and crossing 210px in 0.55s. Full brightness with no attack is
 * a flash by definition; a hard stroke has no edge to soften; and 380px/s reads as a
 * snap rather than a spread.
 *
 * All three are addressed, and the work order asked for exactly these three:
 *   SOFTER EDGE    a radial-gradient annulus that fades to nothing on both sides,
 *                  instead of a stroke with two hard boundaries.
 *   LONGER FALLOFF life nearly doubles and the radius eases OUT, so it decelerates
 *                  as it spreads rather than travelling at a constant rate.
 *   LOWER PEAK     0.55 -> 0.26, and it is reached over the first ~10% of the life
 *                  rather than on frame one.
 * RING_MAX drops from 8 to 5 because each ring is now a gradient fill rather than a
 * stroke, and the lives are twice as long, so twice as many would overlap. */
const RING_LIFE = 1.05;
const RING_MAX = 5;
const RING_REACH = 180;
const RING_PEAK = 0.26;
const RING_BAND_MIN = 10, RING_BAND_GROW = 34;

/* THE FLOOR UNDER A PARTICLE'S STROKE, AND IT IS THE FIX FOR AN ALL-BLACK SCREEN.
 *
 * A particle is drawn as a line from where it is to where it was: `lineTo(x - vx*tail,
 * …)`. The length of that line is PROPORTIONAL TO SPEED, and a repelled field settles —
 * the wrap makes every edge continuous, so "away from the finger" converges on the
 * pointer's antipode, the force there is zero, and the damping (0.935 per 60ths of a
 * second) takes the rest. Measured on the field this shipped with, at settings squarely
 * inside the randomizer's own range, with nobody touching it:
 *
 *     t = 3 s    6.4% of pixels lit      t = 30 s   0.0%, max luminance 9
 *     t = 10 s   0.9%                    t = 45 s   0.0%, max luminance 9
 *
 * Nine is the background. The screen was BLACK — and a tap bought a 400 ms flash and
 * went black again, and dragging into the corners where the particles actually are made
 * it worse, because repel pins them harder the closer the finger gets. Half of every
 * randomize press sets repel. PUP-WO-0300 section 3 says in as many words: "every
 * result must be a usable field — no all-black, no zero particles."
 *
 * The particles were all still there and all still being drawn: 1200 moveTo/lineTo pairs
 * a frame, every coordinate finite. They were sub-pixel, and a sub-pixel stroke paints
 * nothing. So a stroke shorter than this floor is drawn at the floor instead — a dot
 * rather than nothing. It cannot change the look at any setting where the field is
 * moving, because there the stroke is already longer; it can only ever put back a
 * particle that would have been invisible. A still field is a starfield, which is a
 * field. A blank screen is not. */
const MIN_SEG = 0.4;
/* See the block in step(). Both are measured, not guessed: the pair below is what
 * opens a visible hole within a second without ever flinging the field off canvas —
 * and it cannot, because the wrap conserves every particle whatever the force. */
const REPEL_GAIN = 2.4;
const REPEL_SWIRL = 0.4;

class GyreSim {
  constructor(canvas, getSettings, reduced) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('gyre: canvas 2d is unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.getSettings = getSettings;
    this.x = new Float32Array(COUNT_MAX);
    this.y = new Float32Array(COUNT_MAX);
    this.vx = new Float32Array(COUNT_MAX);
    this.vy = new Float32Array(COUNT_MAX);
    this.hue = new Float32Array(COUNT_MAX);
    this.mass = new Float32Array(COUNT_MAX);
    this.raf = 0;
    this.running = false;
    this.lastTs = 0;
    this.w = 1; this.h = 1;
    this.px = 0; this.py = 0;
    this.pvx = 0; this.pvy = 0;
    this.lastPx = 0; this.lastPy = 0;
    this.held = false;
    this.pointerSeen = false;
    this.reduced = !!reduced;
    this.coarse = false;
    this.time = 0;
    this.bgId = null;
    this.seeded = false;
    this.rings = [];
    this.frames = 0;          /* frames drawn — the frame-rate demonstration reads this */
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    try { this.coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { this.coarse = false; }
    this.resize();
    this.reseed();
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  /* Idempotent, and it clears the handle. `cancelAnimationFrame` on an id that has
   * already fired is harmless; on an id the browser has since REISSUED it is not. */
  stop() {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  resize() {
    const rect = this.canvas.parentElement
      ? this.canvas.parentElement.getBoundingClientRect()
      : this.canvas.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const oldW = this.w, oldH = this.h;
    this.w = nextW; this.h = nextH;
    this.canvas.width = Math.floor(nextW * dpr);
    this.canvas.height = Math.floor(nextH * dpr);
    this.canvas.style.width = nextW + 'px';
    this.canvas.style.height = nextH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* A FIELD SEEDED INTO A 1x1 CANVAS NEVER RECOVERS, and the original does not either.
     * `start()` seeds every particle into [0,w)x[0,h); if the host had not been laid out
     * the whole field is a single pixel, and the rescale below is guarded on
     * `oldW > 1` — which is false exactly then — so real dimensions arriving later
     * rescale nothing. Measured on the source's logic: 6 of 48 grid cells ever inked,
     * still 6 after three seconds. Not reachable through today's shell, because `host`
     * is fixed inset:0 and mount runs after layout. Reachable the moment anything
     * mounts this into a hidden or unlaid-out node, which is what a picker overlay
     * might do. Reseeding is one line and removes the whole class. */
    if (this.seeded && oldW <= 1 && oldH <= 1 && nextW > 1 && nextH > 1) {
      this.w = nextW; this.h = nextH;
      this.reseed();
      return;
    }
    if (!this.pointerSeen) {
      this.px = nextW * 0.5; this.py = nextH * 0.5;
      this.lastPx = this.px; this.lastPy = this.py;
    } else if (oldW > 1 && oldH > 1) {
      const sx = nextW / oldW, sy = nextH / oldH;
      this.px *= sx; this.py *= sy;
      this.lastPx = this.px; this.lastPy = this.py;
      for (let i = 0; i < COUNT_MAX; i++) { this.x[i] *= sx; this.y[i] *= sy; }
    }
    this.paintBackground(1);
  }

  setPointer(x, y) { this.px = x; this.py = y; this.pointerSeen = true; }
  setHeld(held) { this.held = held; }

  /* A tap. Shoves nearby particles outward and drops a ring. The ring hue is taken
   * from the palette's own span, so a splash can never be a colour the field is not
   * already wearing — "more colour" is not "any colour". */
  burst(x, y) {
    const settings = this.getSettings();
    const pal = PALETTE_MAP[settings.palette];
    const burstMul = settings.burst / 50;
    /* Gated at the SOURCE as well as at the draw, so an off ripple is not an array
     * quietly filling and expiring behind a switch that says nothing is happening. */
    if (settings.ripple && this.rings.length < RING_MAX) {
      this.rings.push({ x: x, y: y, t: this.time, hue: this.hueBaseNow(pal) + (Math.random() - 0.5) * pal.hueSpan });
    }
    if (burstMul <= 0) return;
    const count = Math.min(COUNT_MAX, Math.max(0, settings.count | 0));
    const force = settings.force;
    /* THE TAP FOLLOWS THE POLARITY, and this is a correction the adversarial pass
     * earned. In repel the disc under the finger is EMPTY — that is the whole point of
     * repel — so a burst that only ever pushes outward has nothing to push, and
     * `burst` becomes an invisible parameter in a mode `randomize` picks half the time.
     * Measured: attract moved the ink under the finger by 18%, repel by 0.0%. Roadmap
     * P3 gate 1 is per-parameter, so an invisible one is a failed gate.
     * Flipping the sign makes the tap GATHER in repel mode — it briefly fills the hole
     * and then the field pushes it back out, which is both visible and a nicer toy than
     * a shove. One multiplier, and the parameter is observable in both modes. */
    const dir = settings.polarity < 0 ? -1 : 1;
    for (let i = 0; i < count; i++) {
      const dx = this.x[i] - x, dy = this.y[i] - y;
      const d = Math.hypot(dx, dy) + 0.001;
      if (d > 190) continue;
      const falloff = 1 - d / 190;
      const mag = (280 + force * 220) * burstMul * falloff * falloff * dir;
      this.vx[i] += (dx / d) * mag;
      this.vy[i] += (dy / d) * mag;
    }
  }

  clearTrails() { this.paintBackground(1); }
  /* A partial repaint. `clearTrails` erases the field; this only dims what is already
   * drawn, which is what a palette change needs — see the note at `set`. */
  fadeTrails(alpha) { this.paintBackground(Math.min(1, Math.max(0, alpha))); }

  reseed() {
    const pal = PALETTE_MAP[this.getSettings().palette];
    const base = this.hueBaseNow(pal);
    for (let i = 0; i < COUNT_MAX; i++) {
      this.x[i] = Math.random() * this.w;
      this.y[i] = Math.random() * this.h;
      const ang = Math.random() * TAU;
      const spd = 8 + Math.random() * 28;
      this.vx[i] = Math.cos(ang) * spd;
      this.vy[i] = Math.sin(ang) * spd;
      this.hue[i] = base + (Math.random() - 0.5) * pal.hueSpan;
      this.mass[i] = 0.55 + Math.random() * 0.95;
    }
    this.rings.length = 0;
    this.seeded = true;
    this.paintBackground(1);
  }

  /* The cycling palettes' whole implementation. Everything downstream reads hueBase
   * through here, so `cycle` needed no other change anywhere. */
  hueBaseNow(pal) {
    /* `spin` (PUP-WO-0301 section 2.2b) is `cycle` promoted from a per-palette constant
     * to a control. Two of the eleven palettes cycle; the other nine could not, and a
     * child who liked the drifting colour had to find `rainbow` to get it. With spin on,
     * every palette drifts at a floor of 14 deg/s and the two that already cycle faster
     * keep their own rate — `Math.max`, not an override, so switching spin on can only
     * ever add motion. */
    /* 26 DEG/S, RAISED FROM 14 ON A MEASUREMENT. At 14 the drift was inside the noise
     * of a field that is already changing every frame — check 19 read it at 0.06 against
     * a floor of 1. A control the instrument cannot see is a control a child cannot see.
     * 26 deg/s is a full turn of the spectrum in fourteen seconds. */
    const cycle = this.getSettings().spin ? Math.max(pal.cycle, 26) : pal.cycle;
    return cycle ? (pal.hueBase + this.time * cycle) % 360 : pal.hueBase;
  }

  paintBackground(alpha) {
    const bg = BACKGROUND_MAP[this.getSettings().background];
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(' + bg.rgb[0] + ',' + bg.rgb[1] + ',' + bg.rgb[2] + ',' + alpha + ')';
    ctx.fillRect(0, 0, this.w, this.h);
  }

  frame(ts) {
    if (!this.running) return;
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 1 / 60;
    this.lastTs = ts;
    this.step(dt);
    this.frames++;
    this.raf = requestAnimationFrame(this.frame);
  }

  step(dt) {
    const settings = this.getSettings();
    const bg = BACKGROUND_MAP[settings.background];
    const pal = PALETTE_MAP[settings.palette];
    if (bg.id !== this.bgId) { this.bgId = bg.id; this.paintBackground(1); }

    const count = Math.min(COUNT_MAX, Math.max(0, settings.count | 0));
    const force = settings.force;
    const heldMul = this.held ? 2.35 : 1;

    /* ATTRACT/REPEL, AND WHY IT IS MORE THAN THE SIGN THE WORK ORDER PREDICTED.
     *
     * §3 says the flip "is a sign on the force term" and calls it the largest visible
     * change available from a single control. The first half is true and the second
     * did not follow: with ONLY the sign flipped, measured in a browser, attract and
     * repel are almost the same picture. Both give a swirling soup. The numbers, mean
     * ink distance from the finger, are in docs/feedback/PUP-WO-0300.md — 14% apart
     * after EIGHT SECONDS, and indistinguishable at one.
     *
     * Three things conspire. The swirl term does not flip, so the tangential motion
     * that dominates the look is identical either way. The damping is heavy — velocity
     * decays with a quarter-second time constant — so the radial term only ever buys a
     * slow drift. And the field WRAPS at every edge, so particles pushed away return
     * on the far side and the distribution re-symmetrises.
     *
     * So repel is SHAPED, not merely signed: the radial push is stronger and the swirl
     * is cut, which turns "drifts outward while orbiting" into "runs away", and opens a
     * hole under the finger a three-year-old can see the instant he touches. Attract is
     * untouched and is still the original's number. This is the latitude §3 grants
     * being used for the reason it was granted — the alternative was shipping a control
     * that satisfies its description and fails its gate. */
    const repelling = settings.polarity < 0;
    const walls = repelling;
    const attract = 210 * force * heldMul * settings.polarity * (repelling ? REPEL_GAIN : 1);
    const swirl = 165 * force * (this.held ? 1.55 : 1) * (repelling ? REPEL_SWIRL : 1);
    const stir = this.held ? 0.55 : 0.32;
    this.time += dt;

    this.pvx = (this.px - this.lastPx) / dt;
    this.pvy = (this.py - this.lastPy) / dt;
    const pSpeed = Math.hypot(this.pvx, this.pvy);
    const pCap = pSpeed > 2400 ? 2400 / pSpeed : 1;
    const svx = this.pvx * pCap, svy = this.pvy * pCap;
    this.lastPx = this.px; this.lastPy = this.py;

    const cx = this.pointerSeen ? this.px : this.w * 0.5;
    const cy = this.pointerSeen ? this.py : this.h * 0.5;

    const x = this.x, y = this.y, vx = this.vx, vy = this.vy, hue = this.hue, mass = this.mass;
    const damp = Math.pow(this.held ? 0.9 : 0.935, dt * 60);
    const wander = this.reduced ? 4 : 10;
    const hueBase = this.hueBaseNow(pal);

    for (let i = 0; i < count; i++) {
      const dx = cx - x[i], dy = cy - y[i];
      const d = Math.sqrt(dx * dx + dy * dy) + 18;
      const inv = 1 / d;
      const nx = dx * inv, ny = dy * inv;
      const fall = 1 / (0.012 * d + 1);
      const m = mass[i];
      vx[i] += ((nx * attract + -ny * swirl) * fall * dt) / m;
      vy[i] += ((ny * attract + nx * swirl) * fall * dt) / m;

      const pd = Math.hypot(x[i] - cx, y[i] - cy);
      if (pd < 150 && pSpeed > 12) {
        const wgt = (1 - pd / 150) * stir;
        vx[i] += svx * wgt * dt;
        vy[i] += svy * wgt * dt;
      }

      vx[i] += Math.sin(this.time * 0.7 + i * 0.37) * wander * dt;
      vy[i] += Math.cos(this.time * 0.55 + i * 0.29) * wander * dt;
      vx[i] *= damp; vy[i] *= damp;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;

      /* THE WRAP IS WHAT MADE REPEL BLACK THE SCREEN, AND THIS COMMENT USED TO SAY THE
       * OPPOSITE. It said the wrap "is what makes repel safe — nothing can be flung
       * off-canvas and lost". Nothing is lost. Everything ends up in the twenty-pixel
       * MARGIN OUTSIDE THE CANVAS that the wrap needs in order to hide the seam.
       *
       * A repelled particle is pushed outward until it passes `w + 20`, is teleported to
       * `-20`, and is immediately outside on the other side — where the force points
       * outward again. It ping-pongs across the two invisible margins and never comes
       * back. Measured on the shipped field: particle 0 sitting at exactly (920, 660) on
       * a 900x640 canvas, every particle in the same state, 1200 strokes a frame all
       * drawn off-screen, and a screen whose maximum luminance was the background value.
       * Thirty seconds of repel, from settings the randomizer picks half the time.
       *
       * So repel does not wrap. It has WALLS: the field is pushed away from the finger
       * and piles up against the edges, where a child can see it, and a small bounce
       * keeps it alive rather than welded to the boundary. Attract keeps the torus
       * exactly as the source had it — that path is unchanged and still bit-exact.
       *
       *
       * PUP-WO-0301 EXPOSED THIS AS A CONTROL AND THEN TOOK IT BACK OUT on a measurement;
       * see the note at SHAPES. `walls` is a name rather than an expression because the
       * condition was briefly two things, and one name for one rule is the shape this
       * file wants even when the rule is one term long. */
      if (walls) {
        if (x[i] < 0) { x[i] = 0; vx[i] = -vx[i] * 0.3; }
        else if (x[i] > this.w) { x[i] = this.w; vx[i] = -vx[i] * 0.3; }
        if (y[i] < 0) { y[i] = 0; vy[i] = -vy[i] * 0.3; }
        else if (y[i] > this.h) { y[i] = this.h; vy[i] = -vy[i] * 0.3; }
      } else {
        if (x[i] < -20) x[i] = this.w + 20;
        else if (x[i] > this.w + 20) x[i] = -20;
        if (y[i] < -20) y[i] = this.h + 20;
        else if (y[i] > this.h + 20) y[i] = -20;
      }

      const spd = Math.hypot(vx[i], vy[i]);
      hue[i] = hueBase
        + Math.sin(this.time * 0.22 + i * 0.01) * (pal.hueSpan * 0.35)
        + Math.min(spd * 0.12, pal.hueSpan * 0.55);
    }

    this.draw(count, settings, bg, pal, hueBase);
  }

  draw(count, settings, bg, pal, hueBase) {
    const ctx = this.ctx, w = this.w, h = this.h;
    const linger = Math.min(1, Math.max(0, settings.linger / 100));
    const fadeBase = 0.28 * Math.pow(1 - linger, 1.35) + 0.022;
    const fade = this.reduced
      ? Math.min(0.3, fadeBase + 0.08)
      : this.held ? fadeBase * 0.7 : fadeBase;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(' + bg.rgb[0] + ',' + bg.rgb[1] + ',' + bg.rgb[2] + ',' + fade + ')';
    ctx.fillRect(0, 0, w, h);

    const sat = bg.light ? Math.min(42, pal.sat * 0.55) : pal.sat;
    const lit = bg.light ? Math.min(34, pal.lit * 0.5) : pal.lit;

    /* THE GLOW IS A CONTROL NOW, AND THE CONDITION HAD TO CHANGE FOR IT TO BE AN
     * HONEST ONE. `!this.coarse` alone means the glow never draws on a touch device —
     * which is every device this app runs on. A switch labelled "glow" that does
     * nothing at all on the tablet is a control that lies, and "make a control lie" is
     * one of section 5's own probes. So on a coarse pointer the glow draws WHILE HELD:
     * hold a finger down and a halo appears under it, let go and it fades with the
     * field. On a fine pointer nothing changes — it still tracks the cursor. */
    if (settings.glow && (!this.coarse || this.held)) {
      const glowR = this.held ? 210 : 150;
      const glow = ctx.createRadialGradient(this.px, this.py, 0, this.px, this.py, glowR);
      const a0 = this.held ? 0.16 : bg.light ? 0.08 : 0.09;
      const lit0 = 'hsla(' + hueBase + ',' + sat + '%,' + (bg.light ? 30 : 78) + '%,';
      const clear = 'hsla(' + hueBase + ',' + sat + '%,50%,0)';
      if (this.coarse) {
        /* A RING ON A TOUCH DEVICE, A DISC ON A MOUSE, and the difference is not
         * cosmetic. On a coarse pointer the finger is ON the spot the glow would fill,
         * and that spot is the only place attract and repel look different — repel digs
         * a HOLE under the finger and a filled halo paints straight over it. Roadmap P3
         * gate 3 wants that inversion visible in one tap, so the glow is drawn as a halo
         * AROUND the contact point with a transparent core, which reads as light coming
         * off the finger and leaves the hole a hole. On a fine pointer the cursor is a
         * point rather than a pad and the original disc is kept unchanged. */
        /* THE CORE STAYS CLEAR OUT TO 0.6 OF THE RADIUS, and that number is not
         * aesthetic: check 19 measures the polarity inversion in a 100px disc under the
         * finger, and repel's hole has to survive with the glow ON or the glow is a
         * decoration that hides a control. At glowR 210 the clear core is 126px, so the
         * halo begins outside the disc that carries gate 3's evidence.
         *
         * The peak is 2.1x the fine-pointer alpha because the first version, a thin band
         * at the mouse alpha, measured 0.11 against a floor of 1 — visible to nobody. */
        glow.addColorStop(0, clear);
        glow.addColorStop(0.6, clear);
        glow.addColorStop(0.85, lit0 + (a0 * 2.1) + ')');
        glow.addColorStop(1, clear);
      } else {
        glow.addColorStop(0, lit0 + a0 + ')');
        glow.addColorStop(1, clear);
      }
      ctx.fillStyle = glow;
      ctx.fillRect(this.px - glowR, this.py - glowR, glowR * 2, glowR * 2);
    }

    /* `shape` — PUP-WO-0301 section 2.2b. Three looks out of the stroke the field is
     * already drawing, with no second draw path and no new per-particle state:
     *   streak  what PUP-WO-0300 shipped, unchanged in every respect.
     *   dot     no tail at all, a wider round cap — the field becomes a swarm of
     *           beads instead of a set of trails. MIN_SEG below is what makes this
     *           work: a zero-length segment is floored to a dot rather than dropped.
     *   ribbon  a butt cap and a near-double width, which reads as flat woven bands.
     * The multipliers live in SHAPE_WIDTH/SHAPE_TAIL beside DRAW_BUDGET, because
     * randomize's cost ceiling has to read the same numbers this does. */
    const shape = settings.shape;
    ctx.globalCompositeOperation = bg.light ? 'multiply' : 'lighter';
    /* `square`, NOT `butt`, AND THAT IS A DEFECT THE MEASUREMENT FOUND. A butt cap on a
     * segment shorter than a pixel paints almost nothing, and MIN_SEG floors every slow
     * particle's stroke to 0.4px — so `ribbon` DISAPPEARED wherever the field was calm.
     * Measured on a bare canvas: 1600 particles covered 1.76% of the screen as dots and
     * 1.00% as ribbons, which is the wrong way round for a shape that is supposed to be
     * the fattest of the three. A square cap paints the full width either way and keeps
     * the flat, woven look that distinguishes it from `streak`'s round ends. */
    ctx.lineCap = shape === 'ribbon' ? 'square' : 'round';
    ctx.lineJoin = 'round';

    const x = this.x, y = this.y, vx = this.vx, vy = this.vy, hue = this.hue;
    const tailScale = this.reduced ? 0.45 : 1;
    const tail = (0.004 + (settings.tail / 100) * 0.09) * tailScale * (SHAPE_TAIL[shape] !== undefined ? SHAPE_TAIL[shape] : 1);
    const lineWidth = ((bg.light ? 0.55 : 0.7) + (settings.size / 100) * 2.8) * (SHAPE_WIDTH[shape] !== undefined ? SHAPE_WIDTH[shape] : 1);
    const span = pal.hueSpan || 1;
    const hueMin = hueBase - pal.hueSpan * 0.5;

    for (let b = 0; b < HUE_BUCKETS; b++) {
      const h0 = hueMin + (b / HUE_BUCKETS) * pal.hueSpan;
      ctx.beginPath();
      ctx.strokeStyle = 'hsla(' + h0 + ',' + sat + '%,' + lit + '%,' + (bg.light ? 0.55 : 0.72) + ')';
      ctx.lineWidth = lineWidth;
      let any = false;
      for (let i = 0; i < count; i++) {
        const bucket = Math.floor(((hue[i] - hueMin) / span) * HUE_BUCKETS);
        const bi = ((bucket % HUE_BUCKETS) + HUE_BUCKETS) % HUE_BUCKETS;
        if (bi !== b) continue;
        let ex = -vx[i] * tail, ey = -vy[i] * tail;
        if (ex * ex + ey * ey < MIN_SEG * MIN_SEG) { ex = MIN_SEG; ey = 0; }
        ctx.moveTo(x[i], y[i]);
        ctx.lineTo(x[i] + ex, y[i] + ey);
        any = true;
      }
      if (any) ctx.stroke();
    }

    /* The tap rings. Drawn last so nothing hides them, and expired in the same pass
     * that draws them — an array that only ever grows is a leak with a slow fuse. */
    if (settings.ripple && this.rings.length) {
      const alive = [];
      for (let r = 0; r < this.rings.length; r++) {
        const ring = this.rings[r];
        const age = (this.time - ring.t) / RING_LIFE;
        if (age >= 1) continue;
        alive.push(ring);
        /* Decelerating spread. `1 - (1-age)^2.2` covers most of the distance early and
         * then slows, which is what a ripple on water does and what a flash does not. */
        const radius = 14 + (1 - Math.pow(1 - age, 2.2)) * RING_REACH;
        /* The band WIDENS as it travels, so the edge gets softer the further out it
         * gets rather than staying a fixed-width line that simply moves. */
        const band = RING_BAND_MIN + age * RING_BAND_GROW;
        const alpha = RING_PEAK * Math.min(1, age / 0.10) * Math.pow(1 - age, 2);
        if (alpha <= 0.004) continue;
        const outer = radius + band;
        const g = ctx.createRadialGradient(ring.x, ring.y, Math.max(0, radius - band), ring.x, ring.y, outer);
        const col = 'hsla(' + ring.hue + ',' + Math.max(sat, 60) + '%,' + (bg.light ? 40 : 66) + '%,';
        g.addColorStop(0, col + '0)');
        g.addColorStop(0.5, col + alpha + ')');
        g.addColorStop(1, col + '0)');
        ctx.fillStyle = g;
        /* CLIPPED TO THE CANVAS. A gradient fill is paid per pixel, unlike the stroke
         * it replaces, and a ring near a corner would otherwise pay for three quadrants
         * that are not on screen. Five of these a frame is the worst case. */
        const x0 = Math.max(0, ring.x - outer), y0 = Math.max(0, ring.y - outer);
        const x1 = Math.min(w, ring.x + outer), y1 = Math.min(h, ring.y + outer);
        if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      this.rings = alive;
    } else if (this.rings.length) {
      /* Switched off mid-flight: the rings already in the air go now, rather than
       * expiring invisibly over the next second while the switch says off. */
      this.rings.length = 0;
    }

    if (!this.coarse && this.pointerSeen) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(this.px, this.py, this.held ? 5.5 : 3.5, 0, TAU);
      ctx.fillStyle = bg.light ? 'rgba(20,22,26,0.7)' : 'rgba(236,236,232,0.85)';
      ctx.fill();
    }
  }
}

/* ============================ THE MODULE ====================================
 * PUP-WO-0000 section 8.1: mount(host, api) -> teardown. Everything below is either
 * the port's wiring or one of the obligations that contract exists to enforce. */
export default function mount(host, api) {
  /* --- the canvas ---------------------------------------------------------- */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;'
    + 'touch-action:none;-webkit-user-select:none;user-select:none';
  /* A label for a screen reader, which is not the same audience as a non-reader and
   * costs nothing. Nothing DRAWN here is text. */
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A field of coloured particles that follows your finger.');
  host.appendChild(canvas);

  /* --- state, and the persistence that survives api.load() returning null --- */
  /* `|| window.innerWidth` because a host with no layout yet reports 0, and 0 is not
   * "narrow" — it is "unknown", and the old expression sent it down the WIDE branch. */
  const hostWidth = Math.round(host.getBoundingClientRect().width) || window.innerWidth || 0;
  /* `api.load()` MAY RETURN NULL AND THE GAME MUST RUN CORRECTLY WHEN IT DOES
   * (PUP-WO-0000 section 8.3). It returns null on a first run, in private mode, after
   * a storage clear, and whenever the stored JSON is unparseable. `sanitise` takes
   * null, a string, a number, an array or a half-filled object and returns a complete
   * settings object every time — so there is exactly one path, and the null case is
   * not a branch that can rot untested. */
  let loaded = null;
  try { loaded = api.load(); } catch (e) { loaded = null; }
  /* `api.entry.params` IS THE CONFIGURATION CHANNEL and this module was ignoring it.
   * PUP-WO-0300 section 3 names it among the non-negotiables the latitude does not
   * relax, and PUP-WO-0000 section 9.3 rules that two registry entries may share one
   * module and differ only by their params — which is how a second, calmer Gyre tile
   * would ship without a second file. Layered defaults < entry params < what the child
   * saved, so a preset sets where he STARTS and never overrules where he got to. His
   * saves are namespaced by entry id, so the two tiles do not fight. */
  let preset = null;
  try { preset = api.entry && api.entry.params; } catch (e) { preset = null; }
  const seed = Object.assign({}, preset && typeof preset === 'object' ? preset : null, loaded && typeof loaded === 'object' ? loaded : null);
  const settings = sanitise(seed, hostWidth);

  /* Saving is DEBOUNCED because PUP-WO-0301's sliders will call set() on every
   * pointermove — sixty localStorage writes a second, each a synchronous
   * serialise-and-store on the main thread, is a frame-rate defect wearing a
   * persistence costume. The timer is a teardown obligation and it is honoured
   * below, INCLUDING the flush: a child who drags a slider and immediately taps back
   * must not lose the setting to a pending timeout. */
  let saveTimer = 0;
  const flushSave = () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    try { api.save({
      count: settings.count, force: settings.force, burst: settings.burst,
      tail: settings.tail, size: settings.size, linger: settings.linger,
      palette: settings.palette, background: settings.background,
      polarity: settings.polarity,
      ripple: settings.ripple, glow: settings.glow, spin: settings.spin,
      shape: settings.shape,
    }); } catch (e) {}
  };
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = 0; flushSave(); }, 300);
  };

  const sim = new GyreSim(canvas, () => settings, api.prefersReducedMotion);

  /* --- the parameter seam -------------------------------------------------- */
  const SETTERS = {
    count: (v) => clampCount(v),
    force: (v) => clampForce(v),
    burst: (v) => clampRange(v, settings.burst),
    tail: (v) => clampRange(v, settings.tail),
    size: (v) => clampRange(v, settings.size),
    linger: (v) => clampRange(v, settings.linger),
    palette: (v) => clampPalette(v, settings.palette),
    background: (v) => clampBackground(v, settings.background),
    polarity: (v) => clampPolarity(v),
    ripple: (v) => clampFlag(v, settings.ripple),
    glow: (v) => clampFlag(v, settings.glow),
    spin: (v) => clampFlag(v, settings.spin),
    shape: (v) => clampOneOf(SHAPES, v, settings.shape),
  };

  function set(key, value) {
    const clamp = SETTERS[key];
    if (!clamp) return false;
    const next = clamp(value);
    if (settings[key] === next) return false;
    settings[key] = next;
    /* Only `palette` and `background` repaint. Changing either leaves TRAILS in the
     * previous colour on screen for as long as `linger` allows — up to several
     * seconds of a field that is half the old palette, which reads as the control
     * having half worked. The other seven need no repaint: they change the next
     * frame, and the next frame is 16 ms away. Roadmap P3 gate 1 asks for "visibly
     * within one second" and this is the only parameter pair that would miss it. */
    /* A PARTIAL FADE, NOT A WIPE, AND ONLY FOR `palette`.
     *
     * This was `clearTrails()` for palette OR background — a full-opacity repaint. The
     * adversarial pass measured what that costs: at linger 90 it erased 80% of the
     * drawn field in one frame. The source never did it at all; only its explicit
     * "clear trails" button did. And PUP-WO-0301's swatch strip will fire `set` on
     * every pointermove of a drag, which would strobe the field to bare background all
     * the way along the strip.
     *
     * The problem it was solving is real — trails in the OLD palette sit on screen for
     * as long as linger allows, which reads as the control half working — so the fade
     * stays, at an opacity that removes the stale colour without erasing the field.
     * `background` needs nothing at all: step() already repaints on the next frame when
     * it sees the id change, so the old code was asking for the same paint twice. */
    if (key === 'palette') sim.fadeTrails(0.6);
    scheduleSave();
    return true;
  }

  function randomize() {
    const next = randomSettings(settings);
    for (const key of Object.keys(next)) settings[key] = next[key];
    sim.reseed();
    flushSave();
    return next;
  }

  /* --- input --------------------------------------------------------------- */
  /* EVERY listener goes through this array, and teardown walks it. A listener added
   * anywhere else in this file is a listener teardown does not know about, and that
   * is precisely the leak the returned-closure contract exists to prevent — the
   * closure can only reach what it was told about. */
  const listeners = [];
  /* Declared HERE, not beside the seam, because `release()` closes over all four and
   * the failure path below can call it before the seam section has run. A release
   * function that throws on a TDZ reference is a release function that does not run. */
  const watchers = [];
  let dead = false;
  let ro = null;
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  };

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, h: Math.max(1, r.height) };
  };

  /* The captured pointer ids, so teardown can hand them back BY NAME. Removing the
   * canvas from the document releases a capture implicitly, and that is what made this
   * correct before it was written down — a guarantee held by a side effect of one line
   * elsewhere. PUP-WO-0000 section 8.1 lists "capture" among the things that must not
   * survive teardown, so it is released on purpose now. */
  const captured = [];
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = local(e);
    try { canvas.setPointerCapture(e.pointerId); captured.push(e.pointerId); } catch (err) {}
    sim.setPointer(p.x, p.y);
    sim.setHeld(true);
    sim.burst(p.x, p.y);
    /* PUP-WO-0300 section 2.1 in use: the tap's HEIGHT is its pitch. Guarded on the
     * method existing, because a module must run against the shell it is given and
     * not the one its work order assumed — an older cached index.html has no tone. */
    if (typeof api.tone === 'function') api.tone(toneForHeight(p.y / p.h), 180, 'sine');
    /* Guarded for the same reason `tone` is, which the first version of this line was
     * not: a module must run against the shell it is GIVEN. The pass was right that
     * guarding one and not the other is a claim about which parts of the api are
     * optional, made by accident. */
    if (typeof api.vibrate === 'function') api.vibrate(12);
  };
  const onMove = (e) => { const p = local(e); sim.setPointer(p.x, p.y); };
  const onUp = () => sim.setHeld(false);
  const onHidden = () => { if (document.hidden) sim.setHeld(false); };

  /* EVERYTHING FROM HERE TO `return release` HOLDS RESOURCES THE SHELL CANNOT REACH.
   * See the teardown note below: `gameSession.teardown` is assigned only after mount
   * returns, so a throw in this window leaves the shell reporting a clean recovery over
   * seven listeners, an observer and a running loop. This try is what makes that
   * impossible rather than merely unlikely. */
  try {
  on(canvas, 'pointerdown', onDown);
  /* ON `window`, WHICH IS WHERE THE SOURCE HAD IT. The port moved this to the canvas,
   * and during a drag that is equivalent because `setPointerCapture` routes moves to the
   * canvas anyway. It is NOT equivalent for a fine pointer moving with no button down:
   * once the cursor is over anything else the field stops following it. Today that is
   * only a mouse, but PUP-WO-0301 puts a control panel INSIDE this host, and the glow
   * and the attractor would stop tracking the moment the cursor crossed it. */
  on(window, 'pointermove', onMove, { passive: true });
  on(canvas, 'pointerup', onUp);
  on(canvas, 'pointercancel', onUp);
  /* A pointer released OUTSIDE the canvas — over the back button, off the edge of the
   * screen — never delivers pointerup to the canvas, and the field would stay in its
   * held state forever. The window pair is the release of last resort. */
  on(window, 'pointerup', onUp);
  on(window, 'pointercancel', onUp);
  on(document, 'visibilitychange', onHidden);

  ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => sim.resize()) : null;
  if (ro) ro.observe(host);
  else on(window, 'resize', () => sim.resize());

  sim.start();

  /* --- THE SEAM PUP-WO-0301 ATTACHES TO ------------------------------------
   * PUP-WO-0300 section 5: "you build the mechanisms; it builds the controls. Say in
   * your feedback what each mechanism needs exposed." This IS the exposure, and it is
   * put here rather than described in prose because a seam that only a document knows
   * is a convention — the same shape as section 8.3's network ban, which is why
   * check 11 exists.
   *
   * WHY IT HANGS OFF `host` AND WHY THAT IS NOT A BACKDOOR. `host` is the node the
   * shell creates for this module, hands to it, and removes at teardown. Nothing else
   * in the app reads it, it does not survive the session, and it reaches nothing
   * outside this module's own subtree. It is a property on an object this module was
   * given. The alternative — a module-scope variable and a control surface welded
   * into this file — is what PUP-WO-0301 would then have to unpick.
   *
   * WHAT EACH MECHANISM NEEDS EXPOSED, which is the answer section 5 asked for:
   *   count force burst tail size linger  -> a slider each. Ranges are on `.ranges`.
   *   palette background                  -> a swatch strip each; `.palettes` and
   *                                          `.backgrounds` carry a `hex` per entry so
   *                                          a tile can be the colour it selects,
   *                                          which is invariant 1 with no label.
   *   polarity                            -> ONE two-state affordance, not a slider.
   *                                          `toggle()` flips it and returns the new
   *                                          value. It needs an icon that reads as
   *                                          in-vs-out to someone who cannot read.
   *   randomize()                         -> one big button. Returns the settings it
   *                                          chose, so a control surface can re-render
   *                                          every slider from one call.
   * `subscribe(fn)` fires after any change made through this object, so the sliders
   * can follow `randomize()` without polling. It returns its own unsubscribe. */
  /* THE SEAM MUST DIE WITH THE SESSION, AND `delete host.gyre` DOES NOT KILL IT.
   * Deleting the property removes the NAME. Anything that captured the object — a
   * slider handler, a subscription, a timer — still holds a frozen object whose methods
   * all still work, and the adversarial pass drove every one of them after teardown:
   * `set` mutated the settings, `scheduleSave` created a fresh 300 ms timer that no
   * teardown will ever clear, `subscribe` re-populated the watcher array teardown had
   * just emptied, `randomize` reseeded a detached canvas, and localStorage was
   * overwritten AFTER the child had left — silently changing the settings the toy comes
   * back on. The comment here used to claim the opposite, which is the coverage-claiming
   * comment this project has a standing rule about. The flag is declared with the rest
   * of the release state at the top of the input section, so `release()` can be called
   * from a failure at ANY point after acquisition begins. */
  const announce = () => { for (const fn of watchers.slice()) { try { fn(read()); } catch (e) {} } };
  const read = () => ({
    count: settings.count, force: settings.force, burst: settings.burst,
    tail: settings.tail, size: settings.size, linger: settings.linger,
    palette: settings.palette, background: settings.background,
    polarity: settings.polarity,
    ripple: settings.ripple, glow: settings.glow, spin: settings.spin,
    shape: settings.shape,
  });

  host.gyre = Object.freeze({
    get: read,
    set: (key, value) => { if (dead) return false; const changed = set(key, value); if (changed) announce(); return changed; },
    randomize: () => { if (dead) return read(); const next = randomize(); announce(); return next; },
    toggle: () => { if (dead) return settings.polarity; set('polarity', settings.polarity === POLARITY_ATTRACT ? POLARITY_REPEL : POLARITY_ATTRACT); announce(); return settings.polarity; },
    /* The two controls the source shipped that this seam did not expose. `controls.tsx`
     * binds a "clear trails" button and a "reset field" button, and PUP-WO-0301 could
     * not have rebuilt either without editing this file — which would have made adding
     * the control surface touch a second thing. Found by the adversarial pass reading
     * the source's control set against what the seam offers. */
    clear: () => { if (!dead) sim.clearTrails(); },
    reset: () => {
      if (dead) return read();
      const d = defaultsFor(hostWidth);
      for (const key of Object.keys(d)) settings[key] = d[key];
      sim.reseed();
      flushSave();
      announce();
      return read();
    },
    subscribe: (fn) => {
      if (dead || typeof fn !== 'function') return () => {};
      watchers.push(fn);
      return () => { const i = watchers.indexOf(fn); if (i !== -1) watchers.splice(i, 1); };
    },
    /* ==================== THE CONTROL MANIFEST — PUP-WO-0301 ==================
     * WHAT THIS IS AND WHY IT IS DATA. The shell renders the control panel and the
     * shell KNOWS NOTHING ABOUT GYRE — architecture section 4's contract, the same one
     * the picker holds. It reads this array, which says what controls exist, in what
     * order, of what kind, and with what icon, and builds them. Adding a control here
     * puts it on screen with no edit to index.html, which is the test of the contract
     * and is exactly how the picker proves its own.
     *
     * THE VOCABULARY IS THREE KINDS AND NOTHING ELSE, deliberately small:
     *   slider   `key` names a setting; its bounds come from `.ranges[key]` so the
     *            range is specified ONCE (section 2.1's first warning, applied to the
     *            manifest rather than to a setter).
     *   choice   `key` names a setting and `options` are its values. Each option
     *            carries an `icon` (a glyph, drawn as text) or a `hex` (drawn as the
     *            colour it selects — section 2.3, "colour is the label"). `from`
     *            names a list already on this seam instead of copying it. `single`
     *            asks for ONE cycling affordance rather than a row, which is what
     *            section 2.2 requires of attract/repel specifically.
     *   action   `method` names a method on this object. The shell calls it and knows
     *            nothing else about it. `prominent` asks for it to be placed outside
     *            the drawer, always reachable.
     *
     * NO PAINTED TEXT ANYWHERE. Every icon is a pictograph or a geometric glyph, never
     * a word. That is invariant 1 taken literally, and it is what makes acceptance 8 —
     * "with all text covered, a person who has not seen the app operates it" — a test
     * of the design rather than of the screenshot. `label` is carried for the SCREEN
     * READER only; nothing draws it.
     *
     * WHY EVERY EFFECT IS HERE AND NOTHING WAS TRIMMED. Section 2.2b: "a control that
     * turns out to be uninteresting costs one row; an effect a child never discovers
     * costs the whole point of the toy." */
    controls: Object.freeze([
      { kind: 'action', method: 'randomize', icon: '\uD83C\uDFB2', label: 'Surprise me', prominent: true },
      { kind: 'choice', key: 'polarity', single: true, label: 'Pull or push',
        options: [{ id: POLARITY_ATTRACT, icon: '\u25B6\u25C0' }, { id: POLARITY_REPEL, icon: '\u25C0\u25B6' }] },
      { kind: 'choice', key: 'palette', from: 'palettes', label: 'Colours' },
      { kind: 'choice', key: 'background', from: 'backgrounds', label: 'Background' },
      { kind: 'slider', key: 'count',  icon: '\u2728',            label: 'How many' },
      { kind: 'slider', key: 'force',  icon: '\uD83E\uDDF2',      label: 'How strong' },
      { kind: 'slider', key: 'burst',  icon: '\uD83D\uDCA5',      label: 'Tap splash' },
      { kind: 'slider', key: 'tail',   icon: '\u2604\uFE0F',      label: 'Tail length' },
      { kind: 'slider', key: 'size',   icon: '\uD83D\uDD35',      label: 'How thick' },
      { kind: 'slider', key: 'linger', icon: '\uD83C\uDF2B\uFE0F', label: 'How long trails stay' },
      { kind: 'choice', key: 'shape', label: 'Particle shape',
        options: [{ id: 'streak', icon: '\u2501' }, { id: 'dot', icon: '\u2B24' }, { id: 'ribbon', icon: '\u25AC' }] },
      { kind: 'choice', key: 'ripple', label: 'Tap ripple',
        options: [{ id: 1, icon: '\uD83C\uDF0A' }, { id: 0, icon: '\uD83C\uDF0A', off: true }] },
      { kind: 'choice', key: 'glow', label: 'Finger glow',
        options: [{ id: 1, icon: '\uD83D\uDCA1' }, { id: 0, icon: '\uD83D\uDCA1', off: true }] },
      /* `temporal` tells a check — not the shell — that this control's property is CHANGE
       * OVER TIME rather than a difference between two stills. Two snapshots of a
       * drifting hue differ by an arbitrary amount depending on when they were taken,
       * which is a coin flip dressed as a measurement. It is architecture §6.1 member 6
       * again, one level up: the instrument would be measuring presence where the
       * property is motion. The shell ignores this field. */
      { kind: 'choice', key: 'spin', label: 'Drifting colour', temporal: true,
        options: [{ id: 1, icon: '\uD83C\uDF08' }, { id: 0, icon: '\uD83C\uDF08', off: true }] },
      { kind: 'action', method: 'clear', icon: '\uD83E\uDDF9', label: 'Wipe the trails' },
      { kind: 'action', method: 'reset', icon: '\u21BA', label: 'Start over' },
    ]),
    palettes: PALETTES.map((p) => ({ id: p.id, hex: p.hex })),
    backgrounds: BACKGROUNDS.map((b) => ({ id: b.id, hex: b.hex, light: b.light })),
    ranges: Object.freeze({
      count: [COUNT_MIN, COUNT_MAX, COUNT_STEP],
      force: [FORCE_MIN, FORCE_MAX, 0.01],
      burst: [RANGE_MIN, RANGE_MAX, 1],
      tail: [RANGE_MIN, RANGE_MAX, 1],
      size: [RANGE_MIN, RANGE_MAX, 1],
      linger: [RANGE_MIN, RANGE_MAX, 1],
    }),
    /* Read-only instrumentation. The frame counter is how the demonstration measures
     * a frame rate and how it proves teardown stopped the loop, without this file
     * carrying a test mode. */
    frames: () => sim.frames,
  });
  } catch (err) {
    /* Release what was acquired, then rethrow so the shell's own obligation-5 handler
     * still runs and the child still lands back on the console. `release` is a function
     * DECLARATION at mount's top level, hoisted out of the try — an earlier version put
     * it inside, where it is block-scoped and invisible from exactly the catch that
     * needs it. The module then failed to mount at all, which is the one bug shape a
     * failure path can have that is worse than not having one. */
    release();
    throw err;
  }

  /* --- teardown ------------------------------------------------------------
   * PUP-WO-0000 section 8.1: after this returns the module holds "no live
   * requestAnimationFrame, interval, timeout, event listener, observer, CAPTURE, or
   * media resource". Eight things, in the order that makes each safe — and the list is
   * eight because an earlier version said five while the code did seven, then claimed
   * the canvas "goes with host" one line above removing it explicitly:
   *   1. the seam is marked dead FIRST, so nothing below races a stale caller
   *   2. the rAF loop, so nothing below races a frame
   *   3. the observer, which would otherwise call resize() on a stopped sim
   *   4. every listener, from the array that recorded them
   *   5. every watcher, which a stale subscribe() could otherwise refill
   *   6. every pointer capture, by name rather than as a side effect of step 8
   *   7. the save timer — CLEARED AND FLUSHED, so the last change is kept
   *   8. the canvas, and the seam property
   *
   * IT IS ALSO THE FAILURE PATH. Between the first listener and the `return` below,
   * this module holds seven listeners, an observer and a running loop while the shell
   * has no teardown handle at all — `gameSession.teardown` is assigned only after mount
   * RETURNS, so a throw in here leaves the shell reporting a clean recovery over a sim
   * that runs forever. There is no reachable throw today; the pass had to plant one. But
   * the seam block above invites PUP-WO-0301 to add code in exactly that window, so the
   * window is closed structurally rather than by asking it not to. */
  function release() {
    dead = true;
    sim.stop();
    if (ro) ro.disconnect();
    for (const [target, type, fn, opts] of listeners) {
      try { target.removeEventListener(type, fn, opts); } catch (e) {}
    }
    listeners.length = 0;
    watchers.length = 0;
    for (const id of captured) { try { canvas.releasePointerCapture(id); } catch (e) {} }
    captured.length = 0;
    flushSave();
    try { delete host.gyre; } catch (e) { host.gyre = undefined; }
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  return release;
}
