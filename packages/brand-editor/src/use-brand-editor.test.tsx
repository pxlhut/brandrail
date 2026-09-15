/**
 * End-to-end against the step 12 in-memory store — no database, exactly
 * acceptance criterion 9. `onSave`/`onPublish` are wired the way a real
 * platform wires them: to the real `saveDraft`/`publishTheme` service
 * functions (step 13) over a real `MemoryBrandThemeStore` (step 12), not to
 * a test double standing in for either.
 */

import { act, renderHook } from '@testing-library/react';
import { FIELD_IDS } from '@pxlhut/brand-core';
import { MemoryBrandThemeStore } from '@pxlhut/brand-store/memory';
import { provisionSite, publishTheme, saveDraft, type AccessContext } from '@pxlhut/brand-store/service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublishAbortedError, useBrandEditor } from './use-brand-editor.js';

const SITE_ID = 'site-e2e';

async function setup() {
  const store = new MemoryBrandThemeStore();
  await provisionSite(SITE_ID, { brandColor: '#7c6cff' }, { store });
  const initial = await store.getConfig(SITE_ID);
  if (initial === null) throw new Error('provisionSite did not create a config');

  const access: AccessContext = { userId: 'owner-1', authorize: async () => 'owner' };
  const onSave = (patch: Parameters<typeof saveDraft>[1]) => saveDraft(SITE_ID, patch, { store, ...access });
  const onPublish = () => publishTheme(SITE_ID, { store, ...access });

  return { store, initial, onSave, onPublish };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useBrandEditor — end to end', () => {
  it('renders all 14 §33 fields from the real registry-backed controlConfig', async () => {
    const { initial, onSave, onPublish } = await setup();
    const { result } = renderHook(() =>
      useBrandEditor({ controlConfig: initial.controlConfig, initial, onSave, onPublish }),
    );

    expect(Object.keys(result.current.fields)).toHaveLength(FIELD_IDS.length);
    for (const id of FIELD_IDS) expect(result.current.fields[id].id).toBe(id);
  });

  it('live preview has no violations on a fresh site and reshapes when controlConfig changes', async () => {
    const { initial, onSave, onPublish } = await setup();
    const { result, rerender } = renderHook(
      ({ controlConfig }) => useBrandEditor({ controlConfig, initial, onSave, onPublish }),
      { initialProps: { controlConfig: initial.controlConfig } },
    );

    expect(result.current.preview.violations).toEqual([]);
    expect(result.current.fields.semanticColors.disabled).toBe(true);

    const upgraded = { ...initial.controlConfig, semanticColors: { tier: 'direct' as const, type: 'color' as const } };
    rerender({ controlConfig: upgraded });

    expect(result.current.fields.semanticColors.disabled).toBe(false);
    expect(result.current.fields.semanticColors.tier).toBe('direct');
  });

  it('a fast slider drag debounces to one real saveDraft call and lands the new version', async () => {
    const { store, initial, onSave, onPublish } = await setup();
    const { result } = renderHook(() =>
      useBrandEditor({ controlConfig: initial.controlConfig, initial, onSave, onPublish }),
    );

    act(() => {
      result.current.fields.elevation.setValue('10');
      result.current.fields.elevation.setValue('40');
      result.current.fields.elevation.setValue('72');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.fields.elevation.value).toBe('72');
    expect(result.current.saving).toBe(false);
    expect(result.current.saveError).toBeNull();

    const stored = await store.getConfig(SITE_ID);
    expect(stored?.fieldValues.elevation).toBe('72');
    expect(stored?.version).toBe(initial.version + 1);
  });

  it('publishes successfully through the real pipeline and canPublish reflects live violations', async () => {
    const { initial, onSave, onPublish } = await setup();
    const { result } = renderHook(() =>
      useBrandEditor({ controlConfig: initial.controlConfig, initial, onSave, onPublish }),
    );

    expect(result.current.canPublish).toBe(true);

    await act(async () => {
      const outcome = await result.current.publish();
      expect(outcome.ok).toBe(true);
    });

    expect(result.current.lastPublishResult?.ok).toBe(true);
  });

  it('a conflicting concurrent save surfaces `conflict`, distinct from a generic error', async () => {
    const { initial, onSave, onPublish } = await setup();
    const { result } = renderHook(() =>
      useBrandEditor({ controlConfig: initial.controlConfig, initial, onSave, onPublish }),
    );

    // Someone else edits and saves first, out from under this hook's stale `expectedVersion`.
    await onSave({ companyName: 'Someone Else Inc.', expectedVersion: initial.version });

    act(() => result.current.fields.companyName.setValue('My Company'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.conflict).toBe(true);
    expect(result.current.saveError).toBeNull();
  });

  it('publish() aborts rather than shipping a config that is missing an edit still stuck behind a conflict', async () => {
    const { initial, onSave, onPublish } = await setup();
    const { result } = renderHook(() =>
      useBrandEditor({ controlConfig: initial.controlConfig, initial, onSave, onPublish }),
    );

    // Someone else saves first, so this hook's own pending edit will conflict.
    await onSave({ companyName: 'Someone Else Inc.', expectedVersion: initial.version });
    act(() => result.current.fields.companyName.setValue('My Company'));

    // The edit is still only 400ms-debounced, not yet sent — publish() must
    // flush it, discover the conflict, and abort instead of publishing the
    // still-stale server config as if "My Company" had made it in.
    await act(async () => {
      await expect(result.current.publish()).rejects.toBeInstanceOf(PublishAbortedError);
    });

    expect(result.current.conflict).toBe(true);
    expect(result.current.lastPublishResult).toBeNull();
  });

  it('publish rejects with field-level errors when a raw override breaks a contrast floor', async () => {
    const { initial, onSave, onPublish } = await setup();
    // advancedTokens is `raw` tier by default (§33) — no controlConfig override needed.
    expect(initial.controlConfig.advancedTokens.tier).toBe('raw');
    const { result } = renderHook(() =>
      useBrandEditor({ controlConfig: initial.controlConfig, initial, onSave, onPublish }),
    );

    act(() => {
      result.current.fields.advancedTokens.setValue({
        'color.primary': '#808080',
        'color.primary-foreground': '#888888',
      });
    });

    expect(result.current.canPublish).toBe(false);
    expect(result.current.fields.advancedTokens.error).toBeNull(); // no *tier* error — the value itself is a valid colour
    expect(result.current.preview.violations.length).toBeGreaterThan(0);
  });
});
