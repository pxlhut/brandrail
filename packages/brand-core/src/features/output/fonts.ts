/**
 * Closing §35's loop.
 *
 * §35 says self-host a curated set and stops there. The failure it warns
 * about — a font name that isn't actually loaded failing silently to a system
 * fallback — is still reachable unless *something* emits the loading
 * directive alongside the family. That's here, not step 07: the validator's
 * job is to reject an uncurated value, not to decide how a curated one gets
 * loaded.
 */

import { FONT_STACKS } from '../../shared/fields/index.js';
import { escapeForHtml } from '../validation/index.js';

export type FontStrategy = 'none' | 'fontsource' | 'inline-face';

/**
 * Curated ids double as `@fontsource/*` package names by construction (see
 * `shared/fields/registry.ts`) — `inter`, `space-grotesk`, `jetbrains-mono`
 * are all real, current `@fontsource` package names. No separate lookup
 * table to keep in sync.
 */
function idForStack(stack: string): string | undefined {
  for (const [id, value] of Object.entries(FONT_STACKS)) {
    if (value === stack) return id;
  }
  return undefined;
}

/** The first, unquoted family name in a curated stack — `'Inter', system-ui, ...` → `Inter`. */
function familyNameFromStack(stack: string): string {
  const first = stack.split(',')[0] ?? stack;
  return first.trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Content to place *before* the `:root`/dark rules — never inside them.
 * `@font-face` is a top-level at-rule; it cannot nest inside a selector
 * block, unlike a plain custom-property declaration.
 *
 * - `'none'` — nothing. The family in `--font-heading`/`--font-body` is
 *   still emitted either way; this only controls the loading hint.
 * - `'fontsource'` — a comment naming the exact package(s) to install. Not a
 *   real `@import`: fontsource ships static files meant to be pulled in by
 *   the consumer's own bundler (`import '@fontsource/inter'`), not fetched
 *   from a URL this package would have to invent.
 * - `'inline-face'` — a real `@font-face` per family, with a `local()`
 *   source. This is honest about its limit: it tells the browser to prefer
 *   a copy already installed on the visitor's system; it does not embed font
 *   binaries. Actually bundling and serving font files is a font-asset
 *   pipeline this package doesn't have (D10 — two runtime dependencies,
 *   no binary assets) and is out of scope here.
 */
export function fontFaceBlocks(stacks: readonly string[], strategy: FontStrategy): string {
  if (strategy === 'none') return '';

  const unique = [...new Set(stacks)];

  if (strategy === 'fontsource') {
    const ids = unique.map(idForStack).filter((id): id is string => id !== undefined);
    if (ids.length === 0) return '';
    const packages = [...new Set(ids)].map((id) => `@fontsource/${id}`).join(' ');
    return `/* fonts: npm install ${packages} */`;
  }

  // 'inline-face'
  return unique
    .map(familyNameFromStack)
    .map((family) => escapeForHtml(family))
    .map((family) => `@font-face{font-family:'${family}';src:local('${family}');font-display:swap;}`)
    .join('');
}
