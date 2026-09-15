/**
 * `provisionSite` — guideline §20's invariant: generate and publish a
 * default snapshot as part of creating the site, so "no active snapshot"
 * cannot happen in production and no read path needs a null branch.
 *
 * Also copies a profile into the site's own `controlConfig` (§17) — a copy,
 * not a live join. After this call the two are independent; editing the
 * profile later does not propagate. That's deliberate: per-site
 * customisation being first-class matters more than bulk profile edits
 * being free.
 *
 * One honest limit: `BrandThemeStore`'s `saveConfig` and `publish` are two
 * separate calls, and the contract (step 10) exposes no primitive spanning
 * both — so this cannot be "the same transaction" in the literal database
 * sense §20 describes, only the closest a caller of this contract can get
 * (sequential, with nothing else able to observe the gap in between, since
 * nothing else runs here). An adapter wanting true cross-call atomicity
 * would need a contract change, which is out of scope for this step.
 */

import {
  applyProfile,
  defaultControlConfig,
  generateTheme,
  SCHEMA_VERSION,
  toShadcnCss,
} from '@pxlhut/brand-core';
import type { ControlProfile, Snapshot } from '@pxlhut/brand-core';

import type { BrandThemeStore } from '../../../contract/index.js';
import { hashCssText, hashTokens } from '../publishing/hash.js';
import { toGenerateInput } from '../publishing/to-generate-input.js';

export interface ProvisioningContext {
  store: BrandThemeStore;
}

export interface ProvisionSiteInput {
  /** The one true input (§33) — required; there is no sensible platform-wide default brand colour. */
  brandColor: string;
  /** Copied into the site's own `controlConfig` (§17). @default the registry's own default tiers */
  profile?: ControlProfile;
}

export async function provisionSite(
  siteId: string,
  input: ProvisionSiteInput,
  ctx: ProvisioningContext,
): Promise<Snapshot> {
  const controlConfig = input.profile !== undefined ? applyProfile(input.profile) : defaultControlConfig();

  const config = await ctx.store.saveConfig(
    siteId,
    {
      brandColor: input.brandColor,
      controlConfig,
      fieldValues: {},
      rawOverrides: {},
      passthrough: {},
      schemaVersion: SCHEMA_VERSION,
    },
    0,
  );

  const generated = generateTheme(toGenerateInput(config));
  if (generated.violations.length > 0) {
    // Step 06 guarantees zero violations on the generated base with no
    // direct/raw overrides (there are none yet, on a brand-new site) — this
    // is a defensive check on that guarantee, not a path this should ever
    // actually take.
    throw new Error(
      `provisionSite(${siteId}): the generated base theme unexpectedly failed its own contrast floors`,
    );
  }

  const cssText = toShadcnCss(generated.tokens);
  return ctx.store.publish(siteId, {
    tokens: generated.tokens,
    cssText,
    checksum: hashTokens(generated.tokens),
    cssSha256: hashCssText(cssText),
  });
}
