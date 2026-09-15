import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useLogoAssets } from './index.js';

function fakeFile(name: string): File {
  return new File(['x'], name, { type: 'image/svg+xml' });
}

describe('useLogoAssets', () => {
  it('uploads a variant and writes the resulting URL back through setValue', async () => {
    const setValue = vi.fn();
    const onUpload = vi.fn(async (_file: File, variant: 'light' | 'dark') => `https://cdn/${variant}.svg`);

    const { result } = renderHook(() => useLogoAssets({ value: {}, disabled: false, setValue, onUpload }));

    await act(async () => {
      await result.current.light.upload(fakeFile('logo.svg'));
    });

    expect(onUpload).toHaveBeenCalledWith(expect.any(File), 'light');
    expect(setValue).toHaveBeenCalledWith({ light: 'https://cdn/light.svg' });
  });

  it('reports upload errors per variant without touching the other variant', async () => {
    const setValue = vi.fn();
    const onUpload = vi.fn(async (_file: File, variant: 'light' | 'dark') => {
      if (variant === 'dark') throw new Error('upload failed');
      return 'https://cdn/light.svg';
    });

    const { result } = renderHook(() =>
      useLogoAssets({ value: { light: 'https://cdn/light.svg' }, disabled: false, setValue, onUpload }),
    );

    await act(async () => {
      await result.current.dark.upload(fakeFile('logo-dark.svg'));
    });

    expect(result.current.dark.error).toBe('upload failed');
    expect(result.current.light.error).toBeNull();
  });

  it('is a no-op when the logo field is locked', async () => {
    const setValue = vi.fn();
    const onUpload = vi.fn();

    const { result } = renderHook(() => useLogoAssets({ value: {}, disabled: true, setValue, onUpload }));

    await act(async () => {
      await result.current.light.upload(fakeFile('logo.svg'));
    });

    expect(onUpload).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });
});
