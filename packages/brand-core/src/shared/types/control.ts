/**
 * The control-tier model — the part of this system nothing else on npm has.
 *
 * The platform vendor decides, per field, how much freedom each site's owner
 * gets. Guideline §9 (enforced at the write boundary, not the UI), §31 (Guided
 * tier has two control shapes, not one), §33 (the field list), §17 (profiles
 * are templates copied at provisioning, not live joins).
 */

export type Tier = 'locked' | 'guided' | 'direct' | 'raw';

/** Guided select options are `{ label, value }` pairs — never bare strings (§31). */
export interface SelectOption {
  /** What the owner reads. */
  label: string;
  /** What lands in the token. */
  value: string;
}

/** Owner sees the result; the value is fixed by the developer. */
export interface LockedField {
  tier: 'locked';
  value?: string;
}

/** A continuous range. Right for elevation; wrong for radius (§31). */
export interface GuidedSliderField {
  tier: 'guided';
  type: 'slider';
  min: number;
  max: number;
  step?: number;
}

/** Discrete choices. Right for radius, density, fonts (§31). */
export interface GuidedSelectField {
  tier: 'guided';
  type: 'select';
  options: readonly SelectOption[];
}

export type DirectValueType = 'color' | 'text' | 'asset' | 'length' | 'number';

/** A real value from the owner, still validated (step 07) and contrast-gated (§7). */
export interface DirectField<T extends DirectValueType = DirectValueType> {
  tier: 'direct';
  type: T;
  /** e.g. `['light', 'dark']` for a logo (§36). */
  variants?: readonly string[];
}

/** No guardrails beyond the syntax validator. Expert / agency tier. */
export interface RawField {
  tier: 'raw';
}

/** Every shape a field config can take. */
export type FieldConfig =
  | LockedField
  | GuidedSliderField
  | GuidedSelectField
  | DirectField
  | RawField;

/**
 * The §33 reference brand kit. Thirteen table rows, fourteen fields —
 * `headingFont` and `bodyFont` share a row in the document.
 */
export type FieldId =
  | 'companyName'
  | 'logo'
  | 'brandColor'
  | 'semanticColors'
  | 'headingFont'
  | 'bodyFont'
  | 'radius'
  | 'density'
  | 'neutralTone'
  | 'buttonStyle'
  | 'elevation'
  | 'advancedTokens'
  | 'supportUrl'
  | 'emailSenderName';

/**
 * Fields that never reach `generateTheme()` (§36). A logo is a file; a support
 * URL is a link. They are carried on the config and the snapshot like any other
 * field, but they do not influence a single token.
 */
export type PassthroughFieldId =
  | 'companyName'
  | 'logo'
  | 'supportUrl'
  | 'emailSenderName';

/**
 * Which configs each field will accept.
 *
 * This is where the guideline's hard constraints become compile errors rather
 * than review comments:
 *
 * - **Fonts are `guided: select` or `locked`, at every tier** (§35). Never
 *   direct, never raw, not even for an agency profile. An arbitrary font name
 *   fails silently to a system fallback, and re-serving fonts on behalf of
 *   other businesses is real licensing exposure.
 * - **`semanticColors` is never `guided`** — there is no meaningful slider or
 *   select for "what colour is an error". It is locked by default (§34),
 *   and an agency profile may flip it to direct or raw, where the person
 *   doing it is presumed to know what they are overriding.
 * - **Passthrough fields are never `guided`** — they are identity, not tokens.
 */
export type FieldConfigFor<K extends FieldId> =
  // identity and links — plain text the owner types
  K extends 'companyName' | 'supportUrl' | 'emailSenderName'
    ? LockedField | DirectField<'text'>
    : K extends 'logo'
      ? LockedField | DirectField<'asset'>
      : K extends 'brandColor'
        ? LockedField | DirectField<'color'>
        : K extends 'semanticColors'
          ? LockedField | DirectField<'color'> | RawField
          : // §35 — the constraint, not a default
            K extends 'headingFont' | 'bodyFont'
            ? LockedField | GuidedSelectField
            : K extends 'radius'
              ? LockedField | GuidedSelectField | DirectField<'length'>
              : K extends 'density' | 'neutralTone' | 'buttonStyle'
                ? LockedField | GuidedSelectField
                : K extends 'elevation'
                  ? LockedField | GuidedSliderField | DirectField<'number'>
                  : K extends 'advancedTokens'
                    ? LockedField | RawField
                    : never;

/**
 * A site's own, complete control config (§17). Every field has a tier —
 * there is no "unset", because an unset field is an open question at the
 * write boundary and §9 needs a definite answer for every incoming write.
 */
export type ControlConfig = { [K in FieldId]: FieldConfigFor<K> };

/**
 * A reusable template — 'free', 'pro', 'agency'. Copied into a site's own
 * `control_config` at provisioning; the two are independent afterwards, so
 * editing a profile does not propagate to sites already created from it (§17).
 */
export type ControlProfile = { [K in FieldId]?: FieldConfigFor<K> };

/** Narrowing helper for the editor's exhaustive switch (step 16). */
export function tierOf(config: FieldConfig): Tier {
  return config.tier;
}
