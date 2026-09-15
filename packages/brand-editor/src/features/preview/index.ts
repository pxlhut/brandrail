/**
 * Live preview (§3's write path) — `generateTheme()` called client-side,
 * reading the draft directly, never touching a snapshot or a network call.
 * Core is browser-safe and pure (guideline §39), so this is a direct,
 * synchronous call: the same render that applies a value change also
 * recomputes the preview, which is what "updates within one frame" means in
 * practice — there is no effect, no round-trip, nothing to await.
 *
 * `violations` (step 06) rides straight through as the accessibility feature
 * the owner actually experiences: the picker reports a colour won't pass
 * *before* they try to publish, not after.
 */

import { useMemo } from 'react';
import { generateTheme, toShadcnCss, type GenerateResult } from '@pxlhut/brand-core';
import type { BrandConfig, ColorRole, ControlConfig, FieldId } from '@pxlhut/brand-core';
import { SEMANTIC_COLOR_ROLES, toGenerateInput } from '@pxlhut/brand-store/service';

export interface UsePreviewOptions {
  draft: BrandConfig;
  /** The live tier authority — see `useDraft`'s own doc comment on why this isn't just `draft.controlConfig`. */
  controlConfig: ControlConfig;
  /**
   * The selector the generated CSS is scoped under (step 08's `selector`
   * option). §5: the one place visual isolation genuinely matters, since the
   * preview renders next to the platform's own dashboard chrome — a bare
   * `--primary` at `:root` would leak onto it. @default '[data-site-theme]'
   */
  selector?: string;
}

export interface PreviewResult extends GenerateResult {
  css: string;
  /** Which field a contrast violation should be reported against. */
  fieldForViolation: (violation: GenerateResult['violations'][number]) => FieldId;
}

const SEMANTIC_BASE_ROLES = new Set<string>(SEMANTIC_COLOR_ROLES);

function baseRole(role: ColorRole): string {
  return role.endsWith('-foreground') ? role.slice(0, -'-foreground'.length) : role;
}

/**
 * `generateTheme`'s base output always clears its own floors (its own doc
 * comment); a violation only ever comes from a Direct/Raw colour override.
 * `semanticColors` and `advancedTokens` both land in the *same*
 * `rawOverrides` bag, keyed by the same token path (step 13's own documented
 * simplification) — so the two are told apart here the same way step 13
 * tells them apart: if `semanticColors` is locked, only `advancedTokens`
 * could have written that path.
 */
function fieldForRole(role: ColorRole, controlConfig: ControlConfig): FieldId {
  const base = baseRole(role);
  if (SEMANTIC_BASE_ROLES.has(base)) {
    return controlConfig.semanticColors.tier === 'locked' ? 'advancedTokens' : 'semanticColors';
  }
  return 'advancedTokens';
}

export function usePreview({
  draft,
  controlConfig,
  selector = '[data-site-theme]',
}: UsePreviewOptions): PreviewResult {
  const generated = useMemo(() => generateTheme(toGenerateInput(draft)), [draft]);
  const css = useMemo(
    () => toShadcnCss(generated.tokens, { selector, buttonStyle: generated.buttonStyle }),
    [generated, selector],
  );

  return useMemo(
    () => ({
      ...generated,
      css,
      fieldForViolation: (violation) => fieldForRole(violation.fg, controlConfig),
    }),
    [generated, css, controlConfig],
  );
}
