/**
 * `useBrandEditor` — the headless hook (step 16).
 *
 * No markup, no styling. Given a site's `controlConfig` and its current
 * `BrandConfig`, returns everything a settings screen needs to render
 * itself: per-field state driven by tier, a live client-side preview, draft
 * saves debounced per §3, and publish gated on the same violations the
 * preview already reports. Step 17's shadcn component is a pure rendering
 * layer over this.
 */

import { useMemo } from 'react';
import type { BrandConfig, ControlConfig, FieldId } from '@pxlhut/brand-core';
import type { DraftPatch, PublishResult } from '@pxlhut/brand-store/service';

import { buildFieldStates, type FieldStates } from './features/field-state/index.js';
import { useDraft } from './features/drafting/index.js';
import { usePreview, type PreviewResult } from './features/preview/index.js';
import { usePublish } from './features/publishing/index.js';
import { useLogoAssets, type LogoAssetsState, type LogoVariant } from './features/assets/index.js';

export type { FieldState, FieldStates, FieldValueFor } from './features/field-state/index.js';
export type { PreviewResult } from './features/preview/index.js';
export type { LogoAssetsState, LogoVariant, LogoVariantState } from './features/assets/index.js';
export { PublishAbortedError } from './features/publishing/index.js';

export interface UseBrandEditorOptions {
  /**
   * The vendor's current tier authority (§9, §31). Kept as its own reactive
   * input, separate from `initial.controlConfig` — changing it between
   * renders (a plan upgrade, a demo flipping `semanticColors` from `locked`
   * to `direct`) reshapes the returned field state with no other code
   * change, which is the step's own acceptance demo.
   */
  controlConfig: ControlConfig;
  /** The site's current draft, as last read from the store. */
  initial: BrandConfig;
  /** Wired to the platform's own API route, which calls `saveDraft` server-side (§9 — the UI is never the enforcement boundary). */
  onSave: (patch: DraftPatch) => Promise<BrandConfig>;
  /** Wired to the platform's own API route, which calls `publishTheme` server-side. */
  onPublish: () => Promise<PublishResult>;
  /** Uploads one logo variant and returns its URL; omit to disable uploads entirely (§36). */
  onUploadLogo?: (file: File, variant: LogoVariant) => Promise<string>;
  /** @default 400 (§3) */
  debounceMs?: number;
  /** @default '[data-site-theme]' (§5) */
  previewSelector?: string;
}

export interface BrandEditorState {
  fields: FieldStates;
  preview: PreviewResult;
  logo: LogoAssetsState;

  saving: boolean;
  /** A save was rejected for a stale `expectedVersion` (§22) — distinct from `saveError`. */
  conflict: boolean;
  saveError: string | null;
  /** Replace the local draft with a freshly-fetched `BrandConfig` — the natural response to a conflict. */
  reload: (config: BrandConfig) => void;

  canPublish: boolean;
  publishing: boolean;
  publish: () => Promise<PublishResult>;
  lastPublishResult: PublishResult | null;
}

export function useBrandEditor({
  controlConfig,
  initial,
  onSave,
  onPublish,
  onUploadLogo,
  debounceMs,
  previewSelector,
}: UseBrandEditorOptions): BrandEditorState {
  const draftState = useDraft({
    initial,
    controlConfig,
    onSave,
    ...(debounceMs !== undefined ? { debounceMs } : {}),
  });

  const preview = usePreview({
    draft: draftState.draft,
    controlConfig,
    ...(previewSelector !== undefined ? { selector: previewSelector } : {}),
  });

  const publishState = usePublish({
    onPublish,
    flush: draftState.flush,
    preview,
    conflict: draftState.conflict,
  });

  const errors = useMemo(
    () => ({ ...publishState.publishErrors, ...draftState.fieldErrors }),
    [publishState.publishErrors, draftState.fieldErrors],
  );

  const onChange = draftState.setField;
  const fields = useMemo(
    () =>
      buildFieldStates({
        controlConfig,
        draft: draftState.draft,
        errors,
        dirty: draftState.dirty,
        onChange,
      }),
    [controlConfig, draftState.draft, errors, draftState.dirty, onChange],
  );

  const logo = useLogoAssets({
    value: fields.logo.value,
    disabled: fields.logo.disabled,
    setValue: fields.logo.setValue,
    ...(onUploadLogo !== undefined ? { onUpload: onUploadLogo } : {}),
  });

  return {
    fields,
    preview,
    logo,
    saving: draftState.saving,
    conflict: draftState.conflict,
    saveError: draftState.saveError,
    reload: draftState.reload,
    canPublish: publishState.canPublish,
    publishing: publishState.publishing,
    publish: publishState.publish,
    lastPublishResult: publishState.lastResult,
  };
}

// Re-exported so a consumer building a custom renderer never has to reach
// into `@pxlhut/brand-store` itself just to name these two types.
export type { FieldId };
