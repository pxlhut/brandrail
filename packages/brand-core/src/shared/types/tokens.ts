/**
 * The token tree — what `generateTheme()` produces and what every output
 * serializer consumes.
 *
 * Guideline §25 (light/dark shape), §32 (shape tokens are a separate branch
 * from colour), §34 (semantic colours are derived).
 */

/**
 * A token is one value, or a light/dark pair.
 *
 * D6 makes dark mode derived rather than authored, so in practice every
 * colour token is a pair. The union stays because shape tokens — radius,
 * border width — genuinely are single values in both modes.
 */
export type TokenValue = string | { light: string; dark: string };

/**
 * Colour roles, matching shadcn/ui's CSS custom-property set.
 *
 * Every `*-foreground` role has a minimum APCA contrast against its paired
 * surface, recorded in DECISIONS.md D5 and D11. That table is the
 * accessibility guarantee; this union is the key set it validates against.
 */
export type ColorRole =
  // surfaces and their text
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  // brand-derived
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  // semantic — fixed hues, brand-derived lightness and chroma (§34)
  | 'destructive'
  | 'destructive-foreground'
  | 'success'
  | 'success-foreground'
  | 'warning'
  | 'warning-foreground'
  | 'info'
  | 'info-foreground'
  // structural
  | 'border'
  | 'input'
  | 'ring'
  // sidebar — shadcn ships these; a theme that omits them renders the
  // sidebar component unstyled. See D11.
  | 'sidebar'
  | 'sidebar-foreground'
  | 'sidebar-primary'
  | 'sidebar-primary-foreground'
  | 'sidebar-accent'
  | 'sidebar-accent-foreground'
  | 'sidebar-border'
  | 'sidebar-ring';

/** Categorical series colours. shadcn ships five; charts render blank without them. */
export type ChartRole = `chart-${1 | 2 | 3 | 4 | 5}`;

/**
 * Shape tokens. Not colour: these never run through OKLCH and never get a
 * contrast check (§32). They come from a separate generator.
 */
export interface ShapeTokens {
  /** Corner radius, e.g. '0.5rem'. */
  radius: TokenValue;
  borderWidth: TokenValue;
  /** Spacing-scale multiplier from the `density` field. 1 = comfortable. */
  densityScale: TokenValue;
  /** Shadow alpha, 0–1, from the `elevation` slider. A strength, not a composed shadow. */
  shadowStrength: TokenValue;
}

export interface TypographyTokens {
  /** A full font stack, never a bare family name (§35). */
  headingFont: TokenValue;
  bodyFont: TokenValue;
}

export interface TokenTreeMeta {
  /** The input this tree was generated from. Debugging, support, rollback. */
  sourceBrandColor: string;
  /** Bumped whenever generation output changes for a fixed input (§6). */
  schemaVersion: number;
}

export interface TokenTree {
  color: Record<ColorRole, TokenValue>;
  chart: Record<ChartRole, TokenValue>;
  shape: ShapeTokens;
  typography: TypographyTokens;
  meta: TokenTreeMeta;
}

/**
 * An override may name one mode only.
 *
 * This is why merging is per-mode rather than per-token: `{ light: '#fff' }`
 * must leave `dark` alone. A `TokenValue` cannot express that, because its
 * object form requires both.
 */
export type PartialTokenValue = string | { light?: string; dark?: string };

/** A partial tree, for the merge layers in §18 (guided, direct, raw overrides). */
export type PartialTokenTree = {
  color?: Partial<Record<ColorRole, PartialTokenValue>>;
  chart?: Partial<Record<ChartRole, PartialTokenValue>>;
  shape?: Partial<Record<keyof ShapeTokens, PartialTokenValue>>;
  typography?: Partial<Record<keyof TypographyTokens, PartialTokenValue>>;
};

/** Which mode a resolved value belongs to. */
export type ColorScheme = 'light' | 'dark';
