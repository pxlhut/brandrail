/**
 * The ramp shape — D4.
 *
 * Twelve steps at **fixed** OKLCH lightness. Fixed stops are what make the
 * contrast guarantee provable: step 12 against step 1 behaves the same
 * regardless of what brand colour came in. Deriving the curve from the input's
 * own lightness would feel more "on brand" and make every floor
 * input-dependent, which is much harder to test.
 */

/** Index 0 is the app background; index 11 is the strongest text/solid. */
export const RAMP_STEPS = 12;

/**
 * Light mode: dense at the top, where steps 1–6 are all backgrounds and subtle
 * fills and small lightness differences matter a lot; sparse at the bottom.
 */
export const LIGHT_L: readonly number[] = [
  0.99, 0.975, 0.95, 0.92, 0.89, 0.85, 0.79, 0.68, 0.52, 0.45, 0.37, 0.21,
];

/**
 * Dark mode, generated with its own stops rather than by inverting the light
 * ramp (D6). Perceived contrast on dark grounds behaves differently — which is
 * exactly why APCA is polarity-aware and WCAG 2 is not.
 *
 * Index semantics match the light ramp: 0 is the app background (darkest here),
 * 11 is the strongest text. That shared meaning is what lets step 06 assign
 * roles by index without caring which mode it is in.
 */
export const DARK_L: readonly number[] = [
  0.18, 0.21, 0.25, 0.29, 0.34, 0.39, 0.44, 0.48, 0.52, 0.68, 0.84, 0.97,
];

/**
 * The contrast dead zone, and why the stops are where they are.
 *
 * APCA contrast against a surface is bounded by what pure black or pure white
 * can achieve on it. Measured against these stops, that ceiling collapses in
 * the middle of the lightness range:
 *
 * ```
 *   L 0.95 → 96      L 0.72 → 62      L 0.50 → 86
 *   L 0.89 → 85      L 0.68 → 60      L 0.42 → 93
 *   L 0.80 → 69      L 0.62 → 70      L 0.24 → 106
 * ```
 *
 * So **no surface in L ≈ [0.57, 0.84] can carry Lc 75 text**, with any
 * foreground colour whatsoever. Every twelve-step ramp spanning 0.18 to 0.99
 * must pass through that band; the only choice is which index lands in it.
 *
 * Index 8 is the solid step — `primary`, `secondary`, `accent`, `destructive` —
 * and its foreground has to clear Lc 75 (D5). Chroma costs headroom too, so the
 * stop is chosen against the worst hue rather than against neutral grey.
 * Measured minimum ceiling across eight saturated hues at the envelope's peak
 * chroma:
 *
 * ```
 *   L 0.60 → 69   L 0.56 → 74.8   L 0.52 → 80.1   L 0.48 → 85.2
 *   L 0.58 → 72   L 0.54 → 77.7   L 0.50 → 82.8
 * ```
 *
 * Index 8 therefore sits at **0.52 in both modes** — about five points of
 * margin over the floor. Two earlier drafts put it at 0.62 and then 0.56: the
 * first cannot carry a button label at all, and the second misses by 0.15 of an
 * Lc point on a neon green. Both would have surfaced in step 06 with the ramps
 * already built.
 */
export const SOLID_INDEX = 8;

/**
 * Chroma envelope, as a multiplier of the input colour's own chroma.
 *
 * Peaks across steps 7–9 (indices 6–8), where the brand colour actually reads
 * as itself, and tapers toward both ends. Two failure modes this exists to
 * prevent:
 *
 * - A near-grey brand with chroma applied uniformly produces light steps that
 *   look accidentally tinted.
 * - A neon brand at full chroma produces mid-steps that are unreadable and
 *   light steps that look radioactive.
 *
 * Scaling by the *input's* chroma rather than a constant is what makes a muted
 * brand stay muted — the same property §34 relies on for semantic colours.
 */
export const CHROMA_ENVELOPE: readonly number[] = [
  0.08, 0.14, 0.22, 0.34, 0.48, 0.66, 0.85, 1.0, 1.0, 0.92, 0.78, 0.48,
];

/**
 * Neutral ramp chroma — absolute, not scaled by the brand.
 *
 * §33 is explicit that `neutralTone` changes the feel of every border and
 * background *without touching brand colour*, so the neutral hue comes from the
 * warm/cool choice alone. Kept well under 0.02 so these read as greys.
 */
export const NEUTRAL_CHROMA: readonly number[] = [
  0.004, 0.005, 0.006, 0.008, 0.01, 0.012, 0.014, 0.014, 0.012, 0.01, 0.008, 0.006,
];

/** OKLCH hue for each neutral tone. */
export const NEUTRAL_HUE = {
  warm: 60,
  cool: 250,
} as const;

export type NeutralTone = keyof typeof NEUTRAL_HUE;

/**
 * Below this chroma, hue is meaningless and culori reports it as undefined.
 * `#000000`, `#FFFFFF` and `#808080` are the first things anyone types into a
 * colour picker, so this case is ordinary, not exceptional.
 */
export const ACHROMATIC_THRESHOLD = 0.01;

/** Hue used for the trace tint in an achromatic brand's ramp. */
export const ACHROMATIC_FALLBACK_HUE = 250;
