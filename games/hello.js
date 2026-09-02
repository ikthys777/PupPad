/* The contract demonstration PUP-WO-0200 §1.4 requires. NOT a game.
 *
 * It exists to prove three things a description cannot:
 *   - the shell's half of docs/findings/PUP-WO-0000.md §8.1 actually works;
 *   - roadmap P2 gate 2 can be run, which needs a second entry to compare against;
 *   - games/ is non-empty, which check 11 requires — it fails closed on an empty
 *     directory, because a check that scans nothing and reports success is the exact
 *     defect that hid its own absence for two work orders.
 *
 * It also demonstrates the teardown discipline §8.1 is shaped around: the interval id
 * lives in mount's scope and there is nowhere else to put it, so teardown CANNOT
 * drift out of sync with setup. A separate `export function unmount()` would need a
 * module-level variable to hold that id — which is precisely the singleton state
 * architecture §7 seam 1 forbids.
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
