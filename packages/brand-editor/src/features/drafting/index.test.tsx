import { act, renderHook } from '@testing-library/react';
import { defaultControlConfig } from '@pxlhut/brand-core';
import type { BrandConfig } from '@pxlhut/brand-core';
import { ConflictError } from '@pxlhut/brand-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDraft } from './index.js';

function fixtureDraft(overrides: Partial<BrandConfig> = {}): BrandConfig {
  return {
    siteId: 'site-1',
    brandColor: '#7c6cff',
    controlConfig: defaultControlConfig(),
    fieldValues: {},
    rawOverrides: {},
    passthrough: {},
    schemaVersion: 1,
    version: 1,
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDraft', () => {
  it('debounces at 400ms — a fast drag produces one save', async () => {
    const initial = fixtureDraft();
    const onSave = vi.fn(async (): Promise<BrandConfig> => ({ ...initial, version: 2 }));
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => {
      result.current.setField('elevation', '10');
      result.current.setField('elevation', '20');
      result.current.setField('elevation', '30');
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ elevation: '30', expectedVersion: 1 });
  });

  it('applies the enforced patch to the draft immediately, before the save resolves', () => {
    const initial = fixtureDraft();
    const onSave = vi.fn(() => new Promise<BrandConfig>(() => {}));
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => result.current.setField('bodyFont', 'inter'));

    expect(result.current.draft.fieldValues.bodyFont).toBe('inter');
    expect(result.current.dirty.has('bodyFont')).toBe(true);
  });

  it('a locked-field write surfaces a field error and never touches the draft', () => {
    const initial = fixtureDraft();
    expect(initial.controlConfig.semanticColors.tier).toBe('locked');
    const onSave = vi.fn();
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => result.current.setField('semanticColors', { destructive: '#ff0000' }));

    expect(result.current.fieldErrors.semanticColors).toMatch(/locked/);
    expect(result.current.draft.rawOverrides).toEqual({});
    expect(onSave).not.toHaveBeenCalled();
  });

  it('surfaces ConflictError as a distinct state and keeps the edit queued', async () => {
    const initial = fixtureDraft();
    const onSave = vi.fn(async (): Promise<BrandConfig> => {
      throw new ConflictError('stale version');
    });
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => result.current.setField('radius', '1rem'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.conflict).toBe(true);
    expect(result.current.saveError).toBeNull();
    // The unsaved edit is still visible locally and still marked dirty —
    // a conflict must never silently drop the owner's own keystrokes.
    expect(result.current.draft.fieldValues.radius).toBe('1rem');
    expect(result.current.dirty.has('radius')).toBe(true);
  });

  it('a generic save failure is distinct from a conflict', async () => {
    const initial = fixtureDraft();
    const onSave = vi.fn(async (): Promise<BrandConfig> => {
      throw new Error('network down');
    });
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => result.current.setField('radius', '1rem'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.conflict).toBe(false);
    expect(result.current.saveError).toBe('network down');
  });

  it('flush() sends immediately, bypassing the debounce', async () => {
    const initial = fixtureDraft();
    const onSave = vi.fn(async (): Promise<BrandConfig> => ({ ...initial, version: 2, fieldValues: { radius: '1rem' } }));
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => result.current.setField('radius', '1rem'));
    await act(async () => {
      await result.current.flush();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.draft.version).toBe(2);
    expect(result.current.dirty.has('radius')).toBe(false);
  });

  it('reload() replaces the draft and clears conflict/dirty/error state', async () => {
    const initial = fixtureDraft();
    const onSave = vi.fn(async (): Promise<BrandConfig> => {
      throw new ConflictError('stale version');
    });
    const { result } = renderHook(() => useDraft({ initial, controlConfig: initial.controlConfig, onSave }));

    act(() => result.current.setField('radius', '1rem'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.conflict).toBe(true);

    const fresh = fixtureDraft({ version: 5 });
    act(() => result.current.reload(fresh));

    expect(result.current.conflict).toBe(false);
    expect(result.current.dirty.size).toBe(0);
    expect(result.current.draft.version).toBe(5);
  });
});
