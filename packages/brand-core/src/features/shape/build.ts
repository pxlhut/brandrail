/**
 * Shape tokens — guideline §32.
 *
 * Not colour. These never run through OKLCH and never get a contrast check, so
 * this is a small pure mapping with no dependency on anything in `palette` or
 * `contrast`.
 */

import type { ShapeTokens, TokenValue } from '../../shared/types/index.js';

export interface ShapeInput {
  /** A CSS length. Guided tier supplies one of §32's presets; Direct tier any valid length. */
  radius?: string;
  /** Spacing-scale multiplier as a string: '0.875' compact, '1' comfortable. */
  density?: string;
  /** 0–100, from §33's guided slider. */
  elevation?: number;
  borderWidth?: string;
}

export const DEFAULT_RADIUS = '0.5rem';
export const DEFAULT_DENSITY = '1';
export const DEFAULT_BORDER_WIDTH = '1px';
export const DEFAULT_ELEVATION = 40;

/**
 * Maximum shadow alpha at elevation 100. Kept modest — this multiplies into
 * every elevated surface, and an aggressive ceiling makes a whole UI look
 * muddy rather than layered.
 */
export const MAX_SHADOW_ALPHA = 0.24;

/** Clamp to the slider's declared range rather than trusting the caller. */
function clampElevation(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ELEVATION;
  return Math.min(100, Math.max(0, value));
}

/**
 * Elevation → shadow strength.
 *
 * Emitted as a **strength**, not a composed `box-shadow` string. A composed
 * shadow is a much larger injection surface for step 07 to validate — offsets,
 * blur radii, colour, `inset`, arbitrary comma-separated layers — and buys
 * nothing the consuming component library cannot do with an alpha.
 */
export function shadowStrengthFor(elevation: number): string {
  const alpha = (clampElevation(elevation) / 100) * MAX_SHADOW_ALPHA;
  return (Math.round(alpha * 1000) / 1000).toString();
}

export function buildShape(input: ShapeInput = {}): ShapeTokens {
  const radius: TokenValue = input.radius ?? DEFAULT_RADIUS;
  const densityScale: TokenValue = input.density ?? DEFAULT_DENSITY;
  const borderWidth: TokenValue = input.borderWidth ?? DEFAULT_BORDER_WIDTH;
  const shadowStrength: TokenValue = shadowStrengthFor(input.elevation ?? DEFAULT_ELEVATION);
  return { radius, borderWidth, densityScale, shadowStrength };
}

/**
 * `buttonStyle` is **not** a token.
 *
 * It is a variant choice the consuming component library acts on — "outline"
 * cannot be expressed as a set of colour values, and trying produces a second,
 * parallel palette that drifts from the first. It rides on the config and the
 * snapshot, and step 08 emits it as a single custom property for the component
 * library to branch on.
 */
export type ButtonStyle = 'solid' | 'outline';

export function normalizeButtonStyle(value: string | undefined): ButtonStyle {
  return value === 'outline' ? 'outline' : 'solid';
}
