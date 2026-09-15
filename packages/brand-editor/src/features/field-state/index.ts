/**
 * Per-field state, driven entirely by tier (step 16, guideline §31/§33).
 *
 * The renderer switches on `control` and gets exhaustiveness checking from
 * `FieldConfig`'s discriminated union — `{ tier: 'guided', type: 'select' }`
 * and `{ tier: 'guided', type: 'slider' }` are different renders (§31).
 *
 * `FieldValueFor<K>` is derived from `DraftPatch` (`@pxlhut/brand-store/service`)
 * rather than declared a second time — `DraftPatch`'s field keys are exactly
 * `FieldId`'s fourteen members, and it is the shape a real `saveDraft` call
 * already expects. Two independent per-field value shapes would be a second
 * place for the two to drift.
 */

import type { BrandConfig, ControlConfig, FieldConfig, FieldId } from '@pxlhut/brand-core';
import { SEMANTIC_COLOR_ROLES, type DraftPatch, type SemanticColorRole } from '@pxlhut/brand-store/service';

export type FieldValueFor<K extends FieldId> = Required<Omit<DraftPatch, 'expectedVersion'>>[K];

export interface FieldState<K extends FieldId = FieldId> {
  id: K;
  tier: FieldConfig['tier'];
  control: FieldConfig;
  value: FieldValueFor<K>;
  setValue: (value: FieldValueFor<K>) => void;
  error: string | null;
  disabled: boolean;
  dirty: boolean;
}

export type FieldStates = { [K in FieldId]: FieldState<K> };

const SCALAR_FIELD_IDS = [
  'headingFont',
  'bodyFont',
  'radius',
  'density',
  'neutralTone',
  'buttonStyle',
  'elevation',
] as const satisfies readonly FieldId[];

const PASSTHROUGH_TEXT_FIELD_IDS = ['companyName', 'supportUrl', 'emailSenderName'] as const satisfies readonly FieldId[];

/** What a scalar field reads as before the owner has ever set it. */
function scalarDefault(control: FieldConfig): string {
  if (control.tier === 'locked') return control.value ?? '';
  if (control.tier === 'guided' && control.type === 'select') return control.options[0]?.value ?? '';
  if (control.tier === 'guided' && control.type === 'slider') return String(control.min);
  return '';
}

/** Reads one field's current value out of a `BrandConfig` draft. Every field id is handled — new `FieldId` members are a compile error here. */
function readValue(id: FieldId, control: FieldConfig, draft: BrandConfig): unknown {
  switch (id) {
    case 'brandColor':
      return draft.brandColor;
    case 'logo':
      return { light: draft.passthrough['logoLight'], dark: draft.passthrough['logoDark'] };
    case 'semanticColors': {
      const out: Partial<Record<SemanticColorRole, string>> = {};
      for (const role of SEMANTIC_COLOR_ROLES) {
        const value = draft.rawOverrides[`color.${role}`];
        if (value !== undefined) out[role] = value;
      }
      return out;
    }
    case 'advancedTokens': {
      const semanticPaths = new Set(SEMANTIC_COLOR_ROLES.map((role) => `color.${role}`));
      const out: Record<string, string> = {};
      for (const [path, value] of Object.entries(draft.rawOverrides)) {
        if (!semanticPaths.has(path)) out[path] = value;
      }
      return out;
    }
    case 'companyName':
    case 'supportUrl':
    case 'emailSenderName':
      return draft.passthrough[id] ?? scalarDefault(control);
    default:
      return draft.fieldValues[id] ?? scalarDefault(control);
  }
}

/** Every field id this package renders, in §33's order. Kept here (not re-derived from `ControlConfig`, whose keys are unordered by the type system) so field lists render in a stable order. */
export const FIELD_STATE_ORDER: readonly FieldId[] = [
  'companyName',
  'logo',
  'brandColor',
  'semanticColors',
  'headingFont',
  'bodyFont',
  'radius',
  'density',
  'neutralTone',
  'buttonStyle',
  'elevation',
  'advancedTokens',
  'supportUrl',
  'emailSenderName',
];

export interface BuildFieldStatesInput {
  controlConfig: ControlConfig;
  draft: BrandConfig;
  errors: Partial<Record<FieldId, string>>;
  dirty: ReadonlySet<FieldId>;
  onChange: (id: FieldId, value: unknown) => void;
}

/** Pure: the same inputs always produce the same field states. This is what makes acceptance criterion 4 — a `controlConfig` change alone reshaping the returned state — true without any extra wiring. */
export function buildFieldStates({ controlConfig, draft, errors, dirty, onChange }: BuildFieldStatesInput): FieldStates {
  const out = {} as Record<FieldId, unknown>;
  for (const id of FIELD_STATE_ORDER) {
    const control = controlConfig[id];
    const state: FieldState = {
      id,
      tier: control.tier,
      control,
      value: readValue(id, control, draft) as FieldValueFor<FieldId>,
      setValue: control.tier === 'locked' ? () => {} : (value: unknown) => onChange(id, value),
      error: errors[id] ?? null,
      disabled: control.tier === 'locked',
      dirty: dirty.has(id),
    };
    out[id] = state;
  }
  return out as FieldStates;
}

export { SCALAR_FIELD_IDS, PASSTHROUGH_TEXT_FIELD_IDS };
