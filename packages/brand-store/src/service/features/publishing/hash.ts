/**
 * D7's two hashes. The crypto lives here, in the service — `brand-core` has
 * none, by design (D10, purity). Both are computed over the *exact* bytes
 * that ship: `tokens` as `generateTheme` returns it (whose JSON
 * serialisation is deterministic — proof 3, step 09) and `cssText` exactly
 * as `toShadcnCss` returns it, never a re-serialisation of either.
 */

import { createHash } from 'node:crypto';

import type { TokenTree } from '@pxlhut/brand-core';

/** Hash of the token tree — publish dedupe (rule 3) and cache invalidation (§8). Hex: never leaves this process, so it's not shaped for an HTTP header. */
export function hashTokens(tokens: TokenTree): string {
  return createHash('sha256').update(JSON.stringify(tokens), 'utf8').digest('hex');
}

/** SHA-256 of `cssText`, base64-encoded — ready to drop straight into `style-src 'sha256-<this>'` (D7), no re-encoding at the point of emitting the header. */
export function hashCssText(cssText: string): string {
  return createHash('sha256').update(cssText, 'utf8').digest('base64');
}
