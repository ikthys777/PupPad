/**
 * Extract inline <script> bodies from an HTML file.
 *
 * WHY A REGEX IS CORRECT HERE, given it usually is not:
 * the HTML tokenizer does not understand JavaScript. Per the HTML spec's
 * "script data" state, a script element ends at the first `</script` followed by
 * whitespace, `/` or `>` — regardless of whether that sequence sits inside a JS
 * string, a regex literal or a template literal. It is therefore impossible to
 * write `</script>` inside an inline script without escaping it (`<\/script>`),
 * and scanning for the first such sequence is what a conforming parser does.
 *
 * KNOWN LIMIT, stated rather than hidden: the spec's "script data escaped"
 * states let `<!--` ... `-->` legally contain `</script>` in legacy markup. This
 * extractor does not implement those states. If one is ever introduced it will
 * cut the script short, and check 1 fails loudly on the resulting parse error
 * rather than passing silently — the safe direction.
 */

const SCRIPT_OPEN = /<script\b([^>]*)>/gi;
// Spec: `</script` must be followed by whitespace, `/` or `>` to close the element.
const SCRIPT_CLOSE = /<\/script[\s/>]/i;

const JS_TYPES = new Set([
  '', 'module', 'text/javascript', 'application/javascript',
  'text/ecmascript', 'application/ecmascript', 'module/javascript',
]);

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? '').trim();
}

/**
 * @returns {{startLine:number, source:string, isModule:boolean}[]}
 *   One entry per inline (src-less) script with JS semantics. `startLine` is the
 *   1-based line in `html` on which the script body begins.
 */
export function extractInlineScripts(html) {
  const out = [];
  SCRIPT_OPEN.lastIndex = 0;
  let m;
  while ((m = SCRIPT_OPEN.exec(html)) !== null) {
    const attrs = m[1] || '';
    const bodyStart = m.index + m[0].length;

    const rest = html.slice(bodyStart);
    const closeAt = rest.search(SCRIPT_CLOSE);
    const body = closeAt === -1 ? rest : rest.slice(0, closeAt);

    // Advance past this element either way, so a src'd script cannot swallow the next.
    SCRIPT_OPEN.lastIndex = closeAt === -1 ? html.length : bodyStart + closeAt;

    if (attr(attrs, 'src') !== null) continue;                 // external: check 2's business
    const type = (attr(attrs, 'type') || '').toLowerCase();
    if (!JS_TYPES.has(type)) continue;                         // JSON, importmap, templates

    out.push({
      startLine: html.slice(0, bodyStart).split('\n').length,
      source: body,
      isModule: type === 'module',
    });
  }
  return out;
}
