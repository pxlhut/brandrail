export type { NeutralTone } from './stops.js';
export {
  RAMP_STEPS,
  SOLID_INDEX,
  LIGHT_L,
  DARK_L,
  CHROMA_ENVELOPE,
  NEUTRAL_CHROMA,
  NEUTRAL_HUE,
  ACHROMATIC_THRESHOLD,
  ACHROMATIC_FALLBACK_HUE,
} from './stops.js';
export type { Ramp, RampPair, BrandRamps } from './ramp.js';
export { buildRamp, buildBrandRamps, buildNeutralRamps, resolveHue } from './ramp.js';
