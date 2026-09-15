import { defaultControlConfig, generateTheme, toShadcnCss } from '@pxlhut/brand-core';
import type { BrandConfig } from '@pxlhut/brand-core';

import type { PublishInput } from '../contract/index.js';

/** A fresh id per call — tests don't share sites even when they share a store instance. */
export function freshSiteId(): string {
  return `site-${crypto.randomUUID()}`;
}

/**
 * A real, valid `PublishInput` built from the actual generator — not a hand-
 * faked `TokenTree` that could drift from what `generateTheme` really
 * produces. `checksum`/`cssSha256` are plain stand-ins keyed off `label`:
 * the store contract only ever compares them as opaque strings (rule 3), so
 * a real SHA-256 would add cost here for zero additional coverage.
 */
export function samplePublishInput(label: string, brandColor = '#7C6CFF'): PublishInput {
  const { tokens } = generateTheme({ brandColor });
  return {
    tokens,
    cssText: toShadcnCss(tokens),
    checksum: `checksum-${label}`,
    cssSha256: `csssha-${label}`,
  };
}

/** A minimal, valid config patch — enough to satisfy `BrandConfig`'s required fields for a first `saveConfig`. */
export function sampleConfigPatch(brandColor = '#7C6CFF'): Partial<BrandConfig> {
  return {
    brandColor,
    controlConfig: defaultControlConfig(),
    fieldValues: {},
    rawOverrides: {},
    passthrough: {},
    schemaVersion: 1,
  };
}
