/**
 * Guideline §33's reference brand kit, as data the code can iterate.
 *
 * Thirteen table rows in the document, fourteen fields — `headingFont` and
 * `bodyFont` share a row there.
 *
 * This registry is the default. A `control_profiles` row (§17) is a partial
 * override of it, copied into a site's own config at provisioning.
 */

import type {
  ControlConfig,
  ControlProfile,
  FieldConfigFor,
  FieldId,
  PassthroughFieldId,
  SelectOption,
} from '../types/index.js';

/** Curated, self-hosted, properly licensed. Never free text, at any tier (§35). */
export const FONT_OPTIONS: readonly SelectOption[] = [
  { label: 'Inter', value: 'inter' },
  { label: 'Space Grotesk', value: 'space-grotesk' },
  { label: 'IBM Plex Sans', value: 'ibm-plex-sans' },
  { label: 'Source Serif 4', value: 'source-serif-4' },
  { label: 'JetBrains Mono', value: 'jetbrains-mono' },
] as const;

/**
 * Full CSS stacks for each curated font id, never a bare family name (§35).
 *
 * Lives here rather than in `features/typography` because step 07's validator
 * needs the same curated set — to reject a raw-tier font override that names
 * a real font but isn't one of these exact stacks — and dependency-cruiser's
 * layering forbids `features/validation` from importing another feature.
 * `features/typography/stacks.ts` re-exports this rather than defining its
 * own copy, so there is exactly one curated list, not two that can drift.
 */
export const FONT_STACKS: Record<string, string> = {
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'space-grotesk': "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'ibm-plex-sans': "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  'source-serif-4': "'Source Serif 4', Georgia, 'Times New Roman', serif",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

/** §32's three presets. Direct tier may supply any valid length instead. */
export const RADIUS_OPTIONS: readonly SelectOption[] = [
  { label: 'Sharp', value: '0.125rem' },
  { label: 'Soft', value: '0.5rem' },
  { label: 'Round', value: '1rem' },
] as const;

/** A spacing-scale multiplier. Cheap to offer, disproportionately requested (§33). */
export const DENSITY_OPTIONS: readonly SelectOption[] = [
  { label: 'Compact', value: '0.875' },
  { label: 'Comfortable', value: '1' },
] as const;

/** Changes the feel of every border and background without touching brand colour (§33). */
export const NEUTRAL_TONE_OPTIONS: readonly SelectOption[] = [
  { label: 'Warm gray', value: 'warm' },
  { label: 'Cool gray', value: 'cool' },
] as const;

export const BUTTON_STYLE_OPTIONS: readonly SelectOption[] = [
  { label: 'Solid', value: 'solid' },
  { label: 'Outline', value: 'outline' },
] as const;

export interface FieldMeta<K extends FieldId = FieldId> {
  id: K;
  /** The default tier and control shape, per §33's table. */
  default: FieldConfigFor<K>;
  /** True when this field never reaches `generateTheme()` (§36). */
  passthrough: boolean;
  /** Why it is tiered this way, lifted from §33. */
  why: string;
}

type Registry = { [K in FieldId]: FieldMeta<K> };

export const FIELD_REGISTRY: Registry = {
  companyName: {
    id: 'companyName',
    default: { tier: 'direct', type: 'text' },
    passthrough: true,
    why: 'Identity, not a token.',
  },
  logo: {
    id: 'logo',
    default: { tier: 'direct', type: 'asset', variants: ['light', 'dark'] },
    passthrough: true,
    why: 'A dark-mode logo is not optional — a light logo disappears on a dark navbar.',
  },
  brandColor: {
    id: 'brandColor',
    default: { tier: 'direct', type: 'color' },
    passthrough: false,
    why: 'The one true input; most colour output derives from this.',
  },
  semanticColors: {
    id: 'semanticColors',
    default: { tier: 'locked' },
    passthrough: false,
    why:
      'Fixed hues (green/amber/red/blue); lightness, chroma and contrast style ' +
      'still match the brand colour. Locked because an owner repainting "error" ' +
      'away from red breaks a learned signal, and that failure is the platform’s.',
  },
  headingFont: {
    id: 'headingFont',
    default: { tier: 'guided', type: 'select', options: FONT_OPTIONS },
    passthrough: false,
    why: 'Curated list — never free text, even at Direct or Raw (§35).',
  },
  bodyFont: {
    id: 'bodyFont',
    default: { tier: 'guided', type: 'select', options: FONT_OPTIONS },
    passthrough: false,
    why: 'Curated list — never free text, even at Direct or Raw (§35).',
  },
  radius: {
    id: 'radius',
    default: { tier: 'guided', type: 'select', options: RADIUS_OPTIONS },
    passthrough: false,
    why: 'Three discrete choices fit better than a drag handle (§31, §32).',
  },
  density: {
    id: 'density',
    default: { tier: 'guided', type: 'select', options: DENSITY_OPTIONS },
    passthrough: false,
    why: 'Spacing-scale multiplier — cheap to offer, disproportionately requested.',
  },
  neutralTone: {
    id: 'neutralTone',
    default: { tier: 'guided', type: 'select', options: NEUTRAL_TONE_OPTIONS },
    passthrough: false,
    why: 'Changes the feel of every border and background without touching brand colour.',
  },
  buttonStyle: {
    id: 'buttonStyle',
    default: { tier: 'guided', type: 'select', options: BUTTON_STYLE_OPTIONS },
    passthrough: false,
    why: 'Affects the default look of every primary CTA.',
  },
  elevation: {
    id: 'elevation',
    default: { tier: 'guided', type: 'slider', min: 0, max: 100 },
    passthrough: false,
    why: 'Reuses the existing surface-depth/border-strength control rather than reinventing one.',
  },
  advancedTokens: {
    id: 'advancedTokens',
    default: { tier: 'raw' },
    passthrough: false,
    why: 'Still subject to the value validator regardless of tier (§19).',
  },
  supportUrl: {
    id: 'supportUrl',
    default: { tier: 'direct', type: 'text' },
    passthrough: true,
    why:
      'A plain link to the site’s own help page. Every real white-label ' +
      'platform surveyed treats it as part of complete branding, not an edge case.',
  },
  emailSenderName: {
    id: 'emailSenderName',
    default: { tier: 'direct', type: 'text' },
    passthrough: true,
    why: 'The "From" display name on transactional email — sender identity, not styling.',
  },
};

/** Every field id, in §33's order. */
export const FIELD_IDS = Object.keys(FIELD_REGISTRY) as readonly FieldId[];

/** Fields that never influence a generated token (§36). */
export const PASSTHROUGH_FIELD_IDS: readonly PassthroughFieldId[] = FIELD_IDS.filter(
  (id): id is PassthroughFieldId => FIELD_REGISTRY[id].passthrough,
);

/**
 * Field configs are plain JSON — strings, numbers, and arrays of
 * `{ label, value }`. A structural clone is enough, and keeps this pure.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The complete default config — what a site gets with no profile applied.
 *
 * Returns a fresh copy each call. Handing out references into `FIELD_REGISTRY`
 * would let one site's edits corrupt every other site's defaults.
 */
export function defaultControlConfig(): ControlConfig {
  const out = {} as Record<FieldId, unknown>;
  for (const id of FIELD_IDS) out[id] = clone(FIELD_REGISTRY[id].default);
  return out as ControlConfig;
}

/**
 * Apply a profile template over the defaults, producing a site's own complete
 * config. §17: this is a **copy**, made once at provisioning.
 *
 * The copy is deep, and that is the whole point. The result must be
 * independent of the profile afterwards — editing a profile later does not
 * propagate to sites already created from it, and a shallow assignment would
 * quietly break that guarantee by sharing the override object.
 */
export function applyProfile(profile: ControlProfile): ControlConfig {
  const base = defaultControlConfig() as Record<FieldId, unknown>;
  for (const id of FIELD_IDS) {
    const override = profile[id];
    if (override !== undefined) base[id] = clone(override);
  }
  return base as ControlConfig;
}
