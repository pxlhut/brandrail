/**
 * APCA contrast — the measurement half of the accessibility guarantee.
 *
 * APCA is **polarity-aware**. Lc is positive for dark-on-light and negative
 * for light-on-dark, and the two magnitudes are not interchangeable: swapping
 * foreground and background is not a sign flip, it is a different number.
 * Black on white is Lc 106; white on black is Lc -107.9.
 *
 * Every comparison against a floor therefore uses `Math.abs`, and every call
 * site has to pass the arguments the right way round.
 */

import { APCAcontrast, sRGBtoY } from 'apca-w3';

import { toRgb255, type Oklch } from '../../shared/color-math/index.js';

/**
 * Signed APCA lightness contrast.
 *
 * @param foreground the text or mark
 * @param background the surface it sits on
 */
export function contrastLc(foreground: Oklch, background: Oklch): number {
  return APCAcontrast(sRGBtoY(toRgb255(foreground)), sRGBtoY(toRgb255(background)));
}

/** Absolute contrast, which is what every floor in D5 and D11 is stated against. */
export function absLc(foreground: Oklch, background: Oklch): number {
  return Math.abs(contrastLc(foreground, background));
}

/** Whether this pairing clears its floor. */
export function clearsFloor(foreground: Oklch, background: Oklch, minLc: number): boolean {
  return absLc(foreground, background) >= minLc;
}
