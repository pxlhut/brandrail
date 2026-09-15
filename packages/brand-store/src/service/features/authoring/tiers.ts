/**
 * §9's tier check: "does the site's own `control_config` allow this write",
 * enforced at the field level against real, current `ControlConfig` data —
 * never inferred from what a client-side control happened to render.
 *
 * - **Locked** → reject the write outright.
 * - **Guided** → accept only a value from the declared slider range or
 *   select enum. Not an arbitrary string.
 * - **Direct** → accept, then run step 07's validator for the field's type.
 * - **Raw** → accept, and *still* run step 07's validator (§19, §32) — raw
 *   bypasses the contrast gate at publish time, never the syntax gate here.
 */

import { defaultControlConfig, validateTokenValue } from '@pxlhut/brand-core';
import type { ControlConfig, FieldConfig, FieldId, TokenValueType } from '@pxlhut/brand-core';

import { TierViolationError } from './errors.js';
import { SEMANTIC_COLOR_ROLES, TOKEN_PATH_TYPE, type SemanticColorRole } from './token-paths.js';

/** What a `saveDraft` caller submits. Every field is optional — only the ones actually being edited need appear. */
export interface DraftPatch {
  /** The `BrandConfig.version` this patch was written against (§22). */
  expectedVersion: number;

  companyName?: string;
  logo?: { light?: string; dark?: string };
  brandColor?: string;
  /** Base semantic hues only — never the derived `-foreground` half (§34). */
  semanticColors?: Partial<Record<SemanticColorRole, string>>;
  headingFont?: string;
  bodyFont?: string;
  radius?: string;
  density?: string;
  neutralTone?: string;
  buttonStyle?: string;
  /** A number as a string, e.g. `'72'` — validated the same way a direct-tier value is. */
  elevation?: string;
  /** Token path → raw value, e.g. `{ 'color.primary': '#123456' }'`. */
  advancedTokens?: Record<string, string>;
  supportUrl?: string;
  emailSenderName?: string;
}

/** The validated result, shaped to hand straight to `BrandThemeStore.saveConfig`'s patch. */
export interface EnforcedPatch {
  brandColor?: string;
  fieldValues: Partial<Record<FieldId, string>>;
  rawOverrides: Record<string, string>;
  passthrough: Record<string, string>;
}

/** Fields whose `direct`-tier value step 07 actually validates, and as which type. Guided-only and passthrough fields aren't here. */
const DIRECT_TOKEN_TYPE: Partial<Record<FieldId, TokenValueType>> = {
  brandColor: 'color',
  radius: 'length',
  elevation: 'number',
};

const SCALAR_TOKEN_FIELDS = [
  'headingFont',
  'bodyFont',
  'radius',
  'density',
  'neutralTone',
  'buttonStyle',
  'elevation',
] as const satisfies readonly FieldId[];

const PASSTHROUGH_TEXT_FIELDS = ['companyName', 'supportUrl', 'emailSenderName'] as const satisfies readonly FieldId[];

function enforceScalar(fieldId: FieldId, value: string, config: FieldConfig): string {
  switch (config.tier) {
    case 'locked':
      throw new TierViolationError(fieldId, 'locked', 'this field is locked and cannot be edited');

    case 'guided': {
      if (config.type === 'select') {
        const allowed = config.options.some((option) => option.value === value);
        if (!allowed) {
          const known = config.options.map((o) => o.value).join(', ');
          throw new TierViolationError(
            fieldId,
            'guided',
            `"${value}" is not one of the allowed options (${known})`,
          );
        }
        return value;
      }
      const n = Number(value);
      if (!Number.isFinite(n) || n < config.min || n > config.max) {
        throw new TierViolationError(
          fieldId,
          'guided',
          `${value} is outside the allowed range [${config.min}, ${config.max}]`,
        );
      }
      return value;
    }

    case 'direct': {
      const type = DIRECT_TOKEN_TYPE[fieldId];
      // A direct-tier field with no declared token type (companyName, supportUrl,
      // emailSenderName: 'text'; logo: 'asset') is a passthrough field (§36) —
      // not a token, so step 07's validator, which only knows token types, has
      // nothing to check here. It still reached this far *because* the tier
      // allowed it, which is the check that matters for a non-token field.
      if (type === undefined) return value;
      const result = validateTokenValue(value, type);
      if (!result.ok) throw new TierViolationError(fieldId, 'direct', result.reason);
      return result.normalized;
    }

    case 'raw': {
      // Only `advancedTokens` and `semanticColors` ever declare `raw`, and
      // both are multi-valued — handled by their own functions below, never
      // through this scalar path.
      throw new TierViolationError(fieldId, 'raw', 'this field has no scalar raw form');
    }
  }
}

function enforceSemanticColors(
  value: Partial<Record<SemanticColorRole, string>>,
  config: FieldConfig,
): Record<string, string> {
  if (config.tier === 'locked') {
    throw new TierViolationError(
      'semanticColors',
      'locked',
      'semantic colours are locked and cannot be edited',
    );
  }
  const out: Record<string, string> = {};
  for (const role of SEMANTIC_COLOR_ROLES) {
    const roleValue = value[role];
    if (roleValue === undefined) continue;
    const result = validateTokenValue(roleValue, 'color');
    if (!result.ok) {
      throw new TierViolationError('semanticColors', config.tier, `${role}: ${result.reason}`);
    }
    out[`color.${role}`] = result.normalized;
  }
  return out;
}

function enforceAdvancedTokens(value: Record<string, string>, config: FieldConfig): Record<string, string> {
  if (config.tier === 'locked') {
    throw new TierViolationError('advancedTokens', 'locked', 'raw token overrides are locked for this site');
  }
  const out: Record<string, string> = {};
  for (const [path, raw] of Object.entries(value)) {
    const type = TOKEN_PATH_TYPE[path];
    if (type === undefined) {
      throw new TierViolationError('advancedTokens', 'raw', `"${path}" is not a recognised token path`);
    }
    const result = validateTokenValue(raw, type);
    if (!result.ok) throw new TierViolationError('advancedTokens', 'raw', `${path}: ${result.reason}`);
    out[path] = result.normalized;
  }
  return out;
}

/**
 * Enforce the tier check for every field present on `patch`, against the
 * site's *current* `controlConfig` — never a client's assumption of it.
 * Throws {@link TierViolationError} on the first violation found.
 */
export function enforceTiers(patch: DraftPatch, controlConfig: ControlConfig = defaultControlConfig()): EnforcedPatch {
  const fieldValues: Partial<Record<FieldId, string>> = {};
  const rawOverrides: Record<string, string> = {};
  const passthrough: Record<string, string> = {};
  let brandColor: string | undefined;

  if (patch.brandColor !== undefined) {
    brandColor = enforceScalar('brandColor', patch.brandColor, controlConfig.brandColor);
  }

  for (const fieldId of SCALAR_TOKEN_FIELDS) {
    const value = patch[fieldId];
    if (value !== undefined) fieldValues[fieldId] = enforceScalar(fieldId, value, controlConfig[fieldId]);
  }

  for (const fieldId of PASSTHROUGH_TEXT_FIELDS) {
    const value = patch[fieldId];
    if (value !== undefined) passthrough[fieldId] = enforceScalar(fieldId, value, controlConfig[fieldId]);
  }

  if (patch.logo !== undefined) {
    if (controlConfig.logo.tier === 'locked') {
      throw new TierViolationError('logo', 'locked', 'the logo is locked and cannot be edited');
    }
    if (patch.logo.light !== undefined) passthrough['logoLight'] = patch.logo.light;
    if (patch.logo.dark !== undefined) passthrough['logoDark'] = patch.logo.dark;
  }

  if (patch.semanticColors !== undefined) {
    Object.assign(rawOverrides, enforceSemanticColors(patch.semanticColors, controlConfig.semanticColors));
  }

  if (patch.advancedTokens !== undefined) {
    Object.assign(rawOverrides, enforceAdvancedTokens(patch.advancedTokens, controlConfig.advancedTokens));
  }

  return {
    ...(brandColor !== undefined ? { brandColor } : {}),
    fieldValues,
    rawOverrides,
    passthrough,
  };
}
