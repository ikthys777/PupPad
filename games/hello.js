/* The contract demonstration PUP-WO-0200 §1.4 requires. NOT a game.
 *
 * It exists to prove three things a description cannot:
 *   - the shell's half of docs/findings/PUP-WO-0000.md §8.2 actually works (§8.1 is the
 *     MODULE side — this file — and §8.2 is the shell's; an earlier comment cited §8.1
 *     for the shell's half, which is the wrong half of the contract);
 *   - roadmap P2 gate 2 can be run, which needs a second entry to compare against;
 *   - games/ is non-empty, which check 11 requires — it fails closed on an empty
 *     directory, because a check that scans nothing and reports success is the exact
 *     defect that hid its own absence for two work orders.
 *
 * ON THE TEARDOWN DISCIPLINE, CORRECTED. An earlier version of this comment said "the
 * interval id lives in mount's scope". THERE IS NO INTERVAL IN THIS FILE and there
 * never was — the only timer is the bare setTimeout below, whose handle is not captured
 * at all, and teardown removes one listener. The comment described the pattern §8.1 is
 * shaped around while being false about the file it is a comment on.
 *
 * What this file DOES demonstrate is the access half: `onTap` and `face` are in mount's
 * scope and teardown closes over them, so there is nowhere else to put them. What it
 * does NOT demonstrate — and the adversarial pass was right to say the shape does not
 * prevent it — is an OBLIGATION. Anything acquired after mount returns is outside the
 * closure's reach by construction, and this file's own setTimeout is exactly that: a
 * teardown inside its 120 ms window leaves it writing to a detached node. Harmless
 * here; named because it is the general case, and the shell's body-level sweep in
 * endGameSession is what actually bounds the damage.
 */
export default function mount(host, api) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:center;gap:18px;font-family:Trebuchet MS,sans-serif;'
    + 'color:#E6F0FF;-webkit-user-select:none;user-select:none';

  const face = document.createElement('div');
  face.textContent = api.entry.icon;
  face.style.cssText = 'font-size:96px;line-height:1;cursor:pointer';

  const word = document.createElement('div');
  word.textContent = api.entry.label;
  word.style.cssText = 'font-size:22px;font-weight:700;letter-spacing:1px;color:' + api.entry.glow;

  /* Every tap is feedback a non-reader can perceive without reading anything:
     the icon jumps, a sound plays, the device buzzes. */
  let taps = (api.load() || {}).taps || 0;
  const dots = document.createElement('div');
  dots.style.cssText = 'font-size:28px;letter-spacing:6px;min-height:34px;color:' + api.entry.color;
  const paint = () => { dots.textContent = '⭐'.repeat(Math.min(taps, 5)); };
  paint();

  const onTap = () => {
    taps += 1;
    api.sound(api.entry.sound);
    api.vibrate(30);
    paint();
    if (!api.prefersReducedMotion) {
      face.style.transform = 'scale(1.25)';
      setTimeout(() => { face.style.transform = 'scale(1)'; }, 120);
    }
    api.save({ taps });
  };
  face.addEventListener('click', onTap);
  face.style.transition = 'transform 0.12s';

  wrap.appendChild(face);
  wrap.appendChild(word);
  wrap.appendChild(dots);
  host.appendChild(wrap);

  return function teardown() {
    face.removeEventListener('click', onTap);
  };
}
