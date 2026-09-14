/**
 * Merge precedence — guideline §18.
 *
 * ```
 * finalTokens = merge(generatedBase, guided, direct, raw)
 * //                  base < guided < direct < raw
 * ```
 *
 * Deliberately dumb: a structural merge over plain objects with a documented
 * precedence and no special cases. The moment this knows anything about colour,
 * it is the wrong abstraction.
 *
 * §18 is emphatic that the merge happens **exactly once**, inside publish,
 * before hashing — never at read time. The read path reads an already-finished
 * result.
 */

import type {
  PartialTokenTree,
  PartialTokenValue,
  TokenTree,
  TokenValue,
} from '../../shared/types/index.js';

/**
 * Merge one token value.
 *
 * The subtlety that matters: a partial override merges **per mode**, not per
 * token. A direct edit that sets only `{ light: '#fff' }` must leave `dark`
 * alone — otherwise a light-mode tweak silently blanks dark mode, and the owner
 * finds out from a customer.
 */
export function mergeTokenValue(
  base: TokenValue | undefined,
  override: PartialTokenValue | undefined,
): TokenValue | undefined {
  if (override === undefined) return base;

  // A plain string replaces outright — it carries both modes by definition.
  if (typeof override === 'string') return override;

  const baseLight = typeof base === 'string' ? base : base?.light;
  const baseDark = typeof base === 'string' ? base : base?.dark;

  const light = override.light ?? baseLight;
  const dark = override.dark ?? baseDark;

  if (light === undefined && dark === undefined) return base;
  // A half-specified override against no base at all is still honoured for the
  // mode it names; the caller's validator decides whether that is acceptable.
  if (light === undefined) return { light: dark as string, dark: dark as string };
  if (dark === undefined) return { light, dark: light };
  return light === dark ? light : { light, dark };
}

function mergeRecord<K extends string>(
  base: Record<K, TokenValue>,
  override: Partial<Record<K, PartialTokenValue>> | undefined,
): Record<K, TokenValue> {
  if (override === undefined) return { ...base };
  const out = { ...base };
  for (const key of Object.keys(override) as K[]) {
    const merged = mergeTokenValue(base[key], override[key]);
    if (merged !== undefined) out[key] = merged;
  }
  return out;
}

/** Apply one partial layer over a complete tree. */
export function mergeLayer(base: TokenTree, layer: PartialTokenTree | undefined): TokenTree {
  if (layer === undefined) return base;
  return {
    color: mergeRecord(base.color, layer.color),
    chart: mergeRecord(base.chart, layer.chart),
    shape: mergeRecord(base.shape, layer.shape),
    typography: mergeRecord(base.typography, layer.typography),
    meta: { ...base.meta },
  };
}

/**
 * Apply every override layer in §18's order.
 *
 * Later layers win. `raw` is last because it is the tier where the person
 * doing the overriding is presumed to know what they are overriding — it
 * bypasses the contrast gate by design, though never the syntax validator
 * (§19).
 */
export function mergeLayers(
  base: TokenTree,
  overrides: {
    guided?: PartialTokenTree | undefined;
    direct?: PartialTokenTree | undefined;
    raw?: PartialTokenTree | undefined;
  } = {},
): TokenTree {
  let out = base;
  for (const layer of [overrides.guided, overrides.direct, overrides.raw]) {
    out = mergeLayer(out, layer);
  }
  return out;
}
