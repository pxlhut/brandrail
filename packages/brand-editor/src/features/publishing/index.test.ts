import { act, renderHook } from '@testing-library/react';
import type { Snapshot } from '@pxlhut/brand-core';
import type { PublishResult } from '@pxlhut/brand-store/service';
import { describe, expect, it, vi } from 'vitest';

import type { FlushOutcome } from '../drafting/index.js';
import type { PreviewResult } from '../preview/index.js';
import { PublishAbortedError, usePublish } from './index.js';

function fakePreview(violations: PreviewResult['violations'] = []): PreviewResult {
  return {
    tokens: {} as PreviewResult['tokens'],
    violations,
    adjustments: [],
    advisories: [],
    buttonStyle: 'solid',
    css: '',
    fieldForViolation: () => 'advancedTokens',
  };
}

describe('usePublish', () => {
  it('canPublish is true only with no live violations and no conflict', () => {
    const flush = vi.fn(async (): Promise<FlushOutcome> => 'nothing-pending');
    const onPublish = vi.fn<() => Promise<PublishResult>>();

    const { result, rerender } = renderHook(
      ({ preview, conflict }: { preview: PreviewResult; conflict: boolean }) =>
        usePublish({ onPublish, flush, preview, conflict }),
      { initialProps: { preview: fakePreview(), conflict: false } },
    );
    expect(result.current.canPublish).toBe(true);

    rerender({ preview: fakePreview([{ fg: 'primary-foreground', bg: 'primary', got: 50, min: 75 }]), conflict: false });
    expect(result.current.canPublish).toBe(false);

    rerender({ preview: fakePreview(), conflict: true });
    expect(result.current.canPublish).toBe(false);
  });

  it('publish() flushes any pending draft save before calling onPublish', async () => {
    const order: string[] = [];
    const flush = vi.fn(async (): Promise<FlushOutcome> => {
      order.push('flush');
      return 'flushed';
    });
    const onPublish = vi.fn(async (): Promise<PublishResult> => {
      order.push('publish');
      return { ok: true, snapshot: {} as Snapshot };
    });

    const { result } = renderHook(() => usePublish({ onPublish, flush, preview: fakePreview(), conflict: false }));
    await act(async () => {
      await result.current.publish();
    });

    expect(order).toEqual(['flush', 'publish']);
  });

  it('maps a rejected publish’s violations onto field-level errors, not a generic error', async () => {
    const flush = vi.fn(async (): Promise<FlushOutcome> => 'nothing-pending');
    const onPublish = vi.fn(async () => ({
      ok: false as const,
      violations: [{ fg: 'destructive-foreground' as const, bg: 'destructive' as const, got: 40, min: 75 }],
    }));
    const preview = { ...fakePreview(), fieldForViolation: () => 'semanticColors' as const };

    const { result } = renderHook(() => usePublish({ onPublish, flush, preview, conflict: false }));
    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.publishErrors.semanticColors).toMatch(/destructive/);
    expect(result.current.lastResult).toEqual({
      ok: false,
      violations: [{ fg: 'destructive-foreground', bg: 'destructive', got: 40, min: 75 }],
    });
  });

  it('aborts with PublishAbortedError, never calling onPublish, when the preceding flush hits a conflict', async () => {
    const flush = vi.fn(async (): Promise<FlushOutcome> => 'conflict');
    const onPublish = vi.fn<() => Promise<PublishResult>>();

    const { result } = renderHook(() => usePublish({ onPublish, flush, preview: fakePreview(), conflict: false }));

    await act(async () => {
      await expect(result.current.publish()).rejects.toBeInstanceOf(PublishAbortedError);
    });
    expect(onPublish).not.toHaveBeenCalled();
  });
});
