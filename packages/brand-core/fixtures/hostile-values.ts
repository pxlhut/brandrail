/**
 * The hostile corpus — guideline §19.
 *
 * At the package root, not inside `src/`, because step 09's proofs live
 * outside `src/` too and both need it: this file is the shared input for the
 * validator's own tests (step 07) and for the fuzz/property sweep (step 09).
 *
 * `css_text` is built by concatenating token values into a `<style>` block
 * inlined into every visitor's page for a site. Every `reject` entry here is
 * a way that concatenation turns into stored XSS if the validator ever lets
 * it through.
 */

import { FONT_STACKS } from '../src/shared/fields/index.js';
import type { TokenValueType } from '../src/features/validation/index.js';

export interface HostileCase {
  /** Why this value is hostile (or, for an `accept` case, why it's legitimate). */
  readonly description: string;
  readonly value: string;
  readonly type: TokenValueType;
  readonly expected: 'accept' | 'reject';
}

export const HOSTILE_VALUES: readonly HostileCase[] = [
  {
    description: '`}` closes the current rule; the rest opens a new one',
    value: '#fff}',
    type: 'color',
    expected: 'reject',
  },
  {
    description: 'semicolon ends the declaration and starts another',
    value: 'red; background: url(//evil)',
    type: 'color',
    expected: 'reject',
  },
  {
    description: '`<`/`>` escape the <style> element',
    value: '</style><script>alert(1)</script>',
    type: 'color',
    expected: 'reject',
  },
  {
    description: 'classic CSS execution vector',
    value: 'url(javascript:alert(1))',
    type: 'color',
    expected: 'reject',
  },
  {
    description: 'legacy IE expression(), still worth rejecting',
    value: 'expression(alert(1))',
    type: 'color',
    expected: 'reject',
  },
  {
    description: '@import fetches attacker-controlled CSS',
    value: '@import url(//evil)',
    type: 'color',
    expected: 'reject',
  },
  {
    description: 'CSS escape reconstructs url() past a naive string check',
    value: '\\75 rl(//evil)',
    type: 'color',
    expected: 'reject',
  },
  {
    description: 'semicolon smuggles a second declaration past var()',
    value: 'var(--x); color: red',
    type: 'length',
    expected: 'reject',
  },
  {
    description: 'breaks out of the style block into a new element',
    value: '"><img src=x onerror=alert(1)>',
    type: 'color',
    expected: 'reject',
  },
  {
    description:
      'oversized value — a serializer DoS, and would otherwise satisfy the length grammar',
    value: `1${'0'.repeat(600)}px`,
    type: 'length',
    expected: 'reject',
  },
  {
    description: 'a valid rgb() colour — accepted and renormalised',
    value: 'rgb(0,0,0)',
    type: 'color',
    expected: 'accept',
  },
  {
    description: 'a valid length',
    value: '0.5rem',
    type: 'length',
    expected: 'accept',
  },
  {
    description: 'a curated font stack — accepted exactly as stored',
    value: FONT_STACKS['inter'] as string,
    type: 'font-stack',
    expected: 'accept',
  },
  {
    description:
      'a real, curated font, but named bare rather than as its exact stack (§35) — rejected',
    value: 'Inter',
    type: 'font-stack',
    expected: 'reject',
  },
] as const;
