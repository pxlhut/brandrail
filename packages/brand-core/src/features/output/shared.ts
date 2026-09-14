/**
 * Helpers shared by all three serializers.
 *
 * `output` may import `validation` but no other feature
 * (`.dependency-cruiser.cjs`) — every value that reaches CSS text goes
 * through `escapeForHtml` here, unconditionally, including values the
 * generator produced itself and that never touched user input. "This path is
 * safe" is exactly the assumption that stops being true after a refactor.
 */

import { escapeForHtml } from '../validation/index.js';
import type { ColorScheme, TokenValue } from '../../shared/types/index.js';

export type DarkModeStrategy = 'class' | 'media' | 'attribute';

/** A token value may be one string for both modes, or a light/dark pair. */
export function resolveMode(value: TokenValue, scheme: ColorScheme): string {
  return typeof value === 'string' ? value : value[scheme];
}

/** One `--name:value;` declaration, escaped. Property names here are always our own — never user input. */
export function declaration(name: string, value: string): string {
  return `--${name}:${escapeForHtml(value)};`;
}

/**
 * Wrap a block of declarations for the dark mode strategy in play.
 *
 * `'attribute'` matches guideline §3's own worked example
 * (`:root[data-theme="dark"]`) and is the default. `'class'` toggles a `.dark`
 * class the consumer's own script applies (Tailwind's classic convention).
 * `'media'` follows the OS setting with no manual toggle at all — there is no
 * light/dark switch to wire up, so it is the one strategy a consumer can't
 * override programmatically.
 */
export function wrapDarkRule(selector: string, mode: DarkModeStrategy, decls: string): string {
  if (mode === 'media') {
    return `@media (prefers-color-scheme:dark){${selector}{${decls}}}`;
  }
  const darkSelector = mode === 'class' ? `${selector}.dark` : `${selector}[data-theme="dark"]`;
  return `${darkSelector}{${decls}}`;
}
