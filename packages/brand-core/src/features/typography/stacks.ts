/**
 * Font stacks — guideline §35.
 *
 * Fonts stay a curated select at every tier, including Raw. Two concrete
 * reasons: an arbitrary font name that is not actually loaded fails *silently*
 * to a system fallback, and re-serving fonts on behalf of other businesses is
 * real legal exposure for a platform.
 *
 * Step 03 enforces that at the type level. This file is the other half — every
 * curated option resolves to a full stack with real fallbacks, never a bare
 * family name.
 */

import { FONT_OPTIONS } from '../../shared/fields/index.js';
import type { TypographyTokens } from '../../shared/types/index.js';

/**
 * Keyed by the `value` of each entry in `FONT_OPTIONS`. A test asserts the two
 * stay in step: adding a curated option without a stack here would reintroduce
 * exactly the silent-fallback failure §35 exists to prevent.
 */
export const FONT_STACKS: Record<string, string> = {
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'space-grotesk': "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'ibm-plex-sans': "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'source-serif-4': "'Source Serif 4', Georgia, 'Times New Roman', serif",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const DEFAULT_HEADING_FONT = 'inter';
export const DEFAULT_BODY_FONT = 'inter';

/**
 * Resolve a curated font id to its stack.
 *
 * Throws on an unknown id rather than falling back. Falling back here would
 * reproduce §35's failure mode one layer up: the theme would render in a system
 * font and nothing would report that the owner's choice was discarded.
 */
export function stackFor(fontId: string): string {
  const stack = FONT_STACKS[fontId];
  if (stack === undefined) {
    const known = Object.keys(FONT_STACKS).join(', ');
    throw new Error(
      `Unknown font "${fontId}". Fonts are a curated list at every tier (§35); known ids: ${known}.`,
    );
  }
  return stack;
}

export interface TypographyInput {
  headingFont?: string;
  bodyFont?: string;
}

export function buildTypography(input: TypographyInput = {}): TypographyTokens {
  return {
    headingFont: stackFor(input.headingFont ?? DEFAULT_HEADING_FONT),
    bodyFont: stackFor(input.bodyFont ?? DEFAULT_BODY_FONT),
  };
}

/** Every curated font id, for the serializer's font-loading step (step 08). */
export const CURATED_FONT_IDS: readonly string[] = FONT_OPTIONS.map((o) => o.value);
