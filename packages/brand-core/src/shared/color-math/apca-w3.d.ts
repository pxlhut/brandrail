/**
 * `apca-w3` ships no type declarations (v0.1.9). This is the minimal surface
 * this package uses.
 *
 * APCA is polarity-aware: Lc is positive for dark-on-light, negative for
 * light-on-dark, and the two magnitudes are not interchangeable. Argument
 * order is therefore load-bearing, which the signature below makes explicit.
 */
declare module 'apca-w3' {
  /** sRGB channel triple, 0–255. */
  export type Rgb255 = [number, number, number];

  /** Screen luminance, the input APCAcontrast expects. */
  export function sRGBtoY(rgb: Rgb255): number;

  /**
   * @param textY   luminance of the FOREGROUND
   * @param bgY     luminance of the BACKGROUND
   * @returns Lc, signed. Swapping the arguments is not a sign flip — it is a
   *          different number.
   */
  export function APCAcontrast(textY: number, bgY: number): number;

  export function reverseAPCA(
    contrast: number,
    knownY: number,
    knownType?: 'bg' | 'text',
    returnAs?: 'hex' | 'color' | 'Y',
  ): number | string | false;
}
