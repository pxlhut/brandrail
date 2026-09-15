/**
 * Turns a saved `BrandConfig` into `generateTheme`'s input.
 *
 * Guided and direct-tier values for the seven scalar-mapped fields
 * (`headingFont`, `bodyFont`, `radius`, `density`, `neutralTone`,
 * `buttonStyle`, `elevation`) flow into the *same* `GenerateInput` scalar
 * regardless of tier — `GenerateInput.radius`'s own doc comment says as
 * much ("a §32 preset … or any valid length at Direct tier"). The tier only
 * ever gated which values were *accepted* when saved (`authoring/`); by the
 * time a value is sitting in `fieldValues`, it's already been validated.
 *
 * Everything in `rawOverrides` (`semanticColors` at `direct`/`raw`,
 * `advancedTokens` always) becomes an `overrides.raw` entry, uniformly —
 * see the step file's own notes for why this doesn't distinguish a
 * `direct`-tier `semanticColors` value from a `raw` one.
 */

import type { GenerateInput, NeutralTone, PartialTokenTree } from '@pxlhut/brand-core';
import type { BrandConfig } from '@pxlhut/brand-core';

import { applyTokenPathOverride } from '../authoring/token-paths.js';

export function toGenerateInput(config: BrandConfig): GenerateInput {
  const raw: PartialTokenTree = {};
  for (const [path, value] of Object.entries(config.rawOverrides)) {
    applyTokenPathOverride(raw, path, value);
  }

  const { radius, density, neutralTone, buttonStyle, headingFont, bodyFont, elevation } = config.fieldValues;

  return {
    brandColor: config.brandColor,
    schemaVersion: config.schemaVersion,
    ...(neutralTone !== undefined ? { neutralTone: neutralTone as NeutralTone } : {}),
    ...(radius !== undefined ? { radius } : {}),
    ...(density !== undefined ? { density } : {}),
    ...(elevation !== undefined ? { elevation: Number(elevation) } : {}),
    ...(headingFont !== undefined ? { headingFont } : {}),
    ...(bodyFont !== undefined ? { bodyFont } : {}),
    ...(buttonStyle !== undefined ? { buttonStyle } : {}),
    ...(Object.keys(raw).length > 0 ? { overrides: { raw } } : {}),
  };
}
